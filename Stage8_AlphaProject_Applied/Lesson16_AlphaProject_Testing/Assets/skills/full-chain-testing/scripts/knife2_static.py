#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 path-inventory toolkit authors.
#
# knife2_static.py — STATIC CODE SCANNER (source A).
#
# Deterministically extracts CODE-CONFIRMED structure from a real repo. It is
# stack-agnostic: it reads pyproject.toml / package.json to decide which extractors
# to run, then applies AST (Python) + regex (TS/JS) passes:
#
#   Python (FastAPI/Flask-ish):
#     - route decorators @app.get/@router.post/... -> route node
#     - import statements -> import edges
#     - Redis key string literals (r.get/set/setex(...) or "prefix:..." consts) -> shared-key
#     - scheduler/cron registration (add_job / @scheduler.scheduled_job / BackgroundScheduler) -> job node + cron edge
#
#   Next.js (App Router) / TS / JS:
#     - app/**/route.ts with exported HTTP verb fns -> route node (path from folder)
#     - import statements -> import edges
#     - bare fetch("/api/...") -> http edge (code-confirmed FE->BE)
#     - FRAMEWORK-WRAPPED calls: useObject/useChat/useCompletion({ api: "/api/..." })
#       -> http edge BUT status=candidate with an honest note. We do NOT pretend the
#          framework hook is a confirmed wire; the seam is real only at runtime (knife3).
#
# Anti-fabrication: every node/edge carries provenance {file, line} into the real repo.
# Nothing is emitted that the parser cannot point a finger at.

from __future__ import annotations

import argparse
import ast
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pathinv import Node, Edge, edge_id  # noqa: E402

SKIP_DIRS = {"node_modules", ".git", ".next", "dist", "build", "__pycache__",
             ".venv", "venv", ".turbo", "coverage", ".pytest_cache"}


def rel(root: str, p: str) -> str:
    return os.path.relpath(p, root)


def detect_stacks(root: str) -> set[str]:
    stacks = set()
    if os.path.exists(os.path.join(root, "pyproject.toml")) or \
       os.path.exists(os.path.join(root, "requirements.txt")):
        stacks.add("python")
    pkg = os.path.join(root, "package.json")
    if os.path.exists(pkg):
        try:
            with open(pkg, encoding="utf-8") as fh:
                data = json.load(fh)
            deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
            stacks.add("node")
            if "next" in deps:
                stacks.add("next")
        except Exception:
            stacks.add("node")
    # fallback: sniff files
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for f in filenames:
            if f.endswith(".py"):
                stacks.add("python")
            elif f.endswith((".ts", ".tsx")):
                stacks.add("node")
    return stacks


# ---- Python AST pass ----------------------------------------------------------------

PY_ROUTE_METHODS = {"get", "post", "put", "delete", "patch", "head", "options"}
PY_REDIS_CALLS = {"get", "set", "setex", "hset", "hget", "rpush", "lpush", "publish",
                  "sadd", "incr", "expire", "delete"}
PY_SCHED_CALLS = {"add_job", "scheduled_job"}


