"""
Frontend-Backend Integration Test
Tests every API call that the frontend components make.
Run with: python tests/integration_test.py
Requires: backend running on localhost:8000
"""
import json
import sys
import urllib.request
import urllib.error

BASE = "http://localhost:8000/api/v1"
PASS = "\033[92m[PASS]\033[0m"
FAIL = "\033[91m[FAIL]\033[0m"
INFO = "\033[94m[INFO]\033[0m"
SECTION = "\033[95m[====]\033[0m"

results = {"passed": 0, "failed": 0}


def req(method, path, body=None, params=None):
    url = BASE + path
    if params:
        url += "?" + "&".join(f"{k}={v}" for k, v in params.items() if v is not None)
    try:
        if body is not None:
            data = json.dumps(body).encode()
            r = urllib.request.Request(url, data=data, method=method,
                                       headers={"Content-Type": "application/json"})
        else:
            r = urllib.request.Request(url, method=method)
        resp = urllib.request.urlopen(r, timeout=30)
        return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode())


def check(name, condition, detail=""):
    if condition:
        results["passed"] += 1
        print(f"  {PASS} {name}")
    else:
        results["failed"] += 1
        print(f"  {FAIL} {name}  {detail}")


# ─────────────────────────────────────────────────────────────────────────────
# store.tsx — Initial load (AppProvider useEffect)
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{SECTION} store.tsx — AppProvider initial data load")

# refreshKG: GET /kg/nodes?page_size=500
r = req("GET", "/kg/nodes", params={"page_size": 500})
check("GET /kg/nodes?page_size=500 → code 0 or 3002", r.get("code") in (0, 3002))
if r.get("code") == 0:
    d = r.get("data", {})
    check("nodes response has items array", "items" in d)
    print(f"  {INFO} KG nodes: {d.get('total', 0)}")

# refreshKG: GET /kg/edges?page_size=2000
r = req("GET", "/kg/edges", params={"page_size": 2000})
check("GET /kg/edges?page_size=2000 → code=0", r.get("code") == 0)

# refreshDocuments: GET /documents?page=1&page_size=100
r = req("GET", "/documents", params={"page": 1, "page_size": 100})
check("GET /documents?page=1&page_size=100 → code=0", r.get("code") == 0)
d = r.get("data", {})
check("documents has items + total", "items" in d and "total" in d)

# refreshHistory: GET /query/history?page=1&page_size=50
r = req("GET", "/query/history", params={"page": 1, "page_size": 50})
check("GET /query/history?page=1&page_size=50 → code=0", r.get("code") == 0)
d = r.get("data", {})
check("history has items + total", "items" in d and "total" in d)

# refreshHealthStats: GET /health
r = req("GET", "/health")
check("GET /health → code=0", r.get("code") == 0)
d = r.get("data", {})
check("health has components", "components" in d)
check("health.components has mineru_venv", "mineru_venv" in d.get("components", {}))
check("health.components has langextract_venv", "langextract_venv" in d.get("components", {}))
check("health.components has deepseek_api", "deepseek_api" in d.get("components", {}))
check("health.components has storage", "storage" in d.get("components", {}))

# refreshHealthStats: GET /system/stats
r = req("GET", "/system/stats")
check("GET /system/stats → code=0", r.get("code") == 0)
d = r.get("data", {})
check("stats has total_nodes", "total_nodes" in d)
check("stats has total_edges", "total_edges" in d)
check("stats has total_documents", "total_documents" in d)
check("stats has total_queries", "total_queries" in d)

# ─────────────────────────────────────────────────────────────────────────────
# Header.tsx — Real-time entity typeahead
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{SECTION} Header.tsx — entity typeahead search")

r = req("GET", "/search/entities", params={"q": "graph", "limit": 5})
check("GET /search/entities?q=graph&limit=5 → code=0", r.get("code") == 0)
d = r.get("data", {})
check("search result has items array", "items" in d)
check("search result has query field", "query" in d)
print(f"  {INFO} 'graph' suggestions: {d.get('total', 0)} results")

# ─────────────────────────────────────────────────────────────────────────────
# Dashboard.tsx — Stats + health (same as store, already tested)
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{SECTION} Dashboard.tsx — stats cards + health panel")
print(f"  {INFO} Dashboard uses store data (already tested above)")

# ─────────────────────────────────────────────────────────────────────────────
# Documents.tsx — Upload, Index, Cancel, Delete
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{SECTION} Documents.tsx — document lifecycle APIs")

# Upload validation (unsupported format)
boundary = "boundary123"
body = (
    f"--{boundary}\r\n"
    f'Content-Disposition: form-data; name="file"; filename="test.xyz"\r\n'
    f"Content-Type: application/octet-stream\r\n\r\n"
    f"dummy\r\n"
    f"--{boundary}--\r\n"
).encode()
upload_req = urllib.request.Request(
    BASE + "/documents/upload", data=body, method="POST",
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
)
try:
    urllib.request.urlopen(upload_req, timeout=10)
    r_up = {}
except urllib.error.HTTPError as e:
    r_up = json.loads(e.read().decode())
check("Upload .xyz → code=1002 (unsupported format)", r_up.get("code") == 1002)

# Start indexing nonexistent doc → 2001
r = req("POST", "/index/start", body={"doc_id": "nonexistent"})
check("POST /index/start nonexistent doc → code=2001", r.get("code") == 2001)

# Get job status nonexistent → 2002
r = req("GET", "/index/status/fakejob")
check("GET /index/status/fakejob → code=2002", r.get("code") == 2002)

