"""T004-T006 — 价格/量能规则（纯函数）.

每个 detect_* 函数：输入行情参数 + 阈值 → Optional[AnomalySignal].
不依赖任何 service / IO，便于单测与组合.
"""

from __future__ import annotations

from enum import Enum

from app.config import settings
from app.models.anomaly import AnomalySignal, AnomalyType


class BoardKind(str, Enum):
    MAIN = "main"
    STARTUP = "startup"   # 创业板 30* + 科创板 688*
    ST = "st"


def board_kind(code: str, *, name: str = "") -> BoardKind:
    """判板块（结合代码前缀 + 名称含 ST 标记）。"""
    if name and ("ST" in name.upper()):
        return BoardKind.ST
    if code.startswith("300") or code.startswith("688"):
        return BoardKind.STARTUP
    return BoardKind.MAIN


def _limit_pct(kind: BoardKind) -> float:
    if kind is BoardKind.ST:
        return settings.ANOMALY_LIMIT_ST
    if kind is BoardKind.STARTUP:
        return settings.ANOMALY_LIMIT_STARTUP
    return settings.ANOMALY_LIMIT_MAIN


# ── T004: limit up / limit down ────────────────────────────────────────
def detect_limit(
    *, code: str, name: str, change_pct: float, price: float = 0.0, is_holding: bool = False
) -> AnomalySignal | None:
    threshold = _limit_pct(board_kind(code, name=name))
    if change_pct >= threshold:
        return AnomalySignal(
            code=code, name=name, anomaly_type=AnomalyType.LIMIT_UP,
            price=price, change_pct=change_pct, is_holding=is_holding,
        )
    if change_pct <= -threshold:
        return AnomalySignal(
            code=code, name=name, anomaly_type=AnomalyType.LIMIT_DOWN,
            price=price, change_pct=change_pct, is_holding=is_holding,
        )
    return None


# ── T005: breakout / breakdown ─────────────────────────────────────────
def detect_breakout_breakdown(
    *, code: str, name: str, price: float, recent_closes: list[float],
    is_holding: bool = False,
) -> AnomalySignal | None:
    if not recent_closes or price <= 0:
        return None
    hi = max(recent_closes)
    lo = min(recent_closes)
    if price > hi:
        return AnomalySignal(
            code=code, name=name, anomaly_type=AnomalyType.BREAKOUT,
            price=price, is_holding=is_holding,
        )
    if price < lo:
        return AnomalySignal(
            code=code, name=name, anomaly_type=AnomalyType.BREAKDOWN,
            price=price, is_holding=is_holding,
        )
    return None


# ── T006: volume anomaly ───────────────────────────────────────────────
def detect_volume(
    *, code: str, name: str, volume_ratio: float, threshold: float,
    price: float = 0.0, is_holding: bool = False,
) -> AnomalySignal | None:
    if volume_ratio <= threshold:
        return None
    return AnomalySignal(
        code=code, name=name, anomaly_type=AnomalyType.VOLUME,
        price=price, volume_ratio=volume_ratio, is_holding=is_holding,
    )


# ── T006: amplitude ────────────────────────────────────────────────────
def detect_amplitude(
    *, code: str, name: str, high: float, low: float, prev_close: float,
    threshold: float, is_holding: bool = False,
) -> AnomalySignal | None:
    if prev_close <= 0 or high < low:
        return None
    amp = (high - low) / prev_close * 100.0
    if amp <= threshold:
        return None
    return AnomalySignal(
        code=code, name=name, anomaly_type=AnomalyType.AMPLITUDE,
        price=high, change_pct=amp, is_holding=is_holding,
    )


__all__ = [
    "BoardKind",
    "board_kind",
    "detect_limit",
    "detect_breakout_breakdown",
    "detect_volume",
    "detect_amplitude",
]