def scan_python_file(root: str, path: str, nodes, edges, feature: str):
    relp = rel(root, path)
    try:
        src = open(path, encoding="utf-8").read()
        tree = ast.parse(src, filename=path)
    except (SyntaxError, UnicodeDecodeError):
        return

    def add_node(nid, kind, label, line):
        if nid not in nodes:
            nodes[nid] = Node(id=nid, feature=feature, kind=kind, label=label,
                              provenance={"file": relp, "line": line})

    for node in ast.walk(tree):
        # imports
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            mod = getattr(node, "module", None) or ""
            names = [a.name for a in node.names]
            target = mod or (names[0] if names else "")
            if target and not target.startswith(("os", "sys", "json", "re", "typing")):
                src_nid = f"py:{relp}"
                tgt_nid = f"mod:{target}"
                add_node(src_nid, "handler", relp, node.lineno)
                add_node(tgt_nid, "handler", target, node.lineno)
                eid = edge_id(src_nid, tgt_nid, "import")
                if eid not in edges:
                    edges[eid] = Edge(id=eid, frm=src_nid, to=tgt_nid, type="import",
                                      source="code", status="code-confirmed",
                                      provenance={"file": relp, "line": node.lineno},
                                      feature_from=feature)
        # decorators -> routes
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for dec in node.decorator_list:
                info = _decorator_info(dec)
                if not info:
                    continue
                attr, arg0 = info
                if attr in PY_ROUTE_METHODS:
                    route_path = arg0 or f"/{node.name}"
                    nid = f"route:{attr.upper()} {route_path}"
                    add_node(nid, "route", f"{attr.upper()} {route_path}", node.lineno)
                elif attr in PY_SCHED_CALLS:
                    nid = f"job:{node.name}"
                    add_node(nid, "job", f"cron {node.name}", node.lineno)
        # calls: redis keys + scheduler add_job
        if isinstance(node, ast.Call):
            attr = node.func.attr if isinstance(node.func, ast.Attribute) else (
                node.func.id if isinstance(node.func, ast.Name) else None)
            if attr in PY_REDIS_CALLS and node.args and _looks_like_redis_receiver(node.func):
                key = _str_arg(node.args[0])
                # require a colon-namespaced key (redis convention) to avoid matching
                # dict.get / headers.get false positives — honest under-reporting.
                if key and ":" in key and re.match(r"^[A-Za-z][\w.-]*:", key):
                    ds = f"datastore:redis:{key.split(':')[0] if ':' in key else key}"
                    add_node(ds, "datastore", f"redis {key}", node.lineno)
                    src_nid = f"py:{relp}"
                    add_node(src_nid, "handler", relp, node.lineno)
                    eid = edge_id(src_nid, ds, "shared-key")
                    if eid not in edges:
                        edges[eid] = Edge(id=eid, frm=src_nid, to=ds, type="shared-key",
                                          source="code", status="code-confirmed",
                                          provenance={"file": relp, "line": node.lineno},
                                          feature_from=feature,
                                          notes=f"redis op {attr}('{key}')")
            if attr == "add_job":
                # APScheduler add_job(func, 'cron', ...) -> job node
                fn = _str_arg(node.args[0]) or (
                    node.args[0].id if node.args and isinstance(node.args[0], ast.Name) else "job")
                nid = f"job:{fn}"
                add_node(nid, "job", f"cron {fn}", node.lineno)
                src_nid = f"py:{relp}"
                add_node(src_nid, "handler", relp, node.lineno)
                eid = edge_id(src_nid, nid, "cron")
                if eid not in edges:
                    edges[eid] = Edge(id=eid, frm=src_nid, to=nid, type="cron",
                                      source="code", status="code-confirmed",
                                      provenance={"file": relp, "line": node.lineno},
                                      feature_from=feature, notes="scheduler.add_job")


def _decorator_info(dec):
    """Return (method_attr, first_str_arg) for @x.get('/p') style decorators."""
    if isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute):
        return dec.func.attr, (_str_arg(dec.args[0]) if dec.args else None)
    if isinstance(dec, ast.Attribute):
        return dec.attr, None
    return None


def _str_arg(node):
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


REDIS_RECEIVER_NAMES = {"r", "redis", "rds", "cache", "kv", "client", "rd", "store", "conn"}


def _looks_like_redis_receiver(func_node) -> bool:
    """Only treat x.set('a:b') as a redis op when x looks like a redis client.
    Conservative on purpose: we'd rather miss a shared-key (knife3 can catch it at
    runtime) than fabricate one from dict.get / headers.get."""
    if not isinstance(func_node, ast.Attribute):
        return False
    recv = func_node.value
    if isinstance(recv, ast.Name):
        return recv.id.lower() in REDIS_RECEIVER_NAMES
    if isinstance(recv, ast.Attribute):
        return recv.attr.lower() in REDIS_RECEIVER_NAMES
    return False


