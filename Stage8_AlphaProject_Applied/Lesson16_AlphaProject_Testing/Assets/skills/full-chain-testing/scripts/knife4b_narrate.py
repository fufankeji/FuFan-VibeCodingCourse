#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 path-inventory toolkit authors.
#
# knife4b_narrate.py — JOURNEY NARRATOR (human-readable post-processor for knife4).
#
# knife4 emits machine journeys: an edge_ids chain + crosses_features + hop_types.
# That is correct but unreadable for a human who only wants to know "which cross-feature
# user journeys exist". This post-processor turns every journey into a PLAIN-LANGUAGE
# narrative, WITHOUT inventing anything:
#
#   - ordered_steps : the journey rebuilt as a left-to-right list of steps. Each step
#       { label, status, hop_type, provenance, node, node_kind } where `label` is a
#       natural-language step name DERIVED FROM REAL EVIDENCE only:
#         * a route path  POST /api/place-order  -> "提交下单 (POST /api/place-order)"
#         * a node kind   datastore/queue/job/external/component
#         * a feature name (spec-level feat: nodes use the feature display name)
#       If no evidence yields a label, the step is "(未命名步骤)" — never fabricated.
#   - summary : ONE deterministic sentence built by stitching the ordered_steps labels
#       with arrows. No free text, no new facts.
#
# Noise filtering: stdlib / third-party `import` edges (__future__/threading/time/...)
# and pure internal noise are NOT part of journeys to begin with (knife4 only walks
# meaningful hops). This pass additionally drops any step whose hop is a plain
# `import`/`call` to a stdlib-ish module, so a journey is only UI entry + cross-feature
# / cross-service hops (http/async/cron/cross-channel/shared-key/call-between-features)
# + terminal effect.
#
# Anti-fabrication: every step keeps the originating edge's provenance; every label is
# traceable to a node id, a route string, a feature name, or a spec note. Steps we cannot
# name are labelled "(未命名步骤)" but still carry provenance — we never drop the evidence.

from __future__ import annotations

import argparse
import json
import os
import re
import sys

# Convention filename a project drops at its SCANNED SOURCE ROOT to supply
# human-readable feature names + route verb hints WHEN it has no spec tree.
# The toolkit reads it by convention; it NEVER hard-codes any project's names.
NAMES_SIDECAR = "feature-names.json"


# Stdlib / framework module ids that are pure noise inside a "user journey" view.
# These never represent a cross-feature user-visible hop. Matched against `mod:<name>`.
NOISE_MODULES = {
    "__future__", "threading", "time", "json", "os", "sys", "re", "typing",
    "queue", "argparse", "http.server", "urllib.parse", "urllib.request",
    "concurrent.futures", "dataclasses", "functools", "itertools", "collections",
    "asyncio", "logging", "datetime", "math", "io", "pathlib",
}


def _is_noise_node(nid: str) -> bool:
    if nid.startswith("mod:"):
        name = nid[len("mod:"):]
        base = name.split(".")[0]
        return name in NOISE_MODULES or base in NOISE_MODULES
    return False


def _is_noise_edge(e: dict) -> bool:
    # journey-irrelevant: an import/call edge whose target is a stdlib/3rd-party module
    if e["type"] in ("import",) and _is_noise_node(e["to"]):
        return True
    if _is_noise_node(e["from"]) or _is_noise_node(e["to"]):
        return True
    return False


# hop_type the journey should attribute to a step, given the incoming edge + node kind.
def _hop_type_for(edge: dict, node_kind: str, is_entry: bool) -> str:
    if is_entry and node_kind == "component":
        return "ui"
    return edge["type"] if edge else ("ui" if node_kind == "component" else "step")


# --- label derivation (evidence-only) ------------------------------------------------

RE_ROUTE = re.compile(r"^route:(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|\*)\s+(.+)$")


def _route_label(route_path: str, verb: str, verb_hints: dict) -> str:
    # verb_hints are PROJECT-SIDE EVIDENCE (feature-names.json), not tool constants.
    hint = None
    for k, v in (verb_hints or {}).items():
        if k in route_path.lower():
            hint = v
            break
    shown = f"{verb} {route_path}" if verb != "*" else route_path
    return f"{hint} ({shown})" if hint else f"调用接口 {shown}"


def _node_label(nid: str, node: dict, feat_names: dict, verb_hints: dict) -> str:
    kind = (node or {}).get("kind", "")
    label = (node or {}).get("label", nid)

    m = RE_ROUTE.match(nid)
    if m:
        return _route_label(m.group(2), m.group(1), verb_hints)

    if nid.startswith("feat:"):
        fid = nid[len("feat:"):]
        return feat_names.get(fid, label)

    if nid.startswith("component:"):
        return "用户在页面操作"
    if nid.startswith(("datastore:", "datastore:kv", "datastore:redis")):
        return f"读写共享存储 ({label})"
    if nid.startswith("queue:"):
        return f"投递到异步队列 ({label})"
    if nid.startswith("worker:"):
        return f"异步 worker 处理 ({label})"
    if nid.startswith("job:") or kind == "job":
        return f"定时任务处理 ({label})"
    if nid.startswith("external:") or kind == "external":
        return f"推送到外部通道 ({label})"
    if nid.startswith("handler:"):
        # handler:place_order -> "服务处理: place_order"
        name = nid.split(":", 1)[1]
        return f"服务处理 ({name})"
    if nid.startswith(("scheduler",)):
        return "调度器注册定时任务"
    return label or "(未命名步骤)"


