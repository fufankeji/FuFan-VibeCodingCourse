# 前端架构规范总文档 v1.0

**文档编号**：06_architecture/frontend_arch-spec-v1.0
**版本**：v1.0
**编写日期**：2026-03-11
**编写角色**：前端架构汇总 Lead
**文档定位**：本文档汇总三位前端规划 Teammate 的阶段产出，整合为统一的前端架构规范，作为联调与实施的权威参考。

---

## 一、文档说明

### 1.1 本文档定位

本文档是前端架构规范的汇总文档，整合以下三位 Teammate 在 `09_frontend_plan` 阶段的分工产出：

- **T1**（Teammate 1）：文档上传与任务状态路由，负责 P03 合同列表页、P04 合同上传页、P05 解析进度页、路由守卫逻辑、WorkflowStatusBar 状态节点与路由联动、SSE 事件驱动页面跳转规则。
- **T2**（Teammate 2）：审核展示组件，负责 P06 字段核对组件、P07/P08/P09/P10 审核展示组件（`FieldVerificationCard`、`RiskItemCard`、`RiskEvidenceHighlight`、`SourceBadge`、`RiskLevelBadge`、`DecisionHistoryPanel`）。
- **T3**（Teammate 3）：HITL 交互 UI 设计，负责 P08 HITL 中断审核页和 P09 批量复核页的完整交互流程（Approve / Edit / Reject / Revoke）、防 Automation Bias UI 机制、进度汇总区、跨天恢复 Banner。

本文档不新增任何 Teammate 文档未涉及的内容，所有条目均可溯源至输入文档。

### 1.2 输入文档列表

| 文档 | 路径 |
|------|------|
| T1 产出：文档上传与任务状态路由 | `docs/09_frontend_plan/t1_upload_and_task_routing.md` |
| T2 产出：审核展示组件规划 | `docs/09_frontend_plan/t2_review_components.md` |
| T3 产出：前端 HITL 交互 UI 规划 | `docs/09_frontend_plan/t3_hitl_ui_design.md` |
| 原始参考：前端设计规范 | `docs/06_architecture/frontend_design_spec-v1.0.md` |
| 原始参考：API 规范 | `docs/08_api_spec/api_spec-v1.0.md` |

### 1.3 版本信息

| 项目 | 值 |
|------|-----|
| 版本号 | v1.0 |
| 编写日期 | 2026-03-11 |
| 基准 API 版本 | `api_spec-v1.0` |
| 基准前端设计规范版本 | `frontend_design_spec-v1.0` |

---

## 二、完整路由结构与页面层级总表

### 2.1 所有页面总览（P01–P11）

来源：`frontend_design_spec-v1.0.md` 第一章页面清单，及 T1 产出第二章路由结构。

| 页面 ID | 页面名称 | 路由路径 | 适用角色 | 对应 ReviewSession.state | 路由树层级 |
|---------|---------|---------|---------|--------------------------|-----------|
| P01 | 登录页 | `/login` | all | — | 顶层（一级路由） |
| P02 | 工作台首页 | `/dashboard` | all | — | 顶层（一级路由） |
| P03 | 合同列表页 | `/contracts` | reviewer / submitter | — | 顶层（一级路由） |
| P04 | 合同上传页 | `/contracts/upload` | reviewer / submitter | — | 二级路由（`/contracts` 子路由，非动态参数） |
| P05 | 解析进度页 | `/contracts/:id/parsing` | reviewer | `parsing` | 二级路由（`/contracts/:id` 动态子路由） |
| P06 | 字段核对页 | `/contracts/:id/fields` | reviewer | `scanning`（扫描前） | 二级路由（`/contracts/:id` 动态子路由） |
| P07 | AI 扫描进度页 | `/contracts/:id/scanning` | reviewer | `scanning`（扫描中） | 二级路由（`/contracts/:id` 动态子路由） |
| P08 | HITL 中断审核页 | `/contracts/:id/review` | reviewer | `hitl_pending`（subtype: interrupt） | 二级路由（`/contracts/:id` 动态子路由） |
| P09 | 批量复核页 | `/contracts/:id/batch` | reviewer | `hitl_pending`（subtype: batch_review） | 二级路由（`/contracts/:id` 动态子路由） |
| P10 | 审核报告页 | `/contracts/:id/report` | reviewer / submitter | `report_ready` | 二级路由（`/contracts/:id` 动态子路由） |
| P11 | 系统管理页 | `/admin` | admin | — | 顶层（一级路由） |

**页面层级深度说明**：
- **一级路由**（深度 1）：`/login`、`/dashboard`、`/contracts`、`/admin`。这些页面不属于任何父路由的子视图，直接挂载于根路由。
- **二级路由（静态子路由）**（深度 2）：`/contracts/upload`（P04）。路径前缀为 `/contracts`，但不含动态参数，优先级高于动态路由 `/contracts/:id`。
- **二级路由（动态子路由）**（深度 2）：`/contracts/:id/parsing`（P05）至 `/contracts/:id/report`（P10）。`:id` 为审核会话 ID（`session_id`），P05~P10 均挂载于此动态路由下，路由守卫在此层级执行状态跳转。

---

### 2.2 路由树总览

来源：T1 产出第二章 2.1 节、`frontend_design_spec-v1.0.md` 第二章。

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

/contracts/:id/fields                                  [P06]
  └─ 点击「开始 AI 风险扫描」─────────────────────────── ► /contracts/:id/scanning

/contracts/:id/scanning                                [P07]
  ├─ SSE event: route_auto_passed ─────────────────────► /contracts/:id/report
  ├─ SSE event: route_batch_review ────────────────────► /contracts/:id/batch
  └─ SSE event: route_interrupted ─────────────────────► /contracts/:id/review

