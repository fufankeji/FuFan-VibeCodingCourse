#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 path-inventory toolkit authors.
#
# knife4_merge.py — THREE-SOURCE MERGER + JOURNEY DERIVATION.
#
# Combines knife1 (spec/candidate), knife2 (code), knife3 (trace) outputs into ONE
# path-inventory.json. Rules:
#   - Dedup edges by (from, to, type). When the same edge is seen from multiple
#     sources, UPGRADE its status: candidate -> code-confirmed -> trace-confirmed,
#     and keep ALL provenances in `provenance.all` + the strongest in `provenance`.
#   - Keep every node; merge node provenance (first writer wins, others appended).
#   - Surface SPEC-ONLY gaps: edges that exist only as candidate (never code/trace
#     confirmed) are listed in _meta.gaps.
#   - Derive journeys: walk the edge graph for chains that cross >= 2 features, then
#     heuristically tag P0 by risk keywords (permission/money/data-loss/core flow/
#     irreversible delivery). Every P0 is annotated "needs human confirm".
#
# Anti-fabrication: the merger NEVER invents edges; it only unions + upgrades existing
# ones, preserving each source's provenance.

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pathinv import higher_status, SOURCE_FOR_STATUS, STATUS_RANK, validate  # noqa: E402


# --- risk heuristics for P-leveling -------------------------------------------------
# GENERIC risk-semantic words ONLY — must stay project-agnostic. Do NOT add any specific
# project's business nouns here. A project that wants to add its own domain risk vocab
# puts it in a project-side `feature-names.json` sidecar under key `risk_keywords`
# (merged at runtime by load_sidecar_risk_keywords) — never baked into the tool.
RISK_KEYWORDS = {
    "permission": ["auth", "login", "token", "permission", "鉴权", "登录", "权限", "越权"],
    "money": ["order", "pay", "payment", "charge", "fund", "下单", "支付", "资金", "扣费"],
    "data-loss": ["delete", "drop", "purge", "remove", "删除", "清空", "迁移"],
    "core-flow": ["checkout", "core", "main", "critical", "primary", "主流程", "核心", "关键流程", "结算"],
    "irreversible-delivery": ["push", "send", "notify", "deliver", "cross-channel",
                              "推送", "投递", "通知"],
}


def load_sidecar_risk_keywords(source_roots: list[str]) -> dict:
    """Merge project-side risk vocab onto the generic base. Project-specific risk words
    live in a `feature-names.json` sidecar (key `risk_keywords`) at the scanned source
    root — EVIDENCE on the project side, never hard-coded in the tool. Returns a fresh
    dict so the module global stays the pristine generic base."""
    merged = {cat: list(kws) for cat, kws in RISK_KEYWORDS.items()}
    for root in source_roots or []:
        path = os.path.join(root, "feature-names.json")
        if not os.path.isfile(path):
            continue
        try:
            data = json.load(open(path, encoding="utf-8"))
        except Exception:
            continue
        for cat, kws in (data.get("risk_keywords") or {}).items():
            merged.setdefault(cat, [])
            for k in kws:
                if k not in merged[cat]:
                    merged[cat].append(k)
    return merged


def merge_edges(sources: list[dict]) -> tuple[dict, dict]:
    """Return (merged_edges_by_key, nodes_by_id)."""
    edges: dict[tuple, dict] = {}
    nodes: dict[str, dict] = {}
    for src in sources:
        for n in src.get("nodes", []):
            if n["id"] not in nodes:
                nodes[n["id"]] = {**n, "provenance_all": [n.get("provenance")]}
            else:
                nodes[n["id"]]["provenance_all"].append(n.get("provenance"))
        for e in src.get("edges", []):
            key = (e["from"], e["to"], e["type"])
            prov_entry = {"source": e["source"], "status": e["status"],
                          "provenance": e.get("provenance"), "notes": e.get("notes", "")}
            if key not in edges:
                edges[key] = {
                    "id": e["id"], "from": e["from"], "to": e["to"], "type": e["type"],
                    "source": e["source"], "status": e["status"],
                    "provenance": e.get("provenance"),
                    "feature_from": e.get("feature_from"),
                    "feature_to": e.get("feature_to"),
                    "notes": e.get("notes", ""),
                    "provenance_all": [prov_entry],
                }
            else:
                cur = edges[key]
                new_status = higher_status(cur["status"], e["status"])
                cur["provenance_all"].append(prov_entry)
                if new_status != cur["status"] and STATUS_RANK[e["status"]] > STATUS_RANK[cur["status"]]:
                    cur["status"] = new_status
                    cur["source"] = SOURCE_FOR_STATUS[new_status]
                    cur["provenance"] = e.get("provenance")  # promote stronger provenance
                cur["feature_from"] = cur["feature_from"] or e.get("feature_from")
                cur["feature_to"] = cur["feature_to"] or e.get("feature_to")
    return edges, nodes


