# 合同审核系统 — 交互链路与状态机规范 v1.0

**文档编号**：04_interaction_design/flow_state_spec-v1.0
**版本**：v1.0
**编写日期**：2026-03-11
**编写角色**：Lead（汇总整合）
**输入文档**：
- `04_interaction_design/t1_upload_and_parse.md`（Teammate 1）
- `04_interaction_design/t2_review_states.md`（Teammate 2）
- `04_interaction_design/t3_hitl_approval.md`（Teammate 3）
**上游依据**：`03_problem_modeling/problem_model.md`

---

## 一、全流程交互链路概览

### 1.1 端到端主流程

```
用户触达上传入口
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 阶段一（Teammate 1）：上传 → 校验 → 解析                             │
│                                                                     │
│  [上传入口] → [前端校验] → [上传中] → [服务端校验] → [创建会话]       │
│                                                     ↓               │
│                                               ReviewSession         │
│                                               state = parsing       │
│                                                     ↓               │
│                                          [调用外部 OCR 解析]         │
│                                                     ↓               │
│                                               解析完成               │
│                                          state: parsing → scanning  │
└─────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 阶段二（Teammate 2）：字段核对 → AI 扫描 → 分级路由                   │
│                                                                     │
│  [结构化字段展示] → 用户核对低置信度字段 → [开始 AI 风险扫描]          │
│                                              state = scanning        │
│                                                     ↓               │
│                                          [LangGraph 风险扫描节点]    │
│                                                     ↓               │
│                                        ┌────────────┤               │
│                            低风险       │  分级路由  │ 高风险         │
│                              ↓          └────────────┘  ↓           │
│                        state=completed    中风险    state=hitl_pending│
│                        （跳过 HITL）        ↓       （type:interrupt）│
│                                      state=hitl_pending             │
│                                      （type:batch_review）          │
└─────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 阶段三（Teammate 3）：HITL 人工审批 → 报告生成                        │
│                                                                     │
│  [双栏对照视图]                                                      │
│  左：风险条款卡片（Approve/Edit/Reject）                              │
│  右：合同原文（双向锚定高亮）                                         │
│                                                                     │
│  逐条处理高风险条款 → 全部完成后 LangGraph resume()                  │
│                                         state: hitl_pending→completed│
│                                                     ↓               │
│                                          [异步生成审核报告]           │
│                                          state = report_ready        │
│                                          [PDF / JSON 下载]           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、ReviewSession.state 完整状态机

### 2.1 状态枚举定义

| 状态值 | 中文含义 | 负责阶段 | 进入条件 | 出口条件 |
|--------|----------|----------|----------|----------|
| `parsing` | OCR 解析中 | Teammate 1 | Contract 和 ReviewSession 创建完成，OCR 任务已提交 | 解析成功 → `scanning`；用户放弃或不可恢复错误 → `aborted` |
| `scanning` | AI 风险扫描中 | Teammate 2 | OCR 解析完成，用户触发扫描（或自动触发） | 路由后进入 `hitl_pending`；低风险直通 `completed`；失败 → `aborted` |
| `hitl_pending` | 等待人工介入 | Teammate 2/3 | LangGraph routing 节点完成路由判断 | 全部高风险处理完成 → `completed`；用户主动放弃 → `aborted` |
| `completed` | 审核流程已完成 | Teammate 3 | 所有高风险条款的 `human_decision != pending` | 报告生成后进入 `report_ready`（子状态）|
| `report_ready` | 报告已就绪 | Teammate 3 | 报告异步生成完成 | 终态 |
| `aborted` | 流程已中止 | 全阶段 | 任意阶段用户主动放弃，或系统不可恢复故障 | 终态（用户可新建 ReviewSession） |

### 2.2 完整状态流转图

```
             (new)
               │
               │ 文件上传并创建 ReviewSession
               ▼
           parsing  ◄────────────────────────────────────────┐
               │                                             │
               │ OCR 解析成功                         重试（≤3次）
               ▼                                             │
           scanning ◄── 用户触发扫描           parse_failed / parse_timeout
               │                                             │
               │ LangGraph routing 完成                      │
               ├──── 低风险（无需人工）────────────► completed
               │                                        │
               ├──── 中风险（batch_review）──┐           │
               │                            ▼           │
               └──── 高风险（interrupt）──► hitl_pending │
                                            │           │
                                            │ 所有高风险条款处理完成
                                            ▼           │
                                         completed ◄────┘
                                            │
                                            │ 报告异步生成完成
                                            ▼
                                       report_ready（终态）

    任意阶段 ──── 用户主动放弃 / 系统不可恢复故障 ───► aborted（终态）
