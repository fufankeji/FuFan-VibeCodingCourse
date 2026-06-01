import logging
import shutil
import sqlite3
from pathlib import Path

from app.db import init_db, integrity_check

logger = logging.getLogger(__name__)


def backup_db(db_path: Path) -> Path:
    """Create a SQLite-aware backup (uses .backup API for consistency)."""
    bak_path = db_path.with_suffix(db_path.suffix + ".bak")
    with sqlite3.connect(db_path) as src, sqlite3.connect(bak_path) as dst:
        src.backup(dst)
    return bak_path


def restore_or_reset(db_path: Path) -> bool:
    """If main db corrupt: try backup; if no backup, reset to fresh empty db.

    Returns True if restored from backup, False if reset.
    """
    if integrity_check(db_path):
        return True
    bak_path = db_path.with_suffix(db_path.suffix + ".bak")
    if bak_path.exists() and integrity_check(bak_path):
        logger.warning("Main db corrupt; restoring from %s", bak_path)
        shutil.copy2(bak_path, db_path)
        return True
    logger.warning("Main db corrupt and no usable backup; resetting %s", db_path)
    db_path.unlink(missing_ok=True)
    init_db(db_path)
    return False
