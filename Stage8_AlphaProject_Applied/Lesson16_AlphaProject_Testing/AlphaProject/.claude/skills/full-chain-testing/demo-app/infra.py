# SPDX-License-Identifier: MIT
# Copyright (c) 2026 path-inventory toolkit authors.
#
# infra.py — minimal shared infrastructure for the demo (no external services).
#   - KV: an in-memory key/value store standing in for Redis (a "shared key" surface).
#   - TaskQueue: an in-process async worker thread (the "async" hop).
#   - PushChannel: an observable stub that records "deliveries" (the "cross-channel" hop).
# Each surface emits trace events so knife3 can confirm the runtime edges.

from __future__ import annotations

import queue
import threading

from tracer import emit

# Redis-shaped shared key store. The literal prefix "demo:order:" is what knife2
# detects statically as a shared-key.
_KV: dict[str, str] = {}
_KV_LOCK = threading.Lock()


def kv_set(key: str, value: str, cid: str, writer: str) -> None:
    with _KV_LOCK:
        _KV[key] = value
    emit(cid, writer, f"datastore:kv:{key.split(':')[0]}", "shared-key", op="set", key=key)


def kv_get(key: str, cid: str, reader: str) -> str | None:
    with _KV_LOCK:
        v = _KV.get(key)
    emit(cid, f"datastore:kv:{key.split(':')[0]}", reader, "shared-key", op="get", key=key, hit=v is not None)
    return v


def kv_all() -> dict[str, str]:
    with _KV_LOCK:
        return dict(_KV)


class TaskQueue:
    """A single-worker async queue. Enqueue from the request thread (async hop),
    the worker drains it off-thread."""

    def __init__(self) -> None:
        self.q: queue.Queue = queue.Queue()
        self._t = threading.Thread(target=self._run, daemon=True)
        self._t.start()

    def enqueue(self, name: str, payload: dict, cid: str, producer: str) -> None:
        emit(cid, producer, f"queue:{name}", "async", op="enqueue")
        self.q.put((name, payload, cid))

    def _run(self) -> None:
        while True:
            name, payload, cid = self.q.get()
            # Worker consumes; record the async delivery into the worker span.
            emit(cid, f"queue:{name}", f"worker:{name}", "async", op="consume")
            self.q.task_done()


class PushChannel:
    """Observable cross-channel delivery stub. Records every push so tests/knife3
    can assert a delivery happened."""

    def __init__(self) -> None:
        self.deliveries: list[dict] = []
        self._lock = threading.Lock()

    def send(self, target: str, message: str, cid: str, sender: str) -> dict:
        rec = {"target": target, "message": message, "cid": cid}
        with self._lock:
            self.deliveries.append(rec)
        emit(cid, sender, "external:push-channel", "cross-channel", target=target)
        return rec

    def all(self) -> list[dict]:
        with self._lock:
            return list(self.deliveries)
