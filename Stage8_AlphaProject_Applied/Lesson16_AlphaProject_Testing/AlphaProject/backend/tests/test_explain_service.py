"""T009-T012: explain_service orchestration tests.

Covers cache (T009), main orchestration (T010), budget guard (T011),
context-degrade (T012).
"""
from pathlib import Path

import pytest

from app.db import add_llm_cost, get_llm_cost_today, init_db
from app.explain.sensitive_filter import DISCLAIMER
from app.models.explain import (
    AnomalyType,
    ExplainContext,
    ExplainRequest,
)
from app.services.explain_service import ExplainService
from app.services.llm_service import LLMResponse, TemplateSignal


# ── fakes ─────────────────────────────────────────────────────────────────
class _FakeAssembler:
    def __init__(self, ctx: ExplainContext):
        self.ctx = ctx
        self.calls = 0

    def assemble(self, *, code, name):
        self.calls += 1
        return self.ctx


class _FakeLLM:
    def __init__(self, response):
        self.response = response
        self.calls = 0

    def complete(self, messages):
        self.calls += 1
        return self.response


@pytest.fixture
def db(tmp_path: Path) -> Path:
    p = tmp_path / "alpha.db"
    init_db(p)
    return p


def _req(code="600519", anomaly=AnomalyType.LIMIT_UP) -> ExplainRequest:
    return ExplainRequest(
        code=code,
        name="贵州茅台",
        anomaly_type=anomaly,
        price=1888.0,
        change_pct=10.0,
    )


# ── T010 happy path ──────────────────────────────────────────────────────
def test_explain_happy_path_llm(db: Path):
    asm = _FakeAssembler(ExplainContext(sector="白酒"))
    llm = _FakeLLM(LLMResponse(text="① 直接原因。② 关联。③ 政策。", source="llm_primary", cost_cny=0.01))
    svc = ExplainService(
        assembler=asm, llm=llm, db_path=db, daily_budget=5.0, template_mode=False
    )
    res = svc.explain(_req())
    assert res.text.endswith(DISCLAIMER)
    assert res.source == "llm_primary"
    # body truncated to ≤200 + disclaimer
    body = res.text[: -len(DISCLAIMER)].strip()
    assert len(body.rstrip(".")) <= 200
    # cost recorded
    assert get_llm_cost_today(db) > 0


def test_llm_failure_falls_to_template(db: Path):
    asm = _FakeAssembler(ExplainContext(sector="白酒"))
    llm = _FakeLLM(TemplateSignal())
    svc = ExplainService(
        assembler=asm, llm=llm, db_path=db, daily_budget=5.0, template_mode=False
    )
    res = svc.explain(_req())
    assert res.source == "template"
    assert "涨停" in res.text or "10" in res.text  # references the facts
    assert res.text.endswith(DISCLAIMER)


# ── T009 cache ───────────────────────────────────────────────────────────
def test_cache_hits_within_window(db: Path):
    asm = _FakeAssembler(ExplainContext(sector="白酒"))
    llm = _FakeLLM(LLMResponse(text="ok", source="llm_primary", cost_cny=0.01))
    clock = [1000.0]
    svc = ExplainService(
        assembler=asm,
        llm=llm,
        db_path=db,
        daily_budget=5.0,
        template_mode=False,
        cache_ttl_s=300,
        clock=lambda: clock[0],
    )
    svc.explain(_req())
    clock[0] += 60
    svc.explain(_req())
    assert llm.calls == 1
    assert asm.calls == 1


def test_cache_keyed_by_anomaly_type(db: Path):
    asm = _FakeAssembler(ExplainContext())
    llm = _FakeLLM(LLMResponse(text="ok", source="llm_primary", cost_cny=0.01))
    svc = ExplainService(
        assembler=asm, llm=llm, db_path=db, daily_budget=5.0, template_mode=False
    )
    svc.explain(_req(anomaly=AnomalyType.LIMIT_UP))
    svc.explain(_req(anomaly=AnomalyType.VOLUME))
    assert llm.calls == 2  # different keys


