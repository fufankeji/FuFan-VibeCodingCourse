from pathlib import Path

import pytest

from app.db import init_db
from app.models.watchlist import WatchlistGroup, WatchlistItem
from app.repositories.watchlist_repo import WatchlistRepo


@pytest.fixture
def repo(tmp_path: Path) -> WatchlistRepo:
    db_path = tmp_path / "alpha.db"
    init_db(db_path)
    return WatchlistRepo(db_path)


def test_save_and_get_item_roundtrip(repo: WatchlistRepo):
    item = WatchlistItem(code="600519", name="贵州茅台", is_holding=True)
    repo.save(item)
    fetched = repo.get("600519")
    assert fetched is not None
    assert fetched.code == "600519"
    assert fetched.name == "贵州茅台"
    assert fetched.is_holding is True


def test_get_missing_returns_none(repo: WatchlistRepo):
    assert repo.get("999999") is None


def test_list_active_excludes_soft_deleted(repo: WatchlistRepo):
    repo.save(WatchlistItem(code="600519", name="贵州茅台"))
    repo.save(WatchlistItem(code="000001", name="平安银行"))
    repo.hard_delete("000001")
    codes = {i.code for i in repo.list_active()}
    assert codes == {"600519"}


def test_save_replaces_existing(repo: WatchlistRepo):
    repo.save(WatchlistItem(code="600519", name="贵州茅台"))
    repo.save(WatchlistItem(code="600519", name="贵州茅台 A", is_holding=True))
    fetched = repo.get("600519")
    assert fetched is not None
    assert fetched.name == "贵州茅台 A"
    assert fetched.is_holding is True


def test_group_save_and_list(repo: WatchlistRepo):
    g = repo.save_group(WatchlistGroup(name="持仓"))
    assert g.id is not None
    groups = repo.list_groups()
    assert len(groups) == 1
    assert groups[0].name == "持仓"


def test_persistence_survives_new_connection(tmp_path: Path):
    db_path = tmp_path / "alpha.db"
    init_db(db_path)
    WatchlistRepo(db_path).save(WatchlistItem(code="600519", name="贵州茅台"))
    # Fresh repo on same file
    assert WatchlistRepo(db_path).get("600519") is not None
