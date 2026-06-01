"""F4 T014 — briefing history API."""
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.briefing import build_briefing_router
from app.db import init_db, save_briefing


@pytest.fixture
def client(tmp_path: Path):
    db = tmp_path / "x.db"
    init_db(db)
    app = FastAPI()
    app.include_router(build_briefing_router(db_path=db))
    return TestClient(app), db


def test_history_lists_recent_briefings(client):
    c, db = client
    save_briefing(db, on_date="2026-05-28", content_json="{}", version="full", push_status="delivered")
    save_briefing(db, on_date="2026-05-27", content_json="{}", version="warmup", push_status="delivered")
    r = c.get("/briefing/history")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    # DESC order
    assert data[0]["on_date"] == "2026-05-28"
    assert data[0]["version"] == "full"


def test_get_by_date_returns_full_record(client):
    c, db = client
    save_briefing(
        db, on_date="2026-05-28", content_json='{"body":"x"}', version="full", push_status="delivered"
    )
    r = c.get("/briefing/2026-05-28")
    assert r.status_code == 200
    body = r.json()
    assert body["on_date"] == "2026-05-28"
    assert body["content_json"] == '{"body":"x"}'


def test_get_by_date_404_when_missing(client):
    c, _ = client
    r = c.get("/briefing/2026-05-28")
    assert r.status_code == 404
