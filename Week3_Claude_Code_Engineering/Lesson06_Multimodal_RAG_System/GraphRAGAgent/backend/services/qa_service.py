"""QA Service — Agentic-RAG wrapper."""
from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone

from storage import file_store as fs


def run_query(question: str, history: list[dict]) -> dict:
    from pipeline.qa_agent import run_qa

    nodes = fs.load_kg_nodes()
    edges = fs.load_kg_edges()

    if not nodes:
        raise ValueError("KG_EMPTY")

    start = time.time()
    result = run_qa(question, history, nodes, edges)
    elapsed = round(time.time() - start, 2)

    query_id = f"q_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()

    record = {
        "id": query_id,
        "question": question,
        "answer": result["answer"],
        "tool_calls": result["tool_calls"],
        "cited_nodes": result["cited_nodes"],
        "duration_seconds": elapsed,
        "timestamp": now,
    }
    fs.append_query_history(record)
    return record


def get_history(page: int = 1, page_size: int = 20) -> dict:
    all_records = fs.load_query_history()
    total = len(all_records)
    start = (page - 1) * page_size
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": all_records[start: start + page_size],
    }


def start_batch(questions: list[str]) -> dict:
    import threading

    batch_id = f"batch_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()
    meta = {
        "batch_id": batch_id,
        "total": len(questions),
        "completed": 0,
        "failed": 0,
        "status": "submitted",
        "created_at": now,
        "results": [],
    }
    fs.save_batch_meta(batch_id, meta)

    def _run():
        for q in questions:
            try:
                res = run_query(q, [])
                meta["results"].append(res)
                meta["completed"] += 1
            except Exception as e:
                meta["failed"] += 1
                meta["results"].append({"question": q, "error": str(e)})
        meta["status"] = "done"
        fs.save_batch_meta(batch_id, meta)

    threading.Thread(target=_run, daemon=True).start()
    return {"batch_id": batch_id, "total": len(questions), "status": "submitted", "created_at": now}


def get_batch_result(batch_id: str) -> dict | None:
    return fs.load_batch_meta(batch_id)