/contracts/:id/review                                  [P08]
  └─ SSE event: report_generation_started ─────────────► /contracts/:id/report

/contracts/:id/batch                                   [P09]
  └─ 批量复核完成 ─────────────────────────────────────► /contracts/:id/report

/contracts/:id/report                                  [P10, 终态页]

/admin                                                 [P11, 仅 admin]
```

---

### 2.3 路由守卫规则（ReviewSession.state → 页面跳转完整映射）

来源：T1 产出第二章 2.2 节和第五章 5.4 节。

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

Step 3  调用 GET /sessions/{session_id}，获取 ReviewSession.state 和 hitl_subtype

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

**守卫决策矩阵**：

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

**说明**：
- 前端守卫为「防君子」，仅负责用户体验跳转；后端 API 对所有请求独立执行权限校验。
- `scanning` 状态下前端需区分「字段核对前」和「扫描进行中」两个子阶段：通过前端本地状态（用户是否已点击「开始 AI 风险扫描」）判断，无需额外 API 字段。
- 守卫数据源：`GET /sessions/{session_id}`（api_spec 第四章 4.1 节）。

---

### 2.4 ReviewSession.state → 页面映射总表

来源：T1 产出第五章 5.1 节。

| ReviewSession.state | hitl_subtype | LangGraph 工作流位置 | 目标页面 | 路由路径 | WorkflowStatusBar 激活节点 |
|---------------------|-------------|---------------------|---------|---------|--------------------------|
| `parsing` | — | OCR 任务队列中，LangGraph 未启动 | P05 解析进度页 | `/contracts/:id/parsing` | 「上传解析」当前激活 |
| `scanning` | — | `scanning_node` 执行中（扫描前） | P06 字段核对页 | `/contracts/:id/fields` | 「字段核对」当前激活 |
| `scanning` | — | `scanning_node` 执行中（用户已触发扫描） | P07 AI 扫描进度页 | `/contracts/:id/scanning` | 「AI 扫描」当前激活 |
| `hitl_pending` | `interrupt` | `human_review_node` interrupt 挂起 | P08 HITL 中断审核页 | `/contracts/:id/review` | 「人工审核」中断态（橙色 + 感叹号） |
| `hitl_pending` | `batch_review` | `human_review_node` interrupt 挂起 | P09 批量复核页 | `/contracts/:id/batch` | 「人工审核」中断态（橙色 + 感叹号） |
| `completed` | — | `Command(resume=...)` 已调用，图执行中 | P10 审核报告页（生成中状态） | `/contracts/:id/report` | 「报告生成」加载态 |
| `report_ready` | — | 图执行完成（终态） | P10 审核报告页（就绪状态） | `/contracts/:id/report` | 所有节点已完成 |
| `aborted` | — | 图 thread 不再 resume（终态） | 返回 P03 合同列表页 | `/contracts` | 不显示 WorkflowStatusBar |

---

## 三、组件模块清单（按页面归属）

### 3.1 全局公用组件（P01 ~ P11）

来源：`frontend_design_spec-v1.0.md` 第四章、T1 产出第一章 1.4 节。

| 组件名 | 类型 | 适用页面 | 依赖接口 |
|--------|------|---------|---------|
| `GlobalNav` | 通用组件（顶部全局导航栏） | 所有页面（P02 ~ P11） | 无额外接口（用户信息从登录态读取） |
| `WorkflowStatusBar` | 通用组件（工作流状态进度条） | P05 ~ P10 | `GET /sessions/{session_id}`（初始化）、`GET /sessions/{session_id}/events`（SSE 实时更新） |

**WorkflowStatusBar 节点激活规则**（来源：T1 产出第一章 1.4 节）：

| ReviewSession.state | hitl_subtype | WorkflowStatusBar 激活节点 |
|---------------------|-------------|--------------------------|
| `parsing` | — | 「上传解析」当前激活 |
| `scanning` | — | 「字段核对」或「AI 扫描」当前激活（由前端根据用户当前步骤判断） |
| `hitl_pending` | `interrupt` | 「人工审核」中断态（感叹号 + 橙色） |
| `hitl_pending` | `batch_review` | 「人工审核」中断态（感叹号 + 橙色） |
| `completed` | — | 「报告生成」加载态 |
| `report_ready` | — | 所有节点已完成（勾选图标） |

---

### 3.2 P01 — 登录页（`/login`）

来源：`frontend_design_spec-v1.0.md` 第三章。

| 组件名 | 类型 | 依赖接口 |
|--------|------|---------|
| `LoginPage` | 页面组件 | 登录接口（鉴权服务，api_spec 未覆盖范围） |

---

### 3.3 P02 — 工作台首页（`/dashboard`）

来源：`frontend_design_spec-v1.0.md` 第三章。

| 组件名 | 类型 | 依赖接口 |
|--------|------|---------|
| `DashboardPage` | 页面组件 | 统计数据接口（api_spec 未覆盖范围） |
| `GlobalNav` | 通用组件（复用） | — |

---

### 3.4 P03 — 合同列表页（`/contracts`）

来源：T1 产出第一章 1.1 节。

| 组件名 | 类型 | 依赖接口 |
|--------|------|---------|
| `ContractListPage` | 页面组件 | `GET /contracts` |
| `GlobalNav` | 通用组件（复用） | — |
| `PageHeader` | 业务组件 | — |
| `FilterBar` | 业务组件 | `GET /contracts`（带 `state`、`date_from`、`date_to` 查询参数） |
| `KeywordSearchInput` | 业务组件（嵌入 FilterBar） | `GET /contracts?keyword=xxx`（**「未开发」**，api_spec 未定义 `keyword` 参数） |
| `StateFilterSelect` | 业务组件（嵌入 FilterBar） | `GET /contracts?state=xxx` |
| `DateRangePicker` | 业务组件（嵌入 FilterBar） | `GET /contracts?date_from=xxx&date_to=xxx` |
| `ContractList` | 业务组件 | `GET /contracts`（游标分页） |
| `ContractListItem` | 业务组件（嵌入 ContractList） | — |
| `StateBadge` | 通用组件（嵌入 ContractListItem） | — |
| `ProgressIndicator` | 业务组件（嵌入 ContractListItem，仅 state=hitl_pending 时显示） | — |
| `ActionGroup` | 业务组件（嵌入 ContractListItem） | 路由守卫依赖 `GET /sessions/{session_id}` |
| `PaginationLoader` | 通用组件 | `GET /contracts?cursor=xxx` |

---

### 3.5 P04 — 合同上传页（`/contracts/upload`）

来源：T1 产出第一章 1.2 节。

| 组件名 | 类型 | 依赖接口 |
|--------|------|---------|
| `ContractUploadPage` | 页面组件 | `POST /contracts/upload` |
| `GlobalNav` | 通用组件（复用） | — |
| `PageHeader` | 业务组件 | — |
| `UploadForm` | 业务组件 | — |
| `ContractTitleInput` | 业务组件（嵌入 UploadForm） | — |
| `FileUploadZone` | 业务组件（嵌入 UploadForm） | — |
| `SelectedFilePreview` | 业务组件（嵌入 FileUploadZone） | — |
| `UploadProgressBar` | 业务组件（嵌入 FileUploadZone） | — |
| `ValidationErrorArea` | 业务组件（嵌入 UploadForm） | — |
| `ServerErrorAlert` | 通用组件（嵌入 ValidationErrorArea） | — |
| `ActionBar` | 业务组件 | `POST /contracts/upload` |
| `SubmitButton` | 通用组件（嵌入 ActionBar） | — |
| `CancelButton` | 通用组件（嵌入 ActionBar） | — |

---

### 3.6 P05 — 解析进度页（`/contracts/:id/parsing`）

来源：T1 产出第一章 1.3 节。

| 组件名 | 类型 | 依赖接口 |
|--------|------|---------|
| `ParsingProgressPage` | 页面组件 | `GET /sessions/{session_id}`、`GET /sessions/{session_id}/events`（SSE） |
| `GlobalNav` | 通用组件（复用） | — |
| `WorkflowStatusBar` | 通用组件（复用） | `GET /sessions/{session_id}`、SSE |
| `ParseStatusDisplay` | 业务组件 | SSE（`parse_failed`、`parse_timeout`、`state_changed`） |
| `WaitingGuide` | 业务组件（仅解析中状态显示） | — |
| `RetryArea` | 业务组件（仅失败/超时时显示） | `POST /sessions/{session_id}/retry-parse` |
| `AbortArea` | 业务组件 | `POST /sessions/{session_id}/abort` |

---

### 3.7 P06 — 字段核对页（`/contracts/:id/fields`）

来源：T2 产出第二章 2.1 节、`frontend_design_spec-v1.0.md` 第三章。

| 组件名 | 类型 | 依赖接口 |
|--------|------|---------|
| `FieldVerificationPage` | 页面组件 | `GET /sessions/{session_id}/fields` |
| `GlobalNav` | 通用组件（复用） | — |
| `WorkflowStatusBar` | 通用组件（复用） | `GET /sessions/{session_id}`、SSE |
| `FieldVerificationCard` | 业务组件（逐条字段） | `GET /sessions/{session_id}/fields`、`PATCH /sessions/{session_id}/fields/{field_id}` |
| `ConfidenceBadge` | 通用组件（嵌入 FieldVerificationCard） | — |

**FieldVerificationCard 说明**：
- 展示 AI 提取字段的名称、原始提取值、置信度。
- 低置信度字段（`needs_human_verification=true`）使用橙色边框。
- 支持 confirm / modify / skip 三种操作，操作成功后禁用按钮区并展示已操作状态标签。
- 置信度颜色规则：≥ 85 绿色、60~84 黄色、< 60 橙红色（来自 api_spec 第 5.1 节）。

---

### 3.8 P07 — AI 扫描进度页（`/contracts/:id/scanning`）

来源：T2 产出第一章（`RiskLevelBadge` 在 P07 使用）、`frontend_design_spec-v1.0.md` 第三章。

| 组件名 | 类型 | 依赖接口 |
|--------|------|---------|
| `AIScanningPage` | 页面组件 | `GET /sessions/{session_id}/events`（SSE） |
| `GlobalNav` | 通用组件（复用） | — |
| `WorkflowStatusBar` | 通用组件（复用） | `GET /sessions/{session_id}`、SSE |
| `RiskLevelBadge` | 通用组件（扫描进度实时计数区） | SSE `scan_progress` 事件 |

---

### 3.9 P08 — HITL 中断审核页（`/contracts/:id/review`）

来源：T2 产出第一章、T3 产出第一章 1.1~1.2 节、`frontend_design_spec-v1.0.md` 第三章。

| 组件名 | 类型 | 依赖接口 |
|--------|------|---------|
| `HITLReviewPage` | 页面组件 | `GET /sessions/{session_id}`、`GET /sessions/{session_id}/items`、`GET /sessions/{session_id}/events`（SSE） |
| `GlobalNav` | 通用组件（复用） | — |
| `WorkflowStatusBar` | 通用组件（复用） | `GET /sessions/{session_id}`、SSE |
| `RecoveryBanner` | 业务组件（仅跨天恢复时显示） | `GET /sessions/{session_id}/recovery` |
| `DualPaneView` | 业务组件（双栏对照视图父组件） | — |
| `RiskItemCard` | 业务组件（左栏，逐条条款，mode="decision"） | `GET /sessions/{session_id}/items`、`POST /sessions/{session_id}/items/{item_id}/decision`、`DELETE /sessions/{session_id}/items/{item_id}/decision` |
| `RiskLevelBadge` | 通用组件（嵌入 RiskItemCard） | — |
| `SourceBadge` | 通用组件（嵌入 RiskItemCard） | — |
| `DecisionHistoryPanel` | 业务组件（条款详情展开区，仅 reviewer/admin 可见） | `GET /sessions/{session_id}/items/{item_id}` |
| `RiskEvidenceHighlight` | 业务组件（右栏原文定位与高亮） | `GET /sessions/{session_id}/items`（含 `risk_evidence[]`）、**合同原文全文接口（「未开发」）** |
| `ProgressSummaryBar` | 业务组件（底部固定进度汇总栏） | `GET /sessions/{session_id}`（初始）、SSE `item_decision_saved`（实时） |

---

### 3.10 P09 — 批量复核页（`/contracts/:id/batch`）

来源：T3 产出第七章 7.2 节。

| 组件名 | 类型 | 依赖接口 |
|--------|------|---------|
| `BatchReviewPage` | 页面组件 | `GET /sessions/{session_id}/items?risk_level=medium`、`POST /sessions/{session_id}/items/batch-confirm`、`GET /sessions/{session_id}/events`（SSE） |
| `GlobalNav` | 通用组件（复用） | — |
| `WorkflowStatusBar` | 通用组件（复用） | `GET /sessions/{session_id}`、SSE |
| `RiskItemCard` | 业务组件（逐条中风险条款，mode="readonly"） | `GET /sessions/{session_id}/items` |
| `RiskLevelBadge` | 通用组件（嵌入 RiskItemCard） | — |
| `SourceBadge` | 通用组件（嵌入 RiskItemCard） | — |
| `RiskEvidenceHighlight` | 业务组件（可选辅助视图） | `GET /sessions/{session_id}/items`（含 `risk_evidence[]`） |
| `BatchOperationBar` | 业务组件（底部固定，勾选 ≥ 1 条时显示） | `POST /sessions/{session_id}/items/batch-confirm` |

**说明**：中风险单条 Reject 操作接口**「未开发」**，api_spec 中无独立接口，参见第五章。

---

### 3.11 P10 — 审核报告页（`/contracts/:id/report`）

来源：`frontend_design_spec-v1.0.md` 第三章、T2 产出第一章（`SourceBadge`、`RiskLevelBadge`、`DecisionHistoryPanel` 在 P10 使用）。

| 组件名 | 类型 | 依赖接口 |
|--------|------|---------|
| `ReportPage` | 页面组件 | `GET /sessions/{session_id}/report`、`GET /sessions/{session_id}/events`（SSE，等待 `report_ready`） |
| `GlobalNav` | 通用组件（复用） | — |
| `WorkflowStatusBar` | 通用组件（复用） | `GET /sessions/{session_id}`、SSE |
| `ReportSummaryCard` | 业务组件（执行摘要卡片） | `GET /sessions/{session_id}/report` |
| `ReportItemDetail` | 业务组件（逐条详细分析，含条款原文、AI 判断、人工决策） | `GET /sessions/{session_id}/report`（含 ReviewItem 数组） |
| `RiskLevelBadge` | 通用组件（嵌入 ReportItemDetail） | — |
| `SourceBadge` | 通用组件（嵌入 ReportItemDetail） | — |
| `DecisionHistoryPanel` | 业务组件（仅 reviewer/admin 可见） | `GET /sessions/{session_id}/items/{item_id}` |
| `CoverageStatement` | 业务组件（覆盖范围声明，强制展示） | `GET /sessions/{session_id}/report`（`coverage_statement` 字段） |
| `Disclaimer` | 业务组件（免责声明，强制展示） | `GET /sessions/{session_id}/report`（`disclaimer` 字段） |
| `ReportDownloadArea` | 业务组件 | `GET /sessions/{session_id}/report/download?format=pdf\|json` |

---

### 3.12 P11 — 系统管理页（`/admin`）

来源：`frontend_design_spec-v1.0.md` 第三章。

| 组件名 | 类型 | 依赖接口 |
|--------|------|---------|
| `AdminPage` | 页面组件 | 管理接口（api_spec 未覆盖范围） |
| `GlobalNav` | 通用组件（复用） | — |

---

## 四、HITL 交互状态机摘要

来源：T3 产出第一章至第七章。

### 4.1 四个流程的状态转换摘要

#### Approve 流程（适用于高风险条款，P08）

```
[条款状态: pending]
    │
    ▼
