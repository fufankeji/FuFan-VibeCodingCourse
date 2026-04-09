# 前端设计规范 v1.0

**文档编号**：06_architecture/frontend_design_spec-v1.0
**版本**：v1.0
**编写日期**：2026-03-11
**输入文档**：
- `03_problem_modeling/problem_model.md`
- `04_interaction_design/flow_state_spec-v1.0.md`

---

## 一、页面清单

| 页面 ID | 页面名称 | 路由路径 | 适用角色 | 对应 ReviewSession.state |
|---------|---------|---------|---------|--------------------------|
| P01 | 登录页 | `/login` | all | — |
| P02 | 工作台首页 | `/dashboard` | all | — |
| P03 | 合同列表页 | `/contracts` | reviewer / submitter | — |
| P04 | 合同上传页 | `/contracts/upload` | reviewer / submitter | — |
| P05 | 解析进度页 | `/contracts/:id/parsing` | reviewer | `parsing` |
| P06 | 字段核对页 | `/contracts/:id/fields` | reviewer | `scanning`（扫描前） |
| P07 | AI 扫描进度页 | `/contracts/:id/scanning` | reviewer | `scanning`（扫描中） |
| P08 | HITL 中断审核页 | `/contracts/:id/review` | reviewer | `hitl_pending`（subtype: interrupt） |
| P09 | 批量复核页 | `/contracts/:id/batch` | reviewer | `hitl_pending`（subtype: batch_review） |
| P10 | 审核报告页 | `/contracts/:id/report` | reviewer / submitter | `report_ready` |
| P11 | 系统管理页 | `/admin` | admin | — |

> **路由守卫规则**：访问 `/contracts/:id` 时，前端根据后端返回的 `ReviewSession.state` 和 `hitl_pending.subtype` 自动重定向到对应的功能页（P05~P10）。

---

## 二、路由结构与跳转关系

```
/login
  └─ 认证成功 ──────────────────────────────────► /dashboard

/dashboard
  ├─ 新建审核 ───────────────────────────────────► /contracts/upload
  ├─ 查看全部合同 ───────────────────────────────► /contracts
  └─ 待我处理（直接恢复中断会话） ────────────────► /contracts/:id/review

/contracts
  ├─ 新建审核 ───────────────────────────────────► /contracts/upload
  └─ 点击某条合同（路由守卫按 state 重定向）
       ├─ state=parsing         ─────────────────► /contracts/:id/parsing
       ├─ state=scanning        ─────────────────► /contracts/:id/fields
       │                                           （或 /contracts/:id/scanning）
       ├─ state=hitl_pending/interrupt ──────────► /contracts/:id/review
       ├─ state=hitl_pending/batch_review ───────► /contracts/:id/batch
       └─ state=report_ready / completed ────────► /contracts/:id/report

/contracts/upload
  └─ 上传成功，创建 ReviewSession ──────────────► /contracts/:id/parsing

/contracts/:id/parsing        [state: parsing]
  └─ OCR 完成（state → scanning） ─────────────► /contracts/:id/fields

/contracts/:id/fields         [state: scanning, 扫描前]
  └─ 用户触发 AI 扫描 ──────────────────────────► /contracts/:id/scanning

/contracts/:id/scanning       [state: scanning, 扫描中]
  ├─ 路由结果：低风险（auto-passed） ───────────► /contracts/:id/report
  ├─ 路由结果：中风险（batch_review） ──────────► /contracts/:id/batch
  └─ 路由结果：高风险（interrupt） ─────────────► /contracts/:id/review

/contracts/:id/review         [state: hitl_pending/interrupt]
  └─ 全部高风险条款处理完成 ────────────────────► /contracts/:id/report

/contracts/:id/batch          [state: hitl_pending/batch_review]
  └─ 批量复核完成 ──────────────────────────────► /contracts/:id/report

/contracts/:id/report         [state: report_ready]（终态页）

/admin                        [仅 admin 角色可访问]
```

---

## 三、各页面结构层次

### P01 — 登录页（`/login`）

```
LoginPage
├── 页头区
│   └── 产品 Logo + 产品名称
├── 登录表单区
│   ├── 用户名输入框
│   ├── 密码输入框
│   └── 登录按钮
└── 底部区
    └── 版权声明
```

