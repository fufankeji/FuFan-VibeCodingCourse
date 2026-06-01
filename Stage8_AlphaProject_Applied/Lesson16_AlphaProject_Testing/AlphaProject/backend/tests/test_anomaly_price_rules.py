"""T004-T006 — price/volume rules (纯函数).

[出参验证]
- 茅台涨幅≥10% → 涨停; ST 股≥5% → 涨停; 科创 ≥20% → 涨停
- 现价 > 近 60 日最高 → 突破; 跌破新低 → breakdown
- 量比 3.5 倍 → 量能信号; 振幅 9% → 振幅信号
"""
from app.anomaly.price_rules import (
    board_kind,
    BoardKind,
    detect_limit,
    detect_breakout_breakdown,
    detect_volume,
    detect_amplitude,
)
from app.models.anomaly import AnomalyType


# ───────── T004 — board classification + limit ─────────

def test_board_kind_main():
    assert board_kind("600519", name="贵州茅台") is BoardKind.MAIN  # 主板


def test_board_kind_st():
    assert board_kind("600001", name="*ST 公司") is BoardKind.ST
    assert board_kind("600001", name="ST 公司") is BoardKind.ST


def test_board_kind_chinext():
    assert board_kind("300750", name="宁德时代") is BoardKind.STARTUP  # 创业板


def test_board_kind_star():
    assert board_kind("688981", name="中芯国际") is BoardKind.STARTUP  # 科创板


def test_limit_up_main():
    sig = detect_limit(code="600519", name="贵州茅台", change_pct=10.0)
    assert sig is not None and sig.anomaly_type is AnomalyType.LIMIT_UP


def test_limit_up_st():
    sig = detect_limit(code="600001", name="*ST 公司", change_pct=5.0)
    assert sig is not None and sig.anomaly_type is AnomalyType.LIMIT_UP


def test_limit_up_star():
    sig = detect_limit(code="688981", name="中芯国际", change_pct=20.0)
    assert sig is not None and sig.anomaly_type is AnomalyType.LIMIT_UP


def test_limit_down_main():
    sig = detect_limit(code="600519", name="贵州茅台", change_pct=-10.0)
    assert sig is not None and sig.anomaly_type is AnomalyType.LIMIT_DOWN


def test_limit_below_threshold_returns_none():
    assert detect_limit(code="600519", name="贵州茅台", change_pct=9.5) is None


# ───────── T005 — breakout / breakdown ─────────

def test_breakout_above_60d_high():
    closes = [100.0 + i * 0.1 for i in range(60)]  # max ~ 105.9
    sig = detect_breakout_breakdown(code="600519", name="贵州茅台", price=110.0, recent_closes=closes)
    assert sig is not None and sig.anomaly_type is AnomalyType.BREAKOUT


def test_breakdown_below_60d_low():
    closes = [100.0 + i * 0.1 for i in range(60)]  # min 100.0
    sig = detect_breakout_breakdown(code="600519", name="贵州茅台", price=99.0, recent_closes=closes)
    assert sig is not None and sig.anomaly_type is AnomalyType.BREAKDOWN


def test_neither_breakout_nor_breakdown():
    closes = [100.0 + i * 0.1 for i in range(60)]
    assert detect_breakout_breakdown(code="600519", name="贵州茅台", price=103.0, recent_closes=closes) is None


def test_breakout_new_stock_short_history():
    closes = [50.0, 51.0, 52.0]
    sig = detect_breakout_breakdown(code="688999", name="新股", price=60.0, recent_closes=closes)
    assert sig is not None and sig.anomaly_type is AnomalyType.BREAKOUT


def test_breakout_empty_history_skipped():
    assert detect_breakout_breakdown(code="600519", name="x", price=10.0, recent_closes=[]) is None


# ───────── T006 — volume + amplitude ─────────

def test_volume_anomaly_triggered():
    sig = detect_volume(code="600519", name="贵州茅台", volume_ratio=3.5, threshold=3.0)
    assert sig is not None and sig.anomaly_type is AnomalyType.VOLUME
    assert sig.volume_ratio == 3.5


def test_volume_anomaly_below_threshold():
    assert detect_volume(code="600519", name="贵州茅台", volume_ratio=2.9, threshold=3.0) is None


def test_amplitude_anomaly_triggered():
    # amplitude = (high-low)/prev_close * 100
    sig = detect_amplitude(code="600519", name="贵州茅台", high=110.0, low=100.0, prev_close=110.0, threshold=8.0)
    # amplitude ≈ 9.09% > 8 → triggered
    assert sig is not None and sig.anomaly_type is AnomalyType.AMPLITUDE


def test_amplitude_below_threshold():
    assert detect_amplitude(code="600519", name="x", high=101.0, low=100.0, prev_close=100.0, threshold=8.0) is None


def test_amplitude_invalid_prev_close():
    assert detect_amplitude(code="x", name="x", high=10, low=9, prev_close=0, threshold=8.0) is None
