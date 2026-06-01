#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 path-inventory toolkit authors.
#
# knife5_e2e.py — RED E2E SKELETON GENERATOR.
#
# Picks one journey from a path-inventory.json (default: highest-priority, longest) and
# emits a runnable-shaped E2E test SKELETON for the detected stack. The skeleton:
#   - asserts the journey end-to-end (start hop -> ... -> terminal hop),
#   - uses CONDITION-BASED waits (poll-until / expect) and explicitly forbids sleep(),
#   - starts RED: the final assertion is left to fail until the feature is wired,
#   - embeds the journey's edge provenance as comments so a human can trace each hop.
#
# Stacks supported: python (pytest, http/poll style) and node (Playwright-style .spec).
# The generator is deterministic; it does not invent hops not present in the journey.

from __future__ import annotations

import argparse
import json
import os
import sys


def pick_journey(inv: dict, jid: str | None) -> dict:
    journeys = inv.get("journeys", [])
    if not journeys:
        raise SystemExit("no journeys in inventory; run knife4 first")
    if jid:
        for j in journeys:
            if j["id"] == jid:
                return j
        raise SystemExit(f"journey {jid} not found")
    # default: P0 first, then longest
    order = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}
    return sorted(journeys, key=lambda j: (order.get(j["p_level"], 9), -len(j["edge_ids"])))[0]


def edge_lookup(inv: dict) -> dict:
    return {e["id"]: e for e in inv.get("edges", [])}


def hop_comments(journey: dict, edges: dict) -> list[str]:
    out = []
    for eid in journey["edge_ids"]:
        e = edges.get(eid, {})
        prov = e.get("provenance", {})
        loc = (f"{prov.get('file')}:{prov.get('line')}" if prov.get("file")
               else prov.get("span", "?"))
        out.append(f"#   [{e.get('status','?'):>15}] {e.get('from','?')} "
                   f"--{e.get('type','?')}--> {e.get('to','?')}   ({loc})")
    return out


PY_TEMPLATE = '''# SPDX-License-Identifier: MIT
# AUTO-GENERATED RED E2E SKELETON (knife5) — starts FAILING on purpose.
# Journey {jid} [{plevel}] : {jname}
# crosses features: {features}
# hop types: {hops}
# {preason}
#
# Hops (provenance-backed):
{hop_block}
#
# RULES: condition-based waits only. NO time.sleep() for synchronisation.
import json
import time
import urllib.request

BASE = "http://127.0.0.1:8799"
POLL_TIMEOUT_S = 5.0
POLL_INTERVAL_S = 0.05


def _post(path, payload, cid):
    req = urllib.request.Request(
        BASE + path, data=json.dumps(payload).encode(), method="POST",
        headers={{"Content-Type": "application/json", "X-Correlation-Id": cid}})
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.load(r)


def _get(path):
    with urllib.request.urlopen(BASE + path, timeout=5) as r:
        return json.load(r)


def _wait_until(predicate, timeout=POLL_TIMEOUT_S):
    """Poll until predicate() is truthy or timeout. Returns last value; never sleeps blindly."""
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        last = predicate()
        if last:
            return last
        time.sleep(POLL_INTERVAL_S)  # back-off between polls (NOT a fixed sync sleep)
    return last


def test_{test_name}():
    """E2E: drive the journey with one correlation id and assert the terminal hop fired."""
    cid = "cid-e2e-{jid}"

    # --- start hop (ui -> http): kick the journey ---
    resp = _post("{start_path}", {{"order_id": "o-e2e"}}, cid)
    assert resp.get("cid") == cid, "start hop did not echo the correlation id"

    # --- terminal hop ({terminal_type}): assert it was observed for THIS cid ---
    def terminal_seen():
        snap = _get("/api/deliveries")
        return [d for d in snap.get("deliveries", []) if d.get("cid") == cid]

    observed = _wait_until(terminal_seen)

    # RED until the full chain is wired end-to-end:
    assert observed, (
        "JOURNEY NOT COMPLETE: terminal hop '{terminal_type}' never fired for cid "
        + cid + " — wire {features} end-to-end, then this turns GREEN"
    )
'''


JS_TEMPLATE = '''// SPDX-License-Identifier: MIT
// AUTO-GENERATED RED E2E SKELETON (knife5) — starts FAILING on purpose.
// Journey {jid} [{plevel}] : {jname}
// crosses features: {features} | hop types: {hops}
// {preason}
//
// Hops (provenance-backed):
{hop_block_js}
//
// RULES: condition-based waits only (expect.poll / waitFor). NO page.waitForTimeout() for sync.
import {{ test, expect }} from "@playwright/test";

test("{test_name}", async ({{ page, request }}) => {{
  const cid = "cid-e2e-{jid}";

  // start hop (ui): drive the UI that triggers the journey
  await page.goto("/");
  // attach the correlation id the same way the app does
  await page.addInitScript((c) => (window.__CID__ = c), cid);
  await page.getByRole("button").first().click();

  // terminal hop ({terminal_type}): poll the observable surface until it fires for THIS cid
  await expect
    .poll(async () => {{
      const res = await request.get("/api/deliveries");
      const body = await res.json();
      return (body.deliveries || []).some((d) => d.cid === cid);
    }}, {{ timeout: 5000 }})
    // RED until the chain is wired end-to-end:
    .toBe(true);
}});
'''


def main() -> int:
    ap = argparse.ArgumentParser(description="knife5: generate a RED E2E skeleton for a journey")
    ap.add_argument("inventory", help="path-inventory.json")
    ap.add_argument("--journey", default=None, help="journey id (default: highest priority)")
    ap.add_argument("--stack", choices=["python", "node"], default="python")
    ap.add_argument("-o", "--out", required=True)
    args = ap.parse_args()

    inv = json.load(open(args.inventory, encoding="utf-8"))
    j = pick_journey(inv, args.journey)
    edges = edge_lookup(inv)
    hb = hop_comments(j, edges)

    # find start path + terminal type from the journey edges
    first_edge = edges.get(j["edge_ids"][0], {})
    last_edge = edges.get(j["edge_ids"][-1], {})
    start_path = "/api/place-order"
    to_label = first_edge.get("to", "")
    if "route:" in to_label and " " in to_label:
        start_path = to_label.split(" ", 1)[1]
    terminal_type = last_edge.get("type", "cross-channel")

    common = dict(
        jid=j["id"], plevel=j["p_level"], jname=j["name"],
        features=", ".join(j["crosses_features"]), hops=", ".join(j["hop_types"]),
        preason=j.get("p_reason", ""),
        test_name="journey_" + j["id"].lower(),
        start_path=start_path, terminal_type=terminal_type,
    )

    if args.stack == "python":
        text = PY_TEMPLATE.format(hop_block="\n".join(hb), **common)
    else:
        hb_js = "\n".join("// " + line[1:].lstrip() for line in hb)
        text = JS_TEMPLATE.format(hop_block_js=hb_js, **common)

    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(text)
    print(f"knife5: RED E2E skeleton for {j['id']} [{j['p_level']}] ({args.stack}) -> {args.out}",
          file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
