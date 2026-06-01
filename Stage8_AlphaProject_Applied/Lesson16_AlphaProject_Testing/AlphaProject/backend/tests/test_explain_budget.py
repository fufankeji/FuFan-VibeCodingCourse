"""T002: llm_budget table + add/get + day-boundary reset.

[出参验证] 累加成本可读写；跨日自动归零。
"""
from datetime import date, timedelta
from pathlib import Path

import pytest

from app.db import (
    add_llm_cost,
    get_llm_cost_today,
    init_db,
    reset_llm_budget_if_new_day,
)


@pytest.fixture
def db(tmp_path: Path) -> Path:
    p = tmp_path / "alpha.db"
    init_db(p)
    return p


def test_initial_cost_today_is_zero(db: Path):
    assert get_llm_cost_today(db) == 0.0


def test_add_cost_accumulates_today(db: Path):
    add_llm_cost(db, 0.012)
    add_llm_cost(db, 0.034)
    assert get_llm_cost_today(db) == pytest.approx(0.046)


def test_reset_on_new_day(db: Path):
    today = date(2026, 5, 28)
    add_llm_cost(db, 1.5, on_date=today)
    assert get_llm_cost_today(db, today=today) == pytest.approx(1.5)
    # Next trading day comes
    next_day = today + timedelta(days=1)
    reset_llm_budget_if_new_day(db, today=next_day)
    assert get_llm_cost_today(db, today=next_day) == 0.0


def test_per_day_isolation(db: Path):
    d1 = date(2026, 5, 27)
    d2 = date(2026, 5, 28)
    add_llm_cost(db, 0.5, on_date=d1)
    add_llm_cost(db, 0.2, on_date=d2)
    assert get_llm_cost_today(db, today=d1) == pytest.approx(0.5)
    assert get_llm_cost_today(db, today=d2) == pytest.approx(0.2)
