"""T010-T012 — F2 异动扫描编排.

scan_cycle():
  1. 读 F5 清单 (watchlist_service.snapshot)
  2. 读每股 quote (quote_fetcher) + kline closes (kline_fetcher) — 注入式
  3. 跑 price/volume/amplitude/event 规则（按 RuleConfig 启用位）
  4. anomaly_state 转换检测 → 新异动列表
  5. 持仓优先排序 → 调 F3 explain (超时/失败 → 裸卡片) → 调 F6 send

注入点全部是协议 / 函数，方便测试 mock：
  - watchlist_service.snapshot() -> list[dict]
  - quote_fetcher(code) -> QuoteSnapshot | None
  - kline_fetcher(code) -> list[float]  # 近 N 日收盘价（涵盖窗口判定用）
  - news_source: F3 NewsSource (.fetch_telegraph / .fetch_announcements)
  - explain_service.explain(ExplainRequest) -> ExplainResult
  - push_service.send(PushRequest) -> PushOutcome
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any, Callable, Protocol

from app.anomaly.anomaly_state import StateManager
from app.anomaly.event_rules import detect_events
from app.anomaly.price_rules import (
    detect_amplitude,
    detect_breakout_breakdown,
    detect_limit,
    detect_volume,
)
from app.anomaly.rule_config import RuleConfigStore
from app.config import settings
from app.models.anomaly import AnomalySignal, AnomalyType
from app.models.explain import AnomalyType as F3AnomalyType, ExplainRequest
from app.models.push import MsgType, Priority, PushRequest

logger = logging.getLogger(__name__)


# Map F2-only signals to a closest F3 type for explain (event → SUMMARY, amplitude → VOLUME).
_F2_TO_F3: dict[AnomalyType, F3AnomalyType] = {
    AnomalyType.LIMIT_UP: F3AnomalyType.LIMIT_UP,
    AnomalyType.LIMIT_DOWN: F3AnomalyType.LIMIT_DOWN,
    AnomalyType.BREAKOUT: F3AnomalyType.BREAKOUT,
    AnomalyType.BREAKDOWN: F3AnomalyType.BREAKDOWN,
    AnomalyType.VOLUME: F3AnomalyType.VOLUME,
    AnomalyType.AMPLITUDE: F3AnomalyType.VOLUME,
    AnomalyType.EVENT: F3AnomalyType.SUMMARY,
}


@dataclass
class QuoteSnapshot:
    code: str
    change_pct: float = 0.0
    price: float = 0.0
    volume_ratio: float = 1.0
    high: float = 0.0
    low: float = 0.0
    prev_close: float = 0.0
    ts: float = 0.0  # unix seconds
    suspended: bool = False


class _Push(Protocol):
    def send(self, req: PushRequest) -> Any: ...


class _Explain(Protocol):
    def explain(self, req: ExplainRequest) -> Any: ...


class _Watchlist(Protocol):
    def snapshot(self) -> list[dict[str, Any]]: ...


class AnomalyService:
    def __init__(
        self,
        *,
        watchlist_service: _Watchlist,
        quote_fetcher: Callable[[str], QuoteSnapshot | None],
        kline_fetcher: Callable[[str], list[float]],
        news_source,
        explain_service: _Explain,
        push_service: _Push,
        rule_store: RuleConfigStore | None = None,
        state_manager: StateManager | None = None,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self.wl = watchlist_service
        self.quote = quote_fetcher
        self.kline = kline_fetcher
        self.news = news_source
        self.explain = explain_service
        self.push = push_service
        self.rules = rule_store or RuleConfigStore()
        self.sm = state_manager or StateManager()
        self._clock = clock
        self.last_cycle_paused = False
        self.last_cycle_at: float = 0.0

    # ── public ────────────────────────────────────────────────────────────
    def scan_cycle(self) -> list[AnomalySignal]:
        """One scan cycle. Returns NEW signals (post transition detection)."""
        self.last_cycle_at = self._clock()
        cfg = self.rules.effective()
        watchlist = self.wl.snapshot() or []
        new_signals: list[AnomalySignal] = []
        per_stock: dict[str, list[AnomalySignal]] = {}

        # Decide whether price rules paused (FR-009)
        price_paused = self._price_paused(watchlist)
        self.last_cycle_paused = price_paused

        # Price-side rules
        if not price_paused:
            for w in watchlist:
                code = str(w.get("code", ""))
                name = str(w.get("name", ""))
                is_holding = bool(w.get("is_holding", False))
                q = self.quote(code)
                if q is None or q.suspended:
                    continue
                sigs = self._run_price_rules(q, name=name, is_holding=is_holding, cfg=cfg)
                new = self.sm.evaluate(code, sigs)
                if new:
                    per_stock.setdefault(code, []).extend(new)
                    new_signals.extend(new)

        # Event rules — always allowed (FR-002 + spec §6 §2.1)
        if cfg.event_enabled:
            ev_sigs = detect_events(watchlist, news_source=self.news)
            # group per code; transition-check by reusing state on EVENT bucket
            by_code: dict[str, list[AnomalySignal]] = {}
            for s in ev_sigs:
                by_code.setdefault(s.code, []).append(s)
            for code, sigs in by_code.items():
                # event signals are point-in-time; use the SAME StateManager but
                # only register the EVENT type alongside whatever the price scan
                # already committed for this code. We avoid clobbering price state.
                prev_full = self.sm.state.get(code)
                combined = prev_full | {AnomalyType.EVENT}
                new_types = combined - prev_full
                self.sm.state.set(code, combined)
                if new_types:
                    new_for_stock = [s for s in sigs if s.anomaly_type in new_types]
                    per_stock.setdefault(code, []).extend(new_for_stock)
                    new_signals.extend(new_for_stock)

        # Push orchestration — priority then per-stock merged
        self._dispatch(per_stock, watchlist)
        return new_signals

    def current_badges(self) -> dict[str, list[str]]:
        return self.sm.state.all_badges()

    # ── internal ──────────────────────────────────────────────────────────
    def _price_paused(self, watchlist: list[dict[str, Any]]) -> bool:
        """Pause price rules if any quote we'd scan looks stale (FR-009)."""
        threshold = settings.ANOMALY_DATA_STALE_S
        now = self._clock()
        for w in watchlist:
            q = self.quote(str(w.get("code", "")))
            if q is None:
                continue
            if q.ts and (now - q.ts) > threshold:
                logger.warning("anomaly_service: stale quote for %s, pausing price rules", w.get("code"))
                return True
        return False

    def _run_price_rules(
        self, q: QuoteSnapshot, *, name: str, is_holding: bool, cfg
    ) -> list[AnomalySignal]:
        out: list[AnomalySignal] = []
        if cfg.limit_enabled:
            r = detect_limit(
                code=q.code, name=name, change_pct=q.change_pct,
                price=q.price, is_holding=is_holding,
            )
            if r:
                out.append(r)
        if cfg.breakout_enabled:
            closes = self.kline(q.code) or []
            r = detect_breakout_breakdown(
                code=q.code, name=name, price=q.price,
                recent_closes=closes, is_holding=is_holding,
            )
            if r:
                out.append(r)
        if cfg.volume_enabled:
            r = detect_volume(
                code=q.code, name=name, volume_ratio=q.volume_ratio,
                threshold=cfg.volume_ratio, price=q.price, is_holding=is_holding,
            )
            if r:
                out.append(r)
        if cfg.amplitude_enabled and q.prev_close > 0 and q.high > 0:
            r = detect_amplitude(
                code=q.code, name=name, high=q.high, low=q.low,
                prev_close=q.prev_close, threshold=cfg.amplitude_pct,
                is_holding=is_holding,
            )
            if r:
                out.append(r)
        return out

    def _dispatch(
        self,
        per_stock: dict[str, list[AnomalySignal]],
        watchlist: list[dict[str, Any]],
    ) -> None:
        """Priority queue + per-stock merged single push (FR-005/006/011/014)."""
        holding_codes = {w["code"] for w in watchlist if w.get("is_holding")}
        # Holdings first, then watch
        ordered = sorted(
            per_stock.items(),
            key=lambda kv: (0 if kv[0] in holding_codes else 1, kv[0]),
        )

        for code, sigs in ordered:
            if not sigs:
                continue
            primary = sigs[0]
            tags = sorted({s.anomaly_type.value for s in sigs})
            name = primary.name or code
            is_holding = primary.is_holding

            # Call F3 (timeout / failure → bare card per FR-011)
            explain_text: str | None = None
            try:
                req = ExplainRequest(
                    code=code,
                    name=name,
                    anomaly_type=_F2_TO_F3[primary.anomaly_type],
                    price=primary.price,
                    change_pct=primary.change_pct,
                    volume_ratio=primary.volume_ratio,
                )
                res = self.explain.explain(req)
                explain_text = getattr(res, "text", None)
            except Exception as exc:
                logger.warning("explain failed for %s: %s — sending bare card", code, exc)

            content = self._build_card(name=name, code=code, primary=primary,
                                       tags=tags, explain_text=explain_text)
            push_req = PushRequest(
                msg_type=MsgType.interactive,
                content=content,
                priority=Priority.holding if is_holding else Priority.watch,
                code=code,
                signal="+".join(tags),
            )
            try:
                self.push.send(push_req)
            except Exception as exc:
                logger.exception("push.send failed for %s: %s", code, exc)

    def _build_card(
        self, *, name: str, code: str, primary: AnomalySignal,
        tags: list[str], explain_text: str | None,
    ) -> dict[str, Any]:
        """Minimal interactive-card payload. F6 card_renderer 不需要严格 schema —
        F2 提供"信息字段"，F6 负责实际飞书卡片渲染（spec §2.2 已声明)."""
        header = f"{name}({code}) " + "/".join(tags)
        body_lines = [
            f"当前价: {primary.price}",
            f"涨跌幅: {primary.change_pct}%",
        ]
        if primary.volume_ratio is not None:
            body_lines.append(f"量比: {primary.volume_ratio}")
        if explain_text:
            body_lines.append(explain_text)
        return {
            "header": header,
            "anomaly_types": tags,
            "elements": [{"tag": "div", "text": "\n".join(body_lines)}],
        }


__all__ = ["AnomalyService", "QuoteSnapshot"]
