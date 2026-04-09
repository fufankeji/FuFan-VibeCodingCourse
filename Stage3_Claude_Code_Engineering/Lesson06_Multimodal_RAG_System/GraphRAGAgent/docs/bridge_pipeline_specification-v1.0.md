# Bridge Pipeline Specification v1.0

> GraphRAG 索引阶段核心流程：MinerU → LangExtract → Knowledge Graph

---

## 1. Pipeline 执行思路

### 1.1 整体架构

Bridge Pipeline 是 GraphRAG 索引阶段的核心流程，负责将 MinerU 解析后的结构化 PDF 内容送入 LangExtract 完成实体抽取，最终生成知识图谱的节点（Nodes）和边（Edges）。

```
MinerU output                    Bridge Pipeline                      KG output
─────────────                    ───────────────                      ─────────
{uuid}_content_list.json    →    text_assembler.py
  ├─ text blocks                   ├─ 按页拼接纯文本
  └─ table blocks (HTML)           ├─ HTML表格→纯文本
                                   └─ 记录每个block的char偏移
                              →    entity_extractor.py
                                   ├─ 逐页调用 lx.extract()
                                   └─ DeepSeek via OpenAI Provider
                              →    kg_builder.py
                                   ├─ 过滤低质量对齐                  →  kg_nodes.json
                                   ├─ 节点去重 (name.lower(), type)
                                   └─ 同页实体对→CO_OCCURS_IN边       →  kg_edges.json
```

### 1.2 五步执行流程

| 步骤 | 模块 | 说明 |
|------|------|------|
| Step 1 | `bridge.py` | 加载 MinerU 输出 `content_list.json`，解析输入路径和 source_doc_id |
| Step 2 | `text_assembler.py` | 按 `page_idx` 分组，拼接纯文本，记录每个 block 的字符偏移 |
| Step 3 | `entity_extractor.py` | 逐页调用 LangExtract + DeepSeek 完成实体抽取 |
| Step 4 | `kg_builder.py` | 过滤低质量对齐 → 节点去重 → 同页配对生成 CO_OCCURS_IN 边 |
| Step 5 | `bridge.py` | 保存 `kg_nodes.json` + `kg_edges.json` 到 output 目录 |

### 1.3 文件存放位置

```
F:\GraphRAGAgent\graphrag_pipeline\
├── .env                     # DeepSeek API 配置
├── CLAUDE.md                # 组件开发规范
├── bridge.py                # 主入口（串联完整 Pipeline）
├── text_assembler.py        # MinerU JSON → 按页纯文本 + 偏移映射
├── entity_extractor.py      # LangExtract + DeepSeek 封装
├── kg_builder.py            # KG 节点去重 + 边生成
└── output/
    ├── kg_nodes.json        # 知识图谱节点（9,851 bytes）
    └── kg_edges.json        # 知识图谱边（129,093 bytes）
```

### 1.4 运行命令

```bash
# 使用默认测试输入
F:/GraphRAGAgent/langextract_src/.venv/Scripts/python.exe F:/GraphRAGAgent/graphrag_pipeline/bridge.py

# 指定输入文件
F:/GraphRAGAgent/langextract_src/.venv/Scripts/python.exe F:/GraphRAGAgent/graphrag_pipeline/bridge.py path/to/content_list.json

# 指定输入目录（自动查找 *_content_list.json）
F:/GraphRAGAgent/langextract_src/.venv/Scripts/python.exe F:/GraphRAGAgent/graphrag_pipeline/bridge.py path/to/output_dir/
```

---

## 2. 实际本地输出文档规范

### 2.1 测试运行结果

