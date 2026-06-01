"""T008/T009 — anomaly_state transition detection + cleanup on watchlist delete.

[出参验证]
- 持续涨停第二周期不报新
- 封板→打开→封回 第二次封报新
- 删股后该股不再产生异动/推送 (forget + subscribe to F5 events)
"""
from app.anomaly.anomaly_state import StateManager
from app.events import watchlist_events
from app.models.anomaly import AnomalyType, AnomalySignal


def _sig(code: str, t: AnomalyType) -> AnomalySignal:
    return AnomalySignal(code=code, anomaly_type=t, name="x")


def test_first_cycle_all_new():
    sm = StateManager()
    new = sm.evaluate("600519", [_sig("600519", AnomalyType.LIMIT_UP)])
    assert {s.anomaly_type for s in new} == {AnomalyType.LIMIT_UP}


def test_persisting_signal_not_renewed_second_cycle():
    sm = StateManager()
    sm.evaluate("600519", [_sig("600519", AnomalyType.LIMIT_UP)])
    new = sm.evaluate("600519", [_sig("600519", AnomalyType.LIMIT_UP)])
    assert new == []


def test_open_then_reseal_reported_again():
    sm = StateManager()
    sm.evaluate("600519", [_sig("600519", AnomalyType.LIMIT_UP)])
    sm.evaluate("600519", [])  # opened
    new = sm.evaluate("600519", [_sig("600519", AnomalyType.LIMIT_UP)])
    assert {s.anomaly_type for s in new} == {AnomalyType.LIMIT_UP}


def test_concurrent_rules_only_new_one_reported():
    sm = StateManager()
    sm.evaluate("600519", [_sig("600519", AnomalyType.LIMIT_UP)])
    new = sm.evaluate(
        "600519",
        [_sig("600519", AnomalyType.LIMIT_UP), _sig("600519", AnomalyType.VOLUME)],
    )
    assert {s.anomaly_type for s in new} == {AnomalyType.VOLUME}


def test_forget_on_delete_event():
    sm = StateManager()
    sm.evaluate("600519", [_sig("600519", AnomalyType.LIMIT_UP)])
    sm.subscribe_watchlist_events()
    try:
        watchlist_events.publish_removed("600519")
        # After cleanup, the previously-set state is gone
        assert sm.state.get("600519") == set()
        # And re-evaluating same signal counts it as new again
        new = sm.evaluate("600519", [_sig("600519", AnomalyType.LIMIT_UP)])
        assert {s.anomaly_type for s in new} == {AnomalyType.LIMIT_UP}
    finally:
        sm.unsubscribe_watchlist_events()


def test_all_badges_for_f1():
    sm = StateManager()
    sm.evaluate("600519", [_sig("600519", AnomalyType.LIMIT_UP)])
    sm.evaluate("000001", [_sig("000001", AnomalyType.BREAKOUT)])
    badges = sm.state.all_badges()
    assert badges["600519"] == ["limit_up"]
    assert badges["000001"] == ["breakout"]