def _prov_str(p) -> str:
    if isinstance(p, dict):
        if "file" in p and "line" in p:
            return f"{p['file']}:{p['line']}"
        if "span" in p:
            return f"span {p['span']}"
        if "event" in p:
            return f"event {json.dumps(p['event'], ensure_ascii=False)}"
    return json.dumps(p, ensure_ascii=False)


# --- feature display-name derivation (evidence-only) ---------------------------------

def _load_sidecars(inv: dict) -> tuple[dict, dict]:
    """Read project-side `feature-names.json` (if any) from the scanned source roots
    recorded by knife4 in _meta.source_roots. Returns (feature_names, route_verb_hints).
    This is the generic, project-agnostic way a spec-less project supplies its own
    human names — the toolkit reads by convention, it does NOT bake names in."""
    names: dict[str, str] = {}
    hints: dict[str, str] = {}
    roots = list((inv.get("_meta") or {}).get("source_roots") or [])
    for root in roots:
        path = os.path.join(root, NAMES_SIDECAR)
        if not os.path.isfile(path):
            continue
        try:
            side = json.load(open(path, encoding="utf-8"))
        except Exception:
            continue
        for k, v in (side.get("feature_names") or {}).items():
            names.setdefault(k, v)
        for k, v in (side.get("route_verb_hints") or {}).items():
            hints.setdefault(k, v)
    return names, hints


def build_feature_names(inv: dict) -> tuple[dict, dict]:
    """Return (feature_id -> human name, route_verb_hints).

    Name sources, in priority order — ALL evidence, none hard-coded in this tool:
      1. inv['features'] spec titles (knife1; spec-bearing projects)
      2. a project-side `feature-names.json` sidecar at the scanned source root
         (knife2-scanned, spec-less projects like the demo)
    A feature id with no evidence falls back to the raw id (never invented)."""
    names: dict[str, str] = {}
    # (1) spec titles
    for f in inv.get("features", []):
        nm = f.get("name", f["id"])
        nm = re.sub(r"^Feature Specification[:：]\s*", "", nm).strip()
        names[f["id"]] = nm
    # (2) project-side sidecar evidence (fills ids the spec layer didn't name)
    side_names, side_hints = _load_sidecars(inv)
    for k, v in side_names.items():
        names.setdefault(k, v)
    return names, side_hints


# --- main narration ------------------------------------------------------------------

def narrate(inv: dict) -> dict:
    edges_by_id = {e["id"]: e for e in inv.get("edges", [])}
    nodes_by_id = {n["id"]: n for n in inv.get("nodes", [])}
    feat_names, verb_hints = build_feature_names(inv)

    for j in inv.get("journeys", []):
        eids = j.get("edge_ids", [])
        chain_edges = [edges_by_id[e] for e in eids if e in edges_by_id]
        # filter noise hops out of the journey
        kept = [e for e in chain_edges if not _is_noise_edge(e)]

        steps: list[dict] = []
        if kept:
            # entry node = `from` of the first kept edge
            first = kept[0]
            entry_node = nodes_by_id.get(first["from"])
            entry_kind = (entry_node or {}).get("kind", "")
            steps.append({
                "label": _node_label(first["from"], entry_node, feat_names, verb_hints),
                "status": "candidate",  # entry node's status mirrors first edge below
                "hop_type": _hop_type_for(None, entry_kind, is_entry=True),
                "provenance": _prov_str((entry_node or {}).get("provenance")),
                "node": first["from"],
                "node_kind": entry_kind,
            })
            steps[0]["status"] = first["status"]
            for e in kept:
                to_node = nodes_by_id.get(e["to"])
                to_kind = (to_node or {}).get("kind", "")
                steps.append({
                    "label": _node_label(e["to"], to_node, feat_names, verb_hints),
                    "status": e["status"],
                    "hop_type": _hop_type_for(e, to_kind, is_entry=False),
                    "provenance": _prov_str(e.get("provenance")),
                    "edge_id": e["id"],
                    "node": e["to"],
                    "node_kind": to_kind,
                })

        j["ordered_steps"] = steps
        j["crosses_features_named"] = [feat_names.get(f, f) for f in j.get("crosses_features", [])]
        j["summary"] = _build_summary(j, steps)

    # also stash the feature-name map for the viewer
    inv.setdefault("_meta", {})["feature_names"] = feat_names
    return inv


def _build_summary(j: dict, steps: list[dict]) -> str:
    if not steps:
        return "（无可读步骤：本旅程仅含被过滤的内部/三方依赖跳步）"
    labels = [s["label"] for s in steps]
    feats = j.get("crosses_features_named") or j.get("crosses_features", [])
    head = f"[{j.get('p_level','?')}] 跨 {len(feats)} 个 feature（{ ' / '.join(feats) }）："
    return head + " → ".join(labels)


def main() -> int:
    ap = argparse.ArgumentParser(description="knife4b: enrich journeys with NL ordered_steps + summary")
    ap.add_argument("inventory", help="path-inventory.json produced by knife4")
    ap.add_argument("-o", "--out", help="output path (default: overwrite input)")
    args = ap.parse_args()
    inv = json.load(open(args.inventory, encoding="utf-8"))
    inv = narrate(inv)
    out = args.out or args.inventory
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(inv, fh, ensure_ascii=False, indent=2)
    njs = inv.get("journeys", [])
    named = sum(1 for j in njs if j.get("ordered_steps"))
    print(f"knife4b: narrated {named}/{len(njs)} journeys "
          f"(ordered_steps + summary) -> {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