def derive_journeys(edges: list[dict], nodes: dict, risk_keywords: dict) -> list[dict]:
    """Find chains crossing >=2 features. We treat each node's `feature` as its owner;
    a journey is a path through the graph whose endpoints/transits span >=2 features."""
    by_from: dict[str, list[dict]] = {}
    for e in edges:
        by_from.setdefault(e["from"], []).append(e)
    indeg: dict[str, int] = {}
    for e in edges:
        indeg[e["to"]] = indeg.get(e["to"], 0) + 1
        indeg.setdefault(e["from"], indeg.get(e["from"], 0))
    roots = [nid for nid, d in indeg.items() if d == 0 and nid in by_from]

    journeys: list[dict] = []
    seen_paths: set[tuple] = set()

    # build a node->feature map that prefers specific features (A/B/C) over generic.
    GENERIC = {"demo", "code", "trace", "?", None, ""}
    node_feat_map: dict[str, str] = {}
    for e in edges:
        if e.get("feature_from") and e["feature_from"] not in GENERIC:
            node_feat_map[e["from"]] = e["feature_from"]
        if e.get("feature_to") and e["feature_to"] not in GENERIC:
            node_feat_map[e["to"]] = e["feature_to"]
    for nid, n in nodes.items():
        node_feat_map.setdefault(nid, n.get("feature", "?"))

    def node_feat(nid):
        return node_feat_map.get(nid, (nodes.get(nid) or {}).get("feature", "?"))

    def walk(start):
        # longest simple paths from start (DFS, bounded)
        stack = [(start, [start], [])]
        results = []
        while stack:
            cur, path, eids = stack.pop()
            outs = by_from.get(cur, [])
            extended = False
            for e in outs:
                if e["to"] in path:
                    continue
                extended = True
                stack.append((e["to"], path + [e["to"]], eids + [e]))
            if not extended and len(eids) >= 1:
                results.append((path, eids))
        return results

    jid = 0
    for r in roots:
        for path, eids in walk(r):
            feats = []
            for nid in path:
                f = node_feat(nid)
                if f and f not in feats:
                    feats.append(f)
            if len(feats) < 2:
                continue
            key = tuple(e["id"] for e in eids)
            if key in seen_paths:
                continue
            seen_paths.add(key)
            jid += 1
            hop_types = []
            # the first http originating from a component is a "ui" hop conceptually
            for e in eids:
                if node_feat(e["from"]).startswith("component") or \
                   (nodes.get(e["from"]) or {}).get("kind") == "component":
                    if "ui" not in hop_types:
                        hop_types.append("ui")
                if e["type"] not in hop_types:
                    hop_types.append(e["type"])
            p_level, reason = score_risk(path, eids, nodes, risk_keywords)
            acs = sorted({fr for e in eids for fr in _acs_from_notes(e)})
            journeys.append({
                "id": f"J{jid}",
                "name": _journey_name(path, nodes),
                "p_level": p_level,
                "crosses_features": feats,
                "hop_types": hop_types,
                "edge_ids": [e["id"] for e in eids],
                "acs": acs,
                "p_reason": reason,
            })
    # longest-first
    journeys.sort(key=lambda j: (-len(j["edge_ids"]), j["p_level"]))
    return journeys


def _acs_from_notes(e) -> list[str]:
    import re
    out = []
    for pe in e.get("provenance_all", []):
        out += re.findall(r"FR-\d+", pe.get("notes", ""))
    return out


def _journey_name(path, nodes):
    first = (nodes.get(path[0]) or {}).get("label", path[0])
    last = (nodes.get(path[-1]) or {}).get("label", path[-1])
    return f"{first} → … → {last}"