Step 1  用户点击左栏条款卡片
        → 右栏 smooth scroll 至高亮段落（延迟 ≤ 100ms）
        → IntersectionObserver 检测主要证据进入视野（intersectionRatio ≥ 0.5）
        → condition_A（原文视野检测）= true
    │
    ▼
Step 2  用户填写 human_note（≥ 10 字）
        → 实时字符计数，condition_B = true
    │
    ▼
Step 3  condition_A AND condition_B 均为 true
        → Approve 按钮由 disabled → enabled
    │
    ▼
Step 4  用户点击 Approve 按钮
        → 触发不可跳过的二次确认弹窗
          （展示：条款摘要 / 风险等级 / human_note 完整内容 / 决策类型）
    │
    ▼
Step 5  用户点击「确认提交」
        → 前端生成 Idempotency-Key（UUID v4）
        → POST /sessions/{session_id}/items/{item_id}/decision
          body: { decision: "approve", human_note, client_submitted_at, ... }
        → 按钮进入 loading 状态
    │
    ▼
Step 6  成功（HTTP 201）
        → 条款卡片更新为「已批准」（绿色标记）
        → decided_high_risk + 1（乐观更新）
        → 若 all_high_risk_completed = true：展示过渡提示
    │
    ▼
Step 7  SSE event: item_decision_saved 到达
        → 更新进度计数，自动聚焦下一条 pending 条款
    │
    ▼（若 all_high_risk_completed = true）
