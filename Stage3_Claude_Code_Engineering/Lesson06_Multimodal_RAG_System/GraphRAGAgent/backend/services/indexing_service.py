"""Indexing Service — Pipeline orchestration (parsing → extracting → indexing)."""
from __future__ import annotations

import json
import os
import subprocess
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

from storage import file_store as fs
from services.document_service import update_doc_status

load_dotenv(Path(__file__).parent.parent / ".env", override=True)

MINERU_PYTHON = Path(os.getenv("MINERU_PYTHON", "F:/GraphRAGAgent/mineru_mvp/.venv/Scripts/python.exe"))
MINERU_PIPELINE = Path(os.getenv("MINERU_PIPELINE", "F:/GraphRAGAgent/mineru_mvp/pipeline.py"))

# In-memory registry of active jobs {job_id: threading.Thread}
_active_threads: dict[str, threading.Thread] = {}
_cancel_flags: dict[str, bool] = {}


def start_indexing(doc_id: str) -> dict:
    doc = fs.get_doc(doc_id)
    if not doc:
        return None  # type: ignore

    job_id = f"job_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()

    meta = {
        "job_id": job_id,
        "doc_id": doc_id,
        "status": "submitted",
        "stage": "Job submitted",
        "progress": {"parsed_pages": 0, "total_pages": 0, "extracted_entities": 0},
        "created_at": now,
        "elapsed_seconds": 0.0,
        "error": None,
        "pdf_name": doc["filename"],
        "pdf_path": str(fs.UPLOADS_DIR / doc.get("upload_filename", "")),
    }
    fs.save_job_meta(job_id, meta)

    _cancel_flags[job_id] = False
    thread = threading.Thread(target=_run_pipeline, args=(job_id,), daemon=True)
    _active_threads[job_id] = thread
    thread.start()

    return meta


def _update_meta(job_id: str, **kwargs) -> None:
    meta = fs.load_job_meta(job_id) or {}
    meta.update(kwargs)
    meta["elapsed_seconds"] = round(
        (datetime.now(timezone.utc) - datetime.fromisoformat(meta["created_at"])).total_seconds(), 1
    )
    fs.save_job_meta(job_id, meta)


