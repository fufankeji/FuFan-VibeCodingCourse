"""
KG Builder — node deduplication + CO_OCCURS_IN edge generation.
Independent implementation for the GraphRAG Studio backend.
"""
from __future__ import annotations

from collections import defaultdict

import langextract as lx

from pipeline.text_assembler import PageText

ACCEPTED_ALIGNMENTS = {"match_exact", "match_greater", "match_lesser"}


def build_kg(
    pages: list[PageText],
    annotated_docs: list[lx.data.AnnotatedDocument],
    source_doc_id: str,
) -> tuple[list[dict], list[dict]]:
    """Build KG nodes and edges from LangExtract results.

    Returns:
        (nodes, edges) — deduplicated node list and edge list.
    """
    # Phase 1: collect raw entities
    raw_entities = []
    for page, doc in zip(pages, annotated_docs):
        if not doc.extractions:
            continue
        for ext in doc.extractions:
            status = ext.alignment_status.value if ext.alignment_status else None
            if status not in ACCEPTED_ALIGNMENTS:
                continue
            char_start = ext.char_interval.start_pos if ext.char_interval else None
            char_end = ext.char_interval.end_pos if ext.char_interval else None
            raw_entities.append({
                "name": ext.extraction_text,
                "type": ext.extraction_class,
                "char_start": char_start,
                "char_end": char_end,
                "confidence": status,
                "page": page.page_idx,
                "source_doc": source_doc_id,
            })

    # Phase 2: deduplicate nodes
    seen: dict[tuple[str, str], int] = {}
    nodes: list[dict] = []
    node_pages: dict[int, set[int]] = defaultdict(set)

    for entity in raw_entities:
        type_prefix = entity["type"].lower()[:4]
        name_slug = entity["name"].lower().replace(" ", "")[:12]
        dedup_key = (entity["name"].lower(), entity["type"])
        if dedup_key not in seen:
            node_idx = len(nodes)
            seen[dedup_key] = node_idx
            nodes.append({
                "id": f"{type_prefix}_{name_slug}_{node_idx}",
                "name": entity["name"],
                "type": entity["type"],
                "source_doc": entity["source_doc"],
                "char_start": entity["char_start"],
                "char_end": entity["char_end"],
                "confidence": entity["confidence"],
                "page": entity["page"],
            })
        node_idx = seen[dedup_key]
        node_pages[node_idx].add(entity["page"])

    # Phase 3: CO_OCCURS_IN edges
    page_nodes: dict[int, list[int]] = defaultdict(list)
    for node_idx, page_set in node_pages.items():
        for page_idx in page_set:
            page_nodes[page_idx].append(node_idx)

    edges: list[dict] = []
    edge_seen: set[tuple] = set()

    for page_idx, node_indices in sorted(page_nodes.items()):
        for i in range(len(node_indices)):
            for j in range(i + 1, len(node_indices)):
                a = nodes[node_indices[i]]["id"]
                b = nodes[node_indices[j]]["id"]
                src, tgt = (a, b) if a < b else (b, a)
                key = (src, tgt, source_doc_id, page_idx)
                if key in edge_seen:
                    continue
                edge_seen.add(key)
                edges.append({
                    "source": src,
                    "target": tgt,
                    "relation": "CO_OCCURS_IN",
                    "doc_id": source_doc_id,
                    "page": page_idx,
                })

    return nodes, edges


def extractions_to_records(
    pages: list[PageText],
    annotated_docs: list[lx.data.AnnotatedDocument],
    doc_id: str,
) -> list[dict]:
    """Flatten LangExtract results to ExtractionRecord dicts."""
    records = []
    for page, doc in zip(pages, annotated_docs):
        if not doc.extractions:
            continue
        for ext in doc.extractions:
            status = ext.alignment_status.value if ext.alignment_status else None
            records.append({
                "text": ext.extraction_text,
                "type": ext.extraction_class,
                "char_start": ext.char_interval.start_pos if ext.char_interval else None,
                "char_end": ext.char_interval.end_pos if ext.char_interval else None,
                "alignment": status,
                "page": page.page_idx,
                "doc_id": doc_id,
            })
    return records
