#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 path-inventory toolkit authors.
#
# knife3_trace.py — TRACE COLLECTOR (source B).
#
# Reads a clean-room correlation-id trace log (one JSON event per line, as emitted by
# demo-app/tracer.py) and reconstructs runtime-confirmed edges. This is NOT
# OpenTelemetry — just correlation-id + structured events, which is enough to prove a
# hop actually fired at runtime.
#
# Every emitted edge is status=trace-confirmed, source=trace, with provenance
# {span: "<cid>:<from>-><to>", event: <raw>} — i.e. a pointer to the literal event that
# proves the wire fired. No event => no edge. We never infer a hop that wasn't logged.
#
# Optionally filter to a single correlation id (--cid) to scope to one user journey.

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pathinv import Node, Edge, edge_id  # noqa: E402

NODE_KIND = {
    "component": "component", "route": "route", "handler": "handler",
    "job": "job", "queue": "queue", "datastore": "datastore",
    "external": "external", "worker": "handler", "scheduler": "job",
}


def kind_for(span: str) -> str:
    prefix = span.split(":", 1)[0]
    return NODE_KIND.get(prefix, "handler")


def collect(log_path: str, cid_filter: str | None, feature: str) -> dict:
    nodes: dict[str, Node] = {}
    edges: dict[str, Edge] = {}
    n_events = 0
    with open(log_path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            if cid_filter and rec.get("cid") != cid_filter:
                continue
            n_events += 1
            frm, to, et = rec["from"], rec["to"], rec["edge_type"]
            # per-span feature comes from the event if the tracer provided it,
            # otherwise falls back to the --feature tag.
            feat_from = rec.get("feature_from", feature)
            feat_to = rec.get("feature_to", feature)
            for span, sfeat in ((frm, feat_from), (to, feat_to)):
                if span not in nodes:
                    nodes[span] = Node(id=span, feature=sfeat, kind=kind_for(span),
                                       label=span, provenance={"span": rec["span"]})
            eid = edge_id(frm, to, et)
            if eid not in edges:
                edges[eid] = Edge(
                    id=eid, frm=frm, to=to, type=et, source="trace",
                    status="trace-confirmed",
                    provenance={"span": rec["span"], "event": {k: rec[k] for k in
                                ("ts", "cid", "from", "to", "edge_type") if k in rec}},
                    feature_from=feat_from, feature_to=feat_to,
                    notes=f"observed at runtime cid={rec['cid']}",
                )
    return {
        "features": [{"id": feature, "name": "runtime-trace", "kind": "mixed"}],
        "nodes": [vars(n) for n in nodes.values()],
        "edges": [e.to_json() for e in edges.values()],
        "journeys": [],
        "_meta": {"knife": "knife3_trace", "log": log_path, "cid_filter": cid_filter,
                  "events_seen": n_events},
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="knife3: correlation-id trace collector (trace-confirmed edges)")
    ap.add_argument("log", help="trace log path (jsonl)")
    ap.add_argument("--cid", default=None, help="only this correlation id")
    ap.add_argument("-f", "--feature", default="trace")
    ap.add_argument("-o", "--out", default="-")
    args = ap.parse_args()
    if not os.path.exists(args.log):
        print(f"no log: {args.log}", file=sys.stderr)
        return 2
    result = collect(args.log, args.cid, args.feature)
    text = json.dumps(result, ensure_ascii=False, indent=2)
    if args.out == "-":
        print(text)
    else:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(text)
        print(f"knife3: {result['_meta']['events_seen']} events -> "
              f"{len(result['edges'])} trace-confirmed edges -> {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