Step 8  SSE event: report_generation_started 到达
        → 自动跳转至 /contracts/:id/report
```

**终态**：`条款状态 = approved`，或 Revoke 后回到 `pending`。

---

#### Edit 流程（适用于高风险条款，P08）

```
[条款状态: pending]
    │
    ▼
Step 1  用户点击左栏条款卡片 → 右栏 smooth scroll
    │
    ▼
Step 2  用户点击「Edit」按钮（无原文视野前置要求）→ 展开 Edit 表单
    │
    ▼
Step 3  用户填写 Edit 表单（三项均为必填）：
        - edited_risk_level（下拉选择，condition_E1）
        - edited_finding（文本域，condition_E2）
        - human_note（≥ 10 字，condition_B）
        → 三项均满足后，「提交修正」按钮解锁
    │
    ▼
Step 4  用户点击「提交修正」→ 触发二次确认弹窗
        （展示：原风险等级 / 修正后等级 / 修正描述 / human_note / 决策类型）
    │
    ▼
Step 5  确认提交 → POST /sessions/{session_id}/items/{item_id}/decision
        body: { decision: "edit", edited_risk_level, edited_finding, human_note, ... }
    │
    ▼
Step 6  成功（HTTP 201）→ 条款卡片状态更新为「已修正」（橙色标签）
        → SSE item_decision_saved 更新进度
