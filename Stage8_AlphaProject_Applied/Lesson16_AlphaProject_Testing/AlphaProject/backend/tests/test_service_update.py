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
    return WatchlistService(repo=WatchlistRepo(db_path), max_total=30, max_holding=5)


def test_update_toggle_holding_on(svc: WatchlistService):
    svc.add(code="600519", name="贵州茅台")
    svc.update("600519", is_holding=True)
    assert svc.repo.get("600519").is_holding is True


def test_update_holding_blocked_when_full(svc: WatchlistService):
    for i in range(5):
        svc.add(code=f"6{i:05d}", name=f"持仓{i}", is_holding=True)
    svc.add(code="600100", name="观察")
    with pytest.raises(WatchlistError, match="持仓"):
        svc.update("600100", is_holding=True)


def test_update_change_group(svc: WatchlistService):
    g = svc.create_group("持仓")
    svc.add(code="600519", name="贵州茅台")
    svc.update("600519", group_id=g.id)
    assert svc.repo.get("600519").group_id == g.id


def test_update_change_display_order(svc: WatchlistService):
    svc.add(code="600519", name="贵州茅台")
    svc.update("600519", display_order=7)
    assert svc.repo.get("600519").display_order == 7


def test_update_unknown_raises(svc: WatchlistService):
    with pytest.raises(WatchlistError, match="未找到"):
        svc.update("999999", is_holding=True)


def test_update_no_args_noop(svc: WatchlistService):
    g = svc.create_group("持仓")
    svc.add(code="600519", name="贵州茅台", is_holding=True, group_id=g.id)
    svc.update("600519")  # no fields
    item = svc.repo.get("600519")
    assert item.is_holding is True
    assert item.group_id == 1
