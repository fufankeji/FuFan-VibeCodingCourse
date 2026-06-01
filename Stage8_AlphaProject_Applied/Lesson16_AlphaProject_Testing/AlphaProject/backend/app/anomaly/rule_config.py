"""T003 — 规则类开关 + 阈值覆盖读写.

In-memory store; settings 提供默认阈值（FR-013）。
"""

from __future__ import annotations

from app.config import settings
from app.models.anomaly import RuleConfig


class RuleConfigStore:
    """Holds current RuleConfig and resolves overrides against settings."""

    def __init__(self, initial: RuleConfig | None = None) -> None:
        self._cfg: RuleConfig = initial or RuleConfig()

    def current(self) -> RuleConfig:
        return self._cfg

    def update(self, cfg: RuleConfig) -> RuleConfig:
        self._cfg = cfg
        return self._cfg

    def patch(self, **fields) -> RuleConfig:
        self._cfg = self._cfg.model_copy(update=fields)
        return self._cfg

    def effective(self) -> RuleConfig:
        """Resolve None thresholds against settings defaults."""
        c = self._cfg
        return c.model_copy(
            update={
                "amplitude_pct": c.amplitude_pct
                if c.amplitude_pct is not None
                else settings.ANOMALY_AMPLITUDE_PCT,
                "volume_ratio": c.volume_ratio
                if c.volume_ratio is not None
                else settings.ANOMALY_VOLUME_RATIO,
                "lookback_days": c.lookback_days
                if c.lookback_days is not None
                else settings.ANOMALY_LOOKBACK_DAYS,
            }
        )


_default_store = RuleConfigStore()


def get_default_store() -> RuleConfigStore:
    return _default_store
