"""GAP G1 — stale-quote 300s boundary (FR-009 韧性/时钟).

Traceability: feature=005, gap=G1, severity=P2
"""
import time
from unittest.mock import MagicMock

from app.config import settings
from app.models.explain import ExplainResult, ResultSource
from app.services.anomaly_service import AnomalyService, QuoteSnapshot


_EPOCH = 1_700_000_000.0  # 2023-11-14, used as the fake quote timestamp


def _build(now_value):
    """Service with injected fake clock returning a fixed wall-time."""
    wl = MagicMock()
    wl.snapshot.return_value = [{"code": "600519", "name": "贵州茅台"}]
    q = QuoteSnapshot(
        code="600519", change_pct=10.0, price=1800.0, volume_ratio=1.0,
        high=1800, low=1700, prev_close=1700, ts=_EPOCH, suspended=False,
    )
    push = MagicMock()
    ex = MagicMock()
    ex.explain.return_value = ExplainResult(text="t", source=ResultSource.TEMPLATE)
    return AnomalyService(
        watchlist_service=wl,
        quote_fetcher=lambda c: q if c == "600519" else None,
        kline_fetcher=lambda c: [],
        news_source=MagicMock(fetch_telegraph=lambda: [], fetch_announcements=lambda c: []),
        explain_service=ex,
        push_service=push,
        clock=lambda: now_value,
    ), push, q


def test_just_inside_threshold_not_paused():
    # quote ts = 0, clock = ANOMALY_DATA_STALE_S (300) — diff == 300 (NOT >)
    svc, push, q = _build(now_value=_EPOCH + float(settings.ANOMALY_DATA_STALE_S))
    new = svc.scan_cycle()
    # NOT paused → limit_up should be detected
    assert svc.last_cycle_paused is False
    assert any(s.anomaly_type.value == "limit_up" for s in new)


def test_just_outside_threshold_paused():
    # diff = 300 + 1 → stale → paused
    svc, push, q = _build(now_value=_EPOCH + float(settings.ANOMALY_DATA_STALE_S) + 1.0)
    svc.scan_cycle()
    assert svc.last_cycle_paused is True
    push.send.assert_not_called()
