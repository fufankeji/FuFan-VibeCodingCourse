from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.watchlist import build_app
from app.db import init_db


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    db_path = tmp_path / "alpha.db"
    init_db(db_path)
    app = build_app(db_path=db_path, fetcher=lambda: [
        {"code": "600519", "name": "贵州茅台"},
        {"code": "000001", "name": "平安银行"},
    ])
    return TestClient(app)


def test_get_empty_list(client: TestClient):
    r = client.get("/watchlist")
    assert r.status_code == 200
    assert r.json() == []


def test_post_add_returns_201(client: TestClient):
    r = client.post("/watchlist", json={"code": "600519", "name": "贵州茅台"})
    assert r.status_code == 201
    assert r.json()["code"] == "600519"


def test_post_duplicate_returns_400(client: TestClient):
    client.post("/watchlist", json={"code": "600519", "name": "贵州茅台"})
    r = client.post("/watchlist", json={"code": "600519", "name": "贵州茅台"})
    assert r.status_code == 400
    assert "已存在" in r.json()["detail"]


def test_delete_removes(client: TestClient):
    client.post("/watchlist", json={"code": "600519", "name": "贵州茅台"})
    r = client.delete("/watchlist/600519")
    assert r.status_code == 204
    assert client.get("/watchlist").json() == []


def test_patch_updates_holding(client: TestClient):
    client.post("/watchlist", json={"code": "600519", "name": "贵州茅台"})
    r = client.patch("/watchlist/600519", json={"is_holding": True})
    assert r.status_code == 200
    assert r.json()["is_holding"] is True


def test_undo_restores(client: TestClient):
    client.post("/watchlist", json={"code": "600519", "name": "贵州茅台"})
    client.delete("/watchlist/600519")
    r = client.post("/watchlist/600519:undo")
    assert r.status_code == 200
    assert len(client.get("/watchlist").json()) == 1


def test_search_by_code(client: TestClient):
    r = client.get("/watchlist:search", params={"q": "600519"})
    assert r.status_code == 200
    codes = {x["code"] for x in r.json()}
    assert "600519" in codes


def test_search_by_pinyin(client: TestClient):
    r = client.get("/watchlist:search", params={"q": "gzmt"})
    assert r.status_code == 200
    assert any(x["code"] == "600519" for x in r.json())


def test_post_31st_returns_400(client: TestClient):
    for i in range(30):
        r = client.post("/watchlist", json={"code": f"6{i:05d}", "name": f"股{i}"})
        assert r.status_code == 201, r.json()
    r = client.post("/watchlist", json={"code": "999999", "name": "超额"})
    assert r.status_code == 400
    assert "上限 30" in r.json()["detail"]


def test_groups_crud_via_api(client: TestClient):
    r = client.post("/watchlist/groups", json={"name": "持仓"})
    assert r.status_code == 201
    gid = r.json()["id"]
    r = client.get("/watchlist/groups")
    assert len(r.json()) == 1
    r = client.patch(f"/watchlist/groups/{gid}", json={"name": "新名"})
    assert r.status_code == 200
    assert r.json()["name"] == "新名"
    r = client.delete(f"/watchlist/groups/{gid}")
    assert r.status_code == 204
    assert client.get("/watchlist/groups").json() == []
