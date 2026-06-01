"""F4 T008-T012 — briefing_service orchestration.

Pipeline (per generate_and_push() call):
  1. fetch_blocks() — pull 5 data blocks concurrently (T008)
       market_overview / calendar / news / watchlist  (+ news block ≡ news + later we may add others)
  2. build_content() — assemble briefing prompt → LLM → ≤1200 char body
       (T009; LLM TemplateSignal / failure → raw version)
  3. card_builder.build_card() → sensitive_filter.apply_compliance(tail) (T010)
  4. F6 push_service.send (priority=system, no dedup key) (T010)
  5. save briefing_record + delete >30d (T010, scheduler does delete in T013)
  6. degrade rules:
     - any block missing → keep going, just skip in card  (T011)
     - watchlist empty   → skip section in card (FR-009, handled by card_builder)
     - ALL data sources missing → placeholder version (T011)
     - 9:15 warmup vs 9:18 full version stamping (T012)
"""
from __future__ import annotations

import json
import logging
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from typing import Protocol

from app.briefing.briefing_prompt import build_briefing_messages
from app.briefing.card_builder import build_card
from app.config import settings
from app.db import save_briefing
from app.explain.sensitive_filter import apply_compliance
from app.models.briefing import (
    BlockStatus,
    BriefingContent,
    BriefingVersion,
    DataBlock,
)
from app.models.push import MsgType, Priority, PushRequest
from app.services.llm_service import LLMResponse, TemplateSignal

logger = logging.getLogger(__name__)


class _MarketSource(Protocol):
    def fetch(self) -> DataBlock: ...


class _CalendarSource(Protocol):
    def fetch(self) -> DataBlock: ...


class _NewsSource(Protocol):
    def fetch_telegraph(self) -> list: ...


class _LLM(Protocol):
    def complete(self, messages: list[dict[str, str]]) -> LLMResponse | TemplateSignal: ...


class _Push(Protocol):
    def send(self, req: PushRequest): ...


def _safe_fetch(fn: Callable, default: DataBlock, label: str) -> DataBlock:
    try:
        return fn()
    except Exception as exc:
        logger.warning("briefing_service.%s failed: %s", label, exc)
        return default


def _missing(name: str) -> DataBlock:
    return DataBlock(name=name, data=None, status=BlockStatus.missing)


