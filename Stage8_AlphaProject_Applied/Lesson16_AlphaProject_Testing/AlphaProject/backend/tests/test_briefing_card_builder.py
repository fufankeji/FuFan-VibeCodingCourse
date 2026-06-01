"""F4 T007 — card_builder."""
from app.briefing.card_builder import build_card
from app.models.briefing import BlockStatus, BriefingContent, BriefingVersion, DataBlock


def _ready_content(body="正文……"):
    return BriefingContent(
        market_overview=DataBlock(name="m", data={"global": [{"name": "纳指", "change_pct": -0.5}], "yesterday": {"sh": 3200}, "sectors": []}),
        watchlist=DataBlock(name="w", data=[{"code": "600519", "name": "贵州茅台", "change_pct": 1.2}]),
        news=DataBlock(name="n", data=[{"title": "新规出台"}]),
        calendar=DataBlock(name="c", data={"earnings": [], "econ": [{"name": "CPI", "time": "09:30"}]}),
        body_text=body,
        version=BriefingVersion.full,
    )


def test_card_has_4_sections_when_ready():
    md = build_card(_ready_content())
    assert "市场概览" in md
    assert "我的自选股" in md
    assert "财联社昨夜要闻" in md
    assert "今日日历" in md
    assert "贵州茅台" in md
    assert "纳指" in md
    assert "新规出台" in md
    assert "CPI" in md


def test_card_embeds_body_text():
    md = build_card(_ready_content(body="AI 提炼正文"))
    assert "AI 提炼正文" in md


def test_card_renders_missing_block_as_placeholder():
    c = _ready_content()
    c.news = DataBlock(name="n", data=None, status=BlockStatus.missing)
    md = build_card(c)
    assert "暂无数据" in md


def test_card_renders_loading_block():
    c = _ready_content()
    c.news = DataBlock(name="n", data=None, status=BlockStatus.loading)
    md = build_card(c)
    assert "数据获取中" in md


def test_card_skips_watchlist_when_empty():
    # FR-009: 自选 0 只 → 跳过区块
    c = _ready_content()
    c.watchlist = DataBlock(name="w", data=[])
    md = build_card(c)
    assert "我的自选股" not in md
    # 其他 3 区块仍在
    assert "市场概览" in md
    assert "财联社昨夜要闻" in md


def test_card_version_label():
    c = _ready_content()
    c.version = BriefingVersion.warmup
    md = build_card(c)
    assert "预热版" in md
    c.version = BriefingVersion.full
    md = build_card(c)
    assert "完整版" in md
