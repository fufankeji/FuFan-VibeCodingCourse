"""Gap closure tests for F2 contract surfaces.

Gaps:
- G2 watchlist_events subscribe idempotency + cross-test leakage
- G3 PushRequest signal-key stability across tag-set growth
- G4 F2 → F3 ExplainRequest mapping passes real pydantic validation for every
     F2 AnomalyType
- G5 F2 ↔ F5 snapshot real-shape (uses real WatchlistService + in-memory DB)
- G6 /anomaly/badges contract snapshot
"""
from __future__ import annotations

import sqlite3
import time
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.anomaly.anomaly_state import StateManager
from app.anomaly.rule_config import RuleConfigStore
from app.api.anomaly import build_anomaly_router
from app.events import watchlist_events
from app.models.anomaly import AnomalyType, AnomalySignal
from app.models.explain import ExplainRequest, ExplainResult, ResultSource
from app.services.anomaly_service import AnomalyService, QuoteSnapshot, _F2_TO_F3


# ───────── shared fixture: clean watchlist_events subscribers ─────────

@pytest.fixture(autouse=True)
def _clear_subscribers():
    """Hermetic: snapshot subscribers, restore after test."""
    snap = list(watchlist_events._subscribers)
    watchlist_events._subscribers.clear()
    try:
        yield
    finally:
        watchlist_events._subscribers.clear()
        watchlist_events._subscribers.extend(snap)


# ───────── G2 — subscribe idempotency ─────────────────────────────────

def test_g2_subscribe_idempotent():
    sm = StateManager()
    sm.subscribe_watchlist_events()
    sm.subscribe_watchlist_events()
    sm.subscribe_watchlist_events()
    # Only one handler attached
    assert len(watchlist_events._subscribers) == 1


def test_g2_unsubscribe_cleans_up():
    sm = StateManager()
    sm.subscribe_watchlist_events()
    sm.unsubscribe_watchlist_events()
    assert len(watchlist_events._subscribers) == 0
    # Unsubscribe is itself idempotent (no exception on second call)
    sm.unsubscribe_watchlist_events()


def test_g2_publish_after_unsubscribe_no_side_effect():
    sm = StateManager()
    sm.state.set("600519", {AnomalyType.LIMIT_UP})
    sm.subscribe_watchlist_events()
    sm.unsubscribe_watchlist_events()
    watchlist_events.publish_removed("600519")
    # State NOT cleared because we unsubscribed before publish
    assert AnomalyType.LIMIT_UP in sm.state.get("600519")


# ───────── G3 — push dedup_key stability across tag-set growth ────────

def _svc_one_stock(quotes_fn):
    wl = MagicMock(); wl.snapshot.return_value = [{"code": "600519", "name": "贵州茅台"}]
    push = MagicMock()
    push.send.return_value = MagicMock(status="delivered")
    ex = MagicMock()
    ex.explain.return_value = ExplainResult(text="t", source=ResultSource.TEMPLATE)
    return AnomalyService(
        watchlist_service=wl, quote_fetcher=quotes_fn, kline_fetcher=lambda c: [],
        news_source=MagicMock(fetch_telegraph=lambda: [], fetch_announcements=lambda c: []),
        explain_service=ex, push_service=push,
    ), push


def test_g3_signal_field_carries_all_tags_alphabetically_sorted():
    """When same stock has limit_up + volume, signal field should encode both
    in a deterministic order so F6 dedup can compute a stable key."""
    q = QuoteSnapshot(
        code="600519", change_pct=10.0, price=1800.0,
        volume_ratio=4.0, high=1800.0, low=1700.0, prev_close=1700.0,
        ts=time.time(), suspended=False,
    )
    svc, push = _svc_one_stock(lambda c: q)
    svc.scan_cycle()
    req = push.send.call_args.args[0]
    # Sorted ascending → "limit_up+volume" (NOT "volume+limit_up")
    parts = req.signal.split("+")
    assert parts == sorted(parts), f"signal tags not sorted: {req.signal!r}"
    assert "limit_up" in parts and "volume" in parts


def test_g3_signal_stable_when_tag_set_unchanged_across_cycles():
    """Two consecutive cycles with identical tag set MUST produce identical
    signal keys (F6 dedup depends on this)."""
    q = QuoteSnapshot(
        code="600519", change_pct=10.0, price=1800.0, volume_ratio=4.0,
        high=1800.0, low=1700.0, prev_close=1700.0, ts=time.time(),
    )
    svc, push = _svc_one_stock(lambda c: q)
    svc.scan_cycle()
    first = push.send.call_args.args[0].signal
    # Reset state to force "new again" so a 2nd push fires
    svc.sm.state.forget("600519")
    svc.scan_cycle()
    second = push.send.call_args.args[0].signal
    assert first == second