**核心交互**：
- 登录成功后根据用户角色跳转（reviewer/submitter → `/dashboard`；admin → `/admin`）
- 表单校验提示（非空校验、错误提示）

---

### P02 — 工作台首页（`/dashboard`）

```
DashboardPage
├── 顶部全局导航栏（GlobalNav）
│   ├── Logo
│   ├── 主导航菜单（工作台 / 合同列表 / 系统管理[admin专属]）
│   └── 用户头像 + 角色标识 + 退出登录
├── 主内容区
│   ├── 统计数据卡片区
│   │   ├── 待处理合同数
│   │   ├── 本月已完成数
│   │   └── 今日新增数
│   ├── 「待我处理」模块
│   │   └── 中断会话列表（合同名 / 状态 / 中断时间 / 继续审批按钮）
│   └── 「最近审核」列表
│       └── 最近 10 条审核记录（合同名 / 状态 / 完成时间）
└── 快捷操作区
    └── 新建审核按钮（→ P04）
```

**核心交互**：
- 「继续审批」按钮直接进入中断点（对应 P08），显示恢复进度 banner
- 统计数据由后端提供，仅展示，不可在首页操作

---

### P03 — 合同列表页（`/contracts`）

```
ContractListPage
├── 顶部全局导航栏（GlobalNav，复用）
├── 页面标题区
│   ├── 页面标题「合同列表」
│   └── 新建审核按钮（→ P04）
├── 筛选/搜索栏
│   ├── 关键字搜索（合同名称）
│   ├── 状态筛选（全部 / 解析中 / 审核中 / 待人工介入 / 已完成 / 已中止）
│   └── 上传时间范围选择器
└── 合同列表
    └── 合同卡片（逐行）
        ├── 合同名称
        ├── 上传人 / 上传时间
        ├── 状态标签（颜色与 state 对应）
        └── 操作入口（查看详情 / 继续审批 / 查看报告）
```

**核心交互**：
- 点击合同行 → 路由守卫按 `state` 跳转至对应功能页
- 「继续审批」仅在 `state=hitl_pending` 时显示
- 分页加载，默认按上传时间倒序

---

### P04 — 合同上传页（`/contracts/upload`）

```
ContractUploadPage
├── 顶部全局导航栏（GlobalNav，复用）
├── 页面标题「新建合同审核」
├── 上传表单区
│   ├── 合同名称输入框（必填）
│   ├── 文件上传拖拽区
│   │   ├── 支持格式说明（PDF / DOCX）
│   │   ├── 文件大小限制说明
│   │   └── 上传进度条（上传中）
│   └── 备注字段（可选）
├── 前端校验提示区
│   └── 格式不支持 / 文件过大 / 未选文件 等提示
└── 操作按钮区
    ├── 提交审核按钮（上传并创建会话）
    └── 取消按钮（→ P03）
```

**核心交互**：
- 前端完成格式校验（PDF/DOCX）和文件大小校验（上限由后端配置项决定，前端通过接口获取）
- 上传成功后自动跳转至 P05（解析进度页）
- 上传期间按钮禁用，展示进度条

---

### P05 — 解析进度页（`/contracts/:id/parsing`）

```
ParsingProgressPage
├── 顶部全局导航栏（GlobalNav，复用）
├── 工作流状态进度条（WorkflowStatusBar）           ← 全局固定，高度 64px
│   └── 节点：上传解析[当前] → 字段核对 → AI 扫描 → 分级路由 → 人工审核 → 报告生成
├── 主内容区
│   ├── 解析状态说明区
│   │   ├── 状态图标（加载动画）
│   │   ├── 状态文本「正在解析合同文件…」
│   │   └── 扫描件提示（若 is_scanned_document=true，显示"扫描件 OCR 精度提示"）
│   └── 等待引导区
│       └── 说明文字（解析完成后将自动进入下一步）
└── 操作区
    └── 放弃并返回按钮（触发 session_aborted 事件，→ P03）
```

**核心交互**：
- 页面通过 WebSocket/SSE 订阅 `ReviewSession.state` 变更事件
- state 变为 `scanning` 时，前端自动跳转至 P06（字段核对页）
- 解析超时（>15 分钟）或失败时，展示错误状态 + 重试入口

---

