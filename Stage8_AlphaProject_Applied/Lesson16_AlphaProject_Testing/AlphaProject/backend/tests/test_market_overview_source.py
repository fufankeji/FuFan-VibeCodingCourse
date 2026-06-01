"""F4 T004 — market_overview_source."""
from unittest.mock import patch

from app.models.briefing import BlockStatus
from app.services.market_overview_source import MarketOverviewSource


def test_fetch_returns_ready_block_when_all_ok():
    src = MarketOverviewSource(
        fetch_global=lambda: [{"name": "纳指", "change_pct": -0.5}],
        fetch_yesterday=lambda: {"sh": 3200.0, "sh_change_pct": 0.8},
        fetch_sectors=lambda: [{"name": "光伏", "change_pct": 3.2}],
    )
    blk = src.fetch()
    assert blk.status == BlockStatus.ready
    assert blk.data["global"][0]["name"] == "纳指"
    assert blk.data["yesterday"]["sh"] == 3200.0
    assert blk.data["sectors"][0]["name"] == "光伏"


def test_fetch_returns_missing_block_when_all_fail():
    def boom():
        raise RuntimeError("akshare down")

    src = MarketOverviewSource(
        fetch_global=boom, fetch_yesterday=boom, fetch_sectors=boom
    )
    blk = src.fetch()
    assert blk.status == BlockStatus.missing
    assert blk.data is None


def test_partial_failure_returns_ready_with_subset():
    # 外盘失败但昨收+板块就绪 → 仍 ready, 失败部分为空
    src = MarketOverviewSource(
        fetch_global=lambda: (_ for _ in ()).throw(RuntimeError("e")),
        fetch_yesterday=lambda: {"sh": 3200.0},
        fetch_sectors=lambda: [],
    )
    blk = src.fetch()
    assert blk.status == BlockStatus.ready
    assert blk.data["global"] == []
    assert blk.data["yesterday"]["sh"] == 3200.0
