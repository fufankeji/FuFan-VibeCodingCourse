# 审核展示组件规划文档 v1.0

**文档编号**：09_frontend_plan/t2_review_components
**版本**：v1.0
**编写日期**：2026-03-11
**编写角色**：前端规划 Teammate 2
**输入文档**：
- `08_api_spec/api_spec-v1.0.md`
- `06_architecture/frontend_design_spec-v1.0.md`
- `06_architecture/frontend_backend_boundary_spec-v1.0.md`
- `04_interaction_design/langchain_hitl_arch-v1.0.md`

---

## 目录

1. [组件清单总览](#一组件清单总览)
2. [各组件详细规范](#二各组件详细规范)
3. [组件间通信规则](#三组件间通信规则)
4. [数据字段映射表](#四数据字段映射表)
5. [设计红线落地](#五设计红线落地)

---

## 一、组件清单总览

| 组件名 | 挂载页面 | 依赖接口 | 说明 |
|--------|---------|---------|------|
| `FieldVerificationCard` | P06 字段核对页 | `GET /sessions/{id}/fields`、`PATCH /sessions/{id}/fields/{field_id}` | 展示 AI 提取字段与置信度，支持用户核对操作 |
| `RiskItemCard` | P07 AI 扫描进度页（预览）、P08 HITL 中断审核页（左栏）、P09 批量复核页 | `GET /sessions/{id}/items`、`GET /sessions/{id}/items/{item_id}` | 展示风险条款完整信息与当前决策状态 |
| `RiskEvidenceHighlight` | P08 HITL 中断审核页（右栏）、P09 批量复核页（可选） | `GET /sessions/{id}/items`（含 `risk_evidence` 数组） | 依据字符偏移量在原文区域定位高亮风险证据 |
| `SourceBadge` | P08、P09（嵌入 `RiskItemCard`）、P10 审核报告页 | `GET /sessions/{id}/items`（字段：`source_type`） | 展示条款判断来源标签，颜色+边框双维度区分 |
| `RiskLevelBadge` | P08、P09（嵌入 `RiskItemCard`）、P10 审核报告页 | `GET /sessions/{id}/items`（字段：`risk_level`） | 展示风险等级标签，高/中/低三色区分 |
| `DecisionHistoryPanel` | P08 HITL 中断审核页（条款详情展开区）、P10 审核报告页 | `GET /sessions/{id}/items/{item_id}`（含 `decision_history` 数组） | 仅 reviewer/admin 角色可见，展示操作审计历史 |

---

## 二、各组件详细规范

---

### 2.1 FieldVerificationCard — 字段核对卡片

**挂载页面**：P06 字段核对页（`/contracts/:id/fields`）

**职责**：展示单个 AI 提取字段的名称、原始提取值、置信度，并提供 confirm / modify / skip 操作入口。低置信度字段使用橙色边框醒目标记。

#### 层级结构

```
FieldVerificationCard
├── Props
│   ├── field: ExtractedFieldItem          // 来自 GET /sessions/{id}/fields 的单条字段对象
│   ├── onConfirm: (fieldId: string) => void
│   ├── onModify: (fieldId: string, newValue: string) => void
│   └── onSkip: (fieldId: string) => void
│
├── 卡片头部区
│   ├── 字段名称标签
│   │   └── 数据来源：field.field_name（GET /sessions/{id}/fields → fields[].field_name）
│   └── 置信度标签（ConfidenceBadge，内联子组件）
│       ├── 数字展示：field.confidence_score
│       └── 颜色规则（见交互逻辑）
│
├── 字段值展示/编辑区
│   ├── 默认态（只读）
│   │   └── 显示：field.field_value（GET /sessions/{id}/fields → fields[].field_value）
│   └── 编辑态（用户点击"修改"后激活）
│       └── 单行文本输入框，初始值为 field.field_value
│
├── 原文依据展示区（可折叠）
│   ├── 依据文本：field.source_evidence_text
│   │   └── 数据来源：GET /sessions/{id}/fields → fields[].source_evidence_text
│   └── 页码提示：field.source_page_number
│       └── 数据来源：GET /sessions/{id}/fields → fields[].source_page_number
│
├── 低置信度警告区（条件渲染）
│   └── 仅当 field.needs_human_verification = true 时显示
│       └── 数据来源：GET /sessions/{id}/fields → fields[].needs_human_verification
│
└── 操作按钮区
    ├── 「确认」按钮 → 触发 onConfirm(field.id)
    │   └── 前端操作：PATCH /sessions/{id}/fields/{field_id}，body: { action: "confirm" }
    ├── 「修改」按钮 → 切换为编辑态；编辑完成后触发 onModify(field.id, newValue)
    │   └── 前端操作：PATCH /sessions/{id}/fields/{field_id}，body: { action: "modify", verified_value: newValue }
    └── 「跳过」按钮 → 触发 onSkip(field.id)
        └── 前端操作：PATCH /sessions/{id}/fields/{field_id}，body: { action: "skip" }
```

#### Props 定义

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `field` | `ExtractedFieldItem` | 是 | 单条字段对象，来自 `GET /sessions/{id}/fields` 响应中的 `fields[]` 元素 |
| `onConfirm` | `(fieldId: string) => void` | 是 | 用户点击「确认」后的回调，父组件负责调用 PATCH 接口 |
| `onModify` | `(fieldId: string, newValue: string) => void` | 是 | 用户修改并保存后的回调，父组件负责调用 PATCH 接口 |
| `onSkip` | `(fieldId: string) => void` | 是 | 用户点击「跳过」后的回调，父组件负责调用 PATCH 接口 |

#### 交互逻辑

**置信度颜色规则**（严格依据 API 规范第 5.1 节，前端不自行推断，必须读取 `confidence_score` 字段）：

| `confidence_score` 值 | 颜色 | 说明 |
|-----------------------|------|------|
| ≥ 85 | 绿色（`#4CAF50`） | 高置信度，正常展示 |
| 60 ~ 84 | 黄色（`#FFC107`） | 中置信度，提示关注 |
| < 60 | 橙红色（`#FF5722`） | 低置信度，橙色边框 + 警告图标 |

**低置信度橙色边框规则**：
- 触发条件：`field.needs_human_verification = true`（来自 `GET /sessions/{id}/fields → fields[].needs_human_verification`）
- 实现方式：卡片外层容器添加 `border: 2px solid #FF9800`，同时在卡片右上角展示橙色角标或警告图标

**`verification_status` 状态回显**：
- 操作成功后，PATCH 接口返回 `verification_status`（`confirmed` / `modified` / `skipped`），前端更新卡片状态标记
- 已操作的字段禁用操作按钮区，展示已操作状态标签

**API 对应**：
- 读取接口：`GET /sessions/{session_id}/fields`（API 规范第 5.1 节）
- 写入接口：`PATCH /sessions/{session_id}/fields/{field_id}`（API 规范第 5.2 节）
- 所有字段均在 API 规范中已定义

---

### 2.2 RiskItemCard — 风险条款卡片

**挂载页面**：P07 AI 扫描进度页（扫描完成后的预览态）、P08 HITL 中断审核页（左栏主体）、P09 批量复核页

**职责**：展示单条风险条款的完整信息，包括风险等级、来源标签、AI 分析结论、建议修订意见、当前人工决策状态，并在适当场景提供决策操作入口。

#### 层级结构

```
RiskItemCard
├── Props
│   ├── item: ReviewItemSummary             // 来自 GET /sessions/{id}/items 的单条条款
│   ├── isActive: boolean                   // 是否为当前选中条款（双栏联动激活态）
│   ├── mode: "readonly" | "decision"       // readonly = 报告/扫描预览；decision = HITL 审批模式
│   ├── onSelect: (itemId: string) => void  // 点击卡片触发，通知右栏滚动定位
│   ├── onDecisionSubmit: (itemId: string, payload: DecisionPayload) => void
│   └── onDecisionRevoke: (itemId: string) => void
│
├── 卡片头部区
│   ├── 条款序号标签（前端自行计算列表位置序号）
│   ├── RiskLevelBadge（嵌入子组件）
│   │   └── 数据来源：item.risk_level（GET /sessions/{id}/items → data[].risk_level）
│   ├── SourceBadge（嵌入子组件）
│   │   └── 数据来源：item.source_type（GET /sessions/{id}/items → data[].source_type）
│   └── 置信度数值
│       └── 数据来源：item.confidence_score（GET /sessions/{id}/items → data[].confidence_score）
│
├── AI 分析区
│   ├── 风险描述（模态表述，必须如实展示，禁止前端修改措辞）
│   │   └── 数据来源：item.ai_finding（GET /sessions/{id}/items → data[].ai_finding）
│   ├── AI 推理过程（可折叠展示）
│   │   └── 数据来源：item.ai_reasoning（GET /sessions/{id}/items → data[].ai_reasoning）
│   └── 建议修订意见（可折叠展示）
│       └── 数据来源：item.suggested_revision（GET /sessions/{id}/items → data[].suggested_revision）
│
├── 原文位置提示区
│   └── 页码 + 段落索引（点击可触发右栏滚动定位）
│       ├── 数据来源：item.clause_location.page_number
│       └── 数据来源：item.clause_location.paragraph_index
│       （均来自 GET /sessions/{id}/items → data[].clause_location）
│
├── 当前决策状态区
│   └── human_decision 状态标签
│       ├── pending：灰色「待处理」
│       ├── approve：绿色「已接受」
│       ├── edit：蓝色「已修正」
│       └── reject：红色「已驳回」
│       └── 数据来源：item.human_decision（GET /sessions/{id}/items → data[].human_decision）
│
└── 决策操作区（仅 mode="decision" 且 item.human_decision="pending" 时渲染）
    ├── human_note 输入框（必填，高风险条款 ≥ 10 字）
    │   └── 实时字数统计，< 10 字时操作按钮保持 disabled（防 Automation Bias 前端执行层）
    ├── Approve 按钮
    │   ├── 前置条件 1：右栏原文对应高亮区域已进入视野（由父组件 DualPaneView 通过 Props 传入 evidenceViewed 状态）
    │   ├── 前置条件 2：human_note ≥ 10 字
    │   └── 点击后弹出二次确认对话框（不可跳过，展示 human_note 内容）
    ├── Edit 按钮（需 human_note ≥ 10 字 + 填写修正内容）
    │   ├── edited_risk_level 选择器（条件必填）
    │   └── edited_finding 文本域（条件必填）
    └── Reject 按钮（需 human_note ≥ 10 字）
        └── is_false_positive 勾选框（可选）
```

#### Props 定义

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `item` | `ReviewItemSummary` | 是 | 来自 `GET /sessions/{id}/items` 的单条数据 |
| `isActive` | `boolean` | 是 | 是否为当前双栏联动激活条款 |
| `mode` | `"readonly" \| "decision"` | 是 | `readonly` 用于报告/扫描预览；`decision` 用于 P08 HITL 审批 |
| `evidenceViewed` | `boolean` | 仅 decision 模式必填 | 右栏对应证据区域是否已进入视野，由父组件传入 |
| `onSelect` | `(itemId: string) => void` | 是 | 点击卡片触发，通知 DualPaneView 更新右栏定位 |
| `onDecisionSubmit` | `(itemId: string, payload: DecisionPayload) => void` | decision 模式必填 | 提交决策，父组件调用 `POST /sessions/{id}/items/{item_id}/decision` |
| `onDecisionRevoke` | `(itemId: string) => void` | decision 模式必填 | 撤销决策，父组件调用 `DELETE /sessions/{id}/items/{item_id}/decision` |

#### 交互逻辑

**Approve 按钮禁用规则**（防 Automation Bias，前后端双重保障）：
- 禁用条件 1：`evidenceViewed` Prop 为 `false`（原文未进入视野）
- 禁用条件 2：`human_note` 字数 < 10
- 两个条件均满足才解锁

**决策提交 Payload 结构**（对应 `POST /sessions/{session_id}/items/{item_id}/decision`）：

```typescript
interface DecisionPayload {
  decision: "approve" | "edit" | "reject";
  human_note: string;              // 高风险条款 >= 10 字
  edited_risk_level?: string;      // decision="edit" 时必填
  edited_finding?: string;         // decision="edit" 时必填
  is_false_positive?: boolean;     // decision="reject" 时为 true
  client_submitted_at: string;     // ISO 8601，客户端时间
}
```

**高风险条款无批量入口**：`mode="decision"` 且 `item.risk_level="HIGH"` 时，组件内不渲染任何形式的批量选择框或批量操作元素。

**API 对应**：
- 列表读取：`GET /sessions/{session_id}/items`（API 规范第 6.1 节）
- 详情读取：`GET /sessions/{session_id}/items/{item_id}`（API 规范第 6.2 节）
- 决策提交：`POST /sessions/{session_id}/items/{item_id}/decision`（API 规范第 7.1 节）
- 决策撤销：`DELETE /sessions/{session_id}/items/{item_id}/decision`（API 规范第 7.2 节）

---

### 2.3 RiskEvidenceHighlight — 原文定位与高亮组件

**挂载页面**：P08 HITL 中断审核页（右栏），P09 批量复核页（可选辅助视图）

**职责**：接收合同原文文本及风险证据数组，依据 `char_offset_start` / `char_offset_end` 在原文中精确定位并高亮风险片段，支持锚点滚动，并向父组件上报证据区域可见性状态（用于 Approve 按钮解锁）。

#### 层级结构

```
RiskEvidenceHighlight
├── Props
│   ├── contractText: string               // 合同原文全文（「未开发」：当前 API 未提供原文全文接口，见注释）
│   ├── evidences: RiskEvidenceItem[]      // 来自 GET /sessions/{id}/items → data[].risk_evidence[]
│   ├── activeItemId: string               // 当前选中条款 ID，用于确定滚动目标
│   ├── highlightAnchor: string            // 来自 item.clause_location.highlight_anchor，锚点值
│   └── onEvidenceViewed: (itemId: string, viewed: boolean) => void
│                                          // 证据区域进入/离开视野时的回调，通知父组件更新 evidenceViewed 状态
│
├── 原文文本区（只读，不可编辑）
│   ├── 普通文本段落
│   └── 高亮文本片段（依据 evidences[] 插入）
│       ├── 遍历 evidences[]，按 char_offset_start/end 切片原文
│       │   └── 数据来源：GET /sessions/{id}/items → data[].risk_evidence[].char_offset_start
│       │                                              data[].risk_evidence[].char_offset_end
│       ├── 高亮色块
│       │   ├── is_primary=true 的证据：highlight_color 字段指定色（高风险固定 #FFEBEE，中风险浅橙色）
│       │   │   └── 数据来源：data[].risk_evidence[].highlight_color
│       │   │               data[].risk_evidence[].is_primary
│       │   └── 非主要证据：使用较浅的衬底色，降低视觉权重
│       ├── 左侧竖线装饰（颜色与 risk_level 一致，高风险红色，中风险橙色）
│       └── 上下文文字（浅灰色，辅助阅读）
│           ├── context_before：data[].risk_evidence[].context_before
│           └── context_after：data[].risk_evidence[].context_after
│
├── 锚点定位目标（隐藏 DOM 节点，id = highlightAnchor）
│   └── 数据来源：item.clause_location.highlight_anchor
│       （GET /sessions/{id}/items → data[].clause_location.highlight_anchor）
│
└── 可见性监听器（IntersectionObserver）
    └── 监听 is_primary=true 证据高亮块的可见性
        └── 进入视野时调用 onEvidenceViewed(activeItemId, true)
            离开视野时调用 onEvidenceViewed(activeItemId, false)
```

#### Props 定义

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `contractText` | `string` | 是 | 合同原文全文字符串。**「未开发」**：当前 `api_spec-v1.0.md` 未定义返回合同原文全文的接口，前端获取原文需等待后端补充接口或通过其他方式（如前端解析上传文件）实现，此 Prop 的数据来源待后端确认。 |
| `evidences` | `RiskEvidenceItem[]` | 是 | 来自 `GET /sessions/{id}/items` → `data[].risk_evidence[]` |
| `activeItemId` | `string` | 是 | 当前激活条款 ID，用于触发 smooth scroll 定位 |
| `highlightAnchor` | `string` | 是 | 锚点值，来自 `item.clause_location.highlight_anchor` |
| `onEvidenceViewed` | `(itemId: string, viewed: boolean) => void` | 是 | 主要证据进入/离开视野的回调，通知 DualPaneView 更新 `evidenceViewed` 状态 |

#### 交互逻辑

**证据优先级规则**：
- `is_primary = true` 的证据优先展示（视觉权重最高），且该片段是 Approve 按钮解锁的监听目标
- `is_primary = false` 的证据以低权重样式附加展示，不触发解锁监听

**滚动行为**：
- 当 `activeItemId` 变化时（用户点击左侧 RiskItemCard），组件调用 `document.querySelector(`#${highlightAnchor}`).scrollIntoView({ behavior: 'smooth' })` 实现平滑滚动，延迟要求 ≤ 100ms（见前端设计规范 P08 核心交互）

**高亮色规则**（来自 API 规范第 6.1 节）：
- 高风险（HIGH）：`#FFEBEE`（由后端 `risk_evidence[].highlight_color` 字段指定）
- 中风险（MEDIUM）：浅橙色（由后端 `risk_evidence[].highlight_color` 字段指定）
- 前端应直接使用后端返回的 `highlight_color` 字段值，不自行计算颜色

**注意**：`contractText` 的数据来源是当前 API 规范中未覆盖的缺口。`risk_evidence[].evidence_text`（单个证据片段）和 `risk_evidence[].context_before/after` 已定义，但合同原文全文未有对应接口。若后端不提供全文接口，前端需基于 evidence_text + context_before/after 拼接展示，无法实现完整原文视图。

**API 对应**：
- 证据数组：`GET /sessions/{session_id}/items`（API 规范第 6.1 节，`risk_evidence[]` 数组）
- 已定义字段：`char_offset_start`、`char_offset_end`、`highlight_color`、`is_primary`、`context_before`、`context_after`、`evidence_text`
- `clause_location.highlight_anchor`：已定义

---

### 2.4 SourceBadge — 来源标签组件

**挂载页面**：嵌入 `RiskItemCard`（P08、P09），P10 审核报告页

**职责**：以颜色+边框双维度展示条款判断来源，确保色盲友好。

#### 层级结构

```
SourceBadge
├── Props
│   ├── sourceType: "rule_engine" | "ai_inference" | "hybrid"
│   │   └── 数据来源：GET /sessions/{id}/items → data[].source_type
│   └── size?: "sm" | "md"                 // 可选，控制标签尺寸，默认 "md"
│
└── 标签元素（单个 <span> 或 <Badge> 组件）
    ├── rule_engine
    │   ├── 文字：「规则触发」
    │   ├── 背景色：蓝色系（`#E3F2FD`）
    │   ├── 文字色：深蓝色（`#1565C0`）
    │   └── 边框：1px solid 蓝色（`#1565C0`），实线（色盲友好维度）
    ├── ai_inference
    │   ├── 文字：「AI 推理」
    │   ├── 背景色：紫色系（`#F3E5F5`）
    │   ├── 文字色：深紫色（`#6A1B9A`）
    │   └── 边框：1px dashed 紫色（`#6A1B9A`），虚线（与 rule_engine 实线形成形状差异，色盲友好）
    └── hybrid（「未开发」：api_spec 第 6.1 节提及 source_type 可为 "hybrid"，
        但未定义 hybrid 的展示规范，当前暂以蓝紫色双色标签兜底展示，待 PM 确认）
        ├── 文字：「规则+AI」
        └── 边框：混合样式（待确认）
```

#### Props 定义

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `sourceType` | `"rule_engine" \| "ai_inference" \| "hybrid"` | 是 | 来自 `GET /sessions/{id}/items → data[].source_type` |
| `size` | `"sm" \| "md"` | 否 | 标签尺寸，默认 `"md"` |

#### 交互逻辑

- 鼠标悬停（hover）时展示 Tooltip：
  - `rule_engine`：「此条款由规则引擎基于预设规则匹配触发」
  - `ai_inference`：「此条款由 AI 语义推理分析发现」
- 无点击交互，纯展示组件

**设计红线**：颜色（背景色+文字色）与边框样式（实线/虚线）两个维度同时区分 `rule_engine` 与 `ai_inference`，任意单一维度失效不影响区分度，满足色盲友好要求（见前端设计规范第 4.4 节、前后端边界规范第 8 节）。

**API 对应**：
- 字段：`GET /sessions/{session_id}/items → data[].source_type`（API 规范第 6.1 节已定义）

---

### 2.5 RiskLevelBadge — 风险等级标签组件

**挂载页面**：嵌入 `RiskItemCard`（P08、P09），P10 审核报告页，P07 扫描进度页实时计数区

**职责**：以颜色标签形式展示风险等级，HIGH / MEDIUM / LOW 三色区分。

#### 层级结构

```
RiskLevelBadge
├── Props
│   ├── riskLevel: "HIGH" | "MEDIUM" | "LOW"
│   │   └── 数据来源：GET /sessions/{id}/items → data[].risk_level
│   └── size?: "sm" | "md" | "lg"          // 可选，默认 "md"
│
└── 标签元素
    ├── HIGH（高风险）
    │   ├── 文字：「高风险」
    │   ├── 背景色：红色系（`#FFEBEE`）
    │   ├── 文字色：深红色（`#C62828`）
    │   └── 左侧色点：实心红色圆点（`#EF5350`）
    ├── MEDIUM（中风险）
    │   ├── 文字：「中风险」
    │   ├── 背景色：橙色系（`#FFF3E0`）
    │   ├── 文字色：深橙色（`#E65100`）
    │   └── 左侧色点：实心橙色圆点（`#FF9800`）
    └── LOW（低风险）
        ├── 文字：「低风险」
        ├── 背景色：灰色系（`#F5F5F5`）
        ├── 文字色：灰色（`#757575`）
        └── 左侧色点：实心绿色或灰色圆点（`#81C784`）
```

#### Props 定义

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `riskLevel` | `"HIGH" \| "MEDIUM" \| "LOW"` | 是 | 来自 `GET /sessions/{id}/items → data[].risk_level`，注意 API 返回值为大写枚举 |
| `size` | `"sm" \| "md" \| "lg"` | 否 | 标签尺寸，默认 `"md"` |

#### 交互逻辑

- 纯展示组件，无点击交互
- `size="lg"` 用于报告页的醒目展示场景；`size="sm"` 用于列表紧凑布局场景

**API 对应**：
- 字段：`GET /sessions/{session_id}/items → data[].risk_level`（API 规范第 6.1 节已定义，大写枚举：`HIGH` / `MEDIUM` / `LOW`）

---

### 2.6 DecisionHistoryPanel — 决策历史面板

**挂载页面**：P08 HITL 中断审核页（条款详情展开区），P10 审核报告页

**职责**：展示单条条款的完整人工决策操作历史，仅 reviewer / admin 角色可见（submitter 不含 decision_history，见 API 规范第 2.2 节）。

#### 层级结构

```
DecisionHistoryPanel
├── Props
│   ├── itemId: string                     // 条款 ID，用于请求详情接口
│   ├── decisionHistory: DecisionHistoryItem[]  // 来自 GET /sessions/{id}/items/{item_id} → decision_history[]
│   └── currentUserRole: "reviewer" | "admin" | "submitter"
│       └── submitter 角色：组件不渲染，返回 null
│
├── 面板标题区
│   └── 「操作历史」标题 + 操作条数统计
│
└── 历史记录列表（时间倒序排列）
    └── DecisionHistoryItem（逐条）
        ├── 操作人信息
        │   ├── 操作人姓名：decision_history[].operator_name
        │   │   └── 数据来源：GET /sessions/{id}/items/{item_id} → decision_history[].operator_name
        │   └── 操作人 ID（tooltip 辅助信息）：decision_history[].operator_id
        │       └── 数据来源：decision_history[].operator_id
        ├── 操作时间
        │   └── 数据来源：decision_history[].operated_at（ISO 8601，前端格式化为本地时间）
        ├── 决策类型标签
        │   ├── approve：绿色「接受」
        │   ├── edit：蓝色「修正」
        │   └── reject：红色「驳回」
        │   └── 数据来源：decision_history[].decision_type
        ├── 处理原因（human_note）
        │   └── 数据来源：decision_history[].human_note
        ├── AI 原始判断快照（可折叠展示，用于对比）
        │   ├── 原始风险等级：decision_history[].original_risk_level
        │   ├── 原始 AI 描述：decision_history[].original_ai_finding
        │   ├── 修正后风险等级（edit 类型时）：decision_history[].edited_risk_level
        │   └── 修正后描述（edit 类型时）：decision_history[].edited_ai_finding
        └── 撤销状态标记（条件渲染）
            ├── 条件：decision_history[].is_revoked = true
            │   └── 数据来源：decision_history[].is_revoked
            ├── 展示：灰色删除线覆盖该条记录 + 「已撤销」标签
            └── 撤销时间：decision_history[].revoked_at
                └── 数据来源：decision_history[].revoked_at
```

#### Props 定义

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `itemId` | `string` | 是 | 条款 UUID，用于懒加载详情 |
| `decisionHistory` | `DecisionHistoryItem[]` | 是 | 来自 `GET /sessions/{id}/items/{item_id} → decision_history[]` |
| `currentUserRole` | `"reviewer" \| "admin" \| "submitter"` | 是 | `submitter` 时组件返回 null，不渲染 |

#### 交互逻辑

**权限控制**：
- `submitter` 角色：组件直接返回 `null`（不渲染），依据 API 规范第 2.2 节「查看审核条款详情：submitter 只读，不含 decision_history」
- `reviewer` / `admin` 角色：正常渲染完整历史记录

**数据加载时机**：
- `DecisionHistoryPanel` 仅在用户展开条款详情时才请求 `GET /sessions/{id}/items/{item_id}`（懒加载），避免列表页批量请求详情接口
- 在卡片展开动画完成后执行数据请求

**撤销态视觉处理**：
- `is_revoked = true` 的历史条目：整行添加灰色文字 + CSS `text-decoration: line-through`，右侧追加「已撤销」角标，`revoked_at` 以时间格式展示在角标 tooltip 中

**API 对应**：
- 接口：`GET /sessions/{session_id}/items/{item_id}`（API 规范第 6.2 节）
- `decision_history` 数组及其所有子字段均已在 API 规范第 6.2 节定义

---

## 三、组件间通信规则

### 3.1 双栏联动：RiskItemCard → RiskEvidenceHighlight

**场景**：P08 HITL 中断审核页，左栏 `RiskItemCard` 列表与右栏 `RiskEvidenceHighlight` 的双向联动。

**通信方式**：通过共同的父组件 `DualPaneView` 进行状态提升（Lifting State Up），不直接在子组件间通信。

```
DualPaneView（父组件）
├── state: activeItemId: string            // 当前激活的条款 ID
├── state: evidenceViewedMap: Map<string, boolean>  // 各条款的证据可见性状态
│
├── 左栏：RiskItemCard 列表
│   ├── isActive={item.id === activeItemId}
│   ├── evidenceViewed={evidenceViewedMap.get(item.id) ?? false}
│   └── onSelect={(itemId) => setActiveItemId(itemId)}  // 更新激活 ID，通知右栏滚动
│
└── 右栏：RiskEvidenceHighlight
    ├── activeItemId={activeItemId}        // 接收激活 ID，执行 smooth scroll
    └── onEvidenceViewed={(itemId, viewed) =>        // 接收证据可见性，更新 evidenceViewedMap
            setEvidenceViewedMap(prev => new Map(prev).set(itemId, viewed))}
```

**数据流**：

```
用户点击左栏 RiskItemCard
    → onSelect(itemId) 被调用
    → DualPaneView.activeItemId 更新
    → RiskEvidenceHighlight 接收新 activeItemId
    → smooth scroll 至 highlightAnchor 锚点（延迟 ≤ 100ms）
    → IntersectionObserver 检测主要证据进入视野
    → onEvidenceViewed(itemId, true) 被调用
    → DualPaneView.evidenceViewedMap 更新
    → 对应 RiskItemCard 的 evidenceViewed Prop 变为 true
    → Approve 按钮解锁第一项前置条件
```

**反向联动**（右栏 → 左栏）：
- 用户在右栏直接点击高亮片段时，通过 `RiskEvidenceHighlight` 上的 `onEvidenceClick` 回调（「未开发」：此反向联动交互在当前 API 规范和前端设计规范中未明确定义，建议作为 P1 迭代优化项，当前版本可不实现）通知父组件更新 `activeItemId`，使左栏对应卡片滚动激活。

### 3.2 DecisionHistoryPanel 懒加载通信

**场景**：用户在 P08 展开某条款的历史记录时，`RiskItemCard` 通知父组件触发详情接口请求。

```
用户展开 RiskItemCard 中的「历史记录」区域
    → RiskItemCard 触发 onExpand(itemId) 回调
    → 父组件（HITLReviewPage）调用 GET /sessions/{id}/items/{item_id}
    → 获得 decision_history 数组后，传入 DecisionHistoryPanel 的 decisionHistory Prop
    → DecisionHistoryPanel 渲染历史列表
```

### 3.3 FieldVerificationCard 批量进度通信

**场景**：P06 字段核对页，多个 `FieldVerificationCard` 向页面级进度汇总组件上报已核对数量。

```
FieldVerificationCard.onConfirm / onModify / onSkip 触发
    → 父组件（FieldVerificationPage）更新 verifiedCount 状态
    → 页面顶部进度条组件实时更新「已核对 N / 共 M 个字段」
    → 当所有 needs_human_verification=true 的字段均已操作时，
      「开始 AI 风险扫描」按钮解锁
```

### 3.4 SSE 实时事件触发组件更新

**场景**：P08 页面接收 SSE `item_decision_saved` 事件后，更新对应 `RiskItemCard` 的决策状态和页面进度条。

```
SSE 推送 item_decision_saved
    → data: { item_id, decision, decided_high_risk, total_high_risk }
    → HITLReviewPage 更新 itemsMap[item_id].human_decision = decision
    → 对应 RiskItemCard 重渲染（human_decision 状态标签更新）
    → 页面进度汇总区更新（已处理 N / 共 M 条）
    → 若 decided_high_risk === total_high_risk，触发报告生成跳转逻辑
```

---

## 四、数据字段映射表

### 4.1 FieldVerificationCard 字段映射

| API 字段路径 | 接口 | 展示位置 | 展示方式 |
|-------------|------|---------|---------|
| `fields[].id` | `GET /sessions/{id}/fields` | 不展示，用于操作标识 | 内部 ID |
| `fields[].field_name` | `GET /sessions/{id}/fields` | 卡片头部 - 字段名称 | 文本标签 |
| `fields[].field_value` | `GET /sessions/{id}/fields` | 字段值展示/编辑区 | 只读文本或编辑输入框 |
| `fields[].original_value` | `GET /sessions/{id}/fields` | 编辑态下的原值对比提示 | 浅灰色小字「原值：xxx」 |
| `fields[].confidence_score` | `GET /sessions/{id}/fields` | 置信度标签（颜色+数值） | `ConfidenceBadge` 子组件 |
| `fields[].needs_human_verification` | `GET /sessions/{id}/fields` | 卡片边框颜色 + 警告区 | 橙色边框 + 警告提示 |
| `fields[].verification_status` | `GET /sessions/{id}/fields` | 卡片已操作状态标签 | 枚举标签（已确认/已修改/已跳过/待核对） |
| `fields[].source_evidence_text` | `GET /sessions/{id}/fields` | 可折叠的原文依据区 | 引用文本块 |
| `fields[].source_page_number` | `GET /sessions/{id}/fields` | 原文依据区页码提示 | 「第 N 页」文字 |
| `fields[].source_char_offset_start` | `GET /sessions/{id}/fields` | 暂不在 UI 展示，保留用于后续原文定位 | 内部数据 |
| `fields[].source_char_offset_end` | `GET /sessions/{id}/fields` | 暂不在 UI 展示，保留用于后续原文定位 | 内部数据 |

### 4.2 RiskItemCard 字段映射

| API 字段路径 | 接口 | 展示位置 | 展示方式 |
|-------------|------|---------|---------|
| `data[].id` | `GET /sessions/{id}/items` | 不展示，用于操作标识 | 内部 ID |
| `data[].risk_level` | `GET /sessions/{id}/items` | 卡片头部 - 风险等级标签 | `RiskLevelBadge` 组件 |
| `data[].confidence_score` | `GET /sessions/{id}/items` | 卡片头部 - 置信度数值 | 数字 + 百分比文本 |
| `data[].source_type` | `GET /sessions/{id}/items` | 卡片头部 - 来源标签 | `SourceBadge` 组件 |
| `data[].risk_category` | `GET /sessions/{id}/items` | 卡片副标题 - 条款类型 | 灰色小字标签 |
| `data[].ai_finding` | `GET /sessions/{id}/items` | AI 分析区 - 风险描述 | 模态表述正文（主要内容） |
| `data[].ai_reasoning` | `GET /sessions/{id}/items` | AI 分析区 - 推理过程（可折叠） | 折叠文本块 |
| `data[].suggested_revision` | `GET /sessions/{id}/items` | AI 分析区 - 建议修订（可折叠） | 折叠文本块，带「建议」图标 |
| `data[].human_decision` | `GET /sessions/{id}/items` | 当前决策状态区 | 枚举状态标签 |
| `data[].human_note` | `GET /sessions/{id}/items` | 决策状态区 - 处理备注（已决策时展示） | 引用文本 |
| `data[].human_edited_risk_level` | `GET /sessions/{id}/items` | 决策状态区 - 修正等级（edit 时展示） | `RiskLevelBadge`（修正后） |
| `data[].human_edited_finding` | `GET /sessions/{id}/items` | 决策状态区 - 修正描述（edit 时展示） | 文本块 |
| `data[].is_false_positive` | `GET /sessions/{id}/items` | 决策状态区 - 误报标记（reject+误报时展示） | 「AI 误报」标签 |
| `data[].decided_by` | `GET /sessions/{id}/items` | 决策状态区 - 操作人（已决策时展示） | 「由 xxx 处理」文字 |
| `data[].decided_at` | `GET /sessions/{id}/items` | 决策状态区 - 操作时间（已决策时展示） | 本地时间格式 |
| `data[].clause_location.page_number` | `GET /sessions/{id}/items` | 原文位置提示区 | 「第 N 页」 |
| `data[].clause_location.paragraph_index` | `GET /sessions/{id}/items` | 原文位置提示区 | 「第 N 段」 |
| `data[].clause_location.highlight_anchor` | `GET /sessions/{id}/items` | 内部用于触发右栏滚动定位 | 传递给 RiskEvidenceHighlight |

### 4.3 RiskEvidenceHighlight 字段映射

| API 字段路径 | 接口 | 展示位置 | 展示方式 |
|-------------|------|---------|---------|
| `data[].risk_evidence[].id` | `GET /sessions/{id}/items` | 不展示，内部标识 | 内部 ID |
| `data[].risk_evidence[].evidence_text` | `GET /sessions/{id}/items` | 高亮片段文本 | 带色块背景的高亮文本 |
| `data[].risk_evidence[].context_before` | `GET /sessions/{id}/items` | 证据前文语境 | 浅灰色小字 |
| `data[].risk_evidence[].context_after` | `GET /sessions/{id}/items` | 证据后文语境 | 浅灰色小字 |
| `data[].risk_evidence[].char_offset_start` | `GET /sessions/{id}/items` | 在原文中的定位起点 | 内部计算（不展示） |
| `data[].risk_evidence[].char_offset_end` | `GET /sessions/{id}/items` | 在原文中的定位终点 | 内部计算（不展示） |
| `data[].risk_evidence[].highlight_color` | `GET /sessions/{id}/items` | 高亮块背景色 | CSS background-color |
| `data[].risk_evidence[].is_primary` | `GET /sessions/{id}/items` | 主要证据优先展示 + 解锁监听对象 | 视觉权重 + IntersectionObserver 目标 |
| `data[].clause_location.highlight_anchor` | `GET /sessions/{id}/items` | DOM 锚点 ID（滚动目标） | `id` 属性 |

### 4.4 DecisionHistoryPanel 字段映射

| API 字段路径 | 接口 | 展示位置 | 展示方式 |
|-------------|------|---------|---------|
| `decision_history[].id` | `GET /sessions/{id}/items/{item_id}` | 不展示，内部标识 | 内部 ID |
| `decision_history[].decision_type` | `GET /sessions/{id}/items/{item_id}` | 历史条目 - 决策类型标签 | 枚举色标签 |
| `decision_history[].operator_id` | `GET /sessions/{id}/items/{item_id}` | 操作人 ID（tooltip） | 辅助信息 |
| `decision_history[].operator_name` | `GET /sessions/{id}/items/{item_id}` | 历史条目 - 操作人姓名 | 主文本 |
| `decision_history[].operated_at` | `GET /sessions/{id}/items/{item_id}` | 历史条目 - 操作时间 | 本地时间格式 |
| `decision_history[].human_note` | `GET /sessions/{id}/items/{item_id}` | 历史条目 - 处理原因 | 引用文本 |
| `decision_history[].original_ai_finding` | `GET /sessions/{id}/items/{item_id}` | 折叠区 - AI 原始描述 | 灰色小字对比展示 |
| `decision_history[].original_risk_level` | `GET /sessions/{id}/items/{item_id}` | 折叠区 - AI 原始风险等级 | `RiskLevelBadge`（原始） |
| `decision_history[].edited_ai_finding` | `GET /sessions/{id}/items/{item_id}` | 折叠区 - 修正后描述（edit 时） | 对比文本 |
| `decision_history[].edited_risk_level` | `GET /sessions/{id}/items/{item_id}` | 折叠区 - 修正后等级（edit 时） | `RiskLevelBadge`（修正后） |
| `decision_history[].is_false_positive` | `GET /sessions/{id}/items/{item_id}` | 历史条目 - 误报标记 | 「AI 误报」角标 |
| `decision_history[].is_revoked` | `GET /sessions/{id}/items/{item_id}` | 历史条目 - 撤销状态 | 删除线 + 「已撤销」标签 |
| `decision_history[].revoked_at` | `GET /sessions/{id}/items/{item_id}` | 撤销时间（tooltip） | 时间格式 |

---

## 五、设计红线落地

以下设计红线来源于 `06_architecture/frontend_design_spec-v1.0.md` 第 5 节、`06_architecture/frontend_backend_boundary_spec-v1.0.md` 第 8 节，以及 `08_api_spec/api_spec-v1.0.md` 相关约束，本章明确每条红线在上述六个组件中的具体落地方式。

---

### 5.1 AI 结论必须使用模态表述，禁止绝对化语言

**红线来源**：前端设计规范第 5.3 节；前后端边界规范第 8 节「AI 结论不可绝对化」

**落地组件**：`RiskItemCard`

**执行方式**：
- `RiskItemCard` 中的 `ai_finding` 字段内容由后端提供，前端**原文展示**，不对文本内容做任何前端加工或替换
- 后端保障 `ai_finding` 已使用模态表述（如「可能存在…风险」），前端不做额外校验，但也不得对文本进行任何截断、改写或添加绝对化结论
- P07 扫描进度页：禁止在扫描中状态展示「无风险」或「扫描通过」等绝对化文字，禁止在 `RiskItemCard` 组件（扫描预览态）中添加此类文字

**验收标准**：前端 code review 时检查 `ai_finding` 展示代码，确认无任何字符串拼接或前端自生成的风险结论文字。

---

### 5.2 来源标签必须颜色+边框双维度区分（色盲友好）

**红线来源**：前端设计规范第 4.4 节；前后端边界规范第 8 节「判断来源必须可区分」

**落地组件**：`SourceBadge`

**执行方式**：

| 来源 | 颜色维度 | 边框维度 | 二者缺一不可 |
|------|---------|---------|------------|
| `rule_engine` | 蓝色背景 + 深蓝文字 | 实线（solid）边框 | 色觉正常用户靠颜色区分；色盲用户靠边框线型区分 |
| `ai_inference` | 紫色背景 + 深紫文字 | 虚线（dashed）边框 | 同上 |

**验收标准**：
1. 使用灰度模式截图验证，两种标签仍可通过边框线型区分
2. 联调验证清单中列为必查项（见 API 规范第十一章阶段二 Step 4）

---

### 5.3 高风险条款严禁批量操作，Approve 按钮有三项前置检查

**红线来源**：前端设计规范第 5.1 节「防 Automation Bias 机制」；前后端边界规范第 2.3 节

**落地组件**：`RiskItemCard`（decision 模式）

**执行方式**：

| 防 Automation Bias 机制 | 组件内落地方式 |
|------------------------|--------------|
| 高风险条款无批量入口 | `mode="decision"` 且 `item.risk_level="HIGH"` 时，组件不渲染勾选框、不渲染批量按钮，彻底不存在于 DOM 中 |
| Approve 按钮前置条件 1：原文进入视野 | Approve 按钮 `disabled={!evidenceViewed}`，`evidenceViewed` 由父组件通过 Props 传入 |
| Approve 按钮前置条件 2：human_note ≥ 10 字 | `disabled={humanNoteLength < 10}`，实时字符计数 |
| Approve 后二次确认弹窗 | 点击 Approve 触发不可跳过的确认对话框，弹窗内展示用户已填写的 `human_note` 内容 |
| 提交携带 Idempotency-Key | 每次提交前由父组件生成 UUID v4 作为 `Idempotency-Key` 请求头 |

**验收标准**：
- DOM 检查：高风险条款卡片中不存在任何 `type="checkbox"` 或批量操作相关元素
- 交互测试：在未滚动至原文时，Approve 按钮处于 `disabled` 状态；填写不足 10 字时，按钮继续保持 `disabled`

---

### 5.4 decision_history 仅 reviewer/admin 可见

**红线来源**：API 规范第 2.2 节权限矩阵「查看审核条款详情：submitter 只读，不含 decision_history」；前后端边界规范第 4.1 节

**落地组件**：`DecisionHistoryPanel`

**执行方式**：
- 组件接收 `currentUserRole` Prop，当值为 `"submitter"` 时直接返回 `null`，不渲染任何内容
- 父组件（HITLReviewPage / ReportPage）在渲染 `DecisionHistoryPanel` 前不需要额外做权限判断，统一由组件内部处理
- 后端侧：submitter 调用 `GET /sessions/{id}/items/{item_id}` 时响应体不含 `decision_history` 字段（API 规范第 2.2 节保障），即使前端错误渲染也无数据可展示（双重保障）

**验收标准**：使用 submitter 角色账号访问 P08 / P10，确认无任何历史记录区域渲染。

---

### 5.5 置信度颜色必须来自后端字段，前端不自行推断

**红线来源**：API 规范第十一章阶段一「字段置信度颜色展示，必须从 API 响应读取 confidence_score，不可前端自行推断」

**落地组件**：`FieldVerificationCard`、`RiskItemCard`

**执行方式**：
- 置信度数值直接读取 `confidence_score` 字段（integer 类型，0~100）
- 颜色映射逻辑在前端以 `confidence_score` 阈值计算（≥85 绿 / 60-84 黄 / <60 橙红），但**阈值本身不可前端硬编码为业务决策**，后端通过返回的 `needs_human_verification` 字段给出需人工核查的最终判断

**注**：`needs_human_verification` 是后端权威判断，前端不得用 `confidence_score < 60` 自行计算替代此字段。

---

### 5.6 原文高亮色由后端字段指定，前端不自行推断

**红线来源**：API 规范第 6.1 节（`risk_evidence[].highlight_color` 字段说明）

**落地组件**：`RiskEvidenceHighlight`

**执行方式**：
- 高亮色块的背景色使用 `risk_evidence[].highlight_color` 字段值（后端直接返回十六进制颜色码）
- 前端不得根据 `risk_level` 自行计算颜色，以后端字段为权威（高风险示例值 `#FFEBEE` 已由后端定义）

---

### 5.7 未开发功能标注汇总

以下功能点在当前 `api_spec-v1.0.md` 中未定义，前端实现时须等待后端接口完善：

| 功能点 | 涉及组件 | 缺失内容 | 建议优先级 |
|--------|---------|---------|----------|
| 合同原文全文接口 | `RiskEvidenceHighlight` | 当前 API 未提供返回合同原文全文文本的接口（`GET /sessions/{id}/items` 仅返回证据片段，不含完整原文）。前端目前只能基于 `evidence_text + context_before/after` 拼接局部视图，无法实现完整原文双栏对照。 | P0（HITL 核心功能强依赖） |
| 右栏点击高亮反向联动左栏 | `RiskEvidenceHighlight` → `RiskItemCard` | 用户点击右栏高亮块时激活左栏对应卡片的交互未在前端设计规范中明确定义，属于待确认需求 | P1（优化项） |
| hybrid 来源类型展示规范 | `SourceBadge` | `source_type = "hybrid"` 的视觉规范未在设计规范或 API 规范中定义 | P2（低频场景） |

---

*本文档基于 `08_api_spec/api_spec-v1.0.md`、`06_architecture/frontend_design_spec-v1.0.md`、`06_architecture/frontend_backend_boundary_spec-v1.0.md`、`04_interaction_design/langchain_hitl_arch-v1.0.md` 四份文档的既有定义产出，不包含超出上述文档范围的新增假设。所有标注「未开发」的功能点均依据 API 规范的实际覆盖范围如实标注。*
