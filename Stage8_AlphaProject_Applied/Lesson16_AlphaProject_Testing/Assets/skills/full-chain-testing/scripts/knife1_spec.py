#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 path-inventory toolkit authors.
#
# knife1_spec.py — SPEC PARSER (source C).
#
# Reads a spec-kit-style specs/ tree (each feature in its own folder with
# spec.md / plan.md / tasks.md) and extracts CROSS-FEATURE candidate edges from the
# deterministic tags people actually write:
#
#   - feature kind from task tags `[BE]` / `[FE]` / `[INT]`
#   - cross-feature dependency `[依赖] F1, <some_service>` / `[依赖] T002, F5 <upstream_contract>`
#   - FR provenance `[FR 来源] FR-013, FR-004`
#   - output validation `[出参验证] ...`
#
# Every emitted edge is `status=candidate, source=spec` and carries provenance
# {file, line} pointing at the exact tasks.md line that declared the dependency.
# We DO NOT guess any edge an LLM might infer — only what the tags literally say.
#
# Stack/project-agnostic: feature ids + F-number aliases are discovered from the
# folder names and the `(Fn)` marker in each tasks.md description, never hard-coded.

from __future__ import annotations

import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pathinv import Feature, Node, Edge, edge_id  # noqa: E402

# --- regexes (deterministic) ----------------------------------------------------------
RE_FOLDER = re.compile(r"^(\d{3})-(.+)$")
RE_FALIAS = re.compile(r"\((F\d+)[^)]*\)")           # "(F5)" / "(F1, 方案 A)"
RE_TASK = re.compile(r"\*\*(T\d+)\*\*")              # **T001**
RE_KIND = re.compile(r"`?\[(BE|FE|INT)\]`?")
RE_DEP = re.compile(r"\[依赖\]\s*([^·\n]+)")
RE_FR = re.compile(r"\[FR\s*来源\]\s*([^·\n]+)")
RE_FREF = re.compile(r"\bF(\d+)\b")                  # references to F1..Fn inside deps
RE_FRID = re.compile(r"(FR-\d+|§[\d.]+\w*)")


def discover_features(specs_dir: str) -> tuple[dict[str, str], dict[str, dict]]:
    """Return (alias->folderid map, folderid->meta).

    meta = {name, falias, kind_votes:{BE:n,FE:n,INT:n}, tasks_path}
    """
    alias_map: dict[str, str] = {}
    meta: dict[str, dict] = {}
    for entry in sorted(os.listdir(specs_dir)):
        m = RE_FOLDER.match(entry)
        path = os.path.join(specs_dir, entry)
        if not m or not os.path.isdir(path):
            continue
        fid = m.group(1)
        tasks = os.path.join(path, "tasks.md")
        spec = os.path.join(path, "spec.md")
        name = m.group(2)
        falias = None
        if os.path.exists(tasks):
            with open(tasks, encoding="utf-8") as fh:
                head = "".join(fh.readline() for _ in range(6))
            am = RE_FALIAS.search(head)
            if am:
                falias = am.group(1)
        # nicer name from spec title if present
        if os.path.exists(spec):
            with open(spec, encoding="utf-8") as fh:
                for line in fh:
                    if line.startswith("# "):
                        name = line[2:].strip()
                        break
        meta[fid] = {"name": name, "falias": falias, "tasks_path": tasks,
                     "kind_votes": {"BE": 0, "FE": 0, "INT": 0}}
        if falias:
            alias_map[falias] = fid
        alias_map[fid] = fid  # folder id also resolves to itself
    return alias_map, meta


def parse(specs_dir: str) -> dict:
    alias_map, meta = discover_features(specs_dir)
    nodes: dict[str, Node] = {}
    edges: dict[str, Edge] = {}

    def feature_node_id(fid: str) -> str:
        return f"feat:{fid}"

    for fid, m in meta.items():
        if not os.path.exists(m["tasks_path"]):
            continue
        with open(m["tasks_path"], encoding="utf-8") as fh:
            lines = fh.readlines()
        cur_task = None
        cur_kind = None
        for i, raw in enumerate(lines, start=1):
            tm = RE_TASK.search(raw)
            if tm:
                cur_task = tm.group(1)
                km = RE_KIND.search(raw)
                cur_kind = km.group(1) if km else None
                if cur_kind:
                    m["kind_votes"][cur_kind] += 1
            # dependency line (may be same line as task or the indented detail line)
            dm = RE_DEP.search(raw)
            if dm and cur_task:
                deps_txt = dm.group(1)
                frm = RE_FR.search(raw)
                fr_ids = RE_FRID.findall(frm.group(1)) if frm else []
                for fref in RE_FREF.findall(deps_txt):
                    target_alias = f"F{fref}"
                    target_fid = alias_map.get(target_alias)
                    if not target_fid or target_fid == fid:
                        continue  # unknown alias or self-dep -> skip
                    # cross-feature candidate edge: this feature depends on target feature
                    a = feature_node_id(fid)
                    b = feature_node_id(target_fid)
                    for nid, ff in ((a, fid), (b, target_fid)):
                        if nid not in nodes:
                            nodes[nid] = Node(
                                id=nid, feature=ff, kind="handler",
                                label=f"{ff} {meta[ff]['name']}",
                                provenance={"file": os.path.relpath(meta[ff]["tasks_path"], specs_dir), "line": 1},
                            )
                    eid = edge_id(a, b, "call")
                    if eid not in edges:
                        edges[eid] = Edge(
                            id=eid, frm=a, to=b, type="call", source="spec",
                            status="candidate",
                            provenance={"file": os.path.relpath(m["tasks_path"], specs_dir), "line": i},
                            feature_from=fid, feature_to=target_fid,
                            notes=f"{cur_task} 依赖 {target_alias}"
                                  + (f"; FR={','.join(fr_ids)}" if fr_ids else ""),
                        )

    # finalize feature list with kind from votes
    feats: list[Feature] = []
    for fid, m in meta.items():
        votes = m["kind_votes"]
        nonzero = [k for k, v in votes.items() if v]
        if not nonzero:
            kind = "mixed"
        elif len(nonzero) == 1:
            kind = nonzero[0]
        elif "FE" in nonzero and "BE" in nonzero:
            kind = "mixed"
        else:
            kind = max(votes, key=votes.get)
        feats.append(Feature(id=fid, name=m["name"], kind=kind))

    return {
        "features": [vars(f) for f in feats],
        "nodes": [vars(n) for n in nodes.values()],
        "edges": [e.to_json() for e in edges.values()],
        "journeys": [],
        "_meta": {"knife": "knife1_spec", "specs_dir": specs_dir,
                  "alias_map": alias_map},
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="knife1: spec-kit dependency parser (candidate edges)")
    ap.add_argument("specs_dir", help="path to specs/ tree")
    ap.add_argument("-o", "--out", default="-", help="output json (default stdout)")
    args = ap.parse_args()
    if not os.path.isdir(args.specs_dir):
        print(f"not a dir: {args.specs_dir}", file=sys.stderr)
        return 2
    result = parse(args.specs_dir)
    text = json.dumps(result, ensure_ascii=False, indent=2)
    if args.out == "-":
        print(text)
    else:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(text)
        print(f"knife1: {len(result['features'])} features, "
              f"{len(result['edges'])} candidate cross-feature edges -> {args.out}",
              file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
