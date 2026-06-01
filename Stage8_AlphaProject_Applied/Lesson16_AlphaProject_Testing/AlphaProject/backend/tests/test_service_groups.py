from pathlib import Path

import pytest

from app.db import init_db
from app.errors import WatchlistError
from app.repositories.watchlist_repo import WatchlistRepo
from app.services.watchlist_service import WatchlistService


@pytest.fixture
def svc(tmp_path: Path) -> WatchlistService:
    db_path = tmp_path / "alpha.db"
    init_db(db_path)
    return WatchlistService(repo=WatchlistRepo(db_path), max_total=30, max_holding=5, max_group=5)


def test_create_group_ok(svc: WatchlistService):
    g = svc.create_group("持仓")
    assert g.id is not None
    assert g.name == "持仓"
    assert len(svc.list_groups()) == 1


def test_create_6th_group_raises(svc: WatchlistService):
    for i in range(5):
        svc.create_group(f"组{i}")
    with pytest.raises(WatchlistError, match="分组上限"):
        svc.create_group("组6")


def test_rename_group(svc: WatchlistService):
    g = svc.create_group("旧名")
    svc.rename_group(g.id, "新名")
    assert {x.name for x in svc.list_groups()} == {"新名"}


def test_rename_unknown_raises(svc: WatchlistService):
    with pytest.raises(WatchlistError, match="未找到分组"):
        svc.rename_group(999, "x")


def test_delete_group_resets_items(svc: WatchlistService):
    g = svc.create_group("持仓")
    svc.add(code="600519", name="贵州茅台", group_id=g.id)
    svc.delete_group(g.id)
    assert svc.list_groups() == []
    assert svc.repo.get("600519").group_id is None


def test_duplicate_group_name_raises(svc: WatchlistService):
    svc.create_group("持仓")
    with pytest.raises(WatchlistError, match="已存在"):
        svc.create_group("持仓")