- **输入文件**: `F:\GraphRAGAgent\mineru_mvp\output\test_sample\8a719db4-2b50-405b-826d-7bb27b224fa0_content_list.json`
- **输入规模**: 10 blocks（9 text + 1 table），1 页，2102 字符
- **抽取结果**: 45 raw extractions → 40 去重节点，780 CO_OCCURS_IN 边
- **对齐质量**: 全部 40 节点均为 `match_exact`（1 个 `match_fuzzy` 已被过滤）
- **执行时间**: ~22s（DeepSeek API 调用）

### 2.2 kg_nodes.json — 实际输出

**文件大小**: 9,851 bytes | **节点数**: 40

**节点类型分布**:

| 类型 | 数量 | 示例 |
|------|------|------|
| TECHNOLOGY | 4 | GraphRAG, MinerU, LLMs, LangExtract |
| CONCEPT | 36 | knowledge graphs, retrieval-augmented generation, multi-hop reasoning |

**节点格式（实际样例）**:

```json
{
  "id": "node_0",
  "name": "GraphRAG",
  "type": "TECHNOLOGY",
  "source_doc": "8a719db4-2b50-405b-826d-7bb27b224fa0",
  "char_start": 0,
  "char_end": 8,
  "confidence": "match_exact",
  "page": 0
}
```

**完整节点列表（前 10 个）**:

| id | name | type | confidence |
|----|------|------|-----------|
| node_0 | GraphRAG | TECHNOLOGY | match_exact |
| node_1 | Knowledge Graph Enhanced RAG System | CONCEPT | match_exact |
| node_2 | retrieval-augmented generation | CONCEPT | match_exact |
| node_3 | knowledge graphs | CONCEPT | match_exact |
| node_4 | large language models | CONCEPT | match_exact |
| node_5 | question answering | CONCEPT | match_exact |
| node_6 | document collections | CONCEPT | match_exact |
| node_7 | RAG systems | CONCEPT | match_exact |
| node_8 | vector similarity search | CONCEPT | match_exact |
| node_9 | hierarchical knowledge graph | CONCEPT | match_exact |

### 2.3 kg_edges.json — 实际输出

**文件大小**: 129,093 bytes | **边数**: 780

**数学验证**: 40 个节点全部在同一页 → C(40,2) = 40×39/2 = 780 条边 ✓

**边格式（实际样例）**:

```json
{
  "source": "node_0",
  "target": "node_1",
  "relation": "CO_OCCURS_IN",
  "doc_id": "8a719db4-2b50-405b-826d-7bb27b224fa0",
  "page": 0
}
```

**完整性校验结果**:
- 自环数: 0 ✓
- 重复边数: 0 ✓
- 关系类型: 全部为 `CO_OCCURS_IN` ✓

---

## 3. MinerU Pipeline 关键参数规范

### 3.1 输入格式：content_list.json

MinerU 解析 PDF 后输出的 `{uuid}_content_list.json` 是一个 JSON 数组，每个元素代表一个内容块。

**text block 结构**:

