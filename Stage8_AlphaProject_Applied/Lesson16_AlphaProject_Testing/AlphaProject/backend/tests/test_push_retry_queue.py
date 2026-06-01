"""T008-T010 — retry queue: retry schedule, replay, overflow."""

import json
import sqlite3

from app.db import init_db
from app.models.push import PushRequest, MsgType, Priority
from app.push.retry_queue import RetryQueue


def _req(code="600519", priority=Priority.watch):
    return PushRequest(
        msg_type=MsgType.text, content={"text": "x"},
        priority=priority, code=code, signal="limit_up",
    )


# ---- T008: retry schedule ----------------------------------------------------

def test_retry_schedule_is_30s_then_90s():
    """3 attempts total: t=0, t+30s, t+90s."""
    q = RetryQueue(db_path=None, undelivered_max=200)
    delays = q.retry_delays()
    assert delays == [30, 90]


def test_after_two_retries_exhausted(tmp_path):
    db = tmp_path / "p.db"
    init_db(db)
    q = RetryQueue(db_path=db, undelivered_max=200)
    req = _req()
    uuid = "u-test"
    # first attempt failed
    state = q.record_attempt(req, uuid=uuid, success=False)
    assert state.scheduled_next_in == 30
    state = q.record_attempt(req, uuid=uuid, success=False)
    assert state.scheduled_next_in == 90
    state = q.record_attempt(req, uuid=uuid, success=False)
    assert state.exhausted is True
    # row in undelivered table
    with sqlite3.connect(db) as c:
        row = c.execute("SELECT uuid, fail_count, is_holding FROM undelivered").fetchone()
    assert row == ("u-test", 3, 0)


def test_uuid_unchanged_across_attempts(tmp_path):
    """FR-016 retries must reuse uuid."""
    db = tmp_path / "p.db"
    init_db(db)
    q = RetryQueue(db_path=db, undelivered_max=200)
    req = _req()
    s1 = q.record_attempt(req, uuid="u-x", success=False)
    s2 = q.record_attempt(req, uuid="u-x", success=False)
    s3 = q.record_attempt(req, uuid="u-x", success=False)
    assert s1.uuid == s2.uuid == s3.uuid == "u-x"


# ---- T009: replay ------------------------------------------------------------

def test_replay_pops_oldest_first(tmp_path):
    db = tmp_path / "p.db"
    init_db(db)
    q = RetryQueue(db_path=db, undelivered_max=200)
    # seed two undelivered rows
    with sqlite3.connect(db) as c:
        c.execute(
            "INSERT INTO undelivered(uuid, request_json, fail_count, queued_at, is_holding)"
            " VALUES (?,?,?,?,?)",
            ("u-1", json.dumps(_req("A").model_dump()), 3, "2026-05-28T10:00:00", 0),
        )
        c.execute(
            "INSERT INTO undelivered(uuid, request_json, fail_count, queued_at, is_holding)"
            " VALUES (?,?,?,?,?)",
            ("u-2", json.dumps(_req("B").model_dump()), 3, "2026-05-28T10:05:00", 0),
        )
        c.commit()
    items = q.replay()
    assert len(items) == 2
    assert items[0].uuid == "u-1"
    assert items[1].uuid == "u-2"


def test_replay_summarizes_when_over_threshold(tmp_path):
    db = tmp_path / "p.db"
    init_db(db)
    q = RetryQueue(db_path=db, undelivered_max=200, replay_summary_threshold=5)
    with sqlite3.connect(db) as c:
        for i in range(8):
            c.execute(
                "INSERT INTO undelivered(uuid, request_json, fail_count, queued_at, is_holding)"
                " VALUES (?,?,?,?,?)",
                (f"u-{i}", json.dumps(_req(f"S{i}").model_dump()), 3,
                 f"2026-05-28T10:0{i}:00", 0),
            )
        c.commit()
    items = q.replay()
    # over threshold → returns a single summary marker plus original items removed
    assert q.last_replay_summarized is True


