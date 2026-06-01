"""F4 T002 — briefing_record table + helpers."""
import sqlite3
from pathlib import Path

import pytest

from app.db import (
    delete_briefings_older_than,
    get_briefing_by_date,
    init_db,
    save_briefing,
)


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    p = tmp_path / "test.db"
    init_db(p)
    return p


def test_briefing_record_table_exists(db_path: Path):
    with sqlite3.connect(db_path) as conn:
        row = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='briefing_record'"
        ).fetchone()
    assert row is not None


def test_save_and_load_briefing(db_path: Path):
    save_briefing(
        db_path,
        on_date="2026-05-28",
        content_json='{"market":"..."}',
        version="full",
        push_status="delivered",
    )
    row = get_briefing_by_date(db_path, "2026-05-28")
    assert row is not None
    assert row["on_date"] == "2026-05-28"
    assert row["version"] == "full"
    assert row["push_status"] == "delivered"
    assert row["content_json"] == '{"market":"..."}'


def test_save_briefing_upsert_replaces_same_date(db_path: Path):
    # 9:15 预热版 → 9:18 完整版替换
    save_briefing(db_path, on_date="2026-05-28", content_json="{}", version="warmup", push_status="delivered")
    save_briefing(db_path, on_date="2026-05-28", content_json="{}", version="full", push_status="delivered")
    row = get_briefing_by_date(db_path, "2026-05-28")
    assert row["version"] == "full"


def test_delete_older_than_keeps_recent(db_path: Path):
    save_briefing(db_path, on_date="2026-04-01", content_json="{}", version="full", push_status="delivered")
    save_briefing(db_path, on_date="2026-05-28", content_json="{}", version="full", push_status="delivered")
    deleted = delete_briefings_older_than(db_path, before="2026-05-01")
    assert deleted == 1
    assert get_briefing_by_date(db_path, "2026-04-01") is None
    assert get_briefing_by_date(db_path, "2026-05-28") is not None
