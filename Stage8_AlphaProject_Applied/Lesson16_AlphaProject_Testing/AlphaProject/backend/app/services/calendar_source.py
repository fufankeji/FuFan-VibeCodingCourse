"""F4 T005 — calendar_source.

Today's 财报披露 + 经济数据日历. AkShare endpoint names verified at runtime;
each sub-fetch fails open to an empty list. All-fail → status=missing. (FR-006)
"""
from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from app.models.briefing import BlockStatus, DataBlock

logger = logging.getLogger(__name__)


def _safe(fn: Callable[[], Any], label: str) -> tuple[list, bool]:
    try:
        return fn(), True
    except Exception as exc:
        logger.warning("calendar_source.%s failed: %s", label, exc)
        return [], False


class CalendarSource:
    def __init__(
        self,
        *,
        fetch_earnings: Callable[[], list[dict[str, Any]]],
        fetch_econ: Callable[[], list[dict[str, Any]]],
    ) -> None:
        self._fe = fetch_earnings
        self._fc = fetch_econ

    def fetch(self) -> DataBlock:
        e, e_ok = _safe(self._fe, "earnings")
        c, c_ok = _safe(self._fc, "econ")
        if not (e_ok or c_ok):
            return DataBlock(name="calendar", data=None, status=BlockStatus.missing)
        return DataBlock(
            name="calendar",
            data={"earnings": e, "econ": c},
            status=BlockStatus.ready,
        )
