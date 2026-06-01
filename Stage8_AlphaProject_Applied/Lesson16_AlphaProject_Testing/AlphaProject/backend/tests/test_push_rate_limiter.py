"""T007 — sliding window rate limiter + merge queue (FR-004, FR-005)."""

from app.push.rate_limiter import RateLimiter
from app.models.push import PushRequest, MsgType, Priority


def _r(code: str) -> PushRequest:
    return PushRequest(
        msg_type=MsgType.text, content={"text": f"v {code}"},
        priority=Priority.watch, code=code, signal="anomaly",
    )


def test_under_limit_sends_immediately():
    t = {"now": 1000.0}
    rl = RateLimiter(limit_per_min=70, clock=lambda: t["now"])
    decision = rl.acquire(_r("000001"))
    assert decision.allow_immediate is True


def test_when_near_limit_routes_to_merge_queue():
    t = {"now": 1000.0}
    rl = RateLimiter(limit_per_min=5, clock=lambda: t["now"])
    # consume the budget
    for i in range(5):
        d = rl.acquire(_r(f"S{i}"))
        assert d.allow_immediate is True
    # 6th request must be deferred to merge queue
    d = rl.acquire(_r("S5"))
    assert d.allow_immediate is False
    assert d.merge is True


def test_window_slides_after_60_seconds():
    t = {"now": 1000.0}
    rl = RateLimiter(limit_per_min=2, clock=lambda: t["now"])
    rl.acquire(_r("A"))
    rl.acquire(_r("B"))
    assert rl.acquire(_r("C")).allow_immediate is False
    t["now"] = 1061.0  # 61s later
    assert rl.acquire(_r("C")).allow_immediate is True


def test_drain_merge_queue_groups_up_to_cap_per_card():
    """25 条 → ≤3 张 (cap=10/card)."""
    t = {"now": 1000.0}
    rl = RateLimiter(limit_per_min=70, clock=lambda: t["now"], merge_cap=10)
    # Force merge by exhausting budget first
    rl2 = RateLimiter(limit_per_min=2, clock=lambda: t["now"], merge_cap=10)
    rl2.acquire(_r("A"))
    rl2.acquire(_r("B"))
    for i in range(25):
        rl2.acquire(_r(f"X{i}"))
    batches = rl2.drain_merge_queue()
    # 25 items → 3 batches (10, 10, 5) maximum
    assert len(batches) <= 3
    assert sum(len(b) for b in batches) == 25
    assert all(len(b) <= 10 for b in batches)


def test_overall_25_per_minute_scenario_respects_70_cap():
    """SC-002: 灌 25 条 → 不超 70/min."""
    t = {"now": 1000.0}
    rl = RateLimiter(limit_per_min=70, clock=lambda: t["now"], merge_cap=10)
    immediate = 0
    for i in range(25):
        d = rl.acquire(_r(f"S{i}"))
        if d.allow_immediate:
            immediate += 1
    assert immediate == 25  # all fit within 70/min budget
