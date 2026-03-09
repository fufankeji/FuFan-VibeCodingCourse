"""
Agentic-RAG MVP — Knowledge Graph QA Agent
============================================
LangGraph ReAct agent that answers questions by reasoning over the
Knowledge Graph produced by the Bridge Pipeline.

Data source (read-only):
    graphrag_pipeline/output/kg_nodes.json  — 40 deduplicated entities
    graphrag_pipeline/output/kg_edges.json  — 780 CO_OCCURS_IN edges

LLM:
    DeepSeek (deepseek-chat) via LangChain ChatOpenAI
    — adapted to LangChain standard component with base_url override
    — see: docs.langchain.com/oss/python/langchain/models#base-url-and-proxy

Agent framework:
    LangGraph create_react_agent (langgraph.prebuilt)
    — tools_condition for conditional edges (tool_call ↔ END)
    — standard ReAct loop: think → tool_call → observe → repeat

Tools (KG-only, no embeddings):
    search_entities       — substring search over node names
    get_neighbors         — BFS N-hop graph traversal
    get_entities_by_type  — filter nodes by entity type
    describe_graph        — graph-level statistics overview

Run:
    F:/GraphRAGAgent/langextract_src/.venv/Scripts/python.exe \\
        F:/GraphRAGAgent/graphrag_pipeline/agentic_rag_mvp.py
"""

import json
import os
import sys
from pathlib import Path

import networkx as nx
from dotenv import load_dotenv
from langchain.tools import tool
from langchain_openai import ChatOpenAI
from langchain.agents import create_agent

# ---------------------------------------------------------------------------
# 0. Config — DeepSeek via LangChain ChatOpenAI (base_url adapter)
#    Ref: https://docs.langchain.com/oss/python/langchain/models
# ---------------------------------------------------------------------------
_env_path = Path(__file__).parent / ".env"
load_dotenv(_env_path, override=True)

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

if not DEEPSEEK_API_KEY:
    sys.exit("[ERROR] DEEPSEEK_API_KEY not found in graphrag_pipeline/.env")

# LangChain v1 standard: ChatOpenAI with base_url for OpenAI-compatible APIs
# DeepSeek requires trailing /v1 is handled by the SDK; base_url root is fine
llm = ChatOpenAI(
    model="deepseek-chat",
    api_key=DEEPSEEK_API_KEY,
    base_url=DEEPSEEK_BASE_URL,
    temperature=0,  # deterministic for QA
)

# ---------------------------------------------------------------------------
# 1. Load KG — NetworkX graph from Bridge Pipeline output
#    kg_nodes.json: {id, name, type, source_doc, char_start, char_end, confidence, page}
#    kg_edges.json: {source, target, relation, doc_id, page}
# ---------------------------------------------------------------------------
_KG_DIR = Path(__file__).parent / "output"

def _load_kg() -> nx.Graph:
    nodes = json.loads((_KG_DIR / "kg_nodes.json").read_text(encoding="utf-8"))
    edges = json.loads((_KG_DIR / "kg_edges.json").read_text(encoding="utf-8"))
    G = nx.Graph()
    for n in nodes:
        G.add_node(n["id"], **n)
    for e in edges:
        G.add_edge(
            e["source"], e["target"],
            relation=e["relation"],
            doc_id=e["doc_id"],
            page=e["page"],
        )
    return G

G = _load_kg()
print(f"[KG] Loaded: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")

# ---------------------------------------------------------------------------
# 2. Tools — KG-only retrieval (no embeddings)
#    LangChain v1: @tool decorator, auto-generates JSON schema from docstring
#    Ref: https://docs.langchain.com/oss/python/langchain/rag
# ---------------------------------------------------------------------------

