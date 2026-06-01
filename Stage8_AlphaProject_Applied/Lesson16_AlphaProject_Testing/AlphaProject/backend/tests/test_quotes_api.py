"""F1 T005 — /quotes REST API tests (RED → GREEN).

Endpoints:
  GET /quotes/snapshot      — merges F5 watchlist + per-code quote
  GET /quotes/indices       — three market indices
  GET /quotes/kline/{code}  — daily kline
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.quotes import build_quotes_router
from app.api.watchlist import build_app
from app.db import init_db
from app.models.quote import DataStatus, KlinePoint, MarketIndex, QuoteSnapshot
from app.services.kline_service import KlineService
from app.services.quote_service import QuoteService
from app.services.trading_calendar import TradingCalendar


def _stub_spot(payload):
    def f(codes):
        return {c: payload[c] for c in codes if c in payload}
    return f


def _stub_index(rows):
    def f():
        return rows
    return f


def _stub_kline(rows):
    def f(_code):
        return rows
    return f


@pytest.fixture()
def app(tmp_path: Path):
    db_path = tmp_path / "alpha.db"
    init_db(db_path)
    base = build_app(db_path, fetcher=lambda: [], refresh_on_boot=False)
    # F5 watchlist svc is at app.state.svc
    svc: object = base.state.svc
    # Pre-load watchlist
    svc.add(code="600519", name="贵州茅台", is_holding=True)
    svc.add(code="000001", name="平安银行", is_holding=False)

    quote_svc = QuoteService(
        spot_fetcher=_stub_spot({
            "600519": {"price": 1700.0, "change_pct": 2.5, "volume_ratio": 1.2, "volume": 10000},
            "000001": {"price": 12.0, "change_pct": -1.5, "volume_ratio": 0.8, "volume": 50000},
        }),
        index_fetcher=_stub_index([
            {"name": "上证指数", "code": "sh000001", "point": 3200.5, "change_pct": -0.8},
        ]),
    )
    kline_svc = KlineService(fetcher=_stub_kline([
        {"ts": datetime(2026, 5, 27), "open": 100.0, "high": 110.0, "low": 99.0, "close": 108.0, "volume": 1000},
    ]))
    cal = TradingCalendar(fetcher=lambda: [datetime(2026, 5, 28).date()])

    router = build_quotes_router(
        watchlist_service=svc,
        quote_service=quote_svc,
        kline_service=kline_svc,
        calendar=cal,
        clock=lambda: datetime(2026, 5, 28, 10, 0, 0),
    )
    base.include_router(router)
    return base


def test_get_snapshot_merges_watchlist_and_quotes(app):
    client = TestClient(app)
    resp = client.get("/quotes/snapshot")
    assert resp.status_code == 200
    body = resp.json()
    assert "rows" in body
    assert "session_label" in body
    codes = [r["code"] for r in body["rows"]]
    assert "600519" in codes and "000001" in codes
    holding_row = next(r for r in body["rows"] if r["code"] == "600519")
    assert holding_row["is_holding"] is True
    assert holding_row["price"] == 1700.0


def test_get_snapshot_session_label_trading_in_session(app):
    client = TestClient(app)
    body = client.get("/quotes/snapshot").json()
    assert body["session_label"] == "交易中"


def test_get_indices(app):
    client = TestClient(app)
    resp = client.get("/quotes/indices")
    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) == 1
    assert rows[0]["name"] == "上证指数"


def test_get_kline(app):
    client = TestClient(app)
    resp = client.get("/quotes/kline/600519")
    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) == 1
    assert rows[0]["close"] == 108.0


def test_get_snapshot_empty_watchlist(tmp_path):
    init_db(tmp_path / "x.db")
    base = build_app(tmp_path / "x.db", fetcher=lambda: [], refresh_on_boot=False)
    router = build_quotes_router(
        watchlist_service=base.state.svc,
        quote_service=QuoteService(spot_fetcher=_stub_spot({}), index_fetcher=_stub_index([])),
        kline_service=KlineService(fetcher=_stub_kline([])),
        calendar=TradingCalendar(fetcher=lambda: []),
    )
    base.include_router(router)
    client = TestClient(base)
    body = client.get("/quotes/snapshot").json()
    assert body["rows"] == []
