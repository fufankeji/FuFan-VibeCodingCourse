"""F1 T003 — kline_service tests (RED → GREEN).

Covers FR-007:
  - Happy path: fetcher returns rows → list[KlinePoint].
  - Failure: fetcher raises → returns empty list, does NOT crash.
  - Empty result is preserved as empty (not None).
"""

from __future__ import annotations

from datetime import datetime

from app.services.kline_service import KlineService


class StubKlineFetcher:
    def __init__(self, rows):
        self.rows = rows
        self.calls: list[str] = []

    def __call__(self, code: str):
        self.calls.append(code)
        if self.rows is None:
            raise RuntimeError("akshare kline down")
        return self.rows


def test_get_daily_klines_normal():
    rows = [
        {"ts": datetime(2026, 5, 27), "open": 100.0, "high": 110.0, "low": 99.0, "close": 108.0, "volume": 1000},
        {"ts": datetime(2026, 5, 28), "open": 108.0, "high": 115.0, "low": 105.0, "close": 112.0, "volume": 1500},
    ]
    svc = KlineService(fetcher=StubKlineFetcher(rows))
    out = svc.get_daily("600519")
    assert len(out) == 2
    assert out[0].close == 108.0


def test_get_daily_failure_returns_empty():
    svc = KlineService(fetcher=StubKlineFetcher(None))
    out = svc.get_daily("600519")
    assert out == []


def test_get_daily_empty_input_preserved():
    svc = KlineService(fetcher=StubKlineFetcher([]))
    assert svc.get_daily("600519") == []


def test_recent_closes_for_anomaly_consumer():
    rows = [
        {"ts": datetime(2026, 5, i + 1), "open": 100.0, "high": 110.0, "low": 99.0, "close": 100.0 + i, "volume": 1000}
        for i in range(5)
    ]
    svc = KlineService(fetcher=StubKlineFetcher(rows))
    closes = svc.recent_closes("600519", n=3)
    # Last 3 closes
    assert closes == [102.0, 103.0, 104.0]
