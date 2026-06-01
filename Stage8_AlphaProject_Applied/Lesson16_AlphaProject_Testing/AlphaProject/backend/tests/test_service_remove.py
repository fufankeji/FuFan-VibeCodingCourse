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


def test_remove_existing_soft_deletes(svc: WatchlistService):
    svc.add(code="600519", name="贵州茅台")
    svc.remove("600519")
    assert svc.repo.get("600519") is not None  # row still there (soft)
    assert svc.repo.get("600519").deleted_at is not None
    assert [i.code for i in svc.repo.list_active()] == []


def test_remove_unknown_raises(svc: WatchlistService):
    with pytest.raises(WatchlistError, match="未找到"):
        svc.remove("999999")


def test_remove_clears_pending_queue_placeholder(svc: WatchlistService):
    svc.add(code="600519", name="贵州茅台")
    cleared_for: list[str] = []
    svc.set_queue_cleaner(cleared_for.append)
    svc.remove("600519")
    assert cleared_for == ["600519"]
