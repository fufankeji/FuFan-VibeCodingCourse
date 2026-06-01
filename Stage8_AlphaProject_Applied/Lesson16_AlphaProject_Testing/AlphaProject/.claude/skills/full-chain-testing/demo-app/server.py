#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 path-inventory toolkit authors.
#
# server.py — demo multi-feature app (stdlib only, guaranteed to run).
#
# Three features, on purpose containing EVERY edge type the toolkit must find:
#   feature A (FE)  : index.html -> button -> POST /api/place-order      (ui + http)
#   feature B (BE)  : /api/place-order writes a shared kv key + enqueues an async task
#                     (shared-key + async)
#   feature C (BE)  : a cron/scheduler thread reads that kv key and triggers a push
#                     to an observable stub (cron + cross-channel)
#
# The full journey: user clicks A -> B endpoint -> writes kv + async -> C picks it up
# on its tick -> pushes. Crosses A/B/C and contains ui+http+async+cron+shared-key+cross-channel.
#
# A tiny decorator-based router (@route) is used so knife2's static scanner can detect
# the routes the same way it detects FastAPI decorators.

from __future__ import annotations

import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from tracer import emit
from infra import kv_set, kv_get, TaskQueue, PushChannel

ORDER_KEY_PREFIX = "demo:order:"  # shared key literal (knife2 detects this)

QUEUE = TaskQueue()
PUSH = PushChannel()

# --- minimal decorator router (mimics FastAPI shape for the static scanner) ----------
_ROUTES: dict[tuple[str, str], callable] = {}


class app:  # noqa: N801 - intentionally lowercase to look like a FastAPI `app`
    @staticmethod
    def post(path):
        def deco(fn):
            _ROUTES[("POST", path)] = fn
            return fn
        return deco

    @staticmethod
    def get(path):
        def deco(fn):
            _ROUTES[("GET", path)] = fn
            return fn
        return deco


# --- feature B: order endpoint -------------------------------------------------------
@app.post("/api/place-order")
def place_order(body: dict, cid: str) -> dict:
    """feature B handler: write shared key + enqueue async task."""
    emit(cid, "route:POST /api/place-order", "handler:place_order", "call")
    order_id = body.get("order_id", "o-unknown")
    kv_set(f"{ORDER_KEY_PREFIX}{order_id}", json.dumps({"status": "pending", "cid": cid}),
           cid=cid, writer="handler:place_order")
    QUEUE.enqueue("order-confirm", {"order_id": order_id, "cid": cid},
                  cid=cid, producer="handler:place_order")
    return {"ok": True, "order_id": order_id, "cid": cid}


@app.get("/api/deliveries")
def deliveries(body: dict, cid: str) -> dict:
    """Observability endpoint so tests can assert the cross-channel push happened."""
    return {"deliveries": PUSH.all(), "kv": _kv_snapshot()}


def _kv_snapshot() -> dict:
    from infra import kv_all
    return kv_all()


# --- feature C: scheduler tick -------------------------------------------------------
class Scheduler:
    """feature C: periodic job that reads the shared key and triggers a push."""

    def __init__(self, interval: float = 0.5):
        self.interval = interval
        self._stop = threading.Event()
        self._seen: set[str] = set()
        self._t = threading.Thread(target=self._loop, daemon=True)

    def start(self):
        self._t.start()

    def stop(self):
        self._stop.set()

    def tick_once(self, cid_hint: str | None = None):
        """One scan: read pending orders from kv, push for new ones."""
        from infra import kv_all
        for key, raw in kv_all().items():
            if not key.startswith(ORDER_KEY_PREFIX) or key in self._seen:
                continue
            try:
                data = json.loads(raw)
            except Exception:
                continue
            cid = data.get("cid", cid_hint or "cron-tick")
            # cron read of the shared key
            kv_get(key, cid=cid, reader="job:order_sweep")
            emit(cid, "job:order_sweep", "handler:notify", "call")
            PUSH.send(target=key.removeprefix(ORDER_KEY_PREFIX),
                      message=f"order {key} confirmed", cid=cid, sender="handler:notify")
            self._seen.add(key)

    def _loop(self):
        emit("cron-boot", "scheduler", "job:order_sweep", "cron", op="register")
        while not self._stop.is_set():
            self.tick_once()
            time.sleep(self.interval)


SCHED = Scheduler()


# --- HTTP plumbing -------------------------------------------------------------------
INDEX_HTML_PATH = None  # set in main


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # quiet
        pass

    def _send(self, code, body, ctype="application/json"):
        data = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def _cid(self):
        # correlation id flows in from the FE (feature A) header, or we mint one
        return self.headers.get("X-Correlation-Id") or f"cid-{int(time.time()*1000)}"

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/", "/index.html"):
            with open(INDEX_HTML_PATH, encoding="utf-8") as fh:
                return self._send(200, fh.read(), "text/html; charset=utf-8")
        fn = _ROUTES.get(("GET", path))
        if fn:
            cid = self._cid()
            return self._send(200, json.dumps(fn({}, cid)))
        self._send(404, json.dumps({"error": "not found"}))

    def do_POST(self):
        path = urlparse(self.path).path
        fn = _ROUTES.get(("POST", path))
        if not fn:
            return self._send(404, json.dumps({"error": "not found"}))
        cid = self._cid()
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw or b"{}")
        except Exception:
            body = {}
        # feature A -> B http hop, confirmed at runtime
        emit(cid, "component:order-page", "route:POST /api/place-order", "http")
        result = fn(body, cid)
        self._send(200, json.dumps(result))


def main():
    global INDEX_HTML_PATH
    import argparse
    import os
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8799)
    ap.add_argument("--no-scheduler", action="store_true",
                    help="don't auto-start the cron loop (test drives tick_once manually)")
    args = ap.parse_args()
    INDEX_HTML_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.html")
    if not args.no_scheduler:
        SCHED.start()
    srv = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"demo-app listening on http://127.0.0.1:{args.port}  (scheduler={'on' if not args.no_scheduler else 'off'})", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
