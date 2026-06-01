"""F4 T004 — market_overview_source.

Pulls 3 sub-datasets for the 市场概览 block:
  - 隔夜外盘指数 (AkShare global indices)
  - 昨日 A 股收盘 (复用 F1 quote_service / 暂以注入 fetcher 表达)
  - 板块涨跌幅

Each sub-fetch is failure-tolerant: errors degrade to empty list/dict so the
block can still report what it has. If *all* sub-fetches fail, the block
status is `missing`. (FR-006)
"""
from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from app.models.briefing import BlockStatus, DataBlock

logger = logging.getLogger(__name__)

_FetchGlobal = Callable[[], list[dict[str, Any]]]
_FetchYesterday = Callable[[], dict[str, Any]]
_FetchSectors = Callable[[], list[dict[str, Any]]]


def _safe(fn: Callable[[], Any], default: Any, label: str) -> tuple[Any, bool]:
    """Call fn; on failure log + return (default, False). Else (value, True)."""
    try:
        return fn(), True
    except Exception as exc:
        logger.warning("market_overview_source.%s failed: %s", label, exc)
        return default, False


class MarketOverviewSource:
    def __init__(
        self,
        *,
        fetch_global: _FetchGlobal,
        fetch_yesterday: _FetchYesterday,
        fetch_sectors: _FetchSectors,
    ) -> None:
        self._fg = fetch_global
        self._fy = fetch_yesterday
        self._fs = fetch_sectors

    def fetch(self) -> DataBlock:
        g, g_ok = _safe(self._fg, [], "global")
        y, y_ok = _safe(self._fy, {}, "yesterday")
        s, s_ok = _safe(self._fs, [], "sectors")
        if not (g_ok or y_ok or s_ok):
            return DataBlock(name="market_overview", data=None, status=BlockStatus.missing)
        return DataBlock(
            name="market_overview",
            data={"global": g, "yesterday": y, "sectors": s},
            status=BlockStatus.ready,
        )
