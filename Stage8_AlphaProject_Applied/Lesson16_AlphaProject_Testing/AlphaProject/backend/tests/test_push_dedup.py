"""T006 — dedup: code+signal 5min TTL, holding bypass, uuid stable per logical msg."""

from app.push.dedup import Deduper
from app.models.push import PushRequest, MsgType, Priority


def _req(code="600519", signal="limit_up", priority=Priority.watch):
    return PushRequest(
        msg_type=MsgType.text, content={"text": "x"},
        priority=priority, code=code, signal=signal,
    )


def test_first_call_not_deduped():
    d = Deduper(ttl_seconds=300, clock=lambda: 0.0)
    assert d.is_duplicate(_req()) is False


def test_same_key_within_window_is_duped():
    t = {"now": 0.0}
    d = Deduper(ttl_seconds=300, clock=lambda: t["now"])
    d.mark_sent(_req())
    t["now"] = 100.0
    assert d.is_duplicate(_req()) is True


def test_same_key_after_window_not_duped():
    t = {"now": 0.0}
    d = Deduper(ttl_seconds=300, clock=lambda: t["now"])
    d.mark_sent(_req())
    t["now"] = 301.0
    assert d.is_duplicate(_req()) is False


def test_different_signal_not_duped():
    d = Deduper(ttl_seconds=300, clock=lambda: 0.0)
    d.mark_sent(_req(signal="limit_up"))
    assert d.is_duplicate(_req(signal="breakthrough")) is False


def test_holding_bypasses_dedup():
    """FR-007: 持仓股绕过 dedup."""
    d = Deduper(ttl_seconds=300, clock=lambda: 0.0)
    d.mark_sent(_req(priority=Priority.holding))
    # even same key, holding always passes
    assert d.is_duplicate(_req(priority=Priority.holding)) is False


def test_request_without_code_or_signal_never_deduped():
    """简报/系统通知 没有 code+signal → 不参与 dedup."""
    d = Deduper(ttl_seconds=300, clock=lambda: 0.0)
    req = PushRequest(
        msg_type=MsgType.text, content={"text": "morning brief"},
        priority=Priority.system,
    )
    d.mark_sent(req)
    assert d.is_duplicate(req) is False


def test_uuid_for_request_stable_across_calls():
    """FR-016: same logical PushRequest → same uuid (重试复用)."""
    from app.push.dedup import uuid_for
    req = _req()
    u1 = uuid_for(req)
    u2 = uuid_for(req)
    assert u1 == u2
    assert len(u1) >= 16


def test_uuid_differs_for_different_requests():
    from app.push.dedup import uuid_for
    u1 = uuid_for(_req(code="600519"))
    u2 = uuid_for(_req(code="000001"))
    assert u1 != u2
