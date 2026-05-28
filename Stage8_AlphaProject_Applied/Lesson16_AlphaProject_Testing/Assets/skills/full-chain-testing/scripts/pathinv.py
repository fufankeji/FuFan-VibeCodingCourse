# SPDX-License-Identifier: MIT
# Copyright (c) 2026 path-inventory toolkit authors.
#
# pathinv.py — shared path-inventory schema + helpers (clean-room, no third-party code).
#
# This module is the single source of truth for the path-inventory.json shape used by
# every "knife" (knife1 spec parser, knife2 static scanner, knife3 trace collector,
# knife4 merger, knife5 e2e skeleton, knife6 viewer). It intentionally has ZERO runtime
# dependencies beyond the Python stdlib so any knife can `import pathinv` and run.
#
# Design rule enforced here (anti-fabrication): every edge MUST carry a `provenance`
# block that points at real evidence — either {"file","line"} (spec/code) or
# {"span"|"event"} (trace). An edge with no provenance is rejected by `validate()`.

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from typing import Any


# ---- status / source ordering (used by the merger to "upgrade" an edge) -------------

STATUS_RANK = {"candidate": 0, "code-confirmed": 1, "trace-confirmed": 2}
SOURCE_FOR_STATUS = {"candidate": "spec", "code-confirmed": "code", "trace-confirmed": "trace"}


def higher_status(a: str, b: str) -> str:
    """Return whichever status is stronger (trace > code > candidate)."""
    return a if STATUS_RANK.get(a, -1) >= STATUS_RANK.get(b, -1) else b


# ---- edge id ------------------------------------------------------------------------

def edge_id(frm: str, to: str, etype: str) -> str:
    return f"{frm}--{etype}-->{to}"


# ---- containers ---------------------------------------------------------------------

@dataclass
class Feature:
    id: str
    name: str
    kind: str  # BE | FE | INT | mixed


@dataclass
class Node:
    id: str
    feature: str
    kind: str  # route | handler | component | job | queue | datastore | external
    label: str
    provenance: dict[str, Any]


@dataclass
class Edge:
    id: str
    frm: str
    to: str
    type: str          # http | cron | async | cross-channel | call | import | shared-key | data-access
    source: str        # spec | code | trace
    status: str        # candidate | code-confirmed | trace-confirmed
    provenance: dict[str, Any]
    feature_from: str | None = None
    feature_to: str | None = None
    notes: str = ""    # e.g. "framework-wrapped FE->BE, left as candidate for trace"

    def to_json(self) -> dict[str, Any]:
        d = {
            "id": self.id,
            "from": self.frm,
            "to": self.to,
            "type": self.type,
            "source": self.source,
            "status": self.status,
            "provenance": self.provenance,
        }
        if self.feature_from:
            d["feature_from"] = self.feature_from
        if self.feature_to:
            d["feature_to"] = self.feature_to
        if self.notes:
            d["notes"] = self.notes
        return d


@dataclass
class Journey:
    id: str
    name: str
    p_level: str          # P0 | P1 | P2 | P3
    crosses_features: list[str]
    hop_types: list[str]  # ui | http | cron | async | cross-channel | ...
    edge_ids: list[str]
    acs: list[str] = field(default_factory=list)
    p_reason: str = ""    # why this P-level + "needs human confirm" note


@dataclass
class Inventory:
    features: list[Feature] = field(default_factory=list)
    nodes: list[Node] = field(default_factory=list)
    edges: list[Edge] = field(default_factory=list)
    journeys: list[Journey] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        return {
            "features": [asdict(f) for f in self.features],
            "nodes": [{**asdict(n)} for n in self.nodes],
            "edges": [e.to_json() for e in self.edges],
            "journeys": [asdict(j) for j in self.journeys],
        }

    def dump(self, path: str) -> None:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(self.to_json(), fh, ensure_ascii=False, indent=2)


# ---- loader (knife4 reads raw per-knife outputs) ------------------------------------

def load_raw(path: str) -> dict[str, Any]:
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def edge_from_json(d: dict[str, Any]) -> Edge:
    return Edge(
        id=d.get("id") or edge_id(d["from"], d["to"], d["type"]),
        frm=d["from"],
        to=d["to"],
        type=d["type"],
        source=d["source"],
        status=d["status"],
        provenance=d.get("provenance", {}),
        feature_from=d.get("feature_from"),
        feature_to=d.get("feature_to"),
        notes=d.get("notes", ""),
    )


# ---- validation (anti-fabrication gate) ---------------------------------------------

def _provenance_ok(p: dict[str, Any]) -> bool:
    if not isinstance(p, dict) or not p:
        return False
    if "file" in p and ("line" in p):
        return True
    if "span" in p or "event" in p:
        return True
    return False


def validate(inv_json: dict[str, Any]) -> list[str]:
    """Return a list of problems. Empty list = every edge has real provenance."""
    problems: list[str] = []
    node_ids = {n["id"] for n in inv_json.get("nodes", [])}
    for e in inv_json.get("edges", []):
        eid = e.get("id", "<no-id>")
        if not _provenance_ok(e.get("provenance", {})):
            problems.append(f"edge {eid}: missing/invalid provenance {e.get('provenance')!r}")
        if e.get("status") not in STATUS_RANK:
            problems.append(f"edge {eid}: bad status {e.get('status')!r}")
        for end in ("from", "to"):
            if e.get(end) not in node_ids:
                problems.append(f"edge {eid}: endpoint {end}={e.get(end)!r} has no node")
    return problems
