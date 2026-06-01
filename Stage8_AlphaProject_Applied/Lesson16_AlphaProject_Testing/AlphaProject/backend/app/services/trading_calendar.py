"""F1 T001 — Trading calendar (A 股交易日/时段判定).

Shared by F2 scan scheduler, F4 briefing trigger, F1 dashboard label.

Design:
  - Calendar fetched once and cached in-memory (process lifetime).
  - On fetch failure → conservative degrade: session_label returns "未知" instead
    of crashing; is_trading_day/is_trading_session return False (safer to under-
    trigger than over-trigger).

Sessions (Shanghai/Shenzhen exchanges):
  - Morning: 09:30:00 – 11:30:00
  - Afternoon: 13:00:00 – 15:00:00
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, datetime, time

CalendarFetcher = Callable[[], list[date]]

_MORNING_OPEN = time(9, 30)
_MORNING_CLOSE = time(11, 30)
_AFTERNOON_OPEN = time(13, 0)
_AFTERNOON_CLOSE = time(15, 0)


class TradingCalendar:
    """In-memory cached trading calendar with graceful degradation."""

    def __init__(self, fetcher: CalendarFetcher | None = None) -> None:
        self._fetcher = fetcher
        self._days: frozenset[date] | None = None
        self._fetch_failed = False

    def _ensure_loaded(self) -> bool:
        if self._days is not None:
            return True
        if self._fetch_failed or self._fetcher is None:
            return False
        try:
            days = self._fetcher()
            self._days = frozenset(days)
            return True
        except Exception:
            self._fetch_failed = True
            return False

    def is_trading_day(self, on: date) -> bool:
        if not self._ensure_loaded():
            return False
        assert self._days is not None
        return on in self._days

    def is_trading_session(self, now: datetime) -> bool:
        if not self.is_trading_day(now.date()):
            return False
        t = now.time()
        return (_MORNING_OPEN <= t <= _MORNING_CLOSE) or (
            _AFTERNOON_OPEN <= t <= _AFTERNOON_CLOSE
        )

    def session_label(self, now: datetime) -> str:
        if not self._ensure_loaded():
            return "未知"
        return "交易中" if self.is_trading_session(now) else "非交易"


__all__ = ["TradingCalendar", "CalendarFetcher"]
