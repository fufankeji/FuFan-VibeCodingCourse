"""
KG Builder — Node deduplication + CO_OCCURS_IN edge generation
===============================================================
Builds knowledge graph nodes and edges from LangExtract extraction results.
"""

from __future__ import annotations

from collections import defaultdict

import langextract as lx

from text_assembler import BlockSpan, PageText, find_source_block

# Alignment statuses considered reliable
ACCEPTED_ALIGNMENTS = {"match_exact", "match_greater", "match_lesser"}


def build_kg(
    pages: list[PageText],
    annotated_docs: list[lx.data.AnnotatedDocument],
    source_doc_id: str,
) -> tuple[list[dict], list[dict]]:
    """Build KG nodes and edges from extraction results.

    Args:
        pages: Assembled page texts with block spans.
        annotated_docs: LangExtract results, one per page.
        source_doc_id: Document identifier for provenance.

    Returns:
        (nodes, edges) — deduplicated node list and edge list.
    """
    # --- Phase 1: Collect raw entities with provenance ---
    raw_entities = []
    for page, doc in zip(pages, annotated_docs):
        if not doc.extractions:
            continue
        for ext in doc.extractions:
            # Filter by alignment quality
            status = ext.alignment_status.value if ext.alignment_status else None
            if status not in ACCEPTED_ALIGNMENTS:
                continue

            # Map char offset to source block
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

    # --- Phase 2: Deduplicate nodes ---
    seen: dict[tuple[str, str], int] = {}  # (name_lower, type) -> node index
    nodes = []
    # Also track which pages each node appears on
    node_pages: dict[int, set[int]] = defaultdict(set)

    for entity in raw_entities:
        dedup_key = (entity["name"].lower(), entity["type"])
        if dedup_key not in seen:
            node_idx = len(nodes)
            seen[dedup_key] = node_idx
            nodes.append({
                "id": f"node_{node_idx}",
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

    # --- Phase 3: Generate CO_OCCURS_IN edges ---
    # Group node indices by page
    page_nodes: dict[int, list[int]] = defaultdict(list)
    for node_idx, page_set in node_pages.items():
        for page_idx in page_set:
            page_nodes[page_idx].append(node_idx)

    edges = []
    edge_seen: set[tuple[str, str, str, int]] = set()

    for page_idx, node_indices in sorted(page_nodes.items()):
        # All pairs on this page
        for i in range(len(node_indices)):
            for j in range(i + 1, len(node_indices)):
                a = nodes[node_indices[i]]["id"]
                b = nodes[node_indices[j]]["id"]
                src, tgt = (a, b) if a < b else (b, a)
                dedup_key = (src, tgt, source_doc_id, page_idx)

                if dedup_key in edge_seen:
                    continue
                edge_seen.add(dedup_key)

                edges.append({
                    "source": src,
                    "target": tgt,
                    "relation": "CO_OCCURS_IN",
                    "doc_id": source_doc_id,
                    "page": page_idx,
                })

    return nodes, edges
