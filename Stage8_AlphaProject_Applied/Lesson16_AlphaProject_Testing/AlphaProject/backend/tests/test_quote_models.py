"""F1 T004 — quote-related model tests (RED → GREEN)."""

from __future__ import annotations

from datetime import datetime

import pytest

from app.models.quote import (
    DataStatus,
    KlinePoint,
    MarketIndex,
    QuoteSnapshot,
)


def test_data_status_enum_values():
    assert DataStatus.NORMAL.value == "normal"
    assert DataStatus.SUSPENDED.value == "suspended"
    assert DataStatus.NO_DATA.value == "no_data"
    assert DataStatus.STALE.value == "stale"


def test_quote_snapshot_default_status_normal():
    q = QuoteSnapshot(
        code="600519",
        price=1700.0,
        change_pct=2.5,
        volume_ratio=1.2,
        volume=10000,
        updated_at=datetime(2026, 5, 28, 14, 0, 0),
    )
    assert q.status == DataStatus.NORMAL
    assert q.code == "600519"


def test_quote_snapshot_suspended_no_price_ok():
    q = QuoteSnapshot(
        code="000000",
        price=None,
        change_pct=None,
        volume_ratio=None,
        volume=None,
        updated_at=datetime(2026, 5, 28, 14, 0, 0),
        status=DataStatus.SUSPENDED,
    )
    assert q.price is None
    assert q.status == DataStatus.SUSPENDED


def test_market_index_basic():
    idx = MarketIndex(
        name="上证指数",
        code="sh000001",
        point=3200.5,
        change_pct=-0.8,
        updated_at=datetime(2026, 5, 28, 14, 0, 0),
    )
    assert idx.name == "上证指数"
    assert idx.point == 3200.5


def test_kline_point():
    p = KlinePoint(
        ts=datetime(2026, 5, 28, 0, 0, 0),
        open=100.0,
        high=110.0,
        low=99.0,
        close=108.0,
        volume=5_000_000,
    )
    assert p.high == 110.0


def test_quote_snapshot_json_round_trip():
    q = QuoteSnapshot(
        code="600519",
        price=1700.0,
        change_pct=2.5,
        volume_ratio=1.2,
        volume=10000,
        updated_at=datetime(2026, 5, 28, 14, 0, 0),
    )
    data = q.model_dump(mode="json")
    assert data["status"] == "normal"
    rebuilt = QuoteSnapshot.model_validate(data)
    assert rebuilt.code == "600519"


def test_quote_snapshot_rejects_unknown_status():
    with pytest.raises(Exception):
        QuoteSnapshot(
            code="X",
            price=1.0,
            change_pct=0.0,
            volume_ratio=None,
            volume=None,
            updated_at=datetime.now(),
            status="bogus",  # type: ignore[arg-type]
        )
