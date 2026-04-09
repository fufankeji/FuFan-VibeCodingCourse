"""
GraphRAG Web Server
====================
Flask backend for the GraphRAG Knowledge Graph Visualizer.

Endpoints:
    GET  /                  → Serve index.html
    POST /api/upload        → Upload PDF, run full pipeline
    GET  /api/status/<id>   → Poll job progress
    GET  /api/result/<id>   → Get KG result JSON
    GET  /api/demo          → Load existing test_sample KG data

Usage:
    F:/GraphRAGAgent/langextract_src/.venv/Scripts/python.exe web_server.py
"""

import json
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory

# Load .env from this script's directory
load_dotenv(Path(__file__).parent / ".env", override=True)

# Ensure graphrag_pipeline modules are importable
sys.path.insert(0, str(Path(__file__).parent))

from text_assembler import assemble_pages, load_content_list
from entity_extractor import create_model, extract_entities
from kg_builder import build_kg

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).parent
PROJECT_ROOT = BASE_DIR.parent
STATIC_DIR = BASE_DIR / "static"
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "output"
MINERU_DIR = PROJECT_ROOT / "mineru_mvp"
MINERU_PYTHON = MINERU_DIR / ".venv" / "Scripts" / "python.exe"
MINERU_PIPELINE = MINERU_DIR / "pipeline.py"

UPLOAD_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------
app = Flask(__name__, static_folder=str(STATIC_DIR))

# In-memory job store
jobs: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    return send_from_directory(str(STATIC_DIR), "index.html")


@app.route("/api/demo")
def demo():
    """Return existing test_sample KG data for quick preview."""
    nodes_path = OUTPUT_DIR / "kg_nodes.json"
    edges_path = OUTPUT_DIR / "kg_edges.json"

    if not nodes_path.exists() or not edges_path.exists():
        return jsonify({"error": "Demo data not found. Run bridge.py first."}), 404

    with open(nodes_path, "r", encoding="utf-8") as f:
        nodes = json.load(f)
    with open(edges_path, "r", encoding="utf-8") as f:
        edges = json.load(f)

    # Compute stats
    type_counts = {}
    for n in nodes:
        type_counts[n["type"]] = type_counts.get(n["type"], 0) + 1

    return jsonify({
        "status": "done",
        "stats": {
            "nodes": len(nodes),
            "edges": len(edges),
            "type_counts": type_counts,
        },
        "nodes": nodes,
        "edges": edges,
    })


@app.route("/api/upload", methods=["POST"])
def upload():
    """Upload a PDF and start the full pipeline."""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are accepted"}), 400

    # Save uploaded file
    job_id = str(uuid.uuid4())[:8]
    pdf_path = UPLOAD_DIR / f"{job_id}_{file.filename}"
    file.save(str(pdf_path))

    # Initialize job
    jobs[job_id] = {
        "status": "uploaded",
        "stage": "PDF uploaded",
        "pdf_path": str(pdf_path),
        "pdf_name": file.filename,
        "result": None,
        "error": None,
    }

    # Start pipeline in background thread
    t = threading.Thread(target=run_pipeline, args=(job_id,), daemon=True)
    t.start()

    return jsonify({"job_id": job_id, "status": "uploaded"})


@app.route("/api/status/<job_id>")
def status(job_id):
    """Poll job progress."""
    if job_id not in jobs:
        return jsonify({"error": "Job not found"}), 404

    job = jobs[job_id]
    return jsonify({
        "job_id": job_id,
        "status": job["status"],
        "stage": job["stage"],
        "error": job["error"],
    })


@app.route("/api/result/<job_id>")
def result(job_id):
    """Get full KG result."""
    if job_id not in jobs:
        return jsonify({"error": "Job not found"}), 404

    job = jobs[job_id]
    if job["status"] != "done":
        return jsonify({
            "status": job["status"],
            "stage": job["stage"],
            "error": job["error"],
        })

    return jsonify(job["result"])