@tool
def search_entities(query: str) -> str:
    """Search knowledge graph entities by name using case-insensitive substring matching.

    Returns entity names, types, confidence, and page location.
    Use this first when the user mentions a specific term, concept, or technology.

    Args:
        query: Keyword or phrase to search for in entity names.
    """
    q = query.lower()
    matches = [
        data for _, data in G.nodes(data=True)
        if q in data.get("name", "").lower()
    ]
    if not matches:
        all_names = [data.get("name", "") for _, data in G.nodes(data=True)]
        sample = ", ".join(all_names[:8])
        return f"No entities found matching '{query}'. Sample entities: {sample}"

    lines = [f"Found {len(matches)} entity(ies) matching '{query}':"]
    for m in matches[:15]:
        lines.append(
            f"  [{m['type']}] \"{m['name']}\" "
            f"(confidence={m['confidence']}, page={m['page']}, id={m['id']})"
        )
    return "\n".join(lines)


@tool
def get_neighbors(entity_name: str, hops: int = 1) -> str:
    """Traverse the knowledge graph to find entities related to a given entity.

    Performs BFS from the target entity up to N hops away.
    Use for multi-hop reasoning: 'what is related to X', 'how does A connect to B'.

    Args:
        entity_name: Name (or partial name) of the entity to start from.
        hops: Number of hops (1=direct neighbors only, 2=two hops). Max 3. Default 1.
    """
    hops = max(1, min(int(hops), 3))

    # Find starting node (partial match)
    candidates = [
        (nid, data) for nid, data in G.nodes(data=True)
        if entity_name.lower() in data.get("name", "").lower()
    ]
    if not candidates:
        return (
            f"Entity '{entity_name}' not found in graph. "
            "Use search_entities to find the correct name first."
        )

    node_id, node_data = candidates[0]
    reachable = nx.single_source_shortest_path_length(G, node_id, cutoff=hops)

    by_hop: dict[int, list] = {}
    for nid, dist in reachable.items():
        if dist == 0:
            continue
        by_hop.setdefault(dist, []).append(G.nodes[nid])

    lines = [
        f"Neighbors of '{node_data['name']}' [{node_data['type']}] "
        f"within {hops} hop(s):"
    ]
    for hop in sorted(by_hop.keys()):
        nodes_at_hop = by_hop[hop]
        lines.append(f"\n  Hop {hop} — {len(nodes_at_hop)} related entities:")
        for n in nodes_at_hop[:20]:
            lines.append(f"    [{n['type']}] {n['name']}")
        if len(nodes_at_hop) > 20:
            lines.append(f"    ... and {len(nodes_at_hop) - 20} more")

    total_related = sum(len(v) for v in by_hop.values())
    lines.append(f"\n  Total related entities: {total_related}")
    return "\n".join(lines)


@tool
def get_entities_by_type(entity_type: str) -> str:
    """List all knowledge graph entities of a specific type.

    Valid types: TECHNOLOGY, CONCEPT, PERSON, ORGANIZATION, LOCATION.
    Use when the user asks to enumerate specific categories of entities.

    Args:
        entity_type: One of TECHNOLOGY, CONCEPT, PERSON, ORGANIZATION, LOCATION.
    """
    t_upper = entity_type.strip().upper()
    valid_types = {"TECHNOLOGY", "CONCEPT", "PERSON", "ORGANIZATION", "LOCATION"}

    if t_upper not in valid_types:
        present = sorted({d.get("type", "") for _, d in G.nodes(data=True)})
        return (
            f"Unknown type '{entity_type}'. "
            f"Valid types present in graph: {present}"
        )

    matches = [
        data for _, data in G.nodes(data=True)
        if data.get("type", "") == t_upper
    ]
    if not matches:
        return f"No entities of type '{t_upper}' in the knowledge graph."

    lines = [f"{t_upper} entities ({len(matches)} total):"]
    for m in sorted(matches, key=lambda x: x.get("name", "")):
        lines.append(
            f"  • {m['name']} "
            f"(confidence={m['confidence']}, page={m['page']})"
        )
    return "\n".join(lines)


