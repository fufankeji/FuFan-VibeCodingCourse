"""
API integration tests — tests all major endpoints against a running server.
Run with: python tests/test_api.py
Server must be running on http://localhost:8000
"""
import json
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

BASE = "http://localhost:8000/api/v1"

PASS = "\033[92m[PASS]\033[0m"
FAIL = "\033[91m[FAIL]\033[0m"
INFO = "\033[94m[INFO]\033[0m"

results = {"passed": 0, "failed": 0}


def req(method: str, path: str, body: dict | None = None, form: dict | None = None) -> dict:
    url = BASE + path
    try:
        if method == "GET" and not body and not form:
            r = urllib.request.urlopen(url, timeout=30)
        else:
            if body is not None:
                data = json.dumps(body).encode()
                req_obj = urllib.request.Request(url, data=data, method=method,
                                                 headers={"Content-Type": "application/json"})
            else:
                req_obj = urllib.request.Request(url, method=method)
            r = urllib.request.urlopen(req_obj, timeout=30)
        return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode())


def check(name: str, condition: bool, detail: str = "") -> None:
    if condition:
        results["passed"] += 1
        print(f"  {PASS} {name}")
    else:
        results["failed"] += 1
        print(f"  {FAIL} {name}  {detail}")


def wait_for_server(max_retries: int = 15) -> bool:
    print(f"{INFO} Waiting for server at {BASE}...")
    for i in range(max_retries):
        try:
            urllib.request.urlopen(BASE.replace("/api/v1", "/"), timeout=3)
            print(f"{INFO} Server is up.")
            return True
        except Exception:
            time.sleep(1)
    return False


# ─────────────────────────────────────────────────────────────────────────────
# Test groups
# ─────────────────────────────────────────────────────────────────────────────

def test_system():
    print("\n── F 组: System ──")

    r = req("GET", "/health")
    check("GET /health returns code=0", r.get("code") == 0)
    check("health data.status exists", "status" in (r.get("data") or {}))
    check("health data.components exists", "components" in (r.get("data") or {}))
    print(f"  {INFO} status={r.get('data',{}).get('status')} uptime={r.get('data',{}).get('uptime_seconds')}s")

    r = req("GET", "/system/stats")
    check("GET /system/stats returns code=0", r.get("code") == 0)
    d = r.get("data") or {}
    check("stats has total_documents", "total_documents" in d)
    check("stats has total_nodes", "total_nodes" in d)
    print(f"  {INFO} docs={d.get('total_documents')} nodes={d.get('total_nodes')} edges={d.get('total_edges')}")

    r = req("GET", "/system/formats")
    check("GET /system/formats returns code=0", r.get("code") == 0)
    d = r.get("data") or {}
    check("formats list is non-empty", len(d.get("formats", [])) > 0)
    exts = [f["ext"] for f in d.get("formats", [])]
    check("pdf format present", "pdf" in exts)
    check("docx format present", "docx" in exts)

    r = req("GET", "/system/demo")
    check("GET /system/demo returns code=0 or 3002", r.get("code") in (0, 3002))
    if r.get("code") == 0:
        d = r.get("data") or {}
        check("demo data has nodes", "nodes" in d)
        print(f"  {INFO} demo: {len(d.get('nodes',[]))} nodes, {len(d.get('edges',[]))} edges")
    else:
        print(f"  {INFO} demo data not available (no KG yet) — code={r.get('code')}")