```

**终态**：`条款状态 = edited`，或 Revoke 后回到 `pending`。

---

#### Reject 流程（适用于高风险条款，P08）

```
[条款状态: pending]
    │
    ▼
Step 1  用户点击左栏条款卡片 → 右栏 smooth scroll
    │
    ▼
Step 2  用户点击「Reject」按钮 → 展开 Reject 表单
    │
    ▼
Step 3  用户填写 Reject 表单：
        - is_false_positive 勾选框（选填）
        - human_note（≥ 10 字，condition_B）
        → condition_B 满足后，Reject 提交按钮解锁
    │
    ▼
Step 4  用户点击「提交拒绝」→ 触发二次确认弹窗
        （展示：条款摘要 / AI 误报标记 / human_note / 决策类型）
    │
    ▼
Step 5  确认提交 → POST /sessions/{session_id}/items/{item_id}/decision
        body: { decision: "reject", human_note, is_false_positive, ... }
    │
    ▼
Step 6  成功（HTTP 201）→ 条款卡片状态更新为「已拒绝」（灰色标签）
        → 若 is_false_positive = true：额外显示「AI 误报」标记
        → SSE item_decision_saved 更新进度
```

**终态**：`条款状态 = rejected`，或 Revoke 后回到 `pending`。

---

#### Revoke 流程（适用于高风险条款，P08，仅 session.state=hitl_pending 时可用）

```
[条款状态: approve / edit / reject]
    │
    ▼
Step 1  用户点击已处理条款卡片上的「撤销决策」按钮
        （前提：session.state = hitl_pending；报告生成后按钮消失或禁用）
    │
    ▼
Step 2  弹出撤销确认弹窗
        （展示：将撤销的条款摘要 / 当前决策 / 撤销后状态说明）
    │
    ▼
Step 3  用户点击「确认撤销」
        → DELETE /sessions/{session_id}/items/{item_id}/decision
    │
    ▼
Step 4  成功（HTTP 200，返回 human_decision: "pending"）：
        → 条款卡片恢复「待处理」状态（pending 标签）
        → 操作区（Approve/Edit/Reject）重新展开
        → decided_high_risk - 1（乐观更新）
        → all_high_risk_completed 若之前为 true，回退为 false
        失败（HTTP 409, SESSION_STATE_CONFLICT）：
        → 展示错误 Toast：「当前会话状态不允许撤销决策」
