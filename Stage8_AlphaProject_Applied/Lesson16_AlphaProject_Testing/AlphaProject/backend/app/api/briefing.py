"""F4 T014 — briefing history endpoints (Dashboard 简报回看)."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.db import get_briefing_by_date, list_briefings


def build_briefing_router(*, db_path: Path) -> APIRouter:
    router = APIRouter(prefix="/briefing")

    @router.get("/history")
    def history() -> list[dict]:
        return list_briefings(db_path)

    @router.get("/{on_date}")
    def by_date(on_date: str) -> dict:
        row = get_briefing_by_date(db_path, on_date)
        if row is None:
            raise HTTPException(status_code=404, detail=f"briefing {on_date} not found")
        return row

    return router
