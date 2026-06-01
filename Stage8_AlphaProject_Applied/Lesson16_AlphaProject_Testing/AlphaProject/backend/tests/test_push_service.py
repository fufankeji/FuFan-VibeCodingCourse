"""T011-T013 — push_service orchestrator + mute + connection-failure handling."""

import sqlite3
from unittest.mock import MagicMock

from app.db import init_db
from app.models.push import MsgType, Priority, PushRequest
from app.push.lark_client import FailureKind, SendResult
from app.services.push_service import PushService


def _req(code="600519", signal="limit_up", priority=Priority.watch, text="测试"):
    return PushRequest(
        msg_type=MsgType.text, content={"text": text},
        priority=priority, code=code, signal=signal,
    )


def _make_service(tmp_path, lark_ok=True, lark_failure=None, muted=False):
    db = tmp_path / "p.db"
    init_db(db)
    lark = MagicMock()
    if lark_ok:
        lark.send.return_value = SendResult(ok=True)
    else:
        lark.send.return_value = SendResult(ok=False, failure_kind=lark_failure)
    svc = PushService(
        lark_client=lark,
        db_path=db,
        receive_id="oc_default",
        receive_id_type="chat_id",
        rate_limit_per_min=70,
        dedup_ttl=300,
        undelivered_max=200,
        muted=muted,
    )
    return svc, lark, db


def test_happy_path_delivers_and_logs(tmp_path):
    svc, lark, db = _make_service(tmp_path)
    result = svc.send(_req())
    assert result.status == "delivered"
    lark.send.assert_called_once()
    with sqlite3.connect(db) as c:
        rows = c.execute("SELECT status FROM push_log").fetchall()
    assert any(r[0] == "delivered" for r in rows)


def test_dedup_blocks_second_call_same_signal(tmp_path):
    svc, lark, _ = _make_service(tmp_path)
    svc.send(_req())
    r2 = svc.send(_req())
    assert r2.status == "deduped"
    assert lark.send.call_count == 1


def test_holding_bypasses_dedup(tmp_path):
    """FR-007: SC-005."""
    svc, lark, _ = _make_service(tmp_path)
    svc.send(_req(priority=Priority.holding))
    r2 = svc.send(_req(priority=Priority.holding))
    assert r2.status == "delivered"
    assert lark.send.call_count == 2


def test_mute_skips_send_but_logs(tmp_path):
    """T012 FR-011."""
    svc, lark, db = _make_service(tmp_path, muted=True)
    r = svc.send(_req())
    assert r.status == "muted"
    lark.send.assert_not_called()
    with sqlite3.connect(db) as c:
        assert c.execute("SELECT status FROM push_log WHERE status='muted'").fetchone() is not None


def test_failure_increments_retry_count_and_does_not_immediately_undeliver(tmp_path):
    svc, lark, db = _make_service(
        tmp_path, lark_ok=False, lark_failure=FailureKind.network,
    )
    r = svc.send(_req())
    # First failure → scheduled retry, not yet in undelivered
    assert r.status == "failed"
    with sqlite3.connect(db) as c:
        n = c.execute("SELECT COUNT(*) FROM undelivered").fetchone()[0]
    assert n == 0


def test_three_failures_lands_in_undelivered(tmp_path):
    svc, lark, db = _make_service(
        tmp_path, lark_ok=False, lark_failure=FailureKind.network,
    )
    for _ in range(3):
        svc.send(_req())
    with sqlite3.connect(db) as c:
        n = c.execute("SELECT COUNT(*) FROM undelivered").fetchone()[0]
    assert n == 1


def test_invalid_credential_pauses_pushing(tmp_path):
    """T013 FR-012."""
    svc, lark, db = _make_service(
        tmp_path, lark_ok=False, lark_failure=FailureKind.invalid_credential,
    )
    # spec: after N consecutive auth failures (default N=3), pause
    for _ in range(3):
        svc.send(_req())
    assert svc.connection_ok is False
    # next send is blocked
    lark.send.reset_mock()
    r = svc.send(_req(signal="other_signal"))
    assert r.status == "paused"
    lark.send.assert_not_called()


def test_status_snapshot_for_dashboard(tmp_path):
    """T013 + T014 contract."""
    svc, _, _ = _make_service(tmp_path)
    snap = svc.status()
    assert "undelivered_count" in snap
    assert "webhook_ok" in snap
    assert "muted" in snap


def test_rate_limit_routes_to_merge_queue(tmp_path):
    """SC-003: 25 inputs → ≤3 batch cards when budget exhausted."""
    db = tmp_path / "p.db"
    init_db(db)
    lark = MagicMock()
    lark.send.return_value = SendResult(ok=True)
    svc = PushService(
        lark_client=lark, db_path=db,
        receive_id="oc_default", receive_id_type="chat_id",
        rate_limit_per_min=2, dedup_ttl=300, undelivered_max=200, muted=False,
    )
    for i in range(25):
        svc.send(_req(code=f"S{i}", signal=f"sig_{i}"))
    # Drain merge queue manually
    batches_sent = svc.flush_merged()
    # 23 deferred → ≤3 batches of 10
    assert batches_sent <= 3
