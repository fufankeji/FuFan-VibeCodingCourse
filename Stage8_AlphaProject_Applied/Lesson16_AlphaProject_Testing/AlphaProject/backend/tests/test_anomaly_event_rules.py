"""T007 — event_rules: 复用 F3 news_source 取电报/公告，按自选股清单匹配.

[出参验证] 红色电报含自选股名 → 事件信号; 同名公司误匹配可控.
"""
from unittest.mock import MagicMock

from app.anomaly.event_rules import detect_events
from app.models.anomaly import AnomalyType
from app.models.explain import NewsItem


def test_detect_event_match_by_name():
    ns = MagicMock()
    ns.fetch_telegraph.return_value = [
        NewsItem(title="贵州茅台一季度净利创新高", published_at="2026-05-28")
    ]
    ns.fetch_announcements.return_value = []
    watchlist = [{"code": "600519", "name": "贵州茅台", "is_holding": True}]
    sigs = detect_events(watchlist, news_source=ns)
    assert len(sigs) == 1
    assert sigs[0].anomaly_type is AnomalyType.EVENT
    assert sigs[0].code == "600519"
    assert sigs[0].is_holding is True
    assert "茅台" in (sigs[0].event_title or "")


def test_detect_event_match_by_code():
    ns = MagicMock()
    ns.fetch_telegraph.return_value = [NewsItem(title="600519 重大合同公告")]
    ns.fetch_announcements.return_value = []
    sigs = detect_events([{"code": "600519", "name": "贵州茅台"}], news_source=ns)
    assert len(sigs) == 1


def test_no_match_returns_empty():
    ns = MagicMock()
    ns.fetch_telegraph.return_value = [NewsItem(title="某科技公司减持")]
    ns.fetch_announcements.return_value = []
    sigs = detect_events([{"code": "600519", "name": "贵州茅台"}], news_source=ns)
    assert sigs == []


def test_announcement_path_per_stock():
    ns = MagicMock()
    ns.fetch_telegraph.return_value = []
    ns.fetch_announcements.return_value = [NewsItem(title="关于业绩快报的公告")]
    sigs = detect_events([{"code": "600519", "name": "贵州茅台"}], news_source=ns)
    # Per spec we match keywords on announcements regardless of name
    assert len(sigs) == 1


def test_dedup_same_event_for_same_stock_one_signal():
    ns = MagicMock()
    same = NewsItem(title="贵州茅台一季度净利创新高")
    ns.fetch_telegraph.return_value = [same, same]
    ns.fetch_announcements.return_value = []
    sigs = detect_events([{"code": "600519", "name": "贵州茅台"}], news_source=ns)
    assert len(sigs) == 1


def test_short_name_does_not_overmatch():
    # 名称 "AI" 太短 → 不应在任意新闻里命中
    ns = MagicMock()
    ns.fetch_telegraph.return_value = [NewsItem(title="苹果发布新品发布会")]
    ns.fetch_announcements.return_value = []
    sigs = detect_events([{"code": "000001", "name": "AI"}], news_source=ns)
    assert sigs == []