```

### 2.3 hitl_pending 内部子类型

`hitl_pending` 通过 `subtype` 字段区分两种模式，不扩展为独立的顶层状态：

| subtype | 触发条件 | 界面模式 | 批量操作权限 |
|---------|----------|----------|-------------|
| `batch_review` | 存在中风险条款，无高风险 | 复核列表视图，可批量确认 | 允许批量确认中风险条款 |
| `interrupt` | 存在至少一条高风险条款 | 流程暂停视图，逐条强制处理 | **严禁任何批量操作** |

---

## 三、ReviewItem.human_decision 完整状态机

### 3.1 状态枚举

| 枚举值 | 含义 | 可转入的前置状态 |
|--------|------|-----------------|
| `pending` | 待处理（初始值） | 初始化；或撤销后回退 |
| `approve` | 审核人员接受 AI 判断 | `pending` |
| `edit` | 审核人员修改了 AI 的风险等级或描述 | `pending` |
| `reject` | 审核人员认为 AI 判断有误（误报） | `pending` |

### 3.2 状态转换约束

| 转换 | 前提条件 | 严禁情况 |
|------|----------|----------|
| `pending → approve` | 高风险条款：原文已展开 + `human_note` ≥ 10 字 | 无原因批量通过；`ReviewSession.state = completed` 后 |
| `pending → edit` | `human_note` ≥ 10 字，风险等级或描述有修改 | `ReviewSession.state = completed` 后 |
| `pending → reject` | `human_note` ≥ 10 字 | `ReviewSession.state = completed` 后 |
| `approve/edit/reject → pending` | 用户主动撤销，报告未生成 | `ReviewSession.state = completed` 后（报告已锁定） |
| 批量状态更新 | — | **前端和后端均严禁** |

### 3.3 报告生成触发条件

- 触发条件：`ReviewSession` 中所有 `risk_level = high` 的 `ReviewItem.human_decision ∈ {approve, edit, reject}`
- 中低风险条款的 `human_decision` 状态不阻塞报告生成
- 仍为 `pending` 的中低风险条款，报告中以"AI 自动通过（人工未复核）"标注

---

## 四、三阶段衔接点规范

### 4.1 阶段一 → 阶段二（解析完成 → 字段核对）

| 项目 | 规范 |
|------|------|
| **触发方式** | 系统自动触发，`ReviewSession.state: parsing → scanning`，页面自动跳转 |
| **移交数据** | OCR 解析结果写入数据库；`ExtractedField` 记录含 `confidence_score` 和 `needs_human_verification` |
| **低置信度传递** | `confidence_score < 70` 的字段设置 `needs_human_verification = true`，Teammate 2 负责在字段核对视图中展示橙色边框提示 |
| **扫描件标记传递** | 若文件为扫描件，`ReviewSession.is_scanned_document = true`，Teammate 2 在进度展示中需说明 OCR 可能影响精度 |

### 4.2 阶段二 → 阶段三（分级路由 → HITL 审批）

| 项目 | 规范 |
|------|------|
| **触发方式** | LangGraph `routing` 节点执行完毕，对高风险路由调用 `interrupt()`，`ReviewSession.state = hitl_pending`（type: interrupt） |
| **移交数据** | 所有 `ReviewItem` 记录已创建，含 `risk_level`、`confidence_score`、`source`、`clause_location` |
| **高亮锚定依赖** | Teammate 3 的双栏视图依赖 `ReviewItem.clause_location`（页码 + 段落偏移），Teammate 2 在创建 ReviewItem 时必须准确写入此字段 |
| **工作流暂停标识** | `ReviewSession.langgraph_thread_id` 已绑定，Teammate 3 通过此 ID 实现跨天异步恢复 |

### 4.3 阶段三 → 报告（审批完成 → 报告生成）

| 项目 | 规范 |
|------|------|
| **触发方式** | 后端检测到所有高风险 `ReviewItem.human_decision != pending`，调用 LangGraph `resume()`，`ReviewSession.state = completed` |
| **报告依赖数据** | `ExtractedField`（执行摘要）+ `ReviewItem` 全字段（含历史快照）+ Checkpointer 操作日志（审计链路）|
| **报告必须声明** | 覆盖范围声明 + 免责声明（"AI 辅助分析，最终判断由人工审核人员负责"） |

---

## 五、全量操作日志事件类型

汇总三个阶段定义的全部审计事件类型，供数据模型（`07_data_model`）和架构设计（`06_architecture`）使用：

### 5.1 阶段一事件（Teammate 1）

| event_type | 触发时机 |
|------------|----------|
| `contract_uploaded` | 文件服务端校验通过 |
| `contract_created` | Contract 记录创建 |
| `session_created` | ReviewSession 创建，state = parsing |
| `parse_started` | OCR 任务提交至外部服务 |
| `parse_completed` | OCR 解析成功，结果写入 |
| `parse_failed` | OCR 服务返回错误 |
| `parse_timeout` | 解析超时（> 15 分钟） |
| `session_aborted` | 用户确认放弃或系统触发中止 |

### 5.2 阶段二事件（Teammate 2）

| event_type | 触发时机 |
|------------|----------|
| `field_verified` | 用户确认低置信度字段 |
| `field_modified` | 用户修改 AI 提取的字段值 |
| `field_verify_skipped` | 用户跳过低置信度字段核对 |
| `scan_triggered` | 风险扫描触发 |
| `scan_completed` | 扫描完成，路由结果确定 |
| `route_auto_passed` | 低风险自动通过 |
| `route_batch_review` | 进入中风险批量复核队列 |
| `route_interrupted` | 高风险触发 LangGraph interrupt |
| `system_failure` | 系统级失败 |
| `business_failure` | 业务级失败 |
| `retry_triggered` | 用户触发重试 |

### 5.3 阶段三事件（Teammate 3）

| event_type | 触发时机 |
|------------|----------|
| `item_approved` | 审核人员提交 Approve 操作 |
| `item_edited` | 审核人员提交 Edit 操作 |
| `item_rejected` | 审核人员提交 Reject 操作 |
| `decision_revoked` | 审核人员撤销已有决策 |
| `session_resumed` | 审核人员从断点恢复审批 |
| `report_generation_started` | LangGraph resume()，进入报告生成 |
| `report_ready` | 报告异步生成完成 |
| `report_downloaded` | 用户下载报告（PDF 或 JSON） |

---

## 六、设计红线合规检查

以下为来自 `03_problem_modeling/problem_model.md` 的 8 条设计红线，汇总三份文档的对应措施：

| 设计红线 | 阶段一（T1）措施 | 阶段二（T2）措施 | 阶段三（T3）措施 |
|----------|----------------|----------------|----------------|
| **人工决策不可绕过（高风险）** | — | 禁止在流程暂停视图提供任何跳过入口 | 高风险 Approve 前三项强制检查；禁止批量通过；后端拒绝批量请求 |
| **AI 结论不可绝对化** | 扫描件警告为非绝对化表述 | 低风险自动通过展示页必须含免责声明；扫描中禁止显示"无风险"字样 | 所有 AI 描述使用"可能存在…风险"等模态表述；报告禁用"审核通过"等绝对化结论 |
| **覆盖范围必须声明** | — | 扫描进度视图展示扫描维度清单（已覆盖/进行中/未覆盖） | 报告必须包含 `coverage_statement`，不可省略 |
| **判断来源必须可区分** | — | 来源标签（规则触发/AI 推理）为必须显示元素，颜色+Tooltip 双重区分 | 两种来源使用颜色+边框样式两个视觉维度区分（色盲友好） |
| **操作全程可追溯** | 8 类事件类型，含每步时间戳和操作人 | 11 类事件类型，含路由决策记录 | 8 类事件类型；报告必须包含完整操作审计日志 |
| **不自研 OCR** | 明确接入外部方案（达观 TextIn），仅负责任务调度 | — | — |
| **不做完整 CLM 平台** | 上传入口聚焦合同文件，不提供模板管理、电子签章等功能 | 扫描结果视图聚焦风险识别，无合同生命周期管理入口 | 报告导出为 PDF/JSON，不涉及电子签章或合同归档管理 |
| **数据安全** | OCR 调用需符合数据主权合规；合同文件不得明文传输至不受控外部 API | — | — |

---

## 七、关键交互规范速查

### 7.1 双栏对照视图（阶段三核心）

| 属性 | 规范 |
|------|------|
| 左栏宽度 | 42%，风险条款卡片列表 |
| 右栏宽度 | 58%，合同原文只读 |
| 双向关联 | 点击左侧卡片 → 右侧原文 smooth scroll + 高亮；点击右侧高亮段落 → 左侧卡片激活 |
| 同步延迟 | ≤ 100ms |
| 高亮色规范 | 高风险：浅红 `#FFEBEE`；中风险：浅橙；左侧竖线颜色与风险等级色一致 |
| 初始定位 | 页面加载后自动定位到第一条 `risk_level = high` 且 `human_decision = pending` 的条款 |