def test_remove_after_successful_replay(tmp_path):
    db = tmp_path / "p.db"
    init_db(db)
    q = RetryQueue(db_path=db, undelivered_max=200)
    with sqlite3.connect(db) as c:
        c.execute(
            "INSERT INTO undelivered(uuid, request_json, fail_count, queued_at, is_holding)"
            " VALUES (?,?,?,?,?)",
            ("u-1", json.dumps(_req("A").model_dump()), 3, "2026-05-28T10:00:00", 0),
        )
        c.commit()
    q.remove("u-1")
    with sqlite3.connect(db) as c:
        n = c.execute("SELECT COUNT(*) FROM undelivered").fetchone()[0]
    assert n == 0


# ---- T010: overflow strategy -------------------------------------------------

def test_overflow_drops_oldest_non_holding(tmp_path):
    """Edge Cases: queue full → drop oldest non-holding, holding preserved."""
    db = tmp_path / "p.db"
    init_db(db)
    q = RetryQueue(db_path=db, undelivered_max=3)
    # Seed 3 oldest non-holding messages
    with sqlite3.connect(db) as c:
        c.execute(
            "INSERT INTO undelivered(uuid, request_json, fail_count, queued_at, is_holding)"
            " VALUES (?,?,?,?,?)",
            ("watch-old1", json.dumps(_req("A").model_dump()), 3, "2026-05-28T10:00:00", 0),
        )
        c.execute(
            "INSERT INTO undelivered(uuid, request_json, fail_count, queued_at, is_holding)"
            " VALUES (?,?,?,?,?)",
            ("watch-old2", json.dumps(_req("B").model_dump()), 3, "2026-05-28T10:01:00", 0),
        )
        c.execute(
            "INSERT INTO undelivered(uuid, request_json, fail_count, queued_at, is_holding)"
            " VALUES (?,?,?,?,?)",
            ("hold-1", json.dumps(_req("C", Priority.holding).model_dump()),
             3, "2026-05-28T10:02:00", 1),
        )
        c.commit()
    # Now enqueue a new non-holding — should evict oldest non-holding ("watch-old1")
    req = _req("NEW")
    q._enqueue_undelivered(req, uuid="u-new", is_holding=False, queued_at="2026-05-28T10:03:00")
    with sqlite3.connect(db) as c:
        rows = {r[0] for r in c.execute("SELECT uuid FROM undelivered").fetchall()}
    assert "watch-old1" not in rows
    assert "hold-1" in rows  # holding preserved
    assert "u-new" in rows


def test_overflow_holding_always_preserved(tmp_path):
    """If only holding messages exist and we add another holding, oldest holding is dropped
    (still bounded), but a non-holding new message at capacity does NOT evict holding."""
    db = tmp_path / "p.db"
    init_db(db)
    q = RetryQueue(db_path=db, undelivered_max=2)
    with sqlite3.connect(db) as c:
        c.execute(
            "INSERT INTO undelivered(uuid, request_json, fail_count, queued_at, is_holding)"
            " VALUES (?,?,?,?,?)",
            ("h-1", json.dumps(_req("A", Priority.holding).model_dump()),
             3, "2026-05-28T10:00:00", 1),
        )
        c.execute(
            "INSERT INTO undelivered(uuid, request_json, fail_count, queued_at, is_holding)"
            " VALUES (?,?,?,?,?)",
            ("h-2", json.dumps(_req("B", Priority.holding).model_dump()),
             3, "2026-05-28T10:01:00", 1),
        )
        c.commit()
    # Try to add a non-holding message — must be dropped (cannot evict holding)
    req = _req("NEW")
    q._enqueue_undelivered(req, uuid="rejected", is_holding=False, queued_at="2026-05-28T10:02:00")
    with sqlite3.connect(db) as c:
        rows = {r[0] for r in c.execute("SELECT uuid FROM undelivered").fetchall()}
    assert rows == {"h-1", "h-2"}  # new non-holding dropped, holdings kept
