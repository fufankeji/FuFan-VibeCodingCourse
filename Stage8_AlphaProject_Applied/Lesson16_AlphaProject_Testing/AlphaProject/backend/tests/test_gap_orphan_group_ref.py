"""G-02 · B-①.d · 孤儿 group_id 引用静默通过

SQLite 默认 foreign_keys=OFF，schema 声明的 ON DELETE SET NULL 失效。
当前服务层不校验 group_id 存在性，可写入指向不存在分组的孤儿引用。

RED: add()/update() 接受 group_id=999（无对应 group）静默成功。
GREEN: 服务层 _assert_group_exists 校验，越权 group_id 拒绝。

风险级：P1（数据一致性，阻断发布）
可追溯：F5 / 001 / FR-008 (group binding) / FR-009 (group ≤5)
"""

from pathlib import Path

import pytest

from app.db import init_db
from app.errors import WatchlistError
from app.repositories.watchlist_repo import WatchlistRepo
from app.services.watchlist_service import WatchlistService


def _make_svc(tmp_path: Path) -> WatchlistService:
    db_path = tmp_path / "alpha.db"
    init_db(db_path)
    return WatchlistService(repo=WatchlistRepo(db_path), max_total=30, max_holding=5)


def test_add_with_nonexistent_group_id_is_rejected(tmp_path: Path):
    svc = _make_svc(tmp_path)
    # No groups exist
    assert svc.list_groups() == []
    with pytest.raises(WatchlistError, match="未找到分组"):
        svc.add(code="600519", name="贵州茅台", group_id=999)
    # Nothing was persisted
    assert svc.repo.list_active() == []


def test_update_to_nonexistent_group_id_is_rejected(tmp_path: Path):
    svc = _make_svc(tmp_path)
    g = svc.create_group("持仓")
    svc.add(code="600519", name="贵州茅台", group_id=g.id)
    with pytest.raises(WatchlistError, match="未找到分组"):
        svc.update("600519", group_id=999)
    # Existing valid binding preserved
    assert svc.repo.get("600519").group_id == g.id


def test_add_with_null_group_id_allowed(tmp_path: Path):
    svc = _make_svc(tmp_path)
    # No groups + group_id None should succeed (no binding)
    item = svc.add(code="600519", name="贵州茅台", group_id=None)
    assert item.group_id is None


def test_update_clearing_group_id_still_works(tmp_path: Path):
    svc = _make_svc(tmp_path)
    g = svc.create_group("持仓")
    svc.add(code="600519", name="贵州茅台", group_id=g.id)
    # Clearing (to None) must still pass even though "no group" is the target
    svc.update("600519", group_id=None)
    assert svc.repo.get("600519").group_id is None
