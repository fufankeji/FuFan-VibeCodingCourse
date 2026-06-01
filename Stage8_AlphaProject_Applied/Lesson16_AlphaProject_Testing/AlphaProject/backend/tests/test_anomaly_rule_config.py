"""T003 — rule_config: 规则开关 + 阈值覆盖读写.

[出参验证] 关闭某规则后该规则不参与扫描（通过 effective() 反映）.
"""
from app.anomaly.rule_config import RuleConfigStore
from app.models.anomaly import RuleConfig


def test_default_resolves_to_settings():
    store = RuleConfigStore()
    eff = store.effective()
    # All enabled by default
    assert eff.limit_enabled
    assert eff.volume_enabled
    assert eff.amplitude_enabled
    # Settings defaults filled in
    assert eff.amplitude_pct == 8.0
    assert eff.volume_ratio == 3.0
    assert eff.lookback_days == 60


def test_disable_volume_rule():
    store = RuleConfigStore()
    store.update(RuleConfig(volume_enabled=False))
    eff = store.effective()
    assert eff.volume_enabled is False
    assert eff.limit_enabled is True


def test_override_threshold():
    store = RuleConfigStore()
    store.update(RuleConfig(amplitude_pct=12.0))
    eff = store.effective()
    assert eff.amplitude_pct == 12.0
    assert eff.volume_ratio == 3.0  # untouched