def _run_pipeline(job_id: str) -> None:
    meta = fs.load_job_meta(job_id)
    if not meta:
        return

    doc_id = meta["doc_id"]
    pdf_path = Path(meta["pdf_path"])
    job_dir = fs.job_dir(job_id)
    start_time = time.time()

    try:
        # ── Stage 1: parsing ──────────────────────────────────────────────
        if _cancel_flags.get(job_id):
            _update_meta(job_id, status="cancelled", stage="Cancelled")
            return

        _update_meta(job_id, status="parsing", stage="MinerU document parsing...")
        mineru_out_dir = job_dir / "mineru_output"
        mineru_out_dir.mkdir(parents=True, exist_ok=True)

        result = subprocess.run(
            [str(MINERU_PYTHON), str(MINERU_PIPELINE), str(pdf_path)],
            cwd=str(MINERU_PIPELINE.parent),
            capture_output=True,
            text=True,
            timeout=600,
        )

        if result.returncode != 0:
            raise RuntimeError(f"MinerU failed: {result.stderr[:500]}")

        # Find content_list.json in MinerU output
        # MinerU writes output to mineru_mvp/output/{stem}/
        stem = pdf_path.stem
        mineru_default_out = MINERU_PIPELINE.parent / "output" / stem
        content_list_path = None

        if mineru_default_out.exists():
            matches = list(mineru_default_out.glob("*_content_list.json"))
            if matches:
                content_list_path = matches[0]
                # Copy to our job dir
                import shutil
                shutil.copytree(str(mineru_default_out), str(mineru_out_dir), dirs_exist_ok=True)

        if not content_list_path:
            # Fallback: search job mineru_output dir
            matches = list(mineru_out_dir.glob("*_content_list.json"))
            if matches:
                content_list_path = matches[0]

        if not content_list_path or not content_list_path.exists():
            raise RuntimeError(f"MinerU output content_list.json not found. stdout: {result.stdout[:300]}")

        # ── Stage 2: extracting ───────────────────────────────────────────
        if _cancel_flags.get(job_id):
            _update_meta(job_id, status="cancelled", stage="Cancelled")
            return

        from pipeline.text_assembler import load_content_list, assemble_pages, count_blocks_by_type
        from pipeline.entity_extractor import create_model, extract_entities
        from pipeline.kg_builder import build_kg, extractions_to_records

        content_list = load_content_list(content_list_path)
        pages = assemble_pages(content_list)
        total_pages = len(pages)
        block_types = count_blocks_by_type(content_list)

        _update_meta(
            job_id,
            status="extracting",
            stage=f"Extracting entities (LangExtract + DeepSeek)...",
            progress={"parsed_pages": total_pages, "total_pages": total_pages, "extracted_entities": 0},
        )
        update_doc_status(doc_id, "indexing", pages=total_pages)

        model = create_model()
        annotated_docs = []
        total_entities = 0

        for i, page in enumerate(pages):
            if _cancel_flags.get(job_id):
                _update_meta(job_id, status="cancelled", stage="Cancelled")
                return

            _update_meta(
                job_id,
                stage=f"Extracting entities page {i+1}/{total_pages} (LangExtract + DeepSeek)...",
                progress={"parsed_pages": total_pages, "total_pages": total_pages,
                          "extracted_entities": total_entities},
            )
            ann_doc = extract_entities(page.text, model)
            annotated_docs.append(ann_doc)
            total_entities += len(ann_doc.extractions) if ann_doc.extractions else 0

        # Save raw extractions
        records = extractions_to_records(pages, annotated_docs, doc_id)
        fs.write_json(job_dir / "extractions.json", records)

        # ── Stage 3: indexing ─────────────────────────────────────────────
        _update_meta(job_id, status="indexing", stage="Building knowledge graph...")

        nodes, edges = build_kg(pages, annotated_docs, doc_id)
        fs.write_json(job_dir / "kg_nodes.json", nodes)
        fs.write_json(job_dir / "kg_edges.json", edges)

        # Merge into global KG
        fs.merge_kg(nodes, edges, doc_id)

        # Count alignment types
        alignment_counts: dict[str, int] = {}
        type_counts: dict[str, int] = {}
        for r in records:
            al = r.get("alignment") or "null"
            alignment_counts[al] = alignment_counts.get(al, 0) + 1
            t = r.get("type", "UNKNOWN")
            type_counts[t] = type_counts.get(t, 0) + 1

        elapsed = round(time.time() - start_time, 1)
        stats = {
            "blocks": len(content_list),
            "block_types": block_types,
            "pages": total_pages,
            "raw_extractions": len(records),
            "nodes": len(nodes),
            "edges": len(edges),
            "type_counts": type_counts,
            "alignment_counts": alignment_counts,
            "elapsed_seconds": elapsed,
        }
        fs.write_json(job_dir / "stats.json", stats)

        _update_meta(
            job_id,
            status="done",
            stage="Complete",
            progress={"parsed_pages": total_pages, "total_pages": total_pages,
                      "extracted_entities": len(records)},
        )
        update_doc_status(doc_id, "indexed", pages=total_pages)

    except Exception as exc:
        _update_meta(job_id, status="failed", stage=f"Error: {exc}", error=str(exc))
        update_doc_status(doc_id, "failed")
    finally:
        _active_threads.pop(job_id, None)
        _cancel_flags.pop(job_id, None)


def get_job_status(job_id: str) -> dict | None:
    return fs.load_job_meta(job_id)


def get_job_result(job_id: str) -> dict | None:
    meta = fs.load_job_meta(job_id)
    if not meta:
        return None
    if meta["status"] != "done":
        return meta

    job_dir = fs.job_dir(job_id)
    stats = fs.read_json(job_dir / "stats.json") or {}
    extractions = fs.read_json(job_dir / "extractions.json") or []
    nodes = fs.read_json(job_dir / "kg_nodes.json") or []
    edges = fs.read_json(job_dir / "kg_edges.json") or []

    return {
        "job_id": meta["job_id"],
        "doc_id": meta["doc_id"],
        "status": "done",
        "stats": stats,
        "extractions": extractions,
        "nodes": nodes,
        "edges": edges,
    }


def cancel_job(job_id: str) -> tuple[bool, str]:
    meta = fs.load_job_meta(job_id)
    if not meta:
        return False, "not_found"
    prev_status = meta["status"]
    _cancel_flags[job_id] = True
    _update_meta(job_id, status="cancelled", stage="Cancelled by user")
    return True, prev_status


def count_active_jobs() -> int:
    return sum(1 for t in _active_threads.values() if t.is_alive())
