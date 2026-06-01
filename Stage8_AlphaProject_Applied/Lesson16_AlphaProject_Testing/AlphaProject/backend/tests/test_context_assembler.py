"""T005: context_assembler — board/industry + relevance-filtered news.

[出参验证] 返 ExplainContext；新闻按相关性取 ≤5 条；缺失时返部分结果 + 标记。
"""
from app.models.explain import NewsItem
from app.services.context_assembler import ContextAssembler


class _StubNews:
    def __init__(self, telegraph=None, ann=None, telegraph_exc=False):
        self._tel = telegraph or []
        self._ann = ann or []
        self._exc = telegraph_exc

    def fetch_telegraph(self):
        if self._exc:
            raise RuntimeError("boom")
        return self._tel

    def fetch_announcements(self, code):
        return self._ann


class _StubQuote:
    def __init__(self, sector="白酒", industry="食品饮料", sector_pct=2.5):
        self.sector = sector
        self.industry = industry
        self.sector_pct = sector_pct

    def sector_info(self, code: str):
        return {
            "sector": self.sector,
            "sector_change_pct": self.sector_pct,
            "industry": self.industry,
        }


def test_assemble_happy_path():
    news_src = _StubNews(
        telegraph=[
            NewsItem(title="贵州茅台一季报超预期", published_at="t1"),
            NewsItem(title="光伏新政"),
            NewsItem(title="食品饮料板块走强"),
        ],
        ann=[NewsItem(title="600519 关于回购")],
    )
    asm = ContextAssembler(news=news_src, quote=_StubQuote())
    ctx = asm.assemble(code="600519", name="贵州茅台")
    assert ctx.sector == "白酒"
    assert ctx.industry == "食品饮料"
    # 名/代码/行业词 任一命中
    titles = [n.title for n in ctx.news]
    assert "贵州茅台一季报超预期" in titles
    assert "食品饮料板块走强" in titles
    assert "光伏新政" not in titles
    assert len(ctx.announcements) == 1
    assert ctx.partial is False
    assert ctx.empty is False


def test_relevance_cap_at_5():
    news = [NewsItem(title=f"贵州茅台事件{i}") for i in range(10)]
    asm = ContextAssembler(news=_StubNews(telegraph=news), quote=_StubQuote())
    ctx = asm.assemble(code="600519", name="贵州茅台")
    assert len(ctx.news) == 5


def test_partial_when_news_fails():
    asm = ContextAssembler(
        news=_StubNews(telegraph_exc=True), quote=_StubQuote()
    )
    # news fetch raises but assembler should catch + partial=True
    ctx = asm.assemble(code="600519", name="贵州茅台")
    assert ctx.partial is True
    assert ctx.news == []
    # sector still present (quote ok)
    assert ctx.sector == "白酒"


def test_empty_when_quote_and_news_both_missing():
    class _NoQuote:
        def sector_info(self, code):
            raise RuntimeError("quote down")

    asm = ContextAssembler(news=_StubNews(telegraph_exc=True), quote=_NoQuote())
    ctx = asm.assemble(code="X", name="未知")
    assert ctx.partial is True
    # quote miss but we still have request fundamentals (caller passes price);
    # ctx.empty distinguishes only TOTAL data absence (handled in service via
    # request having no price; tested at orchestration layer).
    assert ctx.sector is None
