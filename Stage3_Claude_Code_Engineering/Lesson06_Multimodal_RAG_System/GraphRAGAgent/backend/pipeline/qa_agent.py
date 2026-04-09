"""
QA Agent — LangGraph ReAct agent over the knowledge graph.
Independent implementation for the GraphRAG Studio backend.
"""
from __future__ import annotations

import os
import re
from pathlib import Path

import networkx as nx
from dotenv import load_dotenv
from langchain.tools import tool
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage, SystemMessage
from langgraph.prebuilt import create_react_agent

load_dotenv(Path(__file__).parent.parent / ".env", override=True)

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")


def build_kg_graph(nodes: list[dict], edges: list[dict]) -> nx.Graph:
    G = nx.Graph()
    for n in nodes:
        G.add_node(n["id"], **n)
    for e in edges:
        G.add_edge(e["source"], e["target"], **{k: v for k, v in e.items() if k not in ("source", "target")})
    return G


def make_tools(G: nx.Graph) -> list:
    @tool
    def search_entities(query: str) -> str:
        """Search knowledge graph entities by name (case-insensitive substring).
        Args:
            query: Keyword to search for in entity names.
        """
        q = query.lower()
        matches = [data for _, data in G.nodes(data=True) if q in data.get("name", "").lower()]
        if not matches:
            sample = ", ".join(d.get("name", "") for _, d in list(G.nodes(data=True))[:8])
            return f"No entities found matching '{query}'. Sample: {sample}"
        lines = [f"Found {len(matches)} entity(ies) matching '{query}':"]
        for m in matches[:15]:
            lines.append(
                f"  [{m['type']}] \"{m['name']}\" "
                f"(confidence={m.get('confidence','?')}, page={m.get('page',0)}, id={m['id']})"
            )
        return "\n".join(lines)

    @tool
    def get_neighbors(entity_name: str, hops: int = 1) -> str:
        """Get N-hop neighbors of an entity in the knowledge graph.
        Args:
            entity_name: Entity name (partial match).
            hops: Number of hops (1-3, default 1).
        """
        hops = max(1, min(int(hops), 3))
        candidates = [(nid, d) for nid, d in G.nodes(data=True)
                      if entity_name.lower() in d.get("name", "").lower()]
        if not candidates:
            return f"Entity '{entity_name}' not found. Use search_entities first."
        node_id, node_data = candidates[0]
        reachable = nx.single_source_shortest_path_length(G, node_id, cutoff=hops)
        by_hop: dict[int, list] = {}
        for nid, dist in reachable.items():
            if dist > 0:
                by_hop.setdefault(dist, []).append(G.nodes[nid])
        lines = [f"Neighbors of '{node_data['name']}' [{node_data['type']}] within {hops} hop(s):"]
        for hop in sorted(by_hop.keys()):
            hop_nodes = by_hop[hop]
            lines.append(f"\n  Hop {hop} — {len(hop_nodes)} related entities:")
            for n in hop_nodes[:20]:
                lines.append(f"    [{n.get('type','?')}] {n.get('name','?')}")
            if len(hop_nodes) > 20:
                lines.append(f"    ... and {len(hop_nodes)-20} more")
        lines.append(f"\n  Total related entities: {sum(len(v) for v in by_hop.values())}")
        return "\n".join(lines)

    @tool
    def get_entities_by_type(entity_type: str) -> str:
        """List all entities of a specific type.
        Args:
            entity_type: TECHNOLOGY, CONCEPT, PERSON, ORGANIZATION, or LOCATION.
        """
        t_upper = entity_type.strip().upper()
        valid = {"TECHNOLOGY", "CONCEPT", "PERSON", "ORGANIZATION", "LOCATION"}
        if t_upper not in valid:
            present = sorted({d.get("type","") for _, d in G.nodes(data=True)})
            return f"Unknown type '{entity_type}'. Present: {present}"
        matches = [d for _, d in G.nodes(data=True) if d.get("type","") == t_upper]
        if not matches:
            return f"No {t_upper} entities found."
        lines = [f"Found {len(matches)} {t_upper} entities:"]
        for m in matches[:30]:
            lines.append(f"  \"{m['name']}\" (page={m.get('page',0)}, id={m['id']})")
        if len(matches) > 30:
            lines.append(f"  ... and {len(matches)-30} more")
        return "\n".join(lines)

    @tool
    def describe_graph() -> str:
        """Get an overview of the knowledge graph statistics."""
        n_nodes = G.number_of_nodes()
        n_edges = G.number_of_edges()
        type_counts: dict[str, int] = {}
        for _, d in G.nodes(data=True):
            t = d.get("type", "UNKNOWN")
            type_counts[t] = type_counts.get(t, 0) + 1
        lines = [
            f"Knowledge Graph Overview:",
            f"  Nodes: {n_nodes}",
            f"  Edges: {n_edges}",
            f"  Entity types: {type_counts}",
        ]
        if n_nodes > 0:
            centrality = nx.degree_centrality(G)
            top5 = sorted(centrality.items(), key=lambda x: x[1], reverse=True)[:5]
            lines.append("  Top 5 central nodes:")
            for nid, c in top5:
                nd = G.nodes[nid]
                lines.append(f"    [{nd.get('type','?')}] {nd.get('name','?')} (centrality={c:.3f})")
        return "\n".join(lines)

    return [search_entities, get_neighbors, get_entities_by_type, describe_graph]


