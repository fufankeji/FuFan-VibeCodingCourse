"""F1 T002 — quote_service tests (RED → GREEN).

Covers FR-002/004/008/012:
  - Happy path: spot fetch returns normal snapshots.
  - Stale: when fetcher fails and cache > STALE_THRESHOLD_S → status=STALE.
  - Suspended: source returns no data → status=SUSPENDED.
  - Failure degradation: source raises → returns last cached value, no crash.
  - Indices: fetched independently from per-stock spot.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from app.models.quote import DataStatus, MarketIndex, QuoteSnapshot
from app.services.quote_service import QuoteService


def _now():
    return datetime(2026, 5, 28, 14, 0, 0)


class StubSpotFetcher:
    def __init__(self, mapping: dict[str, dict] | None):
        self.mapping = mapping
        self.calls = 0

    def __call__(self, codes: list[str]) -> dict[str, dict]:
        self.calls += 1
        if self.mapping is None:
            raise RuntimeError("akshare timeout")
        return {c: self.mapping[c] for c in codes if c in self.mapping}


class StubIndexFetcher:
    def __init__(self, payload: list[dict] | None):
        self.payload = payload

    def __call__(self) -> list[dict]:
        if self.payload is None:
            raise RuntimeError("akshare index timeout")
        return self.payload


def test_get_snapshots_normal():
    spot = StubSpotFetcher({"600519": {"price": 1700.0, "change_pct": 2.5, "volume_ratio": 1.2, "volume": 10000}})
    svc = QuoteService(spot_fetcher=spot, index_fetcher=StubIndexFetcher([]), clock=_now, stale_threshold_s=120)
    result = svc.get_snapshots(["600519"])
    assert "600519" in result
    snap = result["600519"]
    assert snap.price == 1700.0
    assert snap.status == DataStatus.NORMAL


def test_get_snapshots_missing_marked_no_data():
    spot = StubSpotFetcher({})
    svc = QuoteService(spot_fetcher=spot, index_fetcher=StubIndexFetcher([]), clock=_now, stale_threshold_s=120)
    result = svc.get_snapshots(["999999"])
    assert result["999999"].status == DataStatus.NO_DATA
    assert result["999999"].price is None


def test_failure_returns_last_value():
    # First successful fetch
    spot_ok = StubSpotFetcher({"600519": {"price": 1700.0, "change_pct": 2.5, "volume_ratio": 1.2, "volume": 10000}})
    svc = QuoteService(spot_fetcher=spot_ok, index_fetcher=StubIndexFetcher([]), clock=_now, stale_threshold_s=120)
    svc.get_snapshots(["600519"])

    # Swap to failing fetcher; should degrade to cached value
    fail = StubSpotFetcher(None)
    svc._spot_fetcher = fail  # type: ignore[attr-defined]
    result = svc.get_snapshots(["600519"])
    assert result["600519"].price == 1700.0


def test_stale_after_threshold():
    spot = StubSpotFetcher({"600519": {"price": 1700.0, "change_pct": 2.5, "volume_ratio": 1.2, "volume": 10000}})
    clock_time = [_now()]

    def clock():
        return clock_time[0]

    svc = QuoteService(spot_fetcher=spot, index_fetcher=StubIndexFetcher([]), clock=clock, stale_threshold_s=120)
    svc.get_snapshots(["600519"])

    # Advance clock past stale window; swap to failing fetcher
    clock_time[0] = _now() + timedelta(seconds=200)
    svc._spot_fetcher = StubSpotFetcher(None)  # type: ignore[attr-defined]
    result = svc.get_snapshots(["600519"])
    assert result["600519"].status == DataStatus.STALE


def test_get_indices_normal():
    idx_data = [
        {"name": "上证指数", "code": "sh000001", "point": 3200.5, "change_pct": -0.8},
        {"name": "深证成指", "code": "sz399001", "point": 10100.0, "change_pct": -1.2},
        {"name": "创业板指", "code": "sz399006", "point": 2050.0, "change_pct": 0.6},
    ]
    svc = QuoteService(
        spot_fetcher=StubSpotFetcher({}),
        index_fetcher=StubIndexFetcher(idx_data),
        clock=_now,
        stale_threshold_s=120,
    )
    indices = svc.get_indices()
    assert len(indices) == 3
    assert indices[0].name == "上证指数"


def test_get_indices_failure_returns_last_value():
    idx_data = [{"name": "上证指数", "code": "sh000001", "point": 3200.5, "change_pct": -0.8}]
    svc = QuoteService(
        spot_fetcher=StubSpotFetcher({}),
        index_fetcher=StubIndexFetcher(idx_data),
        clock=_now,
        stale_threshold_s=120,
    )
    first = svc.get_indices()
    assert first[0].point == 3200.5

    svc._index_fetcher = StubIndexFetcher(None)  # type: ignore[attr-defined]
    second = svc.get_indices()
    # degrade returns cached value
    assert second[0].point == 3200.5


def test_get_indices_failure_no_cache_returns_empty():
    svc = QuoteService(
        spot_fetcher=StubSpotFetcher({}),
        index_fetcher=StubIndexFetcher(None),
        clock=_now,
        stale_threshold_s=120,
    )
    assert svc.get_indices() == []
