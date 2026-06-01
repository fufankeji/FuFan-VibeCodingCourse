"""Gap closure (backend-testing): concurrency on push pipeline.

test-routing-advisor judged F6 = single-backend → backend-testing.
Gaps identified vs blueprint:
  - 并发/原子性: send() may be called from F2 (anomaly scanner) and F4 (briefing
    scheduler) near-simultaneously. Verify dedup + rate_limiter + SQLite logging
    behave under concurrent threads.

Strategy: thread pool issuing send() concurrently against shared service; assert
  - no SQLite "database is locked" leaking out
  - dedup still blocks duplicates (at most 1 delivered per code+signal pair within window)
  - all attempts produce a push_log row (no silent loss)
"""

import sqlite3
import threading
from unittest.mock import MagicMock

from app.db import init_db
from app.models.push import MsgType, Priority, PushRequest
from app.push.lark_client import SendResult
from app.services.push_service import PushService


def _make_svc(tmp_path):
    db = tmp_path / "p.db"
    init_db(db)
    lark = MagicMock()
    lark.send.return_value = SendResult(ok=True)
    svc = PushService(
        lark_client=lark, db_path=db,
        receive_id="oc_t", receive_id_type="chat_id",
        rate_limit_per_min=70, dedup_ttl=300, undelivered_max=200, muted=False,
    )
    return svc, lark, db


def _req(code="600519", signal="limit_up"):
    return PushRequest(
        msg_type=MsgType.text, content={"text": "x"},
        priority=Priority.watch, code=code, signal=signal,
    )


def test_concurrent_duplicate_sends_dedup_holds(tmp_path):
    """50 threads send the same code+signal: ≤1 delivered, rest deduped."""
    svc, lark, db = _make_svc(tmp_path)
    errors: list[Exception] = []

    def worker():
        try:
            svc.send(_req())
        except Exception as e:  # noqa: BLE001
            errors.append(e)

    threads = [threading.Thread(target=worker) for _ in range(50)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not errors, f"Concurrent send raised: {errors}"
    # at most 1 SDK call due to dedup
    assert lark.send.call_count <= 1
    # all 50 attempts logged (delivered or deduped, no silent drop)
    with sqlite3.connect(db) as c:
        n_logs = c.execute("SELECT COUNT(*) FROM push_log").fetchone()[0]
    assert n_logs == 50


def test_concurrent_distinct_sends_no_db_lock_error(tmp_path):
    """50 threads with distinct (code, signal) → all delivered, all logged."""
    svc, lark, db = _make_svc(tmp_path)
    errors: list[Exception] = []

    def worker(i: int):
        try:
            svc.send(_req(code=f"S{i:03d}", signal=f"sig_{i}"))
        except Exception as e:  # noqa: BLE001
            errors.append(e)

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(50)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not errors, f"Concurrent send raised: {errors}"
    with sqlite3.connect(db) as c:
        n = c.execute("SELECT COUNT(*) FROM push_log WHERE status='delivered'").fetchone()[0]
    assert n == 50
