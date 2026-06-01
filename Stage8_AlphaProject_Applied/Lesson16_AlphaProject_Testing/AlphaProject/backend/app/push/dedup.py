"""Dedup (002-T006).

FR-006: code+signal 5 分钟内去重
FR-007: 持仓股 (priority=holding) 绕过 dedup
FR-016: 同一逻辑消息 (重试) 复用同一 uuid (SDK 幂等键)
"""

from __future__ import annotations

import hashlib
import time
from typing import Callable

from app.models.push import Priority, PushRequest

Clock = Callable[[], float]


def uuid_for(req: PushRequest) -> str:
    """Stable uuid for a logical PushRequest (FR-016).

    Determined by (code, signal, msg_type, content). Same logical message
    → same uuid → SDK-level idempotency across our retries.
    """
    h = hashlib.sha256()
    h.update(str(req.code or "").encode())
    h.update(b"|")
    h.update(str(req.signal or "").encode())
    h.update(b"|")
    h.update(req.msg_type.value.encode())
    h.update(b"|")
    # content order-stable: use sorted-key JSON
    import json as _json
    h.update(_json.dumps(req.content, sort_keys=True, ensure_ascii=False).encode())
    return h.hexdigest()[:32]


class Deduper:
    """In-memory TTL dedup. Single-process MVP — no Redis needed (plan)."""

    def __init__(self, ttl_seconds: int = 300, clock: Clock = time.monotonic) -> None:
        self._ttl = ttl_seconds
        self._clock = clock
        self._last_sent: dict[str, float] = {}  # key -> ts

    @staticmethod
    def _key(req: PushRequest) -> str | None:
        if not req.code or not req.signal:
            return None
        return f"{req.code}|{req.signal}"

    def is_duplicate(self, req: PushRequest) -> bool:
        # holding 永不视为重复 (FR-007)
        if req.priority is Priority.holding:
            return False
        k = self._key(req)
        if k is None:
            return False
        ts = self._last_sent.get(k)
        if ts is None:
            return False
        return (self._clock() - ts) <= self._ttl

    def mark_sent(self, req: PushRequest) -> None:
        # holding 不污染 dedup 表 (它的"已发"对其它消息无去重意义)
        if req.priority is Priority.holding:
            return
        k = self._key(req)
        if k is None:
            return
        self._last_sent[k] = self._clock()
