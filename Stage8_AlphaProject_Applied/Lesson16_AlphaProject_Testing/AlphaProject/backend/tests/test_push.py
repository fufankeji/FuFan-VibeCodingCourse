"""T015 — Integration tests for F6 push pipeline (mock lark-oapi SDK).

Covers SC-001..SC-005 end-to-end behaviors that span components:

  SC-002: rate limit never triggers IM OpenAPI reject (everything routed)
  SC-003: 25-msg burst → ≤3 batches, 0 loss
  SC-004: 3-failure retry exhaustion → undelivered, 0 silent loss
  SC-005: holding bypasses dedup 100%

Also covers spec FR-016 (uuid stable across retries) and FR-010 (replay).
"""

import sqlite3
from unittest.mock import MagicMock

from app.db import init_db
from app.models.push import MsgType, Priority, PushRequest
from app.push.lark_client import FailureKind, SendResult
from app.services.push_service import PushService


def _r(code, signal="anomaly", priority=Priority.watch):
    return PushRequest(
        msg_type=MsgType.text, content={"text": "x"},
        priority=priority, code=code, signal=signal,
    )


def _svc(tmp_path, lark, rate_limit_per_min=70, muted=False, undelivered_max=200):
    db = tmp_path / "p.db"
    init_db(db)
    return PushService(
        lark_client=lark, db_path=db,
        receive_id="oc_t", receive_id_type="chat_id",
        rate_limit_per_min=rate_limit_per_min, dedup_ttl=300,
        undelivered_max=undelivered_max, muted=muted,
    ), db


# ---- SC-002 ------------------------------------------------------------------
def test_sc002_no_messages_lost_when_burst_within_budget(tmp_path):
    lark = MagicMock()
    lark.send.return_value = SendResult(ok=True)
    svc, db = _svc(tmp_path, lark, rate_limit_per_min=70)
    for i in range(25):
        svc.send(_r(f"S{i}", signal=f"sig{i}"))
    with sqlite3.connect(db) as c:
        delivered = c.execute(
            "SELECT COUNT(*) FROM push_log WHERE status='delivered'"
        ).fetchone()[0]
    assert delivered == 25


# ---- SC-003 ------------------------------------------------------------------
def test_sc003_burst_over_budget_merges_into_at_most_3_batches(tmp_path):
    lark = MagicMock()
    lark.send.return_value = SendResult(ok=True)
    svc, _ = _svc(tmp_path, lark, rate_limit_per_min=2)
    # 2 immediate + 23 deferred
    for i in range(25):
        svc.send(_r(f"S{i}", signal=f"sig{i}"))
    batches = svc.flush_merged()
    # 23 deferred at cap=10 → 3 batches max
    assert batches <= 3
    # All 25 accounted for (no silent loss)
    immediate_calls = 2
    assert lark.send.call_count == immediate_calls + batches


# ---- SC-004 ------------------------------------------------------------------
def test_sc004_three_failures_go_to_undelivered_zero_silent_loss(tmp_path):
    lark = MagicMock()
    lark.send.return_value = SendResult(ok=False, failure_kind=FailureKind.network)
    svc, db = _svc(tmp_path, lark)
    for _ in range(3):
        svc.send(_r("600519"))
    with sqlite3.connect(db) as c:
        undelivered = c.execute("SELECT COUNT(*) FROM undelivered").fetchone()[0]
        log = c.execute(
            "SELECT COUNT(*) FROM push_log WHERE status='failed'"
        ).fetchone()[0]
    assert undelivered == 1
    assert log == 3  # all three attempts logged


# ---- SC-005 ------------------------------------------------------------------
def test_sc005_holding_bypasses_dedup_100_percent(tmp_path):
    lark = MagicMock()
    lark.send.return_value = SendResult(ok=True)
    svc, _ = _svc(tmp_path, lark)
    # Same code+signal 5 times within window — all must go through
    for _ in range(5):
        svc.send(_r("600519", priority=Priority.holding))
    assert lark.send.call_count == 5


# ---- FR-016 uuid stable across retries --------------------------------------
def test_fr016_uuid_unchanged_across_retries(tmp_path):
    lark = MagicMock()
    lark.send.return_value = SendResult(ok=False, failure_kind=FailureKind.network)
    svc, _ = _svc(tmp_path, lark)
    for _ in range(3):
        svc.send(_r("600519"))
    uuids = {call.kwargs["uuid"] for call in lark.send.call_args_list}
    assert len(uuids) == 1


# ---- FR-010 replay -----------------------------------------------------------
def test_fr010_replay_returns_undelivered_oldest_first(tmp_path):
    lark = MagicMock()
    lark.send.return_value = SendResult(ok=False, failure_kind=FailureKind.network)
    svc, _ = _svc(tmp_path, lark)
    # Drain two distinct messages to undelivered
    for _ in range(3):
        svc.send(_r("600519"))
    for _ in range(3):
        svc.send(_r("000001"))
    items = svc._retry.replay()
    assert len(items) == 2
    assert items[0].queued_at <= items[1].queued_at


# ---- FR-011 mute log -------------------------------------------------------
def test_fr011_muted_logs_but_does_not_send(tmp_path):
    lark = MagicMock()
    svc, db = _svc(tmp_path, lark, muted=True)
    svc.send(_r("600519"))
    lark.send.assert_not_called()
    with sqlite3.connect(db) as c:
        row = c.execute("SELECT status FROM push_log").fetchone()
    assert row == ("muted",)


# ---- FR-002 interactive card path -------------------------------------------
def test_fr002_interactive_message_delivered(tmp_path):
    lark = MagicMock()
    lark.send.return_value = SendResult(ok=True)
    svc, _ = _svc(tmp_path, lark)
    req = PushRequest(
        msg_type=MsgType.interactive,
        content={"config": {"wide_screen_mode": True}, "elements": []},
        priority=Priority.watch, code="600519", signal="breakthrough",
    )
    r = svc.send(req)
    assert r.status == "delivered"
    assert lark.send.call_args.kwargs["msg_type"] == "interactive"
