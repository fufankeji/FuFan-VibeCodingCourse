"""Search Service — entity, path, and graph search."""
from __future__ import annotations

import networkx as nx

from storage import file_store as fs


def _load_graph() -> nx.Graph:
    nodes = fs.load_kg_nodes()
    edges = fs.load_kg_edges()
    G = nx.Graph()
    for n in nodes:
        G.add_node(n["id"], **n)
    for e in edges:
        G.add_edge(e["source"], e["target"],
                   relation=e.get("relation", "CO_OCCURS_IN"),
                   doc_id=e.get("doc_id", ""), page=e.get("page", 0))
    return G


def search_entities(q: str, entity_type: str | None = None, limit: int = 15) -> dict:
    nodes = fs.load_kg_nodes()
    G = _load_graph()
    degrees = dict(G.degree())
    q_lower = q.lower()
    matches = [n for n in nodes if q_lower in n.get("name", "").lower()]
    if entity_type:
        matches = [n for n in matches if n.get("type", "").upper() == entity_type.upper()]
    for n in matches:
        n["degree"] = degrees.get(n["id"], 0)
    matches = matches[:limit]
    return {"query": q, "total": len(matches), "items": matches}


def search_path(from_id: str, to_id: str, max_hops: int = 3) -> dict | None:
    nodes = fs.load_kg_nodes()
    node_map = {n["id"]: n for n in nodes}
    if from_id not in node_map or to_id not in node_map:
        return None  # node not found

    G = _load_graph()
    max_hops = max(1, min(max_hops, 5))

    try:
        raw_paths = list(nx.all_simple_paths(G, from_id, to_id, cutoff=max_hops))
    except nx.NetworkXError:
        raw_paths = []

    paths = []
    for path_nodes in raw_paths:
        path_edges = []
        for i in range(len(path_nodes) - 1):
            s, t = path_nodes[i], path_nodes[i + 1]
            edge_data = G.edges[s, t]
            path_edges.append({"source": s, "target": t,
                                "relation": edge_data.get("relation", "CO_OCCURS_IN")})
        paths.append({
            "length": len(path_nodes) - 1,
            "nodes": [{"id": nid, "name": node_map.get(nid, {}).get("name", nid),
                       "type": node_map.get(nid, {}).get("type", "")} for nid in path_nodes],
            "edges": path_edges,
        })

    from_node = node_map[from_id]
    to_node = node_map[to_id]
    return {
        "from": {"id": from_id, "name": from_node.get("name", ""), "type": from_node.get("type", "")},
        "to": {"id": to_id, "name": to_node.get("name", ""), "type": to_node.get("type", "")},
        "max_hops": max_hops,
        "paths": paths,
        "total_paths": len(paths),
    }


def search_graph(q: str, include_neighbors: bool = False) -> dict:
    nodes = fs.load_kg_nodes()
    edges = fs.load_kg_edges()
    G = _load_graph()
    degrees = dict(G.degree())
    q_lower = q.lower()

    matched = [n for n in nodes if q_lower in n.get("name", "").lower()]
    matched_ids = {n["id"] for n in matched}
    for n in matched:
        n["degree"] = degrees.get(n["id"], 0)

    if include_neighbors:
        neighbor_ids = set()
        for nid in matched_ids:
            if nid in G:
                neighbor_ids.update(G.neighbors(nid))
        all_relevant = matched_ids | neighbor_ids
    else:
        all_relevant = matched_ids

    subgraph_edges = [
        e for e in edges
        if e.get("source") in all_relevant and e.get("target") in all_relevant
    ]

    return {
        "query": q,
        "matched_nodes": matched,
        "subgraph_edges": subgraph_edges,
    }