def run_qa(
    question: str,
    history: list[dict],
    nodes: list[dict],
    edges: list[dict],
) -> dict:
    """Run Agentic-RAG QA. Returns dict with answer, tool_calls, cited_nodes."""
    if not DEEPSEEK_API_KEY:
        raise ValueError("DEEPSEEK_API_KEY not set in backend/.env")

    G = build_kg_graph(nodes, edges)
    tools = make_tools(G)

    llm = ChatOpenAI(
        model="deepseek-chat",
        api_key=DEEPSEEK_API_KEY,
        base_url=DEEPSEEK_BASE_URL,
        temperature=0,
    )

    system_prompt = (
        "You are a helpful assistant with access to a knowledge graph (KG) built from the user's documents.\n"
        "\n"
        "Guidelines:\n"
        "- If the question is clearly unrelated to the KG (greetings, math, general knowledge, etc.), "
        "answer directly WITHOUT using any tools.\n"
        "- If the question might be answered by the KG (topics related to entities in the documents), "
        "use the tools to search and explore before answering.\n"
        "- When you DO use the KG, cite the entity names and types you found.\n"
        "- If the KG has no relevant information, say so honestly and answer from general knowledge if possible.\n"
        "\n"
        "Available tools: search entities by name, get neighbors, list entities by type, get graph overview."
    )

    agent = create_react_agent(llm, tools, prompt=system_prompt)

    # Build messages: system + history + current question
    messages: list = []
    for msg in history[-8:]:
        role = msg.get("role", "human")
        content = msg.get("content", "") or msg.get("answer", "")
        if role == "human":
            messages.append(HumanMessage(content=msg.get("question", content)))
        else:
            messages.append(AIMessage(content=content))
    messages.append(HumanMessage(content=question))

    result = agent.invoke({"messages": messages})

    # Extract answer from last AIMessage
    answer = ""
    for msg in reversed(result.get("messages", [])):
        if isinstance(msg, AIMessage) and msg.content and not msg.tool_calls:
            answer = msg.content
            break

    # Extract tool calls and cited node IDs from message history
    tool_calls = []
    cited_node_ids: set[str] = set()
    step = 0
    all_messages = result.get("messages", [])
    for i, msg in enumerate(all_messages):
        if isinstance(msg, AIMessage) and msg.tool_calls:
            for tc in msg.tool_calls:
                step += 1
                # Find the corresponding ToolMessage
                output = ""
                for j in range(i + 1, len(all_messages)):
                    tm = all_messages[j]
                    if isinstance(tm, ToolMessage) and tm.tool_call_id == tc.get("id"):
                        output = tm.content
                        break
                tool_input = tc.get("args", {})
                tool_calls.append({
                    "step": step,
                    "tool_name": tc.get("name", ""),
                    "tool_input": str(tool_input),
                    "tool_output": str(output),
                })
                # Extract node IDs mentioned in tool output
                for node_id in re.findall(r'\bid=([^\s,\)\]]+)', str(output)):
                    cited_node_ids.add(node_id)

    return {
        "answer": answer,
        "tool_calls": tool_calls,
        "cited_nodes": list(cited_node_ids),
    }
