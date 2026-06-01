"""G-04 · B-④.d · main.py lifespan background task 异常 observability

`_every(interval, fn)` 在生产中跑 purge_expired_soft_deletes 与 stock_svc.refresh。
若 fn 抛异常，task 必须 logger.exception + 继续下轮，不能因一次错误悄悄死亡。

风险级：P2（运维可观测性，告警级）
可追溯：F5 / 001 / lifespan tasks (T008 purge / T005 refresh)
"""

import asyncio
import logging

from app.main import _every


def test_every_continues_after_inner_exception(caplog):
    """Iteration N raising must not stop iteration N+1; failure must be logged."""
    call_count = 0

    def flaky() -> None:
        nonlocal call_count
        call_count += 1
        if call_count == 2:
            raise RuntimeError("simulated transient failure")

    async def runner():
        with caplog.at_level(logging.ERROR, logger="app.main"):
            task = asyncio.create_task(_every(0.01, flaky, fire_first=True))
            await asyncio.sleep(0.08)
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    asyncio.run(runner())

    assert call_count >= 3, f"task died after exception (only {call_count} calls)"
    assert any("Background task" in r.message for r in caplog.records), (
        "Background task must log the exception for ops visibility; "
        "silent retry breaks the only signal that the daily job is broken."
    )


def test_every_initial_failure_does_not_skip_loop(caplog):
    """fire_first=True raising must NOT propagate; loop still enters periodic mode."""
    call_count = 0

    def first_raises() -> None:
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise RuntimeError("first run blew up")

    async def runner():
        with caplog.at_level(logging.ERROR, logger="app.main"):
            task = asyncio.create_task(_every(0.01, first_raises, fire_first=True))
            await asyncio.sleep(0.05)
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    asyncio.run(runner())
    assert call_count >= 2, "loop must keep going after fire_first failure"
