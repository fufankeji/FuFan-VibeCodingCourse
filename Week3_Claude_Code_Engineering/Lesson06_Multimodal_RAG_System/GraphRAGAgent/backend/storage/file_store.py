"""
File Store — unified JSON read/write for all backend data.
All data lives under backend/data/.
"""
from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from typing import Any

# Root data directory relative to this file
_BASE = Path(__file__).parent.parent / "data"

UPLOADS_DIR = _BASE / "uploads"
JOBS_DIR    = _BASE / "jobs"
KG_DIR      = _BASE / "kg"
QUERY_DIR   = _BASE / "jobs"  # query_history.jsonl lives here

# Ensure directories exist at import time
for _d in (UPLOADS_DIR, JOBS_DIR, KG_DIR):
    _d.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Generic helpers
# ---------------------------------------------------------------------------

def read_json(path: Path) -> Any:
    """Read and parse a JSON file. Returns None if file doesn't exist."""
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: Any) -> None:
    """Atomically write data as JSON (write to .tmp then rename)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def append_jsonl(path: Path, record: dict) -> None:
    """Append a record to a JSONL file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def read_jsonl(path: Path) -> list[dict]:
    """Read all records from a JSONL file."""
    if not path.exists():
        return []
    records = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return records


# ---------------------------------------------------------------------------
# Document helpers
# ---------------------------------------------------------------------------

def docs_index_path() -> Path:
    return _BASE / "docs_index.json"


def load_docs_index() -> dict[str, dict]:
    """Load the documents index {doc_id: DocumentInfo dict}."""
    data = read_json(docs_index_path())
    return data if isinstance(data, dict) else {}


def save_docs_index(index: dict[str, dict]) -> None:
    write_json(docs_index_path(), index)


def get_doc(doc_id: str) -> dict | None:
    return load_docs_index().get(doc_id)


def save_doc(doc: dict) -> None:
    index = load_docs_index()
    index[doc["doc_id"]] = doc
    save_docs_index(index)


def delete_doc(doc_id: str) -> bool:
    index = load_docs_index()
    if doc_id not in index:
        return False
    del index[doc_id]
    save_docs_index(index)
    # Remove upload file
    doc_info = index.get(doc_id, {})
    upload_path = UPLOADS_DIR / doc_info.get("upload_filename", "")
    if upload_path.exists():
        upload_path.unlink()
    return True


# ---------------------------------------------------------------------------
# Job helpers
# ---------------------------------------------------------------------------

def job_dir(job_id: str) -> Path:
    return JOBS_DIR / job_id


def job_meta_path(job_id: str) -> Path:
    return job_dir(job_id) / "meta.json"


def load_job_meta(job_id: str) -> dict | None:
    return read_json(job_meta_path(job_id))


def save_job_meta(job_id: str, meta: dict) -> None:
    job_dir(job_id).mkdir(parents=True, exist_ok=True)
    write_json(job_meta_path(job_id), meta)


def list_all_jobs() -> list[dict]:
    metas = []
    for d in JOBS_DIR.iterdir():
        if d.is_dir():
            meta = read_json(d / "meta.json")
            if meta:
                metas.append(meta)
    return metas


def delete_job(job_id: str) -> None:
    jd = job_dir(job_id)
    if jd.exists():
        shutil.rmtree(jd)


# ---------------------------------------------------------------------------
# Global KG helpers
# ---------------------------------------------------------------------------

def kg_nodes_path() -> Path:
    return KG_DIR / "kg_nodes.json"


def kg_edges_path() -> Path:
    return KG_DIR / "kg_edges.json"


def load_kg_nodes() -> list[dict]:
    data = read_json(kg_nodes_path())
    return data if isinstance(data, list) else []


def load_kg_edges() -> list[dict]:
    data = read_json(kg_edges_path())
    return data if isinstance(data, list) else []


def save_kg_nodes(nodes: list[dict]) -> None:
    write_json(kg_nodes_path(), nodes)


def save_kg_edges(edges: list[dict]) -> None:
    write_json(kg_edges_path(), edges)


def merge_kg(new_nodes: list[dict], new_edges: list[dict], doc_id: str) -> tuple[int, int]:
    """Merge job KG output into global KG. Returns (removed_old, added_new)."""
    existing_nodes = load_kg_nodes()
    existing_edges = load_kg_edges()

    # Remove nodes/edges from this doc
    existing_nodes = [n for n in existing_nodes if n.get("source_doc") != doc_id]
    existing_edges = [e for e in existing_edges if e.get("doc_id") != doc_id]

    # Merge: deduplicate nodes by (name.lower(), type)
    node_keys: set[tuple] = {(n["name"].lower(), n["type"]) for n in existing_nodes}
    for n in new_nodes:
        key = (n["name"].lower(), n["type"])
        if key not in node_keys:
            existing_nodes.append(n)
            node_keys.add(key)

    # Merge edges: deduplicate by (min(src,tgt), max(src,tgt), doc_id)
    edge_keys: set[tuple] = set()
    for e in existing_edges:
        s, t = e["source"], e["target"]
        edge_keys.add((min(s, t), max(s, t), e["doc_id"]))

    for e in new_edges:
        s, t = e["source"], e["target"]
        key = (min(s, t), max(s, t), e["doc_id"])
        if key not in edge_keys:
            existing_edges.append(e)
            edge_keys.add(key)

    save_kg_nodes(existing_nodes)
    save_kg_edges(existing_edges)
    return len(existing_nodes), len(existing_edges)


def remove_doc_from_kg(doc_id: str) -> tuple[int, int]:
    """Remove all nodes/edges from a document. Returns (removed_nodes, removed_edges)."""
    nodes = load_kg_nodes()
    edges = load_kg_edges()
    old_n, old_e = len(nodes), len(edges)
    nodes = [n for n in nodes if n.get("source_doc") != doc_id]
    edges = [e for e in edges if e.get("doc_id") != doc_id]
    save_kg_nodes(nodes)
    save_kg_edges(edges)
    return old_n - len(nodes), old_e - len(edges)


# ---------------------------------------------------------------------------
# Query history helpers
# ---------------------------------------------------------------------------

def query_history_path() -> Path:
    return _BASE / "query_history.jsonl"


def append_query_history(result: dict) -> None:
    append_jsonl(query_history_path(), result)


def load_query_history() -> list[dict]:
    records = read_jsonl(query_history_path())
    return list(reversed(records))  # newest first


# ---------------------------------------------------------------------------
# Batch job helpers
# ---------------------------------------------------------------------------

def batch_meta_path(batch_id: str) -> Path:
    return _BASE / "batches" / f"{batch_id}.json"


def load_batch_meta(batch_id: str) -> dict | None:
    return read_json(batch_meta_path(batch_id))


def save_batch_meta(batch_id: str, meta: dict) -> None:
    write_json(batch_meta_path(batch_id), meta)


# ---------------------------------------------------------------------------
# Storage usage
# ---------------------------------------------------------------------------

def storage_used_mb() -> float:
    total = 0
    for path in _BASE.rglob("*"):
        if path.is_file():
            total += path.stat().st_size
    return round(total / (1024 * 1024), 2)
