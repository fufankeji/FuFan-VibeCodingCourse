import sqlite3
from datetime import datetime
from pathlib import Path

from app.models.watchlist import WatchlistGroup, WatchlistItem


class WatchlistRepo:
    """SQLite persistence layer for watchlist items and groups.

    Only this class touches the SQLite connection; services consume it.
    """

    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        # NOTE: FK enforcement deliberately OFF (SQLite default). The declared
        # `ON DELETE SET NULL` on group_id is inert; `delete_group` manually
        # nulls items in the same transaction. Turning FKs on would require
        # service-layer group_id existence validation (deferred — single-user
        # local tool, no untrusted input path).
        return conn

    # ── items ──────────────────────────────────────────────
    def save(self, item: WatchlistItem) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO watchlist_item
                    (code, name, group_id, is_holding, display_order, joined_at, deleted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(code) DO UPDATE SET
                    name=excluded.name,
                    group_id=excluded.group_id,
                    is_holding=excluded.is_holding,
                    display_order=excluded.display_order,
                    deleted_at=excluded.deleted_at
                """,
                (
                    item.code,
                    item.name,
                    item.group_id,
                    int(item.is_holding),
                    item.display_order,
                    item.joined_at.isoformat(),
                    item.deleted_at.isoformat() if item.deleted_at else None,
                ),
            )

    def get(self, code: str) -> WatchlistItem | None:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM watchlist_item WHERE code = ?", (code,)).fetchone()
        return self._row_to_item(row) if row else None

    def list_active(self) -> list[WatchlistItem]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM watchlist_item WHERE deleted_at IS NULL ORDER BY display_order, code"
            ).fetchall()
        return [self._row_to_item(r) for r in rows]

    def hard_delete(self, code: str) -> None:
        with self._conn() as conn:
            conn.execute("DELETE FROM watchlist_item WHERE code = ?", (code,))

    def soft_delete(self, code: str, at: datetime) -> None:
        with self._conn() as conn:
            conn.execute(
                "UPDATE watchlist_item SET deleted_at = ? WHERE code = ?",
                (at.isoformat(), code),
            )

    def undo_soft_delete(self, code: str) -> None:
        with self._conn() as conn:
            conn.execute(
                "UPDATE watchlist_item SET deleted_at = NULL WHERE code = ?",
                (code,),
            )

    def list_soft_deleted(self) -> list[WatchlistItem]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM watchlist_item WHERE deleted_at IS NOT NULL"
            ).fetchall()
        return [self._row_to_item(r) for r in rows]

    # ── groups ─────────────────────────────────────────────
    def save_group(self, group: WatchlistGroup) -> WatchlistGroup:
        with self._conn() as conn:
            cur = conn.execute(
                "INSERT INTO watchlist_group (name, created_at) VALUES (?, ?)",
                (group.name, group.created_at.isoformat()),
            )
            new_id = cur.lastrowid
        return group.model_copy(update={"id": new_id})

    def list_groups(self) -> list[WatchlistGroup]:
        with self._conn() as conn:
            rows = conn.execute("SELECT * FROM watchlist_group ORDER BY id").fetchall()
        return [
            WatchlistGroup(id=r["id"], name=r["name"], created_at=datetime.fromisoformat(r["created_at"]))
            for r in rows
        ]

    def update_group(self, group: WatchlistGroup) -> None:
        with self._conn() as conn:
            conn.execute(
                "UPDATE watchlist_group SET name = ? WHERE id = ?",
                (group.name, group.id),
            )

    def delete_group(self, group_id: int) -> None:
        # Single transaction: either both ops commit or neither.
        # `with conn:` wraps in BEGIN/COMMIT (or ROLLBACK on exception).
        with self._conn() as conn:
            conn.execute("BEGIN")
            conn.execute(
                "UPDATE watchlist_item SET group_id = NULL WHERE group_id = ?",
                (group_id,),
            )
            conn.execute("DELETE FROM watchlist_group WHERE id = ?", (group_id,))

    # ── helpers ────────────────────────────────────────────
    @staticmethod
    def _row_to_item(row: sqlite3.Row) -> WatchlistItem:
        return WatchlistItem(
            code=row["code"],
            name=row["name"],
            group_id=row["group_id"],
            is_holding=bool(row["is_holding"]),
            display_order=row["display_order"],
            joined_at=datetime.fromisoformat(row["joined_at"]),
            deleted_at=datetime.fromisoformat(row["deleted_at"]) if row["deleted_at"] else None,
        )