# Get job result nonexistent → 2002
r = req("GET", "/index/result/fakejob")
check("GET /index/result/fakejob → code=2002", r.get("code") == 2002)

# Cancel nonexistent job → 2002
r = req("DELETE", "/index/jobs/fakejob")
check("DELETE /index/jobs/fakejob → code=2002", r.get("code") == 2002)

# Delete nonexistent doc → 2001
r = req("DELETE", "/documents/nonexistent_doc")
check("DELETE /documents/nonexistent_doc → code=2001", r.get("code") == 2001)

# ─────────────────────────────────────────────────────────────────────────────
# KGExplorer.tsx — Node list, edges, node detail, neighbors
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{SECTION} KGExplorer.tsx — KG data loading")

r = req("GET", "/kg/nodes", params={"page_size": 500})
check("GET /kg/nodes → code 0 or 3002", r.get("code") in (0, 3002))
nodes_loaded = []
if r.get("code") == 0:
    nodes_loaded = r["data"].get("items", [])
    print(f"  {INFO} Loaded {len(nodes_loaded)} nodes for KG Explorer")

r = req("GET", "/kg/edges", params={"page_size": 2000})
check("GET /kg/edges → code=0", r.get("code") == 0)
edges_loaded = r.get("data", {}).get("items", []) if r.get("code") == 0 else []
print(f"  {INFO} Loaded {len(edges_loaded)} edges for KG Explorer")

# Node detail (invalid)
r = req("GET", "/kg/nodes/definitely_fake_node_id")
check("GET /kg/nodes/fake_id → code=3001", r.get("code") == 3001)

# If nodes exist, test detail + neighbors
if nodes_loaded:
    node_id = nodes_loaded[0]["id"]
    r = req("GET", f"/kg/nodes/{node_id}")
    check(f"GET /kg/nodes/{node_id} → code=0", r.get("code") == 0)

    r = req("GET", f"/kg/nodes/{node_id}/neighbors", params={"hops": 1})
    check(f"GET /kg/nodes/{node_id}/neighbors?hops=1 → code=0", r.get("code") == 0)
    d = r.get("data", {})
    check("neighbors has center + neighbors_by_hop", "center" in d and "neighbors_by_hop" in d)

# KG export
r = req("GET", "/kg/export")
check("GET /kg/export → code=0", r.get("code") == 0)

# ─────────────────────────────────────────────────────────────────────────────
# SearchPage.tsx — Entity, Path, Graph search
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{SECTION} SearchPage.tsx — search APIs")

# Entity search (no type filter)
r = req("GET", "/search/entities", params={"q": "graph", "limit": 50})
check("GET /search/entities?q=graph&limit=50 → code=0", r.get("code") == 0)
d = r.get("data", {})
check("entity search has query, total, items", all(k in d for k in ("query", "total", "items")))
entity_items = d.get("items", [])
print(f"  {INFO} Entity search 'graph': {d.get('total', 0)} results")

# Entity search with type filter
r = req("GET", "/search/entities", params={"q": "graph", "type": "TECHNOLOGY", "limit": 15})
check("GET /search/entities?type=TECHNOLOGY → code=0", r.get("code") == 0)

# Path search — missing from/to → code=1001
r = req("GET", "/search/path", params={"max_hops": 2})
check("GET /search/path (no from/to) → code=1001", r.get("code") == 1001)

# Path search — with node IDs from KG
if len(nodes_loaded) >= 2:
    n1 = nodes_loaded[0]["id"]
    n2 = nodes_loaded[1]["id"]
    r = req("GET", "/search/path", params={"from": n1, "to": n2, "max_hops": 3})
    check(f"GET /search/path?from={n1[:8]}...&to={n2[:8]}... → code 0 or 3001",
          r.get("code") in (0, 3001))
    if r.get("code") == 0:
        d = r.get("data", {})
        check("path result has paths array", "paths" in d)
        total = d.get("total_paths", 0)
        hops = d["paths"][0]["length"] if d.get("paths") else "?"
        print(f"  {INFO} Paths found: {total} paths, shortest={hops} hops")
else:
    print(f"  {INFO} Skipping path search — KG empty")

# Graph search
r = req("GET", "/search/graph", params={"q": "knowledge", "include_neighbors": "true"})
check("GET /search/graph?q=knowledge&include_neighbors=true → code=0", r.get("code") == 0)
d = r.get("data", {})
check("graph search has matched_nodes + subgraph_edges", "matched_nodes" in d and "subgraph_edges" in d)
print(f"  {INFO} Graph search 'knowledge': {d.get('total_nodes', 0)} nodes")

# ─────────────────────────────────────────────────────────────────────────────
# QAChat.tsx — Query + history
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{SECTION} QAChat.tsx — query history")

# Query history load
r = req("GET", "/query/history", params={"page": 1, "page_size": 50})
check("GET /query/history → code=0", r.get("code") == 0)
d = r.get("data", {})
check("history has items + total + page + page_size",
      all(k in d for k in ("items", "total", "page", "page_size")))
print(f"  {INFO} Query history: {d.get('total', 0)} records")

# POST /query — not tested here to avoid consuming DeepSeek API tokens
# (It requires KG data + DeepSeek API to be working)
print(f"  {INFO} POST /query skipped (requires KG data + DeepSeek API)")

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
total = results["passed"] + results["failed"]
print(f"\n{'='*60}")
print(f"Frontend Integration Test Results: {results['passed']}/{total} passed")
if results["failed"] == 0:
    print(f"{PASS} All integration tests passed!")
else:
    print(f"{FAIL} {results['failed']} test(s) failed")
print(f"{'='*60}")
sys.exit(0 if results["failed"] == 0 else 1)