### P06 — 字段核对页（`/contracts/:id/fields`）

```
FieldVerificationPage
├── 顶部全局导航栏（GlobalNav，复用）
├── 工作流状态进度条（WorkflowStatusBar）
│   └── 节点：上传解析[已完成] → 字段核对[当前] → AI 扫描 → 分级路由 → 人工审核 → 报告生成
├── 页面标题区
│   ├── 合同名称
│   └── 说明文字「请核对 AI 提取的结构化字段，确认无误后可启动风险扫描」
├── 结构化字段核对区
│   └── 字段卡片列表（逐行）
│       ├── 字段名称（甲方 / 乙方 / 合同金额 / 生效日期 / 终止条件 / 签署方 …）
│       ├── AI 提取值（可编辑输入框）
│       ├── 置信度数值
│       └── 低置信度标记（confidence_score < 70：橙色边框 + 醒目提示）
├── 低置信度汇总提示区（若有低置信度字段）
│   └── 提示文字「以下字段置信度较低，请重点核对」+ 字段列表
└── 操作区
    ├── 开始 AI 风险扫描按钮（触发扫描，→ P07）
    └── 返回按钮（→ P03）
```

**核心交互**：
- `needs_human_verification=true` 的字段使用橙色边框 + 角标提示，需用户明确核对或修改
- 用户修改字段值 → 触发 `field_modified` 事件，前端记录修改并发送至后端
- 用户跳过低置信度字段核对 → 触发 `field_verify_skipped` 事件（允许跳过，但记录日志）
- 点击「开始 AI 风险扫描」→ 向后端发起扫描触发请求，跳转 P07

---

### P07 — AI 扫描进度页（`/contracts/:id/scanning`）

```
AIScanningPage
├── 顶部全局导航栏（GlobalNav，复用）
├── 工作流状态进度条（WorkflowStatusBar）
│   └── 节点：上传解析[已完成] → 字段核对[已完成] → AI 扫描[当前] → 分级路由 → 人工审核 → 报告生成
├── 扫描进度展示区
│   ├── 扫描状态图标（加载动画）
│   ├── 状态文本「AI 正在扫描风险条款…」
│   ├── 扫描维度清单（已覆盖 / 进行中 / 未覆盖）       ← 来源：后端配置
│   └── 禁止显示"无风险"或绝对化判断文字               ← 设计红线
└── 操作区
    └── 放弃并返回按钮
```

**核心交互**：
- 通过 WebSocket/SSE 订阅 `ReviewSession.state` 变更及路由结果事件
- 收到路由结果后自动跳转：
  - `route_auto_passed` → P10（报告页）
  - `route_batch_review` → P09（批量复核页）
  - `route_interrupted` → P08（HITL 中断审核页）
- 扫描系统失败 → 展示错误状态 + 重试入口

---

### P08 — HITL 中断审核页（`/contracts/:id/review`）

```
HITLReviewPage
├── 顶部全局导航栏（GlobalNav，复用）
├── 工作流状态进度条（WorkflowStatusBar）
│   └── 中断节点：「人工审核」显示感叹号图标 + 橙色 + Tooltip「流程已暂停 - 等待人工操作」
├── 恢复进度 Banner（仅跨天恢复时显示）
│   └── 「已恢复上次审核进度，当前待处理第 N 条高风险条款」
├── 双栏对照视图（DualPaneView）                       ← 核心交互区域
│   ├── 左栏（宽度 42%）：风险条款卡片列表
│   │   └── 风险条款卡片（逐条）
│   │       ├── 条款序号 + 风险等级标签（高/中/低，颜色区分）
│   │       ├── 判断来源标签（规则触发 / AI 推理，颜色 + Tooltip 双重区分）
│   │       ├── 置信度数值 + 不确定性标识
│   │       ├── AI 风险描述（模态表述，禁用绝对化语言）
│   │       ├── 已处理状态标记（approve/edit/reject）
│   │       └── 操作区（仅 high 风险且 state=pending 时展开）
│   │           ├── Approve 按钮（强制检查前三项通过才启用）
│   │           │   ├── 前置条件 1：原文对应区域已滚动至视野内
│   │           │   ├── 前置条件 2：human_note ≥ 10 字
│   │           │   └── 点击后触发二次确认对话框
│   │           ├── Edit 按钮（需 human_note ≥ 10 字 + 修改内容）
│   │           ├── Reject 按钮（需 human_note ≥ 10 字）
│   │           └── 接受原因/修改内容输入框（必填）
│   └── 右栏（宽度 58%）：合同原文只读视图
│       ├── 原文文本（只读）
│       ├── 高亮段落（高风险：浅红 #FFEBEE；中风险：浅橙色）
│       └── 高亮段落左侧竖线（颜色与风险等级一致）
├── 审核进度汇总区（固定在视图底部或侧边）
│   └── 高风险条款处理进度（已处理 N / 共 M 条）
└── 防 Automation Bias 连续快速操作警示
    └── 同会话 5 条高风险均在 10 秒内 Approve，触发警示提示弹窗
```

