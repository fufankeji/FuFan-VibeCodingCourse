"""F3 T009-T012 — explain_service orchestration.

Single entry point: `explain(ExplainRequest) -> ExplainResult`.

Pipeline:
  1. cache lookup (key = code + anomaly_type, TTL 5 min) — T009
  2. budget guard (FR-006, FR-014) — T011
  3. context_assembler — T012
  4. llm_service (or skipped in template mode) — T010
  5. truncate ≤200 chars + scrub forbidden words + disclaimer — T010
  6. record cost in llm_budget — T011
  7. write cache — T010
"""
from __future__ import annotations

import logging
import time
from collections.abc import Callable
from pathlib import Path
from typing import Protocol

from app.db import add_llm_cost, get_llm_cost_today
from app.explain.prompt_templates import build_explain_messages
from app.explain.sensitive_filter import DISCLAIMER, apply_compliance
from app.models.explain import (
    AnomalyType,
    ExplainContext,
    ExplainRequest,
    ExplainResult,
    ResultSource,
)
from app.services.llm_service import LLMResponse, TemplateSignal

logger = logging.getLogger(__name__)

CACHE_TTL_S_DEFAULT = 300  # 5 min, spec §2.3

_ANOMALY_CN = {
    AnomalyType.LIMIT_UP: "涨停",
    AnomalyType.LIMIT_DOWN: "跌停",
    AnomalyType.BREAKOUT: "突破前高",
    AnomalyType.BREAKDOWN: "跌破前低",
    AnomalyType.VOLUME: "量能异常",
    AnomalyType.SUMMARY: "今日表现综述",
}


class _Assembler(Protocol):
    def assemble(self, *, code: str, name: str) -> ExplainContext: ...


class _LLM(Protocol):
    def complete(self, messages: list[dict[str, str]]) -> LLMResponse | TemplateSignal: ...


def _render_template(req: ExplainRequest, ctx: ExplainContext) -> str:
    """Rule-based fallback when LLM is unavailable / budget exhausted /
    template_mode is True (spec FR-005 + FR-014)."""
    label = _ANOMALY_CN.get(req.anomaly_type, req.anomaly_type.value)
    parts = [f"{req.name}（{req.code}）触发 {label}，最新价 {req.price}，涨跌幅 {req.change_pct}%。"]
    if req.volume_ratio is not None:
        parts.append(f"量比 {req.volume_ratio}。")
    if ctx.sector:
        sec = f"所属板块：{ctx.sector}"
        if ctx.sector_change_pct is not None:
            sec += f"（板块涨幅 {ctx.sector_change_pct}%）"
        parts.append(sec + "。")
    if ctx.industry:
        parts.append(f"行业：{ctx.industry}。")
    if ctx.partial:
        parts.append("（信息不全）")
    return "".join(parts)


def _data_insufficient(req: ExplainRequest) -> str:
    return f"{req.name}（{req.code}）数据不足，无法生成解释。"


class ExplainService:
    def __init__(
        self,
        *,
        assembler: _Assembler,
        llm: _LLM,
        db_path: Path,
        daily_budget: float,
        template_mode: bool,
        cache_ttl_s: int = CACHE_TTL_S_DEFAULT,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.assembler = assembler
        self.llm = llm
        self.db_path = db_path
        self.daily_budget = daily_budget
        self.template_mode = template_mode
        self.cache_ttl_s = cache_ttl_s
        self._clock = clock
        self._cache: dict[str, tuple[float, ExplainResult]] = {}

    # ── cache ─────────────────────────────────────────────────────────────
    def _cache_key(self, req: ExplainRequest) -> str:
        return f"{req.code}:{req.anomaly_type.value}"

    def _cache_get(self, key: str) -> ExplainResult | None:
        hit = self._cache.get(key)
        if not hit:
            return None
        stamped, res = hit
        if self._clock() - stamped > self.cache_ttl_s:
            return None
        return res

    def _cache_put(self, key: str, res: ExplainResult) -> None:
        self._cache[key] = (self._clock(), res)

    # ── budget guard (FR-006, FR-014) ────────────────────────────────────
    def _budget_exhausted(self) -> bool:
        if self.template_mode or self.daily_budget <= 0:
            return True
        try:
            current = get_llm_cost_today(self.db_path)
        except Exception as exc:
            logger.warning("budget read failed: %s — treating as exhausted", exc)
            return True
        return current >= self.daily_budget

    # ── main ─────────────────────────────────────────────────────────────
    def explain(self, req: ExplainRequest) -> ExplainResult:
        key = self._cache_key(req)
        cached = self._cache_get(key)
        if cached is not None:
            return cached

        ctx = self.assembler.assemble(code=req.code, name=req.name)

        # FR-012: 全部数据缺失（无行情 + 上下文 empty）→ 拒绝
        if ctx.empty and req.price == 0.0 and req.change_pct == 0.0:
            res = ExplainResult(
                text=apply_compliance(_data_insufficient(req)),
                source=ResultSource.TEMPLATE,
                partial=True,
            )
            self._cache_put(key, res)
            return res

        # Budget / template-mode path: skip LLM
        if self._budget_exhausted():
            body = _render_template(req, ctx)
            res = ExplainResult(
                text=apply_compliance(body),
                source=ResultSource.TEMPLATE,
                partial=ctx.partial,
            )
            self._cache_put(key, res)
            return res

        # LLM path
        messages = build_explain_messages(req, ctx)
        out = self.llm.complete(messages)

        if isinstance(out, TemplateSignal):
            body = _render_template(req, ctx)
            res = ExplainResult(
                text=apply_compliance(body),
                source=ResultSource.TEMPLATE,
                partial=ctx.partial,
            )
        else:
            # Record cost and label source
            try:
                add_llm_cost(self.db_path, out.cost_cny)
            except Exception as exc:
                logger.warning("budget write failed: %s", exc)
            source_map = {
                "llm_primary": ResultSource.LLM_PRIMARY,
                "llm_backup": ResultSource.LLM_BACKUP,
                "llm_local": ResultSource.LLM_LOCAL,
            }
            res = ExplainResult(
                text=apply_compliance(out.text),
                source=source_map.get(out.source, ResultSource.TEMPLATE),
                partial=ctx.partial,
            )

        self._cache_put(key, res)
        return res


# Re-export disclaimer so callers can recognise the tail
__all__ = ["ExplainService", "DISCLAIMER"]
