"""GET /push/status + GET /push/history — Dashboard contracts.

Status (002-T014):
  - undelivered_count (FR-009) / webhook_ok (FR-012) / muted (FR-011)

History (added for F1 Alert Logs page):
  - Reads push_log table directly — last N rows ordered ts DESC.
  - Used by Alert Logs frontend; gracefully empty when no pushes yet.
"""

import sqlite3
from pathlib import Path

from fastapi import APIRouter, Query

from app.services.push_service import PushService


def build_push_router(svc: PushService, *, db_path: Path | None = None) -> APIRouter:
    router = APIRouter()
    target_db = db_path or svc._db_path  # type: ignore[attr-defined]

    @router.get("/push/status")
    def status() -> dict:
        return svc.status()

    @router.get("/push/history")
    def history(limit: int = Query(default=50, ge=1, le=500)) -> list[dict]:
        with sqlite3.connect(target_db) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT ts, status, retries, code, signal, uuid, error "
                "FROM push_log ORDER BY ts DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]

    return router