**核心交互**：
- 页面加载后自动定位至第一条 `risk_level=high && human_decision=pending` 的条款
- 双向关联：点击左侧卡片 → 右侧原文 smooth scroll + 高亮（延迟 ≤100ms）；点击右侧高亮段落 → 左侧对应卡片激活
- Approve 按钮在「原文已进入视野」+「human_note ≥ 10 字」两个条件均满足前保持禁用
- 高风险条款严禁批量操作；前端不提供任何批量入口
- 每次提交操作后状态立即更新（乐观更新 + 后端确认），同时更新进度汇总区
- 全部高风险处理完成后 → 自动触发报告生成请求，跳转 P10

---

### P09 — 批量复核页（`/contracts/:id/batch`）

```
BatchReviewPage
├── 顶部全局导航栏（GlobalNav，复用）
├── 工作流状态进度条（WorkflowStatusBar）
├── 页面标题区
│   └── 「中风险条款批量复核」+ 说明文字（告知审核人员可批量确认）
├── 中风险条款列表
│   └── 条款复核行（逐条）
│       ├── 勾选框（支持多选）
│       ├── 条款摘要
│       ├── 判断来源标签
│       ├── 置信度数值
│       └── 操作按钮（Approve / Reject，单条操作）
├── 批量操作栏（底部固定）
│   ├── 已选 N 条提示
│   └── 批量确认按钮（仅对中风险条款有效）
└── 操作区
    └── 提交复核结果按钮（→ P10 触发报告生成）
```

**核心交互**：
- 中风险条款允许批量确认（与高风险严格区分）
- 提交后触发报告生成流程，跳转 P10

---

### P10 — 审核报告页（`/contracts/:id/report`）

```
ReportPage
├── 顶部全局导航栏（GlobalNav，复用）
├── 工作流状态进度条（WorkflowStatusBar）
│   └── 所有节点已完成，最后节点「报告生成」标记完成
├── 报告状态区
│   ├── 状态：报告生成中（加载态，state=completed）
│   └── 状态：报告已就绪（state=report_ready）
├── 报告内容展示区（state=report_ready 时显示）
│   ├── 执行摘要卡片
│   │   ├── 合同基本信息（来自 ExtractedField）
│   │   ├── 整体风险评估
│   │   ├── 审核结论（非绝对化表述）
│   │   └── 免责声明（必须显示）
│   ├── 详细分析区（逐条 ReviewItem）
│   │   ├── 条款原文
│   │   ├── AI 判断（风险等级 + 置信度 + 判断来源）
│   │   ├── 人工最终决策（approve/edit/reject）
│   │   └── 处理记录（操作人 + 时间 + 备注）
│   └── 覆盖范围声明区（必须显示）
│       ├── 已覆盖条款类型清单
│       └── 未覆盖条款类型清单
└── 导出操作区
    ├── 下载 PDF 按钮
    └── 下载 JSON 按钮
```

**核心交互**：
- state=completed（报告生成中）时，通过 WebSocket/SSE 轮询等待 `report_ready` 事件
- `report_ready` 后自动刷新页面展示报告内容
- 下载操作触发 `report_downloaded` 事件记录（由后端处理日志）
- 免责声明与覆盖范围声明为强制展示元素，不可收起或隐藏

---

### P11 — 系统管理页（`/admin`）

