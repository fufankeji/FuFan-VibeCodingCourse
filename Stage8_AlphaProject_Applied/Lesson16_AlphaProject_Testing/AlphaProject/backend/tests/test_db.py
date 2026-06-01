import sqlite3
from pathlib import Path

import pytest

from app.db import init_db, integrity_check


def test_init_creates_watchlist_item_and_group_tables(tmp_path: Path):
    db_path = tmp_path / "alpha.db"
    init_db(db_path)
    with sqlite3.connect(db_path) as conn:
        names = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert "watchlist_item" in names
    assert "watchlist_group" in names


def test_init_is_idempotent(tmp_path: Path):
    db_path = tmp_path / "alpha.db"
    init_db(db_path)
    init_db(db_path)  # must not raise


def test_integrity_check_passes_on_fresh_db(tmp_path: Path):
    db_path = tmp_path / "alpha.db"
    init_db(db_path)
    assert integrity_check(db_path) is True


def test_integrity_check_returns_false_on_corrupted_file(tmp_path: Path, caplog: pytest.LogCaptureFixture):
    db_path = tmp_path / "corrupt.db"
    db_path.write_bytes(b"not a sqlite file at all")
    with caplog.at_level("WARNING"):
        result = integrity_check(db_path)
    assert result is False
    assert any("integrity" in r.message.lower() or "corrupt" in r.message.lower() for r in caplog.records)
