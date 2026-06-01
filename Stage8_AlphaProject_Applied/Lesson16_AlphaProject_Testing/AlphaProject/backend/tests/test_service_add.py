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
    repo = WatchlistRepo(db_path)
    return WatchlistService(repo=repo, max_total=30, max_holding=5)


def test_add_single_item(svc: WatchlistService):
    item = svc.add(code="600519", name="贵州茅台")
    assert item.code == "600519"
    assert item.is_holding is False
    assert len(svc.repo.list_active()) == 1


def test_add_duplicate_raises(svc: WatchlistService):
    svc.add(code="600519", name="贵州茅台")
    with pytest.raises(WatchlistError, match="已存在"):
        svc.add(code="600519", name="贵州茅台")


def test_add_31st_raises(svc: WatchlistService):
    for i in range(30):
        svc.add(code=f"6{i:05d}", name=f"股{i}")
    with pytest.raises(WatchlistError, match="上限 30"):
        svc.add(code="999999", name="超额股")


def test_add_6th_holding_raises(svc: WatchlistService):
    for i in range(5):
        svc.add(code=f"6{i:05d}", name=f"持仓{i}", is_holding=True)
    with pytest.raises(WatchlistError, match="持仓"):
        svc.add(code="600006", name="第六持仓", is_holding=True)


def test_add_non_holding_after_5_holdings_ok(svc: WatchlistService):
    for i in range(5):
        svc.add(code=f"6{i:05d}", name=f"持仓{i}", is_holding=True)
    item = svc.add(code="600100", name="观察股", is_holding=False)
    assert item.is_holding is False