```
AdminPage
├── 顶部全局导航栏（GlobalNav，复用）
├── 左侧管理菜单
│   ├── 用户管理
│   ├── 风险规则配置
│   └── 风险阈值配置
├── 用户管理模块
│   └── 用户列表（id / 姓名 / 角色 / 邮箱 / 操作）
├── 风险规则配置模块
│   └── 规则库列表（规则名称 / 类型 / 启用状态 / 最后更新时间）
└── 风险阈值配置模块
    └── 阈值设置（高风险置信度下限 / 低置信度字段阈值 等）
```

**核心交互**：
- 仅 admin 角色可访问，非 admin 访问时前端路由守卫重定向至 `/dashboard`
- 配置变更需有确认步骤，防止误操作

---

## 四、全局组件规范

### 4.1 顶部全局导航栏（GlobalNav）

| 属性 | 规范 |
|------|------|
| 高度 | 固定高度，全局统一 |
| 内容 | Logo + 主导航菜单 + 用户信息 |
| 权限控制 | 导航菜单项按角色（reviewer / submitter / admin）显示不同入口 |
| 固定方式 | `position: fixed`，所有页面复用 |

### 4.2 工作流状态进度条（WorkflowStatusBar）

| 属性 | 规范 |
|------|------|
| 位置 | 页面顶部固定区域，全局导航栏下方 |
| 高度 | 64px |
| 节点列表 | 上传解析 → 字段核对 → AI 扫描 → 分级路由 → 人工审核 → 报告生成 |
| 当前节点 | 高亮显示 |
| 中断态显示 | 感叹号图标 + 橙色 + Tooltip「流程已暂停 - 等待人工操作」|
| 已完成节点 | 勾选图标 + 灰色 |
| 数据来源 | WebSocket/SSE 订阅 `ReviewSession.state` 变更事件，实时更新 |
| 适用页面 | P05 ~ P10 |

### 4.3 风险等级标签（RiskLevelBadge）

| 等级 | 颜色 | 文字 |
|------|------|------|
| high | 红色 | 高风险 |
| medium | 橙色 | 中风险 |
| low | 绿色/灰色 | 低风险 |

### 4.4 判断来源标签（SourceBadge）

| 来源 | 颜色 | Tooltip |
|------|------|---------|
| rule_engine | 蓝色 | 规则触发 |
| ai_inference | 紫色 | AI 推理 |

> 两种来源必须通过颜色 + 边框样式两个视觉维度区分（色盲友好要求）。

---

## 五、核心交互规范汇总

### 5.1 防 Automation Bias 机制（P08 专属）

| 机制 | 触发范围 | 实现要求 |
|------|----------|---------|
| 强制展开原文 | 高风险条款 Approve | Approve 按钮在用户触达原文对应区域前保持禁用 |
| 必填接受原因 | 高风险条款 Approve / Edit / Reject | `human_note` ≥ 10 字才允许提交 |
| 二次确认对话框 | 高风险条款 Approve | 不可跳过的确认弹窗，展示用户已填写的接受原因 |
| 连续快速操作警示 | 全部高风险条款 | 同一会话 5 条高风险均在 10 秒内 Approve，触发警示弹窗 |
| 禁止批量通过 | 全部高风险条款 | 前端无批量操作入口（任何形式均禁止） |

### 5.2 异步跨天恢复（P08 触发点）

| 属性 | 规范 |
|------|------|
| 恢复入口 | P02「待我处理」模块；P03「继续审批」按钮 |
| 恢复后行为 | 自动滚动至第一条 `human_decision=pending` 的高风险条款，显示恢复进度 banner |
| 并发保护 | 同一会话同时只允许一个活跃用户；锁超时 5 分钟自动释放（由后端控制） |

### 5.3 AI 结论呈现规范（全局）

- 所有 AI 判断必须附带置信度数值
- 风险描述使用模态表述（「可能存在…风险」），禁止绝对化表述
- 扫描中状态禁止显示「无风险」字样
- 低风险自动通过页必须包含免责声明

### 5.4 实时状态更新

- 所有依赖 `ReviewSession.state` 变化的页面，均通过 WebSocket 或 SSE 订阅状态变更事件
- 前端不得通过轮询替代实时推送（防止状态延迟）

---

*本文档严格基于 `03_problem_modeling/problem_model.md` 和 `04_interaction_design/flow_state_spec-v1.0.md` 的内容产出，不包含超出上述文档范围的新增假设。*
