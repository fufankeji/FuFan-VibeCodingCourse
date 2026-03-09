# MinerU 文档解析规范文档 v1.0

> 基于 [opendatalab/MinerU](https://github.com/opendatalab/MinerU) 官方 API 文档 + 本地 MVP 实测验证
> 实测后端版本：`pipeline` / `_version_name: 2.6.4`
> 更新日期：2026-03-04

---

## 目录

- [一、Pipeline 执行流程与测试脚本](#一pipeline-执行流程与测试脚本)
  - [1.1 虚拟环境配置（环境隔离）](#11-虚拟环境配置环境隔离)
  - [1.2 完整执行流程（本地文件 → 云端解析 → 本地存储）](#12-完整执行流程本地文件--云端解析--本地存储)
  - [1.3 测试脚本存放位置](#13-测试脚本存放位置)
  - [1.4 Pipeline 各步骤详解](#14-pipeline-各步骤详解)
- [二、输入格式规范](#二输入格式规范)
  - [2.1 支持的文件格式](#21-支持的文件格式)
  - [2.2 输入限制](#22-输入限制)
  - [2.3 OCR 语言支持](#23-ocr-语言支持)
- [三、输出格式规范（实测验证）](#三输出格式规范实测验证)
  - [3.1 实际输出文件清单（实测 vs 官方文档对比）](#31-实际输出文件清单实测-vs-官方文档对比)
  - [3.2 content_list.json 字段规范（实测验证）](#32-content_listjson-字段规范实测验证)
  - [3.3 layout.json 字段规范（实测验证）](#33-layoutjson-字段规范实测验证)
  - [3.4 full.md Markdown 输出规范（实测验证）](#34-fullmd-markdown-输出规范实测验证)
- [四、布局信息规范](#四布局信息规范)
  - [4.1 坐标系定义（实测验证）](#41-坐标系定义实测验证)
  - [4.2 布局分类体系](#42-布局分类体系)
  - [4.3 内容层级与标题级别](#43-内容层级与标题级别)
  - [4.4 布局精度提取指南](#44-布局精度提取指南)
- [五、云端 API 关键参数规范](#五云端-api-关键参数规范)
  - [5.1 认证配置](#51-认证配置)
  - [5.2 本地文件上传流程 — file-urls/batch](#52-本地文件上传流程--file-urlsbatch)
  - [5.3 URL 直传解析 — extract/task](#53-url-直传解析--extracttask)
  - [5.4 批量 URL 解析 — extract/task/batch](#54-批量-url-解析--extracttaskbatch)
  - [5.5 查询结果接口](#55-查询结果接口)
  - [5.6 通用响应包装结构](#56-通用响应包装结构)
  - [5.7 任务状态枚举（实测验证）](#57-任务状态枚举实测验证)
  - [5.8 错误码速查](#58-错误码速查)

---

## 一、Pipeline 执行流程与测试脚本

### 1.1 虚拟环境配置（环境隔离）

MinerU MVP 组件使用 **独立的 Python 虚拟环境**，与项目其他组件（LangExtract、GraphRAG Pipeline 等）完全隔离，避免依赖污染。

| 项目 | 值 |
|------|-----|
| 虚拟环境路径 | `F:\GraphRAGAgent\mineru_mvp\.venv\` |
| Python 版本 | 3.12 |
| 创建工具 | uv |
| Python 解释器 | `F:/GraphRAGAgent/mineru_mvp/.venv/Scripts/python.exe` |

**启动 Pipeline 前必须切换到子虚拟环境：**

```bash
# 方式一：直接指定解释器路径（推荐，无需手动激活）
F:/GraphRAGAgent/mineru_mvp/.venv/Scripts/python.exe pipeline.py

# 方式二：先激活环境再运行
cd F:/GraphRAGAgent/mineru_mvp
source .venv/Scripts/activate
python pipeline.py
```

**安装新依赖：**

```bash
uv pip install <package> --python F:/GraphRAGAgent/mineru_mvp/.venv/Scripts/python.exe
```

**已安装依赖清单：**

| 包 | 用途 |
|----|------|
| `requests` | HTTP 客户端（API 调用、文件上传下载） |
| `python-dotenv` | `.env` 配置文件加载 |
| `reportlab` | 测试 PDF 生成 |

---

### 1.2 完整执行流程（本地文件 → 云端解析 → 本地存储）

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 0: 激活虚拟环境                                            │
│  source .venv/Scripts/activate  或  直接使用 .venv 内 python      │
├─────────────────────────────────────────────────────────────────┤
│  Step 1: 获取预签名上传 URL                                      │
│  POST /file-urls/batch  →  返回 batch_id + file_urls[]          │
├─────────────────────────────────────────────────────────────────┤
│  Step 2: 上传本地文件                                            │
│  PUT {file_urls[0]}  ←  本地文件二进制流（不带 Content-Type）      │
├─────────────────────────────────────────────────────────────────┤
│  Step 3: 轮询解析结果                                            │
│  GET /extract-results/batch/{batch_id}                          │
│  状态流转: waiting-file → pending → running → done/failed        │
├─────────────────────────────────────────────────────────────────┤
│  Step 4: 下载解析结果 ZIP                                        │
│  GET {full_zip_url}  →  解压到本地 output/ 目录                   │
├─────────────────────────────────────────────────────────────────┤
│  Step 5: 分析解析产物                                            │
│  读取 *content_list.json  →  统计块类型、页数、生成 summary        │
└─────────────────────────────────────────────────────────────────┘
```

> **关键发现（实测）：** 上传文件时 **不能** 携带 `Content-Type` 请求头，否则 OSS 预签名 URL 校验失败返回 403 `SignatureDoesNotMatch`。必须使用裸 `PUT` 请求。

### 1.3 测试脚本存放位置

```
F:\GraphRAGAgent\mineru_mvp\
├── .env                        # API Token 配置
├── .venv/                      # 独立虚拟环境（Python 3.12, uv 创建）
├── CLAUDE.md                   # Claude Code 组件规范
├── create_test_pdf.py          # 测试 PDF 生成脚本（reportlab）
├── pipeline.py                 # 完整 Pipeline 脚本（5 步）
├── test_sample.pdf             # 生成的测试 PDF（1 页，含标题/段落/表格）
└── output/
    └── test_sample/            # 解析输出结果
        ├── full.md
        ├── {uuid}_content_list.json
        ├── layout.json
        ├── {uuid}_origin.pdf
        └── images/
            └── {hash}.jpg
```

### 1.4 Pipeline 各步骤详解

#### Step 1 — 获取预签名上传 URL

```python
resp = requests.post(
    f"{API_BASE}/file-urls/batch",
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    json={
        "files": [{"name": "test_sample.pdf", "data_id": "mvp_test"}],
        "enable_formula": True,
        "enable_table": True,
        "language": "en",
    },
)
batch_id = resp.json()["data"]["batch_id"]
upload_url = resp.json()["data"]["file_urls"][0]
```

#### Step 2 — 上传文件（裸 PUT，不带 Content-Type）

```python
with open("test_sample.pdf", "rb") as f:
    requests.put(upload_url, data=f)  # 不传 headers
```

#### Step 3 — 轮询结果

```python
while True:
    result = requests.get(
        f"{API_BASE}/extract-results/batch/{batch_id}",
        headers=headers,
    ).json()
    state = result["data"]["extract_result"][0]["state"]
    if state == "done":
        zip_url = result["data"]["extract_result"][0]["full_zip_url"]
        break
    time.sleep(5)
```

#### Step 4 — 下载解压

```python
zip_data = requests.get(zip_url).content
with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
    zf.extractall("output/test_sample/")
```

#### Step 5 — 分析产物

```python
content_list = json.load(open("output/test_sample/*content_list.json"))
# 按 type 分类统计、按 page_idx 分组、提取标题层级等
```

---

## 二、输入格式规范

### 2.1 支持的文件格式

| 格式 | 扩展名 | 说明 |
|------|--------|------|
| **PDF** | `.pdf` | 核心能力 — 文本型 / 扫描型 / 混合型均支持 |
| **Word** | `.doc`, `.docx` | 旧版和新版 Word 文档 |
| **PowerPoint** | `.ppt`, `.pptx` | 旧版和新版演示文稿 |
| **图片** | `.png`, `.jpg`, `.jpeg` | 单页图片文档，支持 EXIF 方向自动校正 |
| **HTML** | `.html` | 须指定 `model_version: "MinerU-HTML"` |

### 2.2 输入限制

| 约束项 | 限制值 |
|--------|--------|
| 单文件最大体积 | **200 MB** |
| 单文件最大页数 | **600 页** |
| 批量请求最大文件数 | **200 个** |
| 预签名上传 URL 有效期 | **24 小时** |
| 云端 API 每日最高优先级额度 | **2,000 页**，超出部分降低优先级 |

### 2.3 OCR 语言支持

MinerU 内置 OCR 引擎支持 **109 种语言**（基于 PaddleOCR v3），可通过 `language` 参数指定文档主语言。

> **注意（官方文档）：** `language` 的默认值为 `"ch"`（非 `"zh"`），遵循 PaddleOCR 语言代码规范。

| 代码 | 语言 | 代码 | 语言 |
|------|------|------|------|
| `ch` | 中文 | `en` | 英文 |
| `japan` | 日文 | `korean` | 韩文 |
| `french` | 法文 | `german` | 德文 |

---

## 三、输出格式规范（实测验证）

### 3.1 实际输出文件清单（实测 vs 官方文档对比）

**实测输出（ZIP 解压后，共 5 个文件）：**

```
output/test_sample/
├── full.md                                           # Markdown 输出（单文件）
├── {uuid}_content_list.json                          # 扁平化内容块列表
├── layout.json                                       # 富元数据中间格式
├── {uuid}_origin.pdf                                 # 原始 PDF 副本
└── images/
    └── {sha256_hash}.jpg                             # 表格/图片截图
```

**与官方文档差异对比：**

| 项目 | 官方文档描述 | 实测结果 | 差异说明 |
|------|-------------|---------|---------|
| Markdown 文件 | `auto/auto.md` + `auto_nlp/auto_nlp.md`（两个子目录） | **`full.md`**（单文件，根目录） | 云端 API 输出为合并的 `full.md`，无子目录拆分 |
| 中间格式 | `middle.json` | **`layout.json`** | 文件名不同，结构一致 |
| content_list | `content_list.json` | **`{uuid}_content_list.json`** | 文件名带 UUID 前缀 |
| 原始文件副本 | 未提及 | **`{uuid}_origin.pdf`** | 云端 API 额外返回原始文件副本 |
| 调试文件 | `layout.pdf` + `span.pdf` + `model.json` | **无** | 云端 API 不返回调试 PDF 和 model.json |
| 图片命名 | `img_0_0.png` / `table_0_1.png` | **`{sha256}.jpg`** | 使用内容哈希命名，格式为 JPG |

> **重要结论：** 以实测为准。对接下游系统时，文件匹配应使用 glob 模式（如 `*content_list.json`）而非固定文件名。

### 3.2 content_list.json 字段规范（实测验证）

文件为 **JSON 数组**，每个元素是一个内容块，按文档阅读顺序排列。

#### 3.2.1 公共字段

| 字段 | 类型 | 说明 | 实测验证 |
|------|------|------|---------|
| `type` | `string` | 内容类型 | 实测出现：`text`, `table` |
| `page_idx` | `int` | 所在页码（0-indexed） | 实测值：`0` |
| `bbox` | `[int, int, int, int]` | 边界框 `[x0, y0, x1, y1]` | 实测范围：`0–1000`（归一化） |

#### 3.2.2 文本块（type: "text"）

**实测完整结构：**

```json
{
  "type": "text",
  "text": "GraphRAG: Knowledge Graph Enhanced RAG System ",
  "text_level": 1,
  "bbox": [141, 93, 860, 151],
  "page_idx": 0
}
```

| 字段 | 类型 | 必现 | 说明 |
|------|------|------|------|
| `text` | `string` | 是 | 文本内容（末尾可能有空格） |
| `text_level` | `int \| 缺失` | 否 | 标题级别：`1`=一级标题；**正文时该字段缺失而非为 `0` 或 `null`** |

> **实测发现：** 正文段落中 `text_level` 字段 **完全不存在**（不是 `null` 或 `0`），仅标题块才携带该字段。判断标题应使用 `block.get("text_level")` 而非 `block["text_level"] >= 1`。

#### 3.2.3 表格块（type: "table"）

**实测完整结构：**

```json
{
  "type": "table",
  "img_path": "images/e382eaafdf341d361c2567b20d9ce56456c17a7dd10ae5dadbcc3961256169c9.jpg",
  "table_caption": [],
  "table_footnote": [],
  "table_body": "<table><tr><td rowspan=1 colspan=2>Method  Comprehensiveness</td>...</table>",
  "bbox": [115, 563, 882, 708],
  "page_idx": 0
}
```

| 字段 | 类型 | 必现 | 说明 |
|------|------|------|------|
| `img_path` | `string` | 是 | 表格截图路径（`images/{sha256}.jpg`） |
| `table_body` | `string` | 是 | HTML 表格（`<table>` 标签，无 `<html>/<body>` 外层包裹） |
| `table_caption` | `string[]` | 是 | 表格标题（可为空数组 `[]`） |
| `table_footnote` | `string[]` | 是 | 表格脚注（可为空数组 `[]`） |

> **实测发现：** `table_body` 的 HTML 直接以 `<table>` 开头，**不含** `<html><body>` 外层包裹（官方文档示例中有外层包裹，以实测为准）。

#### 3.2.4 图片块（type: "image"）— 官方文档

本次测试 PDF 不含独立图片，以下为官方文档规范（待后续实测验证）：

```json
{
  "type": "image",
  "img_path": "images/{hash}.jpg",
  "image_caption": ["Figure 1: ..."],
  "image_footnote": [],
  "bbox": [x0, y0, x1, y1],
  "page_idx": 0
}
```

#### 3.2.5 公式块（type: "equation"）— 官方文档

```json
{
  "type": "equation",
  "text": "E = mc^2",
  "text_format": "latex",
  "img_path": "images/{hash}.jpg",
  "bbox": [x0, y0, x1, y1],
  "page_idx": 0
}
```

> **实测发现：** 测试 PDF 结论段的百分数被解析为 LaTeX 内联公式（`$7 2 . 0 \%$`），嵌入在 `text` 类型块中，而非独立的 `equation` 块。这说明 Pipeline 后端会将简单公式内联到文本块中。

---

### 3.3 layout.json 字段规范（实测验证）

`layout.json` 对应官方文档中的 `middle.json`，是富元数据中间格式。

#### 3.3.1 顶层结构（实测）

```json
{
  "_backend": "pipeline",
  "_version_name": "2.6.4",
  "pdf_info": [ ... ]
}
```

| 字段 | 类型 | 实测值 | 说明 |
|------|------|--------|------|
| `_backend` | `string` | `"pipeline"` | 使用的解析后端 |
| `_version_name` | `string` | `"2.6.4"` | MinerU 版本标识 |
| `pdf_info` | `array` | 含 1 个元素 | 按页组织的解析结果 |

#### 3.3.2 页级结构（实测）

```json
{
  "page_idx": 0,
  "page_size": [595, 841],
  "preproc_blocks": [ ... ],
  "para_blocks": [ ... ],
  "discarded_blocks": []
}
```

| 字段 | 类型 | 实测值 | 说明 |
|------|------|--------|------|
| `page_idx` | `int` | `0` | 页码（0-indexed） |
| `page_size` | `[int, int]` | `[595, 841]` | 页面尺寸 `[宽, 高]`（PDF pt 单位，A4≈595×841） |
| `preproc_blocks` | `array` | 10 个块 | 预处理阶段的内容块 |
| `para_blocks` | `array` | 10 个块 | 段落分段后的内容块 |
| `discarded_blocks` | `array` | `[]` | 被过滤的内容（页眉/页脚等） |

> **与官方文档差异：** 实测页级结构 **仅包含 3 个数组**（`preproc_blocks`、`para_blocks`、`discarded_blocks`），**不含** 官方文档提到的 `images`、`tables`、`interline_equations` 独立数组。表格和图片直接嵌入在 `preproc_blocks` / `para_blocks` 中。

#### 3.3.3 内容块层级结构（Block → Line → Span，实测验证）

**文本/标题块（实测）：**

```json
{
  "type": "title",
  "bbox": [84, 79, 512, 127],
  "lines": [
    {
      "bbox": [80, 77, 515, 106],
      "spans": [
        {
          "bbox": [80, 77, 515, 106],
          "score": 1.0,
          "content": "GraphRAG: Knowledge Graph Enhanced",
          "type": "text"
        }
      ],
      "index": 0
    }
  ],
  "index": 0.5
}
```

**Block 字段（实测）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | `string` | 块类型：实测出现 `title`, `text`, `table` |
| `bbox` | `[int, int, int, int]` | 边界框（原始 PDF pt 坐标） |
| `lines` | `array` | 行数组（文本/标题块） |
| `blocks` | `array` | 子块数组（仅 `table` 类型容器块） |
| `index` | `int \| float` | 排序索引（可为小数，如 `0.5`） |

**Line 字段（实测）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `bbox` | `[int, int, int, int]` | 行边界框 |
| `spans` | `array` | Span 数组 |
| `index` | `int` | 行内排序索引 |

**Span 字段（实测）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `bbox` | `[int, int, int, int]` | Span 边界框 |
| `type` | `string` | 实测出现：`text`, `table` |
| `content` | `string` | 文本内容（`type=text` 时） |
| `score` | `float` | 置信度（实测多为 `1.0`） |

**表格容器块（实测）：**

```json
{
  "type": "table",
  "bbox": [69, 474, 525, 596],
  "blocks": [
    {
      "type": "table_body",
      "bbox": [69, 474, 525, 596],
      "group_id": 0,
      "lines": [ ... ],
      "index": 0,
      "virtual_lines": [ ... ]
    }
  ],
  "index": 7
}
```

表格容器块内的子块额外包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `group_id` | `int` | 分组 ID |
| `virtual_lines` | `array` | 虚拟行结构（表格布局专用） |

**`para_blocks` 额外字段（实测）：**

部分 `para_blocks` 中的文本块额外包含 `bbox_fs` 字段（疑似字体大小相关的边界框），如：

```json
{
  "type": "text",
  "bbox": [77, 198, 518, 259],
  "lines": [...],
  "index": 2,
  "bbox_fs": [77, 198, 518, 259]
}
```

---

### 3.4 full.md Markdown 输出规范（实测验证）

**实测产物：** 单个 `full.md` 文件（非官方文档描述的 `auto/auto.md` + `auto_nlp/auto_nlp.md` 双目录结构）。

**实测特征：**

| 特征 | 实测行为 |
|------|---------|
| 标题 | 使用 `# ` 前缀，所有标题均为一级（`# `） |
| 段落 | 纯文本，段落间以空行分隔 |
| 表格 | 直接嵌入 HTML `<table>` 标签 |
| 公式 | 内联使用 `$...$` 定界符（如 `$7 2 . 0 \%$`） |
| 图片引用 | 本次未出现独立图片引用 |

**实测输出示例（节选）：**

```markdown
# GraphRAG: Knowledge Graph Enhanced RAG System

# 1. Introduction

GraphRAG is an advanced retrieval-augmented generation technique developed by...

# 3. Performance Comparison

The following table compares GraphRAG with traditional RAG approaches...

<table><tr><td rowspan=1 colspan=2>Method  Comprehensiveness</td>...</table>

# 4. Conclusion

...comprehensiveness $7 2 . 0 \%$ vs $3 2 . 4 \%$...
```

---

## 四、布局信息规范

### 4.1 坐标系定义（实测验证）

| 坐标系 | 适用文件 | 实测范围 | 原点 | 说明 |
|--------|---------|---------|------|------|
| **归一化整数坐标** | `*content_list.json` | `0 – 1000` | 左上角 | 页面宽高均映射到 0~1000 |
| **原始 PDF 坐标** | `layout.json` | 实测 `[595, 841]`（A4 pt） | 左上角 | 与 PDF 页面尺寸一致 |

**bbox 格式统一为 `[x0, y0, x1, y1]`：**

```
(x0, y0) ─────────────────── (x1, y0)
    │                            │
    │       内容区域              │
    │                            │
(x0, y1) ─────────────────── (x1, y1)
```

**实测对照（标题块 "1. Introduction"）：**

| 文件 | bbox | 坐标系 |
|------|------|--------|
| `content_list.json` | `[131, 200, 317, 222]` | 归一化 0-1000 |
| `layout.json` | `[78, 169, 189, 187]` | PDF pt（页面 595×841） |

### 4.2 布局分类体系

#### Pipeline 后端（实测 + 官方文档合并）

**layout.json 中的 `type` 值（实测出现标记 ✅）：**

| type 值 | 说明 | 实测出现 |
|---------|------|---------|
| `title` | 标题 | ✅ |
| `text` | 正文段落 | ✅ |
| `table` | 表格容器 | ✅ |
| `table_body` | 表格主体（子块） | ✅ |
| `table_caption` | 表格标题 | — |
| `table_footnote` | 表格脚注 | — |
| `image_body` | 图片主体 | — |
| `image_caption` | 图片标题 | — |
| `image_footnote` | 图片脚注 | — |
| `interline_equation` | 行间公式 | — |
| `index` | 目录项 | — |
| `list` | 列表项 | — |

#### VLM 后端（官方文档，未实测）

VLM 后端额外支持：`code`, `code_caption`, `list`, `header`, `footer`, `page_number`, `aside_text`, `page_footnote`, `ref_text`, `algorithm`, `phonetic`。

### 4.3 内容层级与标题级别

`content_list.json` 中 `text_level` 字段标识文档结构层级：

| text_level | 含义 | Markdown | 实测验证 |
|------------|------|----------|---------|
| **字段缺失** | 正文 | 无标记 | ✅ 实测正文块不含 `text_level` 字段 |
| `1` | 一级标题 | `# Heading` | ✅ 实测验证 |
| `2` | 二级标题 | `## Heading` | — |
| `3` | 三级标题 | `### Heading` | — |
| `4+` | 更深层标题 | `####+ Heading` | — |

> **重要纠正：** 官方文档描述正文为 `text_level: null` 或 `0`，但实测正文块中 **该字段完全不存在**。正确判断方式：

```python
# 正确写法
is_heading = block.get("text_level") is not None

# 错误写法（会 KeyError）
is_heading = block["text_level"] >= 1
```

### 4.4 布局精度提取指南

#### 提取文档大纲

```python
headings = [
    {"level": b["text_level"], "text": b["text"].strip(), "page": b["page_idx"]}
    for b in content_list
    if b["type"] == "text" and b.get("text_level") is not None
]
```

#### 提取正文段落

```python
paragraphs = [
    b["text"].strip()
    for b in content_list
    if b["type"] == "text" and b.get("text_level") is None
]
```

#### 解析表格数值

```python
from bs4 import BeautifulSoup

for b in content_list:
    if b["type"] != "table":
        continue
    soup = BeautifulSoup(b["table_body"], "html.parser")
    rows = []
    for tr in soup.find_all("tr"):
        cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
        rows.append(cells)
    # rows 即为二维表格数据
```

#### 按页面位置过滤

```python
def is_upper_half(block):
    """判断内容块是否在页面上半部分（归一化坐标 0-1000）"""
    y_center = (block["bbox"][1] + block["bbox"][3]) / 2
    return y_center < 500
```

---

## 五、云端 API 关键参数规范

### 5.1 认证配置

| 项目 | 值 |
|------|-----|
| 请求头 | `Authorization: Bearer {token}` |
| Token 获取 | [mineru.net/apiManage/token](https://mineru.net/apiManage/token) |
| .env 配置 | `MINERU_API_TOKEN=xxx` |

所有接口均需携带 `Authorization` 头，`Content-Type: application/json`（上传文件 PUT 请求除外）。

---

### 5.2 本地文件上传流程 — file-urls/batch

**用途：** 本地文件场景 — 获取预签名 URL → PUT 上传 → 自动触发解析

**接口：** `POST https://mineru.net/api/v4/file-urls/batch`

#### 请求体

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `files` | `array[object]` | **是** | — | 文件列表（最多 200 个） |
| `files[].name` | `string` | **是** | — | 文件名（须含正确扩展名） |
| `files[].data_id` | `string` | 否 | — | 业务标识（最长 128 字符，支持字母数字 `_` `-` `.`） |
| `files[].is_ocr` | `bool` | 否 | `false` | 是否强制 OCR |
| `files[].page_ranges` | `string` | 否 | — | 页码范围（如 `"2,4-6"` 或 `"2--2"` 表示到倒数第二页） |
| `model_version` | `string` | 否 | `"pipeline"` | 模型版本：`pipeline` / `vlm` / `MinerU-HTML` |
| `enable_formula` | `bool` | 否 | `true` | 是否启用公式识别 |
| `enable_table` | `bool` | 否 | `true` | 是否启用表格识别 |
| `language` | `string` | 否 | `"ch"` | OCR 语言（PaddleOCR v3 语言代码） |
| `callback` | `string` | 否 | — | 回调通知 URL（HTTP/HTTPS POST） |
| `seed` | `string` | 否 | — | 回调签名种子（与 callback 配合，最长 64 字符） |
| `extra_formats` | `string[]` | 否 | — | 额外输出格式：`"docx"`, `"html"`, `"latex"` |

#### 响应体（实测验证）

```json
{
  "code": 0,
  "msg": "ok",
  "trace_id": "9ef836ce2a65f46c5f54389e55a14039",
  "data": {
    "batch_id": "6ce0e838-b324-4f1d-8b06-01ddc07e4cd4",
    "file_urls": [
      "https://mineru.oss-cn-shanghai.aliyuncs.com/api-upload/extract/2026-03-04/{batch_id}/{file_uuid}.pdf?Expires=...&OSSAccessKeyId=...&Signature=..."
    ]
  }
}
```

| 响应字段 | 类型 | 说明 |
|---------|------|------|
| `code` | `int` | `0` 表示成功 |
| `msg` | `string` | 状态信息 |
| `trace_id` | `string` | 请求追踪 ID |
| `data.batch_id` | `string` | 批次 ID（后续查询结果使用） |
| `data.file_urls` | `string[]` | 预签名上传 URL 列表（与 `files` 一一对应） |

#### 文件上传

```
PUT {file_urls[i]}
Body: 文件二进制流
```

> **不要传任何请求头**（包括 `Content-Type`），否则 OSS 签名校验失败。

---

### 5.3 URL 直传解析 — extract/task

**用途：** 文件已有公网 URL 时直接提交解析

**接口：** `POST https://mineru.net/api/v4/extract/task`

#### 请求体

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `url` | `string` | **是** | — | 文件公网 URL |
| `model_version` | `string` | 否 | `"pipeline"` | 模型版本 |
| `is_ocr` | `bool` | 否 | `false` | 是否强制 OCR |
| `enable_formula` | `bool` | 否 | `true` | 是否启用公式识别 |
| `enable_table` | `bool` | 否 | `true` | 是否启用表格识别 |
| `language` | `string` | 否 | `"ch"` | OCR 语言 |
| `data_id` | `string` | 否 | — | 业务标识 |
| `callback` | `string` | 否 | — | 回调 URL |
| `seed` | `string` | 否 | — | 回调种子 |
| `extra_formats` | `string[]` | 否 | — | 额外输出格式 |
| `page_ranges` | `string` | 否 | — | 页码范围 |
| `no_cache` | `bool` | 否 | `false` | 跳过 URL 缓存 |
| `cache_tolerance` | `int` | 否 | `900` | 缓存容忍时间（秒） |

#### 响应体

```json
{
  "code": 0,
  "msg": "ok",
  "trace_id": "string",
  "data": { "task_id": "string" }
}
```

#### 查询结果

`GET https://mineru.net/api/v4/extract/task/{task_id}`

```json
{
  "code": 0,
  "data": {
    "task_id": "string",
    "data_id": "string",
    "state": "done",
    "full_zip_url": "https://cdn-mineru.openxlab.org.cn/...",
    "err_msg": null,
    "extract_progress": {
      "extracted_pages": 1,
      "total_pages": 1,
      "start_time": "2026-03-04 12:00:00"
    }
  }
}
```

---

### 5.4 批量 URL 解析 — extract/task/batch

**接口：** `POST https://mineru.net/api/v4/extract/task/batch`

#### 请求体

```json
{
  "files": [
    {"url": "https://...", "data_id": "doc1", "is_ocr": false, "page_ranges": "1-5"}
  ],
  "model_version": "pipeline",
  "enable_formula": true,
  "enable_table": true,
  "language": "ch",
  "extra_formats": ["docx"],
  "no_cache": false,
  "cache_tolerance": 900
}
```

#### 响应体

```json
{
  "code": 0,
  "data": { "batch_id": "string" }
}
```

---

### 5.5 查询结果接口

#### 单任务查询

`GET https://mineru.net/api/v4/extract/task/{task_id}`

#### 批量查询（实测验证）

`GET https://mineru.net/api/v4/extract-results/batch/{batch_id}`

**响应体（实测验证）：**

```json
{
  "code": 0,
  "msg": "ok",
  "trace_id": "string",
  "data": {
    "batch_id": "3b1729e9-c833-44b4-b9c2-201164001ab0",
    "extract_result": [
      {
        "file_name": "test_sample.pdf",
        "state": "done",
        "full_zip_url": "https://cdn-mineru.openxlab.org.cn/pdf/2026-03-04/...",
        "err_msg": null,
        "data_id": "mvp_test",
        "extract_progress": {
          "extracted_pages": 1,
          "total_pages": 1,
          "start_time": "2026-03-04 ..."
        }
      }
    ]
  }
}
```

---

### 5.6 通用响应包装结构

所有 API 响应均遵循统一包装格式：

```json
{
  "code": 0,        // 0 = 成功，非 0 = 失败
  "msg": "ok",       // 状态描述
  "trace_id": "...", // 请求追踪 ID
  "data": { ... }    // 业务数据
}
```

---

### 5.7 任务状态枚举（实测验证）

| state | 说明 | 实测出现 |
|-------|------|---------|
| `waiting-file` | 等待文件上传完成 | ✅ |
| `pending` | 排队等待解析 | ✅ |
| `running` | 正在解析 | — |
| `converting` | 格式转换中 | — |
| `done` | 解析完成 | ✅ |
| `failed` | 解析失败 | — |

> **实测状态流转：** `waiting-file` → `pending` → `done`（小文件跳过 `running`）

---

### 5.8 错误码速查

| 错误码 | 含义 |
|--------|------|
| `A0202` | Token 无效 |
| `A0211` | Token 过期 |
| `-60005` | 文件超过 200MB |
| `-60006` | 页数超过 600 页 |
| `-60018` | 当日解析额度用尽 |
