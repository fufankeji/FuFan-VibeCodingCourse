"""F4 T003 — briefing models."""
import pytest

from app.models.briefing import (
    BlockStatus,
    BriefingContent,
    BriefingRecord,
    BriefingVersion,
    DataBlock,
)


def test_block_status_values():
    assert {s.value for s in BlockStatus} == {"ready", "loading", "missing"}


def test_briefing_version_values():
    assert {v.value for v in BriefingVersion} == {"warmup", "full", "raw", "placeholder"}


def test_data_block_default_status_ready():
    b = DataBlock(name="market", data={"a": 1})
    assert b.status == BlockStatus.ready


def test_data_block_failed_keeps_data_optional():
    b = DataBlock(name="news", data=None, status=BlockStatus.missing)
    assert b.data is None


def test_briefing_content_assembly():
    bc = BriefingContent(
        market_overview=DataBlock(name="market", data={"sh": 3200}),
        watchlist=DataBlock(name="watchlist", data=[]),
        news=DataBlock(name="news", data=[]),
        calendar=DataBlock(name="calendar", data=[]),
        body_text="盘前简报正文……",
        version=BriefingVersion.full,
    )
    assert bc.version == BriefingVersion.full
    assert bc.body_text.startswith("盘前")


def test_briefing_content_rejects_overlong_body():
    # FR-003 — body ≤ 1200 chars
    with pytest.raises(ValueError):
        BriefingContent(
            market_overview=DataBlock(name="m", data={}),
            watchlist=DataBlock(name="w", data=[]),
            news=DataBlock(name="n", data=[]),
            calendar=DataBlock(name="c", data=[]),
            body_text="x" * 1201,
            version=BriefingVersion.full,
        )


def test_briefing_record_roundtrip():
    rec = BriefingRecord(
        on_date="2026-05-28",
        content_json='{"x":1}',
        version=BriefingVersion.full,
        push_status="delivered",
    )
    assert rec.on_date == "2026-05-28"