def score_risk(path, eids, nodes, risk_keywords) -> tuple[str, str]:
    text = " ".join([(nodes.get(n) or {}).get("label", n) + " " + n for n in path]).lower()
    text += " " + " ".join(e["type"] for e in eids)
    hits = []
    for cat, kws in risk_keywords.items():
        if any(k.lower() in text for k in kws):
            hits.append(cat)
    high_risk = {"permission", "money", "data-loss", "irreversible-delivery"}
    has_cross_channel = any(e["type"] == "cross-channel" for e in eids)
    if (set(hits) & high_risk) or has_cross_channel:
        reason = ("P0 启发式命中: " + ", ".join(sorted(set(hits) & high_risk) or [])
                  + (" + cross-channel 不可撤销投递" if has_cross_channel else "")
                  + " — 需人确认 (heuristic, needs human confirm)")
        return "P0", reason
    if "core-flow" in hits:
        return "P1", "P1: 命中核心主流程关键字 — 需人确认"
    if len(path) >= 4:
        return "P2", "P2: 长链路 (>=3 hops) 但无高危关键字"
    return "P3", "P3: 短链路、无高危关键字"


def main() -> int:
    ap = argparse.ArgumentParser(description="knife4: merge spec+code+trace into path-inventory.json")
    ap.add_argument("inputs", nargs="+", help="knife1/2/3 json outputs (any order)")
    ap.add_argument("-o", "--out", required=True)
    args = ap.parse_args()

    sources = []
    feature_index: dict[str, dict] = {}
    source_roots: list[str] = []
    for p in args.inputs:
        d = json.load(open(p, encoding="utf-8"))
        sources.append(d)
        for f in d.get("features", []):
            feature_index.setdefault(f["id"], f)
        # carry forward the scanned source root (knife2) / specs dir (knife1) so the
        # narrator (knife4b) can auto-discover a project-side `feature-names.json`
        # sidecar by convention, instead of the tool hard-coding any project's names.
        meta = d.get("_meta", {})
        for key in ("root", "specs_dir"):
            r = meta.get(key)
            if r and r not in source_roots:
                source_roots.append(r)

    edges_map, nodes = merge_edges(sources)
    edges = list(edges_map.values())
    risk_keywords = load_sidecar_risk_keywords(source_roots)  # generic base + project sidecar
    journeys = derive_journeys(edges, nodes, risk_keywords)

    # gaps: spec-only candidate edges never confirmed
    gaps = [{"id": e["id"], "from": e["from"], "to": e["to"], "type": e["type"],
             "provenance": e["provenance"]}
            for e in edges if e["status"] == "candidate"]

    inv = {
        "features": list(feature_index.values()),
        "nodes": [{"id": n["id"], "feature": n["feature"], "kind": n["kind"],
                   "label": n["label"], "provenance": n["provenance"],
                   "provenance_all": [p for p in n.get("provenance_all", []) if p]}
                  for n in nodes.values()],
        "edges": edges,
        "journeys": journeys,
        "_meta": {"knife": "knife4_merge", "inputs": args.inputs,
                  "source_roots": source_roots,
                  "gaps_spec_only": gaps,
                  "counts": {
                      "edges": len(edges),
                      "candidate": sum(1 for e in edges if e["status"] == "candidate"),
                      "code_confirmed": sum(1 for e in edges if e["status"] == "code-confirmed"),
                      "trace_confirmed": sum(1 for e in edges if e["status"] == "trace-confirmed"),
                      "journeys": len(journeys),
                      "P0": sum(1 for j in journeys if j["p_level"] == "P0"),
                  }},
    }

    problems = validate(inv)
    inv["_meta"]["validation"] = {"ok": not problems, "problems": problems}

    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(inv, fh, ensure_ascii=False, indent=2)
    c = inv["_meta"]["counts"]
    print(f"knife4: {c['edges']} edges (cand={c['candidate']} code={c['code_confirmed']} "
          f"trace={c['trace_confirmed']}), {c['journeys']} journeys, {c['P0']} P0; "
          f"{len(gaps)} spec-only gaps; validation_ok={not problems} -> {args.out}",
          file=sys.stderr)
    if problems:
        for p in problems[:10]:
            print("  PROBLEM:", p, file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