@tool
def describe_graph() -> str:
    """Get a statistical overview of the entire knowledge graph.

    Returns: node count, edge count, type distribution, graph density,
    and the top-5 most connected (central) entities.
    Use when the user asks about the overall knowledge base content or structure.
    """
    # Type distribution
    type_counts: dict[str, int] = {}
    for _, data in G.nodes(data=True):
        t = data.get("type", "UNKNOWN")
        type_counts[t] = type_counts.get(t, 0) + 1

    # Degree centrality — most connected nodes
    centrality = nx.degree_centrality(G)
    top5 = sorted(centrality.items(), key=lambda x: -x[1])[:5]

    lines = [
        "=== Knowledge Graph Overview ===",
        f"  Nodes (entities):  {G.number_of_nodes()}",
        f"  Edges (relations): {G.number_of_edges()}",
        f"  Relation type:     CO_OCCURS_IN (same-page co-occurrence)",
        f"  Graph density:     {nx.density(G):.4f}",
        "",
        "  Entity type distribution:",
    ]
    for t, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        lines.append(f"    {t:15s}: {count:3d}")

    lines.append("")
    lines.append("  Top-5 most connected entities (by degree centrality):")
    for nid, score in top5:
        d = G.nodes[nid]
        lines.append(f"    [{d['type']}] {d['name']} (centrality={score:.3f})")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 3. Agent — LangGraph create_react_agent
#    Standard ReAct loop: LLM reasons → calls tool → observes result → repeats
#    LangChain v1: create_agent (replaces langgraph.prebuilt.create_react_agent)
#    Ref: https://docs.langchain.com/oss/python/releases/langchain-v1
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """\
You are a Knowledge Graph QA assistant. You have access to a knowledge graph
extracted from academic documents about GraphRAG and related technologies.

The graph contains:
- 40 deduplicated entities (TECHNOLOGY and CONCEPT types)
- 780 CO_OCCURS_IN edges representing same-page co-occurrence

Available tools:
1. search_entities      — find entities by keyword substring
2. get_neighbors        — explore entity relationships (N-hop BFS)
3. get_entities_by_type — list all entities of a type
4. describe_graph       — get graph statistics overview

Reasoning strategy:
- Always use at least one tool before answering a factual question
- For relationship questions, use get_neighbors after identifying the entity with search_entities
- For enumeration questions, use get_entities_by_type
- Synthesize tool results into a clear, concise answer
- Cite the entity names and types in your final answer
"""

_tools = [search_entities, get_neighbors, get_entities_by_type, describe_graph]
agent = create_agent(
    model=llm,
    tools=_tools,
    system_prompt=SYSTEM_PROMPT,
)


# ---------------------------------------------------------------------------
# 4. Run — connectivity test with 4 representative queries
# ---------------------------------------------------------------------------
def run_query(question: str, label: str = "") -> str:
    """Invoke the agent with a single question, return final answer."""
    tag = f"[{label}] " if label else ""
    print(f"\n{'='*60}")
    print(f"{tag}Q: {question}")
    print("=" * 60)

    result = agent.invoke({"messages": [("human", question)]})

    # Extract final AI message
    final_msg = result["messages"][-1]
    answer = final_msg.content if hasattr(final_msg, "content") else str(final_msg)

    print(f"A: {answer}")
    return answer


def main():
    print("\n" + "=" * 60)
    print("  Agentic-RAG MVP — KG-only QA Connectivity Test")
    print("  LLM: DeepSeek (deepseek-chat) via LangChain ChatOpenAI")
    print("  Graph: NetworkX | Framework: LangGraph create_react_agent")
    print("=" * 60)

    # Test 1: Graph overview
    run_query(
        "Give me an overview of the knowledge graph. "
        "What types of entities does it contain and which entities are most central?",
        label="T1-Overview",
    )

    # Test 2: Entity search + type enumeration
    run_query(
        "What technology entities are in the knowledge graph? "
        "List all of them with brief descriptions of what each one is.",
        label="T2-Technologies",
    )

    # Test 3: Multi-hop relationship reasoning
    run_query(
        "What concepts and technologies are most closely related to GraphRAG? "
        "Explore the graph neighborhood and explain the connections.",
        label="T3-MultiHop",
    )

    # Test 4: Targeted concept lookup
    run_query(
        "Explain what 'retrieval-augmented generation' is based on the knowledge graph. "
        "What other entities is it connected to?",
        label="T4-ConceptLookup",
    )

    print(f"\n{'='*60}")
    print("  Connectivity test complete.")
    print("=" * 60)


if __name__ == "__main__":
    main()
