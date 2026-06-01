"""G-06 · B-④.c · init_db 不可写目录失败行为

main.py lifespan 在启动时调 settings.DB_PATH.parent.mkdir + init_db。
若父目录不可写（典型场景：装盘 RO、权限被外部脚本改坏），必须 **fail fast** 抛
PermissionError，让 uvicorn 启动失败，而不是静默继续装一个空 in-memory db。

风险级：P2（启动门，告警级）
可追溯：F5 / 001 / T002 init_db / T013 backup-restore
"""

import os
import sqlite3
from pathlib import Path

import pytest

from app.db import init_db


@pytest.mark.skipif(os.geteuid() == 0, reason="root bypasses unix perms")
def test_init_db_on_readonly_parent_fails_fast(tmp_path: Path):
    """When the parent dir is read-only, init_db MUST fail fast (raise) rather
    than silently create an in-memory fallback. Exception class is
    implementation-specific (PermissionError from mkdir if parent missing, or
    sqlite3.OperationalError 'unable to open database file' when parent exists
    but is RO) — what matters is that startup observably fails."""
    parent = tmp_path / "ro_dir"
    parent.mkdir()
    parent.chmod(0o555)
    try:
        db_path = parent / "alpha.db"
        with pytest.raises((PermissionError, OSError, sqlite3.OperationalError)) as excinfo:
            init_db(db_path)
        # Must surface a recognizable filesystem/permission/sqlite failure;
        # the actual db file MUST NOT have been created.
        assert not db_path.exists(), "DB file created despite read-only parent"
        msg = str(excinfo.value).lower()
        assert any(kw in msg for kw in ("permission", "unable to open", "read-only")), (
            f"Failure message must indicate the root cause, got: {excinfo.value!r}"
        )
    finally:
        parent.chmod(0o755)


def test_init_db_creates_nested_directory(tmp_path: Path):
    """Positive sibling: when parent is writable but doesn't exist yet,
    init_db creates the full chain."""
    db_path = tmp_path / "data" / "subdir" / "alpha.db"
    assert not db_path.parent.exists()
    init_db(db_path)
    assert db_path.exists()
