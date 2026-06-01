"""F1 T001 — trading_calendar tests (RED → GREEN).

Covers:
  - is_trading_day: weekdays True, weekends False, calendar-aware holidays.
  - is_trading_session: 9:30–11:30 + 13:00–15:00 on trading days; outside False.
  - session_label: "交易中" / "非交易" / "未知" (calendar fetch failure保守).
  - Calendar fetch failure → conservative degrade: returns "unknown" label
    with timestamp, NOT crash.
"""

from __future__ import annotations

from datetime import date, datetime

import pytest

from app.services.trading_calendar import TradingCalendar


class _StubFetcher:
    """In-memory calendar fetcher. None = simulate failure."""

    def __init__(self, days: list[date] | None):
        self._days = days
        self.calls = 0

    def __call__(self) -> list[date]:
        self.calls += 1
        if self._days is None:
            raise RuntimeError("akshare calendar unreachable")
        return self._days


@pytest.fixture()
def trading_days() -> list[date]:
    # Mon-Fri 2026-05-25..29 (a typical week)
    return [date(2026, 5, 25), date(2026, 5, 26), date(2026, 5, 27), date(2026, 5, 28), date(2026, 5, 29)]


def test_is_trading_day_weekday_true(trading_days):
    cal = TradingCalendar(fetcher=_StubFetcher(trading_days))
    assert cal.is_trading_day(date(2026, 5, 28)) is True


def test_is_trading_day_weekend_false(trading_days):
    cal = TradingCalendar(fetcher=_StubFetcher(trading_days))
    # Saturday 2026-05-30 not in calendar
    assert cal.is_trading_day(date(2026, 5, 30)) is False


def test_is_trading_session_midday_true(trading_days):
    cal = TradingCalendar(fetcher=_StubFetcher(trading_days))
    now = datetime(2026, 5, 28, 10, 0, 0)
    assert cal.is_trading_session(now) is True


def test_is_trading_session_lunch_break_false(trading_days):
    cal = TradingCalendar(fetcher=_StubFetcher(trading_days))
    now = datetime(2026, 5, 28, 12, 0, 0)
    assert cal.is_trading_session(now) is False


def test_is_trading_session_afternoon_true(trading_days):
    cal = TradingCalendar(fetcher=_StubFetcher(trading_days))
    now = datetime(2026, 5, 28, 14, 30, 0)
    assert cal.is_trading_session(now) is True


def test_is_trading_session_pre_open_false(trading_days):
    cal = TradingCalendar(fetcher=_StubFetcher(trading_days))
    now = datetime(2026, 5, 28, 9, 0, 0)
    assert cal.is_trading_session(now) is False


def test_session_label_trading(trading_days):
    cal = TradingCalendar(fetcher=_StubFetcher(trading_days))
    assert cal.session_label(datetime(2026, 5, 28, 10, 0, 0)) == "交易中"


def test_session_label_non_trading(trading_days):
    cal = TradingCalendar(fetcher=_StubFetcher(trading_days))
    assert cal.session_label(datetime(2026, 5, 30, 10, 0, 0)) == "非交易"


def test_calendar_fetch_failure_returns_unknown():
    cal = TradingCalendar(fetcher=_StubFetcher(None))
    # First call fails — must NOT raise; conservative degrade to "未知"
    assert cal.session_label(datetime(2026, 5, 28, 10, 0, 0)) == "未知"


def test_calendar_cached_after_first_success(trading_days):
    fetcher = _StubFetcher(trading_days)
    cal = TradingCalendar(fetcher=fetcher)
    cal.is_trading_day(date(2026, 5, 28))
    cal.is_trading_day(date(2026, 5, 29))
    # Calendar fetched once, cached after.
    assert fetcher.calls == 1
