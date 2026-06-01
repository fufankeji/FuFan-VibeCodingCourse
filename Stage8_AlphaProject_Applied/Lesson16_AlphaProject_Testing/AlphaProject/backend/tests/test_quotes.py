"""F1 T016 — quotes integration covering SC-001/003.

Cross-cuts trading_calendar + quote_service + /quotes/snapshot API:
  - SC-001 happy path: full snapshot in one round-trip < ~quick.
  - SC-003 source failure does not crash; rows still returned.
  - Stale propagation through API.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.quotes import build_quotes_router
from app.api.watchlist import build_app
from app.db import init_db
from app.services.kline_service import KlineService
from app.services.quote_service import QuoteService
from app.services.trading_calendar import TradingCalendar


def _make_client(tmp_path: Path, *, spot, indices, clock_value, calendar_days):
    init_db(tmp_path / "x.db")
    base = build_app(tmp_path / "x.db", fetcher=lambda: [], refresh_on_boot=False)
    base.state.svc.add(code="600519", name="贵州茅台", is_holding=True)

    clock = [clock_value]

    def now():
        return clock[0]

    qsvc = QuoteService(
        spot_fetcher=spot,
        index_fetcher=indices,
        clock=now,
        stale_threshold_s=120,
    )
    cal = TradingCalendar(fetcher=lambda: calendar_days)
    router = build_quotes_router(
        watchlist_service=base.state.svc,
        quote_service=qsvc,
        kline_service=KlineService(fetcher=lambda _c: []),
        calendar=cal,
        clock=now,
    )
    base.include_router(router)
    return TestClient(base), clock, qsvc


def test_snapshot_happy_path(tmp_path):
    spot = lambda codes: {"600519": {"price": 1700.0, "change_pct": 2.5, "volume_ratio": 1.2, "volume": 100}}
    indices = lambda: []
    client, _, _ = _make_client(
        tmp_path,
        spot=spot,
        indices=indices,
        clock_value=datetime(2026, 5, 28, 10, 0, 0),
        calendar_days=[datetime(2026, 5, 28).date()],
    )
    body = client.get("/quotes/snapshot").json()
    assert body["session_label"] == "交易中"
    assert body["rows"][0]["price"] == 1700.0


def test_snapshot_source_failure_returns_no_data(tmp_path):
    def fail(_codes):
        raise RuntimeError("akshare down")
    client, _, _ = _make_client(
        tmp_path,
        spot=fail,
        indices=lambda: [],
        clock_value=datetime(2026, 5, 28, 10, 0, 0),
        calendar_days=[datetime(2026, 5, 28).date()],
    )
    body = client.get("/quotes/snapshot").json()
    # SC-003: API never crashes; row present with no_data status (no prior cache)
    assert body["rows"][0]["status"] == "no_data"


def test_snapshot_stale_propagation(tmp_path):
    spot_payload = {"600519": {"price": 1700.0, "change_pct": 2.5, "volume_ratio": 1.2, "volume": 100}}
    state = {"return": True}

    def spot(codes):
        if not state["return"]:
            raise RuntimeError("down")
        return {c: spot_payload[c] for c in codes if c in spot_payload}

    client, clock, _ = _make_client(
        tmp_path,
        spot=spot,
        indices=lambda: [],
        clock_value=datetime(2026, 5, 28, 10, 0, 0),
        calendar_days=[datetime(2026, 5, 28).date()],
    )
    # First call populates cache
    client.get("/quotes/snapshot")
    # Move clock past stale threshold (120s) AND make source fail
    clock[0] = datetime(2026, 5, 28, 10, 5, 0)
    state["return"] = False
    body = client.get("/quotes/snapshot").json()
    assert body["rows"][0]["status"] == "stale"
    assert body["rows"][0]["price"] == 1700.0  # last cached value preserved


def test_calendar_label_non_trading_day(tmp_path):
    client, _, _ = _make_client(
        tmp_path,
        spot=lambda codes: {},
        indices=lambda: [],
        clock_value=datetime(2026, 5, 30, 10, 0, 0),  # Saturday
        calendar_days=[datetime(2026, 5, 28).date()],
    )
    body = client.get("/quotes/snapshot").json()
    assert body["session_label"] == "非交易"
