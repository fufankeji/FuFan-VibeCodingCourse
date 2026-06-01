"""F4 T013 — scheduler registration + workday gate + history purge."""
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
from app.services.briefing_scheduler import (
    BriefingScheduler,
    is_workday,
    run_if_workday,
)


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    p = tmp_path / "test.db"
    init_db(p)
    return p


# ── is_workday ────────────────────────────────────────────────────────
def test_is_workday_weekend_false():
    # 2026-05-30 is Saturday
    assert is_workday(date(2026, 5, 30)) is False
    # 2026-05-31 Sunday
    assert is_workday(date(2026, 5, 31)) is False


def test_is_workday_weekday_true():
    # 2026-05-28 Thursday
    assert is_workday(date(2026, 5, 28)) is True


def test_is_workday_honors_holiday_callable():
    weekday = date(2026, 6, 1)  # Monday
    # holiday_fn returns True ⇒ skip
    assert is_workday(weekday, holiday_fn=lambda d: True) is False
    assert is_workday(weekday, holiday_fn=lambda d: False) is True


# ── run_if_workday ────────────────────────────────────────────────────
def test_run_if_workday_skips_on_weekend(db_path: Path):
    svc = MagicMock()
    run_if_workday(svc, clock=lambda: datetime(2026, 5, 30, 9, 15), is_followup=False)
    svc.generate_and_push.assert_not_called()


def test_run_if_workday_invokes_on_workday(db_path: Path):
    svc = MagicMock()
    run_if_workday(svc, clock=lambda: datetime(2026, 5, 28, 9, 15), is_followup=False)
    svc.generate_and_push.assert_called_once_with(is_followup=False)


def test_run_if_workday_passes_followup_flag(db_path: Path):
    svc = MagicMock()
    run_if_workday(svc, clock=lambda: datetime(2026, 5, 28, 9, 18), is_followup=True)
    svc.generate_and_push.assert_called_once_with(is_followup=True)


# ── purge ─────────────────────────────────────────────────────────────
def test_purge_removes_older_than_30_days(db_path: Path):
    save_briefing(db_path, on_date="2026-04-01", content_json="{}", version="full", push_status="delivered")
    save_briefing(db_path, on_date="2026-05-28", content_json="{}", version="full", push_status="delivered")
    # today = 2026-05-28 → 30 d ago = 2026-04-28; expect 04-01 purged
    sched = BriefingScheduler(db_path=db_path, service=MagicMock(), clock=lambda: datetime(2026, 5, 28))
    n = sched.purge_old_briefings()
    assert n == 1
    assert get_briefing_by_date(db_path, "2026-04-01") is None
    assert get_briefing_by_date(db_path, "2026-05-28") is not None


# ── BriefingScheduler.start registers 2 cron jobs ─────────────────────
def test_scheduler_register_jobs():
    sched_inst = MagicMock()
    svc = MagicMock()
    sched = BriefingScheduler(
        db_path=Path("/tmp/x.db"),
        service=svc,
        scheduler=sched_inst,
        trigger_time="09:15",
        followup_time="09:18",
    )
    sched.register()
    # Expect: 2 cron job adds (trigger + followup) + 1 daily purge job = 3 add_job calls
    assert sched_inst.add_job.call_count == 3
