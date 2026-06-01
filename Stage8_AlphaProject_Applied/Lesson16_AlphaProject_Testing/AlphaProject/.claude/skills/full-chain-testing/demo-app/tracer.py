# SPDX-License-Identifier: MIT
# Copyright (c) 2026 path-inventory toolkit authors.
#
# tracer.py — clean-room correlation-id tracer for the demo app.
#
# This is a deliberately tiny, dependency-free tracing primitive (NOT OpenTelemetry):
# a process-wide append-only event log where every event carries a correlation id
# (cid) plus the source/target span names. knife3 reads this log to reconstruct
# *runtime-confirmed* edges. The idea (correlation-id + structured events) is common
# industry practice and not anyone's copyrighted code.

from __future__ import annotations

import json
import os
import threading
import time

_LOCK = threading.Lock()
_LOG_PATH = os.environ.get("DEMO_TRACE_LOG",
                           os.path.join(os.path.dirname(os.path.abspath(__file__)), "trace.log"))


def reset_log(path: str | None = None) -> str:
    global _LOG_PATH
    if path:
        _LOG_PATH = path
    with _LOCK:
        open(_LOG_PATH, "w").close()
    return _LOG_PATH


# map a span name to the demo feature that owns it (A=FE, B=order BE, C=scheduler BE)
def _feature_of(span: str) -> str:
    if span.startswith("component:order-page"):
        return "A"
    if span.startswith(("route:POST /api/place-order", "handler:place_order",
                        "queue:", "worker:", "datastore:")):
        return "B"
    if span.startswith(("scheduler", "job:order_sweep", "handler:notify", "external:")):
        return "C"
    return "demo"


def emit(cid: str, frm: str, to: str, edge_type: str, **extra) -> None:
    """Record one runtime hop. frm/to are span names (node ids), edge_type matches schema."""
    rec = {
        "ts": round(time.time(), 6),
        "cid": cid,
        "from": frm,
        "to": to,
        "edge_type": edge_type,
        "span": f"{cid}:{frm}->{to}",
        "feature_from": _feature_of(frm),
        "feature_to": _feature_of(to),
    }
    rec.update(extra)
    with _LOCK:
        with open(_LOG_PATH, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")


def log_path() -> str:
    return _LOG_PATH
