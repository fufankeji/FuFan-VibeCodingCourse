"""KG Service — NetworkX graph operations over the global KG."""
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
                   doc_id=e.get("doc_id", ""),
                   page=e.get("page", 0))
    return G


def get_nodes(page: int = 1, page_size: int = 50,
              node_type: str | None = None,
              doc_id: str | None = None,
              confidence: str | None = None) -> dict:
    nodes = fs.load_kg_nodes()
    G = _load_graph()
    # Attach degree
    degrees = dict(G.degree())
    for n in nodes:
        n["degree"] = degrees.get(n["id"], 0)

    if node_type:
        nodes = [n for n in nodes if n.get("type", "").upper() == node_type.upper()]
    if doc_id:
        nodes = [n for n in nodes if n.get("source_doc") == doc_id]
    if confidence:
        nodes = [n for n in nodes if n.get("confidence") == confidence]

    total = len(nodes)
    start = (page - 1) * page_size
    return {"total": total, "page": page, "page_size": page_size,
            "items": nodes[start: start + page_size]}


def get_edges(page: int = 1, page_size: int = 100,
              doc_id: str | None = None,
              relation: str | None = None) -> dict:
    edges = fs.load_kg_edges()
    if doc_id:
        edges = [e for e in edges if e.get("doc_id") == doc_id]
    if relation:
        edges = [e for e in edges if e.get("relation") == relation]
    total = len(edges)
    start = (page - 1) * page_size
    return {"total": total, "page": page, "page_size": page_size,
            "items": edges[start: start + page_size]}


def get_node_detail(node_id: str) -> dict | None:
    nodes = fs.load_kg_nodes()
    node = next((n for n in nodes if n["id"] == node_id), None)
    if not node:
        return None
    G = _load_graph()
    if node_id not in G:
        node["degree"] = 0
        node["degree_centrality"] = 0.0
        node["neighbor_count"] = 0
        return node
    deg = G.degree(node_id)
    centrality = nx.degree_centrality(G)
    node["degree"] = deg
    node["degree_centrality"] = round(centrality.get(node_id, 0.0), 4)
    node["neighbor_count"] = deg
    return node


def get_neighbors(node_id: str, hops: int = 1) -> dict | None:
    nodes = fs.load_kg_nodes()
    node = next((n for n in nodes if n["id"] == node_id), None)
    if not node:
        return None
    G = _load_graph()
    if node_id not in G:
        return {
            "center": {"id": node_id, "name": node["name"], "type": node["type"], "page": node.get("page", 0)},
            "hops": hops, "neighbors_by_hop": {}, "total_neighbors": 0,
        }
    hops = max(1, min(hops, 3))
    reachable = nx.single_source_shortest_path_length(G, node_id, cutoff=hops)
    by_hop: dict[str, list] = {}
    for nid, dist in reachable.items():
        if dist == 0:
            continue
        nd = G.nodes[nid]
        by_hop.setdefault(str(dist), []).append({
            "id": nid, "name": nd.get("name", ""), "type": nd.get("type", ""), "page": nd.get("page", 0)
        })
    total = sum(len(v) for v in by_hop.values())
    return {
        "center": {"id": node_id, "name": node["name"], "type": node["type"], "page": node.get("page", 0)},
        "hops": hops,
        "neighbors_by_hop": by_hop,
        "total_neighbors": total,
    }


def get_stats() -> dict:
    nodes = fs.load_kg_nodes()
    edges = fs.load_kg_edges()
    G = _load_graph()

    type_dist: dict[str, int] = {}
    for n in nodes:
        t = n.get("type", "UNKNOWN")
        type_dist[t] = type_dist.get(t, 0) + 1

    relation_types: dict[str, int] = {}
    for e in edges:
        r = e.get("relation", "CO_OCCURS_IN")
        relation_types[r] = relation_types.get(r, 0) + 1

    density = round(nx.density(G), 4) if G.number_of_nodes() > 1 else 0.0

    top5: list[dict] = []
    if G.number_of_nodes() > 0:
        centrality = nx.degree_centrality(G)
        for nid, c in sorted(centrality.items(), key=lambda x: x[1], reverse=True)[:5]:
            nd = G.nodes[nid]
            top5.append({"node_id": nid, "name": nd.get("name", ""), "type": nd.get("type", ""),
                         "centrality": round(c, 4)})

    source_docs = list({n.get("source_doc", "") for n in nodes if n.get("source_doc")})

    return {
        "total_nodes": len(nodes),
        "total_edges": len(edges),
        "density": density,
        "type_distribution": type_dist,
        "relation_types": relation_types,
        "top5_central_nodes": top5,
        "source_documents": source_docs,
    }


def export_kg(doc_id: str | None = None) -> dict:
    from datetime import datetime, timezone
    nodes = fs.load_kg_nodes()
    edges = fs.load_kg_edges()
    G = _load_graph()
    degrees = dict(G.degree())
    for n in nodes:
        n["degree"] = degrees.get(n["id"], 0)
    if doc_id:
        nodes = [n for n in nodes if n.get("source_doc") == doc_id]
        edges = [e for e in edges if e.get("doc_id") == doc_id]
    return {
        "format": "json",
        "doc_id": doc_id,
        "total_nodes": len(nodes),
        "total_edges": len(edges),
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "nodes": nodes,
        "edges": edges,
    }