# ---- Next.js / TS / JS regex pass ---------------------------------------------------

RE_TS_IMPORT = re.compile(r'^\s*import\s+(?:.+?\s+from\s+)?["\']([^"\']+)["\']', re.M)
RE_TS_ROUTE_VERB = re.compile(r'export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|DELETE|PATCH)\b')
RE_TS_FETCH = re.compile(r'fetch\(\s*[`"\']([^`"\']+)[`"\']')
RE_TS_HOOK_API = re.compile(r'\b(useObject|useChat|useCompletion|experimental_useObject)\b[\s\S]{0,200}?api:\s*["\']([^"\']+)["\']')
RE_TS_REDIS = re.compile(r'\.(?:get|set|setex|hset|hget|rpush|lpush|publish|sadd|incr)\(\s*[`"\']([^`"\']+)[`"\']')


def route_path_from_app_router(root: str, path: str) -> str | None:
    """Derive the URL path for a Next.js app router route.ts/route.js."""
    relp = rel(root, path).replace(os.sep, "/")
    m = re.search(r'(?:^|/)(?:src/)?app/(.*)/route\.(?:ts|js|tsx|jsx)$', relp)
    if not m:
        return None
    segs = [s for s in m.group(1).split("/") if not (s.startswith("(") and s.endswith(")"))]
    return "/" + "/".join(segs)


def scan_ts_file(root: str, path: str, nodes, edges, feature: str, is_next: bool):
    relp = rel(root, path)
    try:
        src = open(path, encoding="utf-8").read()
    except UnicodeDecodeError:
        return
    lines = src.splitlines()

    def line_of(idx_char):
        return src.count("\n", 0, idx_char) + 1

    def add_node(nid, kind, label, line):
        if nid not in nodes:
            nodes[nid] = Node(id=nid, feature=feature, kind=kind, label=label,
                              provenance={"file": relp, "line": line})

    # Next route node
    if is_next and re.search(r'/route\.(ts|js|tsx|jsx)$', relp):
        rp = route_path_from_app_router(root, path)
        if rp:
            for vm in RE_TS_ROUTE_VERB.finditer(src):
                verb = vm.group(1)
                ln = line_of(vm.start())
                nid = f"route:{verb} {rp}"
                add_node(nid, "route", f"{verb} {rp}", ln)

    # imports (only project-relative / aliased to keep signal high)
    for im in RE_TS_IMPORT.finditer(src):
        mod = im.group(1)
        if not (mod.startswith(".") or mod.startswith("@/")):
            continue
        ln = line_of(im.start())
        src_nid = f"ts:{relp}"
        tgt_nid = f"mod:{mod}"
        add_node(src_nid, "component" if relp.endswith(".tsx") else "handler", relp, ln)
        add_node(tgt_nid, "handler", mod, ln)
        eid = edge_id(src_nid, tgt_nid, "import")
        if eid not in edges:
            edges[eid] = Edge(id=eid, frm=src_nid, to=tgt_nid, type="import",
                              source="code", status="code-confirmed",
                              provenance={"file": relp, "line": ln}, feature_from=feature)

    # bare fetch -> code-confirmed http (the seam is visible in source)
    for fm in RE_TS_FETCH.finditer(src):
        url = fm.group(1)
        if not url.startswith("/"):
            continue
        ln = line_of(fm.start())
        src_nid = f"ts:{relp}"
        add_node(src_nid, "component" if relp.endswith(".tsx") else "handler", relp, ln)
        tgt_nid = f"route:* {url.split('?')[0]}"
        add_node(tgt_nid, "route", url.split("?")[0], ln)
        eid = edge_id(src_nid, tgt_nid, "http")
        if eid not in edges:
            edges[eid] = Edge(id=eid, frm=src_nid, to=tgt_nid, type="http",
                              source="code", status="code-confirmed",
                              provenance={"file": relp, "line": ln}, feature_from=feature,
                              notes=f"bare fetch('{url}')")

    # framework-wrapped hook -> HONEST candidate (known failure mode of static scan)
    for hm in RE_TS_HOOK_API.finditer(src):
        hook, url = hm.group(1), hm.group(2)
        if not url.startswith("/"):
            continue
        ln = line_of(hm.start())
        src_nid = f"ts:{relp}"
        add_node(src_nid, "component" if relp.endswith(".tsx") else "handler", relp, ln)
        tgt_nid = f"route:* {url.split('?')[0]}"
        add_node(tgt_nid, "route", url.split("?")[0], ln)
        eid = edge_id(src_nid, tgt_nid, "http")
        # only set candidate if not already confirmed by a bare fetch
        if eid not in edges:
            edges[eid] = Edge(
                id=eid, frm=src_nid, to=tgt_nid, type="http",
                source="code", status="candidate",
                provenance={"file": relp, "line": ln}, feature_from=feature,
                notes=f"framework-wrapped via {hook}(api:'{url}'); "
                      f"static scan can see the URL string but NOT the wire — "
                      f"left as candidate for trace (knife3) to confirm")

    # redis-ish key literals (node redis clients)
    for rm in RE_TS_REDIS.finditer(src):
        key = rm.group(1)
        # require colon-namespaced key (redis convention) to avoid dict/map .get noise
        if not re.match(r'^[A-Za-z][\w.-]*:', key):
            continue
        ln = line_of(rm.start())
        ds = f"datastore:redis:{key.split(':')[0]}"
        add_node(ds, "datastore", f"redis {key}", ln)
        src_nid = f"ts:{relp}"
        add_node(src_nid, "handler", relp, ln)
        eid = edge_id(src_nid, ds, "shared-key")
        if eid not in edges:
            edges[eid] = Edge(id=eid, frm=src_nid, to=ds, type="shared-key",
                              source="code", status="code-confirmed",
                              provenance={"file": relp, "line": ln}, feature_from=feature)


