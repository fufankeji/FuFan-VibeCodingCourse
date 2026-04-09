# LangExtract Pipeline 规范文档 v1.0

> 基于 [google/langextract](https://github.com/google/langextract) 源码分析 + MVP 实测验证
> 版本基线：2026-03-04 main 分支
> 本地源码路径：`F:\GraphRAGAgent\langextract_src\`
> 测试脚本路径：`F:\GraphRAGAgent\langextract_src\mvp_test_deepseek.py`

---

## 目录

- [〇、虚拟环境](#〇虚拟环境)
- [一、Pipeline 执行流程](#一pipeline-执行流程)
  - [1.1 完整执行链路](#11-完整执行链路)
  - [1.2 MVP 测试脚本](#12-mvp-测试脚本)
  - [1.3 输入规范](#13-输入规范)
  - [1.4 不支持的输入格式](#14-不支持的输入格式)
- [二、模型接入规范](#二模型接入规范)
  - [2.1 模型路由机制](#21-模型路由机制)
  - [2.2 DeepSeek 接入（实测验证）](#22-deepseek-接入实测验证)
  - [2.3 路由陷阱与规避方案](#23-路由陷阱与规避方案)
  - [2.4 OpenAI Provider 构造参数](#24-openai-provider-构造参数)
- [三、关键参数规范](#三关键参数规范)
  - [3.1 extract() 核心参数](#31-extract-核心参数)
  - [3.2 ExampleData 示例数据格式](#32-exampledata-示例数据格式)
  - [3.3 Extraction 示例条目格式](#33-extraction-示例条目格式)
  - [3.4 分块参数](#34-分块参数)
  - [3.5 Resolver 对齐参数](#35-resolver-对齐参数)
- [四、输出数据格式规范](#四输出数据格式规范)
  - [4.1 JSONL 输出文件（实际生成）](#41-jsonl-输出文件实际生成)
  - [4.2 AnnotatedDocument 顶层结构](#42-annotateddocument-顶层结构)
  - [4.3 Extraction 字段规范（实测对比）](#43-extraction-字段规范实测对比)
  - [4.4 CharInterval 字符锚点](#44-charinterval-字符锚点)
  - [4.5 AlignmentStatus 对齐状态枚举](#45-alignmentstatus-对齐状态枚举)
  - [4.6 extraction_summary.json（自定义摘要）](#46-extraction_summaryjson自定义摘要)
- [五、本地生成文件清单](#五本地生成文件清单)
- [附录：环境变量与常量速查](#附录环境变量与常量速查)

---

## 〇、虚拟环境

本组件使用独立的 Python 虚拟环境，与项目其他组件（MinerU MVP、GraphRAG Pipeline 等）完全隔离。

**所有 Python 命令必须在子虚拟环境中运行，禁止使用全局 Python 或其他组件的 venv。**

### 环境信息

- 虚拟环境路径：`F:\GraphRAGAgent\langextract_src\.venv\`
- Python 版本：3.12
- 创建工具：uv
- 安装方式：`uv pip install -e ".[all]"` （含 openai、google-genai 等 60 个包）

### 运行方式

**方式一：直接使用 venv 内的 Python 解释器（推荐）**

```bash
F:/GraphRAGAgent/langextract_src/.venv/Scripts/python.exe mvp_test_deepseek.py
```

**方式二：先激活环境再运行**

```bash
cd F:/GraphRAGAgent/langextract_src
source .venv/Scripts/activate
python mvp_test_deepseek.py
```

### 安装新依赖

```bash
uv pip install <package> --python F:/GraphRAGAgent/langextract_src/.venv/Scripts/python.exe
```

---

## 一、Pipeline 执行流程

### 1.1 完整执行链路

基于 MVP 实测验证的完整 Pipeline 分为 5 个阶段：

```
Step 0: 激活虚拟环境
  └── F:/GraphRAGAgent/langextract_src/.venv/Scripts/python.exe

Step 1: 准备输入
  ├── 构造纯文本字符串（str）
  ├── 或构造 Document 对象列表
  └── LangExtract 仅接受纯文本，PDF/DOCX 等需前置解析

Step 2: 构造 Few-shot 示例
  ├── 创建 ExampleData 对象列表
  ├── 每个 ExampleData 包含：text（示例文本） + extractions（标注实体列表）
  └── extraction_text 必须是 text 的精确子串

Step 3: 配置模型并调用 extract()
  ├── 直接实例化 OpenAILanguageModel（DeepSeek 场景）
  ├── 传入 model_id="deepseek-chat", base_url, api_key
  └── 调用 lx.extract(text_or_documents=..., examples=..., model=model)

Step 4: LangExtract 内部处理
  ├── 文本分块（基于句子边界，max_char_buffer=1000）
  ├── 构造 Prompt（含 prompt_description + examples）
  ├── 调用 LLM 推理（JSON 格式输出）
  ├── 解析 LLM JSON 响应为 Extraction 对象
  └── 字符级对齐（char_interval + alignment_status）

Step 5: 保存输出
  ├── lx.io.save_annotated_documents() → JSONL 文件
  └── 自定义 JSON 摘要（可选）
```

### 1.2 MVP 测试脚本

**文件路径：** `F:\GraphRAGAgent\langextract_src\mvp_test_deepseek.py`

**执行命令：**

```bash
F:/GraphRAGAgent/langextract_src/.venv/Scripts/python.exe mvp_test_deepseek.py
```

**脚本核心流程：**

```python
from langextract.providers.openai import OpenAILanguageModel

# Step 1: 直接实例化 OpenAI Provider（指向 DeepSeek）
model = OpenAILanguageModel(
    model_id="deepseek-chat",
    api_key="sk-...",
    base_url="https://api.deepseek.com",
)

# Step 2: 构造示例数据
examples = [
    lx.data.ExampleData(
        text="LangChain is a framework created by Harrison Chase...",
        extractions=[
            lx.data.Extraction(extraction_class="TECHNOLOGY", extraction_text="LangChain"),
            lx.data.Extraction(extraction_class="ORGANIZATION", extraction_text="Harrison Chase"),
            ...
        ],
    )
]

# Step 3: 调用抽取
result = lx.extract(
    text_or_documents=input_text,
    prompt_description="Extract named entities...",
    examples=examples,
    model=model,
    show_progress=True,
)

# Step 4: 保存结果
lx.io.save_annotated_documents([result], output_name="graphrag_entities.jsonl", output_dir="mvp_output")
```

**实测结果：**

| 指标 | 值 |
|------|-----|
| 输入文本长度 | 520 字符 |
| 模型 | deepseek-chat |
| 耗时 | 21.6 秒 |
| 提取实体数 | 17 |
| 实体类型分布 | TECHNOLOGY: 9, CONCEPT: 7, ORGANIZATION: 1 |
| 精确匹配率 | 16/17 (94.1%) — 仅 1 个 match_fuzzy |
| 输出文件 | 2 个（JSONL + JSON 摘要） |

### 1.3 输入规范

LangExtract **仅接受纯文本**作为输入，支持以下 4 种传入方式：

| 输入方式 | 示例 | 说明 |
|---------|------|------|
| **纯文本字符串** | `extract("这是一段文本...")` | 直接传入文本内容（MVP 实测使用此方式） |
| **URL** | `extract("https://example.com/article.txt")` | 自动下载 URL 文本内容（`fetch_urls=True`） |
| **Document 对象** | `extract([Document(text="...", document_id="doc1")])` | 传入 Document 可迭代集合 |
| **CSV 文件** | 通过 `Dataset` 类加载后传入 | 指定 text 列和 id 列 |

### 1.4 不支持的输入格式

以下格式 **不被支持**，需要在 LangExtract 之前通过外部工具预处理为纯文本：

| 格式 | 状态 | 预处理方案 |
|------|------|-----------|
| PDF | ❌ 不支持 | 使用 MinerU / PyMuPDF 先转文本 |
| DOCX | ❌ 不支持 | 使用 python-docx 先转文本 |
| HTML | ❌ 不支持 | 使用 BeautifulSoup 先提取文本 |
| 图片 | ❌ 不支持 | 使用 OCR 工具先识别文本 |
| Markdown（含媒体） | ❌ 不支持 | 需提取纯文本部分 |
| Excel / JSON | ❌ 不支持 | 需序列化为纯文本 |

---

## 二、模型接入规范

### 2.1 模型路由机制

文件路径：`langextract/providers/patterns.py`

LangExtract 通过 **正则匹配 `model_id`** 自动路由到对应的 Provider：

| Provider | 匹配模式 | 优先级 | 示例模型 |
|----------|---------|--------|---------|
| **Gemini** | `^gemini` | 10 | `gemini-2.5-flash`, `gemini-1.5-pro` |
| **OpenAI** | `^gpt-4`, `^gpt4.`, `^gpt-5`, `^gpt5.` | 10 | `gpt-4o`, `gpt-4o-mini` |
| **Ollama** | `gemma`, `llama`, `mistral`, `phi`, `qwen`, `deepseek` 等 | 10 | `gemma2:2b`, `llama3.2:1b` |

### 2.2 DeepSeek 接入（实测验证）

> **重要发现：** 规范文档 v0 中描述的 `model_id="gpt-4o-mini"` + `language_model_params={"base_url": ...}` 方式 **实测不可用**，因为 `model_id` 同时用于路由和 API 调用，DeepSeek 不识别 `gpt-4o-mini` 模型名。

**正确方式 — 直接实例化 OpenAI Provider：**

```python
from langextract.providers.openai import OpenAILanguageModel

model = OpenAILanguageModel(
    model_id="deepseek-chat",           # DeepSeek 实际模型名
    api_key="sk-your-deepseek-key",
    base_url="https://api.deepseek.com",
)

result = lx.extract(
    text_or_documents="...",
    examples=[...],
    model=model,                         # 通过 model 参数传入，绕过路由
    show_progress=True,
)
```

**实测验证状态：** DeepSeek `deepseek-chat` 模型通过此方式成功完成实体抽取，JSON 格式输出正常。

### 2.3 路由陷阱与规避方案

| 方案 | 能否工作 | 原因 |
|------|---------|------|
| `model_id="gpt-4o-mini"` + `language_model_params={"base_url": "https://api.deepseek.com"}` | **不能** | `model_id` 被同时用作 API 调用的 `model` 参数，DeepSeek 返回 `400 Model Not Exist` |
| `config=ModelConfig(model_id="deepseek-chat", provider="openai")` | **不能** | `_create_model_with_schema()` 中使用 `provider` 时未先调用 `load_builtins_once()`，导致 `No provider found` 错误（LangExtract 内部 bug） |
| `model=OpenAILanguageModel(model_id="deepseek-chat", ...)` | **可以** | 直接实例化绕过路由，`model_id` 正确传递给 DeepSeek API |

### 2.4 OpenAI Provider 构造参数

文件路径：`langextract/providers/openai.py`

```python
class OpenAILanguageModel(BaseLanguageModel):
    def __init__(
        self,
        model_id: str = 'gpt-4o-mini',
        api_key: str | None = None,
        base_url: str | None = None,
        organization: str | None = None,
        format_type: FormatType = FormatType.JSON,
        temperature: float | None = None,
        max_workers: int = 10,
        **kwargs,
    )
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `model_id` | `gpt-4o-mini` | 模型标识（同时作为 API 调用的 model 参数） |
| `api_key` | `None` | 环境变量：`OPENAI_API_KEY` 或 `LANGEXTRACT_API_KEY` |
| `base_url` | `None` | 自定义 API 端点（DeepSeek 使用 `https://api.deepseek.com`） |
| `temperature` | `None` | 采样温度 |
| `format_type` | `JSON` | 输出格式（JSON Mode） |

---

## 三、关键参数规范

### 3.1 extract() 核心参数

文件路径：`langextract/extraction.py`

```python
def extract(
    text_or_documents: typing.Any,          # 必填：纯文本或 Document 列表
    prompt_description: str | None = None,  # 抽取提示词
    examples: typing.Sequence[Any] | None = None,  # 必填：Few-shot 示例
    model_id: str = "gemini-2.5-flash",     # 模型标识（用于路由）
    api_key: str | None = None,             # API Key
    model: typing.Any = None,               # 预配置的模型实例（最高优先级）
    max_char_buffer: int = 1000,            # 分块最大字符数
    temperature: float | None = None,       # 采样温度
    batch_length: int = 10,                 # 每批分块数
    max_workers: int = 10,                  # 最大并行线程
    additional_context: str | None = None,  # 附加上下文
    resolver_params: dict | None = None,    # 对齐参数
    language_model_params: dict | None = None,  # Provider 构造参数
    extraction_passes: int = 1,             # 抽取轮次
    context_window_chars: int | None = None, # 上下文窗口
    config: typing.Any = None,              # ModelConfig 实例
    model_url: str | None = None,           # 自托管端点
    show_progress: bool = True,             # 显示进度条
    ...
) -> list[AnnotatedDocument] | AnnotatedDocument
```

**MVP 实测使用的参数组合：**

| 参数 | 实测值 | 说明 |
|------|--------|------|
| `text_or_documents` | 520 字符纯文本 | GraphRAG 领域相关文本 |
| `prompt_description` | `"Extract named entities..."` | 指定 TECHNOLOGY/ORGANIZATION/CONCEPT 三类 |
| `examples` | 1 个 ExampleData（含 6 个 Extraction） | Few-shot 示例 |
| `model` | `OpenAILanguageModel` 实例 | 直接实例化，指向 DeepSeek |
| `show_progress` | `True` | 显示进度 |
| `max_char_buffer` | 1000（默认） | 文本未超过阈值，未触发分块 |

### 3.2 ExampleData 示例数据格式

文件路径：`langextract/core/data.py`

```python
@dataclasses.dataclass
class ExampleData:
    text: str                                    # 示例文本（必填）
    extractions: list[Extraction]                # 标注的实体列表（必填）
```

**MVP 实测示例：**

```python
lx.data.ExampleData(
    text="LangChain is a framework created by Harrison Chase for building "
         "LLM applications. It integrates with OpenAI models and Pinecone "
         "vector database for semantic search.",
    extractions=[
        lx.data.Extraction(extraction_class="TECHNOLOGY", extraction_text="LangChain"),
        lx.data.Extraction(extraction_class="ORGANIZATION", extraction_text="Harrison Chase"),
        lx.data.Extraction(extraction_class="CONCEPT", extraction_text="LLM applications"),
        lx.data.Extraction(extraction_class="TECHNOLOGY", extraction_text="OpenAI models"),
        lx.data.Extraction(extraction_class="TECHNOLOGY", extraction_text="Pinecone"),
        lx.data.Extraction(extraction_class="CONCEPT", extraction_text="semantic search"),
    ],
)
```

**约束条件：**
- `extraction_text` **必须是** `text` 的精确子串（否则对齐失败）
- `extraction_class` 为自定义字符串，无预定义枚举
- `examples` 列表不能为空（否则抛出 `ValueError`）
- 每个 ExampleData 可包含多个不同 `extraction_class` 的条目

### 3.3 Extraction 示例条目格式

```python
@dataclasses.dataclass(init=False)
class Extraction:
    extraction_class: str                     # 必填：实体类型
    extraction_text: str                      # 必填：实体文本（须为原文子串）
    attributes: dict[str, str | list[str]] | None = None  # 可选：附加属性
    description: str | None = None            # 可选：实体描述
```

在 examples 中创建时只需要 `extraction_class` 和 `extraction_text`，其余字段由 LangExtract 在推理后自动填充。

### 3.4 分块参数

文件路径：`langextract/chunking.py`

LangExtract 使用基于 **句子边界** 的确定性分块策略：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `max_char_buffer` | 1000 | 每个分块最大字符数 |
| `context_window_chars` | `None` | 前一分块的上下文窗口（用于指代消解） |
| `batch_length` | 10 | 每批处理的分块数 |

**分块策略：**
1. 如果单个句子超过 `max_char_buffer`，按换行符拆分
2. 如果单个 token 超过 `max_char_buffer`，该 token 独占一个分块
3. 如果多个句子可以放入 `max_char_buffer`，合并为一个分块

> **MVP 实测：** 输入文本 520 字符 < `max_char_buffer`（1000），整段文本作为单一分块处理，未触发分块逻辑。

### 3.5 Resolver 对齐参数

通过 `extract()` 的 `resolver_params` 字典传入：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enable_fuzzy_alignment` | `bool` | `True` | 精确匹配失败后是否尝试模糊匹配 |
| `fuzzy_alignment_threshold` | `float` | `0.75` | 模糊匹配最低 token 重叠比率 |
| `accept_match_lesser` | `bool` | `True` | 是否接受部分精确匹配 |
| `suppress_parse_errors` | `bool` | `False` | JSON 解析失败时是否继续 |

> **MVP 实测：** 未传入 `resolver_params`，使用全部默认值。17 个抽取中 16 个 `match_exact`，1 个 `match_fuzzy`（"Microsoft Research"）。

---

## 四、输出数据格式规范

### 4.1 JSONL 输出文件（实际生成）

**文件路径：** `mvp_output/graphrag_entities.jsonl`
**文件大小：** 4,650 bytes
**格式：** JSONL（JSON Lines），每行一个完整的 JSON 对象

保存 API：

```python
lx.io.save_annotated_documents(
    [result],
    output_name="graphrag_entities.jsonl",
    output_dir="mvp_output"
)
```

### 4.2 AnnotatedDocument 顶层结构

**实际 JSONL 输出的顶层字段（基于本地生成文件）：**

| 字段 | 类型 | 实测值 | 说明 |
|------|------|--------|------|
| `text` | `string` | 520 字符 | 原始输入文本（完整保留） |
| `document_id` | `string` | `"doc_8498f2b6"` | 自动生成，格式 `doc_{uuid_hex[:8]}` |
| `extractions` | `array[Extraction]` | 17 个元素 | 抽取的实体列表 |

> **注意：** JSONL 中字段顺序为 `extractions` → `text` → `document_id`（与 dataclass 定义顺序不同，以实际输出为准）。

### 4.3 Extraction 字段规范（实测对比）

**实际输出的单条 Extraction 完整结构（摘自本地 JSONL 文件）：**

```json
{
  "extraction_class": "TECHNOLOGY",
  "extraction_text": "GraphRAG",
  "char_interval": {
    "start_pos": 0,
    "end_pos": 8
  },
  "alignment_status": "match_exact",
  "extraction_index": 1,
  "group_index": 0,
  "description": null,
  "attributes": {}
}
```

**实测字段对比（官方 Schema vs 实际输出）：**

| 字段 | 官方 Schema | 实际输出 | 差异说明 |
|------|------------|---------|---------|
| `extraction_class` | `string` | `string` | 一致 |
| `extraction_text` | `string` | `string` | 一致 |
| `char_interval` | `object \| null` | `object`（始终存在） | 实测 17 个全部有值 |
| `alignment_status` | `string \| null` | `string`（始终存在） | 实测 17 个全部有值 |
| `extraction_index` | `int \| null` | `int`（从 1 开始） | **实测从 1 开始，非 0** |
| `group_index` | `int \| null` | `int`（从 0 开始） | 实测从 0 开始递增 |
| `description` | `string \| null` | `null` | 未使用 description 提示时为 null |
| `attributes` | `dict \| null` | `{}`（空对象） | **实测为空对象 `{}`，非 `null`** |
| `token_interval` | `object \| null` | **不存在** | **实际 JSONL 输出中无此字段** |

**关键差异总结：**

1. `extraction_index` 从 **1** 开始（非 0）
2. `attributes` 未使用时输出空对象 `{}`（非 `null`）
3. `token_interval` 字段 **不在 JSONL 输出中**（仅存在于内存对象）

### 4.4 CharInterval 字符锚点

```json
{
  "start_pos": 0,
  "end_pos": 8
}
```

- `start_pos`：起始位置（包含），0-indexed
- `end_pos`：结束位置（不包含）
- 语义：`source_text[start_pos:end_pos]` 即为实体在原文中的精确位置

**实测验证（以 "GraphRAG" 为例）：**

```python
text = "GraphRAG is an advanced..."
text[0:8]  # → "GraphRAG"  ✓ 匹配
```

### 4.5 AlignmentStatus 对齐状态枚举

| 状态值 | 序列化值 | 含义 | 可信度 | MVP 实测数量 |
|--------|---------|------|--------|-------------|
| `MATCH_EXACT` | `"match_exact"` | LLM 输出与原文完全匹配 | 最高 | **16** |
| `MATCH_GREATER` | `"match_greater"` | LLM 输出短于匹配到的原文 | 高 | 0 |
| `MATCH_LESSER` | `"match_lesser"` | LLM 输出长于匹配到的原文 | 中 | 0 |
| `MATCH_FUZZY` | `"match_fuzzy"` | 模糊匹配 | 低 | **1** |
| `None` | `null` | 未找到对齐 | 不可信 | 0 |

> **实测精确匹配率：** 16/17 = 94.1%。唯一的 `match_fuzzy` 是 "Microsoft Research"。

### 4.6 extraction_summary.json（自定义摘要）

**文件路径：** `mvp_output/extraction_summary.json`
**文件大小：** 2,863 bytes

此文件由 MVP 测试脚本自行生成（非 LangExtract 原生输出），结构如下：

```json
{
  "total_extractions": 17,
  "extraction_classes": {
    "TECHNOLOGY": 9,
    "ORGANIZATION": 1,
    "CONCEPT": 7
  },
  "extractions": [
    {
      "class": "TECHNOLOGY",
      "text": "GraphRAG",
      "char_start": 0,
      "char_end": 8,
      "alignment": "match_exact"
    }
  ]
}
```

---

## 五、本地生成文件清单

MVP 测试后本地实际生成的文件（共 2 个输出文件）：

```
langextract_src/
├── .env                            # DeepSeek API Key 配置
├── .venv/                          # 独立虚拟环境（Python 3.12）
├── mvp_test_deepseek.py            # MVP 测试脚本
└── mvp_output/                     # 输出目录
    ├── graphrag_entities.jsonl     # LangExtract 原生 JSONL 输出（4,650 bytes）
    └── extraction_summary.json    # 自定义 JSON 摘要（2,863 bytes）
```

| 文件 | 大小 | 来源 | 说明 |
|------|------|------|------|
| `graphrag_entities.jsonl` | 4,650 bytes | `lx.io.save_annotated_documents()` | LangExtract 原生输出，1 行 JSONL，含 17 个 Extraction |
| `extraction_summary.json` | 2,863 bytes | MVP 脚本自定义 | 扁平化摘要，含类型分布统计 |

---

## 附录：环境变量与常量速查

### 环境变量

| 变量名 | 适用 Provider | 说明 |
|--------|--------------|------|
| `LANGEXTRACT_API_KEY` | 所有 | 通用 API Key 后备 |
| `GEMINI_API_KEY` | Gemini | Gemini API Key |
| `OPENAI_API_KEY` | OpenAI | OpenAI / DeepSeek API Key |
| `OLLAMA_BASE_URL` | Ollama | Ollama 服务地址（默认 `http://localhost:11434`） |

### .env 配置（MVP 实测）

```env
OPENAI_API_KEY=sk-55cb39b8a3284355bc80217c11c85d1f
```

### 模型优先级

```
model（预配置的模型实例） > config（ModelConfig 实例） > model_id + api_key
```

> **MVP 实测使用 `model` 参数**（最高优先级），直接传入 `OpenAILanguageModel` 实例。

### 结构化输出支持

| Provider | Schema 类型 | 结构化输出模式 |
|----------|------------|---------------|
| Gemini | `GeminiSchema` | 严格结构化输出 |
| OpenAI | JSON Mode | 通过 `response_format` 约束 |
| Ollama | `FormatModeSchema` | JSON 模式（非严格） |

### 17 个实测抽取实体完整列表

| # | extraction_class | extraction_text | char_interval | alignment_status |
|---|-----------------|-----------------|---------------|-----------------|
| 1 | TECHNOLOGY | GraphRAG | [0, 8] | match_exact |
| 2 | ORGANIZATION | Microsoft Research | [75, 93] | match_fuzzy |
| 3 | CONCEPT | retrieval-augmented generation | [24, 54] | match_exact |
| 4 | CONCEPT | knowledge graphs | [107, 123] | match_exact |
| 5 | TECHNOLOGY | GPT-4 | [156, 161] | match_exact |
| 6 | CONCEPT | multi-hop reasoning | [172, 191] | match_exact |
| 7 | CONCEPT | community detection algorithms | [209, 239] | match_exact |
| 8 | TECHNOLOGY | Leiden clustering | [248, 265] | match_exact |
| 9 | TECHNOLOGY | MinerU | [315, 321] | match_exact |
| 10 | TECHNOLOGY | LangExtract | [344, 355] | match_exact |
| 11 | TECHNOLOGY | Neo4j | [383, 388] | match_exact |
| 12 | CONCEPT | graph database | [396, 410] | match_exact |
| 13 | CONCEPT | pipeline | [424, 432] | match_exact |
| 14 | TECHNOLOGY | PDF documents | [443, 456] | match_exact |
| 15 | TECHNOLOGY | OCR | [465, 468] | match_exact |
| 16 | TECHNOLOGY | NLP | [473, 476] | match_exact |
| 17 | CONCEPT | knowledge graph | [504, 519] | match_exact |
