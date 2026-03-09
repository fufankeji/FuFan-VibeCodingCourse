# GraphRAG Studio — 前端 Web 系统设计规范 v1.0

> 基于 `docs/backend_service_specification-v1.0.md` 接口规范
> 前端架构：原生 HTML + CSS + JS + D3.js v7（SPA，零构建依赖）
> 更新日期：2026-03-05

---

## 目录

- [一、总体架构](#一总体架构)
- [二、设计语言与风格系统](#二设计语言与风格系统)
- [三、整体布局](#三整体布局)
- [四、页面清单与详细设计](#四页面清单与详细设计)
  - [Page 1 — Dashboard](#page-1--dashboard-dashboard)
  - [Page 2 — Document Manager](#page-2--document-manager-documents)
  - [Page 3 — KG Explorer](#page-3--kg-explorer-graph)
  - [Page 4 — QA Chat](#page-4--qa-chat-chat)
  - [Page 5 — Search](#page-5--search-search)
- [五、响应式设计规范](#五响应式设计规范)
- [六、关键交互模式规范](#六关键交互模式规范)
- [七、文件结构](#七文件结构)

---

## 一、总体架构

### 1.1 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| 应用类型 | **SPA（单页应用）** | 5 页无缝切换，无刷新体验 |
| 路由 | **Hash 路由**（原生 JS） | 无需构建工具，`#/dashboard` `#/documents` 等 |
| 框架 | **原生 HTML + CSS + JS** | 与现有 `index.html` 一致，零构建依赖，直接在浏览器运行 |
| 图形渲染 | **D3.js v7**（CDN） | 复用现有 KG 可视化逻辑（`graphrag_pipeline/static/index.html`） |
| Markdown 渲染 | **marked.js v9**（CDN） | Chat 页 AI 答案 Markdown 渲染 |
| API 通信 | **Fetch API** | 原生支持，封装统一错误处理 |
| 图标 | **Unicode / SVG 内联** | 零依赖（无需图标库 CDN） |

### 1.2 路由设计

```
hash 路由 → DOM 区域显示/隐藏

#/dashboard   → 显示 <section id="page-dashboard">
#/documents   → 显示 <section id="page-documents">
#/graph       → 显示 <section id="page-graph">   + 初始化 D3
#/chat        → 显示 <section id="page-chat">
#/search      → 显示 <section id="page-search">
/             → 重定向到 #/dashboard
```

**URL 参数传递（hash query）：**
```
#/graph?doc_id=abc12345      → KG Explorer 按文档筛选
#/graph?node=tech_graphrag_0 → KG Explorer 聚焦节点
#/chat?q=What+is+GraphRAG   → Chat 预填问题
```

### 1.3 全局状态管理

```js
// app.js 中维护的全局状态（内存）
const AppState = {
  currentPage: 'dashboard',
  kg: {
    nodes: [],          // 全量节点（加载后缓存）
    edges: [],          // 全量边（加载后缓存）
    loaded: false,
  },
  documents: [],        // 文档列表缓存
  activeJobs: {},       // job_id → polling timer
  chatHistory: [],      // 当前会话消息历史
  health: null,         // 最近一次 health 响应
};
```

### 1.4 API 客户端（`api.js`）

```js
const API = {
  BASE: 'http://localhost:8000/api/v1',

  async get(path, params = {}) {
    const url = new URL(this.BASE + path);
    Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
    const res = await fetch(url);
    const json = await res.json();
    if (json.code !== 0) throw new APIError(json.code, json.msg);
    return json.data;
  },

  async post(path, body = {}) {
    const res = await fetch(this.BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json.code !== 0) throw new APIError(json.code, json.msg);
    return json.data;
  },

  async postForm(path, formData) {
    const res = await fetch(this.BASE + path, { method: 'POST', body: formData });
    const json = await res.json();
    if (json.code !== 0) throw new APIError(json.code, json.msg);
    return json.data;
  },

  async delete(path) { ... },

  // 轮询直到条件满足
  async poll(path, params = {}, interval = 3000, until = (d) => d.status === 'done') {
    return new Promise((resolve, reject) => {
      const timer = setInterval(async () => {
        try {
          const data = await this.get(path, params);
          if (until(data)) { clearInterval(timer); resolve(data); }
          if (data.status === 'failed') { clearInterval(timer); reject(new Error(data.error)); }
        } catch (e) { clearInterval(timer); reject(e); }
      }, interval);
    });
  }
};
```

### 1.5 文件结构

```
graphrag_pipeline/static/
├── index.html               # 保留（旧 Flask KG 可视化，向后兼容）
└── app/
    ├── index.html           # SPA 主入口（GraphRAG Studio）
    ├── css/
    │   ├── variables.css    # CSS 变量（颜色 / 间距 / 字体）
    │   ├── base.css         # Reset + 通用组件（btn, badge, card, modal...）
    │   └── layout.css       # Sidebar + Header + Footer 布局 + 响应式
    └── js/
        ├── app.js           # 路由器 + 页面切换 + 全局状态
        ├── api.js           # Fetch 封装（baseURL, 统一错误处理）
        ├── components.js    # Toast / Modal / Progress / Skeleton
        └── pages/
            ├── dashboard.js
            ├── documents.js
            ├── graph.js     # D3 力导向图（基于现有 index.html 重构）
            ├── chat.js
            └── search.js
```

---

## 二、设计语言与风格系统

### 2.1 调色板（基于现有 index.html 扩展）

```css
:root {
  /* ── 背景层级 ── */
  --bg-base:     #0f1117;   /* 页面底色 */
  --bg-s1:       #161b22;   /* sidebar / header / card surface */
  --bg-s2:       #21262d;   /* hover state / input bg / tag bg */
  --bg-s3:       #1c2128;   /* tooltip / popover / code bg */

  /* ── 边框 ── */
  --border:      #30363d;
  --border-muted:#21262d;

  /* ── 文字 ── */
  --text-1:      #f0f6fc;   /* 主文字 */
  --text-2:      #c9d1d9;   /* 正文 */
  --text-3:      #8b949e;   /* 辅助/label */
  --text-4:      #484f58;   /* placeholder / 极弱 */

  /* ── 强调色 ── */
  --blue:        #58a6ff;   /* 链接 / 激活 / 聚焦 / 进度条 */
  --green:       #3fb950;   /* 成功 / indexed 状态 */
  --green-btn:   #238636;   /* 主操作按钮背景 */
  --green-hover: #2ea043;   /* 主按钮 hover */
  --red:         #f85149;   /* 错误 / 危险 / failed */
  --yellow:      #d29922;   /* 警告 / indexing */
  --purple:      #8957e5;   /* 紫色强调 */

  /* ── 实体类型颜色（与 D3 图谱一一对应）── */
  --type-tech:   #58a6ff;   /* TECHNOLOGY  — 蓝 */
  --type-concept:#bc8cff;   /* CONCEPT     — 紫 */
  --type-person: #3fb950;   /* PERSON      — 绿 */
  --type-org:    #ff7b72;   /* ORGANIZATION— 红 */
  --type-loc:    #ffa657;   /* LOCATION    — 橙 */

  /* ── 字体 ── */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;

  /* ── 圆角 ── */
  --r-sm: 4px;
  --r-md: 6px;
  --r-lg: 8px;
  --r-xl: 12px;

  /* ── 阴影 ── */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.4);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.5);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.6);

  /* ── 过渡 ── */
  --transition: 150ms ease;
}
```

### 2.2 按钮规范（4 变体）

| 变体 | 背景 | 边框 | 文字 | 用途 |
|------|------|------|------|------|
| `.btn-primary` | `--green-btn` | `--green-btn` | `#fff` | 主操作（Upload, Send, Index） |
| `.btn-secondary` | `--bg-s2` | `--border` | `--text-2` | 次要操作（Cancel, Filter） |
| `.btn-ghost` | transparent | none | `--text-3` | 内联操作（图标按钮） |
| `.btn-danger` | `--bg-s2` | `--border` | `--red` | 危险操作（Delete） |

```css
.btn {
  padding: 6px 14px;
  border-radius: var(--r-md);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition);
  display: inline-flex; align-items: center; gap: 6px;
}
.btn-primary { background: var(--green-btn); border: 1px solid var(--green-btn); color: #fff; }
.btn-primary:hover { background: var(--green-hover); }
.btn-sm { padding: 4px 10px; font-size: 12px; }
```

### 2.3 Status Badge 规范

```css
/* 通用 badge */
.badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 11px; font-weight: 600;
}

/* 状态 badge */
.badge-indexed   { background: #1a3a22; color: var(--green); }
.badge-indexing  { background: #2d2a16; color: var(--yellow); }
.badge-uploaded  { background: var(--bg-s3); color: var(--text-3); }
.badge-failed    { background: #3b1a1a; color: var(--red); }

/* 实体类型 badge */
.badge-TECHNOLOGY   { background: #162032; color: var(--type-tech); }
.badge-CONCEPT      { background: #1e1632; color: var(--type-concept); }
.badge-PERSON       { background: #132318; color: var(--type-person); }
.badge-ORGANIZATION { background: #2e1a1a; color: var(--type-org); }
.badge-LOCATION     { background: #2a1e10; color: var(--type-loc); }

/* 活跃点（动画） */
.badge-indexing::before {
  content: ''; width: 6px; height: 6px; border-radius: 50%;
  background: var(--yellow);
  animation: pulse 1.5s infinite;
}
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
```

### 2.4 字体层级

| 层级 | size | weight | color | 用途 |
|------|------|--------|-------|------|
| `text-h1` | 20px | 600 | `--text-1` | 页面大标题 |
| `text-h2` | 16px | 600 | `--text-1` | 区块标题 |
| `text-h3` | 13px | 600 uppercase | `--text-3` | 面板子标题 |
| `text-body` | 14px | 400 | `--text-2` | 正文 |
| `text-sm` | 12px | 400 | `--text-3` | 辅助信息 |
| `text-badge` | 11px | 600 | — | 标签/徽章 |
| `text-mono` | 13px | 400 | `--text-2` | 代码/路径/工具输出 |

---

## 三、整体布局

### 3.1 CSS Grid 骨架

```
┌──────────────────────────────────────────────────────────────┐
│  HEADER  (56px, position: sticky, top: 0, z-index: 100)     │
│  [≡] GraphRAG Studio    [🔍 Search entities...]    [● API]  │
├─────────┬────────────────────────────────────────────────────┤
│         │                                                    │
│ SIDEBAR │         MAIN CONTENT AREA                        │
│ (220px) │         (overflow-y: auto)                       │
│ fixed   │                                                    │
│  ──────  │         — 各页面 <section> 区域 —               │
│  Home   │                                                    │
│  Docs   │                                                    │
│  Graph  │                                                    │
│  Chat   │                                                    │
│  Search │                                                    │
│  ──────  │                                                    │
│  System │                                                    │
│         │                                                    │
├─────────┴────────────────────────────────────────────────────┤
│  STATUS BAR  (32px)    [job 进度]        [v1.0.0] [● ok]   │
└──────────────────────────────────────────────────────────────┘
```

```css
.app {
  display: grid;
  grid-template-areas: "header header" "sidebar main" "footer footer";
  grid-template-columns: var(--sidebar-w, 220px) 1fr;
  grid-template-rows: 56px 1fr 32px;
  height: 100vh;
  overflow: hidden;
}
header  { grid-area: header; }
.sidebar{ grid-area: sidebar; overflow-y: auto; }
main    { grid-area: main;   overflow-y: auto; }
footer  { grid-area: footer; }
```

### 3.2 Sidebar 导航结构

```
┌─────────────────────────┐
│  G  GraphRAG Studio     │  ← Logo 区（16px font, weight 700）
├─────────────────────────┤
│  ◈  Dashboard           │  ← 激活状态: bg rgba(88,166,255,0.1), left border 2px #58a6ff
│  ▤  Documents     [  5] │  ← 右侧数量 badge（文档总数）
│  ◉  KG Explorer         │
│  ◇  Chat         [ 50]  │  ← 查询历史数
│  ⊕  Search              │
├─────────────────────────┤
│  ☰  System              │
└─────────────────────────┘
```

```css
.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 16px;
  border-radius: var(--r-md);
  font-size: 14px; color: var(--text-3);
  cursor: pointer; transition: all var(--transition);
  border-left: 2px solid transparent;
  margin: 1px 8px;
}
.nav-item:hover { background: var(--bg-s2); color: var(--text-2); }
.nav-item.active {
  background: rgba(88,166,255,0.1);
  color: var(--blue);
  border-left-color: var(--blue);
}
.nav-badge {
  margin-left: auto;
  background: var(--bg-s2);
  color: var(--text-3);
  font-size: 11px; font-weight: 600;
  padding: 1px 6px;
  border-radius: 10px;
}
```

### 3.3 Header 内容规范

```
┌──────────────────────────────────────────────────────────────┐
│ [≡]  GraphRAG Studio  │  [🔍 Search entities...        ]  │  [● healthy]  API: 8000 │
└──────────────────────────────────────────────────────────────┘
```

| 区域 | 内容 | 说明 |
|------|------|------|
| 左 | `[≡]` 折叠按钮 + Logo 文字 | 点击折叠/展开 sidebar（220px ↔ 72px） |
| 中 | 全局搜索框 | 输入后跳转 `#/search?q={input}`，宽度 max 400px |
| 右 | Health 指示器 + API 地址 | 绿点=healthy, 红点=error |

**全局搜索框触发逻辑：**
- 输入 3+ 字符 → 实时调用 `GET /api/v1/search/entities?q=...&limit=5`
- 下拉展示最多 5 条搜索建议（entity name + type badge）
- 按 Enter → 跳转 `#/search?q={input}`
- 点击建议项 → 跳转 `#/graph?node={node_id}`

### 3.4 Status Bar 内容规范

```
[Indexing paper.pdf... Stage: Extracting entities 2/4   ████████░░ 65%]    v1.0.0  ● healthy
└── 有 active job 时显示                                                    └── 常驻
```

---

## 四、页面清单与详细设计

---

### Page 1 — Dashboard (`#/dashboard`)

**目的：** 系统全局概览，快速导航到各功能，最近活动监控。

#### 4.1.1 布局

```
┌──────────────────────────────────────────────────────────────┐
│  Overview                               [+ Upload & Index]  │
├──────────┬──────────┬──────────┬────────────────────────────┤
│    40    │   780    │    5     │     50                     │
│  Nodes   │  Edges   │  Docs    │   Queries                  │
│  KG 节点  │  KG 边   │ 文档总数  │  问答次数                  │
├──────────┴──────────┴──────────┴────────────────────────────┤
│  System Health                                               │
│  MinerU venv   ● ok      LangExtract venv  ● ok            │
│  DeepSeek API  ● ok      Storage          ● ok            │
├──────────────────────────────────────────────────────────────┤
│  Recent Documents                              [View All →] │
│  ──────────────────────────────────────────────────────────  │
│  paper.pdf      PDF   4p    ● indexed    2026-03-05  [KG]  │
│  report.docx    DOCX  12p   ● indexing   [███░░░ 65%] [✕]  │
│  slides.pptx    PPTX  24p   ● uploaded   ─           [▶]   │
├──────────────────────────────────────────────────────────────┤
│  Quick Actions                                               │
│  [◉ Explore KG]  [◇ Start Chat]  [⊕ Search]  [⚡ Demo]    │
└──────────────────────────────────────────────────────────────┘
```

#### 4.1.2 指标卡设计

```css
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 20px;
}
.metric-card {
  background: var(--bg-s1);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 20px;
  text-align: center;
}
.metric-value { font-size: 32px; font-weight: 700; color: var(--text-1); }
.metric-label { font-size: 12px; color: var(--text-3); margin-top: 4px; }
/* 悬停时用颜色区分不同指标 */
.metric-card:nth-child(1) .metric-value { color: var(--blue); }    /* Nodes */
.metric-card:nth-child(2) .metric-value { color: var(--purple); }  /* Edges */
.metric-card:nth-child(3) .metric-value { color: var(--green); }   /* Docs */
.metric-card:nth-child(4) .metric-value { color: var(--yellow); }  /* Queries */
```

#### 4.1.3 API 调用时机

| 调用 | 时机 | 接口 |
|------|------|------|
| 加载指标卡 | 页面初始化 | `GET /api/v1/system/stats` |
| 加载 Health | 页面初始化 | `GET /api/v1/health` |
| 加载最近文档 | 页面初始化 | `GET /api/v1/documents?page=1&page_size=5` |
| 轮询刷新 | 每 10 秒 | `GET /api/v1/system/stats` + `GET /api/v1/health` |
| 行内启动 Index | 点击 `[▶]` | `POST /api/v1/index/start` |
| 行内 Index 进度 | 启动后每 3s | `GET /api/v1/index/status/{job_id}` |

#### 4.1.4 交互逻辑

- `[+ Upload & Index]` → 打开 Upload Modal（同 Documents 页上传区），完成后刷新列表
- `[KG]` → 跳转 `#/graph?doc_id={doc_id}`
- `[▶]` → 行内启动 indexing，进度条替换操作按钮，轮询进度
- `[✕]` → 取消正在运行的 indexing job
- `[Explore KG]` → `#/graph`
- `[Start Chat]` → `#/chat`
- `[Search]` → `#/search`
- `[Demo]` → 调用 `GET /api/v1/system/demo`，将数据存入 `AppState.kg`，跳转 `#/graph`

---

### Page 2 — Document Manager (`#/documents`)

**目的：** 文件上传、列表管理、触发/监控索引任务、查看索引结果。

#### 4.2.1 布局

```
┌──────────────────────────────────────────────────────────────┐
│  Documents (5)                             [+ Upload Files] │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │         ⬆                                            │  │
│  │    Drag & Drop files here                            │  │
│  │    PDF · DOCX · DOC · PPTX · PPT · PNG · JPG · HTML │  │
│  │    Max 200MB per file                                │  │
│  │                  [Browse Files]                      │  │
│  └──────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│  [All ▾]  [Status: All ▾]  [🔍 Filter docs...]             │
├──────────────────────────────────────────────────────────────┤
│  Filename            Format  Pages  Status       Date  Act  │
│ ────────────────────────────────────────────────────────    │
│  paper.pdf           PDF      4    ●indexed    03-05  [◉][🗑]│
│                                                             │
│  report.docx         DOCX    12    ●indexed    03-04  [◉][🗑]│
│  ▼ 40 nodes · 780 edges · 4p · 45 ext · 42.1s            │
│    Types: TECHNOLOGY(4) CONCEPT(36)  [View KG] [Show Ext]  │
│                                                             │
│  processing.pptx     PPTX    24    ●indexing        [✕]   │
│  Stage: Extracting entities page 2/4...                    │
│  ████████████░░░░░░░░░░  45%  (18s)                        │
│                                                             │
│  image.png           PNG      1    ●uploaded   03-03  [▶][🗑]│
│                                                             │
│  failed.pdf          PDF      -    ●failed     03-02  [⟳][🗑]│
│  Error: MinerU failed: timeout after 600s                  │
└──────────────────────────────────────────────────────────────┘
```

#### 4.2.2 上传区交互

```
拖拽行为:
  dragenter → 上传区边框变蓝 (#58a6ff)，背景 rgba(88,166,255,0.05)
  dragleave → 恢复默认
  drop → 提取 event.dataTransfer.files，验证后开始上传

客户端预校验（drop / browse 后立即执行）:
  1. 扩展名检查（对照 ALLOWED_EXTENSIONS 列表）
  2. 文件大小 ≤ 200MB
  → 校验失败: Toast 错误 + 文件名标红（不上传）
  → 校验通过: 开始上传流程

多文件串行处理:
  files[] → 逐一执行 Upload → IndexStart → Poll 流程
  同时上传时显示队列状态
```

#### 4.2.3 上传 + 索引完整流程

```
Step 1: POST /api/v1/documents/upload (multipart/form-data)
        ↓ 返回 doc_id
        行项目添加到列表，status: "uploaded"

Step 2: 询问确认 "Start indexing now? [Yes] [Later]"
        → Yes: 继续 Step 3
        → Later: 保持 "uploaded" 状态，显示 [▶] 按钮

Step 3: POST /api/v1/index/start { doc_id }
        ↓ 返回 job_id
        status → "indexing"，显示进度条

Step 4: 轮询 GET /api/v1/index/status/{job_id}（每 3s）
        progress.parsed_pages / total_pages → 进度百分比
        stage → 行内文字说明

Step 5: status=done:
        GET /api/v1/index/result/{job_id} → 获取 stats
        更新 status → "indexed"
        展开结果摘要行（节点数/边数/耗时）
        Toast: "✅ paper.pdf indexed: 40 nodes, 780 edges"
        AppState.kg.loaded = false （触发 KG Explorer 重新加载）
```

#### 4.2.4 索引结果展开行

```
▼ [展开]
  40 nodes · 780 edges · 4 pages · 45 extractions · 42.1s
  TECHNOLOGY(4)  CONCEPT(36)
  [◉ View in KG]  [≡ Show Extractions]

[Show Extractions] 展开面板:
  text           type         alignment     page
  ────────────────────────────────────────────
  GraphRAG       TECHNOLOGY   match_exact   0
  knowledge...   CONCEPT      match_exact   0
  MinerU         TECHNOLOGY   match_exact   1
  ...（滚动，最多显示 50 条）
```

---

### Page 3 — KG Explorer (`#/graph`)

**目的：** 全屏交互式知识图谱可视化，节点筛选与详情查看。

#### 4.3.1 布局（三栏）

```
┌─────────────┬───────────────────────────────────┬─────────────┐
│ FILTER      │    D3 FORCE-DIRECTED GRAPH         │ DETAIL      │
│ (280px)     │    (flex:1)                        │ (300px)     │
│             │    ← 点击节点后出现 →               │             │
│ ─ Docs ─── │                                    │ [× Close]   │
│ [All Docs ▾]│     ●GraphRAG ─────── ●LLMs       │             │
│             │    / │  \                         │ ┄ GraphRAG  │
│ ─ Types ── │   ●  ●   ●                        │   TECHNOLOGY│
│ ☑ TECH  (4) │                                    │ ──────────  │
│ ☑ CONC (36) │        [+ ][ -][⊡]               │ Page:     0 │
│ ☑ PERS  (0) │        [🔍 Search node...]         │ Conf: exact │
│ ☑ ORG   (0) │                                    │ Degree:  39 │
│ ☑ LOC   (0) │                                    │ Central: 1.0│
│             │                                    │ ──────────  │
│ ─ Confidence│                                    │ Neighbors   │
│ ☑ exact     │  [图例]                             │ (39 total)  │
│ ☑ greater   │  ●TECH ●CONC ●PERS ●ORG ●LOC     │ ●knowledge  │
│ ☑ lesser    │                                    │ ●LLMs       │
│ □ fuzzy     │                                    │ ●MinerU     │
│             │                                    │ [All 39 →]  │
│ ─ Export ── │                                    │             │
│ [📷 PNG]    │                                    │ [💬 Ask AI] │
│ [⬇ JSON]   │                                    │             │
└─────────────┴───────────────────────────────────┴─────────────┘
```

#### 4.3.2 D3 力导向图规范

**节点视觉映射：**

| 属性 | 映射规则 |
|------|---------|
| 颜色 | entity type → 5 色（`--type-tech/concept/person/org/loc`） |
| 半径 | `r = Math.max(4, Math.log(degree + 1) * 4)` |
| 描边 | 正常: `1.5px same-color opacity 0.6`；hover: `2.5px white` |
| 透明度 | 正常: `0.9`；非聚焦（highlight 时）: `0.1` |

**边视觉映射：**

| 属性 | 规则 |
|------|------|
| 颜色 | `#30363d` |
| 透明度 | 正常 `0.25`；高亮节点相关边 `0.8` |
| 宽度 | `1px` |

**Force 参数：**

```js
d3.forceSimulation(nodes)
  .force('link',   d3.forceLink(edges).id(d => d.id).distance(60).strength(0.3))
  .force('charge', d3.forceManyBody().strength(-120))
  .force('center', d3.forceCenter(width / 2, height / 2))
  .force('collide', d3.forceCollide().radius(d => d.r + 4))
  .alphaDecay(0.02)
```

**交互事件：**

```
node.mouseover → 显示 Tooltip（name + type + page + conf + degree）
node.click     → 右侧 Detail Panel 展开
                  高亮该节点（r 增大 1.5x）
                  相连边 opacity 0.8，其余节点 opacity 0.1
canvas.click   → 取消选中，Detail Panel 收起，恢复所有透明度
node.drag      → pin 到固定位置（fx/fy 设置）
zoom           → d3.zoom().scaleExtent([0.1, 8])
```

**工具栏功能：**

```
[+]        → transform.k * 1.3 (zoom in)
[-]        → transform.k / 1.3 (zoom out)
[⊡ Fit]   → fitToView()：计算节点范围，自动缩放和平移
[🔍]       → search input: GET /api/v1/search/entities?q=...
              找到节点 → 闪烁高亮 + 平移居中
[📷 PNG]  → html2canvas 或 SVG → PNG download
[⬇ JSON] → GET /api/v1/kg/export → 触发文件下载
```

#### 4.3.3 URL 参数处理

```js
// graph.js 初始化时解析
const params = new URLSearchParams(window.location.hash.split('?')[1]);
const docFilter = params.get('doc_id');   // 按文档筛选
const nodeHighlight = params.get('node'); // 聚焦节点

if (docFilter) {
  // 勾选对应 doc 的 checkbox，其余节点淡化
}
if (nodeHighlight) {
  // 找到对应节点，高亮 + Detail Panel 展开 + 平移居中
}
```

#### 4.3.4 API 调用时机

| 调用 | 时机 | 接口 |
|------|------|------|
| 加载全量节点 | 页面初始化（优先读缓存） | `GET /api/v1/kg/nodes?page_size=200` |
| 加载全量边 | 页面初始化 | `GET /api/v1/kg/edges?page_size=500` |
| 节点详情 | 点击节点 | `GET /api/v1/kg/nodes/{node_id}` |
| 邻居列表 | 点击节点 | `GET /api/v1/kg/nodes/{node_id}/neighbors?hops=1` |
| 工具栏搜索 | 输入 2+ 字符，500ms debounce | `GET /api/v1/search/entities?q=...` |

> **性能说明：** 当前 KG 为 40 节点 + 780 边，D3 可流畅渲染。若节点超过 500，启用 Canvas 渲染模式（D3 WebGL fallback）。

---

### Page 4 — QA Chat (`#/chat`)

**目的：** 多轮 KG 问答，可视化 ReAct 推理过程，Cited Node 跳转联动。

#### 4.4.1 布局（双栏）

```
┌──────────────────┬────────────────────────────────────────────┐
│ HISTORY  (240px) │  CHAT AREA                                 │
│                  │                                            │
│ [+ New Chat]     │  ── Welcome ──────────────────────────── ─│
│                  │  KG Assistant                              │
│ ─ Today ──────  │  Ask me anything about the knowledge       │
│ What is GraphRAG │  graph. Try one of the suggestions below. │
│ How does MinerU  │  [💡 Give me an overview of the KG]       │
│                  │  [💡 List all TECHNOLOGY entities]        │
│ ─ Yesterday ─── │  [💡 How does GraphRAG relate to LLMs?]   │
│ List all tech... │                                            │
│                  │  ─── 2026-03-05 10:30 ────────────────── │
│                  │                                            │
│                  │  YOU                              10:30   │
│                  │  What is GraphRAG and how does it          │
│                  │  relate to knowledge graphs?               │
│                  │                                            │
│                  │  KG ASSISTANT                     10:30   │
│                  │  GraphRAG is a knowledge graph-            │
│                  │  enhanced RAG system developed by          │
│                  │  Microsoft Research...                     │
│                  │                                            │
│                  │  ▶ Tool Calls (2 steps)  [展开]           │
│                  │                                            │
│                  │  Cited: [GraphRAG] [knowledge graphs]      │
│                  │          [LLMs] [retrieval-augmented...]  │
│                  │                   ↑ 点击跳转 KG Explorer  │
│                  │  ⏱ 8.4s                                   │
│                  ├────────────────────────────────────────────┤
│                  │  [Ask about the knowledge graph...  ][▶]  │
└──────────────────┴────────────────────────────────────────────┘
```

#### 4.4.2 消息气泡设计

```css
/* 用户消息（右对齐） */
.msg-user {
  align-self: flex-end;
  background: var(--blue);
  color: #fff;
  border-radius: var(--r-lg) var(--r-lg) var(--r-sm) var(--r-lg);
  padding: 10px 14px;
  max-width: 70%;
  font-size: 14px;
}

/* AI 消息（左对齐） */
.msg-assistant {
  align-self: flex-start;
  background: var(--bg-s1);
  border: 1px solid var(--border);
  border-radius: var(--r-sm) var(--r-lg) var(--r-lg) var(--r-lg);
  padding: 12px 16px;
  max-width: 85%;
}

/* 消息内 Markdown 渲染 */
.msg-assistant .answer-text {
  font-size: 14px; line-height: 1.7; color: var(--text-2);
  /* 使用 marked.js 渲染 */
}
```

#### 4.4.3 Tool Call 展开面板

```
▶ Tool Calls (2 steps)    [展开 ▾ / 收起 ▲]

── Step 1: search_entities ─────────────────────────────
Input:
  { "query": "GraphRAG" }
Output:
  Found 1 entity(ies) matching 'GraphRAG':
    [TECHNOLOGY] "GraphRAG" (confidence=match_exact, page=0, id=tech_graphrag_0)

── Step 2: get_neighbors ────────────────────────────────
Input:
  { "entity_name": "GraphRAG", "hops": 1 }
Output:
  Neighbors of 'GraphRAG' [TECHNOLOGY] within 1 hop(s):
  Hop 1 — 39 related entities:
    [CONCEPT] knowledge graphs
    [TECHNOLOGY] LLMs
    ...
```

```css
.tool-calls-panel {
  background: var(--bg-s3);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  margin: 8px 0;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-3);
  overflow: hidden;
}
.tool-call-step {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-muted);
}
.tool-call-name { color: var(--yellow); font-weight: 600; }
.tool-call-section { color: var(--text-4); margin-top: 4px; }
```

#### 4.4.4 Cited Nodes 设计

```
Cited: [◉ GraphRAG] [◉ knowledge graphs] [◉ LLMs] ...
           ↑ 点击 → window.location.hash = '#/graph?node=' + node_id
           ↑ hover → 小 Tooltip 显示节点 type
```

```css
.cited-node-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--bg-s2);
  color: var(--blue);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition);
}
.cited-node-chip:hover {
  background: rgba(88,166,255,0.15);
  border-color: var(--blue);
}
```

#### 4.4.5 Thinking 动画

```html
<div class="thinking-indicator">
  <span></span><span></span><span></span>
</div>
```

```css
.thinking-indicator span {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--text-3);
  display: inline-block;
  animation: thinking 1.4s infinite;
}
.thinking-indicator span:nth-child(2) { animation-delay: 0.2s; }
.thinking-indicator span:nth-child(3) { animation-delay: 0.4s; }
@keyframes thinking { 0%,80%,100%{transform:scale(0.7)}40%{transform:scale(1)} }
```

#### 4.4.6 API 调用时机

| 调用 | 时机 | 接口 |
|------|------|------|
| 发送问题 | 点击 Send / Enter | `POST /api/v1/query` |
| 加载历史列表 | 进入 Chat 页 | `GET /api/v1/query/history?page_size=20` |
| Cited Node 悬停 | mouseover 时 | `GET /api/v1/kg/nodes/{node_id}`（可缓存） |

**多轮对话 history 维护（前端）：**

```js
// 每次发送携带完整历史
const payload = {
  question: inputText,
  history: AppState.chatHistory.flatMap(msg => [
    { role: 'human', content: msg.question },
    { role: 'ai', content: msg.answer }
  ])
};
const result = await API.post('/query', payload);
AppState.chatHistory.push(result);
```

---

### Page 5 — Search (`#/search`)

**目的：** 多模式知识图谱搜索（实体关键词 / 路径 / 子图）。

#### 4.5.1 布局

```
┌──────────────────────────────────────────────────────────────┐
│  Search Knowledge Graph                                      │
│  ┌──────────────────────────────────┐ [Type: All ▾] [Search]│
│  │  🔍 Enter entity name...         │                       │
│  └──────────────────────────────────┘                       │
├──────────────────────────────────────────────────────────────┤
│  [Entity Search ▌]  [Path Search]  [Graph Search]           │
├──────────────────────────┬───────────────────────────────────┤
│ Results (2)              │  Preview Graph                   │
│ ─────────────────        │  ──────────────                  │
│ ┌────────────────────┐  │                                   │
│ │ GraphRAG           │  │    ●GraphRAG                      │
│ │ TECHNOLOGY    pg.0 │  │   ╱│╲                            │
│ │ Degree: 39 · exact │  │  ● ● ●                           │
│ │ [View KG] [Chat]   │  │  ↑ D3 mini-graph                 │
│ ├────────────────────┤  │  (当前选中节点的1-hop邻居子图)      │
│ │ GraphRAG pipeline  │  │                                   │
│ │ CONCEPT       pg.1 │  │                                   │
│ │ Degree: 39 · exact │  │                                   │
│ │ [View KG] [Chat]   │  │                                   │
│ └────────────────────┘  │                                   │
└──────────────────────────┴───────────────────────────────────┘
```

#### 4.5.2 Tab — Path Search

```
From: [🔍 GraphRAG...        ▾]   To: [🔍 LLMs...          ▾]   Hops: [3▾]  [Find Path]

─── Results: 1 path found (length 1) ───
  GraphRAG ──CO_OCCURS_IN──→ LLMs

─── Visualization ───
  ●GraphRAG ───────────────── ●LLMs
  (节点颜色 = type，边标注 relation)
```

**节点选择器设计：**
```
点击 [🔍] → 展开搜索下拉
输入关键词 → 实时调用 GET /api/v1/search/entities?q=...&limit=10
选择节点 → 记录 node_id，显示名称
```

#### 4.5.3 Tab — Graph Search

```
[retrieval        ]  [☑ Include Neighbors]  [Search]

Found 3 matching nodes · 87 subgraph edges
─────────────────────────────────────
[D3 子图可视化 - 全宽，仅展示匹配节点和邻边]
─────────────────────────────────────
Matched nodes:
  ● retrieval-augmented generation  [CONCEPT]  page 0
  ● RAG systems                     [CONCEPT]  page 0
  ● vector similarity search        [CONCEPT]  page 2
```

#### 4.5.4 搜索框 URL 同步

```
用户修改搜索框 → 更新 hash query: #/search?q={query}&type={type}&tab={tab}
页面初始化 → 解析 hash query → 预填表单 → 自动触发搜索
从 Header 全局搜索跳转 → #/search?q={input}
```

#### 4.5.5 API 调用时机

| 调用 | 时机 | 接口 |
|------|------|------|
| 实体搜索 | 点击 Search / Enter | `GET /api/v1/search/entities?q=...&type=...` |
| 结果 Preview Graph | 点击搜索结果行 | `GET /api/v1/kg/nodes/{id}/neighbors?hops=1` |
| 路径搜索 | 点击 Find Path | `GET /api/v1/search/path?from=...&to=...` |
| 子图搜索 | 点击 Search | `GET /api/v1/search/graph?q=...&include_neighbors=true` |

---

## 五、响应式设计规范

### 5.1 断点定义

| 断点名 | 宽度范围 | 布局策略 |
|--------|---------|---------|
| **Desktop** | > 1280px | 完整布局（Sidebar 220px + 内容 + Detail Panel） |
| **Laptop** | 1024 – 1280px | Sidebar 折叠为图标模式（72px），内容区扩展 |
| **Tablet** | 768 – 1024px | Sidebar 隐藏，汉堡菜单触发 Drawer，内容全屏 |
| **Mobile** | < 768px | 底部 Tab Bar，全屏内容，面板改为底部 Sheet |

### 5.2 CSS 媒体查询框架

```css
/* ── Laptop: Sidebar 折叠 ── */
@media (max-width: 1280px) {
  .app { --sidebar-w: 72px; }
  .nav-label, .nav-badge, .sidebar-logo-text { display: none; }
  .nav-item { justify-content: center; padding: 12px; }
}

/* ── Tablet: Sidebar 变 Drawer ── */
@media (max-width: 1024px) {
  .app { grid-template-columns: 0 1fr; }
  .sidebar {
    position: fixed; left: 0; top: 0; bottom: 0;
    width: 220px; z-index: 500;
    transform: translateX(-220px);
    transition: transform 0.2s ease;
    box-shadow: var(--shadow-lg);
  }
  .sidebar.open { transform: translateX(0); }
  .sidebar-overlay { display: block; }  /* 点击遮罩关闭 */
}

/* ── Mobile: 底部 Tab Bar ── */
@media (max-width: 768px) {
  .app { grid-template-rows: 56px 1fr 56px; }
  .sidebar { display: none; }
  .bottom-nav { display: flex; position: fixed; bottom: 0; ... }

  /* KG Explorer 三栏 → 全屏 */
  .graph-filter-panel { display: none; }
  .graph-detail-panel { position: fixed; bottom: 0; left: 0; right: 0;
                         height: 60vh; border-radius: 16px 16px 0 0; z-index: 400; }

  /* Chat 历史面板 → 顶部 Drawer */
  .chat-history { position: fixed; top: 56px; left: 0; right: 0;
                   height: 50vh; z-index: 400; transform: translateY(-100%); }

  /* 指标卡 4 列 → 2 列 */
  .metrics-grid { grid-template-columns: repeat(2, 1fr); }

  /* Search 结果+预览 → 上下堆叠 */
  .search-results-layout { flex-direction: column; }
}
```

### 5.3 各页面移动端特殊处理

| 页面 | 桌面布局 | 移动端变化 |
|------|---------|---------|
| Dashboard | 4列指标卡 | 2×2 网格 |
| Documents | 表格列表 | 卡片堆叠（隐藏 Pages、Date 列） |
| KG Explorer | 三栏 | 图谱全屏，Filter 通过 FAB 触发底部 Sheet |
| Chat | 双栏 | 历史面板隐藏，顶部 [历史] 按钮触发 Drawer |
| Search | 双栏结果+预览 | 上下堆叠（预览缩小为 200px） |

---

## 六、关键交互模式规范

### 6.1 Toast 通知系统

```
位置: right: 24px; top: 72px (header 下方)
宽度: 320px
堆叠: 最多 3 条，从上往下，间距 8px
```

```
类型视觉:
  ✅ Success  bg #1a3a22  border-left 3px #3fb950  icon ✓
  ⚠️ Warning  bg #2d2a16  border-left 3px #d29922  icon !
  ❌ Error    bg #3b1a1a  border-left 3px #f85149  icon ✗
  ℹ️ Info     bg #161f2e  border-left 3px #58a6ff  icon i

生命周期:
  出现: slide-in from right (200ms ease-out)
  停留: 4000ms（hover 时暂停计时）
  消失: fade-out (300ms) → 从 DOM 移除

调用方式 (components.js):
  Toast.success("paper.pdf indexed: 40 nodes, 780 edges")
  Toast.error("Failed to upload: file too large")
  Toast.info("Loading knowledge graph...")
```

### 6.2 全局 Loading 状态

```
1. Header 进度条（API 请求时）
   height: 2px; position: absolute; top: 0; width: 100%
   颜色: var(--blue)
   短请求: indeterminate animation
   长请求（轮询中）: 真实进度百分比

2. Skeleton Loader（列表加载时）
   模拟行结构的灰色矩形，shimmer 动画
   Document 列表: 3 行 skeleton rows
   Entity 列表: 5 行 skeleton rows

3. 图谱 Loading
   svg 中央显示: "Loading KG... (40 nodes, 780 edges)"
   3 点动画

4. Chat Thinking
   见 4.4.5 三点跳动动画
```

### 6.3 空状态（Empty State）

每个页面无数据时的引导设计：

```
KG Explorer（无 KG 数据）:
  ┌────────────────────────────────────┐
  │         ◉ (大图标)                 │
  │   No knowledge graph yet           │
  │   Upload documents and start       │
  │   indexing to build your KG        │
  │   [Upload & Index →]               │
  └────────────────────────────────────┘

Chat（无问题历史）:
  欢迎页 + Suggested Prompts（见 4.4.1）

Search（无结果）:
  "No entities found for 'query'"
  "Try: different keyword, check KG Explorer"
  [Explore KG]

Documents（无文档）:
  直接聚焦上传区（拖拽提示更突出）
```

### 6.4 错误处理规范

| 错误类型 | 处理方式 |
|---------|---------|
| API code ≠ 0 | Toast.error(msg) + console.error |
| fetch 网络失败 | Toast.error("Network error. Is API server running on :8000?") + [Retry] 按钮 |
| 超时（QA > 60s） | Toast.warning("Request timeout, please try again") |
| code 3002 (KG 为空) | 页面内空状态引导，不弹 Toast |
| code 2001/3001 (不存在) | Toast.error + 刷新当前列表 |
| Indexing failed | 行内展示错误信息 + [⟳ Retry] 按钮 |
| 文件校验失败 | 文件名标红 + inline 错误说明（不弹 Toast） |

### 6.5 页面间联动（Cross-page Navigation）

| 触发位置 | 操作 | 目标 | 参数 |
|---------|------|------|------|
| Dashboard [KG] 按钮 | 点击 | KG Explorer | `#/graph?doc_id={doc_id}` |
| Dashboard [Explore KG] | 点击 | KG Explorer | `#/graph` |
| Dashboard [Demo] | 点击 | KG Explorer | 加载 demo → `#/graph` |
| Documents [◉] 按钮 | 点击 | KG Explorer | `#/graph?doc_id={doc_id}` |
| Chat Cited Node 标签 | 点击 | KG Explorer | `#/graph?node={node_id}` |
| KG Detail Panel [💬] | 点击 | Chat | `#/chat?q=Tell+me+about+{name}` |
| Search 结果 [View KG] | 点击 | KG Explorer | `#/graph?node={node_id}` |
| Search 结果 [Chat] | 点击 | Chat | `#/chat?q=What+is+{name}` |
| Header 全局搜索 | Enter | Search | `#/search?q={input}` |
| Header 全局搜索 | 点击建议项 | KG Explorer | `#/graph?node={node_id}` |

### 6.6 确认对话框规范

```
触发场景: 删除文档、取消 indexing job
样式: 居中 Modal（360px），遮罩层 rgba(0,0,0,0.6)

┌─────────────────────────────────────┐
│  Delete document?                   │
│                                     │
│  "paper.pdf" and all its associated │
│  KG data will be permanently deleted│
│  (40 nodes, 780 edges removed)      │
│                                     │
│                [Cancel] [Delete →]  │
└─────────────────────────────────────┘

[Delete] → bg: --red，hover: #d73a2f
[Cancel] → btn-secondary
```

---

## 七、文件结构

### 7.1 新建文件清单

| 文件路径 | 说明 |
|---------|------|
| `graphrag_pipeline/static/app/index.html` | SPA 主入口，包含 5 个 `<section>` 页面区域，引入所有 CSS/JS |
| `graphrag_pipeline/static/app/css/variables.css` | CSS 变量定义（颜色、字体、圆角、阴影） |
| `graphrag_pipeline/static/app/css/base.css` | Reset + 通用组件样式（btn/badge/card/modal/toast/skeleton） |
| `graphrag_pipeline/static/app/css/layout.css` | 骨架布局（app grid）+ Sidebar + Header + Footer + 响应式 |
| `graphrag_pipeline/static/app/js/app.js` | 路由器 + 全局 AppState + 页面初始化调度 |
| `graphrag_pipeline/static/app/js/api.js` | Fetch 封装 + 错误处理 + 轮询 helper |
| `graphrag_pipeline/static/app/js/components.js` | Toast / Modal / Progress / Skeleton / Tooltip |
| `graphrag_pipeline/static/app/js/pages/dashboard.js` | Dashboard 页面逻辑 |
| `graphrag_pipeline/static/app/js/pages/documents.js` | Documents 页面逻辑（上传 + 索引流程） |
| `graphrag_pipeline/static/app/js/pages/graph.js` | KG Explorer + D3 力导向图（复用现有 index.html） |
| `graphrag_pipeline/static/app/js/pages/chat.js` | Chat 页面逻辑（消息渲染 + 工具链 + Cited Nodes） |
| `graphrag_pipeline/static/app/js/pages/search.js` | Search 页面逻辑（3 个 Tab 模式） |

### 7.2 FastAPI 静态文件服务配置

在 `api_server.py` 中添加：

```python
from fastapi.staticfiles import StaticFiles

# 挂载新 SPA（GraphRAG Studio）
app.mount("/studio", StaticFiles(directory="static/app", html=True), name="studio")

# 访问地址: http://localhost:8000/studio/
```

### 7.3 访问入口

| 地址 | 说明 |
|------|------|
| `http://localhost:8000/studio/` | GraphRAG Studio（新 SPA） |
| `http://localhost:8000/` 或 `http://localhost:5000/` | 旧 Flask KG 可视化（向后兼容） |
| `http://localhost:8000/docs` | FastAPI 自动生成 Swagger UI |

---

## 附：API 端点 → 页面使用矩阵

| API 端点 | Dashboard | Documents | KG Explorer | Chat | Search |
|---------|-----------|-----------|-------------|------|--------|
| `GET /system/stats` | ✅ | — | — | — | — |
| `GET /health` | ✅ | — | — | — | — |
| `GET /system/demo` | ✅ | — | ✅ | — | — |
| `GET /system/formats` | — | ✅ | — | — | — |
| `POST /documents/upload` | ✅ Modal | ✅ | — | — | — |
| `GET /documents` | ✅ Recent | ✅ List | — | — | — |
| `GET /documents/{id}` | — | ✅ | — | — | — |
| `DELETE /documents/{id}` | — | ✅ | — | — | — |
| `POST /index/start` | ✅ | ✅ | — | — | — |
| `GET /index/status/{id}` | ✅ Poll | ✅ Poll | — | — | — |
| `GET /index/result/{id}` | — | ✅ | — | — | — |
| `DELETE /index/jobs/{id}` | ✅ | ✅ | — | — | — |
| `GET /kg/nodes` | — | — | ✅ | — | — |
| `GET /kg/edges` | — | — | ✅ | — | — |
| `GET /kg/nodes/{id}` | — | — | ✅ Click | ✅ Hover | ✅ |
| `GET /kg/nodes/{id}/neighbors` | — | — | ✅ Detail | — | ✅ Preview |
| `GET /kg/stats` | — | — | ✅ | — | — |
| `GET /kg/export` | — | — | ✅ Download | — | — |
| `POST /query` | — | — | — | ✅ | — |
| `GET /query/history` | — | — | — | ✅ Sidebar | — |
| `POST /query/batch` | — | — | — | — | — |
| `GET /search/entities` | — | — | ✅ Toolbar | — | ✅ Tab1 |
| `GET /search/path` | — | — | — | — | ✅ Tab2 |
| `GET /search/graph` | — | — | — | — | ✅ Tab3 |