def scan(root: str, feature: str = "code") -> dict:
    stacks = detect_stacks(root)
    nodes: dict[str, Node] = {}
    edges: dict[str, Edge] = {}
    is_next = "next" in stacks
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for f in filenames:
            p = os.path.join(dirpath, f)
            if f.endswith(".py") and "python" in stacks:
                scan_python_file(root, p, nodes, edges, feature)
            elif f.endswith((".ts", ".tsx", ".js", ".jsx", ".mjs")) and "node" in stacks:
                scan_ts_file(root, p, nodes, edges, feature, is_next)
    return {
        "features": [{"id": feature, "name": f"static:{os.path.basename(root.rstrip('/'))}",
                      "kind": "BE" if stacks == {"python"} else ("FE" if is_next else "mixed")}],
        "nodes": [vars(n) for n in nodes.values()],
        "edges": [e.to_json() for e in edges.values()],
        "journeys": [],
        "_meta": {"knife": "knife2_static", "root": root, "stacks": sorted(stacks)},
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="knife2: static code scanner (code-confirmed edges)")
    ap.add_argument("root", help="repo root to scan")
    ap.add_argument("-f", "--feature", default="code", help="feature id to tag nodes with")
    ap.add_argument("-o", "--out", default="-")
    args = ap.parse_args()
    if not os.path.isdir(args.root):
        print(f"not a dir: {args.root}", file=sys.stderr)
        return 2
    result = scan(args.root, args.feature)
    text = json.dumps(result, ensure_ascii=False, indent=2)
    if args.out == "-":
        print(text)
    else:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(text)
        cand = sum(1 for e in result["edges"] if e["status"] == "candidate")
        print(f"knife2: stacks={result['_meta']['stacks']} "
              f"{len(result['nodes'])} nodes {len(result['edges'])} edges "
              f"({cand} honest candidates) -> {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