class BriefingService:
    def __init__(
        self,
        *,
        db_path: Path,
        push: _Push,
        llm: _LLM,
        market_source: _MarketSource,
        calendar_source: _CalendarSource,
        news_source: _NewsSource,
        watchlist_snapshot: Callable[[], list[dict]],
        clock: Callable[[], datetime] = datetime.now,
    ) -> None:
        self.db_path = db_path
        self.push = push
        self.llm = llm
        self.market = market_source
        self.calendar = calendar_source
        self.news = news_source
        self.watchlist_snapshot = watchlist_snapshot
        self.clock = clock

    # ── T008 ─────────────────────────────────────────────────────────
    def fetch_blocks(self) -> dict[str, DataBlock]:
        """并发拉 5 类 → 4 个 DataBlock（news 合并财联社电报，自选独立块）."""

        def _market():
            return _safe_fetch(self.market.fetch, _missing("market_overview"), "market")

        def _cal():
            return _safe_fetch(self.calendar.fetch, _missing("calendar"), "calendar")

        def _news_blk():
            try:
                items = self.news.fetch_telegraph()
                if not items:
                    return DataBlock(name="news", data=[], status=BlockStatus.ready)
                # Normalize NewsItem to plain dicts for downstream rendering.
                normed = [
                    {"title": getattr(n, "title", str(n))}
                    for n in items[:5]
                ]
                return DataBlock(name="news", data=normed, status=BlockStatus.ready)
            except Exception as exc:
                logger.warning("briefing_service.news failed: %s", exc)
                return _missing("news")

        def _wl_blk():
            try:
                items = self.watchlist_snapshot() or []
                return DataBlock(name="watchlist", data=items, status=BlockStatus.ready)
            except Exception as exc:
                logger.warning("briefing_service.watchlist failed: %s", exc)
                return _missing("watchlist")

        with ThreadPoolExecutor(max_workers=4) as ex:
            futures = {
                "market_overview": ex.submit(_market),
                "calendar": ex.submit(_cal),
                "news": ex.submit(_news_blk),
                "watchlist": ex.submit(_wl_blk),
            }
            return {k: f.result() for k, f in futures.items()}

    # ── T009 ─────────────────────────────────────────────────────────
    def build_content(
        self, blocks: dict[str, DataBlock], *, version_hint: BriefingVersion | None = None
    ) -> BriefingContent:
        """Run LLM → truncate ≤1200 char → assemble BriefingContent.

        Version resolution:
        - all blocks missing → placeholder
        - LLM TemplateSignal / exception → raw
        - else version_hint (warmup if any block missing else full)
        """
        all_missing = all(b.status == BlockStatus.missing for b in blocks.values())
        any_missing = any(b.status == BlockStatus.missing for b in blocks.values())

        if all_missing:
            return BriefingContent(
                market_overview=blocks["market_overview"],
                watchlist=blocks["watchlist"],
                news=blocks["news"],
                calendar=blocks["calendar"],
                body_text="今日数据获取异常，请稍后通过 Dashboard 查看。",
                version=BriefingVersion.placeholder,
            )

        messages = build_briefing_messages(
            market_overview=blocks["market_overview"],
            watchlist=blocks["watchlist"],
            news=blocks["news"],
            calendar=blocks["calendar"],
        )

        body = ""
        version = version_hint or (
            BriefingVersion.warmup if any_missing else BriefingVersion.full
        )
        try:
            out = self.llm.complete(messages)
        except Exception as exc:
            logger.warning("briefing_service llm.complete raised: %s", exc)
            out = TemplateSignal()

        if isinstance(out, LLMResponse):
            body = out.text
        else:
            # Raw fallback: derive a short summary from blocks themselves.
            body = self._raw_summary(blocks)
            version = BriefingVersion.raw

        if len(body) > settings.BRIEFING_BODY_LIMIT:
            body = body[: settings.BRIEFING_BODY_LIMIT]

        return BriefingContent(
            market_overview=blocks["market_overview"],
            watchlist=blocks["watchlist"],
            news=blocks["news"],
            calendar=blocks["calendar"],
            body_text=body,
            version=version,
        )

    def _raw_summary(self, blocks: dict[str, DataBlock]) -> str:
        """No-LLM degradation: render block facts as a compact one-liner."""
        parts: list[str] = []
        m = blocks["market_overview"]
        if m.status == BlockStatus.ready and m.data:
            sh = (m.data.get("yesterday") or {}).get("sh")
            if sh is not None:
                parts.append(f"上证昨收 {sh}")
        wl = blocks["watchlist"]
        if wl.status == BlockStatus.ready and wl.data:
            parts.append(f"自选 {len(wl.data)} 只")
        n = blocks["news"]
        if n.status == BlockStatus.ready and n.data:
            parts.append(f"昨夜电报 {len(n.data)} 条")
        if not parts:
            return "（裸数据版：上游数据有限）"
        return "、".join(parts) + "。"

    # ── T010 + T011 + T012 ───────────────────────────────────────────
    def generate_and_push(self, *, is_followup: bool = False) -> None:
        blocks = self.fetch_blocks()
        # T012: hint version by trigger time
        any_missing = any(b.status == BlockStatus.missing for b in blocks.values())
        hint: BriefingVersion | None
        if all(b.status == BlockStatus.missing for b in blocks.values()):
            hint = None  # build_content will set placeholder
        elif is_followup:
            hint = BriefingVersion.full
        elif any_missing:
            hint = BriefingVersion.warmup
        else:
            hint = BriefingVersion.full

        content = self.build_content(blocks, version_hint=hint)
        card_md = build_card(content)
        # FR-010 风险尾标：F3 sensitive_filter；body 已 ≤1200，给个宽限 cap
        card_md = apply_compliance(card_md, limit=settings.BRIEFING_BODY_LIMIT + 2000)

        req = PushRequest(
            msg_type=MsgType.text,
            content={"text": card_md},
            priority=Priority.system,
            # FR-005: 简报不参与 dedup → 不传 code/signal
        )
        outcome = self.push.send(req)
        status = getattr(outcome, "status", "unknown")

        today = self.clock().date().isoformat()
        save_briefing(
            self.db_path,
            on_date=today,
            content_json=content.model_dump_json(),
            version=content.version.value,
            push_status=status,
        )
