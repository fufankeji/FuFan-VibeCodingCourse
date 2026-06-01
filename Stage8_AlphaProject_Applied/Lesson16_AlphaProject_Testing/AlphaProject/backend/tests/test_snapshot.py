from pathlib import Path

import pytest

from app.db import init_db
from app.repositories.watchlist_repo import WatchlistRepo
from app.services.watchlist_service import WatchlistService


@pytest.fixture
def svc(tmp_path: Path) -> WatchlistService:
    db_path = tmp_path / "alpha.db"
    init_db(db_path)
    return WatchlistService(repo=WatchlistRepo(db_path), max_total=30, max_holding=5)


def test_snapshot_empty_returns_empty_list(svc: WatchlistService):
    assert svc.snapshot() == []


def test_snapshot_contains_all_required_fields(svc: WatchlistService):
    g = svc.create_group("持仓")
    svc.add(code="600519", name="贵州茅台", is_holding=True, group_id=g.id)
    snap = svc.snapshot()
    assert len(snap) == 1
    item = snap[0]
    for required in ("code", "name", "group_id", "is_holding", "display_order", "joined_at"):
        assert required in item, f"snapshot missing {required}"
    assert item["code"] == "600519"
    assert item["is_holding"] is True
    assert item["group_id"] == g.id


def test_snapshot_excludes_soft_deleted(svc: WatchlistService):
    svc.add(code="600519", name="贵州茅台")
    svc.add(code="000001", name="平安银行")
    svc.remove("000001")
    codes = {i["code"] for i in svc.snapshot()}
    assert codes == {"600519"}


def test_snapshot_orders_by_display_order(svc: WatchlistService):
    svc.add(code="600519", name="贵州茅台")
    svc.add(code="000001", name="平安银行")
    svc.update("000001", display_order=-1)  # earlier
    codes = [i["code"] for i in svc.snapshot()]
    assert codes == ["000001", "600519"]
