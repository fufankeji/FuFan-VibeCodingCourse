# GraphRAG Studio — 产品需求文档（PRD）v1.0

> 文档类型：Product Requirements Document
> 产品名称：GraphRAG Studio
> 版本：v1.0
> 日期：2026-03-05
> 作者：产品设计团队
> 状态：草稿（Draft）

---

## 目录

- [一、产品概述](#一产品概述)
  - [1.1 产品背景](#11-产品背景)
  - [1.2 核心目标](#12-核心目标)
  - [1.3 业务痛点](#13-业务痛点)
  - [1.4 核心场景](#14-核心场景)
  - [1.5 用户群体](#15-用户群体)
  - [1.6 产品边界](#16-产品边界)
- [二、产品流程](#二产品流程)
  - [2.1 整体用户旅程](#21-整体用户旅程)
  - [2.2 核心流程一：文件上传与知识图谱构建](#22-核心流程一文件上传与知识图谱构建)
  - [2.3 核心流程二：知识图谱探索](#23-核心流程二知识图谱探索)
  - [2.4 核心流程三：Agentic 知识问答](#24-核心流程三agentic-知识问答)
  - [2.5 核心流程四：多模式实体搜索](#25-核心流程四多模式实体搜索)
  - [2.6 错误与异常处理流程](#26-错误与异常处理流程)
- [三、页面与模块清单](#三页面与模块清单)
  - [3.1 全局框架模块](#31-全局框架模块)
  - [3.2 Page 1 — Dashboard（系统总览）](#32-page-1--dashboard系统总览)
  - [3.3 Page 2 — Document Manager（文档管理）](#33-page-2--document-manager文档管理)
  - [3.4 Page 3 — KG Explorer（知识图谱）](#34-page-3--kg-explorer知识图谱)
  - [3.5 Page 4 — QA Chat（智能问答）](#35-page-4--qa-chat智能问答)
  - [3.6 Page 5 — Search（搜索）](#36-page-5--search搜索)
- [四、核心功能交互逻辑](#四核心功能交互逻辑)
  - [4.1 文件上传与索引任务管理](#41-文件上传与索引任务管理)
  - [4.2 知识图谱可视化交互](#42-知识图谱可视化交互)
  - [4.3 多轮对话与推理链展示](#43-多轮对话与推理链展示)
  - [4.4 跨页面联动导航](#44-跨页面联动导航)
  - [4.5 全局通知与反馈机制](#45-全局通知与反馈机制)
- [五、UI 设计规范](#五ui-设计规范)
  - [5.1 整体布局结构](#51-整体布局结构)
  - [5.2 配色系统](#52-配色系统)
  - [5.3 字体与排版](#53-字体与排版)
  - [5.4 组件样式规范](#54-组件样式规范)
  - [5.5 响应式断点规范](#55-响应式断点规范)
- [六、后端接口依赖](#六后端接口依赖)
- [七、非功能性需求](#七非功能性需求)
- [八、验收标准](#八验收标准)

---

## 一、产品概述

### 1.1 产品背景

在学术研究、企业知识管理、技术调研等场景中，研究人员需要从大量非结构化文档（PDF 论文、DOCX 报告、PPT 演示文稿、图片等）中快速提炼关键知识，理解概念之间的语义关联。

传统的 RAG（检索增强生成）系统采用向量检索方式，其结果呈现为零散的文本片段，缺乏实体间的结构化关联。用户无法直观感知"某个概念与哪些技术相关""两个实体之间的路径是什么"等图谱层面的知识。

**GraphRAG Studio** 基于知识图谱增强的多模态 RAG 技术，将文档自动解析为结构化知识图谱，并提供图谱可视化、多轮问答、实体搜索等完整工具链，将非结构化文档转化为可交互的知识网络。

### 1.2 核心目标

| 目标 | 说明 |
|------|------|
| **知识结构化** | 将多格式文档（PDF/DOCX/PPTX/PNG 等）自动解析并提取实体与关系，构建知识图谱 |
| **知识可视化** | 提供交互式力导向图，直观呈现实体及其语义关联，支持筛选、搜索、节点详情 |
| **知识问答** | 基于 Agentic-RAG（ReAct 框架），对自然语言问题进行多步工具调用推理，给出有据可查的答案 |
| **知识探索** | 提供实体搜索、路径发现、子图搜索三种探索模式，支持从不同维度切入知识网络 |
| **工程化管理** | 提供完整的文档上传、索引任务管理、任务进度监控、失败重试等工程化能力 |

### 1.3 业务痛点

**P1 — 高优先级痛点（必须解决）**

| # | 痛点描述 | 影响 |
|---|---------|------|
| P1-1 | 文档中知识密度高，人工阅读耗时长，无法快速定位关键概念 | 研究效率低下 |
| P1-2 | 概念之间的关联关系隐含在文字中，难以可视化梳理 | 知识理解片面 |
| P1-3 | 传统 RAG 只能返回文本片段，缺乏结构化推理能力 | 问答质量不稳定 |
| P1-4 | 多份文档的知识无法统一管理和关联查询 | 知识孤岛问题 |

**P2 — 中优先级痛点（应当解决）**

| # | 痛点描述 | 影响 |
|---|---------|------|
| P2-1 | 索引任务耗时长（MinerU 解析 + LLM 抽取），用户无法感知进度 | 操作体验差 |
| P2-2 | LLM 推理过程黑箱，用户不知道答案从何而来 | 可信度低 |
| P2-3 | 搜索只能通过全文检索，无法按实体类型或图谱路径搜索 | 搜索精度不足 |

**P3 — 低优先级痛点（后续解决）**

| # | 痛点描述 |
|---|---------|
| P3-1 | 多人协作时知识图谱共享困难 |
| P3-2 | 知识图谱版本管理缺失 |

### 1.4 核心场景

**场景一：论文精读与知识提炼**

> 研究人员上传一篇 GraphRAG 相关的 PDF 论文，系统自动提取论文中的技术概念（TECHNOLOGY）、研究方法（CONCEPT）、研究机构（ORGANIZATION）及其关联关系，生成知识图谱。研究人员通过图谱可视化快速理解论文核心知识结构，并通过 QA Chat 就具体问题进行深度追问。

**场景二：多文档跨文件知识整合**

> 用户批量上传多份研究报告，系统对每份文档独立索引后，将所有实体和关系合并至全局知识图谱。用户可在图谱中筛选特定文档的节点，发现跨文档的共同实体，通过路径搜索追溯概念间的传播关系。

**场景三：快速技术调研问答**

> 产品经理或技术负责人上传若干竞品白皮书，通过 QA Chat 提问"这些文档中提到了哪些核心技术？它们之间的关系是什么？"。系统通过 Agentic-RAG 进行多步工具调用（实体搜索 → 邻居查询 → 描述生成），返回结构化答案并展示推理步骤，Cited Nodes 直接链接到图谱中对应的节点。

**场景四：知识图谱演示与汇报**

> 教师或讲师上传课程材料，通过 KG Explorer 的全屏图谱视图向学生展示知识体系结构；通过 Demo 模式加载预置数据集，无需实际索引即可演示产品能力。

### 1.5 用户群体

| 用户角色 | 特征描述 | 核心诉求 | 使用频次 |
|---------|---------|---------|---------|
| **研究员 / 学者** | 熟悉 AI/NLP 领域，有文献精读需求 | 快速提取论文概念关联，深度问答 | 高频（每日） |
| **产品经理 / 分析师** | 非技术背景，有竞品调研需求 | 直观图谱展示，简单问答 | 中频（每周） |
| **技术工程师** | 熟悉 API，有集成需求 | 完整 API 文档，调试便利 | 中频（按需） |
| **教师 / 讲师** | 有知识可视化展示需求 | 图谱演示，无需深度操作 | 低频（按需） |
| **系统管理员** | 负责部署和维护 | 系统健康监控，日志排查 | 低频（运维） |

**主要设计对象：** 研究员 / 学者（核心用户）、产品经理 / 分析师（次核心用户）

### 1.6 产品边界

**In Scope（本版本包含）：**
- 多格式文档上传与管理（PDF/DOCX/PPTX/DOC/PPT/PNG/JPG/HTML）
- MinerU 文档解析 + LangExtract 实体抽取自动索引链路
- 全局知识图谱的可视化浏览与交互
- 基于 Agentic-RAG（DeepSeek + LangChain）的多轮问答
- 实体搜索、路径搜索、子图搜索
- 系统健康监控与任务状态看板

**Out of Scope（本版本不包含）：**
- 用户账号体系与权限管理
- 多人协作与知识图谱共享
- 知识图谱版本历史与回滚
- 流式（Stream）问答输出
- 自定义实体类型与关系类型配置

---

## 二、产品流程

### 2.1 整体用户旅程

```
进入系统
    │
    ▼
[Dashboard] ─── 查看系统概览 & 健康状态
    │
    ├─── 无文档 → [Documents] 上传文件 → 触发索引 → 等待完成
    │                                                   │
    │                                              索引完成 (done)
    │                                                   │
    ├─── 有 KG ──────────────────────────────────────────┤
    │                                                   │
    │    ┌──────────────────────────────────────────────┘
    │    │
    ├────▼─── [KG Explorer] 图谱可视化浏览
    │             └─── 点击节点 → 查看详情 → [Ask AI] → Chat
    │
    ├────────── [QA Chat] 自然语言问答
    │               └─── Cited Nodes → KG Explorer 节点定位
    │
    └────────── [Search] 实体/路径/子图搜索
                    └─── View in KG → KG Explorer
                    └─── Chat → Chat 预填问题
```

### 2.2 核心流程一：文件上传与知识图谱构建

这是系统最核心的数据入口流程，共分为 6 个阶段，涵盖客户端校验、上传、解析、实体抽取、图谱构建、结果呈现。

```
┌──────────────────────────────────────────────────────────────────┐
│                     文件上传与索引完整流程                         │
└──────────────────────────────────────────────────────────────────┘

用户操作：拖拽文件 / 点击"Browse Files"
    │
    ▼
[Stage 0 — 客户端预校验]
    检查文件扩展名（PDF/DOCX/DOC/PPTX/PPT/PNG/JPG/JPEG/HTML）
    检查文件大小（≤ 200MB）
    ─── 校验失败 → 文件名标红 + 行内错误说明（不上传）
    ─── 校验通过 → 进入 Stage 1
    │
    ▼
[Stage 1 — 文件上传]
    POST /api/v1/documents/upload (multipart/form-data)
    ─── 成功 → 返回 doc_id，文档行项目添加到列表（status: uploaded）
    ─── 失败 → Toast.error + 终止流程
    │
    ▼
[Stage 1.5 — 用户确认]
    弹出二次确认：
    "Start indexing now? [Yes, Start Indexing] [Later]"
    ─── Later → 保持 uploaded 状态，显示 [▶ Index] 按钮，流程结束
    ─── Yes → 进入 Stage 2
    │
    ▼
[Stage 2 — 启动索引任务]
    POST /api/v1/index/start { doc_id }
    ─── 成功 → 返回 job_id，status 更新为 indexing，显示进度条
    ─── 失败 → Toast.error（如"文档已在索引中"）
    │
    ▼
[Stage 3 — MinerU 文档解析（parsing）]
    轮询 GET /api/v1/index/status/{job_id}（每 3 秒）
    stage = "parsing"
    进度显示："Stage: Parsing document pages (2/4)..."
    progress = parsed_pages / total_pages × 33%
    │
    ▼
[Stage 4 — LangExtract 实体抽取（extracting）]
    stage = "extracting"
    进度显示："Stage: Extracting entities (18 found so far)..."
    progress = 33% + extracted_entities / estimated_total × 33%
    │
    ▼
[Stage 5 — 知识图谱构建（indexing）]
    stage = "indexing"
    进度显示："Stage: Building knowledge graph..."
    progress ≈ 90%
    │
    ▼
[Stage 6 — 完成（done / failed）]
    ─── done:
        GET /api/v1/index/result/{job_id} → 获取结果统计
        更新状态标记为 ● indexed
        展开结果摘要：40 nodes · 780 edges · 4 pages · 45 extractions · 42.1s
        Toast.success("paper.pdf indexed: 40 nodes, 780 edges")
        AppState.kg.loaded = false（触发 KG Explorer 下次进入时重新加载）
    ─── failed:
        行内展示错误信息（如 "MinerU failed: timeout after 600s"）
        显示 [⟳ Retry] 按钮
        Toast.error("Indexing failed: paper.pdf")
```

**多文件串行处理规则：**
- 同时拖入多个文件时，依次串行执行上述流程（上传 → 确认 → 索引）
- 每个文件独立显示进度，互不影响
- 任一文件失败不阻塞其他文件的处理

### 2.3 核心流程二：知识图谱探索

```
进入 KG Explorer (#/graph)
    │
    ▼
[初始化加载]
    优先读取 AppState.kg 缓存（避免重复请求）
    若无缓存 → GET /api/v1/kg/nodes?page_size=200
              GET /api/v1/kg/edges?page_size=500
    ─── KG 为空（code 3002）→ 显示空状态引导页面
    ─── 加载成功 → D3 力导向图渲染
    │
    ▼
[URL 参数处理]
    解析 hash query：
    ?doc_id=xxx  → 自动勾选对应文档筛选，其余节点淡化
    ?node=xxx    → 自动选中节点 + 高亮 + 展开 Detail Panel + 平移居中
    │
    ▼
[用户交互分支]
    │
    ├─ 节点悬停 → Tooltip（name / type / page / confidence / degree）
    │
    ├─ 节点单击
    │      GET /api/v1/kg/nodes/{node_id}（获取详情）
    │      GET /api/v1/kg/nodes/{node_id}/neighbors?hops=1（获取邻居）
    │      → 右侧 Detail Panel 展开
    │      → 点击节点高亮，其余节点 opacity 0.1，相连边 opacity 0.8
    │
    ├─ 节点拖拽 → pin 到固定位置（fx/fy 设置）
    │
    ├─ 点击空白处 → 取消选中，Detail Panel 收起，恢复透明度
    │
    ├─ Filter Panel 操作
    │      勾选/取消实体类型 → 实时过滤可见节点
    │      选择 Source Doc → 筛选对应文档节点
    │      勾选/取消 Confidence 等级 → 实时过滤
    │
    ├─ 工具栏操作
    │      [+ -] → 缩放
    │      [⊡ Fit] → 自适应全部节点
    │      [Search] → GET /api/v1/search/entities?q=...（闪烁高亮 + 居中）
    │      [PNG] → SVG → PNG 下载
    │      [JSON] → GET /api/v1/kg/export → 文件下载
    │
    └─ Detail Panel 操作
           [💬 Ask AI] → #/chat?q=Tell+me+about+{name}
           邻居节点点击 → 切换选中节点
           [All neighbors →] → 展开完整邻居列表
```

### 2.4 核心流程三：Agentic 知识问答

```
进入 Chat (#/chat)
    │
    ▼
[初始化]
    GET /api/v1/query/history?page_size=20 → 渲染左侧历史列表
    若无历史 → 显示欢迎页 + Suggested Prompts
    若有 URL 参数 ?q=... → 预填输入框并自动聚焦
    │
    ▼
[用户输入问题]
    输入框（多行）+ Enter 或 点击 [▶] 按钮
    │
    ▼
[发送请求]
    构建 payload:
    { question: "...", history: [ {role:"human",...}, {role:"ai",...} ] }
    POST /api/v1/query
    立即显示：
      - 用户消息气泡（右对齐，蓝色背景）
      - "thinking..." 三点跳动动画（左对齐）
    输入框禁用（发送中）
    │
    ▼
[等待 API 响应（超时 60s）]
    ─── 超时 → Toast.warning + 三点动画消失 + 输入框恢复
    ─── 网络错误 → Toast.error("Network error") + [Retry]
    ─── API 成功 → 进入渲染阶段
    │
    ▼
[渲染 AI 回答]
    消除 thinking 动画
    渲染 AI 消息气泡（左对齐，卡片样式）：
    │
    ├─ answer 文本（marked.js 渲染 Markdown）
    │
    ├─ Tool Calls 折叠面板（默认收起）
    │      显示 "▶ Tool Calls (N steps)"
    │      展开后逐步显示每个工具调用：
    │        Step 1: search_entities / Input / Output
    │        Step 2: get_neighbors / Input / Output
    │        ...（等宽字体，代码块样式）
    │
    ├─ Cited Nodes 标签组
    │      [◉ GraphRAG] [◉ LLMs] [◉ knowledge graphs] ...
    │      点击任一标签 → #/graph?node={node_id}
    │      hover → 显示 Tooltip（type + page）
    │
    └─ 耗时信息（⏱ 8.4s）
    │
    ▼
[更新状态]
    AppState.chatHistory.push(result)（维护多轮 history）
    输入框清空 + 恢复可用
    左侧历史列表：新会话置顶
```

### 2.5 核心流程四：多模式实体搜索

```
进入 Search (#/search)
    │
    ▼
[初始化]
    解析 URL 参数 ?q=...&type=...&tab=...
    预填搜索框，自动触发搜索
    │
    ┌──────────────────────────────────────────────────────────────┐
    │                     三种搜索模式                              │
    └──────────────────────────────────────────────────────────────┘
    │
    ├── [Tab 1: Entity Search]
    │      输入实体名称 + 可选类型过滤（All / TECHNOLOGY / CONCEPT / ...）
    │      点击 [Search] 或 Enter
    │      GET /api/v1/search/entities?q=...&type=...
    │      ─── 无结果 → 空状态提示 + "Try KG Explorer"
    │      ─── 有结果 → 左侧结果列表（实体卡片）
    │            点击结果行 → 右侧 Preview Graph 渲染（1-hop 邻居子图）
    │            GET /api/v1/kg/nodes/{id}/neighbors?hops=1
    │            [View KG] → #/graph?node={node_id}
    │            [Chat] → #/chat?q=What+is+{name}
    │
    ├── [Tab 2: Path Search]
    │      选择起点节点（搜索选择器）
    │      选择终点节点（搜索选择器）
    │      设置最大跳数（1-5）
    │      点击 [Find Path]
    │      GET /api/v1/search/path?from={id}&to={id}&max_hops={n}
    │      ─── 无路径 → "No path found between these entities"
    │      ─── 有路径 → 路径可视化（线性节点链）+ 文字描述
    │
    └── [Tab 3: Graph Search]
           输入关键词 + 可选"Include Neighbors"开关
           点击 [Search]
           GET /api/v1/search/graph?q=...&include_neighbors=true
           ─── 渲染子图（D3 可视化，仅展示匹配节点及其邻边）
           ─── 列表显示匹配节点摘要（name / type / page）
```

### 2.6 错误与异常处理流程

```
API 调用失败（code ≠ 0）
    │
    ├─ code 1001/1002/1003（参数/格式/大小校验）
    │      → 行内错误提示（不弹 Toast）
    │
    ├─ code 2001（job 不存在）
    │      → Toast.error + 刷新任务列表
    │
    ├─ code 3002（KG 为空）
    │      → 不弹 Toast，页面内空状态引导：[Upload & Index →]
    │
    ├─ code 4001（QA 失败）
    │      → Toast.error(msg) + 输入框恢复
    │
    ├─ code 5000（服务器内部错误）
    │      → Toast.error("Server error, check API logs")
    │
    └─ 网络不可达（fetch 异常）
           → Toast.error("Network error. Is API server running on :8000?")
           → 相关操作显示 [Retry] 按钮
           → Header 右侧健康指示器变红点
```

---

## 三、页面与模块清单

### 3.1 全局框架模块

系统采用 SPA（单页应用）架构，Hash 路由（`#/dashboard`、`#/documents` 等），全局框架由以下四个固定区域构成：

#### 3.1.1 Header（顶部导航栏）

- **高度：** 56px，`position: sticky; top: 0; z-index: 100`
- **左区：** 汉堡折叠按钮（`[≡]`）+ 产品 Logo 文字 "GraphRAG Studio"
- **中区：** 全局搜索框（max-width 400px）
  - 输入 3+ 字符 → 实时调用实体搜索接口（debounce 300ms）
  - 下拉展示最多 5 条建议（名称 + 类型 Badge）
  - 按 Enter → 跳转 `#/search?q={input}`
  - 点击建议项 → 跳转 `#/graph?node={node_id}`
- **右区：** 系统健康指示器（绿点/红点）+ "API: localhost:8000"

#### 3.1.2 Sidebar（左侧导航栏）

- **宽度：** 220px（默认），折叠后 72px（仅图标）
- **导航项列表：**

| 图标 | 标签 | 路由 | 右侧 Badge |
|------|------|------|-----------|
| ◈ | Dashboard | `#/dashboard` | — |
| ▤ | Documents | `#/documents` | 文档总数 |
| ◉ | KG Explorer | `#/graph` | — |
| ◇ | Chat | `#/chat` | 历史查询数 |
| ⊕ | Search | `#/search` | — |
| ☰ | System | — | — |

- **激活状态：** 左侧 2px 蓝色竖线 + 背景 `rgba(88,166,255,0.1)` + 文字变蓝

#### 3.1.3 Status Bar（底部状态栏）

- **高度：** 32px，常驻底部
- **左区：** 当前活跃 Job 进度（如 "Indexing paper.pdf... 65%"），无 Job 时隐藏
- **右区：** API 版本号（v1.0.0）+ 健康状态点（常驻）

#### 3.1.4 全局状态管理（AppState）

前端维护内存级全局状态，页面间共享：

| 字段 | 类型 | 说明 |
|------|------|------|
| `currentPage` | string | 当前激活页面 |
| `kg.nodes` | array | 全量 KG 节点缓存（首次加载后复用） |
| `kg.edges` | array | 全量 KG 边缓存 |
| `kg.loaded` | boolean | 索引完成后置 false，触发重新加载 |
| `documents` | array | 文档列表缓存 |
| `activeJobs` | object | `job_id → polling timer`（轮询管理） |
| `chatHistory` | array | 当前会话的多轮对话历史 |
| `health` | object | 最近一次健康检查结果 |

---

### 3.2 Page 1 — Dashboard（系统总览）

**路由：** `#/dashboard`
**目的：** 系统全局状态一览，快速导航到各功能，最近活动监控。

#### 模块组成

**A. Overview 指标卡（4 个）**

| 指标 | 数据来源 | 颜色 |
|------|---------|------|
| KG Nodes（知识节点数） | `GET /api/v1/system/stats` | 蓝色 `#58a6ff` |
| KG Edges（知识关系数） | `GET /api/v1/system/stats` | 紫色 `#8957e5` |
| Documents（文档总数） | `GET /api/v1/system/stats` | 绿色 `#3fb950` |
| Queries（问答次数） | `GET /api/v1/system/stats` | 黄色 `#d29922` |

每 10 秒自动轮询刷新，数值变化时平滑过渡动画。

**B. System Health 面板**

显示 4 个依赖服务的健康状态，数据来源 `GET /api/v1/health`：

| 服务 | 状态指示 |
|------|---------|
| MinerU venv | ● ok / ● error |
| LangExtract venv | ● ok / ● error |
| DeepSeek API | ● ok / ● error |
| Storage | ● ok / ● error |

**C. Recent Documents 列表**

显示最近 5 条文档记录，数据来源 `GET /api/v1/documents?page=1&page_size=5`：
- 文件名、格式、页数、状态 Badge、日期
- indexed 状态：显示 [KG] 跳转按钮
- indexing 状态：显示行内进度条 + [✕] 取消按钮
- uploaded 状态：显示 [▶ Index] 按钮
- 右上角 [View All →] 跳转 `#/documents`

**D. Quick Actions 快捷按钮组**

| 按钮 | 操作 |
|------|------|
| [◉ Explore KG] | 跳转 `#/graph` |
| [◇ Start Chat] | 跳转 `#/chat` |
| [⊕ Search] | 跳转 `#/search` |
| [⚡ Demo] | 调用 `GET /api/v1/system/demo`，加载演示数据，跳转 `#/graph` |

**E. Upload & Index 入口**

右上角 `[+ Upload & Index]` 主操作按钮，点击打开 Upload Modal（复用 Documents 页上传区），完成后跳转 `#/documents`。

---

### 3.3 Page 2 — Document Manager（文档管理）

**路由：** `#/documents`
**目的：** 文件上传、列表管理、触发/监控索引任务、查看索引结果。

#### 模块组成

**A. 拖拽上传区**

- 虚线边框卡片，居中显示上传图标和说明文字
- 拖拽悬停时：边框变蓝（`#58a6ff`）+ 背景 `rgba(88,166,255,0.05)`
- 点击 [Browse Files] 触发文件选择器
- 支持格式说明：`PDF · DOCX · DOC · PPTX · PPT · PNG · JPG · HTML`
- 文件大小限制：`Max 200MB per file`

**B. 文档列表工具栏**

- 格式筛选下拉（All / PDF / DOCX / PPTX / PNG / JPG / HTML）
- 状态筛选下拉（All / indexed / indexing / uploaded / failed）
- 关键词搜索框（客户端过滤，实时）

**C. 文档列表（表格）**

每行字段：文件名、格式、页数、状态 Badge、上传日期、操作按钮组

| 状态 | 显示内容 | 操作按钮 |
|------|---------|---------|
| `uploaded` | ● uploaded（灰） | [▶ Index] [🗑 Delete] |
| `indexing` | ● indexing（黄，动画点） + 进度条 + stage 说明 | [✕ Cancel] |
| `indexed` | ● indexed（绿） | [◉ View KG] [🗑 Delete] |
| `failed` | ● failed（红） + 错误摘要 | [⟳ Retry] [🗑 Delete] |

**D. 索引结果展开行**（仅 indexed 状态）

点击展开：
```
40 nodes · 780 edges · 4 pages · 45 extractions · 42.1s
TECHNOLOGY(4)  CONCEPT(36)
[◉ View in KG]  [≡ Show Extractions]
```

展开 [Show Extractions] 显示抽取记录表：text / type / alignment / page（最多 50 条，可滚动）

---

### 3.4 Page 3 — KG Explorer（知识图谱）

**路由：** `#/graph`
**目的：** 全屏交互式知识图谱可视化，节点筛选、详情查看、图谱导出。

#### 模块组成

**A. Filter Panel（左侧筛选栏，280px）**

- Source Docs 下拉：按文档筛选图谱节点
- Entity Types 多选：TECHNOLOGY / CONCEPT / PERSON / ORGANIZATION / LOCATION（每类显示数量）
- Confidence 等级多选：exact / greater / lesser / fuzzy
- 图谱导出按钮：[📷 Export PNG] [⬇ Export JSON]

**B. D3 力导向图（中央主区，flex: 1）**

- SVG 全屏渲染，支持 `d3.zoom`（scaleExtent 0.1 ～ 8）
- 工具栏（浮于图谱左上角）：[+] [-] [⊡ Fit All] [🔍 Search input]
- 图例（浮于图谱左下角）：五种颜色对应五种实体类型
- 空状态（KG 无数据）：居中提示 + [Upload & Index →] 按钮

**C. Detail Panel（右侧详情栏，300px，点击节点后出现）**

- 节点名称（H1 样式）
- 实体类型 Badge
- 属性信息：Page / Confidence / Degree / Centrality
- 邻居节点列表（最多展示 5 个，[All N →] 查看全部）
- [💬 Ask AI] 按钮 → 跳转 Chat 预填问题
- [× Close] 关闭 Detail Panel

---

### 3.5 Page 4 — QA Chat（智能问答）

**路由：** `#/chat`
**目的：** 多轮知识图谱问答，展示 Agentic-RAG 推理过程，Cited Node 联动跳转。

#### 模块组成

**A. History Sidebar（左侧历史栏，240px）**

- [+ New Chat] 新建会话按钮
- 历史记录列表（按时间分组：Today / Yesterday / Earlier）
  - 每条显示问题前 30 字符
  - 点击切换历史会话（前端记录，当前版本不持久化多会话）
- 数据来源：`GET /api/v1/query/history?page_size=20`

**B. Chat Area（右侧对话区）**

- 欢迎界面（无历史时）：产品介绍 + Suggested Prompts（4 个常用问题）
- 消息时间分隔线
- 用户消息气泡（右对齐，蓝色背景）
- AI 消息气泡（左对齐，卡片样式）：
  - Markdown 渲染的答案文本
  - Tool Calls 折叠面板（默认收起）
  - Cited Nodes 标签组（可点击跳转）
  - 耗时信息（⏱ N.Ns）
- Thinking 动画（三点跳动）

**C. 输入区**

- 多行文本输入框（placeholder: "Ask about the knowledge graph..."）
- [▶ Send] 发送按钮
- Enter 发送，Shift+Enter 换行
- 发送中：输入框禁用，按钮 loading 状态

---

### 3.6 Page 5 — Search（搜索）

**路由：** `#/search`
**目的：** 多模式实体搜索，支持关键词、路径、子图三种搜索范式。

#### 模块组成

**A. 搜索头区**

- 主搜索框（全宽）
- 类型筛选下拉（All Types / TECHNOLOGY / CONCEPT / PERSON / ORG / LOC）
- [Search] 搜索按钮
- 搜索状态与 URL 双向同步：`#/search?q=...&type=...&tab=...`

**B. Tab 切换栏**

3 个 Tab：Entity Search（默认） / Path Search / Graph Search

**C. Entity Search Tab**

- 左栏：结果列表（卡片式）
  - 实体名称 + 类型 Badge + 页码 + Degree + Confidence
  - [View KG] + [Chat] 操作按钮
- 右栏：Preview Graph（D3 迷你图，展示选中实体的 1-hop 邻居子图）

**D. Path Search Tab**

- From 节点选择器（搜索 + 下拉选择）
- To 节点选择器
- Max Hops 下拉（1-5）
- [Find Path] 按钮
- 路径结果：线性节点链可视化 + 文字描述

**E. Graph Search Tab**

- 关键词输入框
- [Include Neighbors] 开关
- D3 子图可视化（全宽）
- 匹配节点列表

---

## 四、核心功能交互逻辑

### 4.1 文件上传与索引任务管理

#### 拖拽上传区状态机

```
初始状态（idle）
    │
    ├── dragenter → hover 状态（边框蓝，背景浅蓝）
    │     └── dragleave → 回到 idle
    │
    └── drop / browse → uploading 状态
          │
          ├── 校验失败 → idle（行内错误）
          └── 校验通过 → 文件加入上传队列
```

#### 进度条渲染规则

| 阶段 | 进度计算 | 展示文字 |
|------|---------|---------|
| parsing | `parsed_pages / total_pages × 33%` | "Parsing document... (2/4 pages)" |
| extracting | `33% + extracted_entities / estimated × 33%` | "Extracting entities... (18 found)" |
| indexing | 固定 80% ～ 95%（indeterminate） | "Building knowledge graph..." |
| done | 100% | 渐隐，展开结果行 |

#### 索引取消逻辑

- 点击 [✕ Cancel] → 弹出确认弹窗
- 确认后 → `DELETE /api/v1/index/jobs/{job_id}`
- 停止对应 job_id 的轮询 timer
- 文档状态退回 "uploaded"，显示 [▶ Index] 按钮

#### 文档删除确认弹窗规范

删除 indexed 状态的文档时，弹窗需展示关联数据影响范围：

```
Delete "paper.pdf"?

This document and all associated KG data will be permanently deleted.
  · 40 nodes removed from knowledge graph
  · 780 edges removed from knowledge graph

This action cannot be undone.

                    [Cancel]  [Delete →]
```

- [Delete] 为红色危险按钮
- 操作完成后 Toast.success("paper.pdf deleted") + 刷新列表

### 4.2 知识图谱可视化交互

#### 节点视觉映射规则

| 视觉属性 | 规则 |
|---------|------|
| 颜色 | 实体类型 → 5 色方案（蓝/紫/绿/红/橙） |
| 半径 | `r = Math.max(4, Math.log(degree + 1) × 4)`（连接越多越大） |
| 描边 | 正常 1.5px / hover 2.5px 白色 |
| 透明度 | 正常 0.9；高亮模式下非焦点节点 0.1 |

#### 节点高亮逻辑（聚焦模式）

```
点击节点 N：
  所有节点 → opacity 0.1（淡化）
  节点 N 及其直连邻居 → opacity 0.9（保持）
  节点 N → 半径 × 1.5（放大）
  节点 N 相连的边 → opacity 0.8（清晰）
  其余边 → opacity 0.05（几乎隐藏）

点击空白区域：
  全部节点恢复 opacity 0.9
  全部边恢复 opacity 0.25
  Detail Panel 收起
```

#### D3 力参数配置

| 参数 | 值 | 说明 |
|------|---|------|
| `forceLink distance` | 60 | 边长 |
| `forceLink strength` | 0.3 | 弹力 |
| `forceManyBody strength` | -120 | 节点斥力 |
| `forceCollide radius` | `d.r + 4` | 防重叠 |
| `alphaDecay` | 0.02 | 稳定速度 |

#### Tooltip 内容规范

鼠标悬停节点时，在鼠标右下方 8px 处显示：

```
┌─────────────────────────┐
│ GraphRAG        [TECH]  │
│ Page: 0                 │
│ Confidence: match_exact │
│ Degree: 39              │
└─────────────────────────┘
```

### 4.3 多轮对话与推理链展示

#### 多轮 History 维护规则

```javascript
// 每次发送携带完整历史（前端维护）
const payload = {
  question: inputText,
  history: AppState.chatHistory.flatMap(msg => [
    { role: 'human', content: msg.question },
    { role: 'ai',    content: msg.answer   }
  ])
};
```

- 每次问答后将 QAResult 追加到 `AppState.chatHistory`
- 历史条数上限：20 轮（超出后丢弃最早的对话）

#### Tool Call 折叠面板展示规范

- 默认收起（▶ Tool Calls (N steps)）
- 点击展开 → 逐步展示每个 tool step
- 样式：等宽字体，暗色背景（`--bg-s3`），黄色 tool 名称
- 输入（Input）/ 输出（Output）用分隔线区分

#### Suggested Prompts 展示逻辑

| 条件 | Prompts 显示 |
|------|-------------|
| KG 非空 + 无对话历史 | 展示 4 个预设问题 |
| KG 为空 | 提示"先上传文档构建 KG" |
| 已有对话历史 | 不显示 Prompts |

预设问题：
1. "Give me an overview of the knowledge graph"
2. "List all TECHNOLOGY entities"
3. "How does GraphRAG relate to knowledge graphs?"
4. "What is retrieval-augmented generation?"

### 4.4 跨页面联动导航

系统各页面通过 Hash 路由参数实现深度联动：

| 触发位置 | 触发动作 | 目标页面 | URL 参数 |
|---------|---------|---------|---------|
| Dashboard [KG] 按钮 | 点击 | KG Explorer | `#/graph?doc_id={doc_id}` |
| Dashboard [Explore KG] | 点击 | KG Explorer | `#/graph` |
| Dashboard [Demo] | 点击 | KG Explorer | 加载 demo → `#/graph` |
| Dashboard [Start Chat] | 点击 | QA Chat | `#/chat` |
| Documents [◉ View KG] | 点击 | KG Explorer | `#/graph?doc_id={doc_id}` |
| Chat Cited Node 标签 | 点击 | KG Explorer | `#/graph?node={node_id}` |
| KG Detail Panel [💬 Ask AI] | 点击 | QA Chat | `#/chat?q=Tell+me+about+{name}` |
| Search [View KG] | 点击 | KG Explorer | `#/graph?node={node_id}` |
| Search [Chat] | 点击 | QA Chat | `#/chat?q=What+is+{name}` |
| Header 全局搜索框 Enter | 提交 | Search | `#/search?q={input}` |
| Header 全局搜索框建议项 | 点击 | KG Explorer | `#/graph?node={node_id}` |

**URL 参数接收规则（KG Explorer）：**

```javascript
// KG Explorer 初始化时解析
const params = new URLSearchParams(window.location.hash.split('?')[1]);
const docFilter    = params.get('doc_id');   // 按文档筛选
const nodeHighlight = params.get('node');    // 聚焦并定位节点

if (docFilter) {
  // 自动勾选 Filter Panel 中对应文档，其余节点淡化
}
if (nodeHighlight) {
  // 找到节点 → 模拟点击（触发 Detail Panel）→ 平移居中 → 高亮
}
```

### 4.5 全局通知与反馈机制

#### Toast 通知系统

**位置：** 右上角 `position: fixed; top: 72px; right: 24px`
**宽度：** 320px
**堆叠规则：** 最多同时显示 3 条，从上向下排列，间距 8px

| 类型 | 背景 | 左边框 | 图标 | 使用场景 |
|------|------|-------|------|---------|
| Success | `#1a3a22` | 3px `#3fb950` | ✓ | 索引完成、删除成功 |
| Warning | `#2d2a16` | 3px `#d29922` | ! | 请求超时、格式警告 |
| Error | `#3b1a1a` | 3px `#f85149` | ✗ | 上传失败、网络错误 |
| Info | `#161f2e` | 3px `#58a6ff` | i | 操作提示、加载状态 |

**生命周期：**
- 出现：从右侧 slide-in（200ms ease-out）
- 停留：4000ms（hover 时暂停计时器）
- 消失：fade-out（300ms）→ 从 DOM 移除

#### Loading 状态层级

| 层级 | 样式 | 触发场景 |
|------|------|---------|
| Header 进度条 | 2px 高，顶部蓝色横条 | 所有 API 请求期间 |
| Skeleton Loader | 灰色矩形 shimmer 动画 | 列表首次加载 |
| 图谱 Loading | SVG 中央文字 + 三点动画 | KG 数据加载 |
| Chat Thinking | 三点跳动动画（气泡内） | 等待 QA 响应 |

#### 空状态引导设计

| 页面 | 空状态触发条件 | 引导内容 |
|------|--------------|---------|
| KG Explorer | KG 无节点数据 | 图标 + "No knowledge graph yet" + [Upload & Index →] |
| Chat | 无历史对话 | 欢迎语 + Suggested Prompts（4 个） |
| Search | 搜索结果为空 | "No entities found for '{query}'" + [Explore KG] |
| Documents | 无文档记录 | 上传区更突出，拖拽提示放大 |

---

## 五、UI 设计规范

### 5.1 整体布局结构

系统采用 CSS Grid 四区布局，高度占满视口（`height: 100vh`）：

```
┌──────────────────────────────────────────────────────────────────┐
│  HEADER  56px  (sticky, z-index: 100)                            │
├──────────────┬───────────────────────────────────────────────────┤
│              │                                                    │
│  SIDEBAR     │   MAIN CONTENT AREA                               │
│  220px       │   (overflow-y: auto, padding: 24px)               │
│  (fixed)     │                                                    │
│              │   KG Explorer 例外：padding: 0，内部自行布局       │
│              │                                                    │
├──────────────┴───────────────────────────────────────────────────┤
│  STATUS BAR  32px                                                 │
└──────────────────────────────────────────────────────────────────┘
```

**CSS Grid 骨架代码：**

```css
.app {
  display: grid;
  grid-template-areas: "header header" "sidebar main" "footer footer";
  grid-template-columns: var(--sidebar-w, 220px) 1fr;
  grid-template-rows: 56px 1fr 32px;
  height: 100vh;
  overflow: hidden;
}
```

**KG Explorer 三栏内部布局：**

```
┌─────────────┬────────────────────────────────────┬─────────────┐
│ Filter Panel│   D3 Graph（flex: 1）               │ Detail Panel│
│  280px      │                                    │  300px      │
│             │   全屏 SVG，支持缩放/拖拽/pin        │  点击节点后  │
│             │                                    │  滑入出现   │
└─────────────┴────────────────────────────────────┴─────────────┘
```

**Chat 双栏内部布局：**

```
┌──────────────┬──────────────────────────────────────────────────┐
│ History      │  Chat Area                                        │
│ 240px        │  (display: flex; flex-direction: column)         │
│              │  消息列表（flex: 1, overflow-y: auto）            │
│              │  输入区（固定底部）                               │
└──────────────┴──────────────────────────────────────────────────┘
```

### 5.2 配色系统

采用 GitHub 深色主题（Dark）配色体系，在现有 `index.html` 调色板基础上扩展：

#### 背景层级

| 变量 | 色值 | 用途 |
|------|------|------|
| `--bg-base` | `#0f1117` | 页面底色（body background） |
| `--bg-s1` | `#161b22` | 主要表面（sidebar / header / card） |
| `--bg-s2` | `#21262d` | 次级表面（hover 态 / input / tag） |
| `--bg-s3` | `#1c2128` | 浮层表面（tooltip / popover / 代码块） |

#### 边框

| 变量 | 色值 | 用途 |
|------|------|------|
| `--border` | `#30363d` | 主边框 |
| `--border-muted` | `#21262d` | 次级分隔线 |

#### 文字层级

| 变量 | 色值 | 用途 |
|------|------|------|
| `--text-1` | `#f0f6fc` | 主标题、强调文字 |
| `--text-2` | `#c9d1d9` | 正文内容 |
| `--text-3` | `#8b949e` | 辅助信息、Label |
| `--text-4` | `#484f58` | Placeholder、极弱文字 |

#### 功能色

| 变量 | 色值 | 用途 |
|------|------|------|
| `--blue` | `#58a6ff` | 链接 / 激活态 / 聚焦 / 进度条 |
| `--green` | `#3fb950` | 成功状态 / indexed |
| `--green-btn` | `#238636` | 主操作按钮背景 |
| `--green-hover` | `#2ea043` | 主操作按钮 hover |
| `--red` | `#f85149` | 错误 / 危险操作 / failed |
| `--yellow` | `#d29922` | 警告 / indexing 进行中 |
| `--purple` | `#8957e5` | 边数指标 / 特殊强调 |

#### 实体类型颜色（与 D3 图谱一致）

| 实体类型 | 颜色变量 | 色值 | 节点颜色 |
|---------|---------|------|---------|
| TECHNOLOGY | `--type-tech` | `#58a6ff` | 蓝色 |
| CONCEPT | `--type-concept` | `#bc8cff` | 紫色 |
| PERSON | `--type-person` | `#3fb950` | 绿色 |
| ORGANIZATION | `--type-org` | `#ff7b72` | 红色 |
| LOCATION | `--type-loc` | `#ffa657` | 橙色 |

#### 状态 Badge 配色

| 状态 | 背景 | 文字 |
|------|------|------|
| indexed | `#1a3a22` | `#3fb950` |
| indexing | `#2d2a16` | `#d29922` |
| uploaded | `#1c2128` | `#8b949e` |
| failed | `#3b1a1a` | `#f85149` |

### 5.3 字体与排版

**字体族：**

```css
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
```

**字体层级规范：**

| 层级 | 大小 | 粗细 | 颜色 | 用途 |
|------|------|------|------|------|
| H1（页面标题） | 20px | 600 | `--text-1` | 页面大标题 |
| H2（区块标题） | 16px | 600 | `--text-1` | 区块标题 |
| H3（面板子标题） | 13px | 600 uppercase | `--text-3` | 面板分类标题（字母间距 0.5px） |
| Body（正文） | 14px | 400 | `--text-2` | 列表内容、说明文字 |
| Small（辅助） | 12px | 400 | `--text-3` | 日期、辅助信息、Tooltip |
| Badge（标签） | 11px | 600 | — | 状态标记、类型标签 |
| Mono（代码） | 13px | 400 | `--text-2` | Tool Call 输入输出、文件路径 |

**行间距：** 正文 `1.6`，代码块 `1.5`

### 5.4 组件样式规范

#### 按钮（4 种变体）

| 变体 | class | 背景 | 边框 | 文字颜色 | 用途 |
|------|-------|------|------|---------|------|
| Primary | `.btn-primary` | `--green-btn` | `--green-btn` | `#ffffff` | 主操作（Upload / Send / Index） |
| Secondary | `.btn-secondary` | `--bg-s2` | `--border` | `--text-2` | 次要操作（Cancel / Filter） |
| Ghost | `.btn-ghost` | transparent | none | `--text-3` | 图标按钮（内联操作） |
| Danger | `.btn-danger` | `--bg-s2` | `--border` | `--red` | 危险操作（Delete） |

```css
.btn {
  padding: 6px 14px;
  border-radius: 6px;          /* --r-md */
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid transparent;
}
.btn-sm { padding: 4px 10px; font-size: 12px; }
```

#### 卡片（Card）

```css
.card {
  background: var(--bg-s1);
  border: 1px solid var(--border);
  border-radius: 8px;           /* --r-lg */
  padding: 16px;
}
```

#### 输入框（Input）

```css
.input {
  background: var(--bg-s2);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-1);
  padding: 8px 12px;
  font-size: 14px;
  width: 100%;
  transition: border-color 150ms ease;
}
.input:focus {
  outline: none;
  border-color: var(--blue);
  box-shadow: 0 0 0 3px rgba(88,166,255,0.15);
}
```

#### 进度条

```css
.progress-bar {
  height: 4px;
  background: var(--bg-s2);
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--blue);
  border-radius: 2px;
  transition: width 300ms ease;
}
```

#### Modal（确认弹窗）

```css
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  z-index: 1000;
  display: flex; align-items: center; justify-content: center;
}
.modal {
  background: var(--bg-s1);
  border: 1px solid var(--border);
  border-radius: 12px;           /* --r-xl */
  padding: 24px;
  width: 360px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
}
```

#### Skeleton Loader（骨架屏）

```css
.skeleton {
  background: linear-gradient(90deg, var(--bg-s2) 25%, var(--bg-s1) 50%, var(--bg-s2) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

#### 阴影规范

```css
--shadow-sm: 0 1px 3px rgba(0,0,0,0.4);     /* card 轻阴影 */
--shadow-md: 0 4px 16px rgba(0,0,0,0.5);    /* dropdown / tooltip */
--shadow-lg: 0 8px 32px rgba(0,0,0,0.6);    /* modal / drawer */
```

#### 圆角规范

```css
--r-sm: 4px;    /* badge / tag / 小按钮 */
--r-md: 6px;    /* 按钮 / 输入框 / 小卡片 */
--r-lg: 8px;    /* 卡片 / 面板 */
--r-xl: 12px;   /* Modal / 大弹窗 */
```

### 5.5 响应式断点规范

系统支持 4 个断点，覆盖从 4K 显示器到移动端的使用场景：

| 断点 | 宽度范围 | 目标设备 |
|------|---------|---------|
| Desktop | > 1280px | 台式机、宽屏笔记本 |
| Laptop | 1024 ～ 1280px | 普通 13/14 寸笔记本 |
| Tablet | 768 ～ 1024px | iPad、竖屏笔记本 |
| Mobile | < 768px | 手机 |

#### 各断点布局变化

**Desktop（> 1280px）：**
- 完整三列布局（Sidebar 220px + Main + Detail Panel）
- 所有功能面板默认展开

**Laptop（1024 ～ 1280px）：**
- Sidebar 折叠为图标模式（72px），仅显示图标
- 导航文字 Label、Badge、Logo 文字隐藏
- 内容区相应扩展

**Tablet（768 ～ 1024px）：**
- Sidebar 完全隐藏（`grid-template-columns: 0 1fr`）
- 汉堡菜单按钮（`[≡]`）展开/收起 Sidebar Drawer
- Drawer 覆盖内容区（`position: fixed; z-index: 500`）+ 半透明遮罩
- KG Explorer：Filter Panel → 浮动侧边 Drawer（FAB 触发）
- Chat：History Sidebar → 顶部 Drawer

**Mobile（< 768px）：**
- 底部 Tab Bar 替代左侧 Sidebar（高度 56px，5 个图标导航）
- Header 精简（隐藏全局搜索框，仅保留 Logo + 健康状态）
- Dashboard 指标卡：4 列 → 2 列网格
- Documents 列表：表格 → 卡片堆叠（隐藏 Pages、Date 列）
- KG Explorer：三栏 → 图谱全屏，Detail Panel → 底部 Sheet（滑入，高度 60vh）
- Search：左右双栏 → 上下堆叠（Preview Graph 缩小到 200px）

#### CSS 媒体查询关键规则

```css
/* Laptop */
@media (max-width: 1280px) {
  .app { --sidebar-w: 72px; }
  .nav-label, .nav-badge, .sidebar-logo-text { display: none; }
}

/* Tablet */
@media (max-width: 1024px) {
  .app { grid-template-columns: 0 1fr; }
  .sidebar {
    position: fixed; left: 0; top: 0; bottom: 0;
    width: 220px; z-index: 500;
    transform: translateX(-220px);
    transition: transform 0.2s ease;
  }
  .sidebar.open { transform: translateX(0); }
}

/* Mobile */
@media (max-width: 768px) {
  .app { grid-template-rows: 56px 1fr 56px; }
  .sidebar { display: none; }
  .bottom-nav { display: flex; }
  .metrics-grid { grid-template-columns: repeat(2, 1fr); }
}
```

---

## 六、后端接口依赖

GraphRAG Studio 前端依赖以下 25 个 FastAPI 后端接口，服务地址 `http://localhost:8000/api/v1`，统一响应格式 `{code, msg, request_id, data}`：

### A 组：文档管理

| 接口 | 方法 | 路径 | 触发页面 |
|------|------|------|---------|
| 上传文档 | POST | `/documents/upload` | Dashboard Modal, Documents |
| 文档详情 | GET | `/documents/{doc_id}` | Documents |
| 文档列表 | GET | `/documents` | Dashboard（最近5条），Documents（全部） |
| 删除文档 | DELETE | `/documents/{doc_id}` | Documents |

### B 组：Indexing Pipeline

| 接口 | 方法 | 路径 | 触发页面 |
|------|------|------|---------|
| 启动索引 | POST | `/index/start` | Dashboard, Documents |
| 查询任务状态 | GET | `/index/status/{job_id}` | Dashboard（轮询），Documents（轮询） |
| 获取索引结果 | GET | `/index/result/{job_id}` | Documents（完成后） |
| 取消任务 | DELETE | `/index/jobs/{job_id}` | Dashboard, Documents |

### C 组：知识图谱

| 接口 | 方法 | 路径 | 触发页面 |
|------|------|------|---------|
| 节点列表 | GET | `/kg/nodes` | KG Explorer（初始化） |
| 边列表 | GET | `/kg/edges` | KG Explorer（初始化） |
| 节点详情 | GET | `/kg/nodes/{node_id}` | KG Explorer（点击），Chat（hover），Search |
| 节点邻居 | GET | `/kg/nodes/{node_id}/neighbors` | KG Explorer（Detail Panel），Search（Preview） |
| 图谱统计 | GET | `/kg/stats` | KG Explorer |
| 导出图谱 | GET | `/kg/export` | KG Explorer（工具栏） |

### D 组：QA 问答

| 接口 | 方法 | 路径 | 触发页面 |
|------|------|------|---------|
| 同步问答 | POST | `/query` | Chat（发送消息） |
| 批量问答 | POST | `/query/batch` | — |
| 批量状态 | GET | `/query/batch/{batch_id}` | — |
| 历史查询 | GET | `/query/history` | Chat（历史列表） |

### E 组：搜索

| 接口 | 方法 | 路径 | 触发页面 |
|------|------|------|---------|
| 实体搜索 | GET | `/search/entities` | Header（全局搜索），KG Explorer（工具栏），Search Tab1 |
| 路径搜索 | GET | `/search/path` | Search Tab2 |
| 子图搜索 | GET | `/search/graph` | Search Tab3 |

### F 组：系统

| 接口 | 方法 | 路径 | 触发页面 |
|------|------|------|---------|
| 健康检查 | GET | `/health` | Dashboard（Health 面板），Header（健康状态） |
| 系统统计 | GET | `/system/stats` | Dashboard（指标卡） |
| 支持格式 | GET | `/system/formats` | Documents（格式说明） |
| Demo 数据 | GET | `/system/demo` | Dashboard（Demo 按钮） |

### 错误码处理规范

| code | 含义 | 前端处理 |
|------|------|---------|
| 0 | 成功 | 正常渲染数据 |
| 1001 | 参数校验失败 | 行内表单错误提示 |
| 1002 | 文件格式不支持 | 文件名标红 + 行内说明 |
| 1003 | 文件超过大小限制 | 同上 |
| 1004 | 文件不存在 | Toast.error |
| 2001 | Job 不存在 | Toast.error + 刷新列表 |
| 2002 | Job 仍在运行 | Toast.warning（防重复启动） |
| 2003 | Job 已完成 | Toast.info |
| 2004 | Job 取消失败 | Toast.error |
| 3001 | 节点不存在 | Toast.error |
| 3002 | KG 为空 | 页面空状态引导（不弹 Toast） |
| 4001 | QA 执行失败 | Toast.error + 输入框恢复 |
| 5000 | 服务器内部错误 | Toast.error("Server error") |

---

## 七、非功能性需求

### 7.1 性能要求

| 指标 | 要求 |
|------|------|
| 页面切换（SPA 路由） | < 100ms |
| D3 图谱初始渲染（40 节点，780 边） | < 500ms |
| API 请求超时设置 | 普通接口 30s，QA 接口 60s |
| KG 节点轮询最小间隔 | 3s |
| Dashboard 刷新间隔 | 10s |
| 全局搜索建议 debounce | 300ms |
| D3 图谱性能阈值 | ≤ 500 节点使用 SVG；> 500 节点切换 Canvas 渲染 |

### 7.2 兼容性要求

| 维度 | 要求 |
|------|------|
| 浏览器 | Chrome 90+ / Edge 90+ / Firefox 88+ / Safari 14+ |
| 屏幕分辨率 | 最低 1024×768，推荐 1440×900 以上 |
| 屏幕像素比 | 支持 1x / 2x（Retina） |
| JavaScript | 无构建工具，原生 ES2020+（使用 CDN） |

### 7.3 可访问性（Accessibility）

- 所有交互元素支持键盘导航（Tab / Enter / Esc）
- 图标按钮提供 `aria-label` 说明
- 颜色对比度符合 WCAG 2.1 AA 标准（文字：≥ 4.5:1）
- Toast 通知区域添加 `aria-live="polite"`

### 7.4 安全性

- API 请求不包含敏感数据（API Key 存于后端 `.env`，不暴露至前端）
- 上传文件客户端预校验格式与大小（后端二次校验）
- XSS 防护：Chat 页 AI 答案通过 marked.js 的 sanitize 选项过滤

---

## 八、验收标准

### 8.1 功能验收

| 编号 | 验收项 | 验收标准 |
|------|-------|---------|
| F-01 | 文件上传 | 支持 9 种格式，200MB 以内；拖拽和点击均可触发；校验失败行内提示 |
| F-02 | 索引任务 | 启动后每 3s 更新进度；stage 文字正确反映当前阶段；完成后展示结果摘要 |
| F-03 | 任务取消 | 点击 [✕] 确认后任务终止，状态回退到 uploaded |
| F-04 | KG 图谱渲染 | 节点颜色、大小按规则渲染；边透明度 0.25；力模拟稳定 |
| F-05 | 节点高亮 | 点击节点后非焦点节点 opacity 变 0.1，相连边 opacity 0.8 |
| F-06 | Detail Panel | 点击节点后出现，显示属性+邻居；点击空白处收起 |
| F-07 | QA 问答 | 发送问题后 thinking 动画出现；响应后 Markdown 渲染正确 |
| F-08 | Tool Call 展示 | 默认收起；展开后每步 tool name / input / output 完整显示 |
| F-09 | Cited Nodes | 显示为可点击标签；点击跳转 `#/graph?node=xxx` |
| F-10 | 实体搜索 | 输入关键词后返回结果；点击结果行渲染 Preview Graph |
| F-11 | 路径搜索 | 选择两个节点后返回路径；路径可视化正确 |
| F-12 | 跨页联动 | 所有 11 条跨页导航路径携带正确 URL 参数且被接收页正确处理 |
| F-13 | Toast 通知 | 4 种类型正确显示；4s 后自动消失；最多同时显示 3 条 |
| F-14 | 空状态引导 | KG 无数据时显示引导 UI；文档列表为空时上传区突出 |
| F-15 | 响应式布局 | 在 1024px 以上显示完整布局；768px 以下切换底部 Tab Bar |

### 8.2 性能验收

- 页面切换动画流畅（60fps）
- D3 图谱 40 节点 + 780 边在 500ms 内完成初始渲染
- 轮询机制不导致内存泄漏（离开页面时清除所有 timer）

### 8.3 API 覆盖验收

所有 25 个后端 API 端点在前端代码中均有明确的调用时机，且均通过 `api.js` 封装层调用，错误统一由 `APIError` 捕获处理。

---

## 附录

### A. 技术栈汇总

| 层次 | 技术 | 版本 | 引入方式 |
|------|------|------|---------|
| 前端框架 | 原生 HTML/CSS/JS | ES2020+ | — |
| 图形渲染 | D3.js | v7 | CDN |
| Markdown 渲染 | marked.js | v9 | CDN |
| 后端框架 | FastAPI | 0.104+ | Python venv |
| ASGI 服务器 | Uvicorn | 0.24+ | Python venv |
| PDF 解析 | MinerU | 最新稳定版 | subprocess |
| 实体抽取 | LangExtract + DeepSeek | — | Direct import |
| 知识问答 | LangChain + DeepSeek | 0.2+ | Direct import |
| 图计算 | NetworkX | 3.x | Python venv |

### B. 文件交付清单

| 类型 | 路径 | 说明 |
|------|------|------|
| 规范文档 | `docs/backend_service_specification-v1.0.md` | FastAPI 后端 25 个接口规范 |
| 规范文档 | `docs/frontend_design_specification-v1.0.md` | 前端 SPA 设计规范（5 页面） |
| 规范文档 | `docs/product_requirements_document-v1.0.md` | 本文档（产品需求文档） |
| 前端入口 | `graphrag_pipeline/static/app/index.html` | SPA 主入口（待实现） |
| 前端样式 | `graphrag_pipeline/static/app/css/` | 3 个 CSS 文件（待实现） |
| 前端逻辑 | `graphrag_pipeline/static/app/js/` | 7 个 JS 文件（待实现） |
| 后端服务 | `graphrag_pipeline/api_server.py` | FastAPI 主入口（待实现） |

### C. 词汇表

| 术语 | 说明 |
|------|------|
| GraphRAG | 知识图谱增强的 RAG（检索增强生成）系统 |
| KG | Knowledge Graph，知识图谱 |
| Entity | 实体，知识图谱中的节点，包含名称、类型、页码、置信度等属性 |
| Relation | 关系，知识图谱中的边，当前版本固定为 `CO_OCCURS_IN`（共现关系） |
| MinerU | 文档解析工具，将 PDF/DOCX 等格式解析为结构化文本 |
| LangExtract | 基于 LLM 的实体抽取框架 |
| Agentic-RAG | 基于 ReAct 框架的智能问答，LLM 通过多步工具调用推理 |
| ReAct | Reasoning + Acting，推理与行动交替的 Agent 模式 |
| Job | 索引任务，一个文档的完整 parsing → extracting → indexing 流程 |
| SPA | Single Page Application，单页应用 |
| Hash 路由 | 通过 URL 的 `#` 部分控制页面切换，无需服务端路由 |
| Cited Nodes | QA 答案中引用的知识图谱节点，可点击跳转至图谱 |
| Tool Call | Agentic-RAG 中 LLM 调用的工具函数（如 search_entities） |
