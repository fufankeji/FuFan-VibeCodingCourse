"""
GraphRAG Bridge Pipeline
=========================
MinerU content_list.json → LangExtract entity extraction → KG nodes/edges

Usage:
    python bridge.py                                    # Use default test_sample
    python bridge.py path/to/content_list.json          # Use specific file
    python bridge.py path/to/output_dir/                # Auto-find *_content_list.json
"""

import json
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

# Load .env from this script's directory
load_dotenv(Path(__file__).parent / ".env", override=True)

from text_assembler import assemble_pages, load_content_list
from entity_extractor import create_model, extract_entities
from kg_builder import build_kg

OUTPUT_DIR = Path(__file__).parent / "output"
DEFAULT_INPUT = Path(__file__).parent.parent / "mineru_mvp" / "output" / "test_sample"


def print_header(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def save_json(data, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def main():
    print_header("GraphRAG Bridge Pipeline")
    print("  MinerU → LangExtract → Knowledge Graph")

    # 1. Determine input path
    if len(sys.argv) > 1:
        input_path = Path(sys.argv[1])
    else:
        input_path = DEFAULT_INPUT

    print(f"\n  Input: {input_path}")
    print(f"  Output: {OUTPUT_DIR}")

    # 2. Load MinerU content_list
    print_header("Step 1: Load MinerU Output")
    content_list = load_content_list(input_path)
    print(f"  Loaded {len(content_list)} blocks")

    # Derive source_doc_id from filename
    if input_path.is_file():
        source_doc_id = input_path.stem.replace("_content_list", "")
    else:
        matches = list(input_path.glob("*_content_list.json"))
        source_doc_id = matches[0].stem.replace("_content_list", "") if matches else "unknown"
    print(f"  Source doc ID: {source_doc_id}")

    # Count block types
    type_counts = {}
    for block in content_list:
        t = block.get("type", "unknown")
        type_counts[t] = type_counts.get(t, 0) + 1
    print(f"  Block types: {type_counts}")

    # 3. Assemble text per page
    print_header("Step 2: Assemble Text by Page")
    pages = assemble_pages(content_list)
    for page in pages:
        print(f"  Page {page.page_idx}: {len(page.text)} chars, {len(page.block_spans)} blocks")

    # 4. Initialize model
    print_header("Step 3: Entity Extraction (LangExtract + DeepSeek)")
    model = create_model()
    print(f"  Model: {model.model_id}")
    print(f"  Base URL: {model.base_url}")

    # 5. Extract entities per page
    annotated_docs = []
    total_start = time.time()

    for page in pages:
        print(f"\n  --- Page {page.page_idx} ---")
        start = time.time()
        doc = extract_entities(page.text, model)
        elapsed = time.time() - start

        n_extractions = len(doc.extractions) if doc.extractions else 0
        print(f"  Extractions: {n_extractions} ({elapsed:.1f}s)")

        if doc.extractions:
            # Count by type
            cls_counts = {}
            for ext in doc.extractions:
                cls_counts[ext.extraction_class] = cls_counts.get(ext.extraction_class, 0) + 1
            print(f"  Types: {cls_counts}")

            # Count by alignment
            align_counts = {}
            for ext in doc.extractions:
                a = ext.alignment_status.value if ext.alignment_status else "null"
                align_counts[a] = align_counts.get(a, 0) + 1
            print(f"  Alignment: {align_counts}")

        annotated_docs.append(doc)

    total_elapsed = time.time() - total_start
    print(f"\n  Total extraction time: {total_elapsed:.1f}s")

    # 6. Build KG
    print_header("Step 4: Build Knowledge Graph")
    nodes, edges = build_kg(pages, annotated_docs, source_doc_id)
    print(f"  Nodes: {len(nodes)} (deduplicated)")
    print(f"  Edges: {len(edges)} (CO_OCCURS_IN)")

    if nodes:
        print(f"\n  Node types:")
        node_type_counts = {}
        for n in nodes:
            node_type_counts[n["type"]] = node_type_counts.get(n["type"], 0) + 1
        for t, c in sorted(node_type_counts.items()):
            print(f"    {t}: {c}")

    # 7. Save output
    print_header("Step 5: Save Output")
    nodes_path = OUTPUT_DIR / "kg_nodes.json"
    edges_path = OUTPUT_DIR / "kg_edges.json"
    save_json(nodes, nodes_path)
    save_json(edges, edges_path)
    print(f"  Saved: {nodes_path}")
    print(f"  Saved: {edges_path}")

    # Print sample nodes
    if nodes:
        print(f"\n  Sample nodes (first 5):")
        for n in nodes[:5]:
            print(f"    {n['id']}: {n['name']} [{n['type']}] (page={n['page']}, {n['confidence']})")

    print_header("Bridge Pipeline Complete")
    print(f"  Input: {len(content_list)} blocks → {len(pages)} pages")
    print(f"  Output: {len(nodes)} nodes, {len(edges)} edges")
    print(f"  Results: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
