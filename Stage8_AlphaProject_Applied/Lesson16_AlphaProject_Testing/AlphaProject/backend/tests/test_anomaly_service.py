"""T010-T012 — anomaly_service scan orchestration.

[T010] 扫描主体：读 F5 清单 → 读 quote/kline → 跑规则 → 转换检测 → 跳过停牌
[T011] 行情陈旧保护：> 5min → 暂停价格规则 + 告警；事件规则不受限
[T012] 推送编排：持仓优先 → 调 F3 解释（超时裸卡片）→ 调 F6 send；单股多规则合并
"""
import time
from unittest.mock import MagicMock

from app.models.anomaly import AnomalyType
from app.models.explain import ExplainResult, ResultSource
from app.services.anomaly_service import AnomalyService, QuoteSnapshot


def _quote(code, change_pct=0.0, price=100.0, volume_ratio=1.0, high=0.0, low=0.0,
           prev_close=100.0, ts=None, suspended=False):
    return QuoteSnapshot(
        code=code, change_pct=change_pct, price=price, volume_ratio=volume_ratio,
        high=high or price, low=low or price, prev_close=prev_close,
        ts=ts if ts is not None else time.time(), suspended=suspended,
    )


def _make_service(*, watchlist=None, quotes=None, klines=None, news=None,
                  explain=None, push=None):
    wl = MagicMock()
    wl.snapshot.return_value = watchlist or []
    quote_fn = MagicMock(side_effect=lambda code: (quotes or {}).get(code))
    kline_fn = MagicMock(side_effect=lambda code: (klines or {}).get(code, []))
    ns = news or MagicMock()
    if news is None:
        ns.fetch_telegraph.return_value = []
        ns.fetch_announcements.return_value = []
    ex = explain or MagicMock()
    if explain is None:
        ex.explain.return_value = ExplainResult(text="解释", source=ResultSource.TEMPLATE)
    pu = push or MagicMock()
    if push is None:
        pu.send.return_value = MagicMock(status="delivered", uuid="u")
    svc = AnomalyService(
        watchlist_service=wl,
        quote_fetcher=quote_fn,
        kline_fetcher=kline_fn,
        news_source=ns,
        explain_service=ex,
        push_service=pu,
    )
    return svc, pu, ex


# ── T010: scan basic ─────────────────────────────────────────────────────

def test_scan_detects_limit_up_for_main_board():
    svc, pu, ex = _make_service(
        watchlist=[{"code": "600519", "name": "贵州茅台", "is_holding": True}],
        quotes={"600519": _quote("600519", change_pct=10.0, price=1800.0)},
    )
    new = svc.scan_cycle()
    assert len(new) == 1
    assert new[0].anomaly_type is AnomalyType.LIMIT_UP


def test_scan_skips_suspended():
    svc, *_ = _make_service(
        watchlist=[{"code": "600519", "name": "贵州茅台"}],
        quotes={"600519": _quote("600519", change_pct=10.0, suspended=True)},
    )
    assert svc.scan_cycle() == []


def test_scan_skips_missing_quote():
    svc, *_ = _make_service(
        watchlist=[{"code": "600519", "name": "贵州茅台"}],
        quotes={},
    )
    assert svc.scan_cycle() == []


def test_scan_persistent_signal_not_renewed():
    svc, pu, _ = _make_service(
        watchlist=[{"code": "600519", "name": "贵州茅台"}],
        quotes={"600519": _quote("600519", change_pct=10.0)},
    )
    svc.scan_cycle()
    new2 = svc.scan_cycle()
    assert new2 == []


# ── T011: stale data guard ────────────────────────────────────────────────

def test_stale_quote_pauses_price_rules():
    svc, pu, _ = _make_service(
        watchlist=[{"code": "600519", "name": "贵州茅台"}],
        quotes={"600519": _quote("600519", change_pct=10.0, ts=time.time() - 600)},
    )
    new = svc.scan_cycle()
    assert new == []  # paused
    assert svc.last_cycle_paused is True


def test_stale_does_not_block_event_rules():
    ns = MagicMock()
    from app.models.explain import NewsItem
    ns.fetch_telegraph.return_value = [NewsItem(title="贵州茅台重大合同")]
    ns.fetch_announcements.return_value = []
    svc, pu, _ = _make_service(
        watchlist=[{"code": "600519", "name": "贵州茅台"}],
        quotes={"600519": _quote("600519", change_pct=10.0, ts=time.time() - 600)},
        news=ns,
    )
    new = svc.scan_cycle()
    assert any(s.anomaly_type is AnomalyType.EVENT for s in new)


# ── T012: push orchestration ──────────────────────────────────────────────

def test_push_called_with_holding_priority():
    from app.models.push import Priority
    svc, pu, ex = _make_service(
        watchlist=[{"code": "600519", "name": "贵州茅台", "is_holding": True}],
        quotes={"600519": _quote("600519", change_pct=10.0)},
    )
    svc.scan_cycle()
    assert pu.send.called
    sent = pu.send.call_args.args[0]
    assert sent.priority is Priority.holding
    assert sent.code == "600519"


def test_push_skipped_when_explain_fails_uses_bare_card():
    ex = MagicMock()
    ex.explain.side_effect = TimeoutError("LLM timeout")
    svc, pu, _ = _make_service(
        watchlist=[{"code": "600519", "name": "贵州茅台"}],
        quotes={"600519": _quote("600519", change_pct=10.0)},
        explain=ex,
    )
    svc.scan_cycle()
    assert pu.send.called  # bare card still sent
    sent = pu.send.call_args.args[0]
    # bare card has minimal content (no explain text inside elements)
    assert "贵州茅台" in str(sent.content)


def test_holdings_priority_before_watch():
    svc, pu, _ = _make_service(
        watchlist=[
            {"code": "000001", "name": "平安银行", "is_holding": False},
            {"code": "600519", "name": "贵州茅台", "is_holding": True},
        ],
        quotes={
            "000001": _quote("000001", change_pct=10.0),
            "600519": _quote("600519", change_pct=10.0),
        },
    )
    svc.scan_cycle()
    # First push should be holding
    first_req = pu.send.call_args_list[0].args[0]
    assert first_req.code == "600519"


def test_multi_rule_single_stock_merged_one_push():
    svc, pu, ex = _make_service(
        watchlist=[{"code": "600519", "name": "贵州茅台"}],
        quotes={"600519": _quote(
            "600519", change_pct=10.0, volume_ratio=4.0,
            high=110.0, low=100.0, prev_close=100.0,
        )},
    )
    svc.scan_cycle()
    # Same stock with multiple signals → one push, multi tags
    assert pu.send.call_count == 1
    sent_req = pu.send.call_args.args[0]
    # The single push carries combined tag info (anomaly_types in content)
    text_blob = str(sent_req.content)
    assert "limit_up" in text_blob or "涨停" in text_blob


def test_signal_passed_to_explain():
    svc, pu, ex = _make_service(
        watchlist=[{"code": "600519", "name": "贵州茅台"}],
        quotes={"600519": _quote("600519", change_pct=10.0, price=1800.0)},
    )
    svc.scan_cycle()
    assert ex.explain.called
    req = ex.explain.call_args.args[0]
    assert req.code == "600519"
    assert req.name == "贵州茅台"


def test_badge_exposed_after_scan():
    svc, *_ = _make_service(
        watchlist=[{"code": "600519", "name": "贵州茅台"}],
        quotes={"600519": _quote("600519", change_pct=10.0)},
    )
    svc.scan_cycle()
    badges = svc.current_badges()
    assert badges["600519"] == ["limit_up"]
