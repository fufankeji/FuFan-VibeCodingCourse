"""F2 异动检测 · 数据模型 (005-T002).

spec §5 Key Entities — AnomalyRule / AnomalySignal / AnomalyState / RuleConfig.

异动类型枚举与 F3 (`models.explain.AnomalyType`) 在 limit_up / limit_down /
breakout / breakdown / volume 上 **逐值对齐**；F2 额外提供 amplitude / event
（不进 F3 解释，进 F6 推送时 anomaly_type 字段降级为 'volume' 或交由 F3 模板兜底）。
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class AnomalyType(str, Enum):
    LIMIT_UP = "limit_up"
    LIMIT_DOWN = "limit_down"
    BREAKOUT = "breakout"
    BREAKDOWN = "breakdown"
    VOLUME = "volume"
    AMPLITUDE = "amplitude"   # F2 only
    EVENT = "event"           # F2 only (news / announcement)


class RuleKind(str, Enum):
    PRICE = "price"
    VOLUME = "volume"
    EVENT = "event"


class AnomalySignal(BaseModel):
    """一次命中结果."""

    code: str
    anomaly_type: AnomalyType
    price: float = 0.0
    change_pct: float = 0.0
    volume_ratio: float | None = None
    is_holding: bool = False
    name: str | None = None
    # 事件类专用
    event_title: str | None = None


class RuleConfig(BaseModel):
    """规则类开关 + 阈值覆盖.

    阈值未设置时回落到 settings.ANOMALY_* 默认值（rule_config.py 负责合成）。
    """

    limit_enabled: bool = True
    breakout_enabled: bool = True
    volume_enabled: bool = True
    amplitude_enabled: bool = True
    event_enabled: bool = True

    # 可选覆盖（None ⇒ 用 settings 默认）
    amplitude_pct: float | None = None
    volume_ratio: float | None = None
    lookback_days: int | None = None


class AnomalyState:
    """Per-stock 当前异动集合 + 转换检测.

    内存数据结构（单进程）。`diff(code, fresh)` 返回 fresh - prev_state（新异动）；
    `set(code, fresh)` 替换当前态。删除股调 `forget(code)`。
    """

    def __init__(self) -> None:
        self._cur: dict[str, set[AnomalyType]] = {}

    def get(self, code: str) -> set[AnomalyType]:
        return set(self._cur.get(code, set()))

    def set(self, code: str, fresh: set[AnomalyType]) -> None:
        self._cur[code] = set(fresh)

    def diff(self, code: str, fresh: set[AnomalyType]) -> set[AnomalyType]:
        prev = self._cur.get(code, set())
        return set(fresh) - set(prev)

    def forget(self, code: str) -> None:
        self._cur.pop(code, None)

    def all_badges(self) -> dict[str, list[str]]:
        """For F1 badge endpoint (FR-007)."""
        return {c: sorted(t.value for t in s) for c, s in self._cur.items() if s}


class AnomalyRule(BaseModel):
    """规则定义元数据 (主要用于 API 暴露)."""

    name: str
    kind: RuleKind
    enabled: bool = True
    desc: str = ""


__all__ = [
    "AnomalyType",
    "AnomalySignal",
    "RuleKind",
    "RuleConfig",
    "AnomalyState",
    "AnomalyRule",
]
