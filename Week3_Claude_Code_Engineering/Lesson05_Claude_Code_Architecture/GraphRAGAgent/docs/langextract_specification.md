# LangExtract Pipeline 规范文档

> 基于 [google/langextract](https://github.com/google/langextract) 源码分析
> 版本基线：2026-03-04 main 分支

---

## 目录

- [一、输入规范](#一输入规范)
  - [1.1 核心入口函数签名](#11-核心入口函数签名)
  - [1.2 支持的输入类型](#12-支持的输入类型)
  - [1.3 Document 数据结构](#13-document-数据结构)
  - [1.4 CSV Dataset 输入](#14-csv-dataset-输入)
  - [1.5 URL 文本下载](#15-url-文本下载)
  - [1.6 分块参数配置](#16-分块参数配置)
  - [1.7 不支持的输入格式](#17-不支持的输入格式)
- [二、模型接入规范](#二模型接入规范)
  - [2.1 模型路由机制](#21-模型路由机制)
  - [2.2 Gemini Provider](#22-gemini-provider)
  - [2.3 OpenAI Provider](#23-openai-provider)
  - [2.4 Ollama Provider](#24-ollama-provider)
  - [2.5 OpenAI 兼容接口适配（DeepSeek 等）](#25-openai-兼容接口适配deepseek-等)
  - [2.6 模型优先级与配置覆盖关系](#26-模型优先级与配置覆盖关系)
  - [2.7 关于 Embedding 模型](#27-关于-embedding-模型)
- [三、输出数据格式规范](#三输出数据格式规范)
  - [3.1 AnnotatedDocument 结构](#31-annotateddocument-结构)
  - [3.2 Extraction 结构](#32-extraction-结构)
  - [3.3 CharInterval 字符锚点](#33-charinterval-字符锚点)
  - [3.4 AlignmentStatus 对齐状态枚举](#34-alignmentstatus-对齐状态枚举)
  - [3.5 Resolver 对齐参数](#35-resolver-对齐参数)
  - [3.6 JSONL 输出文件格式](#36-jsonl-输出文件格式)
  - [3.7 完整输出 JSON Schema 示例](#37-完整输出-json-schema-示例)
  - [3.8 HTML 可视化输出](#38-html-可视化输出)
- [附录：环境变量与常量速查](#附录环境变量与常量速查)

---

## 一、输入规范

### 1.1 核心入口函数签名

文件路径：`langextract/extraction.py`

```python
def extract(
    text_or_documents: typing.Any,
    prompt_description: str | None = None,
    examples: typing.Sequence[typing.Any] | None = None,
    model_id: str = "gemini-2.5-flash",
    api_key: str | None = None,
    language_model_type: typing.Type[typing.Any] | None = None,  # 已废弃
    format_type: typing.Any = None,
    max_char_buffer: int = 1000,
    temperature: float | None = None,
    fence_output: bool | None = None,
    use_schema_constraints: bool = True,
    batch_length: int = 10,
    max_workers: int = 10,
    additional_context: str | None = None,
    resolver_params: dict | None = None,
    language_model_params: dict | None = None,
    debug: bool = False,
    model_url: str | None = None,
    extraction_passes: int = 1,
    context_window_chars: int | None = None,
    config: typing.Any = None,
    model: typing.Any = None,
    *,
    fetch_urls: bool = True,
    prompt_validation_level: PromptValidationLevel = PromptValidationLevel.WARNING,
    prompt_validation_strict: bool = False,
    show_progress: bool = True,
    tokenizer: Tokenizer | None = None,
) -> list[AnnotatedDocument] | AnnotatedDocument
```

**关键参数说明：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `text_or_documents` | `Any` | **必填** | 纯文本字符串、URL、或 `Document` 对象的可迭代集合 |
| `prompt_description` | `str \| None` | `None` | 抽取提示词，描述需要抽取什么实体 |
| `examples` | `Sequence[Any] \| None` | `None` | **必填** — Few-shot 示例列表（为空则抛出 ValueError） |
| `model_id` | `str` | `"gemini-2.5-flash"` | 模型标识符，用于自动路由到对应 Provider |
| `api_key` | `str \| None` | `None` | LLM API Key（也可通过环境变量设置） |
| `max_char_buffer` | `int` | `1000` | 每个文本分块的最大字符数 |
| `temperature` | `float \| None` | `None` | 采样温度（`None` 使用模型默认值） |
| `use_schema_constraints` | `bool` | `True` | 是否启用结构化输出约束 |
| `batch_length` | `int` | `10` | 每批处理的文本分块数量 |
| `max_workers` | `int` | `10` | 最大并行工作线程数 |
| `additional_context` | `str \| None` | `None` | 附加到推理提示词中的上下文信息 |
| `resolver_params` | `dict \| None` | `None` | 对齐解析器参数（见 [3.5 节](#35-resolver-对齐参数)） |
| `extraction_passes` | `int` | `1` | 抽取轮次（>1 时多次抽取并合并非重叠结果） |
| `context_window_chars` | `int \| None` | `None` | 前一分块的上下文窗口字符数（用于指代消解） |
| `model_url` | `str \| None` | `None` | 自托管模型的 API 端点 URL |
| `fetch_urls` | `bool` | `True` | 是否自动下载 http(s) URL 内容 |

---

### 1.2 支持的输入类型

LangExtract **仅接受纯文本**作为输入，支持以下 4 种传入方式：

| 输入方式 | 示例 | 说明 |
|---------|------|------|
| **纯文本字符串** | `extract("这是一段文本...")` | 直接传入文本内容 |
| **URL** | `extract("https://example.com/article.txt")` | 自动下载 URL 文本内容（`fetch_urls=True`） |
| **Document 对象** | `extract([Document(text="...", document_id="doc1")])` | 传入 Document 可迭代集合 |
| **CSV 文件** | 通过 `Dataset` 类加载后传入 | 指定 text 列和 id 列 |

---

### 1.3 Document 数据结构

文件路径：`langextract/core/data.py`

```python
@dataclasses.dataclass
class Document:
    text: str                                    # 必填 — 原始文本内容
    additional_context: str | None = None        # 可选 — 附加上下文
    document_id: str                             # 自动生成 — 格式 "doc_{uuid_hex[:8]}"
    tokenized_text: TokenizedText                # 惰性计算 — 分词后的文本
```

**字段说明：**

- `text`：**必填**，原始文本内容，类型为 `str`
- `additional_context`：可选，会附加到推理提示词中
- `document_id`：通过 property 访问，未设置时自动生成格式为 `doc_{uuid_hex[:8]}` 的唯一 ID
- `tokenized_text`：通过 property 惰性计算，使用配置的 Tokenizer 进行分词

---

### 1.4 CSV Dataset 输入

文件路径：`langextract/io.py`

```python
@dataclasses.dataclass(frozen=True)
class Dataset:
    input_path: pathlib.Path   # CSV 文件路径
    id_key: str                # 文档 ID 对应的列名
    text_key: str              # 文本内容对应的列名

    def load(self, delimiter: str = ',') -> Iterator[Document]:
        """仅支持 .csv 后缀文件，其他格式抛出 NotImplementedError"""
```

**CSV 文件要求：**
- 文件后缀必须为 `.csv`
- 必须包含 `text_key` 指定的文本列和 `id_key` 指定的 ID 列
- 默认分隔符为逗号（`,`），可通过 `delimiter` 参数修改
- 其他文件格式会直接抛出 `NotImplementedError`

---

### 1.5 URL 文本下载

文件路径：`langextract/io.py`

```python
def download_text_from_url(
    url: str,
    timeout: int = 30,           # 默认超时 30 秒
    show_progress: bool = True,
    chunk_size: int = 8192,
) -> str
```

**URL 要求：**
- 必须以 `http://` 或 `https://` 开头
- 仅下载文本内容（`response.text`），不解析 HTML/PDF 等
- 需要 `fetch_urls=True`（默认开启）

---

### 1.6 分块参数配置

文件路径：`langextract/chunking.py`

LangExtract 使用基于**句子边界**的确定性分块策略（非语义分块），核心类为 `ChunkIterator`：

```python
class ChunkIterator:
    def __init__(
        self,
        text: str | TokenizedText | None,
        max_char_buffer: int,           # 每个分块最大字符数
        tokenizer_impl: Tokenizer,      # 分词器实例
        document: Document | None = None,
    )
```

**分块策略：**

1. 如果单个句子超过 `max_char_buffer`，按换行符拆分，同时尊重 token 边界
2. 如果单个 token 超过 `max_char_buffer`，该 token 独占一个分块
3. 如果多个句子可以放入 `max_char_buffer`，合并为一个分块

**TextChunk 输出结构：**

```python
@dataclasses.dataclass
class TextChunk:
    token_interval: TokenInterval       # 在源文档中的 token 区间
    document: Document | None = None    # 源文档引用

    # 属性
    chunk_text: str                     # 重建的文本内容
    sanitized_chunk_text: str           # 标准化空白的文本
    char_interval: CharInterval         # 在源文档中的字符区间
    document_id: str | None             # 源文档 ID
```

---

### 1.7 不支持的输入格式

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

Ollama 额外支持 HuggingFace 格式的模型名：`meta-llama/Llama*`, `google/gemma*`, `mistralai/*`, `microsoft/phi*` 等。

---

### 2.2 Gemini Provider

文件路径：`langextract/providers/gemini.py`

```python
class GeminiLanguageModel(BaseLanguageModel):
    def __init__(
        self,
        model_id: str = 'gemini-2.5-flash',
        api_key: str | None = None,
        vertexai: bool = False,
        credentials: Any | None = None,
        project: str | None = None,
        location: str | None = None,
        http_options: Any | None = None,
        gemini_schema: GeminiSchema | None = None,
        format_type: FormatType = FormatType.JSON,
        temperature: float = 0.0,
        max_workers: int = 10,
        fence_output: bool = False,
        **kwargs,
    )
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `model_id` | `gemini-2.5-flash` | Gemini 模型标识 |
| `api_key` | `None` | 环境变量：`GEMINI_API_KEY` 或 `LANGEXTRACT_API_KEY` |
| `vertexai` | `False` | 是否使用 Vertex AI 企业认证 |
| `temperature` | `0.0` | 采样温度（确定性输出） |
| `format_type` | `JSON` | 输出格式 |

**运行时可配参数：** `temperature`, `max_output_tokens`, `top_p`, `top_k`

**额外参数白名单：** `response_schema`, `response_mime_type`, `safety_settings`, `system_instruction`, `tools`, `stop_sequences`, `candidate_count`

---

### 2.3 OpenAI Provider

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
| `model_id` | `gpt-4o-mini` | OpenAI 模型标识 |
| `api_key` | `None` | 环境变量：`OPENAI_API_KEY` 或 `LANGEXTRACT_API_KEY` |
| `base_url` | `None` | 自定义 API 端点（用于兼容接口） |
| `organization` | `None` | OpenAI 组织 ID |
| `temperature` | `None` | 采样温度 |

**运行时可配参数：** `temperature`, `max_output_tokens`, `top_p`, `frequency_penalty`, `presence_penalty`, `seed`, `stop`, `logprobs`, `top_logprobs`, `reasoning_effort`, `reasoning`, `response_format`

---

### 2.4 Ollama Provider

文件路径：`langextract/providers/ollama.py`

```python
class OllamaLanguageModel(BaseLanguageModel):
    def __init__(
        self,
        model_id: str,                                    # 必填
        model_url: str = 'http://localhost:11434',
        base_url: str | None = None,
        format_type: FormatType | None = None,
        constraint: Constraint = Constraint(),
        timeout: int | None = None,
        **kwargs,
    )
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `model_id` | **必填** | Ollama 模型名（如 `gemma2:2b`） |
| `model_url` | `http://localhost:11434` | Ollama 服务地址 |
| `timeout` | `120` | 请求超时（秒） |
| `format_type` | `JSON` | 输出格式 |

**内部默认常量：**

| 常量 | 值 | 说明 |
|------|-----|------|
| `_DEFAULT_TEMPERATURE` | `0.1` | 默认温度 |
| `_DEFAULT_TIMEOUT` | `120` | 默认超时（秒） |
| `_DEFAULT_KEEP_ALIVE` | `300` | 模型保活时间（秒） |
| `_DEFAULT_NUM_CTX` | `2048` | 默认上下文窗口大小 |

**认证支持：** 可配置 `api_key`、`auth_scheme`（默认 `Bearer`）、`auth_header`（默认 `Authorization`）用于代理 Ollama 实例。

---

### 2.5 OpenAI 兼容接口适配（DeepSeek 等）

LangExtract 的 OpenAI Provider 支持 `base_url` 参数，因此可以接入任何 OpenAI 兼容 API：

```python
# DeepSeek 接入示例
result = lx.extract(
    text_or_documents="...",
    model_id="gpt-4o-mini",               # 触发 OpenAI Provider 路由
    api_key="sk-your-deepseek-key",
    examples=[...],
    language_model_params={
        "base_url": "https://api.deepseek.com",
    },
)
```

> **注意：** 由于路由基于 `model_id` 正则匹配，使用 DeepSeek 等兼容接口时 `model_id` 仍需使用 `gpt-*` 前缀来命中 OpenAI Provider，或通过 `config` 参数显式指定 Provider。

---

### 2.6 模型优先级与配置覆盖关系

模型配置的优先级从高到低：

```
model（预配置的模型实例） > config（ModelConfig 实例） > model_id + api_key
```

**ModelConfig 结构**（`langextract/factory.py`）：

```python
@dataclasses.dataclass(slots=True, frozen=True)
class ModelConfig:
    model_id: str | None = None                              # 模型标识
    provider: str | None = None                              # 显式指定 Provider 名称
    provider_kwargs: dict[str, Any] = field(default_factory=dict)  # Provider 构造参数
```

---

### 2.7 关于 Embedding 模型

**LangExtract 不使用也不依赖任何 Embedding 模型。**

- 文本分块使用基于句子边界的确定性分割算法，不涉及语义相似度计算
- 没有向量索引或向量检索功能
- 整个代码库中没有任何 Embedding 相关的调用

---

## 三、输出数据格式规范

### 3.1 AnnotatedDocument 结构

文件路径：`langextract/core/data.py`

```python
@dataclasses.dataclass
class AnnotatedDocument:
    extractions: list[Extraction] | None = None    # 抽取结果列表
    text: str | None = None                        # 原始文本
    document_id: str                               # 文档唯一标识（自动生成）
    tokenized_text: TokenizedText                   # 分词后文本（惰性计算）
```

**序列化后的 JSON 顶层字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `document_id` | `string` | 文档唯一标识，格式 `doc_{uuid_hex[:8]}` |
| `text` | `string \| null` | 原始输入文本 |
| `extractions` | `array[Extraction] \| null` | 抽取的实体列表 |

---

### 3.2 Extraction 结构

文件路径：`langextract/core/data.py`

```python
@dataclasses.dataclass(init=False)
class Extraction:
    extraction_class: str                                      # 实体类型
    extraction_text: str                                       # 实体文本
    char_interval: CharInterval | None = None                  # 字符位置锚点
    alignment_status: AlignmentStatus | None = None            # 对齐状态
    extraction_index: int | None = None                        # 抽取顺序索引
    group_index: int | None = None                             # 分组索引
    description: str | None = None                             # 实体描述
    attributes: dict[str, str | list[str]] | None = None       # 附加属性
    token_interval: TokenInterval | None = None                # Token 位置锚点
```

**字段详细说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `extraction_class` | `str` | 是 | 实体类型/分类名称（如 `PERSON`, `ORGANIZATION`） |
| `extraction_text` | `str` | 是 | 抽取的文本内容（应为原文的子串） |
| `char_interval` | `CharInterval \| null` | 否 | 在原文中的字符偏移位置 |
| `alignment_status` | `string \| null` | 否 | 文本对齐质量（见 [3.4 节](#34-alignmentstatus-对齐状态枚举)） |
| `extraction_index` | `int \| null` | 否 | 在结果列表中的顺序位置 |
| `group_index` | `int \| null` | 否 | 分组归属（用于关联抽取） |
| `description` | `string \| null` | 否 | 对该实体的补充描述 |
| `attributes` | `dict \| null` | 否 | 键值对形式的附加属性 |
| `token_interval` | `TokenInterval \| null` | 否 | 在原文中的 token 偏移位置 |

---

### 3.3 CharInterval 字符锚点

文件路径：`langextract/core/data.py`

```python
@dataclasses.dataclass
class CharInterval:
    start_pos: int | None = None    # 起始位置（包含），0-indexed
    end_pos: int | None = None      # 结束位置（不包含）
```

**语义：** `source_text[start_pos:end_pos]` 即为抽取的文本在原文中的精确位置。

---

### 3.4 AlignmentStatus 对齐状态枚举

文件路径：`langextract/core/data.py`

```python
class AlignmentStatus(enum.Enum):
    MATCH_EXACT   = "match_exact"
    MATCH_GREATER = "match_greater"
    MATCH_LESSER  = "match_lesser"
    MATCH_FUZZY   = "match_fuzzy"
```

| 状态值 | 序列化值 | 含义 | 可信度 |
|--------|---------|------|--------|
| `MATCH_EXACT` | `"match_exact"` | LLM 输出与原文 token 序列完全匹配 | 最高 |
| `MATCH_GREATER` | `"match_greater"` | LLM 输出的 token 序列短于匹配到的原文（找到最佳重叠） | 高 |
| `MATCH_LESSER` | `"match_lesser"` | LLM 输出长于匹配到的原文（部分精确匹配） | 中 |
| `MATCH_FUZZY` | `"match_fuzzy"` | 模糊匹配，重叠率达到阈值（默认 ≥0.75） | 低 |
| `None` | `null` | 未找到任何对齐 | 不可信 |

**对齐流程：**

```
1. 尝试精确 token 级别匹配（difflib）
   ├── 成功且长度相等 → MATCH_EXACT
   ├── 成功但 LLM 输出更长 → MATCH_LESSER
   └── 成功但匹配区域更大 → MATCH_GREATER
2. 精确匹配失败且 enable_fuzzy_alignment=True
   ├── 最佳重叠窗口 ≥ fuzzy_alignment_threshold → MATCH_FUZZY
   └── 低于阈值 → None
3. 精确匹配失败且 enable_fuzzy_alignment=False → None
```

---

### 3.5 Resolver 对齐参数

文件路径：`langextract/resolver.py`

通过 `extract()` 的 `resolver_params` 字典传入：

```python
result = lx.extract(
    ...,
    resolver_params={
        "enable_fuzzy_alignment": True,       # 是否启用模糊对齐（默认 True）
        "fuzzy_alignment_threshold": 0.75,    # 模糊匹配最低重叠率（默认 0.75）
        "accept_match_lesser": True,          # 是否接受 MATCH_LESSER（默认 True）
        "suppress_parse_errors": False,       # 是否忽略 JSON 解析错误（默认 False）
    },
)
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enable_fuzzy_alignment` | `bool` | `True` | 精确匹配失败后是否尝试模糊匹配 |
| `fuzzy_alignment_threshold` | `float` | `0.75` | 模糊匹配的最低 token 重叠比率（0.0~1.0） |
| `accept_match_lesser` | `bool` | `True` | 是否接受部分精确匹配结果 |
| `suppress_parse_errors` | `bool` | `False` | JSON 解析失败时是否继续而非报错 |

---

### 3.6 JSONL 输出文件格式

文件路径：`langextract/io.py`

```python
def save_annotated_documents(
    annotated_documents: Iterator[AnnotatedDocument],
    output_dir: pathlib.Path | str | None = None,
    output_name: str = 'data.jsonl',
    show_progress: bool = True,
) -> None
```

**输出规范：**
- 文件格式：**JSONL**（JSON Lines），每行一个完整的 JSON 对象
- 默认文件名：`data.jsonl`
- 序列化规则：
  - Enum 值转为字符串（如 `AlignmentStatus.MATCH_EXACT` → `"match_exact"`）
  - NumPy / integral 数值类型转为 `int`
  - 以 `_` 开头的私有字段被排除

---

### 3.7 完整输出 JSON Schema 示例

单条 JSONL 记录的完整结构：

```json
{
  "document_id": "doc_a1b2c3d4",
  "text": "GraphRAG is a technique developed by Microsoft Research that combines knowledge graphs with retrieval-augmented generation.",
  "extractions": [
    {
      "extraction_class": "TECHNOLOGY",
      "extraction_text": "GraphRAG",
      "char_interval": {
        "start_pos": 0,
        "end_pos": 8
      },
      "alignment_status": "match_exact",
      "extraction_index": 0,
      "group_index": null,
      "description": "A technique combining knowledge graphs with RAG",
      "attributes": {
        "category": "AI/ML",
        "developer": "Microsoft Research"
      },
      "token_interval": {
        "start_index": 0,
        "end_index": 1
      }
    },
    {
      "extraction_class": "ORGANIZATION",
      "extraction_text": "Microsoft Research",
      "char_interval": {
        "start_pos": 46,
        "end_pos": 64
      },
      "alignment_status": "match_exact",
      "extraction_index": 1,
      "group_index": null,
      "description": null,
      "attributes": null,
      "token_interval": {
        "start_index": 7,
        "end_index": 9
      }
    }
  ]
}
```

---

### 3.8 HTML 可视化输出

文件路径：`langextract/visualization.py`

```python
def visualize(doc: AnnotatedDocument) -> HTML
```

**功能特性：**
- 按 `extraction_class` 进行颜色编码高亮（10 色调色板）
- 交互式 tooltip 显示实体类型和属性
- 动画导航控件，支持多实体浏览
- 进度滑块
- 响应式 HTML/CSS/JavaScript 嵌入
- 支持 Jupyter / IPython 环境直接渲染

---

## 附录：环境变量与常量速查

### 环境变量

| 变量名 | 适用 Provider | 说明 |
|--------|--------------|------|
| `LANGEXTRACT_API_KEY` | 所有 | 通用 API Key 后备 |
| `GEMINI_API_KEY` | Gemini | Gemini API Key |
| `OPENAI_API_KEY` | OpenAI | OpenAI API Key |
| `OLLAMA_BASE_URL` | Ollama | Ollama 服务地址（默认 `http://localhost:11434`） |

### FormatType 枚举

```python
class FormatType(enum.Enum):
    YAML = 'yaml'
    JSON = 'json'
```

### 结构化输出支持

| Provider | Schema 类型 | 结构化输出模式 |
|----------|------------|---------------|
| Gemini | `GeminiSchema` | 严格结构化输出 |
| OpenAI | JSON Mode | 通过 `response_format` 约束 |
| Ollama | `FormatModeSchema` | JSON 模式（非严格） |

### Fence Output 逻辑

| Provider | 默认值 | 说明 |
|----------|--------|------|
| Gemini | `False` | 有 Schema 时不需要 fence |
| OpenAI | `False` | JSON Mode 返回原始 JSON |
| Ollama | `False` | 返回原始 JSON |
