"""T002 — anomaly domain models.

[出参验证] 异动类型枚举与 F1 徽章 + F3 异动类型三方一致.
"""
import pytest


def test_anomaly_type_enum_matches_f3():
    from app.models.anomaly import AnomalyType
    from app.models.explain import AnomalyType as F3Type

    # The F2 enum must be a superset of (or equal to) what F3 understands
    # for the badge surface — limit_up / limit_down / breakout / breakdown / volume.
    for badge in (
        F3Type.LIMIT_UP,
        F3Type.LIMIT_DOWN,
        F3Type.BREAKOUT,
        F3Type.BREAKDOWN,
        F3Type.VOLUME,
    ):
        assert AnomalyType(badge.value) is not None

    # F2-only signals (event, amplitude) may exist but MUST not collide.
    assert AnomalyType.AMPLITUDE.value == "amplitude"
    assert AnomalyType.EVENT.value == "event"


def test_anomaly_signal_minimal():
    from app.models.anomaly import AnomalySignal, AnomalyType
    sig = AnomalySignal(
        code="600519",
        anomaly_type=AnomalyType.LIMIT_UP,
        price=1800.0,
        change_pct=10.0,
        is_holding=True,
    )
    assert sig.code == "600519"
    assert sig.is_holding is True


def test_rule_config_default_all_enabled():
    from app.models.anomaly import RuleConfig
    rc = RuleConfig()
    assert rc.limit_enabled is True
    assert rc.breakout_enabled is True
    assert rc.volume_enabled is True
    assert rc.amplitude_enabled is True
    assert rc.event_enabled is True


def test_anomaly_state_diff():
    from app.models.anomaly import AnomalyState, AnomalyType
    st = AnomalyState()
    st.set("600519", {AnomalyType.LIMIT_UP})
    new = st.diff("600519", {AnomalyType.LIMIT_UP, AnomalyType.VOLUME})
    assert new == {AnomalyType.VOLUME}
    # apply
    st.set("600519", {AnomalyType.LIMIT_UP, AnomalyType.VOLUME})
    assert st.get("600519") == {AnomalyType.LIMIT_UP, AnomalyType.VOLUME}
