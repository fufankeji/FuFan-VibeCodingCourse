"""Sliding-window rate limiter + merge queue (002-T007).

FR-004: 全局令牌桶 (默认 70/min) 自我保护
FR-005: 接近上限时 deferred 请求进合并队列, drain 时按 cap (默认 10) 分批
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass
from typing import Callable

from app.models.push import PushRequest

Clock = Callable[[], float]


@dataclass
class Decision:
    allow_immediate: bool
    merge: bool = False


class RateLimiter:
    """Sliding 60s window + FIFO merge queue."""

    def __init__(
        self,
        limit_per_min: int = 70,
        clock: Clock = time.monotonic,
        merge_cap: int = 10,
    ) -> None:
        self._limit = limit_per_min
        self._clock = clock
        self._merge_cap = merge_cap
        self._sent_ts: deque[float] = deque()
        self._merge_queue: list[PushRequest] = []

    def _evict_expired(self) -> None:
        cutoff = self._clock() - 60.0
        while self._sent_ts and self._sent_ts[0] < cutoff:
            self._sent_ts.popleft()

    def _budget_left(self) -> int:
        self._evict_expired()
        return max(0, self._limit - len(self._sent_ts))

    def acquire(self, req: PushRequest) -> Decision:
        if self._budget_left() > 0:
            self._sent_ts.append(self._clock())
            return Decision(allow_immediate=True)
        # over budget — defer to merge queue
        self._merge_queue.append(req)
        return Decision(allow_immediate=False, merge=True)

    def drain_merge_queue(self) -> list[list[PushRequest]]:
        """Pop the queue, group into batches of ≤merge_cap. Caller sends each batch."""
        batches: list[list[PushRequest]] = []
        q = self._merge_queue
        self._merge_queue = []
        for i in range(0, len(q), self._merge_cap):
            batches.append(q[i : i + self._merge_cap])
        return batches

    def note_sent_batch(self, n: int) -> None:
        """Account n sent messages (batch counts as n against window)."""
        now = self._clock()
        for _ in range(n):
            self._sent_ts.append(now)

    @property
    def pending_count(self) -> int:
        return len(self._merge_queue)
