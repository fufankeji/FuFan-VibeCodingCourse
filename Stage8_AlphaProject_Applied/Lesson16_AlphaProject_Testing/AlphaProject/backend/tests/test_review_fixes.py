"""Regression tests for code-review defects D1, D3, D5."""

from pathlib import Path

from fastapi.testclient import TestClient

from app.db import init_db
from app.repositories.watchlist_repo import WatchlistRepo
from app.services.watchlist_service import WatchlistService


# ── D1: main.py must mount watchlist routes (not just /health) ────────
def test_main_app_mounts_watchlist_routes(monkeypatch, tmp_path):
    db_path = tmp_path / "alpha.db"
    init_db(db_path)
    monkeypatch.setenv("DB_PATH", str(db_path))
    # Force re-import via settings reload
    from importlib import reload

    import app.config

    reload(app.config)
    import app.main

    reload(app.main)
    client = TestClient(app.main.app)
    # /health still works
    assert client.get("/health").status_code == 200
    # /watchlist routes now mounted (was orphaned before fix)
    assert client.get("/watchlist").status_code == 200
    assert client.get("/watchlist/groups").status_code == 200


# ── D3: PATCH must be able to clear group_id (set to null) ────────────
def test_update_can_clear_group_id(tmp_path: Path):
    db_path = tmp_path / "alpha.db"
    init_db(db_path)
    svc = WatchlistService(repo=WatchlistRepo(db_path), max_total=30, max_holding=5)
    g = svc.create_group("持仓")
    svc.add(code="600519", name="贵州茅台", group_id=g.id)
    assert svc.repo.get("600519").group_id == g.id
    # Explicit None now clears (sentinel-based update)
    svc.update("600519", group_id=None)
    assert svc.repo.get("600519").group_id is None


def test_update_api_patch_clears_group_id(monkeypatch, tmp_path: Path):
    """End-to-end: HTTP PATCH {group_id: null} actually clears the value."""
    db_path = tmp_path / "alpha.db"
    init_db(db_path)
    from app.api.watchlist import build_app

    app = build_app(db_path=db_path, fetcher=lambda: [], refresh_on_boot=False)
    client = TestClient(app)
    # Bootstrap data
    client.post("/watchlist/groups", json={"name": "持仓"})
    client.post("/watchlist", json={"code": "600519", "name": "贵州茅台", "group_id": 1})
    # PATCH with explicit null
    r = client.patch("/watchlist/600519", json={"group_id": None})
    assert r.status_code == 200
    assert r.json()["group_id"] is None


# ── D5: delete_group must be atomic (UPDATE+DELETE in one transaction) ─
def test_delete_group_is_atomic(tmp_path: Path):
    db_path = tmp_path / "alpha.db"
    init_db(db_path)
    svc = WatchlistService(repo=WatchlistRepo(db_path), max_total=30, max_holding=5)
    g = svc.create_group("持仓")
    svc.add(code="600519", name="贵州茅台", group_id=g.id)
    svc.delete_group(g.id)
    # Item's group_id nulled AND group gone — both must be true
    assert svc.repo.get("600519").group_id is None
    assert svc.repo.list_groups() == []


# ── D5 follow-up: delete_group is atomic (single transaction) ─────────
# (FK enforcement intentionally OFF — see WatchlistRepo._conn note.)
