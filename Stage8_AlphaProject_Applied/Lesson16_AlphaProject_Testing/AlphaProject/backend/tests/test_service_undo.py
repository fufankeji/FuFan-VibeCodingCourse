from datetime import datetime, timedelta
from pathlib import Path

import pytest

from app.db import init_db
from app.errors import WatchlistError
from app.repositories.watchlist_repo import WatchlistRepo
from app.services.watchlist_service import WatchlistService


def _svc_at(tmp_path: Path, now: datetime) -> WatchlistService:
    db_path = tmp_path / "alpha.db"
    init_db(db_path)
    return WatchlistService(
        repo=WatchlistRepo(db_path),
        max_total=30,
        max_holding=5,
        clock=lambda: now,
    )


def test_undo_within_30s_restores(tmp_path: Path):
    t0 = datetime(2026, 5, 28, 14, 30, 0)
    svc = _svc_at(tmp_path, t0)
    svc.add(code="600519", name="贵州茅台")
    svc.remove("600519")
    svc.clock = lambda: t0 + timedelta(seconds=10)
    svc.undo("600519")
    assert [i.code for i in svc.repo.list_active()] == ["600519"]


def test_undo_after_30s_raises(tmp_path: Path):
    t0 = datetime(2026, 5, 28, 14, 30, 0)
    svc = _svc_at(tmp_path, t0)
    svc.add(code="600519", name="贵州茅台")
    svc.remove("600519")
    svc.clock = lambda: t0 + timedelta(seconds=31)
    with pytest.raises(WatchlistError, match="超时"):
        svc.undo("600519")


def test_undo_unknown_raises(tmp_path: Path):
    svc = _svc_at(tmp_path, datetime.now())
    with pytest.raises(WatchlistError, match="未找到"):
        svc.undo("999999")


def test_undo_of_active_item_raises(tmp_path: Path):
    svc = _svc_at(tmp_path, datetime.now())
    svc.add(code="600519", name="贵州茅台")
    with pytest.raises(WatchlistError, match="未删除"):
        svc.undo("600519")


def test_purge_expired_hard_deletes_after_30s(tmp_path: Path):
    t0 = datetime(2026, 5, 28, 14, 30, 0)
    svc = _svc_at(tmp_path, t0)
    svc.add(code="600519", name="贵州茅台")
    svc.remove("600519")
    svc.clock = lambda: t0 + timedelta(seconds=31)
    svc.purge_expired_soft_deletes()
    # Now hard-deleted, undo not possible
    with pytest.raises(WatchlistError, match="未找到"):
        svc.undo("600519")
