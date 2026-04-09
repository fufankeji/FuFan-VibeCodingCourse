# MinerU 文档解析规范文档

> 基于 [opendatalab/MinerU](https://github.com/opendatalab/MinerU) 官方文档及云端 API 调研
> 版本基线：2026-03-04

---

## 目录

- [一、支持的原始输入文件格式](#一支持的原始输入文件格式)
  - [1.1 支持格式清单](#11-支持格式清单)
  - [1.2 输入限制](#12-输入限制)
  - [1.3 OCR 语言支持](#13-ocr-语言支持)
- [二、云端 API 输出格式规范](#二云端-api-输出格式规范)
  - [2.1 输出文件总览](#21-输出文件总览)
  - [2.2 content_list.json 字段规范](#22-content_listjson-字段规范)
  - [2.3 middle.json 字段规范](#23-middlejson-字段规范)
  - [2.4 Markdown 输出规范](#24-markdown-输出规范)
  - [2.5 调试与可视化文件](#25-调试与可视化文件)
- [三、布局信息规范](#三布局信息规范)
  - [3.1 坐标系定义](#31-坐标系定义)
  - [3.2 布局分类体系（Pipeline 后端）](#32-布局分类体系pipeline-后端)
  - [3.3 布局分类体系（VLM 后端）](#33-布局分类体系vlm-后端)
  - [3.4 内容层级与标题级别](#34-内容层级与标题级别)
  - [3.5 布局精度提取指南](#35-布局精度提取指南)
- [四、云端 API MVP 必要字段](#四云端-api-mvp-必要字段)
  - [4.1 认证配置](#41-认证配置)
  - [4.2 创建解析任务 — 请求规范](#42-创建解析任务--请求规范)
  - [4.3 查询任务结果 — 响应规范](#43-查询任务结果--响应规范)
  - [4.4 批量任务接口](#44-批量任务接口)
  - [4.5 MVP 最小可用请求示例](#45-mvp-最小可用请求示例)

---

## 一、支持的原始输入文件格式

### 1.1 支持格式清单

| 格式 | 扩展名 | 说明 |
|------|--------|------|
| **PDF** | `.pdf` | 核心能力 — 文本型 / 扫描型 / 混合型均支持 |
| **Word** | `.doc`, `.docx` | 旧版和新版 Word 文档 |
| **PowerPoint** | `.ppt`, `.pptx` | 旧版和新版演示文稿 |
| **图片** | `.png`, `.jpg`, `.jpeg` | 单页图片文档，支持 EXIF 方向自动校正 |
| **HTML** | `.html` | 需指定 `MinerU-HTML` 模型版本 |

### 1.2 输入限制

| 约束项 | 限制值 |
|--------|--------|
| 单文件最大体积 | **200 MB** |
| 单文件最大页数 | **600 页** |
| 云端 API 每日免费额度 | **2,000 页**（最高优先级），超出部分降低优先级 |

### 1.3 OCR 语言支持

MinerU 内置 OCR 引擎支持 **109 种语言**，可通过 `language` 参数指定文档主语言（默认 `zh` 中文）。常用语言代码：

| 代码 | 语言 | 代码 | 语言 |
|------|------|------|------|
| `zh` | 中文 | `en` | 英文 |
| `ja` | 日文 | `ko` | 韩文 |
| `fr` | 法文 | `de` | 德文 |

---

## 二、云端 API 输出格式规范

### 2.1 输出文件总览

云端 API 任务完成后，返回一个 ZIP 压缩包（通过 `full_zip_url` 获取），解压后包含以下文件：

```
output/
├── auto/
│   ├── auto.md                 # 多模态 Markdown（含图片引用）
│   └── images/                 # 提取的图片资源
│       ├── img_0_0.png
│       ├── table_0_1.png
│       └── ...
├── auto_nlp/
│   └── auto_nlp.md             # 纯文本 NLP Markdown（无图片）
├── middle.json                 # 富元数据中间格式（完整层级结构）
├── content_list.json           # 扁平化内容块列表（按阅读顺序）
├── layout.pdf                  # 布局分析可视化（调试用）
├── span.pdf                    # Span 级别标注（Pipeline 后端，调试用）
└── model.json                  # 原始模型推理结果（调试用）
```

| 文件 | 用途 | 推荐场景 |
|------|------|---------|
| `content_list.json` | 扁平化内容块，按阅读顺序 | **推荐用于下游 NLP/KG 管道对接** |
| `middle.json` | 完整层级结构，含丰富元数据 | 需要精确布局信息或二次开发 |
| `auto/auto.md` | 多模态 Markdown | 人工阅读、LLM 直接消费 |
| `auto_nlp/auto_nlp.md` | 纯文本 Markdown | 纯文本 NLP 处理 |
| `layout.pdf` | 布局可视化 | 调试、验证解析质量 |

---

### 2.2 content_list.json 字段规范

`content_list.json` 是一个 **JSON 数组**，每个元素是一个内容块，按文档阅读顺序排列。

#### 2.2.1 公共字段（所有类型共有）

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | `string` | 内容类型：`text` / `image` / `table` / `equation` / `code` / `list` |
| `page_idx` | `int` | 所在页码（**0-indexed**） |
| `bbox` | `[x0, y0, x1, y1]` | 边界框坐标，归一化到 **0–1000** 范围 |

#### 2.2.2 文本块（type: "text"）

```json
{
  "type": "text",
  "text": "段落正文内容...",
  "text_level": 0,
  "page_idx": 0,
  "bbox": [72, 120, 540, 145]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `text` | `string` | 文本内容 |
| `text_level` | `int \| null` | 标题级别：`null` 或 `0` = 正文，`1` = 一级标题，`2` = 二级标题，依此类推 |

#### 2.2.3 图片块（type: "image"）

```json
{
  "type": "image",
  "img_path": "images/img_0_0.png",
  "image_caption": ["Figure 1: System architecture"],
  "image_footnote": ["Source: internal report"],
  "page_idx": 1,
  "bbox": [100, 200, 500, 600]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `img_path` | `string` | 图片文件相对路径 |
| `image_caption` | `string[]` | 图片标题列表 |
| `image_footnote` | `string[]` | 图片脚注列表 |

#### 2.2.4 表格块（type: "table"）

```json
{
  "type": "table",
  "img_path": "images/table_0_1.png",
  "table_body": "<html><body><table><tr><td>...</td></tr></table></body></html>",
  "table_caption": ["Table 1: Performance comparison"],
  "table_footnote": ["* p < 0.05"],
  "page_idx": 2,
  "bbox": [50, 300, 950, 700]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `img_path` | `string` | 表格截图相对路径 |
| `table_body` | `string` | 表格 HTML 表示（`<table>` 标签） |
| `table_caption` | `string[]` | 表格标题列表 |
| `table_footnote` | `string[]` | 表格脚注列表 |

#### 2.2.5 公式块（type: "equation"）

```json
{
  "type": "equation",
  "text": "E = mc^2",
  "text_format": "latex",
  "img_path": "images/eq_0_0.png",
  "page_idx": 3,
  "bbox": [200, 400, 800, 450]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `text` | `string` | 公式的 LaTeX 表示 |
| `text_format` | `string` | 固定值 `"latex"` |
| `img_path` | `string` | 公式截图相对路径 |

#### 2.2.6 代码块（type: "code"）— VLM 后端

```json
{
  "type": "code",
  "sub_type": "code",
  "code_body": "def hello():\n    print('hello')",
  "code_caption": ["Listing 1: Example function"],
  "page_idx": 4,
  "bbox": [80, 100, 920, 300]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `sub_type` | `string` | `"code"` 或 `"algorithm"` |
| `code_body` | `string` | 代码文本内容 |
| `code_caption` | `string[]` | 代码块标题（可选） |

#### 2.2.7 列表块（type: "list"）— VLM 后端

```json
{
  "type": "list",
  "sub_type": "text",
  "list_items": ["第一项", "第二项", "第三项"],
  "page_idx": 5,
  "bbox": [72, 200, 540, 350]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `sub_type` | `string` | `"text"` 或 `"ref_text"`（参考文献列表） |
| `list_items` | `string[]` | 列表项内容 |

---

### 2.3 middle.json 字段规范

`middle.json` 是 MinerU 的富元数据中间格式，保留完整的文档层级结构。

#### 2.3.1 顶层结构

```json
{
  "_backend": "pipeline | vlm | hybrid",
  "_version_name": "2.7.4",
  "pdf_info": [ ... ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `_backend` | `string` | 使用的解析后端 |
| `_version_name` | `string` | MinerU 版本标识 |
| `pdf_info` | `array` | 按页组织的解析结果数组 |

#### 2.3.2 页级结构（pdf_info 数组元素）

```json
{
  "page_idx": 0,
  "page_size": [595.0, 842.0],
  "preproc_blocks": [ ... ],
  "para_blocks": [ ... ],
  "images": [ ... ],
  "tables": [ ... ],
  "interline_equations": [ ... ],
  "discarded_blocks": [ ... ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `page_idx` | `int` | 页码（0-indexed） |
| `page_size` | `[float, float]` | 页面尺寸 `[宽, 高]`（原始 PDF 坐标系，单位 pt） |
| `preproc_blocks` | `array` | 未分段的预处理块 |
| `para_blocks` | `array` | **已分段的内容块**（主输出） |
| `images` | `array` | 提取的图片块 |
| `tables` | `array` | 提取的表格块 |
| `interline_equations` | `array` | 行间公式块 |
| `discarded_blocks` | `array` | 被过滤的内容（页眉、页脚、页码等） |

#### 2.3.3 内容块层级结构

内容块采用三级层级：**Block → Line → Span**

**一级块（Level 1）— 容器块：**

```json
{
  "type": "table",
  "bbox": [x0, y0, x1, y1],
  "blocks": [ ... ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | `string` | `"table"` 或 `"image"` |
| `bbox` | `[x0, y0, x1, y1]` | 边界框坐标（原始 PDF 坐标系） |
| `blocks` | `array` | 包含的二级块 |

**二级块（Level 2）— 语义块：**

```json
{
  "type": "text",
  "bbox": [x0, y0, x1, y1],
  "lines": [ ... ]
}
```

| `type` 值 | 说明 |
|-----------|------|
| `text` | 正文段落 |
| `title` | 标题 |
| `image_body` | 图片主体 |
| `image_caption` | 图片标题 |
| `image_footnote` | 图片脚注 |
| `table_body` | 表格主体 |
| `table_caption` | 表格标题 |
| `table_footnote` | 表格脚注 |
| `interline_equation` | 行间公式 |
| `index` | 目录项 |
| `list` | 列表项 |

**行结构（Line）：**

```json
{
  "bbox": [x0, y0, x1, y1],
  "spans": [ ... ]
}
```

**Span 结构（最小粒度）：**

```json
{
  "bbox": [x0, y0, x1, y1],
  "type": "text",
  "content": "具体文本内容",
  "score": 0.95
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `bbox` | `[x0, y0, x1, y1]` | 边界框坐标 |
| `type` | `string` | `text` / `image` / `table` / `inline_equation` / `interline_equation` |
| `content` | `string` | 文本内容（text 类型）|
| `img_path` | `string` | 图片路径（image/table 类型）|
| `score` | `float` | 模型置信度（0.0~1.0） |

---

### 2.4 Markdown 输出规范

| 文件 | 特点 |
|------|------|
| `auto/auto.md` | 图片以 `![](images/img_x_x.png)` 引用；表格保留为 Markdown 表格或 HTML；公式使用 `$...$` 和 `$$...$$` 定界符 |
| `auto_nlp/auto_nlp.md` | 纯文本，图片/表格替换为占位文本描述；适合直接送入 NLP 管道 |

---

### 2.5 调试与可视化文件

| 文件 | 格式 | 说明 |
|------|------|------|
| `layout.pdf` | PDF | 每页叠加带编号的检测框，不同颜色区分内容类型，验证布局分析准确性和阅读顺序 |
| `span.pdf` | PDF | 用不同颜色线框标注页面内容的 span 类型（仅 Pipeline 后端），排查文本丢失和公式识别问题 |
| `model.json` | JSON | 原始模型推理结果，包含 `category_id`、`poly`（四边形坐标）、`score`（置信度） |

---

## 三、布局信息规范

### 3.1 坐标系定义

MinerU 使用两套坐标系，取决于输出文件：

| 坐标系 | 适用文件 | 范围 | 原点 | 说明 |
|--------|---------|------|------|------|
| **归一化坐标** | `content_list.json` | `0 – 1000` | 左上角 | 页面宽高均映射到 0~1000 |
| **原始 PDF 坐标** | `middle.json` | 实际 pt 值 | 左上角 | 与 PDF 页面尺寸一致（如 A4 = 595×842） |
| **归一化比例坐标** | `model.json`（VLM） | `0.0 – 1.0` | 左上角 | 宽高均映射到 0~1 |

**bbox 格式统一为：`[x0, y0, x1, y1]`**

```
(x0, y0) ─────────────────── (x1, y0)
    │                            │
    │       内容区域              │
    │                            │
(x0, y1) ─────────────────── (x1, y1)
```

- `x0, y0`：左上角坐标
- `x1, y1`：右下角坐标

### 3.2 布局分类体系（Pipeline 后端）

`model.json` 中的 `category_id` 枚举：

| category_id | 类型 | 说明 |
|-------------|------|------|
| 0 | `title` | 标题 |
| 1 | `plain_text` | 正文文本 |
| 2 | `abandon` | 丢弃区域（页眉/页脚/页码等） |
| 3 | `figure` | 图片 |
| 4 | `figure_caption` | 图片标题 |
| 5 | `table` | 表格 |
| 6 | `table_caption` | 表格标题 |
| 7 | `table_footnote` | 表格脚注 |
| 8 | `isolate_formula` | 独立行间公式 |
| 9 | `formula_caption` | 公式标题 |
| 13 | `embedding` | 嵌入内容 |
| 14 | `isolated` | 隔离内容 |
| 15 | `OCR_text` | OCR 识别文本 |

### 3.3 布局分类体系（VLM 后端）

VLM 后端使用字符串类型标识，分类更细：

| type 值 | 说明 |
|---------|------|
| `text` | 正文 |
| `title` | 标题 |
| `equation` | 公式 |
| `image` | 图片 |
| `image_caption` | 图片标题 |
| `image_footnote` | 图片脚注 |
| `table` | 表格 |
| `table_caption` | 表格标题 |
| `table_footnote` | 表格脚注 |
| `code` | 代码块 |
| `code_caption` | 代码标题 |
| `list` | 列表 |
| `header` | 页眉（discarded） |
| `footer` | 页脚（discarded） |
| `page_number` | 页码（discarded） |
| `aside_text` | 边栏文字（discarded） |
| `page_footnote` | 页面脚注（discarded） |
| `ref_text` | 参考文献 |
| `algorithm` | 算法伪代码 |
| `phonetic` | 注音 |

### 3.4 内容层级与标题级别

`content_list.json` 中的 `text_level` 字段标识文档结构层级：

| text_level | 含义 | 对应 Markdown |
|------------|------|--------------|
| `null` 或 `0` | 正文 | 无标记 |
| `1` | 一级标题 | `# Heading` |
| `2` | 二级标题 | `## Heading` |
| `3` | 三级标题 | `### Heading` |
| `4` | 四级标题 | `#### Heading` |
| `5+` | 更深层标题 | `#####+ Heading` |

### 3.5 布局精度提取指南

针对不同数据类型的精确提取建议：

#### 文本提取

```python
# 从 content_list.json 提取所有正文文本
texts = [
    block for block in content_list
    if block["type"] == "text"
]
# 按页过滤
page_0_texts = [b for b in texts if b["page_idx"] == 0]
```

#### 标题层级提取

```python
# 提取文档大纲结构
headings = [
    {"level": block["text_level"], "text": block["text"], "page": block["page_idx"]}
    for block in content_list
    if block["type"] == "text" and block.get("text_level") and block["text_level"] >= 1
]
```

#### 表格数值提取

```python
# 表格以 HTML 形式存储在 table_body 中，可用 BeautifulSoup 解析
from bs4 import BeautifulSoup

tables = [b for b in content_list if b["type"] == "table"]
for table in tables:
    soup = BeautifulSoup(table["table_body"], "html.parser")
    rows = []
    for tr in soup.find_all("tr"):
        cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
        rows.append(cells)
```

#### 空间位置定位

```python
# 利用 bbox 判断内容在页面中的位置
def get_position(bbox, threshold=500):
    """判断内容在页面的上半部分还是下半部分（归一化坐标 0-1000）"""
    y_center = (bbox[1] + bbox[3]) / 2
    return "upper" if y_center < threshold else "lower"

# 判断两个块是否水平相邻（同一行）
def is_same_row(block_a, block_b, tolerance=20):
    return abs(block_a["bbox"][1] - block_b["bbox"][1]) < tolerance
```

---

## 四、云端 API MVP 必要字段

### 4.1 认证配置

| 配置项 | 值 | 获取方式 |
|--------|-----|---------|
| Token | Bearer Token 字符串 | [mineru.net/apiManage/token](https://mineru.net/apiManage/token) 注册后获取 |

**请求头格式（所有接口通用）：**

```
Authorization: Bearer {your_token}
Content-Type: application/json
```

---

### 4.2 创建解析任务 — 请求规范

**接口：** `POST https://mineru.net/api/v4/extract/task`

#### 请求体字段

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `url` | `string` | **是** | — | 待解析文件的公网可访问 URL |
| `is_ocr` | `bool` | 否 | `false` | 是否强制启用 OCR（扫描件建议开启） |
| `enable_formula` | `bool` | 否 | `true` | 是否启用公式识别 |
| `enable_table` | `bool` | 否 | `true` | 是否启用表格识别 |
| `language` | `string` | 否 | `"zh"` | 文档主语言代码 |
| `model` | `string` | 否 | 自动选择 | 模型版本：`pipeline` / `vlm` / `MinerU-HTML` |
| `data_id` | `string` | 否 | — | 自定义业务标识（用于关联追踪） |
| `callback_url` | `string` | 否 | — | 任务完成后的回调通知 URL |

#### MVP 最小必填字段

```json
{
  "url": "https://example.com/document.pdf"
}
```

> 仅 `url` 为必填，其余参数均有合理默认值。

---

### 4.3 查询任务结果 — 响应规范

**接口：** `GET https://mineru.net/api/v4/extract/task/{task_id}`

#### 响应体字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `task_id` | `string` | 任务唯一标识 |
| `state` | `string` | 任务状态（见下方枚举） |
| `err_msg` | `string \| null` | 错误信息（失败时） |
| `full_zip_url` | `string \| null` | 完整输出 ZIP 下载地址（成功时） |
| `file_name` | `string` | 原始文件名 |
| `batch_id` | `string \| null` | 批量任务 ID（如有） |

#### 任务状态枚举

| state | 说明 |
|-------|------|
| `pending` | 排队等待中 |
| `processing` | 正在解析 |
| `done` | 解析完成 |
| `failed` | 解析失败（查看 `err_msg`） |

---

### 4.4 批量任务接口

#### 4.4.1 批量获取上传 URL

**接口：** `POST https://mineru.net/api/v4/file-urls/batch`

用于获取文件上传的预签名 URL（适合本地文件上传场景）。

#### 4.4.2 批量创建任务

**接口：** `POST https://mineru.net/api/v4/extract/task/batch`

请求体中 `files` 数组包含多个文件的解析参数。

#### 4.4.3 批量查询结果

**接口：** `GET https://mineru.net/api/v4/extract-results/batch/{batch_id}`

---

### 4.5 MVP 最小可用请求示例

#### Python 实现

```python
import os
import time
import requests

MINERU_API_TOKEN = os.getenv("MINERU_API_TOKEN")
BASE_URL = "https://mineru.net/api/v4"
HEADERS = {
    "Authorization": f"Bearer {MINERU_API_TOKEN}",
    "Content-Type": "application/json",
}

# ① 创建解析任务（仅需 url 一个必填字段）
resp = requests.post(
    f"{BASE_URL}/extract/task",
    headers=HEADERS,
    json={
        "url": "https://example.com/sample.pdf",   # 必填：文件公网 URL
        # "is_ocr": False,                          # 可选：默认 false
        # "enable_formula": True,                   # 可选：默认 true
        # "enable_table": True,                     # 可选：默认 true
        # "language": "zh",                         # 可选：默认中文
    },
)
task_id = resp.json()["task_id"]
print(f"Task created: {task_id}")

# ② 轮询查询结果
while True:
    result = requests.get(
        f"{BASE_URL}/extract/task/{task_id}",
        headers=HEADERS,
    ).json()

    state = result["state"]
    print(f"State: {state}")

    if state == "done":
        zip_url = result["full_zip_url"]
        print(f"Download: {zip_url}")
        break
    elif state == "failed":
        print(f"Error: {result['err_msg']}")
        break

    time.sleep(5)

# ③ 下载并解压结果
import zipfile, io

zip_data = requests.get(zip_url).content
with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
    zf.extractall("./mineru_output/")
    print("Files:", zf.namelist())
```

#### cURL 实现

```bash
# 创建任务
curl -X POST https://mineru.net/api/v4/extract/task \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/sample.pdf"}'

# 查询结果
curl https://mineru.net/api/v4/extract/task/{task_id} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### MVP 检查清单

- [ ] 已在 [mineru.net](https://mineru.net/) 注册账号
- [ ] 已在 [Token 管理页](https://mineru.net/apiManage/token) 获取 API Token
- [ ] 已将 Token 配置到 `.env` 文件：`MINERU_API_TOKEN=xxx`
- [ ] 准备了公网可访问的测试文件 URL（PDF/DOCX/PPT/图片）
- [ ] 安装了 `requests` 库：`pip install requests`
