"""T016 — F2 integration scenarios (SC-001 ~ SC-006).

Covers transition detection (no missed / no double reports), priority,
stale-data pause, badge consistency, delete cleanup.
"""
import time
from unittest.mock import MagicMock

from app.models.anomaly import AnomalyType
from app.models.explain import ExplainResult, NewsItem, ResultSource
from app.models.push import Priority
from app.events import watchlist_events
from app.services.anomaly_service import AnomalyService, QuoteSnapshot


def _quote(code, change_pct=0.0, price=100.0, ts=None, suspended=False, volume_ratio=1.0):
    return QuoteSnapshot(
        code=code, change_pct=change_pct, price=price, volume_ratio=volume_ratio,
        high=price, low=price, prev_close=100.0,
        ts=ts if ts is not None else time.time(), suspended=suspended,
    )


def _svc(watchlist, quotes, *, news=None, explain=None, push=None):
    wl = MagicMock(); wl.snapshot.return_value = watchlist
    qfn = MagicMock(side_effect=lambda c: quotes.get(c))
    kfn = MagicMock(return_value=[])
    ns = news or MagicMock()
    if news is None:
        ns.fetch_telegraph.return_value = []
        ns.fetch_announcements.return_value = []
    ex = explain or MagicMock()
    if explain is None:
        ex.explain.return_value = ExplainResult(text="t", source=ResultSource.TEMPLATE)
    pu = push or MagicMock()
    if push is None:
        pu.send.return_value = MagicMock()
    return AnomalyService(
        watchlist_service=wl, quote_fetcher=qfn, kline_fetcher=kfn,
        news_source=ns, explain_service=ex, push_service=pu,
    ), pu, ex


def test_sc001_detection_in_single_cycle():
    """SC-001: 异动从发生到检测 ≤ 60s (1 cycle)."""
    svc, pu, _ = _svc(
        [{"code": "600519", "name": "贵州茅台"}],
        {"600519": _quote("600519", change_pct=10.0, price=1800.0)},
    )
    new = svc.scan_cycle()
    assert any(s.anomaly_type is AnomalyType.LIMIT_UP for s in new)
    assert pu.send.called  # F6 invoked same cycle


def test_sc003_no_missed_no_double_through_transitions():
    """SC-003: 封板→打开→封回 — 第二次封报新；持续不报新."""
    svc, pu, _ = _svc(
        [{"code": "600519", "name": "贵州茅台"}],
        {"600519": _quote("600519", change_pct=10.0)},
    )
    # cycle 1: sealed
    n1 = svc.scan_cycle()
    assert any(s.anomaly_type is AnomalyType.LIMIT_UP for s in n1)
    assert pu.send.call_count == 1
    # cycle 2: still sealed → no new
    svc.scan_cycle()
    assert pu.send.call_count == 1
    # cycle 3: opened
    svc.quote = MagicMock(side_effect=lambda c: _quote(c, change_pct=8.0))
    svc.scan_cycle()
    assert pu.send.call_count == 1
    # cycle 4: re-sealed
    svc.quote = MagicMock(side_effect=lambda c: _quote(c, change_pct=10.0))
    svc.scan_cycle()
    assert pu.send.call_count == 2  # new push fired


def test_sc004_holding_zero_miss():
    """SC-004: 持仓股推送优先级最高."""
    svc, pu, _ = _svc(
        [
            {"code": "000001", "name": "平安银行", "is_holding": False},
            {"code": "600519", "name": "贵州茅台", "is_holding": True},
        ],
        {
            "000001": _quote("000001", change_pct=10.0),
            "600519": _quote("600519", change_pct=10.0),
        },
    )
    svc.scan_cycle()
    first = pu.send.call_args_list[0].args[0]
    assert first.code == "600519"
    assert first.priority is Priority.holding


def test_sc005_stale_data_pauses_no_false_positive():
    """SC-005: 数据延迟 > 5min → 暂停扫描."""
    svc, pu, _ = _svc(
        [{"code": "600519", "name": "贵州茅台"}],
        {"600519": _quote("600519", change_pct=10.0, ts=time.time() - 600)},
    )
    new = svc.scan_cycle()
    assert new == []
    assert svc.last_cycle_paused is True
    pu.send.assert_not_called()


def test_sc006_badge_state_consistency():
    """SC-006: F1 徽章 ↔ F2 state 一致."""
    svc, _, _ = _svc(
        [{"code": "600519", "name": "贵州茅台"}],
        {"600519": _quote("600519", change_pct=10.0)},
    )
    svc.scan_cycle()
    assert svc.current_badges() == {"600519": ["limit_up"]}


def test_delete_cleanup_via_watchlist_event():
    """FR-010: 删股后 anomaly_state 清理，下周期重判时算新异动."""
    svc, pu, _ = _svc(
        [{"code": "600519", "name": "贵州茅台"}],
        {"600519": _quote("600519", change_pct=10.0)},
    )
    svc.sm.subscribe_watchlist_events()
    try:
        svc.scan_cycle()
        assert pu.send.call_count == 1
        watchlist_events.publish_removed("600519")
        # Re-add cycle → state was wiped, so signal becomes new again
        svc.scan_cycle()
        assert pu.send.call_count == 2
    finally:
        svc.sm.unsubscribe_watchlist_events()


def test_event_rule_with_news_match():
    ns = MagicMock()
    ns.fetch_telegraph.return_value = [NewsItem(title="贵州茅台一季度业绩快报")]
    ns.fetch_announcements.return_value = []
    svc, pu, _ = _svc(
        [{"code": "600519", "name": "贵州茅台"}],
        {"600519": _quote("600519", change_pct=2.0)},  # no price anomaly
        news=ns,
    )
    new = svc.scan_cycle()
    assert any(s.anomaly_type is AnomalyType.EVENT for s in new)
    assert pu.send.call_count == 1