```json
{
  "type": "text",
  "text": "GraphRAG: Knowledge Graph Enhanced RAG System...",
  "text_level": null,
  "page_idx": 0,
  "bbox": [72, 43, 523, 57]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | string | 块类型：`"text"` \| `"table"` \| `"image"` |
| `text` | string | 文本内容（末尾可能有空格） |
| `text_level` | int \| null | `null`=正文，`1`=一级标题 |
| `page_idx` | int | 页码（从 0 开始） |
| `bbox` | list[int] | 边界框坐标 `[x0, y0, x1, y1]`（归一化 0-1000） |

**table block 结构**:

```json
{
  "type": "table",
  "table_body": "<table><tr><th>Method</th><th>Score</th></tr>...</table>",
  "table_caption": [],
  "page_idx": 0,
  "bbox": [72, 400, 523, 500]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `table_body` | string | HTML `<table>` 标签完整内容 |
| `table_caption` | list | 表格标题（通常为空数组） |

### 3.2 关键约束

- 文件命名: `{uuid}_content_list.json`，UUID 用作 source_doc_id
- block 排列顺序与 PDF 阅读顺序一致
- `text` 字段末尾可能有多余空格，需 `.rstrip()` 处理
- `image` 类型块不含可提取文本，Bridge 跳过处理

---

## 4. LangExtract Pipeline 关键参数规范

### 4.1 模型配置

```python
from langextract.providers.openai import OpenAILanguageModel

model = OpenAILanguageModel(
    model_id="deepseek-chat",
    api_key=DEEPSEEK_API_KEY,
    base_url="https://api.deepseek.com",
)
```

**重要**: 必须直接实例化 `OpenAILanguageModel`，不能使用 `model_id` 路由。LangExtract 的 `model_id` 同时用于内部路由和 API 请求参数，DeepSeek 不识别 GPT 模型名称。

### 4.2 抽取调用

```python
result = lx.extract(
    text_or_documents=page_text,       # 纯文本字符串
    prompt_description=PROMPT,          # 实体类型描述
    examples=EXAMPLES,                  # Few-shot 示例
    model=model,                        # 直接传入模型实例
    show_progress=True,
)
```

### 4.3 Prompt 配置

```
Extract named entities from the text in order of appearance.
Entity types:
  TECHNOLOGY — software, algorithms, models, tools
  ORGANIZATION — companies, research groups, institutions
  PERSON — individual people
  LOCATION — places, geographic entities
  CONCEPT — technical concepts, methodologies, frameworks
```

### 4.4 Few-shot 示例

验证可用的示例（MVP 测试 94.1% match_exact）：

```python
lx.data.ExampleData(
    text="LangChain is a framework created by Harrison Chase for building "
         "LLM applications. It integrates with OpenAI models and Pinecone "
         "vector database for semantic search.",
    extractions=[
        lx.data.Extraction(extraction_class="TECHNOLOGY", extraction_text="LangChain"),
        lx.data.Extraction(extraction_class="PERSON", extraction_text="Harrison Chase"),
        lx.data.Extraction(extraction_class="CONCEPT", extraction_text="LLM applications"),
        lx.data.Extraction(extraction_class="TECHNOLOGY", extraction_text="OpenAI models"),
        lx.data.Extraction(extraction_class="TECHNOLOGY", extraction_text="Pinecone"),
        lx.data.Extraction(extraction_class="CONCEPT", extraction_text="semantic search"),
    ],
)
```

### 4.5 输出格式：AnnotatedDocument

每页抽取返回一个 `AnnotatedDocument`，其 `extractions` 列表中每个元素包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `extraction_text` | string | 实体名称（必须为输入文本的精确子串） |
| `extraction_class` | string | 实体类型（TECHNOLOGY/ORGANIZATION/PERSON/LOCATION/CONCEPT） |
| `char_interval.start_pos` | int | 在输入文本中的起始字符位置 |
| `char_interval.end_pos` | int | 在输入文本中的结束字符位置 |
| `alignment_status` | enum | 对齐质量：`match_exact` \| `match_greater` \| `match_lesser` \| `match_fuzzy` \| `None` |
| `extraction_index` | int | 抽取序号（从 1 开始） |
| `group_index` | int | 组序号（从 0 开始） |

### 4.6 对齐质量过滤规则

| alignment_status | 含义 | Bridge 处理 |
|-----------------|------|------------|
| `match_exact` | LLM 输出与原文完全匹配 | ✅ 接受 |
| `match_greater` | LLM 输出是原文子串的超集 | ✅ 接受 |
| `match_lesser` | LLM 输出是原文子串的子集 | ✅ 接受 |
| `match_fuzzy` | 模糊匹配，偏移不可靠 | ❌ 过滤 |
| `None` | 无法对齐 | ❌ 过滤 |

---

## 5. MinerU ↔ LangExtract 接口对接规范

### 5.1 核心挑战

MinerU 输出结构化 JSON 块（含 HTML 表格），而 LangExtract 仅接受纯文本 `str`。Bridge 的 `text_assembler` 模块负责转换和偏移映射。

### 5.2 对接转换规则

| 对接点 | MinerU 规范 | LangExtract 规范 | Bridge 处理 |
|--------|------------|-----------------|------------|
| 输入格式 | `content_list.json`（JSON 数组） | 仅接受纯文本 `str` | `text_assembler` 拼接转换 |
| 文本块 | `block["text"]`，末尾可能有空格 | `extraction_text` 须为原文精确子串 | `.rstrip()` 去尾部空格 |
| 表格块 | `table_body` 是 `<table>` HTML | 不接受 HTML | BeautifulSoup 转 pipe 分隔纯文本 |
| 标题判断 | `text_level` 缺失=正文，存在=标题 | 不区分标题/正文 | 标题和正文一起拼入文本 |
| 坐标系 | bbox 归一化 0-1000 | char_interval 基于输入字符 | BlockSpan 记录偏移映射 |
| 分页 | `page_idx` 区分不同页 | 单次调用处理一段文本 | 逐页分别调用 `lx.extract()` |
| 文件名 | `{uuid}_content_list.json` | — | glob `*_content_list.json` 匹配 |

### 5.3 文本拼接算法

```
输入: content_list (按 page_idx 分组)
输出: PageText 列表

对每页:
  cursor = 0
  对每个 block (保持原顺序):
    if type == "text":
      block_text = block["text"].rstrip()
    elif type == "table":
      block_text = html_table_to_text(block["table_body"])
    else:
      跳过 (image / equation 等)

    记录 BlockSpan(char_start=cursor, char_end=cursor+len(block_text))
    buffer.append(block_text + "\n")
    cursor += len(block_text) + 1

  PageText.text = "".join(buffer).rstrip("\n")
```

### 5.4 偏移映射数据结构

```python
@dataclasses.dataclass
class BlockSpan:
    block_index: int    # content_list 数组下标
    block_type: str     # "text" | "table"
    page_idx: int       # 页码
    char_start: int     # 在拼接文本中的起始位置
    char_end: int       # 在拼接文本中的结束位置（不含）
    bbox: list[int]     # MinerU 原始 bbox

@dataclasses.dataclass
class PageText:
    page_idx: int                   # 页码
    text: str                       # 拼接后的纯文本
    block_spans: list[BlockSpan]    # 每个 block 在 text 中的位置
```

### 5.5 HTML 表格转换

```python
def html_table_to_text(table_body: str) -> str:
    """Convert <table> HTML → pipe-delimited plain text"""
    soup = BeautifulSoup(table_body, "html.parser")
    rows = []
    for tr in soup.find_all("tr"):
        cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
        rows.append(" | ".join(cells))
    return "\n".join(rows)
```

转换示例：

```html
<table><tr><th>Method</th><th>Score</th></tr><tr><td>GraphRAG</td><td>0.85</td></tr></table>
```

→

```
Method | Score
GraphRAG | 0.85
```

---

## 6. Bridge Pipeline 最终输出关键参数规范

### 6.1 kg_nodes.json

**文件路径**: `graphrag_pipeline/output/kg_nodes.json`

**结构**: JSON 数组，每个元素为一个去重后的实体节点。

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `id` | string | 节点唯一标识，格式 `node_{index}` | `"node_0"` |
| `name` | string | 实体名称（原文子串） | `"GraphRAG"` |
| `type` | string | 实体类型 | `"TECHNOLOGY"` |
| `source_doc` | string | 来源文档 UUID | `"8a719db4-2b50-405b-826d-7bb27b224fa0"` |
| `char_start` | int | 在拼接文本中的起始字符位置 | `0` |
| `char_end` | int | 在拼接文本中的结束字符位置 | `8` |
| `confidence` | string | 对齐质量（仅 `match_exact`/`match_greater`/`match_lesser`） | `"match_exact"` |
| `page` | int | 来源页码（从 0 开始） | `0` |

**去重规则**: key = `(name.lower(), type)`，保留首次出现的实体。

**实体类型枚举**:

| 类型 | 说明 |
|------|------|
| `TECHNOLOGY` | 软件、算法、模型、工具 |
| `ORGANIZATION` | 公司、研究机构 |
| `PERSON` | 个人 |
| `LOCATION` | 地理位置 |
| `CONCEPT` | 技术概念、方法论、框架 |

### 6.2 kg_edges.json

**文件路径**: `graphrag_pipeline/output/kg_edges.json`

**结构**: JSON 数组，每个元素为一条同页共现关系边。

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `source` | string | 源节点 ID | `"node_0"` |
| `target` | string | 目标节点 ID | `"node_1"` |
| `relation` | string | 关系类型（固定 `"CO_OCCURS_IN"`） | `"CO_OCCURS_IN"` |
| `doc_id` | string | 来源文档 UUID | `"8a719db4-..."` |
| `page` | int | 共现页码 | `0` |

**边生成规则**:
1. 按页分组所有去重后的节点 ID
2. 同页节点两两配对 → 生成 `CO_OCCURS_IN` 边
3. 边方向规范化: `source < target`（字典序）
4. 去重 key: `(source, target, doc_id, page)`
5. 无自环（source ≠ target）

**边数公式**: 若某页有 N 个节点，则该页产生 C(N,2) = N×(N-1)/2 条边。

### 6.3 输出完整性约束

| 约束 | 说明 |
|------|------|
| 节点 ID 唯一 | 每个节点的 `id` 字段全局唯一 |
| 边引用合法 | 每条边的 `source` 和 `target` 必须对应存在的节点 `id` |
| 无自环 | 不存在 `source == target` 的边 |
| 无重复边 | 同一 `(source, target, doc_id, page)` 组合仅出现一次 |
| 对齐质量保证 | 所有节点的 `confidence` 仅为 accepted 值（非 fuzzy/null） |
| char 偏移有效 | `char_start < char_end`，且可定位到拼接文本中的实体子串 |

---

## 7. 虚拟环境规范

Bridge Pipeline **复用 LangExtract 的虚拟环境**，不单独创建 venv。

| 项目 | 值 |
|------|------|
| 虚拟环境路径 | `F:\GraphRAGAgent\langextract_src\.venv\` |
| Python 版本 | 3.12 |
| 核心依赖 | `langextract[all]`、`beautifulsoup4`、`python-dotenv` |
| 安装新依赖 | `uv pip install <pkg> --python F:/GraphRAGAgent/langextract_src/.venv/Scripts/python.exe` |

**所有 Python 命令必须使用该虚拟环境运行，禁止使用全局 Python 或其他组件的 venv。**

---

## 8. 环境配置

### 8.1 .env 文件

位置: `F:\GraphRAGAgent\graphrag_pipeline\.env`

```env
DEEPSEEK_API_KEY=<your-api-key>
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

### 8.2 依赖安装

```bash
uv pip install beautifulsoup4 python-dotenv --python F:/GraphRAGAgent/langextract_src/.venv/Scripts/python.exe
```

---

## 9. 测试验证清单

- [x] text_assembler 正确读取 content_list.json（10 blocks: 9 text + 1 table）
- [x] 表格 HTML 转为 pipe 分隔纯文本，无 HTML 标签残留
- [x] 按页拼接文本长度合理（2102 字符/页）
- [x] LangExtract 成功调用 DeepSeek 返回 AnnotatedDocument
- [x] 抽取实体数 45，match_exact 占比 > 95%
- [x] kg_nodes.json 节点已去重（40 个），每个节点有完整字段
- [x] kg_edges.json 边为 CO_OCCURS_IN 关系（780 条），无自环，无重复
- [x] match_fuzzy 对齐的实体已被过滤（1 个）