```

**终态**：`条款状态 = pending`，可重新执行 Approve/Edit/Reject。

---

### 4.2 防 Automation Bias 机制的前端实现清单

来源：T3 产出第六章、T2 产出第五章 5.3 节。

| 机制 | 触发范围 | 前端实现方式 | 执行组件 |
|------|----------|------------|---------|
| 原文视野强制检测 | 高风险条款 Approve 按钮解锁前置条件一 | `IntersectionObserver` 监听 `is_primary=true` 证据高亮块；intersectionRatio ≥ 0.5 时 condition_A = true；右栏滚动条旁显示引导箭头 | `RiskEvidenceHighlight`（上报）、`RiskItemCard`（消费） |
| human_note 字符计数 | 高风险条款 Approve / Edit / Reject 按钮解锁前置条件 | 实时字符计数（onChange，无防抖）；< 10 字时按钮保持 disabled + 显示「还需输入 X 字」红色提示；≥ 10 字时显示绿色确认 | `RiskItemCard`（decision 模式） |
| 二次确认弹窗 | 高风险条款 Approve / Edit / Reject 三种决策 | Modal Dialog（居中遮罩，背景不可点击关闭，不可通过 ESC 关闭）；展示条款摘要 + 决策类型 + human_note 完整内容 | `RiskItemCard`（decision 模式） |
| 连续快速操作警示 | 同会话连续 5 条高风险均在 10 秒内 Approve | 前端本地计时器数组 `approveTimestamps[]`；每次 Approve 成功后记录时间戳；最近 5 条最大间隔 < 10000ms 时触发警示弹窗；弹窗后计时器清空 | `HITLReviewPage`（页面级） |
| 禁止批量操作入口 | 高风险条款（P08） | mode="decision" 且 risk_level="HIGH" 时，不渲染勾选框、批量按钮，彻底不存在于 DOM 中（非 display:none） | `RiskItemCard`（decision 模式） |

**连续快速操作警示弹窗内容**（来自 T3 产出 6.4 节）：
- 标题：「注意：检测到快速批量审批行为」
- 内容：提示连续批准了 5 条高风险条款，请求用户确认已仔细评估。
- 按钮：「返回重新审核」（关闭弹窗，不影响已提交决策）/ 「确认，我已认真评估」（关闭弹窗，重置计时器数组）。
- 此机制仅为 UI 警示，不阻止用户继续操作；警示触发记录由后端 bias_warning 日志保存，前端不生成日志。

---

## 五、API 接口对应关系汇总表

### 5.1 已开发接口汇总（按功能分组）

来源：T1 产出第四章、T2 产出各组件规范、T3 产出第十章、api_spec-v1.0.md 附录。

| 联调优先级 | HTTP 方法 | 接口路径 | 功能说明 | 使用页面/组件 | 来源 Teammate |
|-----------|----------|---------|---------|--------------|--------------|
| P0 | POST | `/contracts/upload` | 上传合同文件，创建 ReviewSession | P04 上传页 `SubmitButton` | T1 |
| P0 | GET | `/sessions/{session_id}/events`（SSE） | 实时事件流（全程订阅） | P05~P10 `WorkflowStatusBar`、各页面 SSE 联动 | T1、T2、T3 |
| P0 | GET | `/sessions/{session_id}` | 会话状态与进度（路由守卫、WorkflowStatusBar 数据源） | 路由守卫、`WorkflowStatusBar`、P08 `ProgressSummaryBar` | T1、T2、T3 |
| P1 | GET | `/sessions/{session_id}/fields` | 结构化字段列表（字段核对视图） | P06 `FieldVerificationCard` | T2 |
| P1 | PATCH | `/sessions/{session_id}/fields/{field_id}` | 提交字段核验（confirm/modify/skip） | P06 `FieldVerificationCard` | T2 |
| P1 | GET | `/sessions/{session_id}/items` | 审核条款列表（HITL 左栏、P09 列表） | P08 `RiskItemCard`、P09 `BatchReviewPage` | T2、T3 |
| P1 | POST | `/sessions/{session_id}/items/{item_id}/decision` | 提交 HITL 决策（Approve/Edit/Reject） | P08 `RiskItemCard`（需携带 `Idempotency-Key`） | T2、T3 |
| P2 | GET | `/sessions/{session_id}/items/{item_id}` | 单条条款详情（含 decision_history） | P08 `DecisionHistoryPanel`（懒加载）、P10 `DecisionHistoryPanel` | T2 |
| P2 | DELETE | `/sessions/{session_id}/items/{item_id}/decision` | 撤销 HITL 决策 | P08 `RiskItemCard` Revoke 流程 | T3 |
| P2 | GET | `/sessions/{session_id}/report` | 报告内容查询 | P10 `ReportPage` | T1（接口覆盖说明）|
| P2 | GET | `/sessions/{session_id}/report/download` | 报告文件下载（PDF/JSON） | P10 `ReportDownloadArea` | T1（接口覆盖说明）|
| P2 | GET | `/contracts` | 合同列表（含 state/date 筛选、游标分页） | P03 `ContractList`、`FilterBar` | T1 |
| P3 | GET | `/sessions/{session_id}/recovery` | 跨天恢复断点信息 | P08 `RecoveryBanner`、路由守卫跨天恢复 | T1、T3 |
| P3 | POST | `/sessions/{session_id}/retry-parse` | 重试 OCR 解析（失败后，最多 3 次） | P05 `RetryArea` | T1 |
| P3 | POST | `/sessions/{session_id}/abort` | 放弃审核流程（不可逆） | P05 `AbortArea` | T1 |
| P3 | POST | `/sessions/{session_id}/items/batch-confirm` | 批量确认中风险条款 | P09 `BatchOperationBar` | T3 |
| P3 | GET | `/contracts/{contract_id}` | 合同详情（含历史会话列表） | 路由守卫按需引用 | T1 |

---

### 5.2 「未开发」接口汇总

来源：T1 产出第四章 4.1 节、T2 产出第五章 5.7 节、T3 产出第七章 7.4 节、第十章 10.6 节。

| 联调优先级（建议） | 场景 | 接口路径（示意） | 未开发说明 | 涉及组件/页面 | 来源 Teammate |
|------------------|------|----------------|-----------|--------------|--------------|
| P0 | 合同原文全文获取 | 待定（如 `GET /sessions/{session_id}/contract-text`） | api_spec-v1.0 中未提供返回合同原文全文文本的接口；`GET /sessions/{id}/items` 仅返回证据片段（`evidence_text + context_before/after`），不含完整原文。前端目前只能基于片段拼接局部视图，无法实现完整原文双栏对照视图。 | P08 `RiskEvidenceHighlight`（contractText Prop 数据来源待定） | T2 |
| P1 | 右栏点击高亮反向联动左栏 | 无独立接口（前端交互确认） | 用户点击右栏高亮块时激活左栏对应卡片的交互，在前端设计规范和 API 规范中均未明确定义，建议作为 P1 迭代优化项。 | P08 `RiskEvidenceHighlight` → `RiskItemCard` | T2 |
| P2 | P09 中风险单条 Reject | 待定（如 `POST /sessions/{id}/items/{item_id}/decision`，但需后端支持非 hitl_subtype=interrupt 场景） | api_spec 中无中风险条款单条拒绝的独立接口；`batch-confirm` 仅支持批量批准（approve）场景，无拒绝功能。若需支持单条拒绝，需后端新增接口或扩展现有接口。 | P09 单条 Reject 操作 | T3 |
| P2 | 关键字搜索合同名称 | `GET /contracts?keyword=xxx`（示意） | api_spec 第十章 `GET /contracts` 接口未定义 `keyword` 查询参数。前端 `KeywordSearchInput` 组件在联调阶段需与后端确认是否新增搜索接口或改为前端本地过滤。 | P03 `KeywordSearchInput` | T1 |
| P2 | hybrid 来源类型展示规范 | 无独立接口（前端 UI 规范确认） | `source_type = "hybrid"` 的视觉规范（颜色、边框、Tooltip 文字）未在前端设计规范或 API 规范中定义，`SourceBadge` 当前以蓝紫色双色标签兜底展示，待 PM 确认。 | P08/P09/P10 `SourceBadge` | T2 |

---

## 六、设计红线落地清单

来源：T1 产出（P03/P04/P05 相关约定）、T2 产出第五章、T3 产出第六章、`frontend_design_spec-v1.0.md` 第五章、api_spec-v1.0.md 相关约束。

| 编号 | 设计红线 | 来源 | 前端执行组件/页面 | 验收标准 |
|------|---------|------|----------------|---------|
| R01 | AI 结论必须使用模态表述，禁止绝对化语言。`ai_finding` 字段内容原文展示，前端不对文本做任何截断、改写或添加绝对化结论。 | 前端设计规范第 5.3 节；前后端边界规范第 8 节 | `RiskItemCard`（AI 分析区）；P07 扫描进度页禁止显示「无风险」或「扫描通过」等文字 | Code review 确认 `ai_finding` 展示代码无任何字符串拼接或前端自生成文字 |
| R02 | 来源标签必须颜色 + 边框双维度区分（色盲友好）。`rule_engine`：蓝色背景 + 实线边框；`ai_inference`：紫色背景 + 虚线边框。任意单一维度失效不影响区分度。 | 前端设计规范第 4.4 节；前后端边界规范第 8 节 | `SourceBadge`（P08/P09/P10） | 使用灰度截图验证，两种标签仍可通过边框线型区分；联调必查项 |
| R03 | 高风险条款严禁批量操作。P08 高风险条款列表区域不渲染任何批量操作元素（勾选框、批量按钮），且为彻底不存在于 DOM 中，非 display:none。 | 前端设计规范第 5.1 节；前后端边界规范第 2.3 节 | `RiskItemCard`（mode="decision"，risk_level="HIGH"）；`HITLReviewPage`（P08 页面级） | DOM 检查：高风险条款卡片中不存在任何 `type="checkbox"` 或批量操作相关元素 |
| R04 | Approve 按钮有两项前置条件：① 原文对应高亮区域已进入视野（condition_A），② human_note ≥ 10 字（condition_B）。两项均满足才解锁。 | 前端设计规范第 5.1 节 | `RiskItemCard`（Approve 按钮）；`RiskEvidenceHighlight`（上报 condition_A） | 交互测试：未滚动至原文时 Approve 按钮 disabled；未填 10 字时仍保持 disabled |
| R05 | Approve/Edit/Reject 三种决策均需触发不可跳过的二次确认弹窗。弹窗不可通过 ESC 键或点击遮罩层关闭。 | 前端设计规范第 5.1 节；T3 产出 6.3 节 | `RiskItemCard`（decision 模式，所有三种决策） | 交互测试：点击 ESC 或遮罩不关闭弹窗 |
| R06 | 连续快速操作警示：同会话 5 条高风险条款的 Approve 决策每条间隔均 < 10 秒时触发警示弹窗。 | 前端设计规范第 5.1 节；T3 产出 6.4 节 | `HITLReviewPage`（页面级计时器） | 测试：模拟快速 Approve 5 条触发警示弹窗；警示后计时器重置 |
| R07 | `decision_history` 仅 reviewer/admin 角色可见。`submitter` 角色时 `DecisionHistoryPanel` 返回 null，不渲染任何内容。 | api_spec 第 2.2 节权限矩阵；前后端边界规范第 4.1 节 | `DecisionHistoryPanel`（P08/P10） | 使用 submitter 账号访问 P08/P10，确认无历史记录区域渲染 |
| R08 | 置信度颜色来自后端 `confidence_score` 字段，前端按阈值映射（≥85 绿色 / 60~84 黄色 / <60 橙红色）。`needs_human_verification` 是后端权威判断，前端不得用 `confidence_score < 60` 自行计算替代。 | api_spec 第十一章联调验证；前后端边界规范 | `FieldVerificationCard`、`RiskItemCard` | 联调验证：置信度颜色与 API 返回值一致；不存在前端自行推断的硬编码逻辑 |
| R09 | 原文高亮色由后端 `risk_evidence[].highlight_color` 字段指定，前端不得根据 `risk_level` 自行计算颜色。 | api_spec 第 6.1 节 | `RiskEvidenceHighlight` | 联调验证：高亮色块 background-color 值与 API 响应 `highlight_color` 字段一致 |
| R10 | 审核报告页的 `coverage_statement`（覆盖范围声明）和 `disclaimer`（免责声明）为强制展示元素，不可收起或隐藏。 | 前端设计规范第三章 P10；api_spec 第八章 8.1 节 | `CoverageStatement`、`Disclaimer`（P10） | 联调验证：报告页必须展示两个区域；无隐藏开关 |
| R11 | `StateBadge` 的颜色映射和文字标签严格基于后端返回的 `ReviewSession.state` 字段，前端不自行推断状态。 | T1 产出第一章 1.1 节 | `StateBadge`（P03 `ContractListItem`） | Code review 确认 `StateBadge` 颜色映射从 API 字段读取 |
| R12 | P04 上传页前端格式校验（PDF/DOCX）和文件大小校验（50MB）为辅助性校验，不替代后端校验。上传期间 `SubmitButton` 和 `CancelButton` 均禁用，防止重复提交。 | T1 产出第一章 1.2 节；api_spec 第三章 3.1 节 | `ContractUploadPage`（P04）、`ActionBar` | 交互测试：上传期间按钮禁用；后端错误响应正确展示对应中文提示 |
| R13 | P03 合同列表页不维护常驻 SSE 连接（列表页不建立 SSE 连接，仅在用户进入具体合同页面后才建立）。 | T1 产出第三章 3.4 节 | `ContractListPage`（P03） | Code review 确认 P03 不存在 SSE 连接建立逻辑 |

---

## 七、各 Teammate 产出索引

### 7.1 T1 — 前端规划 Teammate 1：文档上传与任务状态路由

**文档路径**：`docs/09_frontend_plan/t1_upload_and_task_routing.md`

**内容概述**：负责前端路由层面的核心规划，包括：
- P03（合同列表页）、P04（合同上传页）、P05（解析进度页）三个页面的完整组件树。
- P05~P10 全局公用的 `WorkflowStatusBar` 组件结构与节点激活规则。
- 完整路由树总览及 SSE 事件驱动的页面跳转规则。
- 路由守卫执行序列（五步骤）和守卫决策矩阵。
- 跨天恢复路由（断点恢复场景五步骤）。
- 所有 SSE 事件与页面联动规则（P05 专属、WorkflowStatusBar 全局、P03/P04 说明）。
- P03/P04/P05/WorkflowStatusBar/路由守卫的接口对应关系（含「未开发」标注：关键字搜索接口）。
- `ReviewSession.state` → 页面跳转映射总表（权威参考）。

**本文档引用关系**：本文档第二章路由结构、第三章 3.4/3.5/3.6 节组件清单、第五章接口表 P0/P2/P3 优先级接口均直接来源于 T1 产出。

---

### 7.2 T2 — 前端规划 Teammate 2：审核展示组件规划

**文档路径**：`docs/09_frontend_plan/t2_review_components.md`

**内容概述**：负责 P06 至 P10 核心审核组件的详细规范，包括：
- 六个核心组件的完整层级结构、Props 定义、交互逻辑：`FieldVerificationCard`（P06）、`RiskItemCard`（P07/P08/P09，mode="readonly"/"decision"）、`RiskEvidenceHighlight`（P08/P09 右栏）、`SourceBadge`（P08/P09/P10）、`RiskLevelBadge`（P07/P08/P09/P10）、`DecisionHistoryPanel`（P08/P10）。
- 组件间通信规则：`DualPaneView` 父组件状态提升模式（左右栏联动数据流）、`DecisionHistoryPanel` 懒加载通信、`FieldVerificationCard` 批量进度通信、SSE 实时事件触发组件更新。
- 四个组件的 API 字段映射表（字段路径 → 接口 → 展示位置 → 展示方式）。
- 六条设计红线的组件级落地方式（AI 结论模态表述、来源标签双维度、防 Automation Bias、decision_history 权限、置信度颜色来源、高亮色来源）。
- 三项「未开发」功能点标注（合同原文全文接口 P0、右栏反向联动 P1、hybrid 来源规范 P2）。

**本文档引用关系**：本文档第三章 3.7~3.11 节组件清单、第四章防 Automation Bias 机制、第五章接口表 P1/P2 优先级接口、第六章设计红线 R01/R02/R03/R04/R07/R08/R09 均直接来源于 T2 产出。

---

### 7.3 T3 — 前端规划 Teammate 3：前端 HITL 交互 UI 设计

**文档路径**：`docs/09_frontend_plan/t3_hitl_ui_design.md`

**内容概述**：负责 P08 HITL 中断审核页和 P09 批量复核页的完整交互流程规划，包括：
- HITL 交互流程总览（P08 进入路径、三条决策路径、P09 批量复核进入路径）。
- Approve / Edit / Reject 三个流程的详细步骤状态机（8~9 步，含条件汇聚规则、二次确认弹窗内容规范、SSE 联动）。
- Revoke 流程步骤层级（含 Revoke 后状态一致性处理和乐观更新说明）。
- 防 Automation Bias UI 设计：原文视野检测实现层级（IntersectionObserver）、human_note 字符计数 UI 规范（状态变化规则）、二次确认弹窗通用规格、连续快速操作警示机制（计时器逻辑 + 警示弹窗行为）、禁止批量操作入口规范（DOM 节点彻底不渲染）。
- P09 批量复核页交互设计：页面结构、批量确认流程步骤、单条操作、中风险与高风险严格区分规范对比表。
- 进度汇总区 UI 规范（双通道更新机制：SSE + 乐观更新）。
- 跨天恢复 Banner 设计（触发条件、内容结构、行为规范、Recovery 接口字段使用说明）。
- P08/P09/进度汇总区/跨天恢复/防 Automation Bias 的接口对应关系（含「未开发」标注：P09 中风险单条 Reject 接口）。

**本文档引用关系**：本文档第四章 HITL 状态机（全部内容）、第三章 3.9/3.10 节组件清单（P08/P09）、第五章接口表 P1/P2/P3 优先级接口、第六章设计红线 R03/R04/R05/R06/R12 均直接来源于 T3 产出。

---

*本文档严格基于上述五份输入文档的既有定义，不包含超出其范围的新增假设。所有「未开发」项均来自三位 Teammate 的原始标注，需在联调阶段与后端确认接口补充方案。*