# ───────── G4 — every F2 AnomalyType maps to a valid F3 ExplainRequest ─

@pytest.mark.parametrize("f2_type", list(AnomalyType))
def test_g4_every_anomaly_type_has_explain_mapping(f2_type):
    """All seven F2 anomaly types must appear in _F2_TO_F3 and the resulting
    ExplainRequest must pass real pydantic validation."""
    assert f2_type in _F2_TO_F3, f"missing F2→F3 mapping for {f2_type}"
    req = ExplainRequest(
        code="600519",
        name="贵州茅台",
        anomaly_type=_F2_TO_F3[f2_type],
        price=100.0,
        change_pct=5.0,
        volume_ratio=2.0,
    )
    # Pydantic v2 round-trip: build from dict to ensure JSON-compatibility too
    again = ExplainRequest(**req.model_dump())
    assert again.anomaly_type == req.anomaly_type


# ───────── G5 — F2 ↔ F5 snapshot real shape via real WatchlistService ──

def test_g5_real_snapshot_fields_consumed_correctly(tmp_path: Path):
    """Use the real WatchlistService against an in-memory SQLite — verify F2
    correctly reads code/name/is_holding from the dict[str, Any] snapshot
    contract (extra fields like joined_at/display_order are ignored)."""
    from app.db import init_db
    from app.models.watchlist import WatchlistItem
    from app.repositories.watchlist_repo import WatchlistRepo
    from app.services.watchlist_service import WatchlistService

    db_path = tmp_path / "f2_g5.db"
    init_db(db_path)
    repo = WatchlistRepo(db_path)
    wl_svc = WatchlistService(repo=repo, max_total=30, max_holding=5)
    repo.save(WatchlistItem(code="600519", name="贵州茅台", is_holding=True, display_order=0))

    snap = wl_svc.snapshot()
    # Verify F2 contract: must contain code/name/is_holding
    assert snap[0]["code"] == "600519"
    assert snap[0]["name"] == "贵州茅台"
    assert snap[0]["is_holding"] is True
    # Extra fields exist but F2 ignores them
    assert "joined_at" in snap[0]

    # Feed snapshot to F2 — must not raise on extra fields, must report holding
    q = QuoteSnapshot(
        code="600519", change_pct=10.0, price=1800.0, volume_ratio=1.0,
        high=1800, low=1700, prev_close=1700, ts=time.time(),
    )
    push = MagicMock(); push.send.return_value = MagicMock()
    ex = MagicMock(); ex.explain.return_value = ExplainResult(text="t", source=ResultSource.TEMPLATE)
    wl_proxy = MagicMock(); wl_proxy.snapshot.return_value = snap
    svc = AnomalyService(
        watchlist_service=wl_proxy,
        quote_fetcher=lambda c: q if c == "600519" else None,
        kline_fetcher=lambda c: [],
        news_source=MagicMock(fetch_telegraph=lambda: [], fetch_announcements=lambda c: []),
        explain_service=ex, push_service=push,
    )
    new = svc.scan_cycle()
    assert len(new) == 1
    assert new[0].is_holding is True
    sent = push.send.call_args.args[0]
    assert sent.priority.value == "holding"


# ───────── G6 — /anomaly/badges response contract snapshot ────────────

def test_g6_badges_endpoint_returns_dict_of_sorted_str_lists():
    sm = StateManager()
    sm.evaluate("000001", [AnomalySignal(code="000001", anomaly_type=AnomalyType.VOLUME, name="x")])
    sm.evaluate("600519", [
        AnomalySignal(code="600519", anomaly_type=AnomalyType.LIMIT_UP, name="x"),
        AnomalySignal(code="600519", anomaly_type=AnomalyType.BREAKOUT, name="x"),
    ])
    app = FastAPI()
    app.include_router(build_anomaly_router(state_manager=sm, rule_store=RuleConfigStore()))
    client = TestClient(app)
    resp = client.get("/anomaly/badges")
    assert resp.status_code == 200
    body = resp.json()

    # Stable contract for F1 consumer:
    assert isinstance(body, dict)
    for code, badges in body.items():
        assert isinstance(code, str)
        assert isinstance(badges, list)
        assert all(isinstance(b, str) for b in badges)
        # alphabetical order (so F1 can rely on it for rendering)
        assert badges == sorted(badges)

    # Empty-state contract: when state has no entries, return {} (not null)
    sm_empty = StateManager()
    app2 = FastAPI()
    app2.include_router(build_anomaly_router(state_manager=sm_empty, rule_store=RuleConfigStore()))
    assert TestClient(app2).get("/anomaly/badges").json() == {}
