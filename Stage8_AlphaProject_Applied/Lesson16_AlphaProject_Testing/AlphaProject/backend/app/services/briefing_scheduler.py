"""F4 T013 — briefing scheduler registration + workday gate + history purge.

Stays library-agnostic at unit-test level by accepting an injected scheduler
(must duck-type APScheduler's `add_job(func, trigger=..., **kwargs)`). Production
wiring (lifespan in app.main) provides a real BackgroundScheduler.
"""
from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Protocol

from app.config import settings
from app.db import delete_briefings_older_than

logger = logging.getLogger(__name__)


class _Scheduler(Protocol):
    def add_job(self, func, trigger: str = "cron", **kwargs) -> Any: ...


class _BriefingService(Protocol):
    def generate_and_push(self, *, is_followup: bool) -> None: ...


def is_workday(d: date, *, holiday_fn: Callable[[date], bool] | None = None) -> bool:
    """Mon-Fri AND not a holiday (per injected predicate).

    F1 trading_calendar not yet wired into BE; holiday_fn defaults to None (no
    holiday gating beyond weekend). Production scheduler can inject a real
    predicate when F1 lands.
    """
    if d.weekday() >= 5:
        return False
    if holiday_fn is not None and holiday_fn(d):
        return False
    return True


def run_if_workday(
    service: _BriefingService,
    *,
    clock: Callable[[], datetime] = datetime.now,
    is_followup: bool = False,
    holiday_fn: Callable[[date], bool] | None = None,
) -> None:
    today = clock().date()
    if not is_workday(today, holiday_fn=holiday_fn):
        logger.info("briefing skip: non-workday %s", today)
        return
    service.generate_and_push(is_followup=is_followup)


class BriefingScheduler:
    def __init__(
        self,
        *,
        db_path: Path,
        service: _BriefingService,
        scheduler: _Scheduler | None = None,
        trigger_time: str | None = None,
        followup_time: str | None = None,
        clock: Callable[[], datetime] = datetime.now,
        holiday_fn: Callable[[date], bool] | None = None,
        retention_days: int | None = None,
    ) -> None:
        self.db_path = db_path
        self.service = service
        self.scheduler = scheduler
        self.trigger_time = trigger_time or settings.BRIEFING_TRIGGER_TIME
        self.followup_time = followup_time or settings.BRIEFING_FOLLOWUP_TIME
        self.clock = clock
        self.holiday_fn = holiday_fn
        self.retention_days = retention_days or settings.BRIEFING_HISTORY_DAYS

    # ── public ───────────────────────────────────────────────────────
    def purge_old_briefings(self) -> int:
        today = self.clock().date()
        cutoff = (today - timedelta(days=self.retention_days)).isoformat()
        n = delete_briefings_older_than(self.db_path, before=cutoff)
        if n:
            logger.info("briefing purge: removed %d records older than %s", n, cutoff)
        return n

    def register(self) -> None:
        """Wire 3 cron jobs: 09:15 trigger / 09:18 followup / 03:00 daily purge."""
        if self.scheduler is None:
            raise RuntimeError("BriefingScheduler.register requires an injected scheduler")

        hh, mm = self.trigger_time.split(":")
        self.scheduler.add_job(
            self._trigger_main,
            trigger="cron",
            hour=int(hh),
            minute=int(mm),
            id="briefing_main",
            replace_existing=True,
        )
        hh2, mm2 = self.followup_time.split(":")
        self.scheduler.add_job(
            self._trigger_followup,
            trigger="cron",
            hour=int(hh2),
            minute=int(mm2),
            id="briefing_followup",
            replace_existing=True,
        )
        self.scheduler.add_job(
            self.purge_old_briefings,
            trigger="cron",
            hour=3,
            minute=0,
            id="briefing_purge",
            replace_existing=True,
        )

    # ── job callables ────────────────────────────────────────────────
    def _trigger_main(self) -> None:
        run_if_workday(
            self.service, clock=self.clock, is_followup=False, holiday_fn=self.holiday_fn
        )

    def _trigger_followup(self) -> None:
        run_if_workday(
            self.service, clock=self.clock, is_followup=True, holiday_fn=self.holiday_fn
        )