### 7.2 工作流状态可视化（阶段二定义，全局可见）

| 属性 | 规范 |
|------|------|
| 位置 | 页面顶部固定区域，全局导航栏下方，高度 64px |
| 节点列表 | 上传解析 → 字段核对 → AI 扫描 → 分级路由 → 人工审核 → 报告生成 |
| 中断态显示 | 感叹号图标 + 橙色，Tooltip 显示"流程已暂停 - 等待人工操作" |
| 刷新机制 | WebSocket 或 SSE 订阅 `ReviewSession.state` 变更事件，实时更新 |

### 7.3 防 Automation Bias 关键机制（阶段三）

| 机制 | 触发范围 | 实现方式 |
|------|----------|----------|
| 强制展开原文 | 高风险条款 Approve | Approve 按钮在用户触达原文对应区域前保持禁用 |
| 必填接受原因 | 高风险条款 Approve/Edit/Reject | `human_note` ≥ 10 字才允许提交 |
| 二次确认对话框 | 高风险条款 Approve | 不可跳过的确认弹窗，展示用户已填写的接受原因 |
| 连续快速操作警示 | 全部高风险条款 | 同一会话 5 条高风险条款均在 10 秒内 Approve，触发警示提示 |
| 禁止批量通过 | 全部高风险条款 | 前端无批量操作入口；后端拒绝批量决策请求 |