# ---------------------------------------------------------------------------
# Pipeline execution (runs in background thread)
# ---------------------------------------------------------------------------
def run_pipeline(job_id: str):
    """Execute MinerU → Bridge pipeline for a given job."""
    job = jobs[job_id]
    pdf_path = Path(job["pdf_path"])
    total_start = time.time()

    try:
        # --- Stage 1: MinerU PDF parsing ---
        job["status"] = "running"
        job["stage"] = "MinerU PDF parsing..."

        if not MINERU_PYTHON.exists():
            raise FileNotFoundError(f"MinerU Python not found: {MINERU_PYTHON}")

        result = subprocess.run(
            [str(MINERU_PYTHON), str(MINERU_PIPELINE), str(pdf_path)],
            cwd=str(MINERU_DIR),
            capture_output=True,
            text=True,
            timeout=600,
        )

        if result.returncode != 0:
            raise RuntimeError(f"MinerU failed:\n{result.stderr[-500:]}")

        # Find the output content_list.json
        pdf_stem = pdf_path.stem
        # MinerU output goes to mineru_mvp/output/{stem}/
        mineru_output_dir = MINERU_DIR / "output" / pdf_stem
        if not mineru_output_dir.exists():
            # Try to find any recent output directory
            output_dirs = sorted(
                (MINERU_DIR / "output").iterdir(),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
            mineru_output_dir = output_dirs[0] if output_dirs else None

        if not mineru_output_dir or not mineru_output_dir.exists():
            raise FileNotFoundError("MinerU output directory not found")

        # --- Stage 2: Text Assembly ---
        job["stage"] = "Assembling text from parsed blocks..."

        content_list = load_content_list(mineru_output_dir)
        pages = assemble_pages(content_list)

        # Derive source_doc_id
        content_list_files = list(mineru_output_dir.glob("*_content_list.json"))
        if content_list_files:
            source_doc_id = content_list_files[0].stem.replace("_content_list", "")
        else:
            source_doc_id = pdf_stem

        block_type_counts = {}
        for block in content_list:
            t = block.get("type", "unknown")
            block_type_counts[t] = block_type_counts.get(t, 0) + 1

        # --- Stage 3: Entity Extraction ---
        job["stage"] = "Extracting entities (LangExtract + DeepSeek)..."

        model = create_model()
        annotated_docs = []
        all_extractions = []

        for page in pages:
            doc = extract_entities(page.text, model)
            annotated_docs.append(doc)

            if doc.extractions:
                for ext in doc.extractions:
                    status_val = ext.alignment_status.value if ext.alignment_status else None
                    all_extractions.append({
                        "text": ext.extraction_text,
                        "type": ext.extraction_class,
                        "char_start": ext.char_interval.start_pos if ext.char_interval else None,
                        "char_end": ext.char_interval.end_pos if ext.char_interval else None,
                        "alignment": status_val,
                        "page": page.page_idx,
                    })

        # --- Stage 4: KG Construction ---
        job["stage"] = "Building knowledge graph..."

        nodes, edges = build_kg(pages, annotated_docs, source_doc_id)

        # Compute stats
        type_counts = {}
        for n in nodes:
            type_counts[n["type"]] = type_counts.get(n["type"], 0) + 1

        alignment_counts = {}
        for ext in all_extractions:
            a = ext["alignment"] or "null"
            alignment_counts[a] = alignment_counts.get(a, 0) + 1

        elapsed = time.time() - total_start

        # --- Done ---
        job["status"] = "done"
        job["stage"] = "Complete"
        job["result"] = {
            "status": "done",
            "stats": {
                "blocks": len(content_list),
                "block_types": block_type_counts,
                "pages": len(pages),
                "raw_extractions": len(all_extractions),
                "nodes": len(nodes),
                "edges": len(edges),
                "type_counts": type_counts,
                "alignment_counts": alignment_counts,
                "elapsed_seconds": round(elapsed, 1),
            },
            "extractions": all_extractions,
            "nodes": nodes,
            "edges": edges,
        }

    except Exception as e:
        job["status"] = "failed"
        job["stage"] = "Error"
        job["error"] = str(e)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("=" * 60)
    print("  GraphRAG Knowledge Graph Visualizer")
    print("=" * 60)
    print(f"  Static:  {STATIC_DIR}")
    print(f"  Uploads: {UPLOAD_DIR}")
    print(f"  Output:  {OUTPUT_DIR}")
    print(f"  MinerU:  {MINERU_PYTHON}")
    print()
    print("  Open http://localhost:5000 in your browser")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=True)
