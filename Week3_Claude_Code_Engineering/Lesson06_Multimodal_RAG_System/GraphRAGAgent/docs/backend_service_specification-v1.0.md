# 多模态 RAG 后端服务接口规范 v1.0

> 基于 MinerU + LangExtract Bridge Pipeline + Agentic-RAG MVP 实测验证结果
> Web 框架：FastAPI (Python 3.12 async)
> 存储方案：纯文件系统（JSON）
> 更新日期：2026-03-05

---

## 目录

- [一、系统架构总览](#一系统架构总览)
  - [1.1 四层架构](#11-四层架构)
  - [1.2 双 venv 协调方案](#12-双-venv-协调方案)
  - [1.3 完整数据流](#13-完整数据流)
  - [1.4 Job 状态机](#14-job-状态机)
  - [1.5 FastAPI 项目目录结构](#15-fastapi-项目目录结构)
  - [1.6 文件系统存储结构](#16-文件系统存储结构)
- [二、统一响应封装格式](#二统一响应封装格式)
  - [2.1 通用响应结构](#21-通用响应结构)
  - [2.2 错误码体系](#22-错误码体系)
- [三、核心数据对象 Schema](#三核心数据对象-schema)
  - [3.1 DocumentInfo](#31-documentinfo)
  - [3.2 IndexingJobStatus](#32-indexingjobstatus)
  - [3.3 KGNode](#33-kgnode)
  - [3.4 KGEdge](#34-kgedge)
  - [3.5 ExtractionRecord](#35-extractionrecord)
  - [3.6 QAResult](#36-qaresult)
- [四、A 组：文档管理（4 个端点）](#四a-组文档管理4-个端点)
- [五、B 组：Indexing Pipeline（4 个端点）](#五b-组indexing-pipeline4-个端点)
- [六、C 组：知识图谱（6 个端点）](#六c-组知识图谱6-个端点)
- [七、D 组：QA 问答（4 个端点）](#七d-组qa-问答4-个端点)
- [八、E 组：搜索（3 个端点）](#八e-组搜索3-个端点)
- [九、F 组：系统（4 个端点）](#九f-组系统4-个端点)
- [十、文件格式支持矩阵](#十文件格式支持矩阵)
- [十一、依赖与运行](#十一依赖与运行)

---

## 一、系统架构总览

### 1.1 四层架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                          客户端层                                    │
│              浏览器 / API 调用方 / 可视化前端                         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP/HTTPS
┌──────────────────────────────▼──────────────────────────────────────┐
│                         API 网关层                                   │
│   Nginx 反向代理 | 限流（per-IP/per-key） | 请求日志 | TLS 终止       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                  服务层 — FastAPI Application                        │
│                   Python 3.12 async / uvicorn                        │
│                                                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────────────┐ │
│  │ DocumentService│  │ IndexingService│  │    KGService           │ │
│  │  文件上传/管理  │  │  Pipeline 调度 │  │  NetworkX 图操作       │ │
│  └────────────────┘  └────────────────┘  └───────────────────────┘ │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────────────┐ │
│  │   QAService    │  │  SearchService │  │    SystemService       │ │
│  │  Agentic-RAG   │  │  实体/图谱搜索  │  │  健康检查 / 统计        │ │
│  └────────────────┘  └────────────────┘  └───────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                      Pipeline 执行层                                 │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  MinerU Pipeline（subprocess → mineru_mvp/.venv）             │  │
│  │  输入: 文件路径  输出: *content_list.json + layout.json       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Bridge Pipeline（直接 import → langextract_src/.venv）        │  │
│  │  text_assembler → entity_extractor → kg_builder              │  │
│  │  输出: kg_nodes.json + kg_edges.json                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Agentic-RAG（LangChain create_agent → langextract_src/.venv）│  │
│  │  工具: search_entities / get_neighbors / get_entities_by_type │  │
│  │       describe_graph                                          │  │
│  │  LLM: DeepSeek deepseek-chat via ChatOpenAI                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                      存储层（纯文件系统）                             │
│  uploads/        ← 原始上传文件                                      │
│  jobs/{job_id}/  ← 每个 job 的中间产物和结果 JSON                    │
│  kg/             ← 全局合并的 KG（kg_nodes.json + kg_edges.json）   │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 双 venv 协调方案

项目中存在两个隔离的 Python 虚拟环境，FastAPI 服务通过以下方式协调：

| 组件 | 虚拟环境 | 调用方式 |
|------|---------|---------|
| **FastAPI 服务本体** | `langextract_src/.venv` | 直接运行 |
| **Bridge Pipeline** | `langextract_src/.venv` | `from text_assembler import ...` 直接 import |
| **Agentic-RAG** | `langextract_src/.venv` | `from agentic_rag_mvp import ...` 直接 import |
| **MinerU Pipeline** | `mineru_mvp/.venv` | `subprocess.run([MINERU_PYTHON, MINERU_PIPELINE, pdf_path])` |

```python
# 双 venv 协调核心代码
MINERU_PYTHON = Path("F:/GraphRAGAgent/mineru_mvp/.venv/Scripts/python.exe")
MINERU_PIPELINE = Path("F:/GraphRAGAgent/mineru_mvp/pipeline.py")

# Stage 1: MinerU — subprocess 隔离调用
result = subprocess.run(
    [str(MINERU_PYTHON), str(MINERU_PIPELINE), str(pdf_path)],
    cwd=str(MINERU_DIR), capture_output=True, text=True, timeout=600
)

# Stage 2-4: Bridge + RAG — 直接 import（同 venv）
from text_assembler import load_content_list, assemble_pages
from entity_extractor import create_model, extract_entities
from kg_builder import build_kg
```

### 1.3 完整数据流

```
上传文件（PDF/DOCX/PPT/PNG/JPG/HTML）
    │
    ▼ POST /api/v1/documents/upload
DocumentService: 保存到 uploads/{doc_id}_{filename}
    │
    ▼ POST /api/v1/index/start
IndexingService: 启动后台 threading.Thread
    │
    ├─ Stage: parsing
    │    MinerU subprocess → mineru_mvp/output/{stem}/*_content_list.json
    │
    ├─ Stage: extracting
    │    text_assembler.assemble_pages() → PageText[]
    │    entity_extractor.extract_entities() → AnnotatedDocument[]
    │    → ExtractionRecord[] 保存到 jobs/{job_id}/extractions.json
    │
    ├─ Stage: indexing
    │    kg_builder.build_kg() → KGNode[] + KGEdge[]
    │    → 保存到 jobs/{job_id}/kg_nodes.json + kg_edges.json
    │    → 合并到全局 kg/kg_nodes.json + kg/kg_edges.json
    │
    └─ Status: done
         GET /api/v1/index/result/{job_id} → 完整结果

用户查询（自然语言问题）
    │
    ▼ POST /api/v1/query
QAService: 加载全局 KG → NetworkX Graph
    │
    ├─ LangChain create_agent（DeepSeek）
    │    ReAct 循环: think → tool_call → observe → repeat
    │    工具调用链: search_entities / get_neighbors / ...
    │
    └─ QAResult: answer + tool_calls + cited_nodes
```

### 1.4 Job 状态机

```
                          ┌─────────┐
                          │submitted│
                          └────┬────┘
                               │ 后台线程启动
                          ┌────▼────┐
                          │ queued  │  （等待线程池，当前实现立即转 parsing）
                          └────┬────┘
                               │ MinerU subprocess 开始
                          ┌────▼────┐
                          │ parsing │  MinerU 云端 API 解析
                          └────┬────┘
                               │ content_list.json 就绪
                         ┌─────▼──────┐
                         │ extracting │  LangExtract + DeepSeek 实体抽取
                         └─────┬──────┘
                               │ extractions.json 就绪
                         ┌─────▼──────┐
                         │  indexing  │  kg_builder 构建知识图谱
                         └─────┬──────┘
                               │ kg_nodes/edges 就绪
                    ┌──────────▼──────────┐
              ┌─────▼─────┐        ┌──────▼──────┐
              │   done    │        │   failed    │
              └───────────┘        └─────────────┘
```

**进度字段说明（`progress` 对象）：**

| 阶段 | `parsed_pages` | `total_pages` | `extracted_entities` |
|------|----------------|---------------|----------------------|
| parsing | 实时更新（MinerU 进度） | MinerU 返回总页数 | 0 |
| extracting | total_pages | total_pages | 实时累加 |
| indexing | total_pages | total_pages | 最终值 |
| done | total_pages | total_pages | 最终值 |

### 1.5 FastAPI 项目目录结构

```
F:\GraphRAGAgent\graphrag_pipeline\
├── api_server.py              # FastAPI 主入口（app 实例、路由注册、启动配置）
├── routers/
│   ├── __init__.py
│   ├── documents.py           # A 组：文档管理（4 个端点）
│   ├── indexing.py            # B 组：Indexing Pipeline（4 个端点）
│   ├── kg.py                  # C 组：知识图谱（6 个端点）
│   ├── query.py               # D 组：QA 问答（4 个端点）
│   ├── search.py              # E 组：搜索（3 个端点）
│   └── system.py              # F 组：系统（4 个端点）
├── services/
│   ├── __init__.py
│   ├── document_service.py    # 文件保存、元数据读写
│   ├── indexing_service.py    # Pipeline 调度（MinerU subprocess + Bridge import）
│   ├── kg_service.py          # NetworkX 图加载、BFS、中心性计算
│   ├── qa_service.py          # create_agent 封装、ReAct 调用、结果解析
│   └── search_service.py      # 实体搜索、路径搜索、子图搜索
├── models/
│   ├── __init__.py
│   └── schemas.py             # Pydantic v2 models（所有数据对象 Schema）
├── storage/
│   ├── __init__.py
│   └── file_store.py          # 统一文件读写（JSON 序列化/反序列化、目录管理）
├── .env                       # DEEPSEEK_API_KEY + DEEPSEEK_BASE_URL + MINERU_API_TOKEN
│
│ # 现有文件（不修改）
├── bridge.py
├── text_assembler.py
├── entity_extractor.py
├── kg_builder.py
├── agentic_rag_mvp.py
├── web_server.py              # 旧 Flask 原型（保留，不删除）
└── output/
    ├── kg_nodes.json          # 向后兼容的全局 KG（与 kg/ 目录同步）
    └── kg_edges.json
```

### 1.6 文件系统存储结构

```
F:\GraphRAGAgent\graphrag_pipeline\
│
├── uploads/
│   └── {doc_id}_{filename}              # 上传的原始文件（如 abc12345_paper.pdf）
│
├── jobs/
│   └── {job_id}/
│       ├── meta.json                    # job 元数据
│       │   {
│       │     "job_id": "job_xyz789",
│       │     "doc_id": "abc12345",
│       │     "status": "done",
│       │     "stage": "Complete",
│       │     "progress": {...},
│       │     "created_at": "ISO8601",
│       │     "elapsed_seconds": 42.1,
│       │     "error": null,
│       │     "pdf_name": "paper.pdf",
│       │     "pdf_path": "uploads/abc12345_paper.pdf"
│       │   }
│       ├── mineru_output/               # MinerU 解析产物（原样保留）
│       │   ├── {uuid}_content_list.json
│       │   ├── layout.json
│       │   ├── full.md
│       │   ├── {uuid}_origin.pdf
│       │   └── images/
│       │       └── {sha256}.jpg
│       ├── extractions.json             # LangExtract 全部抽取记录（ExtractionRecord[]）
│       ├── kg_nodes.json                # 本 job 生成的 KG 节点（KGNode[]）
│       └── kg_edges.json                # 本 job 生成的 KG 边（KGEdge[]）
│
└── kg/
    ├── kg_nodes.json                    # 全局合并的 KG 节点（所有 job 合并去重）
    └── kg_edges.json                    # 全局合并的 KG 边（所有 job 合并去重）
```

---

## 二、统一响应封装格式

### 2.1 通用响应结构

所有 API 端点均使用以下统一包装格式：

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "data": { ... }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | `int` | `0` = 成功；非 `0` = 失败（见错误码表） |
| `msg` | `string` | 状态描述（成功为 `"success"`，失败为错误信息） |
| `request_id` | `string` | UUID v4，用于日志追踪 |
| `data` | `object \| null` | 业务数据（失败时为 `null`） |

**HTTP 状态码映射：**

| HTTP 状态码 | 适用场景 |
|------------|---------|
| `200 OK` | 同步请求成功 |
| `202 Accepted` | 异步任务已接受（Job 启动） |
| `400 Bad Request` | 参数校验失败（code 1001/1002/1003） |
| `404 Not Found` | 资源不存在（code 2001/3001） |
| `500 Internal Server Error` | 服务器内部错误（code 5000） |

**FastAPI Pydantic 响应模型：**

```python
from pydantic import BaseModel
from typing import Generic, TypeVar, Optional
import uuid

T = TypeVar("T")

class APIResponse(BaseModel, Generic[T]):
    code: int = 0
    msg: str = "success"
    request_id: str = str(uuid.uuid4())
    data: Optional[T] = None
```

### 2.2 错误码体系

| code | HTTP 状态码 | 含义 | 说明 |
|------|------------|------|------|
| `0` | 200 | 成功 | |
| `1001` | 400 | 参数校验失败 | 缺少必填字段或类型错误 |
| `1002` | 400 | 文件格式不支持 | 仅支持 pdf/docx/doc/pptx/ppt/png/jpg/jpeg/html |
| `1003` | 400 | 文件超出大小限制 | 单文件最大 200MB（MinerU 限制） |
| `1004` | 400 | 文件页数超限 | 单文件最大 600 页（MinerU 限制） |
| `2001` | 404 | 文档不存在 | `doc_id` 对应的文档未找到 |
| `2002` | 400 | Job 不存在 | `job_id` 对应的任务未找到 |
| `2003` | 400 | Job 仍在执行 | 请求结果时任务尚未完成 |
| `2004` | 400 | Job 状态不可取消 | 仅 submitted/queued 可取消 |
| `3001` | 404 | KG 节点不存在 | `node_id` 对应节点未找到 |
| `3002` | 400 | KG 为空 | 尚未完成任何 Indexing，无图谱数据 |
| `4001` | 500 | QA 服务异常 | LangChain Agent 或 DeepSeek API 调用失败 |
| `5000` | 500 | 服务器内部错误 | 未预期的系统异常 |

**错误响应示例：**

```json
{
  "code": 1002,
  "msg": "Unsupported file format: .xlsx. Supported formats: pdf, docx, doc, pptx, ppt, png, jpg, jpeg, html",
  "request_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "data": null
}
```

---

## 三、核心数据对象 Schema

### 3.1 DocumentInfo

文档元数据对象，由 `POST /api/v1/documents/upload` 创建，持久化到 `jobs/` 下的 `meta.json`。

```json
{
  "doc_id": "abc12345",
  "filename": "graphrag_overview.pdf",
  "format": "pdf",
  "size_bytes": 1048576,
  "pages": 4,
  "uploaded_at": "2026-03-05T10:00:00Z",
  "status": "indexed",
  "language": "en",
  "enable_formula": true,
  "enable_table": true
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `doc_id` | `string` | 文档唯一 ID（UUID hex 前 8 位，如 `"abc12345"`） |
| `filename` | `string` | 原始文件名 |
| `format` | `string` | 文件格式（小写扩展名，不含点） |
| `size_bytes` | `int` | 文件大小（字节） |
| `pages` | `int \| null` | 总页数（MinerU 解析后填充；上传时为 `null`） |
| `uploaded_at` | `string` | ISO 8601 上传时间 |
| `status` | `string` | `"uploaded"` / `"indexed"` / `"failed"` |
| `language` | `string` | OCR 语言码（PaddleOCR，默认 `"ch"`） |
| `enable_formula` | `bool` | 是否启用公式识别 |
| `enable_table` | `bool` | 是否启用表格识别 |

### 3.2 IndexingJobStatus

Indexing Pipeline 的任务状态对象。

```json
{
  "job_id": "job_xyz789",
  "doc_id": "abc12345",
  "status": "extracting",
  "stage": "Extracting entities (LangExtract + DeepSeek)...",
  "progress": {
    "parsed_pages": 4,
    "total_pages": 4,
    "extracted_entities": 23
  },
  "created_at": "2026-03-05T10:00:05Z",
  "elapsed_seconds": 18.3,
  "error": null
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `job_id` | `string` | 任务唯一 ID（`"job_"` + UUID hex 前 8 位） |
| `doc_id` | `string` | 关联文档 ID |
| `status` | `string` | 状态枚举（见 1.4 状态机） |
| `stage` | `string` | 当前阶段人类可读描述 |
| `progress.parsed_pages` | `int` | 已解析页数 |
| `progress.total_pages` | `int` | 总页数（0 = 未知） |
| `progress.extracted_entities` | `int` | 已抽取实体数 |
| `created_at` | `string` | ISO 8601 任务创建时间 |
| `elapsed_seconds` | `float` | 已耗时（秒） |
| `error` | `string \| null` | 错误信息（失败时非 null） |

### 3.3 KGNode

知识图谱节点，直接对应 `kg_nodes.json` 格式，新增 `degree` 字段。

```json
{
  "id": "tech_graphrag_0",
  "name": "GraphRAG",
  "type": "TECHNOLOGY",
  "source_doc": "abc12345",
  "char_start": 0,
  "char_end": 8,
  "confidence": "match_exact",
  "page": 0,
  "degree": 39
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 节点唯一 ID（来自 kg_nodes.json） |
| `name` | `string` | 实体名称 |
| `type` | `string` | 实体类型：`TECHNOLOGY` / `CONCEPT` / `PERSON` / `ORGANIZATION` / `LOCATION` |
| `source_doc` | `string` | 来源文档 ID（doc_id） |
| `char_start` | `int` | 实体在原文中的起始字符位置（LangExtract `char_interval.start_pos`） |
| `char_end` | `int` | 实体在原文中的结束字符位置（不含，`char_interval.end_pos`） |
| `confidence` | `string` | LangExtract 对齐状态：`match_exact` / `match_greater` / `match_lesser` / `match_fuzzy` |
| `page` | `int` | 所在页码（0-indexed，来自 MinerU content_list.json `page_idx`） |
| `degree` | `int` | 节点度数（连接边数，NetworkX 计算，仅 API 返回时填充） |

### 3.4 KGEdge

知识图谱边，直接对应 `kg_edges.json` 格式。

```json
{
  "source": "tech_graphrag_0",
  "target": "concept_knowledgegraph_1",
  "relation": "CO_OCCURS_IN",
  "doc_id": "abc12345",
  "page": 0
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `source` | `string` | 起始节点 ID |
| `target` | `string` | 目标节点 ID |
| `relation` | `string` | 关系类型（当前固定为 `"CO_OCCURS_IN"`，表示同页共现） |
| `doc_id` | `string` | 边来源文档 ID |
| `page` | `int` | 共现所在页码（0-indexed） |

### 3.5 ExtractionRecord

LangExtract 单条实体抽取记录，对应 `AnnotatedDocument.extractions[]` 的扁平化结构。

```json
{
  "text": "GraphRAG",
  "type": "TECHNOLOGY",
  "char_start": 0,
  "char_end": 8,
  "alignment": "match_exact",
  "page": 0,
  "doc_id": "abc12345"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `text` | `string` | 实体文本（`extraction_text`，原文子串） |
| `type` | `string` | 实体类型（`extraction_class`） |
| `char_start` | `int \| null` | 字符起始位置（`char_interval.start_pos`） |
| `char_end` | `int \| null` | 字符结束位置（`char_interval.end_pos`，不含） |
| `alignment` | `string \| null` | 对齐状态（`alignment_status.value`，`null` 表示未对齐） |
| `page` | `int` | 所在页码（0-indexed） |
| `doc_id` | `string` | 来源文档 ID |

> **过滤规则**：KG 构建时过滤掉 `alignment = null`（未对齐），`match_fuzzy` 根据项目配置可选是否过滤。当前实测：`match_exact` 占 94%+。

### 3.6 QAResult

Agentic-RAG 问答返回对象，包含答案 + 完整推理溯源链。

```json
{
  "query_id": "q_20260305_001",
  "question": "What is GraphRAG and how does it relate to knowledge graphs?",
  "answer": "GraphRAG is a knowledge graph-enhanced retrieval-augmented generation system...",
  "tool_calls": [
    {
      "tool": "search_entities",
      "input": {"query": "GraphRAG"},
      "output": "Found 1 entity(ies) matching 'GraphRAG':\n  [TECHNOLOGY] \"GraphRAG\" (confidence=match_exact, page=0, id=tech_graphrag_0)"
    },
    {
      "tool": "get_neighbors",
      "input": {"entity_name": "GraphRAG", "hops": 1},
      "output": "Neighbors of 'GraphRAG' [TECHNOLOGY] within 1 hop(s):\n  Hop 1 — 39 related entities:\n    [CONCEPT] knowledge graphs\n    ..."
    }
  ],
  "cited_nodes": ["tech_graphrag_0", "concept_knowledgegraph_1"],
  "elapsed_seconds": 8.4,
  "created_at": "2026-03-05T10:30:00Z"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `query_id` | `string` | 查询唯一 ID |
| `question` | `string` | 用户原始问题 |
| `answer` | `string` | Agent 生成的最终自然语言答案（`result["messages"][-1].content`） |
| `tool_calls` | `array` | ReAct 循环中的工具调用记录（顺序） |
| `tool_calls[].tool` | `string` | 工具名（4 个 KG 工具之一） |
| `tool_calls[].input` | `object` | 工具调用参数 |
| `tool_calls[].output` | `string` | 工具返回的文本结果（ToolMessage.content） |
| `cited_nodes` | `string[]` | 答案中引用的节点 ID 列表（从 tool_calls 解析） |
| `elapsed_seconds` | `float` | 问答总耗时（包括所有 LLM 调用） |
| `created_at` | `string` | ISO 8601 查询时间 |

---

## 四、A 组：文档管理（4 个端点）

### A1. 上传文件

```
POST /api/v1/documents/upload
Content-Type: multipart/form-data
```

**Request（Form Data）：**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `file` | `binary` | **是** | — | 文件二进制内容 |
| `language` | `string` | 否 | `"ch"` | OCR 语言（PaddleOCR 语言码） |
| `enable_formula` | `bool` | 否 | `true` | 是否启用公式识别 |
| `enable_table` | `bool` | 否 | `true` | 是否启用表格识别 |

**验证规则：**
- 文件扩展名必须在支持列表中（见第十章）
- 文件大小不得超过 200MB
- 文件名不得包含路径分隔符（防目录穿越）

**Response 200：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "f47ac10b-...",
  "data": {
    "doc_id": "abc12345",
    "filename": "graphrag_overview.pdf",
    "format": "pdf",
    "size_bytes": 1048576,
    "pages": null,
    "uploaded_at": "2026-03-05T10:00:00Z",
    "status": "uploaded",
    "language": "en",
    "enable_formula": true,
    "enable_table": true
  }
}
```

**错误响应：**

```json
// 1002: 格式不支持
{ "code": 1002, "msg": "Unsupported file format: .xlsx", "data": null }

// 1003: 超过大小限制
{ "code": 1003, "msg": "File size 256MB exceeds 200MB limit", "data": null }
```

---

### A2. 获取文档信息

```
GET /api/v1/documents/{doc_id}
```

**Path Params：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `doc_id` | `string` | 文档 ID |

**Response 200：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "doc_id": "abc12345",
    "filename": "graphrag_overview.pdf",
    "format": "pdf",
    "size_bytes": 1048576,
    "pages": 4,
    "uploaded_at": "2026-03-05T10:00:00Z",
    "status": "indexed",
    "language": "en",
    "enable_formula": true,
    "enable_table": true
  }
}
```

**错误：** `2001` (doc_id 不存在)

---

### A3. 列出所有文档

```
GET /api/v1/documents
```

**Query Params：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | `int` | `1` | 页码（从 1 开始） |
| `page_size` | `int` | `20` | 每页数量（最大 100） |
| `status` | `string` | — | 按状态筛选：`uploaded` / `indexed` / `failed` |
| `format` | `string` | — | 按格式筛选：如 `pdf` |

**Response 200：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "total": 5,
    "page": 1,
    "page_size": 20,
    "items": [
      {
        "doc_id": "abc12345",
        "filename": "graphrag_overview.pdf",
        "format": "pdf",
        "size_bytes": 1048576,
        "pages": 4,
        "uploaded_at": "2026-03-05T10:00:00Z",
        "status": "indexed",
        "language": "en",
        "enable_formula": true,
        "enable_table": true
      }
    ]
  }
}
```

---

### A4. 删除文档

```
DELETE /api/v1/documents/{doc_id}
```

**说明：** 删除文档及其关联的 job 产物文件（`uploads/`、`jobs/` 下的对应目录），并从全局 KG 中移除该文档贡献的节点和边。

**Response 200：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "deleted": true,
    "doc_id": "abc12345",
    "removed_nodes": 40,
    "removed_edges": 780
  }
}
```

**错误：** `2001` (doc_id 不存在)

---

## 五、B 组：Indexing Pipeline（4 个端点）

### B1. 启动索引任务

```
POST /api/v1/index/start
Content-Type: application/json
```

**Request Body：**

```json
{
  "doc_id": "abc12345"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `doc_id` | `string` | **是** | 已上传文档的 ID（状态须为 `uploaded`） |

**Response 202：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "job_id": "job_xyz789",
    "doc_id": "abc12345",
    "status": "submitted",
    "stage": "Job submitted",
    "created_at": "2026-03-05T10:00:05Z"
  }
}
```

**实现说明：**
```python
# IndexingService 内部实现
def start_indexing(doc_id: str) -> IndexingJobStatus:
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True)

    meta = { "job_id": job_id, "doc_id": doc_id, "status": "submitted", ... }
    save_meta(job_dir / "meta.json", meta)

    thread = threading.Thread(target=run_pipeline, args=(job_id,), daemon=True)
    thread.start()
    return meta
```

**Pipeline 执行顺序（后台线程）：**

1. `status = "parsing"` → `subprocess.run([MINERU_PYTHON, MINERU_PIPELINE, pdf_path])`
2. `status = "extracting"` → `load_content_list()` → `assemble_pages()` → `extract_entities()` per page
3. `status = "indexing"` → `build_kg()` → 保存 `jobs/{job_id}/kg_nodes.json` → 合并到 `kg/`
4. `status = "done"`

---

### B2. 查询任务状态（含实时进度）

```
GET /api/v1/index/status/{job_id}
```

**推荐轮询间隔：** 3 秒

**Response 200：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "job_id": "job_xyz789",
    "doc_id": "abc12345",
    "status": "extracting",
    "stage": "Extracting entities page 2/4 (LangExtract + DeepSeek)...",
    "progress": {
      "parsed_pages": 4,
      "total_pages": 4,
      "extracted_entities": 23
    },
    "created_at": "2026-03-05T10:00:05Z",
    "elapsed_seconds": 18.3,
    "error": null
  }
}
```

**各状态 `stage` 典型值：**

| status | stage |
|--------|-------|
| `submitted` | `"Job submitted"` |
| `queued` | `"Waiting for worker..."` |
| `parsing` | `"MinerU PDF parsing (cloud API)..."` |
| `extracting` | `"Extracting entities page 2/4 (LangExtract + DeepSeek)..."` |
| `indexing` | `"Building knowledge graph..."` |
| `done` | `"Complete"` |
| `failed` | `"Error: {error message}"` |

**错误：** `2002` (job_id 不存在)

---

### B3. 获取索引结果（完整数据）

```
GET /api/v1/index/result/{job_id}
```

**Response 200（status = done）：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "job_id": "job_xyz789",
    "doc_id": "abc12345",
    "status": "done",
    "stats": {
      "blocks": 32,
      "block_types": {"text": 31, "table": 1},
      "pages": 4,
      "raw_extractions": 45,
      "nodes": 40,
      "edges": 780,
      "type_counts": {"TECHNOLOGY": 4, "CONCEPT": 36},
      "alignment_counts": {"match_exact": 40, "match_fuzzy": 5},
      "elapsed_seconds": 42.1
    },
    "extractions": [
      {
        "text": "GraphRAG",
        "type": "TECHNOLOGY",
        "char_start": 0,
        "char_end": 8,
        "alignment": "match_exact",
        "page": 0,
        "doc_id": "abc12345"
      }
    ],
    "nodes": [
      {
        "id": "tech_graphrag_0",
        "name": "GraphRAG",
        "type": "TECHNOLOGY",
        "source_doc": "abc12345",
        "char_start": 0,
        "char_end": 8,
        "confidence": "match_exact",
        "page": 0,
        "degree": 39
      }
    ],
    "edges": [
      {
        "source": "tech_graphrag_0",
        "target": "concept_knowledgegraph_1",
        "relation": "CO_OCCURS_IN",
        "doc_id": "abc12345",
        "page": 0
      }
    ]
  }
}
```

**Response 200（status ≠ done）：** 返回 `IndexingJobStatus`（不含 stats/extractions/nodes/edges）

**错误：** `2002` (job_id 不存在)

---

### B4. 取消任务

```
DELETE /api/v1/index/jobs/{job_id}
```

**限制：** 仅 `submitted` 或 `queued` 状态可取消；`parsing`/`extracting`/`indexing` 状态无法中断后台线程，仅标记状态为 `cancelled`。

**Response 200：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "cancelled": true,
    "job_id": "job_xyz789",
    "previous_status": "submitted"
  }
}
```

**错误：** `2002` (不存在), `2004` (状态不可取消)

---

## 六、C 组：知识图谱（6 个端点）

### C1. 获取所有节点（分页 + 筛选）

```
GET /api/v1/kg/nodes
```

**Query Params：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | `string` | — | 实体类型筛选（大小写不敏感） |
| `doc_id` | `string` | — | 按来源文档筛选 |
| `confidence` | `string` | — | 对齐状态筛选（如 `match_exact`） |
| `page` | `int` | `1` | 页码 |
| `page_size` | `int` | `50` | 每页数量（最大 200） |

**Response 200：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "total": 40,
    "page": 1,
    "page_size": 50,
    "items": [
      {
        "id": "tech_graphrag_0",
        "name": "GraphRAG",
        "type": "TECHNOLOGY",
        "source_doc": "abc12345",
        "char_start": 0,
        "char_end": 8,
        "confidence": "match_exact",
        "page": 0,
        "degree": 39
      }
    ]
  }
}
```

**错误：** `3002` (KG 为空)

---

### C2. 获取所有边（分页）

```
GET /api/v1/kg/edges
```

**Query Params：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `doc_id` | `string` | — | 按来源文档筛选 |
| `relation` | `string` | — | 关系类型筛选（如 `CO_OCCURS_IN`） |
| `page` | `int` | `1` | 页码 |
| `page_size` | `int` | `100` | 每页数量（最大 500） |

**Response 200：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "total": 780,
    "page": 1,
    "page_size": 100,
    "items": [
      {
        "source": "tech_graphrag_0",
        "target": "concept_knowledgegraph_1",
        "relation": "CO_OCCURS_IN",
        "doc_id": "abc12345",
        "page": 0
      }
    ]
  }
}
```

---

### C3. 获取单个节点详情

```
GET /api/v1/kg/nodes/{node_id}
```

**Response 200：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "id": "tech_graphrag_0",
    "name": "GraphRAG",
    "type": "TECHNOLOGY",
    "source_doc": "abc12345",
    "char_start": 0,
    "char_end": 8,
    "confidence": "match_exact",
    "page": 0,
    "degree": 39,
    "degree_centrality": 1.000,
    "neighbor_count": 39
  }
}
```

**额外字段（仅单节点详情）：**

| 字段 | 说明 |
|------|------|
| `degree_centrality` | NetworkX `degree_centrality(G)[node_id]`（0-1 范围） |
| `neighbor_count` | 直接邻居数量（等于 `degree`） |

**错误：** `3001` (节点不存在)

---

### C4. 获取节点邻居（N-hop BFS）

```
GET /api/v1/kg/nodes/{node_id}/neighbors
```

**Query Params：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `hops` | `int` | `1` | 跳数（1-3） |

**Response 200：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "center": {
      "id": "tech_graphrag_0",
      "name": "GraphRAG",
      "type": "TECHNOLOGY",
      "page": 0
    },
    "hops": 1,
    "neighbors_by_hop": {
      "1": [
        { "id": "concept_knowledgegraph_1", "name": "knowledge graphs", "type": "CONCEPT", "page": 0 }
      ]
    },
    "total_neighbors": 39
  }
}
```

**实现参考（来自 `agentic_rag_mvp.py`）：**

```python
reachable = nx.single_source_shortest_path_length(G, node_id, cutoff=hops)
by_hop = {dist: [] for dist in range(1, hops+1)}
for nid, dist in reachable.items():
    if dist > 0:
        by_hop[dist].append(G.nodes[nid])
```

**错误：** `3001` (节点不存在)

---

### C5. 知识图谱统计

```
GET /api/v1/kg/stats
```

**Response 200：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "total_nodes": 40,
    "total_edges": 780,
    "density": 1.0000,
    "type_distribution": {
      "TECHNOLOGY": 4,
      "CONCEPT": 36
    },
    "relation_types": {
      "CO_OCCURS_IN": 780
    },
    "top5_central_nodes": [
      { "node_id": "tech_graphrag_0", "name": "GraphRAG", "type": "TECHNOLOGY", "centrality": 1.000 },
      { "node_id": "concept_kgrag_1", "name": "Knowledge Graph Enhanced RAG System", "type": "CONCEPT", "centrality": 1.000 },
      { "node_id": "concept_rag_2", "name": "retrieval-augmented generation", "type": "CONCEPT", "centrality": 1.000 },
      { "node_id": "concept_kg_3", "name": "knowledge graphs", "type": "CONCEPT", "centrality": 1.000 },
      { "node_id": "concept_llm_4", "name": "large language models", "type": "CONCEPT", "centrality": 1.000 }
    ],
    "source_documents": ["abc12345", "def67890"]
  }
}
```

---

### C6. 导出完整 KG

```
GET /api/v1/kg/export
```

**Query Params：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `format` | `string` | `"json"` | 导出格式（当前仅支持 `json`） |
| `doc_id` | `string` | — | 可选，仅导出指定文档的 KG |

**Response 200：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "format": "json",
    "doc_id": null,
    "total_nodes": 40,
    "total_edges": 780,
    "exported_at": "2026-03-05T12:00:00Z",
    "nodes": [ ...KGNode[] ],
    "edges": [ ...KGEdge[] ]
  }
}
```

---

## 七、D 组：QA 问答（4 个端点）

### D1. 提交 QA 查询（同步）

```
POST /api/v1/query
Content-Type: application/json
```

**Request Body：**

```json
{
  "question": "What is GraphRAG and how does it relate to knowledge graphs?",
  "history": [
    { "role": "human", "content": "Previous question..." },
    { "role": "ai", "content": "Previous answer..." }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `question` | `string` | **是** | 用户自然语言问题 |
| `history` | `array` | 否 | 多轮对话历史（最多 10 轮，即 20 条消息） |
| `history[].role` | `"human"` \| `"ai"` | — | 消息角色 |
| `history[].content` | `string` | — | 消息内容 |

**Response 200：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "query_id": "q_20260305_a1b2c3",
    "question": "What is GraphRAG and how does it relate to knowledge graphs?",
    "answer": "Based on the knowledge graph, GraphRAG [TECHNOLOGY] is a knowledge graph-enhanced retrieval-augmented generation system that...",
    "tool_calls": [
      {
        "tool": "search_entities",
        "input": { "query": "GraphRAG" },
        "output": "Found 1 entity(ies) matching 'GraphRAG':\n  [TECHNOLOGY] \"GraphRAG\" (confidence=match_exact, page=0, id=tech_graphrag_0)"
      },
      {
        "tool": "get_neighbors",
        "input": { "entity_name": "GraphRAG", "hops": 1 },
        "output": "Neighbors of 'GraphRAG' [TECHNOLOGY] within 1 hop(s):\n  Hop 1 — 39 related entities:\n    [CONCEPT] knowledge graphs\n    ..."
      }
    ],
    "cited_nodes": ["tech_graphrag_0", "concept_knowledgegraph_1"],
    "elapsed_seconds": 8.4,
    "created_at": "2026-03-05T10:30:00Z"
  }
}
```

**实现说明（QAService 核心逻辑）：**

```python
# 将 history 拼接为 LangChain messages 格式
messages = []
for h in request.history:
    messages.append((h["role"], h["content"]))
messages.append(("human", request.question))

# 调用 LangChain create_agent
result = agent.invoke({"messages": messages})

# 提取工具调用链（遍历 result["messages"]）
tool_calls = []
for msg in result["messages"]:
    if hasattr(msg, "tool_calls") and msg.tool_calls:
        for tc in msg.tool_calls:
            tool_calls.append({"tool": tc["name"], "input": tc["args"], "output": ""})
    elif hasattr(msg, "tool_call_id"):  # ToolMessage
        if tool_calls:
            tool_calls[-1]["output"] = msg.content

# 最终答案
answer = result["messages"][-1].content
```

**错误：** `3002` (KG 为空), `4001` (Agent/LLM 调用失败)

**注意：** 此接口为同步调用，通常耗时 5-30 秒（取决于 DeepSeek API 响应速度和工具调用次数）。

---

### D2. 批量查询（异步）

```
POST /api/v1/query/batch
Content-Type: application/json
```

**Request Body：**

```json
{
  "questions": [
    "What is GraphRAG?",
    "List all TECHNOLOGY entities in the knowledge graph.",
    "How does MinerU relate to LangExtract?"
  ]
}
```

| 字段 | 类型 | 必填 | 约束 | 说明 |
|------|------|------|------|------|
| `questions` | `string[]` | **是** | 最多 20 个 | 问题列表 |

**Response 202：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "batch_id": "batch_20260305_x1y2",
    "total": 3,
    "status": "submitted",
    "created_at": "2026-03-05T10:30:00Z"
  }
}
```

---

### D3. 获取批量查询状态与结果

```
GET /api/v1/query/batch/{batch_id}
```

**Response 200：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "batch_id": "batch_20260305_x1y2",
    "total": 3,
    "completed": 2,
    "failed": 0,
    "status": "running",
    "results": [
      { ...QAResult },
      { ...QAResult }
    ]
  }
}
```

**错误：** `2002` (batch_id 不存在)

---

### D4. 查询历史

```
GET /api/v1/query/history
```

**Query Params：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | `int` | `1` | 页码 |
| `page_size` | `int` | `20` | 每页数量（最大 50） |

**Response 200：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "total": 50,
    "page": 1,
    "page_size": 20,
    "items": [ ...QAResult[] ]
  }
}
```

**存储说明：** 历史记录以 JSONL 格式持久化到 `jobs/query_history.jsonl`，每行一条 `QAResult`。

---

## 八、E 组：搜索（3 个端点）

### E1. 实体关键词搜索

```
GET /api/v1/search/entities
```

**Query Params：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `q` | `string` | **是** | 关键词（大小写不敏感子串匹配，对应 `agentic_rag_mvp.py: search_entities`） |
| `type` | `string` | 否 | 类型过滤（如 `TECHNOLOGY`） |
| `limit` | `int` | 否 | 最多返回数量（默认 15，最大 100） |

**Response 200：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "query": "GraphRAG",
    "total": 1,
    "items": [
      {
        "id": "tech_graphrag_0",
        "name": "GraphRAG",
        "type": "TECHNOLOGY",
        "source_doc": "abc12345",
        "char_start": 0,
        "char_end": 8,
        "confidence": "match_exact",
        "page": 0,
        "degree": 39
      }
    ]
  }
}
```

**实现（参考 `agentic_rag_mvp.py: search_entities`）：**

```python
q = query.lower()
matches = [data for _, data in G.nodes(data=True) if q in data.get("name", "").lower()]
```

---

### E2. 图谱路径搜索（两节点间路径）

```
GET /api/v1/search/path
```

**Query Params：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `from` | `string` | **是** | 起始节点 ID |
| `to` | `string` | **是** | 目标节点 ID |
| `max_hops` | `int` | 否 | 最大路径长度（默认 3，最大 5） |

**Response 200：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "from": { "id": "tech_graphrag_0", "name": "GraphRAG", "type": "TECHNOLOGY" },
    "to": { "id": "tech_mineru_3", "name": "MinerU", "type": "TECHNOLOGY" },
    "max_hops": 3,
    "paths": [
      {
        "length": 1,
        "nodes": [
          { "id": "tech_graphrag_0", "name": "GraphRAG", "type": "TECHNOLOGY" },
          { "id": "tech_mineru_3", "name": "MinerU", "type": "TECHNOLOGY" }
        ],
        "edges": [
          { "source": "tech_graphrag_0", "target": "tech_mineru_3", "relation": "CO_OCCURS_IN" }
        ]
      }
    ],
    "total_paths": 1
  }
}
```

**实现（NetworkX）：**

```python
paths = list(nx.all_simple_paths(G, from_id, to_id, cutoff=max_hops))
```

**错误：** `3001` (节点不存在)

---

### E3. 全图关键词搜索（含子图）

```
GET /api/v1/search/graph
```

**Query Params：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `q` | `string` | **是** | 关键词（大小写不敏感子串匹配） |
| `include_neighbors` | `bool` | 否 | 是否返回匹配节点的直接邻居边（默认 `false`） |

**Response 200：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "query": "retrieval",
    "matched_nodes": [
      { "id": "concept_rag_2", "name": "retrieval-augmented generation", "type": "CONCEPT", "page": 0 }
    ],
    "subgraph_edges": [
      { "source": "concept_rag_2", "target": "tech_graphrag_0", "relation": "CO_OCCURS_IN" }
    ]
  }
}
```

---

## 九、F 组：系统（4 个端点）

### F1. 健康检查

```
GET /api/v1/health
```

**Response 200：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "uptime_seconds": 3600,
    "components": {
      "mineru_venv": {
        "status": "ok",
        "path": "F:/GraphRAGAgent/mineru_mvp/.venv/Scripts/python.exe",
        "exists": true
      },
      "langextract_venv": {
        "status": "ok",
        "path": "F:/GraphRAGAgent/langextract_src/.venv/Scripts/python.exe",
        "exists": true
      },
      "deepseek_api": {
        "status": "ok",
        "base_url": "https://api.deepseek.com",
        "key_configured": true
      },
      "storage": {
        "status": "ok",
        "kg_nodes_exists": true,
        "kg_edges_exists": true,
        "uploads_dir_exists": true
      }
    }
  }
}
```

**说明：** 此端点仅检查配置和文件存在性，不发起实际 API 调用（避免消耗 DeepSeek token）。

---

### F2. 系统统计

```
GET /api/v1/system/stats
```

**Response 200：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "total_documents": 5,
    "indexed_documents": 4,
    "failed_documents": 1,
    "total_nodes": 200,
    "total_edges": 3900,
    "type_distribution": { "TECHNOLOGY": 20, "CONCEPT": 180 },
    "total_queries": 50,
    "active_jobs": 1,
    "storage_used_mb": 12.4
  }
}
```

---

### F3. 支持的文件格式列表

```
GET /api/v1/system/formats
```

**Response 200：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "formats": [
      { "ext": "pdf",  "description": "PDF 文档（文本型/扫描型/混合型）", "max_size_mb": 200, "max_pages": 600, "requires_ocr": false },
      { "ext": "docx", "description": "Microsoft Word（新版）", "max_size_mb": 200, "max_pages": 600, "requires_ocr": false },
      { "ext": "doc",  "description": "Microsoft Word（旧版）", "max_size_mb": 200, "max_pages": 600, "requires_ocr": false },
      { "ext": "pptx", "description": "PowerPoint（新版）", "max_size_mb": 200, "max_pages": 600, "requires_ocr": false },
      { "ext": "ppt",  "description": "PowerPoint（旧版）", "max_size_mb": 200, "max_pages": 600, "requires_ocr": false },
      { "ext": "png",  "description": "PNG 图片（单页）", "max_size_mb": 200, "max_pages": 1, "requires_ocr": true },
      { "ext": "jpg",  "description": "JPEG 图片（单页）", "max_size_mb": 200, "max_pages": 1, "requires_ocr": true },
      { "ext": "jpeg", "description": "JPEG 图片（单页）", "max_size_mb": 200, "max_pages": 1, "requires_ocr": true },
      { "ext": "html", "description": "HTML 文件（需指定 model_version=MinerU-HTML）", "max_size_mb": 200, "max_pages": 600, "requires_ocr": false }
    ],
    "ocr_languages": [
      { "code": "ch", "name": "中文（默认）" },
      { "code": "en", "name": "英文" },
      { "code": "japan", "name": "日文" },
      { "code": "korean", "name": "韩文" },
      { "code": "french", "name": "法文" },
      { "code": "german", "name": "德文" }
    ],
    "notes": [
      "language 参数默认值为 'ch'（非 'zh'），遵循 PaddleOCR v3 语言代码规范",
      "上传时不需要携带 Content-Type: application/pdf 等，服务端自动识别",
      "PNG/JPG/JPEG 单次最多处理 1 页（图片文件视为单页文档）"
    ]
  }
}
```

---

### F4. Demo 数据（快速预览）

```
GET /api/v1/system/demo
```

**说明：** 返回现有 `output/kg_nodes.json` + `output/kg_edges.json` 数据，无需上传 PDF 即可预览 KG 可视化效果。与旧版 `GET /api/demo`（Flask web_server.py）兼容。

**Response 200：**

```json
{
  "code": 0,
  "msg": "success",
  "request_id": "...",
  "data": {
    "nodes": [ ...KGNode[] ],
    "edges": [ ...KGEdge[] ],
    "stats": {
      "nodes": 40,
      "edges": 780,
      "type_counts": { "TECHNOLOGY": 4, "CONCEPT": 36 },
      "density": 1.0000
    }
  }
}
```

**错误：** `3002` (demo 数据文件不存在，需先运行 bridge.py 生成)

---

## 十、文件格式支持矩阵

| 格式 | 扩展名 | 最大体积 | 最大页数 | OCR | MinerU model_version | 说明 |
|------|--------|---------|---------|-----|----------------------|------|
| PDF | `.pdf` | 200MB | 600 页 | 可选 | `pipeline`（默认） | 核心能力，文本型/扫描型/混合型均支持 |
| Word（新） | `.docx` | 200MB | 600 页 | 可选 | `pipeline` | |
| Word（旧） | `.doc` | 200MB | 600 页 | 可选 | `pipeline` | |
| PPT（新） | `.pptx` | 200MB | 600 页 | 可选 | `pipeline` | |
| PPT（旧） | `.ppt` | 200MB | 600 页 | 可选 | `pipeline` | |
| PNG 图片 | `.png` | 200MB | 1 页 | 必须 | `pipeline` | EXIF 方向自动校正 |
| JPEG 图片 | `.jpg` | 200MB | 1 页 | 必须 | `pipeline` | EXIF 方向自动校正 |
| JPEG 图片 | `.jpeg` | 200MB | 1 页 | 必须 | `pipeline` | 同 `.jpg` |
| HTML | `.html` | 200MB | 600 页 | 否 | `MinerU-HTML` | 必须指定特定 model_version |

**MinerU 云端 API 限制（来自 mineru_specification-v1.0.md）：**

| 约束项 | 限制值 |
|--------|--------|
| 单文件最大体积 | 200 MB |
| 单文件最大页数 | 600 页 |
| 批量请求最大文件数 | 200 个 |
| 预签名上传 URL 有效期 | 24 小时 |
| 云端 API 每日最高优先级额度 | 2,000 页（超出降低优先级） |

**服务端验证代码（FastAPI + Pydantic）：**

```python
ALLOWED_EXTENSIONS = {"pdf", "docx", "doc", "pptx", "ppt", "png", "jpg", "jpeg", "html"}
MAX_FILE_SIZE_MB = 200

async def upload_document(file: UploadFile = File(...), ...):
    ext = Path(file.filename).suffix.lower().lstrip(".")
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, detail=f"Unsupported format: .{ext}")

    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(400, detail=f"File size {size_mb:.1f}MB exceeds 200MB limit")
```

---

## 十一、依赖与运行

### 安装依赖

```bash
# FastAPI + uvicorn + multipart 文件上传
uv pip install fastapi uvicorn[standard] python-multipart \
    --python F:/GraphRAGAgent/langextract_src/.venv/Scripts/python.exe

# 已有依赖（无需重复安装）
# langextract[all]、langchain、langchain-openai、networkx、python-dotenv、flask、requests
```

### 启动服务

```bash
# 开发模式（--reload 热重载）
F:/GraphRAGAgent/langextract_src/.venv/Scripts/python.exe -m uvicorn \
    graphrag_pipeline.api_server:app \
    --host 0.0.0.0 --port 8000 --reload

# 或直接运行主入口
F:/GraphRAGAgent/langextract_src/.venv/Scripts/python.exe \
    F:/GraphRAGAgent/graphrag_pipeline/api_server.py
```

### API 文档访问

FastAPI 自动生成 OpenAPI 文档，启动后可访问：

| 地址 | 说明 |
|------|------|
| `http://localhost:8000/api/v1/health` | 健康检查（验证服务启动） |
| `http://localhost:8000/docs` | Swagger UI（交互式 API 文档） |
| `http://localhost:8000/redoc` | ReDoc（只读 API 文档） |
| `http://localhost:8000/openapi.json` | OpenAPI JSON Schema |

### 端口说明

| 服务 | 端口 | 说明 |
|------|------|------|
| **FastAPI（新）** | `8000` | 本规范描述的生产级 API |
| Flask web_server.py（旧） | `5000` | 原型，保留用于对比 |
