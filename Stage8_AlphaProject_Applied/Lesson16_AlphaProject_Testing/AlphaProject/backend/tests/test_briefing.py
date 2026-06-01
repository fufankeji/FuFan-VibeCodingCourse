"""F4 T015 — SC-001..SC-006 success-criteria integration tests.

These are higher-level than the per-module tests (T001..T014) and trace
explicitly to the spec.md success criteria. They run BriefingService end-
to-end with mocked F3/F6/AkShare seams.
"""
from datetime import date, datetime
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from app.db import (
    delete_briefings_older_than,
    get_briefing_by_date,
    init_db,
    save_briefing,
)
from app.models.briefing import BlockStatus, DataBlock
from app.models.push import Priority, PushRequest
from app.services.briefing_scheduler import is_workday, run_if_workday
from app.services.briefing_service import BriefingService
from app.services.llm_service import LLMResponse, TemplateSignal


class _Push:
    def __init__(self):
        self.sent: list[PushRequest] = []

    def send(self, req):
        self.sent.append(req)
        return MagicMock(status="delivered")


def _ok_market():
    s = MagicMock()
    s.fetch.return_value = DataBlock(
        name="market_overview",
        data={"global": [{"name": "纳指", "change_pct": -0.5}], "yesterday": {"sh": 3200}, "sectors": []},
    )
    return s


def _ok_cal():
    s = MagicMock()
    s.fetch.return_value = DataBlock(
        name="calendar", data={"earnings": [], "econ": [{"name": "CPI"}]}
    )
    return s


def _ok_news():
    n = MagicMock()
    n.fetch_telegraph.return_value = [MagicMock(title="新规出台")]
    return n


def _stub_svc(db, *, push, llm, watchlist=None, market=None, cal=None, news=None):
    return BriefingService(
        db_path=db,
        push=push,
        llm=llm,
        market_source=market or _ok_market(),
        calendar_source=cal or _ok_cal(),
        news_source=news or _ok_news(),
        watchlist_snapshot=watchlist or (lambda: [{"code": "600519", "name": "贵州茅台"}]),
        clock=lambda: datetime(2026, 5, 28, 9, 15),
    )


@pytest.fixture
def db(tmp_path: Path) -> Path:
    p = tmp_path / "x.db"
    init_db(p)
    return p


# ── SC-001: 09:15 ±30s 工作日触发 ──────────────────────────────────
def test_sc001_workday_window():
    assert is_workday(date(2026, 5, 28)) is True


# ── SC-002: 任一数据源失败仍按时发出 ────────────────────────────────
def test_sc002_news_failure_does_not_block_push(db: Path):
    bad_news = MagicMock()
    bad_news.fetch_telegraph.side_effect = RuntimeError("CLS down")
    push = _Push()
    svc = _stub_svc(
        db,
        push=push,
        llm=MagicMock(complete=MagicMock(return_value=LLMResponse(text="正文", source="llm_primary", cost_cny=0.0))),
        news=bad_news,
    )
    svc.generate_and_push()
    assert len(push.sent) == 1


# ── SC-003: 正文 ≤ 1200 字 ───────────────────────────────────────
def test_sc003_body_within_1200_chars(db: Path):
    long = "字" * 5000
    svc = _stub_svc(
        db,
        push=_Push(),
        llm=MagicMock(complete=MagicMock(return_value=LLMResponse(text=long, source="llm_primary", cost_cny=0.0))),
    )
    content = svc.build_content(svc.fetch_blocks())
    assert len(content.body_text) <= 1200


# ── SC-004: 节假日 / 周末 100% 不发 ─────────────────────────────────
def test_sc004_weekend_skips_briefing():
    svc = MagicMock()
    # 2026-05-30 Saturday
    run_if_workday(svc, clock=lambda: datetime(2026, 5, 30, 9, 15), is_followup=False)
    svc.generate_and_push.assert_not_called()


def test_sc004_holiday_skips_briefing():
    svc = MagicMock()
    weekday_holiday = datetime(2026, 6, 1, 9, 15)  # Monday but call says holiday
    run_if_workday(
        svc,
        clock=lambda: weekday_holiday,
        is_followup=False,
        holiday_fn=lambda d: True,
    )
    svc.generate_and_push.assert_not_called()


# ── SC-005: 保留 30 天，超期清理 ─────────────────────────────────────
def test_sc005_purge_removes_older_than_cutoff(db: Path):
    save_briefing(db, on_date="2025-12-01", content_json="{}", version="full", push_status="delivered")
    save_briefing(db, on_date="2026-05-28", content_json="{}", version="full", push_status="delivered")
    n = delete_briefings_older_than(db, before="2026-04-28")
    assert n == 1
    assert get_briefing_by_date(db, "2025-12-01") is None


# ── SC-006: 风险尾标 100% 附带，禁建议词不漏出 ─────────────────────
def test_sc006_disclaimer_tail_present_and_forbidden_word_scrubbed(db: Path):
    # LLM 文本含禁建议词 + 没含尾标 → 走 sensitive_filter 兜底
    push = _Push()
    bad_text = "短期建议买入。"  # 含禁词
    svc = _stub_svc(
        db,
        push=push,
        llm=MagicMock(complete=MagicMock(return_value=LLMResponse(text=bad_text, source="llm_primary", cost_cny=0.0))),
    )
    svc.generate_and_push()
    body = push.sent[0].content.get("text", "")
    assert "不构成投资建议" in body
    assert "建议买入" not in body


# ── Edge: LLM 超时 / 不可用 → 裸数据版 ───────────────────────────────
def test_llm_unavailable_yields_raw_version(db: Path):
    push = _Push()
    svc = _stub_svc(
        db, push=push, llm=MagicMock(complete=MagicMock(return_value=TemplateSignal()))
    )
    svc.generate_and_push()
    row = get_briefing_by_date(db, "2026-05-28")
    assert row["version"] == "raw"


# ── Edge: PushRequest priority=system AND no dedup keys ───────────────
def test_push_request_priority_system_no_dedup(db: Path):
    push = _Push()
    svc = _stub_svc(
        db,
        push=push,
        llm=MagicMock(complete=MagicMock(return_value=LLMResponse(text="正文", source="llm_primary", cost_cny=0.0))),
    )
    svc.generate_and_push()
    req = push.sent[0]
    assert req.priority == Priority.system
    assert req.code is None
    assert req.signal is None
