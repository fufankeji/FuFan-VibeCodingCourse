# 前端 HITL 交互 UI 规划文档 v1.0

**文档编号**：09_frontend_plan/t3_hitl_ui_design.md
**版本**：v1.0
**编写日期**：2026-03-11
**编写角色**：Teammate 3（前端规划 - HITL 交互 UI 设计）
**输入文档**：
- `08_api_spec/api_spec-v1.0.md`
- `06_architecture/frontend_design_spec-v1.0.md`
- `06_architecture/frontend_backend_boundary_spec-v1.0.md`
- `04_interaction_design/langchain_hitl_arch-v1.0.md`

---

## 目录

1. [HITL 交互流程总览](#一hitl-交互流程总览)
2. [Approve 流程详细设计](#二approve-流程详细设计)
3. [Edit 流程详细设计](#三edit-流程详细设计)
4. [Reject 流程详细设计](#四reject-流程详细设计)
5. [撤销决策（Revoke）流程](#五撤销决策revoke流程)
6. [防 Automation Bias UI 设计](#六防-automation-bias-ui-设计)
7. [P09 批量复核页交互设计](#七p09-批量复核页交互设计)
8. [进度汇总区 UI 规范](#八进度汇总区-ui-规范)
9. [跨天恢复 Banner 设计](#九跨天恢复-banner-设计)
10. [API 接口对应关系](#十api-接口对应关系)

---

## 一、HITL 交互流程总览

### 1.1 整体进入路径

```
SSE 事件：route_interrupted
    └─ 前端收到事件
        └─ 路由守卫检测 session.state = hitl_pending, hitl_subtype = interrupt
            └─ 自动跳转至 P08：/contracts/:id/review
                ├─ 调用 GET /sessions/{session_id}/recovery（若为恢复场景）
                │   └─ 渲染跨天恢复 Banner
                ├─ 调用 GET /sessions/{session_id}
                │   └─ 读取 progress_summary，渲染进度汇总区
                ├─ 调用 GET /sessions/{session_id}/items?risk_level=high&sort_by=risk_level_desc
                │   └─ 渲染左栏风险条款卡片列表
                └─ 建立 SSE 连接 GET /sessions/{session_id}/events
                    └─ 订阅 item_decision_saved / report_generation_started 事件
```

### 1.2 三条决策路径总览

```
P08 HITL 中断审核页
├── 高风险条款卡片（pending 状态）
│   ├── [Approve 路径]
│   │   1. 点击条款卡片 → 右栏原文滚动至高亮区域
│   │   2. 填写 human_note（≥ 10 字）
│   │   3. Approve 按钮解锁 → 点击 → 二次确认弹窗
│   │   4. 确认 → POST decision（approve）→ SSE item_decision_saved
│   │   5. 若 all_high_risk_completed=true → 自动跳转报告等待页
│   │
│   ├── [Edit 路径]
│   │   1. 点击条款卡片 → 右栏原文滚动至高亮区域
│   │   2. 填写 edited_risk_level + edited_finding + human_note（≥ 10 字）
│   │   3. Edit 按钮解锁 → 点击 → 二次确认弹窗
│   │   4. 确认 → POST decision（edit）→ SSE item_decision_saved
│   │
│   └── [Reject 路径]
│       1. 点击条款卡片 → 右栏原文滚动至高亮区域
│       2. 可选勾选 is_false_positive
│       3. 填写 human_note（≥ 10 字）
│       4. Reject 按钮解锁 → 点击 → 二次确认弹窗
│       5. 确认 → POST decision（reject）→ SSE item_decision_saved
│
└── 已处理条款（approve/edit/reject 状态）
    └── [Revoke 路径]（仅在 session.state = hitl_pending 时可用）
        1. 点击已处理条款上的「撤销」按钮
        2. 弹出撤销确认弹窗
        3. 确认 → DELETE decision → 条款恢复 pending 状态，进度计数回退
```

### 1.3 P09 批量复核进入路径

```
SSE 事件：route_batch_review
    └─ 路由守卫检测 session.state = hitl_pending, hitl_subtype = batch_review
        └─ 自动跳转至 P09：/contracts/:id/batch
            ├─ 调用 GET /sessions/{session_id}/items?risk_level=medium
            └─ 渲染中风险条款列表
```

---

## 二、Approve 流程详细设计

### 2.1 Approve 流程状态机

```
[条款状态: pending]
    │
    ▼
Step 1：用户点击左栏条款卡片
    │   - 前端触发右栏 smooth scroll 至对应高亮段落（延迟 ≤ 100ms）
    │   - 高亮段落进入视野后，前端解锁「视野检测」条件（condition_A = true）
    │   - 视觉反馈：高亮段落左侧竖线颜色加深，Approve 按钮出现悬浮提示
    │
    ▼
Step 2：用户填写 human_note
    │   - 实时字符计数组件显示「已输入 N 字 / 最少 10 字」
    │   - 当 len(human_note) < 10：按钮保持 disabled，显示「还需输入 X 字」
    │   - 当 len(human_note) >= 10：解锁「字符计数」条件（condition_B = true）
    │
    ▼
Step 3：条件汇聚检查
    │   - condition_A（原文视野检测）= true
    │   AND condition_B（human_note ≥ 10 字）= true
    │       └─ Approve 按钮由 disabled → enabled（颜色从灰色变为主色调）
    │
    ▼
Step 4：用户点击 Approve 按钮
    │   - 触发二次确认弹窗（不可跳过）
    │   弹窗内容：
    │     ┌────────────────────────────────────────┐
    │     │  确认审核决策                            │
    │     │  ─────────────────────────────────────  │
    │     │  条款摘要：[ai_finding 前 50 字]         │
    │     │  风险等级：高风险                         │
    │     │  ─────────────────────────────────────  │
    │     │  您的处理意见：                           │
    │     │  「[human_note 完整内容]」                │
    │     │  ─────────────────────────────────────  │
    │     │  决策类型：批准（Approve）                │
    │     │  ─────────────────────────────────────  │
    │     │  [取消]              [确认提交]           │
    │     └────────────────────────────────────────┘
    │
    ▼
Step 5：用户点击「确认提交」
    │   - 前端生成 Idempotency-Key（UUID v4）
    │   - 前端记录 client_submitted_at（当前时间戳）
    │   - 发送 POST /sessions/{session_id}/items/{item_id}/decision
    │     请求体：
    │       { decision: "approve", human_note: "...", is_false_positive: false,
    │         edited_risk_level: null, edited_finding: null,
    │         client_submitted_at: "..." }
    │   - 按钮进入 loading 状态，防止重复提交
    │
    ▼
Step 6：接收响应
    │   ├─ 成功（HTTP 201）：
    │   │   - 前端更新该条款卡片状态为「approved」（绿色标记）
    │   │   - 进度汇总区：decided_high_risk + 1
    │   │   - 连续快速操作计时器记录此次操作时间点
    │   │   - 若响应体 progress.all_high_risk_completed = true：
    │   │       └─ 展示过渡提示「所有高风险条款已处理，正在生成报告...」
    │   └─ 失败（HTTP 4xx）：
    │       - 显示错误 Toast 提示（展示 message 字段内容）
    │       - 按钮恢复可点击状态
    │
    ▼
Step 7：SSE 事件 item_decision_saved 到达
    │   - 核对 item_id 与当前条款一致
    │   - 更新进度计数（decided_high_risk / total_high_risk）
    │   - 自动聚焦下一条 human_decision = pending 的高风险条款
    │
    ▼（若 all_high_risk_completed = true）
Step 8：SSE 事件 report_generation_started 到达
    └─ 前端自动跳转至 /contracts/:id/report（报告生成等待页）
```

### 2.2 Approve 按钮状态定义

| 状态 | 样式 | 触发条件 |
|------|------|----------|
| 初始禁用 | 灰色，`cursor: not-allowed`，Tooltip「请先查看原文高亮区域」 | 页面加载时 |
| 视野已检测，等待备注 | 灰色，Tooltip「还需输入 X 字处理意见」 | condition_A=true, condition_B=false |
| 备注已填，等待视野 | 灰色，Tooltip「请滚动至原文高亮区域查看条款」 | condition_A=false, condition_B=true |
| 完全解锁 | 主色调（蓝色/绿色），可点击 | condition_A=true, condition_B=true |
| 提交中 | loading spinner，禁用 | 等待 API 响应期间 |
| 已提交 | 不显示（条款状态变为 approved） | 提交成功后 |

### 2.3 Approve 后条款卡片 UI 更新

```
条款卡片（approved 状态）
├── 顶部状态标签：[已批准] （绿色背景）
├── 条款序号 + 风险等级标签（保留原显示）
├── AI 风险描述（只读，不可再编辑）
├── 处理意见展示：「[human_note 内容]」（灰色字体）
├── 操作人 + 处理时间（由 SSE 事件或 API 响应填充）
└── [撤销决策] 按钮（仅 session.state = hitl_pending 时显示）
```

---

## 三、Edit 流程详细设计

### 3.1 Edit 流程步骤层级

```
[条款状态: pending]
    │
    ▼
Step 1：用户点击左栏条款卡片
    │   - 右栏原文 smooth scroll 至对应高亮段落（延迟 ≤ 100ms）
    │   - 视野检测条件开始计算（condition_A 逻辑与 Approve 相同）
    │
    ▼
Step 2：用户点击「Edit」按钮入口（此时按钮为非禁用状态，无需视野前置）
    │   - 展开 Edit 表单（内联展开或侧边面板）
    │
    ▼
Step 3：用户填写 Edit 表单
    │   Edit 表单包含以下字段：
    │   ┌──────────────────────────────────────────────────┐
    │   │ 修正风险等级（必填，下拉选择）                       │
    │   │   [ 高风险 ▼ ]  可选值：高风险 / 中风险 / 低风险    │
    │   │                                                  │
    │   │ 修正风险描述（必填，文本域）                         │
    │   │   原 AI 描述（灰色参考文本，不可直接提交）             │
    │   │   [ 用户输入新的风险描述... ]                       │
    │   │                                                  │
    │   │ 处理意见（必填，≥ 10 字）                           │
    │   │   [ 用户输入处理原因... ]         已输入 N 字        │
    │   │   还需输入 X 字（< 10 字时显示）                    │
    │   └──────────────────────────────────────────────────┘
    │
    ▼
Step 4：条件汇聚检查
    │   - edited_risk_level 已选择（condition_E1 = true）
    │   - edited_finding 非空（condition_E2 = true）
    │   - human_note ≥ 10 字（condition_B = true）
    │       └─ Edit 提交按钮由 disabled → enabled
    │
    ▼
Step 5：用户点击「提交修正」
    │   - 触发二次确认弹窗
    │   弹窗内容：
    │     ┌────────────────────────────────────────┐
    │     │  确认审核决策                            │
    │     │  ─────────────────────────────────────  │
    │     │  原 AI 风险等级：高风险                   │
    │     │  修正为：[edited_risk_level]             │
    │     │  ─────────────────────────────────────  │
    │     │  修正描述：「[edited_finding]」            │
    │     │  ─────────────────────────────────────  │
    │     │  处理意见：「[human_note]」               │
    │     │  ─────────────────────────────────────  │
    │     │  决策类型：修正（Edit）                   │
    │     │  [取消]              [确认提交]           │
    │     └────────────────────────────────────────┘
    │
    ▼
Step 6：用户点击「确认提交」
    │   - 发送 POST /sessions/{session_id}/items/{item_id}/decision
    │     请求体：
    │       { decision: "edit", human_note: "...",
    │         edited_risk_level: "high|medium|low",
    │         edited_finding: "...", is_false_positive: false,
    │         client_submitted_at: "..." }
    │   - 按钮进入 loading 状态
    │
    ▼
Step 7：接收响应
    │   ├─ 成功（HTTP 201）：
    │   │   - 条款卡片状态更新为「已修正」（橙色标签）
    │   │   - 展示修正后的风险等级和描述
    │   │   - 进度汇总区：decided_high_risk + 1
    │   └─ 失败（HTTP 4xx）：展示错误 Toast
    │
    ▼
Step 8：SSE 事件 item_decision_saved 到达
    └─ 更新进度计数，自动聚焦下一条 pending 条款
```

### 3.2 Edit 表单中原 AI 描述的展示方式

- 原 `ai_finding` 字段以灰色只读文本展示在 `edited_finding` 输入框上方，标注「AI 原始描述（供参考）」
- 用户必须主动在输入框中输入新内容，不可直接复用原 AI 描述作为提交值（字符级别去重不做强制校验，但 UX 层面以区分展示引导用户独立输入）

---

## 四、Reject 流程详细设计

### 4.1 Reject 流程步骤层级

```
[条款状态: pending]
    │
    ▼
Step 1：用户点击左栏条款卡片
    │   - 右栏原文 smooth scroll 至对应高亮段落（延迟 ≤ 100ms）
    │
    ▼
Step 2：用户点击「Reject」按钮入口
    │   - 展开 Reject 表单
    │
    ▼
Step 3：用户填写 Reject 表单
    │   Reject 表单包含以下字段：
    │   ┌──────────────────────────────────────────────────┐
    │   │ [ ] 标记为 AI 误报（is_false_positive）            │
    │   │      勾选后显示辅助说明：「AI 误判了此条款的风险性」  │
    │   │                                                  │
    │   │ 拒绝原因（必填，≥ 10 字）                           │
    │   │   [ 请说明拒绝原因... ]              已输入 N 字    │
    │   │   还需输入 X 字（< 10 字时显示）                    │
    │   └──────────────────────────────────────────────────┘
    │
    ▼
Step 4：条件检查
    │   - human_note ≥ 10 字（condition_B = true）
    │       └─ Reject 提交按钮由 disabled → enabled
    │   注意：is_false_positive 为可选字段，不影响按钮解锁
    │
    ▼
Step 5：用户点击「提交拒绝」
    │   - 触发二次确认弹窗
    │   弹窗内容：
    │     ┌────────────────────────────────────────┐
    │     │  确认审核决策                            │
    │     │  ─────────────────────────────────────  │
    │     │  条款摘要：[ai_finding 前 50 字]         │
    │     │  ─────────────────────────────────────  │
    │     │  AI 误报标记：[是 / 否]                  │
    │     │  拒绝原因：「[human_note]」               │
    │     │  ─────────────────────────────────────  │
    │     │  决策类型：拒绝（Reject）                 │
    │     │  [取消]              [确认提交]           │
    │     └────────────────────────────────────────┘
    │
    ▼
Step 6：用户点击「确认提交」
    │   - 发送 POST /sessions/{session_id}/items/{item_id}/decision
    │     请求体：
    │       { decision: "reject", human_note: "...",
    │         is_false_positive: true|false,
    │         edited_risk_level: null, edited_finding: null,
    │         client_submitted_at: "..." }
    │   - 按钮进入 loading 状态
    │
    ▼
Step 7：接收响应
    │   ├─ 成功（HTTP 201）：
    │   │   - 条款卡片状态更新为「已拒绝」（灰色标签）
    │   │   - 若 is_false_positive = true：额外显示「AI 误报」标记
    │   │   - 进度汇总区：decided_high_risk + 1
    │   └─ 失败（HTTP 4xx）：展示错误 Toast
    │
    ▼
Step 8：SSE 事件 item_decision_saved 到达
    └─ 更新进度计数，自动聚焦下一条 pending 条款
```

### 4.2 is_false_positive 勾选的 UI 行为

- 勾选前：复选框默认未选中
- 勾选后：复选框选中，下方出现辅助说明文字「您标记此条款为 AI 误报，这将帮助改进 AI 模型」（仅说明性文字，不影响流程）
- is_false_positive 的值在二次确认弹窗中展示，用户可在弹窗中核对后再确认提交

---

## 五、撤销决策（Revoke）流程

### 5.1 Revoke 触发条件与入口

- **可操作前提**：`session.state = hitl_pending`（后端同样校验此条件）
- **入口位置**：已处理条款卡片底部的「撤销决策」文字按钮（低优先级样式，避免误操作）
- **不可操作时**：当 `session.state` 变更为 `completed` 或 `report_ready` 后，「撤销决策」按钮消失或显示为禁用状态并附 Tooltip 说明「报告已生成，决策不可再修改」

### 5.2 Revoke 流程步骤层级

```
[条款状态: approve / edit / reject]
    │
    ▼
Step 1：用户点击已处理条款卡片上的「撤销决策」按钮
    │
    ▼
Step 2：弹出撤销确认弹窗
    │   弹窗内容：
    │     ┌────────────────────────────────────────┐
    │     │  确认撤销决策                            │
    │     │  ─────────────────────────────────────  │
    │     │  您将撤销对以下条款的处理决策：            │
    │     │  [ai_finding 前 50 字]                  │
    │     │  ─────────────────────────────────────  │
    │     │  当前决策：[approve / edit / reject]     │
    │     │  撤销后：条款将恢复为「待处理」状态         │
    │     │  ─────────────────────────────────────  │
    │     │  注意：此操作会减少已处理条款计数            │
    │     │  [取消]              [确认撤销]           │
    │     └────────────────────────────────────────┘
    │
    ▼
Step 3：用户点击「确认撤销」
    │   - 发送 DELETE /sessions/{session_id}/items/{item_id}/decision
    │   - 按钮进入 loading 状态
    │
    ▼
Step 4：接收响应
    │   ├─ 成功（HTTP 200，返回 human_decision: "pending"）：
    │   │   - 条款卡片恢复「待处理」状态（橙色 pending 标签）
    │   │   - 「撤销决策」按钮消失，操作区（Approve/Edit/Reject）重新展开
    │   │   - 进度汇总区：decided_high_risk - 1
    │   │   - all_high_risk_completed 状态若之前为 true，现在回退为 false
    │   └─ 失败（HTTP 409, SESSION_STATE_CONFLICT）：
    │       - 展示错误 Toast：「当前会话状态不允许撤销决策」
    │       - 若后端已生成报告，提示用户报告已锁定
    │
    ▼
Step 5：UI 状态同步
    └─ 条款卡片重新进入 pending 交互流程（可重新执行 Approve/Edit/Reject）
```

### 5.3 Revoke 后的状态一致性处理

- 若 Revoke 发生时当前用户已看到「所有高风险条款已处理」的提示，需立即撤回该提示
- 进度汇总区的数字实时回退，不等待 SSE 事件（乐观更新）
- 若 SSE 后续推送的 `item_decision_saved` 数据与本地状态不一致，以 SSE 数据为准修正

---

## 六、防 Automation Bias UI 设计

### 6.1 原文视野检测机制

**目标**：强制用户查看合同原文中对应的高亮段落，再允许提交 Approve 决策。

```
实现层级：
    1. 数据准备
       └─ 从 ReviewItem.risk_evidence[is_primary=true] 获取 highlight_anchor
          （格式示例：「page3-para2」）
       └─ 右栏原文区域每个高亮段落绑定对应的 DOM id（与 highlight_anchor 一致）

    2. 滚动触发
       └─ 用户点击左栏条款卡片
           └─ 前端调用 document.getElementById(highlight_anchor).scrollIntoView({behavior: 'smooth'})
           └─ 等待滚动动画完成（约 300ms 延迟检测）

    3. 视野检测
       └─ 使用 IntersectionObserver API 监听高亮段落元素
       └─ 检测条件：元素可见比例（intersectionRatio）≥ 0.5
           ├─ 未进入视野：condition_A = false
           │   └─ Approve 按钮保持 disabled
           │   └─ 右栏滚动条旁显示引导箭头：「请滚动至此条款的原文高亮区域」
           └─ 已进入视野：condition_A = true
               └─ 视觉反馈：高亮段落背景色从浅红（#FFEBEE）短暂加深至中红（#FFCDD2），持续 500ms
               └─ 左栏 Approve 按钮悬浮提示更新为「请填写至少 10 字的处理意见」
               └─ 右栏高亮区域左侧竖线颜色从浅色变为深红（视觉确认）
```

**视野检测不适用于 Edit 和 Reject 操作**：Edit 和 Reject 按钮无原文视野前置要求（但建议用户查看，通过 UX 引导而非强制禁用）。

### 6.2 human_note 字符计数 UI 规范

```
字符计数组件规格：
┌──────────────────────────────────────────────────────────────┐
│  处理意见（必填）                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 请输入处理原因...                                       │    │
│  │                                                      │    │
│  └──────────────────────────────────────────────────────┘    │
│  ─────────────────────────────── 已输入 7 字 / 最少 10 字     │
│  [提示] 还需输入 3 字                              [红色文字]  │
└──────────────────────────────────────────────────────────────┘

状态变化规则：
  - 输入 0 字：不显示计数提示（placeholder 状态）
  - 输入 1~9 字：显示「已输入 N 字 / 最少 10 字」+ 红色「还需输入 X 字」提示
  - 输入 10 字及以上：显示「已输入 N 字」（绿色文字），隐藏剩余字数提示
  - 实时响应（onChange 事件，无防抖要求）
```

### 6.3 二次确认弹窗规范

**适用操作**：Approve、Edit、Reject 三种决策均需触发二次确认弹窗。

```
弹窗通用规格：
  - 弹窗类型：Modal Dialog（居中遮罩，背景不可点击关闭）
  - 标题：「确认审核决策」
  - 取消按钮：关闭弹窗，返回操作界面（不提交）
  - 确认按钮：触发 API 请求
  - 弹窗不可通过 ESC 键关闭（防止无意关闭）
  - 弹窗不可通过点击遮罩层关闭（强制用户主动选择确认或取消）

弹窗内容必须展示（不可省略）：
  - 条款摘要（ai_finding 前 50 字，超出省略号截断）
  - 决策类型（Approve / Edit / Reject，中文）
  - 用户填写的 human_note 完整内容（带引号框选展示）
  - Edit 时额外展示：edited_risk_level + edited_finding
  - Reject 时额外展示：is_false_positive 是否勾选
```

### 6.4 连续快速操作警示机制

**触发条件**：同一审核会话中，连续 5 条高风险条款的 Approve 决策，每条从点击 Approve 按钮到确认提交的时间间隔均小于 10 秒。

```
实现层级：
    1. 计时器逻辑（前端本地维护）
       └─ 每次 Approve 成功后，记录时间戳到本地数组 approveTimestamps[]
       └─ 每次新增记录时，检测最近 5 条时间戳：
           └─ 若最近 5 条的最大间隔 < 10000ms（10 秒）：触发警示

    2. 警示弹窗内容
       ┌────────────────────────────────────────────────────┐
       │  注意：检测到快速批量审批行为                          │
       │  ─────────────────────────────────────────────────  │
       │  您在极短时间内连续批准了 5 条高风险条款。              │
       │  高风险条款审核需要认真阅读原文，请确认您已仔细评估      │
       │  每条条款的实际风险。                                 │
       │  ─────────────────────────────────────────────────  │
       │  如需继续，请确认您已充分阅读并评估了每条条款。          │
       │  ─────────────────────────────────────────────────  │
       │  [返回重新审核]            [确认，我已认真评估]         │
       └────────────────────────────────────────────────────┘

    3. 警示弹窗行为规范
       └─ 点击「返回重新审核」：关闭弹窗，不影响已提交的决策
       └─ 点击「确认，我已认真评估」：关闭弹窗，重置计时器数组，继续后续操作
       └─ 弹窗触发后，计时器数组清空，避免重复触发

    4. 此机制仅为 UI 警示，不阻止用户继续操作
       └─ 警示触发记录由后端在 API 层面的 bias_warning 日志中保存（前端不生成日志）
```

### 6.5 禁止批量操作入口规范

- P08 页面的高风险条款列表区域**不渲染**任何批量操作相关 UI 元素，包括但不限于：
  - 列表头部的「全选」复选框
  - 批量 Approve 按钮
  - 批量 Reject 按钮
  - 「选中 N 条，批量处理」操作栏
- 此要求为硬性约束，不得通过任何条件判断动态显示/隐藏批量入口（即不渲染 DOM 节点，而非仅设置 display:none）

---

## 七、P09 批量复核页交互设计

### 7.1 页面进入前置条件

- 仅当 `session.hitl_subtype = batch_review` 时，路由守卫允许进入 `/contracts/:id/batch`
- 若用户尝试直接访问该路由但 `hitl_subtype ≠ batch_review`，路由守卫根据 `session.state` 重定向至对应功能页

### 7.2 页面整体结构

```
BatchReviewPage（/contracts/:id/batch）
├── 顶部全局导航栏（GlobalNav）
├── 工作流状态进度条（WorkflowStatusBar）
│   └─ 「人工审核」节点：橙色感叹号 + Tooltip「中风险条款待复核」
├── 页面标题区
│   ├─ 「中风险条款批量复核」（主标题）
│   └─ 说明文字：「以下条款为中等风险，您可逐条确认或批量确认」
├── 中风险条款列表（来源：GET /sessions/{id}/items?risk_level=medium）
│   └─ 条款复核行（逐条）
│       ├─ 勾选框（支持多选）
│       ├─ 条款序号 + 风险等级标签（中风险，橙色）
│       ├─ 判断来源标签（蓝色「规则触发」/ 紫色「AI 推理」）
│       ├─ AI 风险描述（模态表述，完整展示）
│       ├─ 置信度数值
│       └─ 单条操作按钮区
│           ├─ [Approve]（单条批准）
│           └─ [Reject]（单条拒绝）
├── 批量操作栏（底部固定，仅勾选 ≥ 1 条时显示）
│   ├─ 已选 N 条提示
│   ├─ 批量确认备注框（选填）
│   └─ [批量确认] 按钮
└─ 提交区
    └─ [提交全部复核结果] 按钮（所有条款均已处理后解锁）
```

### 7.3 批量确认流程步骤层级

```
Step 1：用户勾选中风险条款（支持单选/多选/全选）
    │   - 勾选后底部批量操作栏出现
    │   - 显示「已选 N 条」
    │
    ▼
Step 2：用户（可选）填写批量备注
    │   - 批量操作栏内的备注框（选填，无最小字符限制）
    │   - 默认值：「中风险条款已统一复核，风险可接受」
    │
    ▼
Step 3：用户点击「批量确认」
    │   - 触发批量确认二次确认弹窗
    │   弹窗内容：
    │     ┌────────────────────────────────────────┐
    │     │  批量确认中风险条款                       │
    │     │  ─────────────────────────────────────  │
    │     │  即将批量确认 N 条中风险条款               │
    │     │  备注：「[human_note 内容]」              │
    │     │  ─────────────────────────────────────  │
    │     │  注意：此操作不适用于高风险条款             │
    │     │  [取消]              [确认提交]           │
    │     └────────────────────────────────────────┘
    │
    ▼
Step 4：用户点击「确认提交」
    │   - 发送 POST /sessions/{session_id}/items/batch-confirm
    │     请求体：{ item_ids: ["...", "..."], human_note: "..." }
    │   - 批量确认按钮进入 loading 状态
    │
    ▼
Step 5：接收响应
    │   ├─ 成功（HTTP 200）：
    │   │   - 已确认条款行标记为「已批准」（绿色标记）
    │   │   - 显示 Toast：「已成功确认 N 条中风险条款」
    │   │   - 若响应体 all_medium_risk_completed = true：
    │   │       └─ 解锁「提交全部复核结果」按钮
    │   └─ 失败（HTTP 4xx）：
    │       - 显示错误 Toast（例如 BULK_HIGH_RISK_FORBIDDEN 错误）
    │
    ▼
Step 6：所有条款处理完成后，用户点击「提交全部复核结果」
    │   （此步骤为 UI 层面的最终确认，实际报告生成由后端在 batch-confirm 接口的后续逻辑驱动）
    │
    ▼
Step 7：跳转至报告生成等待页（/contracts/:id/report）
    └─ 订阅 SSE report_ready 事件，等待报告生成完成
```

### 7.4 单条操作（Approve / Reject）流程

```
单条 Approve（中风险）：
    1. 用户点击条款行的 [Approve] 按钮
    2. 触发内联确认（无需二次弹窗，直接展示简化确认区域）
    3. 可选填写备注（无最小字符限制）
    4. 点击「确认」→ 该条款行标记为「已批准」
    注意：中风险单条操作也通过 POST /sessions/{id}/items/batch-confirm
          传入单个 item_id 实现，接口与批量确认共用

单条 Reject（中风险）：
    1. 用户点击条款行的 [Reject] 按钮
    2. 展开拒绝原因输入框（选填）
    3. 点击「确认拒绝」→ 该条款行标记为「已拒绝」（灰色标记）
    注意：中风险 Reject 操作接口未在 api_spec 中单独定义 [未开发]
          当前 P09 主要通过 batch-confirm 接口处理批准场景
```

### 7.5 中风险与高风险严格区分规范

| 项目 | 中风险（P09） | 高风险（P08） |
|------|-------------|-------------|
| 批量操作 | 允许，通过 batch-confirm 接口 | 严禁，无任何批量入口 |
| human_note 要求 | 选填，无最小字符限制 | 必填，≥ 10 字 |
| 原文视野强制检测 | 不强制 | 强制（Approve 按钮前置条件） |
| 二次确认弹窗 | 批量操作有，单条操作内联简化 | 每次操作必须触发，不可跳过 |
| 撤销决策 | 无需支持（批量场景） | 支持，DELETE 接口 |

---

## 八、进度汇总区 UI 规范

### 8.1 组件位置与固定方式

```
进度汇总区定位规范：
  - 位置：P08 页面底部固定栏（fixed bottom bar）
  - 高度：56px
  - z-index：高于内容区，低于模态弹窗
  - 背景：白色半透明（backdrop-filter: blur(8px)）
  - 顶部边框：1px 浅灰色分割线
  - 宽度：与页面等宽（不含侧边栏）

组件内容布局：
  ┌───────────────────────────────────────────────────────────────┐
  │  高风险条款处理进度：  [进度条]  已处理 2 / 共 5 条  [40%]       │
  └───────────────────────────────────────────────────────────────┘
```

### 8.2 数据来源与更新机制

```
初始数据加载：
    └─ 调用 GET /sessions/{session_id}
       └─ 读取 progress_summary.decided_high_risk（已处理数）
       └─ 读取 progress_summary.total_high_risk（总数）

实时更新（双通道）：
  通道 1：SSE 事件 item_decision_saved
      └─ 事件 data 字段：{ decided_high_risk, total_high_risk }
      └─ 前端接收后立即更新进度计数

  通道 2：乐观更新（不等待 SSE）
      └─ Approve/Edit/Reject 提交成功（HTTP 201）后：
          └─ decided_high_risk + 1（本地乐观更新）
      └─ Revoke 提交成功（HTTP 200）后：
          └─ decided_high_risk - 1（本地乐观更新）
      └─ 若后续 SSE 数据与本地不一致，以 SSE 数据覆盖本地

进度条视觉规格：
  - 进度条颜色：蓝色（未完成）→ 绿色（全部完成）
  - 数字格式：「已处理 N / 共 M 条」
  - 百分比格式：「X%」（N/M * 100，取整）
  - 全部完成时（N = M）：进度条变为全绿 + 文字变为「所有高风险条款已处理」
```

### 8.3 进度汇总区的字段映射

| UI 显示字段 | API 字段来源 | 接口 |
|------------|------------|------|
| 已处理条款数 | `progress_summary.decided_high_risk` | `GET /sessions/{id}` |
| 高风险条款总数 | `progress_summary.total_high_risk` | `GET /sessions/{id}` |
| 实时已处理数 | `decided_high_risk`（SSE 事件字段） | SSE `item_decision_saved` |
| 实时总数 | `total_high_risk`（SSE 事件字段） | SSE `item_decision_saved` |

---

## 九、跨天恢复 Banner 设计

### 9.1 Banner 触发条件

```
触发逻辑：
    1. 用户从 P02（工作台）或 P03（合同列表）点击「继续审批」进入 P08
    2. P08 页面加载时，前端调用 GET /sessions/{session_id}/recovery
    3. 若响应的 recovery_status = "active" 且 interrupted_at 非当天：
       └─ 判定为跨天恢复场景，展示恢复 Banner
    4. 若当天首次进入（非跨天恢复），则不展示 Banner

注意：当天首次进入与跨天恢复的区分逻辑
    - 判断标准：interrupted_at 的日期 < 当前日期（以用户本地时区计算）
    - 若无法区分（如 interrupted_at 为空），则不展示 Banner
```

### 9.2 Banner 内容与结构

```
恢复 Banner 布局（页面顶部，工作流状态进度条下方）：
┌──────────────────────────────────────────────────────────────────┐
│  [恢复图标]  已恢复上次审核进度                        [上次保存时间]  │
│             当前待处理第 N 条高风险条款                    [X] 关闭   │
└──────────────────────────────────────────────────────────────────┘

Banner 内容字段映射：
  - N：由 completed_count + 1 计算（下一条待处理编号）
       数据来源：GET /sessions/{id}/recovery 响应的 completed_count
  - 「上次保存时间」：格式化 interrupted_at 字段
       示例：「上次保存：2026-03-10 18:30」
  - 总条数：total_high_risk_count

完整 Banner 文案示例：
  「已恢复上次审核进度，当前待处理第 3 条高风险条款（共 5 条）
   上次保存：2026-03-10 18:30」
```

### 9.3 Banner 行为规范

```
页面定位行为：
    └─ Banner 展示的同时，前端自动滚动左栏条款列表至：
       next_pending_item_id 对应的条款卡片（数据来源：GET /sessions/{id}/recovery）
       使用 scrollIntoView({behavior: 'smooth', block: 'center'})

Banner 关闭行为：
    └─ 用户点击 [X] 关闭按钮
       └─ Banner 收起（本次页面访问内不再显示）
       └─ 不影响后端数据，不发送任何 API 请求

Banner 背景色：蓝色信息提示色（#E3F2FD，蓝色图标）
Banner 高度：约 56px（单行文字时）或 72px（双行文字时）
Banner 动画：页面加载后 300ms 延迟出现（slide-down 动画，持续 200ms）
```

### 9.4 Recovery 接口响应字段使用说明

| 响应字段 | 前端使用方式 |
|---------|------------|
| `interrupted_at` | 格式化后展示在 Banner 右上角「上次保存时间」 |
| `completed_count` | 计算「第 N 条」（completed_count + 1） |
| `total_high_risk_count` | 展示「共 M 条」 |
| `next_pending_item_id` | 页面加载后自动滚动定位至该条款 |
| `recovery_status` | 值为 `active` 时触发 Banner 展示 |

---

## 十、API 接口对应关系

### 10.1 P08 HITL 中断审核页使用的接口

| 功能场景 | 接口方法与路径 | 状态 | 备注 |
|---------|--------------|------|------|
| 加载页面时查询会话状态和进度 | `GET /sessions/{session_id}` | 已定义 | 读取 progress_summary 字段 |
| 加载条款列表（左栏） | `GET /sessions/{session_id}/items` | 已定义 | 参数 risk_level=high，sort_by=risk_level_desc |
| 查询单条条款详情（含 decision_history） | `GET /sessions/{session_id}/items/{item_id}` | 已定义 | Edit 操作时用于差异对比 |
| 提交 Approve 决策 | `POST /sessions/{session_id}/items/{item_id}/decision` | 已定义 | 需携带 Idempotency-Key |
| 提交 Edit 决策 | `POST /sessions/{session_id}/items/{item_id}/decision` | 已定义 | decision="edit"，需填 edited_risk_level 和 edited_finding |
| 提交 Reject 决策 | `POST /sessions/{session_id}/items/{item_id}/decision` | 已定义 | decision="reject"，可选 is_false_positive |
| 撤销决策（Revoke） | `DELETE /sessions/{session_id}/items/{item_id}/decision` | 已定义 | 前置条件：session.state=hitl_pending |
| 查询跨天恢复信息 | `GET /sessions/{session_id}/recovery` | 已定义 | 触发时机：用户从断点恢复进入页面 |
| 实时事件订阅 | `GET /sessions/{session_id}/events`（SSE） | 已定义 | 订阅 item_decision_saved / report_generation_started |

### 10.2 P09 批量复核页使用的接口

| 功能场景 | 接口方法与路径 | 状态 | 备注 |
|---------|--------------|------|------|
| 加载中风险条款列表 | `GET /sessions/{session_id}/items` | 已定义 | 参数 risk_level=medium |
| 批量确认中风险条款 | `POST /sessions/{session_id}/items/batch-confirm` | 已定义 | 前置条件：hitl_subtype=batch_review |
| 单条拒绝中风险条款 | 无独立接口 | **未开发** | api_spec 中无中风险单条 Reject 接口；当前仅 batch-confirm 支持批量批准 |
| 实时事件订阅 | `GET /sessions/{session_id}/events`（SSE） | 已定义 | 订阅 report_generation_started |

### 10.3 进度汇总区使用的接口

| 功能场景 | 接口方法与路径 | 状态 | 备注 |
|---------|--------------|------|------|
| 初始进度加载 | `GET /sessions/{session_id}` | 已定义 | 读取 progress_summary.decided_high_risk / total_high_risk |
| 实时进度更新 | SSE 事件 `item_decision_saved` | 已定义 | 事件 data 字段含 decided_high_risk / total_high_risk |

### 10.4 跨天恢复 Banner 使用的接口

| 功能场景 | 接口方法与路径 | 状态 | 备注 |
|---------|--------------|------|------|
| 获取恢复信息 | `GET /sessions/{session_id}/recovery` | 已定义 | 返回 interrupted_at / completed_count / next_pending_item_id |

### 10.5 防 Automation Bias 机制的 API 依赖

| 机制 | 依赖接口 | 状态 | 说明 |
|------|---------|------|------|
| 原文视野检测 | 依赖 `ReviewItem.risk_evidence[].highlight_anchor` 字段 | 已定义 | 字段包含在 GET /sessions/{id}/items 响应中 |
| 连续快速操作警示 | 无独立 API（前端本地计时器实现） | — | 警示记录由后端 bias_warning 日志保存，前端不生成日志 |
| human_note 字符计数 | 无额外 API | — | 纯前端实时校验 |
| 二次确认弹窗 | 无额外 API | — | 纯前端 UI 拦截，提交时携带 human_note 内容 |
| 禁止批量操作入口 | 后端 `BULK_HIGH_RISK_FORBIDDEN` 错误码作为双重保障 | 已定义 | 前端不渲染批量入口；后端 API 层同时拒绝 |

### 10.6 未开发接口汇总

| 场景 | 说明 |
|------|------|
| P09 中风险单条 Reject | api_spec 中无中风险条款单条拒绝的独立接口，batch-confirm 仅支持批量批准场景。若需要支持单条拒绝，需后端新增接口。 |

---

*本文档严格基于以下四份输入文档的既有定义产出，不包含超出其范围的新增假设或伪造的后端能力声明：*
- *`08_api_spec/api_spec-v1.0.md`*
- *`06_architecture/frontend_design_spec-v1.0.md`*
- *`06_architecture/frontend_backend_boundary_spec-v1.0.md`*
- *`04_interaction_design/langchain_hitl_arch-v1.0.md`*
