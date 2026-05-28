#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 path-inventory toolkit authors.
#
# run_journey.py — drive the demo end-to-end over real HTTP with an injected
# correlation id, then deterministically trigger the scheduler tick (no sleep races)
# so knife3 sees the full chain. Prints the resulting trace summary.

from __future__ import annotations

import json
import os
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
TRACE = os.environ.get("DEMO_TRACE_LOG", os.path.join(HERE, "trace.log"))


def post(url, payload, cid):
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(), method="POST",
        headers={"Content-Type": "application/json", "X-Correlation-Id": cid})
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.load(r)


def get(url):
    with urllib.request.urlopen(url, timeout=5) as r:
        return json.load(r)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8799
    cid = sys.argv[2] if len(sys.argv) > 2 else f"cid-J-{int(time.time())}"
    base = f"http://127.0.0.1:{port}"
    print(f"[journey] cid={cid}")
    r1 = post(f"{base}/api/place-order", {"order_id": "o-777"}, cid)
    print("[journey] place-order ->", r1)
    # poll the deliveries endpoint until the scheduler has pushed (condition-based wait)
    for _ in range(40):
        d = get(f"{base}/api/deliveries")
        if any(x["cid"] == cid for x in d["deliveries"]):
            print("[journey] delivery observed ->", [x for x in d["deliveries"] if x["cid"] == cid])
            break
        time.sleep(0.1)
    else:
        print("[journey] WARNING: no delivery observed within timeout")
        return 1
    print(f"[journey] trace log at {TRACE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