def test_documents():
    print("\n── A 组: Documents ──")

    r = req("GET", "/documents")
    check("GET /documents returns code=0", r.get("code") == 0)
    d = r.get("data") or {}
    check("documents list has total field", "total" in d)
    check("documents list has items field", "items" in d)
    print(f"  {INFO} total documents={d.get('total', 0)}")

    # Upload a test text file (not a real supported format to test validation)
    print("  Testing upload validation...")
    import urllib.request, io
    boundary = "boundary123"
    body_parts = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="test.xyz"\r\n'
        f"Content-Type: application/octet-stream\r\n\r\n"
        f"dummy content\r\n"
        f"--{boundary}--\r\n"
    ).encode()
    req_obj = urllib.request.Request(
        BASE + "/documents/upload",
        data=body_parts,
        method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    try:
        urllib.request.urlopen(req_obj, timeout=10)
        r_upload = {}
    except urllib.error.HTTPError as e:
        r_upload = json.loads(e.read().decode())
    check("upload unsupported format returns code=1002", r_upload.get("code") == 1002)

    r = req("GET", "/documents/nonexistent_id")
    check("GET /documents/nonexistent returns code=2001", r.get("code") == 2001)


def test_indexing():
    print("\n── B 组: Indexing ──")

    r = req("POST", "/index/start", body={"doc_id": "nonexistent_doc"})
    check("start indexing nonexistent doc returns 2001", r.get("code") == 2001)

    r = req("GET", "/index/status/nonexistent_job")
    check("get status nonexistent job returns 2002", r.get("code") == 2002)

    r = req("GET", "/index/result/nonexistent_job")
    check("get result nonexistent job returns 2002", r.get("code") == 2002)

    r = req("DELETE", "/index/jobs/nonexistent_job")
    check("cancel nonexistent job returns 2002", r.get("code") == 2002)


def test_kg():
    print("\n── C 组: Knowledge Graph ──")

    r = req("GET", "/kg/stats")
    check("GET /kg/stats returns code=0", r.get("code") == 0)
    d = r.get("data") or {}
    check("stats has total_nodes", "total_nodes" in d)
    check("stats has total_edges", "total_edges" in d)
    print(f"  {INFO} KG: {d.get('total_nodes')} nodes, {d.get('total_edges')} edges")

    r = req("GET", "/kg/nodes")
    check("GET /kg/nodes returns code 0 or 3002", r.get("code") in (0, 3002))
    if r.get("code") == 0:
        d = r.get("data") or {}
        check("nodes data has items", "items" in d)
        print(f"  {INFO} nodes total={d.get('total')}")

        if d.get("items"):
            node_id = d["items"][0]["id"]
            r2 = req("GET", f"/kg/nodes/{node_id}")
            check(f"GET /kg/nodes/{node_id} returns code=0", r2.get("code") == 0)

            r3 = req("GET", f"/kg/nodes/{node_id}/neighbors?hops=1")
            check(f"GET /kg/nodes/{node_id}/neighbors returns code=0", r3.get("code") == 0)
    else:
        print(f"  {INFO} KG is empty (code=3002) — skipping node detail tests")

    r = req("GET", "/kg/nodes/definitely_not_a_real_node")
    check("GET /kg/nodes/invalid returns code=3001", r.get("code") == 3001)

    r = req("GET", "/kg/edges")
    check("GET /kg/edges returns code=0", r.get("code") == 0)

    r = req("GET", "/kg/export")
    check("GET /kg/export returns code=0", r.get("code") == 0)


def test_search():
    print("\n── E 组: Search ──")

    r = req("GET", "/search/entities?q=graph")
    check("GET /search/entities returns code=0", r.get("code") == 0)
    d = r.get("data") or {}
    check("search entities has query field", "query" in d)
    check("search entities has items field", "items" in d)
    print(f"  {INFO} 'graph' search: {d.get('total', 0)} results")

    r = req("GET", "/search/entities?q=technology&type=TECHNOLOGY")
    check("GET /search/entities with type filter returns code=0", r.get("code") == 0)

    r = req("GET", "/search/path?max_hops=2")
    check("path search without from/to returns 1001", r.get("code") == 1001)

    r = req("GET", "/search/graph?q=knowledge")
    check("GET /search/graph returns code=0", r.get("code") == 0)
    d = r.get("data") or {}
    check("graph search has matched_nodes", "matched_nodes" in d)


def test_query():
    print("\n── D 组: QA Query ──")

    # Don't call /query (POST) in basic tests as it needs DeepSeek API + KG data
    r = req("GET", "/query/history")
    check("GET /query/history returns code=0", r.get("code") == 0)
    d = r.get("data") or {}
    check("history has total field", "total" in d)
    check("history has items field", "items" in d)
    print(f"  {INFO} query history: {d.get('total', 0)} records")

    r = req("GET", "/query/batch/nonexistent_batch")
    check("GET /query/batch/nonexistent returns 2002", r.get("code") == 2002)

    r = req("POST", "/query/batch", body={"questions": ["test question"]})
    check("POST /query/batch returns code=0", r.get("code") == 0)
    d = r.get("data") or {}
    check("batch has batch_id", "batch_id" in d)


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if not wait_for_server():
        print(f"\n{FAIL} Server not responding. Start with: python main.py")
        sys.exit(1)

    test_system()
    test_documents()
    test_indexing()
    test_kg()
    test_search()
    test_query()

    total = results["passed"] + results["failed"]
    print(f"\n{'='*50}")
    print(f"Results: {results['passed']}/{total} passed, {results['failed']} failed")
    if results["failed"] == 0:
        print(f"{PASS} All tests passed!")
    else:
        print(f"{FAIL} {results['failed']} test(s) failed")
    print(f"{'='*50}")
    sys.exit(0 if results["failed"] == 0 else 1)
