from pathlib import Path


from app.backup import backup_db, restore_or_reset
from app.db import init_db
from app.repositories.watchlist_repo import WatchlistRepo
from app.models.watchlist import WatchlistItem


def test_backup_creates_bak_file(tmp_path: Path):
    db_path = tmp_path / "alpha.db"
    init_db(db_path)
    WatchlistRepo(db_path).save(WatchlistItem(code="600519", name="贵州茅台"))
    bak = backup_db(db_path)
    assert bak.exists()
    assert bak.stat().st_size > 0


def test_restore_replaces_corrupt_main(tmp_path: Path, caplog):
    db_path = tmp_path / "alpha.db"
    init_db(db_path)
    WatchlistRepo(db_path).save(WatchlistItem(code="600519", name="贵州茅台"))
    backup_db(db_path)
    # corrupt the main db
    db_path.write_bytes(b"garbage")
    with caplog.at_level("WARNING"):
        restored = restore_or_reset(db_path)
    assert restored is True
    assert WatchlistRepo(db_path).get("600519") is not None


def test_reset_when_no_backup(tmp_path: Path, caplog):
    db_path = tmp_path / "alpha.db"
    db_path.write_bytes(b"garbage")
    with caplog.at_level("WARNING"):
        restored = restore_or_reset(db_path)
    assert restored is False
    # main was reset to a fresh empty db
    assert WatchlistRepo(db_path).list_active() == []
