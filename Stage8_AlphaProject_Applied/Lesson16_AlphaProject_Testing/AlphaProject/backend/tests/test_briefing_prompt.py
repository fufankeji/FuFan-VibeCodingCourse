"""F4 T006 — briefing prompt."""
from app.briefing.briefing_prompt import build_briefing_messages
from app.models.briefing import BlockStatus, DataBlock


def _blk(name, data, status=BlockStatus.ready):
    return DataBlock(name=name, data=data, status=status)


def test_prompt_contains_4_sections_and_word_limit():
    msgs = build_briefing_messages(
        market_overview=_blk("market", {"global": [], "yesterday": {}, "sectors": []}),
        watchlist=_blk("watchlist", []),
        news=_blk("news", []),
        calendar=_blk("calendar", {"earnings": [], "econ": []}),
    )
    assert len(msgs) == 2
    sys = msgs[0]["content"]
    assert "市场概览" in sys
    assert "我的自选股" in sys
    assert "财联社昨夜要闻" in sys
    assert "今日日历" in sys
    assert "1200" in sys


def test_prompt_user_carries_block_facts():
    msgs = build_briefing_messages(
        market_overview=_blk("market", {"global": [{"name": "纳指", "change_pct": -0.5}], "yesterday": {"sh": 3200}, "sectors": []}),
        watchlist=_blk("watchlist", [{"code": "600519", "name": "贵州茅台"}]),
        news=_blk("news", [{"title": "新规出台"}]),
        calendar=_blk("calendar", {"earnings": [], "econ": [{"name": "CPI"}]}),
    )
    body = msgs[1]["content"]
    assert "纳指" in body
    assert "贵州茅台" in body
    assert "新规出台" in body
    assert "CPI" in body


def test_prompt_marks_missing_blocks():
    msgs = build_briefing_messages(
        market_overview=_blk("market", None, status=BlockStatus.missing),
        watchlist=_blk("watchlist", []),
        news=_blk("news", []),
        calendar=_blk("calendar", {"earnings": [], "econ": []}),
    )
    body = msgs[1]["content"]
    assert "暂无" in body or "missing" in body.lower() or "数据获取" in body