### 7.4 异步跨天恢复机制

| 属性 | 规范 |
|------|------|
| 持久化载体 | LangGraph Checkpointer，通过 `ReviewSession.langgraph_thread_id` 绑定 |
| 自动保存时机 | 每次 Approve/Edit/Reject 提交成功后立即持久化 |
| 恢复入口 | 合同列表"待继续审批"按钮；首页"待我处理"模块 |
| 恢复后行为 | 自动滚动至第一条 `human_decision = pending` 的高风险条款，显示恢复进度 banner |
| 并发保护 | 同一会话同时只允许一个活跃用户；锁超时 5 分钟自动释放 |

---

## 八、后续阶段衔接

| 后续阶段 | 应参考的本文档内容 |
|----------|--------------------|
| `05_prototype_spec` | 第二章全流程链路图、7.1 双栏视图布局规范、7.2 工作流状态可视化、各阶段界面状态清单 |
| `06_architecture` | 第二章 ReviewSession.state 枚举与转换条件、LangGraph interrupt/resume 触发点、OCR 外部依赖、WebSocket/SSE 实时推送需求 |
| `07_data_model` | 第二章状态枚举（直接映射为数据库 ENUM）、第三章 ReviewItem 枚举、第五章事件类型枚举 |
| `08_api_spec` | 4.1-4.3 三阶段衔接点中的数据移交规范、7.4 恢复机制（REST API 端点设计）、报告导出接口（PDF/JSON） |
| `11_integration_testing` | 第六章设计红线合规检查（作为测试用例生成的基准）、7.3 防 Automation Bias 机制（UI 自动化测试场景） |

---

*本文档为 Lead 基于 Teammate 1、2、3 三份独立交互链路规范整合产出，不包含 Lead 的主观设计内容，仅做结构化汇总、衔接定义与速查整理。*