def test_cache_expires(db: Path):
    asm = _FakeAssembler(ExplainContext())
    llm = _FakeLLM(LLMResponse(text="ok", source="llm_primary", cost_cny=0.01))
    clock = [1000.0]
    svc = ExplainService(
        assembler=asm,
        llm=llm,
        db_path=db,
        daily_budget=5.0,
        template_mode=False,
        cache_ttl_s=300,
        clock=lambda: clock[0],
    )
    svc.explain(_req())
    clock[0] += 301
    svc.explain(_req())
    assert llm.calls == 2


# ── T011 budget guard ────────────────────────────────────────────────────
def test_budget_zero_pure_template_mode(db: Path):
    asm = _FakeAssembler(ExplainContext(sector="白酒"))
    llm = _FakeLLM(LLMResponse(text="should not be used", source="llm_primary", cost_cny=0.01))
    svc = ExplainService(
        assembler=asm, llm=llm, db_path=db, daily_budget=0.0, template_mode=True
    )
    res = svc.explain(_req())
    assert res.source == "template"
    assert llm.calls == 0  # never called the LLM


def test_budget_exhausted_degrades_to_template(db: Path):
    # Pre-populate today's cost above budget
    add_llm_cost(db, 5.5)
    asm = _FakeAssembler(ExplainContext())
    llm = _FakeLLM(LLMResponse(text="x", source="llm_primary", cost_cny=0.01))
    svc = ExplainService(
        assembler=asm, llm=llm, db_path=db, daily_budget=5.0, template_mode=False
    )
    res = svc.explain(_req())
    assert res.source == "template"
    assert llm.calls == 0


# ── T010 truncate + sensitive (integration) ──────────────────────────────
def test_truncate_oversized_llm_output(db: Path):
    asm = _FakeAssembler(ExplainContext())
    llm = _FakeLLM(
        LLMResponse(text="茅" * 300, source="llm_primary", cost_cny=0.01)
    )
    svc = ExplainService(
        assembler=asm, llm=llm, db_path=db, daily_budget=5.0, template_mode=False
    )
    res = svc.explain(_req())
    body = res.text[: -len(DISCLAIMER)].strip()
    assert body.endswith("...")
    assert len(body.rstrip(".")) <= 200


def test_forbidden_words_scrubbed(db: Path):
    asm = _FakeAssembler(ExplainContext())
    llm = _FakeLLM(
        LLMResponse(
            text="券商建议买入并给出目标价 100。", source="llm_primary", cost_cny=0.01
        )
    )
    svc = ExplainService(
        assembler=asm, llm=llm, db_path=db, daily_budget=5.0, template_mode=False
    )
    res = svc.explain(_req())
    assert "建议买入" not in res.text
    assert "目标价" not in res.text


# ── T012 context degrade ─────────────────────────────────────────────────
def test_partial_context_marks_partial_in_result(db: Path):
    asm = _FakeAssembler(ExplainContext(partial=True))
    llm = _FakeLLM(LLMResponse(text="基于行情。", source="llm_primary", cost_cny=0.01))
    svc = ExplainService(
        assembler=asm, llm=llm, db_path=db, daily_budget=5.0, template_mode=False
    )
    res = svc.explain(_req())
    assert res.partial is True


def test_no_quote_data_at_all_returns_data_insufficient(db: Path):
    asm = _FakeAssembler(ExplainContext())
    llm = _FakeLLM(LLMResponse(text="x", source="llm_primary", cost_cny=0.01))
    svc = ExplainService(
        assembler=asm, llm=llm, db_path=db, daily_budget=5.0, template_mode=False
    )
    # Build request with no price (None) → service should refuse
    bad = ExplainRequest(
        code="X",
        name="未知",
        anomaly_type=AnomalyType.SUMMARY,
        price=0.0,
        change_pct=0.0,
    )
    # Mark assembler as fully empty (no news + no sector)
    asm.ctx = ExplainContext(empty=True)
    res = svc.explain(bad)
    assert res.source == "template"
    assert "数据不足" in res.text
