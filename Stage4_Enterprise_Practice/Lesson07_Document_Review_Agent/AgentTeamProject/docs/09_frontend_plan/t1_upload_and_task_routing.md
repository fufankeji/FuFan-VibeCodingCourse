# 前端规划 T1：文档上传与任务状态路由

**文档编号**：09_frontend_plan/t1_upload_and_task_routing
**版本**：v1.0
**编写日期**：2026-03-11
**编写角色**：前端规划 Teammate 1
**输入文档**：
- `08_api_spec/api_spec-v1.0.md`
- `06_architecture/frontend_design_spec-v1.0.md`
- `06_architecture/frontend_backend_boundary_spec-v1.0.md`
- `04_interaction_design/langchain_hitl_arch-v1.0.md`

**职责范围**：P03 合同列表页、P04 合同上传页、P05 解析进度页、路由守卫逻辑、WorkflowStatusBar 状态节点与路由联动、SSE 事件驱动页面跳转规则。

---

## 目录

1. [页面层级结构](#一页面层级结构)
2. [路由结构与跳转规则](#二路由结构与跳转规则)
3. [SSE/WebSocket 事件与页面联动](#三ssewebsocket-事件与页面联动)
4. [API 接口对应关系](#四api-接口对应关系)
5. [状态与页面映射总表](#五状态与页面映射总表)

---

## 一、页面层级结构

本章给出 P03、P04、P05 三个页面的完整组件树，以及所有页面共用的 WorkflowStatusBar 组件结构。

---

### 1.1 P03 — 合同列表页（`/contracts`）

```
ContractListPage
├── GlobalNav（顶部全局导航栏，position: fixed，全局复用）
│   ├── Logo
│   ├── 主导航菜单
│   │   ├── 工作台（→ /dashboard）
│   │   ├── 合同列表（当前页，高亮）
│   │   └── 系统管理（仅 admin 角色可见，→ /admin）
│   └── 用户信息区
│       ├── 用户头像
│       ├── 角色标识（reviewer / submitter / admin）
│       └── 退出登录按钮
├── PageHeader（页面标题区）
│   ├── 页面标题文字「合同列表」
│   └── 新建审核按钮（→ /contracts/upload）
├── FilterBar（筛选/搜索栏）
│   ├── KeywordSearchInput（关键字搜索，按合同名称）
│   ├── StateFilterSelect（状态筛选下拉）
│   │   └── 选项：全部 / 解析中(parsing) / 扫描中(scanning) / 待人工介入(hitl_pending)
│   │            / 已完成(report_ready) / 已中止(aborted)
│   └── DateRangePicker（上传时间范围选择器）
│       ├── 起始日期输入（date_from）
│       └── 截止日期输入（date_to）
├── ContractList（合同列表区，游标分页加载）
│   └── ContractListItem（合同行，逐条渲染）
│       ├── ContractTitle（合同名称文字）
│       ├── MetaInfo（元信息行）
│       │   ├── UploadedBy（上传人）
│       │   └── UploadedAt（上传时间，ISO 8601 本地化展示）
│       ├── StateBadge（状态标签，颜色与 ReviewSession.state 对应）
│       │   ├── 解析中 → 蓝色
│       │   ├── 扫描中 → 蓝色
│       │   ├── 待人工介入 → 橙色
│       │   ├── 已完成 → 绿色
│       │   └── 已中止 → 灰色
│       ├── ProgressIndicator（仅 state=hitl_pending 时显示）
│       │   └── 高风险条款处理进度（decided_high_risk / total_high_risk_count）
│       └── ActionGroup（操作按钮组）
│           ├── ViewButton（查看详情，始终显示）
│           │   └── 点击 → 路由守卫按 state 跳转（见第二章守卫逻辑）
│           ├── ContinueReviewButton（继续审批，仅 state=hitl_pending 时显示）
│           │   └── 点击 → /contracts/:id/review 或 /contracts/:id/batch
│           └── ViewReportButton（查看报告，仅 state=report_ready 时显示）
│               └── 点击 → /contracts/:id/report
└── PaginationLoader（游标分页加载器）
    └── LoadMoreButton / 自动触底加载（has_more=true 时显示）
```

**组件说明**：

- `StateBadge` 的颜色映射和文字标签严格基于后端返回的 `ReviewSession.state` 字段，前端不自行推断状态。
- `ProgressIndicator` 的数值来源于 API 响应中的 `session.progress.decided_high_risk` 和 `session.progress.total_high_risk_count` 字段。
- `ContractList` 使用游标分页，首次渲染不传 `cursor`，加载更多时传递上次响应的 `pagination.next_cursor`。

---

### 1.2 P04 — 合同上传页（`/contracts/upload`）

```
ContractUploadPage
├── GlobalNav（顶部全局导航栏，复用）
├── PageHeader（页面标题区）
│   └── 页面标题文字「新建合同审核」
├── UploadForm（上传表单区）
│   ├── ContractTitleInput（合同名称输入框）
│   │   ├── 标签「合同名称」
│   │   ├── 文本输入框（选填，最长 200 字符）
│   │   └── 说明文字「留空时自动从文件名提取」
│   ├── FileUploadZone（文件上传拖拽区）
│   │   ├── DropOverlay（拖拽覆盖层，拖入时显示）
│   │   ├── FileTypeHint（支持格式说明「支持 PDF / DOCX 格式」）
│   │   ├── FileSizeLimitHint（文件大小限制说明「最大 50MB」）
│   │   ├── SelectFileButton（点击选择文件按钮）
│   │   ├── SelectedFilePreview（已选文件预览，选文件后显示）
│   │   │   ├── FileName（文件名）
│   │   │   ├── FileSize（文件大小）
│   │   │   └── RemoveFileButton（移除已选文件按钮）
│   │   └── UploadProgressBar（上传进度条，上传中显示）
│   │       ├── ProgressBarFill（进度填充，基于 XHR/fetch upload progress）
│   │       └── ProgressPercentText（百分比文字）
│   └── ValidationErrorArea（前端校验提示区）
│       ├── FileTypeError（格式不支持提示，触发条件：非 PDF/DOCX）
│       ├── FileSizeError（文件过大提示，触发条件：> 50MB）
│       ├── FileEmptyError（未选文件提示）
│       └── ServerErrorAlert（服务端错误提示，展示后端 error_code 对应的中文说明）
│           ├── FILE_TOO_LARGE → 「文件超过 50MB 限制，请压缩后重新上传」
│           ├── FILE_CORRUPTED → 「文件结构损坏，请检查文件完整性」
│           ├── FILE_ENCRYPTED → 「文件已加密，请去除加密后重新上传」
│           ├── FILE_EMPTY → 「文件内容为空，请检查文件」
│           └── INVALID_FILE_TYPE → 「不支持的文件类型，请上传 PDF 或 DOCX 格式」
└── ActionBar（操作按钮区）
    ├── SubmitButton（提交审核按钮）
    │   ├── 上传中状态：禁用 + 显示加载动画
    │   └── 点击后：触发 POST /contracts/upload，成功后跳转 /contracts/:id/parsing
    └── CancelButton（取消按钮，→ /contracts）
```

**组件说明**：

- 前端格式校验（PDF/DOCX）和文件大小校验（50MB）在选文件后立即执行，属于辅助性校验，不替代后端校验。
- 上传期间 `SubmitButton` 和 `CancelButton` 均禁用，防止重复提交。
- 服务端错误码到中文提示的映射在前端维护，基于 api_spec 定义的错误码表。
- 合同名称选填，若留空，后端从文件名提取（api_spec 3.1 节约定）。

---

### 1.3 P05 — 解析进度页（`/contracts/:id/parsing`）

```
ParsingProgressPage
├── GlobalNav（顶部全局导航栏，复用）
├── WorkflowStatusBar（工作流状态进度条，高度 64px，GlobalNav 正下方固定）
│   ├── StepNode: 「上传解析」→ 当前激活态（高亮 + 加载动画图标）
│   ├── StepConnector（连接线）
│   ├── StepNode: 「字段核对」→ 待完成态（灰色）
│   ├── StepConnector
│   ├── StepNode: 「AI 扫描」→ 待完成态
│   ├── StepConnector
│   ├── StepNode: 「分级路由」→ 待完成态
│   ├── StepConnector
│   ├── StepNode: 「人工审核」→ 待完成态
│   ├── StepConnector
│   └── StepNode: 「报告生成」→ 待完成态
├── MainContent（主内容区）
│   ├── ParseStatusDisplay（解析状态说明区）
│   │   ├── StatusIcon（状态图标）
│   │   │   ├── 解析中：旋转加载动画图标
│   │   │   ├── 解析失败：错误图标（红色）
│   │   │   └── 解析超时：超时图标（橙色）
│   │   ├── StatusText（状态文字）
│   │   │   ├── 解析中：「正在解析合同文件，请稍候…」
│   │   │   ├── 解析失败：「解析失败，请重试」
│   │   │   └── 解析超时：「解析超时（已超过 15 分钟），请重试」
│   │   └── ScannedDocumentNotice（扫描件提示，仅 is_scanned_document=true 时显示）
│   │       └── 「检测到扫描件，OCR 识别精度可能低于原生 PDF，请在字段核对阶段仔细核查」
│   ├── WaitingGuide（等待引导区，仅解析中状态显示）
│   │   └── 说明文字「解析完成后将自动进入字段核对步骤，无需手动刷新」
│   └── RetryArea（重试区域，仅解析失败/超时时显示）
│       ├── RetryCount（已重试次数提示「已重试 N / 3 次」）
│       ├── RetryButton（重试解析按钮，retry_count < 3 时启用）
│       │   └── 点击 → POST /sessions/:id/retry-parse
│       └── MaxRetryNotice（达到最大重试次数提示，retry_count >= 3 时显示）
│           └── 「已达最大重试次数（3次），请联系管理员」
└── AbortArea（操作区，底部）
    └── AbortButton（放弃并返回按钮）
        └── 点击 → 二次确认对话框 → 确认后 POST /sessions/:id/abort，跳转 /contracts
```

**组件说明**：

- `WorkflowStatusBar` 在 P05 上显示「上传解析」为当前激活节点，其余节点为待完成态。
- 页面加载时立即建立 SSE 连接（`GET /sessions/:id/events`），监听 `state_changed`、`parse_failed`、`parse_timeout` 事件。
- 收到 `state_changed` 事件且 `state = "scanning"` 时，前端自动跳转至 `/contracts/:id/fields`（P06）。
- `is_scanned_document` 的值从 `POST /contracts/upload` 的成功响应体中读取，页面初始化时从路由状态或 `GET /sessions/:id` 接口获取。

---

### 1.4 WorkflowStatusBar — 全局工作流状态条（P05 ~ P10 公用组件）

```
WorkflowStatusBar（高度 64px，position: fixed，GlobalNav 正下方）
├── StepNode（「上传解析」）
│   ├── 属性：对应 state = parsing
│   ├── 已完成态：勾选图标 + 灰色文字
│   ├── 当前激活态：彩色图标 + 高亮文字
│   └── 待完成态：空心圆圈 + 灰色文字
├── StepConnector（连接线）
├── StepNode（「字段核对」）
│   └── 属性：对应 state = scanning（扫描前阶段）
├── StepConnector
├── StepNode（「AI 扫描」）
│   └── 属性：对应 state = scanning（扫描中阶段）
├── StepConnector
├── StepNode（「分级路由」）
│   └── 属性：对应 scanning → hitl_pending 转换期间
├── StepConnector
├── StepNode（「人工审核」）
│   ├── 属性：对应 state = hitl_pending
│   └── 中断态特殊显示：感叹号图标 + 橙色 + Tooltip「流程已暂停 - 等待人工操作」
├── StepConnector
└── StepNode（「报告生成」）
    └── 属性：对应 state = completed / report_ready
```

**数据来源**：`GET /sessions/:id`（api_spec 4.1 节）返回的 `state` 和 `hitl_subtype` 字段。

**实时更新机制**：订阅 SSE 连接推送的 `state_changed` 事件，收到后重新映射节点状态，无需刷新页面。

**节点激活规则**（基于 `ReviewSession.state`）：

| ReviewSession.state | hitl_subtype | WorkflowStatusBar 激活节点 |
|---------------------|-------------|--------------------------|
| `parsing` | — | 「上传解析」当前激活 |
| `scanning` | — | 「字段核对」或「AI 扫描」当前激活（由前端根据用户当前步骤判断） |
| `hitl_pending` | `interrupt` | 「人工审核」中断态（感叹号 + 橙色） |
| `hitl_pending` | `batch_review` | 「人工审核」中断态（感叹号 + 橙色） |
| `completed` | — | 「报告生成」加载态 |
| `report_ready` | — | 所有节点已完成（勾选图标） |

---

## 二、路由结构与跳转规则

### 2.1 路由树总览

```
/login
  └─ 认证成功 ──────────────────────────────────────────► /dashboard

/dashboard
  ├─ 新建审核按钮 ───────────────────────────────────────► /contracts/upload
  ├─ 查看全部合同 ───────────────────────────────────────► /contracts
  └─ 待我处理（直接恢复中断会话） ─────────────────────────► /contracts/:id/review

/contracts                                             [P03]
  ├─ 新建审核按钮 ───────────────────────────────────────► /contracts/upload
  └─ 点击合同行（路由守卫按 state 跳转）
       ├─ state=parsing         ──────────────────────► /contracts/:id/parsing
       ├─ state=scanning        ──────────────────────► /contracts/:id/fields
       │                                                （用户未触发扫描时）
       │                        ──────────────────────► /contracts/:id/scanning
       │                                                （用户已触发扫描时）
       ├─ state=hitl_pending, subtype=interrupt ───────► /contracts/:id/review
       ├─ state=hitl_pending, subtype=batch_review ────► /contracts/:id/batch
       ├─ state=report_ready ──────────────────────────► /contracts/:id/report
       ├─ state=completed ─────────────────────────────► /contracts/:id/report
       │                                                （展示报告生成中状态）
       └─ state=aborted ───────────────────────────────► /contracts
                                                        （提示：流程已中止）

/contracts/upload                                      [P04]
  └─ POST /contracts/upload 成功，获取 session_id ───────► /contracts/:id/parsing

/contracts/:id/parsing                                 [P05]
  ├─ SSE event: state_changed (state=scanning) ────────► /contracts/:id/fields
  ├─ SSE event: parse_failed ─────────────────────────► 当前页展示失败状态 + 重试入口
  ├─ SSE event: parse_timeout ────────────────────────► 当前页展示超时状态 + 重试入口
  └─ 放弃按钮（abort 确认）────────────────────────────► /contracts

/contracts/:id/fields                                  [P06, 非本文档职责范围，仅标注路由关系]
  └─ 点击「开始 AI 风险扫描」─────────────────────────── ► /contracts/:id/scanning

/contracts/:id/scanning                                [P07, 非本文档职责范围，仅标注路由关系]
  ├─ SSE event: route_auto_passed ─────────────────────► /contracts/:id/report
  ├─ SSE event: route_batch_review ────────────────────► /contracts/:id/batch
  └─ SSE event: route_interrupted ─────────────────────► /contracts/:id/review

/contracts/:id/review                                  [P08, 非本文档职责范围]
  └─ SSE event: report_generation_started ─────────────► /contracts/:id/report

/contracts/:id/batch                                   [P09, 非本文档职责范围]
  └─ 批量复核完成 ─────────────────────────────────────► /contracts/:id/report

/contracts/:id/report                                  [P10, 非本文档职责范围，终态页]
```

---

### 2.2 路由守卫逻辑（ReviewSession.state → 页面跳转映射）

路由守卫是前端在用户访问 `/contracts/:id`（或其子路由）时，根据后端返回的 `ReviewSession.state` 自动重定向的机制。守卫逻辑如下：

**守卫触发时机**：

1. 用户在 P03 点击合同行（任意操作按钮）。
2. 用户直接在浏览器地址栏输入 `/contracts/:id` 的任意子路由。
3. 用户从 P02（工作台）的「待我处理」或「最近审核」模块点击进入。

**守卫执行序列**：

```
Step 1  检查登录状态：
        未登录 → 重定向至 /login，保存当前 URL 供登录后回跳

Step 2  检查角色权限：
        submitter 尝试访问 /contracts/:id/review 或 /contracts/:id/fields
        → 重定向至 /contracts（submitter 无 HITL 操作权限）

Step 3  调用 GET /sessions/:session_id（或从路由参数推断 session_id）：
        获取 ReviewSession.state 和 hitl_subtype

Step 4  按 state 映射目标路由：
        state=parsing               → 重定向至 /contracts/:id/parsing
        state=scanning              → 重定向至 /contracts/:id/fields
                                      （若用户已触发扫描，则为 /contracts/:id/scanning）
        state=hitl_pending
          + hitl_subtype=interrupt  → 重定向至 /contracts/:id/review
          + hitl_subtype=batch_review → 重定向至 /contracts/:id/batch
        state=completed             → 重定向至 /contracts/:id/report
        state=report_ready          → 重定向至 /contracts/:id/report
        state=aborted               → 返回 /contracts，展示「流程已中止」提示

Step 5  用户当前所在路由与目标路由一致时：不跳转，正常渲染页面
```

**守卫数据源**：`GET /sessions/{session_id}`（api_spec 4.1 节），前端根据响应中的 `state` 字段执行映射。

**注意事项**：

- 前端守卫为「防君子」，仅负责用户体验跳转；后端 API 对所有请求独立执行权限校验。
- `scanning` 状态下前端需区分「字段核对前」和「扫描进行中」两个子阶段：通过前端本地状态（用户是否已点击「开始 AI 风险扫描」）判断，无需额外 API 字段。

---

### 2.3 跨天恢复路由（断点恢复场景）

**触发场景**：用户关闭浏览器后重新打开，或 session 超时后重新登录，进入 `state=hitl_pending` 的会话。

**恢复流程**：

```
Step 1  用户点击 P02「待我处理」模块的「继续审批」，
        或 P03 合同行的「继续审批」按钮

Step 2  路由守卫按 state=hitl_pending + hitl_subtype 跳转至对应页面
        （hitl_subtype=interrupt → /contracts/:id/review）
        （hitl_subtype=batch_review → /contracts/:id/batch）

Step 3  页面加载时调用 GET /sessions/:id/recovery（api_spec 4.2 节）：
        获取 interrupted_at、completed_count、total_high_risk_count、next_pending_item_id

Step 4  前端展示恢复进度 Banner：
        「已恢复上次审核进度，当前待处理第 N 条高风险条款（上次保存：YYYY-MM-DD HH:mm）」

Step 5  前端自动滚动至 next_pending_item_id 对应的条款卡片
```

---

## 三、SSE/WebSocket 事件与页面联动

### 3.1 SSE 连接管理规则

| 规则 | 说明 |
|------|------|
| 建立时机 | 进入 P05（解析进度页）时立即建立；P06 ~ P10 进入时也各自建立（本文档重点说明 P05） |
| 关闭时机 | 页面组件销毁（`onUnmounted` / `useEffect` cleanup）时关闭连接 |
| 断线重连 | 前端实现自动重连，重连后接收后端推送的当前最新 `state` 作为初始化补偿 |
| 连接接口 | `GET /sessions/{session_id}/events`（api_spec 9.1 节），`Accept: text/event-stream` |

---

### 3.2 P05（解析进度页）的 SSE 事件联动规则

| SSE event 名称 | data 关键字段 | P05 前端响应行为 |
|----------------|-------------|----------------|
| `state_changed` | `state: "scanning"` | 自动跳转至 `/contracts/:id/fields`（P06） |
| `parse_failed` | `error_code`, `retry_count` | 展示解析失败状态；根据 `retry_count` 决定是否显示重试按钮（< 3 时显示） |
| `parse_timeout` | `elapsed_seconds`, `retry_count` | 展示解析超时状态；同上，显示重试按钮或最大重试提示 |
| `system_failure` | `error_code`, `node_name` | 展示系统级错误状态（不可恢复），隐藏重试按钮，建议用户联系管理员 |

---

### 3.3 WorkflowStatusBar 的 SSE 事件联动规则（P05 ~ P10 全局）

WorkflowStatusBar 在 P05 ~ P10 的所有页面均订阅 SSE 事件，实时更新节点状态：

| SSE event 名称 | WorkflowStatusBar 状态变化 |
|----------------|--------------------------|
| `state_changed` (`state=scanning`) | 「上传解析」节点变为已完成态（勾选图标），「字段核对」节点变为当前激活态 |
| `scan_progress` | 「AI 扫描」节点保持当前激活态，可附带扫描进度计数更新 |
| `route_auto_passed` / `route_batch_review` / `route_interrupted` | 「分级路由」节点变为已完成态，「人工审核」节点根据 hitl_subtype 切换为激活态或中断态 |
| `report_generation_started` | 「人工审核」节点变为已完成态，「报告生成」节点变为加载态 |
| `report_ready` | 「报告生成」节点变为已完成态；所有节点均已完成 |
| `system_failure` | 当前激活节点变为错误态（红色图标），并展示 Tooltip 说明故障节点 |

---

### 3.4 P03（合同列表页）的实时更新说明

P03 不维护常驻 SSE 连接（列表页以轮询方式或进入时刷新获取最新状态）。

> **说明**：api_spec 9.1 节约定 SSE 连接路径为 `GET /sessions/{session_id}/events`，适用于单个会话的状态订阅。合同列表页为多合同汇总视图，前端在列表页不建立 SSE 连接，而在用户点击进入具体合同页面后才建立连接。列表页的状态刷新通过以下方式实现：
> - 页面挂载时调用 `GET /contracts` 获取最新列表数据
> - 用户手动刷新页面时重新请求列表数据

---

### 3.5 P04（合同上传页）的事件说明

P04 不使用 SSE，仅使用 HTTP 请求：

- 上传进度通过浏览器原生的 `XMLHttpRequest.upload.onprogress` 或 `fetch` 流式读取实现（前端本地机制，非 SSE）。
- 上传成功后（`POST /contracts/upload` 返回 201），前端读取响应中的 `session_id`，跳转至 `/contracts/${session_id}/parsing`，再由 P05 建立 SSE 连接。

---

## 四、API 接口对应关系

本章列出 P03、P04、P05 三个页面（含路由守卫和 WorkflowStatusBar）实际调用的所有接口，并标注其在 api_spec 中的定义状态。

### 4.1 P03 — 合同列表页

| 场景 | HTTP 方法 | 接口路径 | api_spec 状态 |
|------|----------|---------|--------------|
| 初始加载合同列表 | GET | `/contracts` | 已定义（api_spec 第十章 10.1 节） |
| 游标分页加载更多 | GET | `/contracts?cursor=xxx&limit=20` | 已定义（api_spec 第十章 10.1 节） |
| 按状态筛选列表 | GET | `/contracts?state=hitl_pending` | 已定义（api_spec 第十章 10.1 节，`state` 为支持的查询参数） |
| 按日期范围筛选列表 | GET | `/contracts?date_from=xxx&date_to=xxx` | 已定义（api_spec 第十章 10.1 节） |
| 路由守卫：获取会话状态 | GET | `/sessions/{session_id}` | 已定义（api_spec 第四章 4.1 节） |

> **说明**：api_spec 第十章的 `GET /contracts` 接口支持 `state`、`date_from`、`date_to`、`limit`、`cursor` 查询参数，但不支持按合同名称关键字搜索。**关键字搜索功能后端尚未定义接口**，前端 FilterBar 中的 `KeywordSearchInput` 组件在联调阶段需与后端确认是否需要新增搜索接口（或改为前端本地过滤）。

| 场景 | HTTP 方法 | 接口路径 | api_spec 状态 |
|------|----------|---------|--------------|
| 关键字搜索合同名称 | GET | `/contracts?keyword=xxx`（示意） | **「未开发」** — api_spec 中 `GET /contracts` 未定义 `keyword` 参数 |

---

### 4.2 P04 — 合同上传页

| 场景 | HTTP 方法 | 接口路径 | api_spec 状态 |
|------|----------|---------|--------------|
| 上传合同文件（含合同名称） | POST | `/contracts/upload` | 已定义（api_spec 第三章 3.1 节） |

---

### 4.3 P05 — 解析进度页

| 场景 | HTTP 方法 | 接口路径 | api_spec 状态 |
|------|----------|---------|--------------|
| 页面初始化：获取会话状态 | GET | `/sessions/{session_id}` | 已定义（api_spec 第四章 4.1 节） |
| 建立 SSE 实时事件流 | GET | `/sessions/{session_id}/events` | 已定义（api_spec 第九章 9.1 节） |
| 重试 OCR 解析（用户主动触发） | POST | `/sessions/{session_id}/retry-parse` | 已定义（api_spec 第三章 3.2 节） |
| 放弃审核流程（abort） | POST | `/sessions/{session_id}/abort` | 已定义（api_spec 第三章 3.3 节） |

---

### 4.4 WorkflowStatusBar（P05 ~ P10 公用）

| 场景 | HTTP 方法 | 接口路径 | api_spec 状态 |
|------|----------|---------|--------------|
| 获取初始会话状态（组件挂载时） | GET | `/sessions/{session_id}` | 已定义（api_spec 第四章 4.1 节） |
| SSE 订阅（实时状态更新） | GET | `/sessions/{session_id}/events` | 已定义（api_spec 第九章 9.1 节） |

---

### 4.5 路由守卫（通用）

| 场景 | HTTP 方法 | 接口路径 | api_spec 状态 |
|------|----------|---------|--------------|
| 路由守卫获取 state 和 hitl_subtype | GET | `/sessions/{session_id}` | 已定义（api_spec 第四章 4.1 节） |
| 跨天恢复：获取断点信息 | GET | `/sessions/{session_id}/recovery` | 已定义（api_spec 第四章 4.2 节） |

---

### 4.6 接口覆盖说明

api_spec 中定义但**不属于本文档职责范围**（由其他 Teammate 规划）的接口：

| 接口路径 | 说明 |
|---------|------|
| `GET /sessions/{session_id}/fields` | P06 字段核对页使用 |
| `PATCH /sessions/{session_id}/fields/{field_id}` | P06 字段核对页使用 |
| `GET /sessions/{session_id}/items` | P08 HITL 审批页使用 |
| `POST /sessions/{session_id}/items/{item_id}/decision` | P08 HITL 审批页使用 |
| `DELETE /sessions/{session_id}/items/{item_id}/decision` | P08 HITL 审批页使用 |
| `POST /sessions/{session_id}/items/batch-confirm` | P09 批量复核页使用 |
| `GET /sessions/{session_id}/report` | P10 报告页使用 |
| `GET /sessions/{session_id}/report/download` | P10 报告页使用 |
| `GET /contracts/{contract_id}` | 合同详情场景（按需引用） |

---

## 五、状态与页面映射总表

本章为全局状态映射的权威参考，整合了 api_spec、frontend_design_spec、langchain_hitl_arch 三份文档的状态定义。

### 5.1 ReviewSession.state → 页面跳转映射总表

| ReviewSession.state | hitl_subtype | LangGraph 工作流位置 | 目标页面 | 路由路径 | WorkflowStatusBar 激活节点 |
|---------------------|-------------|---------------------|---------|---------|--------------------------|
| `parsing` | — | OCR 任务队列中，LangGraph 未启动 | P05 解析进度页 | `/contracts/:id/parsing` | 「上传解析」当前激活 |
| `scanning` | — | `scanning_node` 执行中 | P06 字段核对页（扫描前） | `/contracts/:id/fields` | 「字段核对」当前激活 |
| `scanning` | — | `scanning_node` 执行中（用户已触发扫描） | P07 AI 扫描进度页 | `/contracts/:id/scanning` | 「AI 扫描」当前激活 |
| `hitl_pending` | `interrupt` | `human_review_node` interrupt 挂起 | P08 HITL 中断审核页 | `/contracts/:id/review` | 「人工审核」中断态（橙色 + 感叹号） |
| `hitl_pending` | `batch_review` | `human_review_node` interrupt 挂起 | P09 批量复核页 | `/contracts/:id/batch` | 「人工审核」中断态（橙色 + 感叹号） |
| `completed` | — | `Command(resume=...)` 已调用，图执行中 | P10 审核报告页（生成中状态） | `/contracts/:id/report` | 「报告生成」加载态 |
| `report_ready` | — | 图执行完成（终态） | P10 审核报告页（就绪状态） | `/contracts/:id/report` | 所有节点已完成 |
| `aborted` | — | 图 thread 不再 resume（终态） | 返回 P03 合同列表页 | `/contracts` | 不显示 WorkflowStatusBar |

---

### 5.2 SSE 事件 → 页面跳转映射总表

| SSE event 名称 | 推送时机 | 当前所在页面 | 跳转目标页面 | 跳转路径 |
|----------------|---------|------------|------------|---------|
| `state_changed` (`state="scanning"`) | OCR 解析完成 | P05 解析进度页 | P06 字段核对页 | `/contracts/:id/fields` |
| `parse_failed` | OCR 解析失败 | P05 解析进度页 | 留在 P05（展示失败状态） | 无跳转 |
| `parse_timeout` | OCR 解析超时（>15分钟） | P05 解析进度页 | 留在 P05（展示超时状态） | 无跳转 |
| `scan_progress` | 风险扫描进行中，每发现 1 条条款推送 | P07 AI 扫描进度页 | 留在 P07（更新计数） | 无跳转 |
| `route_auto_passed` | 低风险路由完成 | P07 AI 扫描进度页 | P10 审核报告页 | `/contracts/:id/report` |
| `route_batch_review` | 中风险路由完成（无高风险） | P07 AI 扫描进度页 | P09 批量复核页 | `/contracts/:id/batch` |
| `route_interrupted` | 高风险路由，LangGraph interrupt 触发 | P07 AI 扫描进度页 | P08 HITL 中断审核页 | `/contracts/:id/review` |
| `item_decision_saved` | 单条 HITL 决策持久化成功 | P08 HITL 中断审核页 | 留在 P08（更新条款状态） | 无跳转 |
| `report_generation_started` | LangGraph resume() 成功，报告生成启动 | P08 或 P09 | P10 审核报告页 | `/contracts/:id/report` |
| `report_ready` | 报告异步生成完成 | P10 审核报告页（生成中） | 留在 P10（刷新展示报告内容） | 无跳转（页面内状态切换） |
| `system_failure` | 不可恢复系统故障 | 任意页面（P05 ~ P10） | 留在当前页（展示系统错误状态） | 无跳转 |

---

### 5.3 错误码 → 前端提示映射表（P04 上传页专属）

| HTTP 状态码 | error_code | 前端展示提示文字 | 处理方式 |
|------------|------------|----------------|---------|
| 400 | `INVALID_FILE_TYPE` | 「不支持的文件类型，请上传 PDF 或 DOCX 格式」 | 留在 P04，展示错误提示，清除已选文件 |
| 413 | `FILE_TOO_LARGE` | 「文件超过 50MB 限制，请压缩后重新上传」 | 留在 P04，展示错误提示，清除已选文件 |
| 422 | `FILE_CORRUPTED` | 「文件结构损坏，请检查文件完整性后重新上传」 | 留在 P04，展示错误提示，清除已选文件 |
| 422 | `FILE_ENCRYPTED` | 「文件已加密，请去除加密保护后重新上传」 | 留在 P04，展示错误提示，清除已选文件 |
| 422 | `FILE_EMPTY` | 「文件内容为空，请检查文件后重新上传」 | 留在 P04，展示错误提示，清除已选文件 |
| 401 | `UNAUTHORIZED` | 「登录已过期，请重新登录」 | 重定向至 `/login` |
| 429 | `RATE_LIMITED` | 「操作过于频繁，请稍后再试」 | 留在 P04，展示错误提示，恢复提交按钮 |
| 500 | `INTERNAL_ERROR` | 「服务器内部错误，请稍后重试或联系管理员」 | 留在 P04，展示错误提示，恢复提交按钮 |

---

### 5.4 路由守卫决策矩阵

| 访问路径 | 用户角色 | ReviewSession.state | hitl_subtype | 守卫结果 |
|---------|---------|---------------------|-------------|---------|
| `/contracts/:id/parsing` | reviewer | `parsing` | — | 允许访问 |
| `/contracts/:id/parsing` | reviewer | `scanning` | — | 重定向至 `/contracts/:id/fields` |
| `/contracts/:id/parsing` | submitter | 任意 | — | 重定向至 `/contracts`（submitter 无解析页权限）|
| `/contracts/:id/review` | reviewer | `hitl_pending` | `interrupt` | 允许访问 |
| `/contracts/:id/review` | reviewer | `hitl_pending` | `batch_review` | 重定向至 `/contracts/:id/batch` |
| `/contracts/:id/review` | submitter | 任意 | 任意 | 重定向至 `/contracts`（submitter 无 HITL 操作权限）|
| `/contracts/:id/review` | reviewer | `report_ready` | — | 重定向至 `/contracts/:id/report` |
| `/admin` | reviewer | — | — | 重定向至 `/dashboard` |
| 任意路径 | 未登录 | — | — | 重定向至 `/login` |

---

*本文档严格基于上述四份输入文档的既有定义，不包含超出其范围的新增假设。唯一标注的「未开发」项为合同列表关键字搜索接口（`GET /contracts` 的 `keyword` 参数），需在联调阶段与后端确认。*
