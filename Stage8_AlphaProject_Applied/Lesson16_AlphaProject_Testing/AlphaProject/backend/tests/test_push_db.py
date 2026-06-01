"""T002 — push_log + undelivered tables via init_db extension.

FR-009 (undelivered), FR-013 (push log >=90 days). Zero crossover with watchlist tables.
"""

import sqlite3

from app.db import init_db


def _columns(conn, table):
    return {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def test_push_log_table_created(tmp_path):
    db = tmp_path / "x.db"
    init_db(db)
    with sqlite3.connect(db) as c:
        cols = _columns(c, "push_log")
    # required columns per §5 PushLog
    assert {"id", "ts", "status", "retries", "target", "code", "signal", "uuid"} <= cols


def test_undelivered_table_created(tmp_path):
    db = tmp_path / "x.db"
    init_db(db)
    with sqlite3.connect(db) as c:
        cols = _columns(c, "undelivered")
    assert {"id", "request_json", "fail_count", "queued_at", "is_holding", "uuid"} <= cols


def test_can_insert_and_read_push_log(tmp_path):
    db = tmp_path / "x.db"
    init_db(db)
    with sqlite3.connect(db) as c:
        c.execute(
            "INSERT INTO push_log(ts, status, retries, target, code, signal, uuid) "
            "VALUES (?,?,?,?,?,?,?)",
            ("2026-05-28T10:00:00", "delivered", 0, "oc_x", "600519", "limit_up", "u-1"),
        )
        c.commit()
        row = c.execute("SELECT status, code FROM push_log").fetchone()
    assert row == ("delivered", "600519")


def test_watchlist_tables_unchanged(tmp_path):
    """Zero crossover with F5 tables (plan R-4)."""
    db = tmp_path / "x.db"
    init_db(db)
    with sqlite3.connect(db) as c:
        tables = {r[0] for r in c.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()}
    assert {"watchlist_group", "watchlist_item", "push_log", "undelivered"} <= tables
