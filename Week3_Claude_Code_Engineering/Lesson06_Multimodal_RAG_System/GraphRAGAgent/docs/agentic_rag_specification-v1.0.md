# Agentic-RAG 规范文档 v1.0

> GraphRAG 问答阶段核心流程：Knowledge Graph → LangChain Agent → QA
>
> 数据来源：Bridge Pipeline 输出（`kg_nodes.json` + `kg_edges.json`）
> 测试验证日期：2026-03-05
> 全流程运行耗时：~40s（4 个测试查询）

---

## 目录

- [一、完整执行思路与脚本位置](#一完整执行思路与脚本位置)
- [二、LangChain Agent 输入输出规范](#二langchain-agent-输入输出规范)
- [三、MinerU ↔ Agentic-RAG 对接规范与核心架构](#三mineru--agentic-rag-对接规范与核心架构)
- [四、问答流程最终数据返回格式规范](#四问答流程最终数据返回格式规范)
- [五、虚拟环境与依赖](#五虚拟环境与依赖)

---

## 一、完整执行思路与脚本位置

### 1.1 总体架构定位

Agentic-RAG 是 GraphRAG 系统的**问答阶段**，位于 Bridge Pipeline 之后，负责将知识图谱转化为可交互的智能问答能力。

```
【已完成阶段】                              【本阶段：Agentic-RAG】
────────────────────                      ──────────────────────────
PDF
  ↓ MinerU Cloud API
content_list.json
  ↓ Bridge Pipeline
kg_nodes.json (40 nodes)    ──────────→  NetworkX Graph (内存)
kg_edges.json (780 edges)               ↓
                                         4 个 LangChain @tool
                                         ↓
                                         LangChain v1 create_agent
                                         (DeepSeek deepseek-chat)
                                         ↓
                                         ReAct 推理循环
                                         ↓
                                         自然语言答案
```

### 1.2 五步执行流程

| 步骤 | 模块 | 说明 |
|------|------|------|
| Step 0 | 环境 + 配置 | 加载 `.env`（DEEPSEEK_API_KEY），初始化 `ChatOpenAI` |
| Step 1 | KG 加载 | 读取 `kg_nodes.json` + `kg_edges.json`，构建 NetworkX 无向图 |
| Step 2 | Tool 注册 | 用 `@tool` 装饰器注册 4 个 KG 检索工具 |
| Step 3 | Agent 构建 | `create_agent(model, tools, system_prompt)` 编译 LangGraph |
| Step 4 | 问答调用 | `agent.invoke({"messages": [("human", question)]})` |
| Step 5 | 结果提取 | `result["messages"][-1].content` 获取最终答案 |

### 1.3 测试脚本存放位置

```
F:\GraphRAGAgent\graphrag_pipeline\
├── agentic_rag_mvp.py          ← 主测试脚本（本规范对应文件）
├── .env                         ← DEEPSEEK_API_KEY 配置
└── output/
    ├── kg_nodes.json            ← Bridge Pipeline 生成（40 节点）
    └── kg_edges.json            ← Bridge Pipeline 生成（780 边）
```

### 1.4 运行命令

```bash
# MVP 连通性测试（4 个预设测试查询）
F:/GraphRAGAgent/langextract_src/.venv/Scripts/python.exe \
    F:/GraphRAGAgent/graphrag_pipeline/agentic_rag_mvp.py
```

### 1.5 ReAct 推理循环详解

Agent 使用 **ReAct（Reasoning + Acting）** 模式，每个问题的处理流如下：

```
用户输入 (question: str)
    │
    ▼
┌─────────────────────────────────────────────────┐
│  LLM Reasoning（DeepSeek deepseek-chat）         │
│  决策：需要调用哪个工具？参数是什么？              │
└─────────────────────────────────────────────────┘
    │ tool_call
    ▼
┌─────────────────────────────────────────────────┐
│  Tool Execution（NetworkX 本地计算，无 API 调用）  │
│  search_entities / get_neighbors /               │
│  get_entities_by_type / describe_graph           │
└─────────────────────────────────────────────────┘
    │ ToolMessage（工具返回的文本结果）
    ▼
┌─────────────────────────────────────────────────┐
│  LLM Observation（观察工具结果）                  │
│  决策：结果够用了吗？还需要调更多工具？            │
└─────────────────────────────────────────────────┘
    │ 继续 tool_call 或输出最终答案
    ▼
AIMessage（最终自然语言答案）
```

**实测工具调用模式（4 个测试查询）：**

| 查询类型 | 工具调用序列 | 特点 |
|---------|------------|------|
| 图谱整体概览 | `describe_graph` | 单次工具调用 |
| 类型枚举 | `get_entities_by_type` | 单次工具调用 |
| 多跳关系推理 | `search_entities` → `get_neighbors` | 两步串行调用 |
| 概念精确查找 | `search_entities` → `get_neighbors` | 两步串行调用 |

---

## 二、LangChain Agent 输入输出规范

### 2.1 LLM 适配规范

#### 2.1.1 DeepSeek → LangChain 标准组件

LangChain v1 使用 `ChatOpenAI` 通过 `base_url` 覆盖接入任何 OpenAI 兼容 API：

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="deepseek-chat",                   # DeepSeek 模型名
    api_key=DEEPSEEK_API_KEY,                # 来自 graphrag_pipeline/.env
    base_url="https://api.deepseek.com",     # OpenAI 兼容端点
    temperature=0,                           # 问答场景确定性输出
)
```

| 参数 | 值 | 说明 |
|------|-----|------|
| `model` | `"deepseek-chat"` | DeepSeek 实际模型标识 |
| `api_key` | `${DEEPSEEK_API_KEY}` | 从 `.env` 读取，与 Bridge Pipeline 共用 |
| `base_url` | `"https://api.deepseek.com"` | SDK 自动补全 `/v1` 路径 |
| `temperature` | `0` | 问答场景设为 0，保证可重现性 |

#### 2.1.2 与 LangExtract 中 DeepSeek 的区别

| 对比项 | LangExtract 中的 DeepSeek | Agentic-RAG 中的 DeepSeek |
|--------|--------------------------|--------------------------|
| 接入方式 | 直接实例化 `OpenAILanguageModel` | LangChain `ChatOpenAI` 标准组件 |
| API Key 环境变量 | `OPENAI_API_KEY` | `DEEPSEEK_API_KEY` |
| 调用方式 | `lx.extract(model=model)` | `agent.invoke({"messages": ...})` |
| 输出格式 | JSON（实体抽取） | 自然语言（问答） |
| Tool Calling | 不支持（单轮推理） | 支持（ReAct 多轮） |

### 2.2 Agent 构建规范

#### 2.2.1 LangChain v1 create_agent

```python
from langchain.agents import create_agent

agent = create_agent(
    model=llm,              # ChatOpenAI 实例
    tools=_tools,           # List[BaseTool]，4 个工具
    system_prompt=SYSTEM_PROMPT,  # 系统提示词字符串
)
```

**版本注意事项：**

| API | 状态 | 说明 |
|-----|------|------|
| `langchain.agents.create_agent` | ✅ LangChain v1 推荐 | 本项目使用 |
| `langgraph.prebuilt.create_react_agent` | ⚠️ Deprecated in LangGraph V1.0 | 已废弃，勿用 |
| `langchain.agents.create_react_agent` (旧版) | ❌ Legacy | 已移除 |

#### 2.2.2 System Prompt 规范

```
You are a Knowledge Graph QA assistant. You have access to a knowledge graph
extracted from academic documents about GraphRAG and related technologies.

The graph contains:
- {node_count} deduplicated entities ({type_list} types)
- {edge_count} CO_OCCURS_IN edges representing same-page co-occurrence

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
```

### 2.3 Agent 输入规范

#### 2.3.1 invoke 输入格式

```python
result = agent.invoke({
    "messages": [
        ("human", question)   # 用户问题（自然语言字符串）
    ]
})
```

**输入字段规范：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `messages` | `list[tuple[str, str]]` | 消息列表，格式 `(role, content)` |
| `role` | `"human"` \| `"ai"` \| `"system"` | 消息角色 |
| `content` | `str` | 消息内容 |

**多轮对话输入（支持历史上下文）：**

```python
result = agent.invoke({
    "messages": [
        ("human", "What is GraphRAG?"),
        ("ai", "GraphRAG is a knowledge graph-enhanced RAG system..."),
        ("human", "How does it relate to LLMs?"),   # 当前问题
    ]
})
```

### 2.4 Agent 输出规范

#### 2.4.1 invoke 原始返回

```python
{
    "messages": [
        HumanMessage(content="What is GraphRAG?"),
        AIMessage(content="", tool_calls=[...]),    # 工具调用
        ToolMessage(content="...", tool_call_id="..."),  # 工具结果
        AIMessage(content="GraphRAG is an advanced...")  # 最终答案
    ]
}
```

#### 2.4.2 消息类型枚举

| 消息类型 | 角色 | 说明 |
|---------|------|------|
| `HumanMessage` | `human` | 用户输入 |
| `AIMessage`（tool_calls 非空） | `ai` | LLM 决策发起工具调用 |
| `ToolMessage` | `tool` | 工具执行结果 |
| `AIMessage`（tool_calls 为空） | `ai` | 最终自然语言答案 |

#### 2.4.3 最终答案提取

```python
final_msg = result["messages"][-1]
answer = final_msg.content   # str，最终自然语言答案
```

### 2.5 四个工具输入输出规范

#### Tool 1: `search_entities`

| 项目 | 规范 |
|------|------|
| 入参 | `query: str` — 关键词（大小写不敏感子串匹配） |
| 匹配逻辑 | `query.lower() in entity_name.lower()` |
| 返回格式 | 多行文本，每行格式：`[{type}] "{name}" (confidence={c}, page={p}, id={id})` |
| 无匹配时 | 返回提示 + 前 8 个样例实体名 |
| 最多返回 | 15 条 |

**实际调用示例：**

```
输入: query="GraphRAG"
输出:
Found 3 entity(ies) matching 'GraphRAG':
  [TECHNOLOGY] "GraphRAG" (confidence=match_exact, page=0, id=node_0)
  [CONCEPT] "GraphRAG pipeline" (confidence=match_exact, page=0, id=node_12)
  [CONCEPT] "GraphRAG (Global)" (confidence=match_exact, page=0, id=node_15)
```

#### Tool 2: `get_neighbors`

| 项目 | 规范 |
|------|------|
| 入参 | `entity_name: str`，`hops: int = 1`（范围 1-3） |
| 匹配逻辑 | 子串匹配找起始节点，取 `candidates[0]` |
| 遍历算法 | `nx.single_source_shortest_path_length(G, node_id, cutoff=hops)` |
| 返回格式 | 按 hop 分组，每组 `[{type}] {name}`，每组最多 20 条 |
| 未找到时 | 返回提示，建议先用 `search_entities` |

**实际调用示例：**

```
输入: entity_name="GraphRAG", hops=1
输出:
Neighbors of 'GraphRAG' [TECHNOLOGY] within 1 hop(s):

  Hop 1 — 39 related entities:
    [CONCEPT] Knowledge Graph Enhanced RAG System
    [CONCEPT] retrieval-augmented generation
    ...
  Total related entities: 39
```

#### Tool 3: `get_entities_by_type`

| 项目 | 规范 |
|------|------|
| 入参 | `entity_type: str`（自动 `.upper()` 处理） |
| 有效类型 | `TECHNOLOGY`, `CONCEPT`, `PERSON`, `ORGANIZATION`, `LOCATION` |
| 返回格式 | 按 `name` 字母序排列，每行 `• {name} (confidence={c}, page={p})` |
| 无效类型时 | 返回错误 + 图谱中实际存在的类型列表 |

**实际调用示例：**

```
输入: entity_type="TECHNOLOGY"
输出:
TECHNOLOGY entities (4 total):
  • GraphRAG (confidence=match_exact, page=0)
  • LLMs (confidence=match_exact, page=0)
  • LangExtract (confidence=match_exact, page=0)
  • MinerU (confidence=match_exact, page=0)
```

#### Tool 4: `describe_graph`

| 项目 | 规范 |
|------|------|
| 入参 | 无参数 |
| 计算指标 | 节点数、边数、关系类型、图密度（`nx.density`）、度中心性（`nx.degree_centrality`） |
| 返回格式 | 结构化文本，包含概览 + 类型分布 + Top-5 中心节点 |

**实际调用示例（实测输出）：**

```
=== Knowledge Graph Overview ===
  Nodes (entities):  40
  Edges (relations): 780
  Relation type:     CO_OCCURS_IN (same-page co-occurrence)
  Graph density:     1.0000

  Entity type distribution:
    CONCEPT        :  36
    TECHNOLOGY     :   4

  Top-5 most connected entities (by degree centrality):
    [TECHNOLOGY] GraphRAG (centrality=1.000)
    [CONCEPT] Knowledge Graph Enhanced RAG System (centrality=1.000)
    [CONCEPT] retrieval-augmented generation (centrality=1.000)
    [CONCEPT] knowledge graphs (centrality=1.000)
    [CONCEPT] large language models (centrality=1.000)
```

---

## 三、MinerU ↔ Agentic-RAG 对接规范与核心架构

### 3.1 全链路技术架构

```
┌─────────────────────────────────────────────────────────────────────┐
│  阶段一：文档解析（MinerU Cloud API）                                  │
│                                                                      │
│  PDF 文件                                                            │
│    │ POST /file-urls/batch (enable_table=True, language="en")        │
│    ├─ PUT {presigned_url}（裸上传，不带 Content-Type）                │
│    └─ GET /extract-results/batch/{batch_id}（轮询 done）              │
│         ↓                                                            │
│  full_zip_url → 解压 → {uuid}_content_list.json                      │
│                                                                      │
│  关键输出字段：type, text, text_level, table_body, page_idx, bbox     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  阶段二：知识图谱构建（Bridge Pipeline）                               │
│                                                                      │
│  content_list.json                                                   │
│    │ text_assembler.py                                               │
│    ├─ text blocks → .rstrip() 拼接                                   │
│    ├─ table blocks → BeautifulSoup HTML → pipe 分隔文本              │
│    └─ PageText(page_idx, text, block_spans)                          │
│         ↓                                                            │
│    entity_extractor.py (LangExtract + DeepSeek)                      │
│         ↓                                                            │
│    kg_builder.py (去重 + CO_OCCURS_IN 边)                            │
│         ↓                                                            │
│  kg_nodes.json (40 nodes)  +  kg_edges.json (780 edges)             │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  阶段三：Agentic-RAG 问答（LangChain + LangGraph）                    │
│                                                                      │
│  kg_nodes.json → NetworkX.G.add_node(**node)                         │
│  kg_edges.json → NetworkX.G.add_edge(source, target, **edge)        │
│                                                                      │
│  @tool search_entities    ← 子串匹配                                  │
│  @tool get_neighbors      ← BFS N-hop 遍历                           │
│  @tool get_entities_by_type ← 类型过滤                               │
│  @tool describe_graph     ← 图统计                                   │
│         ↓                                                            │
│  create_agent(ChatOpenAI("deepseek-chat"), tools, system_prompt)     │
│         ↓                                                            │
│  ReAct 推理循环（think → tool_call → observe → repeat）               │
│         ↓                                                            │
│  自然语言答案（AIMessage.content）                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 MinerU → KG 关键参数对接

| MinerU 输出字段 | Bridge Pipeline 处理 | Agentic-RAG 使用 |
|---------------|-------------------|----------------|
| `block["type"]` | 区分 `text`/`table`/`image` | 不直接使用（已由 Bridge 转换） |
| `block["text"]` | `.rstrip()` 后加入 PageText | 已内化为 `node["name"]` |
| `block["table_body"]` | BeautifulSoup → pipe 分隔文本 | 已内化为实体描述 |
| `block["page_idx"]` | 分组依据，记入 BlockSpan | `node["page"]` 字段 |
| `block["bbox"]` | 记录字符偏移位置 | `node["char_start"]` / `node["char_end"]` |
| `{uuid}_content_list.json 文件名` | UUID 作为 `source_doc_id` | `node["source_doc"]` / `edge["doc_id"]` |

### 3.3 NetworkX 图构建规范

```python
import networkx as nx

G = nx.Graph()   # 无向图（CO_OCCURS_IN 关系无方向）

# 节点：来自 kg_nodes.json
for node in kg_nodes:
    G.add_node(
        node["id"],          # 主键：node_0, node_1, ...
        **node               # 所有字段作为节点属性
    )

# 边：来自 kg_edges.json
for edge in kg_edges:
    G.add_edge(
        edge["source"],      # node_0
        edge["target"],      # node_1
        relation=edge["relation"],   # "CO_OCCURS_IN"
        doc_id=edge["doc_id"],       # UUID
        page=edge["page"],           # 0-indexed
    )
```

**图属性：**

| 属性 | 实测值 | 说明 |
|------|--------|------|
| `G.number_of_nodes()` | `40` | 去重实体数 |
| `G.number_of_edges()` | `780` | CO_OCCURS_IN 边数 |
| `nx.density(G)` | `1.0` | 完全图（单页文档所有节点两两连接） |
| `G.nodes[nid]` | `dict` | 节点属性字典（id, name, type, page, confidence, ...） |

### 3.4 MinerU API 关键参数（与 Agentic-RAG 相关部分）

| 参数 | 推荐值 | 影响 Agentic-RAG 的原因 |
|------|--------|----------------------|
| `enable_table` | `True` | 表格被解析为 HTML `<table>`，Bridge 转为文本参与实体抽取，影响 KG 节点质量 |
| `enable_formula` | `True`（默认） | 公式以 LaTeX 内联写入文本，影响文本纯净度，可能产生噪声实体 |
| `language` | `"en"` / `"ch"` | 影响 OCR 精度，直接影响文本质量和实体对齐率 |
| `model_version` | `"pipeline"` | 输出 `{uuid}_content_list.json`，Bridge 通过 glob `*_content_list.json` 匹配 |
| `page_ranges` | 按需设置 | 多页文档可分批处理，减少每批实体数和边数规模 |

### 3.5 Agent 系统扩展点

当 KG 数据更新后（新文档接入），Agentic-RAG 只需**重新加载 JSON 文件**，不需要重新构建 agent：

```python
# 动态重载 KG（新文档处理完成后）
G.clear()
G = _load_kg()   # 重新读取 kg_nodes.json + kg_edges.json
# agent 实例无需重建，tools 引用同一 G 对象
```

---

## 四、问答流程最终数据返回格式规范

### 4.1 invoke 完整返回结构

```python
result = agent.invoke({"messages": [("human", question)]})
# result 类型: dict
# result.keys(): ["messages"]
```

`result["messages"]` 是一个有序列表，包含完整的对话历史：

```python
[
    HumanMessage,          # 用户输入
    AIMessage,             # 工具调用决策（可能多轮）
    ToolMessage,           # 工具执行结果（可能多轮）
    ...                    # 可能有多轮 AIMessage + ToolMessage
    AIMessage,             # 最终答案（tool_calls=[]）
]
```

### 4.2 HumanMessage 格式

```python
HumanMessage(
    content="What technology entities are in the knowledge graph?",
    additional_kwargs={},
    response_metadata={},
    id="uuid-string",       # 自动生成
)
```

### 4.3 AIMessage（工具调用）格式

```python
AIMessage(
    content="",             # 内容为空（LLM 决策调用工具）
    additional_kwargs={
        "tool_calls": [
            {
                "id": "call_abc123",
                "type": "function",
                "function": {
                    "name": "get_entities_by_type",
                    "arguments": "{\"entity_type\": \"TECHNOLOGY\"}"
                }
            }
        ]
    },
    tool_calls=[
        {
            "name": "get_entities_by_type",
            "args": {"entity_type": "TECHNOLOGY"},
            "id": "call_abc123",
            "type": "tool_call",
        }
    ],
    response_metadata={
        "model_name": "deepseek-chat",
        "finish_reason": "tool_calls",
        "usage": {
            "prompt_tokens": 580,
            "completion_tokens": 18,
            "total_tokens": 598,
        }
    },
)
```

### 4.4 ToolMessage 格式

```python
ToolMessage(
    content="TECHNOLOGY entities (4 total):\n  • GraphRAG ...\n  • LLMs ...",
    tool_call_id="call_abc123",     # 与 AIMessage.tool_calls[i].id 对应
    name="get_entities_by_type",    # 工具名称
    additional_kwargs={},
    response_metadata={},
)
```

### 4.5 AIMessage（最终答案）格式

```python
AIMessage(
    content="## Technology Entities in the Knowledge Graph\n\n1. **GraphRAG** ...",
    additional_kwargs={
        "tool_calls": []   # 空列表，表示无更多工具调用
    },
    tool_calls=[],
    response_metadata={
        "model_name": "deepseek-chat",
        "finish_reason": "stop",
        "usage": {
            "prompt_tokens": 820,
            "completion_tokens": 350,
            "total_tokens": 1170,
        }
    },
    id="msg-uuid-string",
)
```

### 4.6 最终答案提取规范

```python
# 标准提取方式
final_msg = result["messages"][-1]   # 最后一条消息必为最终 AIMessage
answer: str = final_msg.content      # 自然语言答案

# 安全提取方式（防御性编程）
answer = (
    final_msg.content
    if hasattr(final_msg, "content")
    else str(final_msg)
)
```

### 4.7 推荐封装数据格式

业务层调用时建议封装为以下结构，便于下游使用：

```python
from dataclasses import dataclass
from typing import Any

@dataclass
class AgenticRAGResponse:
    question: str                  # 用户原始问题
    answer: str                    # 最终答案（Markdown 格式）
    tool_calls: list[dict]         # 工具调用链记录
    total_messages: int            # 对话轮次（含 human/ai/tool 全部）
    token_usage: dict[str, int]    # Token 用量统计
    kg_stats: dict[str, Any]       # KG 规模信息
```

**填充示例：**

```python
def run_query_with_metadata(question: str) -> AgenticRAGResponse:
    result = agent.invoke({"messages": [("human", question)]})
    messages = result["messages"]

    # 提取工具调用链
    tool_calls = []
    for msg in messages:
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            for tc in msg.tool_calls:
                tool_calls.append({
                    "tool": tc["name"],
                    "args": tc["args"],
                    "call_id": tc["id"],
                })

    # Token 统计（来自最后一条 AIMessage）
    last_ai = messages[-1]
    usage = last_ai.response_metadata.get("usage", {})

    return AgenticRAGResponse(
        question=question,
        answer=messages[-1].content,
        tool_calls=tool_calls,
        total_messages=len(messages),
        token_usage={
            "prompt_tokens":     usage.get("prompt_tokens", 0),
            "completion_tokens": usage.get("completion_tokens", 0),
            "total_tokens":      usage.get("total_tokens", 0),
        },
        kg_stats={
            "nodes": G.number_of_nodes(),
            "edges": G.number_of_edges(),
            "density": nx.density(G),
        },
    )
```

### 4.8 实测问答响应样例

#### 样例 1：T1-Overview（图谱概览类问题）

```
问题：Give me an overview of the knowledge graph.
      What types of entities does it contain and which entities are most central?

工具调用链：
  [1] describe_graph()

最终答案（节选）：
  ## Knowledge Graph Overview
  **Structure:**
  - 40 entities (nodes) connected by 780 edges
  - All edges represent CO_OCCURS_IN relationships
  - Graph density: 1.000 — fully connected graph

  **Entity Types:**
  1. TECHNOLOGY (4): GraphRAG, LLMs, LangExtract, MinerU
  2. CONCEPT (36): retrieval-augmented generation, knowledge graphs, ...

  **Most Central Entities (centrality=1.000):**
  1. [TECHNOLOGY] GraphRAG
  2. [CONCEPT] Knowledge Graph Enhanced RAG System
  ...

消息轮次：4 条（human + ai_tool_call + tool_result + ai_final）
Token 用量：约 900 tokens
```

#### 样例 2：T3-MultiHop（多跳推理类问题）

```
问题：What concepts and technologies are most closely related to GraphRAG?
      Explore the graph neighborhood and explain the connections.

工具调用链：
  [1] search_entities(query="GraphRAG")
  [2] get_neighbors(entity_name="GraphRAG", hops=1)

最终答案（节选）：
  ## Concepts and Technologies Most Closely Related to GraphRAG

  ### Core Technologies (Directly Connected):
  1. LLMs — The foundation models that GraphRAG enhances
  2. LangExtract — Used for language extraction in the pipeline
  3. MinerU — Part of the data processing ecosystem

  ### Key Concepts:
  - Knowledge Graph Enhanced RAG System (overarching architecture)
  - retrieval-augmented generation (core paradigm)
  - multi-hop reasoning (key capability)
  ...

消息轮次：6 条（human + 2×ai_tool_call + 2×tool_result + ai_final）
Token 用量：约 1,200 tokens
```

### 4.9 错误与边界情况处理

| 情况 | Agent 行为 | 返回内容 |
|------|------------|---------|
| 实体不存在 | 工具返回提示 + 样例实体名 | Agent 改写查询或给出不确定性说明 |
| 类型不合法 | 工具返回有效类型列表 | Agent 自动纠正并重试 |
| 问题超出 KG 范围 | 无工具调用结果支撑 | Agent 如实说明 "信息不在当前 KG 中" |
| Token 超限 | LangChain 内部截断 | 减少 `hops` 或缩短问题 |

---

## 五、虚拟环境与依赖

### 5.1 运行环境

| 项目 | 值 |
|------|-----|
| 虚拟环境 | `F:\GraphRAGAgent\langextract_src\.venv\`（复用 Bridge Pipeline 的 venv） |
| Python 版本 | 3.12 |
| 安装方式 | uv |

### 5.2 Agentic-RAG 新增依赖

| 包 | 版本（实测） | 用途 |
|----|------------|------|
| `langchain` | 1.2.10 | `@tool` 装饰器、`create_agent` |
| `langchain-openai` | latest | `ChatOpenAI`（DeepSeek 适配） |
| `langgraph` | latest | `create_agent` 底层运行时 |
| `networkx` | latest | KG 图构建、BFS 遍历、中心性计算 |

### 5.3 完整依赖安装

```bash
uv pip install langchain langchain-openai langgraph networkx \
  --python F:/GraphRAGAgent/langextract_src/.venv/Scripts/python.exe
```

### 5.4 环境变量

`F:\GraphRAGAgent\graphrag_pipeline\.env`：

```env
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

---

## 附录：各阶段文件依赖速查

| 阶段 | 输入 | 输出 | 关键脚本 |
|------|------|------|---------|
| MinerU 解析 | `*.pdf` | `{uuid}_content_list.json` | `mineru_mvp/pipeline.py` |
| Bridge Pipeline | `*_content_list.json` | `kg_nodes.json` + `kg_edges.json` | `graphrag_pipeline/bridge.py` |
| Agentic-RAG | `kg_nodes.json` + `kg_edges.json` | 自然语言答案 | `graphrag_pipeline/agentic_rag_mvp.py` |

| 规范文档 | 覆盖范围 |
|---------|---------|
| `docs/mineru_specification-v1.0.md` | MinerU 解析阶段输入/输出 |
| `docs/langextract_specification-v1.0.md` | LangExtract 实体抽取参数 |
| `docs/bridge_pipeline_specification-v1.0.md` | Bridge Pipeline 对接规范与 KG 输出格式 |
| `docs/agentic_rag_specification-v1.0.md` | **本文件** — Agentic-RAG 问答阶段规范 |
