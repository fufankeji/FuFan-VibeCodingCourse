import logging
import sqlite3
from datetime import date
from pathlib import Path

logger = logging.getLogger(__name__)


_SCHEMA = """
CREATE TABLE IF NOT EXISTS watchlist_group (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS watchlist_item (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    group_id INTEGER REFERENCES watchlist_group(id) ON DELETE SET NULL,
    is_holding INTEGER NOT NULL DEFAULT 0,
    display_order INTEGER NOT NULL DEFAULT 0,
    joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_watchlist_item_active
    ON watchlist_item(deleted_at) WHERE deleted_at IS NULL;

-- F6 推送通道 (002-T002): 与 watchlist_* 零交叉
CREATE TABLE IF NOT EXISTS push_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    status TEXT NOT NULL,
    retries INTEGER NOT NULL DEFAULT 0,
    target TEXT,
    code TEXT,
    signal TEXT,
    uuid TEXT,
    error TEXT
);
CREATE INDEX IF NOT EXISTS idx_push_log_ts ON push_log(ts);

CREATE TABLE IF NOT EXISTS undelivered (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL,
    request_json TEXT NOT NULL,
    fail_count INTEGER NOT NULL DEFAULT 0,
    queued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_holding INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_undelivered_queued ON undelivered(queued_at);

-- F3 (004) per-day cumulative LLM cost in CNY.
CREATE TABLE IF NOT EXISTS llm_budget (
    on_date TEXT PRIMARY KEY,
    cost_cny REAL NOT NULL DEFAULT 0.0
);

-- F4 (006) 早盘简报历史 — 1 行 / 天，9:18 完整版覆盖 9:15 预热版.
CREATE TABLE IF NOT EXISTS briefing_record (
    on_date TEXT PRIMARY KEY,
    content_json TEXT NOT NULL,
    version TEXT NOT NULL,
    push_status TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


def init_db(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as conn:
        conn.executescript(_SCHEMA)


def integrity_check(db_path: Path) -> bool:
    try:
        with sqlite3.connect(db_path) as conn:
            row = conn.execute("PRAGMA integrity_check").fetchone()
        if row and row[0] == "ok":
            return True
        logger.warning("SQLite integrity check failed at %s: %s", db_path, row)
        return False
    except sqlite3.DatabaseError as exc:
        logger.warning("SQLite file corrupt at %s: %s", db_path, exc)
        return False


# ── F3 LLM budget helpers (T002) ─────────────────────────────────────────────
def _key(d: date | None) -> str:
    return (d or date.today()).isoformat()


def add_llm_cost(db_path: Path, cost_cny: float, *, on_date: date | None = None) -> None:
    """Accumulate LLM cost for the given calendar day (defaults to today)."""
    if cost_cny < 0:
        return
    k = _key(on_date)
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            "INSERT INTO llm_budget(on_date, cost_cny) VALUES(?, ?) "
            "ON CONFLICT(on_date) DO UPDATE SET cost_cny = cost_cny + excluded.cost_cny",
            (k, float(cost_cny)),
        )


def get_llm_cost_today(db_path: Path, *, today: date | None = None) -> float:
    """Return accumulated LLM cost for the given day; 0.0 if none."""
    k = _key(today)
    with sqlite3.connect(db_path) as conn:
        row = conn.execute("SELECT cost_cny FROM llm_budget WHERE on_date = ?", (k,)).fetchone()
    return float(row[0]) if row else 0.0


def reset_llm_budget_if_new_day(db_path: Path, *, today: date | None = None) -> None:
    """No-op for SQL backend (rows are per-day already), but keeps the
    explicit contract spec mentions: "跨日自动归零". We simply ensure no
    leftover row for *today* — calling this before reads is a defensive
    cross-day boundary signal.
    """
    # Per-day rows are isolated by primary key; nothing to delete.
    # Future days simply start with 0.0 via get_llm_cost_today().
    _ = _key(today)


# ── F4 briefing_record helpers (T002) ───────────────────────────────────────
def save_briefing(
    db_path: Path,
    *,
    on_date: str,
    content_json: str,
    version: str,
    push_status: str,
) -> None:
    """Upsert briefing for the given calendar day (9:18 完整版 覆盖 9:15 预热版)."""
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            "INSERT INTO briefing_record(on_date, content_json, version, push_status) "
            "VALUES(?,?,?,?) "
            "ON CONFLICT(on_date) DO UPDATE SET "
            "content_json=excluded.content_json, version=excluded.version, "
            "push_status=excluded.push_status",
            (on_date, content_json, version, push_status),
        )


def get_briefing_by_date(db_path: Path, on_date: str) -> dict | None:
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT on_date, content_json, version, push_status, created_at "
            "FROM briefing_record WHERE on_date = ?",
            (on_date,),
        ).fetchone()
    return dict(row) if row else None


def list_briefings(db_path: Path) -> list[dict]:
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT on_date, version, push_status, created_at "
            "FROM briefing_record ORDER BY on_date DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def delete_briefings_older_than(db_path: Path, *, before: str) -> int:
    """Delete rows with on_date < before (ISO yyyy-mm-dd). Returns count."""
    with sqlite3.connect(db_path) as conn:
        cur = conn.execute("DELETE FROM briefing_record WHERE on_date < ?", (before,))
        return cur.rowcount
