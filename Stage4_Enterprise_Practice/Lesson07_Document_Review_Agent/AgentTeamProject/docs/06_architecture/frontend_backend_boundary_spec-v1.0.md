# 前后端功能边界规范 v1.0

**文档编号**：06_architecture/frontend_backend_boundary_spec-v1.0
**版本**：v1.0
**编写日期**：2026-03-11
**输入文档**：
- `03_problem_modeling/problem_model.md`
- `04_interaction_design/flow_state_spec-v1.0.md`

---

## 一、职责划分总览

| 维度 | 前端（Frontend）| 后端（Backend）|
|------|----------------|----------------|
| **用户界面** | 页面渲染、交互逻辑、路由管理、状态展示 | 不涉及页面渲染 |
| **业务规则执行** | 展示结果；执行后端返回的指令 | 所有业务规则的判断与执行（风险分级、路由决策、HITL 流程管理） |
| **数据持久化** | 不直接操作数据库；通过 API 读写 | 所有数据的持久化（合同文件、ReviewSession、ReviewItem、操作日志） |
| **AI/Agent 调用** | 不直接调用 LLM 或 Agent；只展示结果 | 调用 LangGraph Agent、外部 OCR 服务、LLM 推理 |
| **状态机管理** | 根据后端返回的 `state` 渲染对应视图；不自行计算状态转换 | 管理 `ReviewSession.state` 全生命周期，驱动 LangGraph 状态机 |
| **权限校验** | 路由守卫（前端防君子）；按角色隐藏/禁用 UI 元素 | 所有接口的真实权限校验（后端防小人）|
| **审计日志** | 不生成日志；用户操作通过 API 提交，由后端记录 | 记录所有操作事件（含时间戳、操作人、操作内容） |
| **报告生成** | 展示报告内容；触发下载 | 生成 PDF/JSON 报告；提供下载接口 |
| **文件存储** | 负责文件选择、前端格式校验、分片/流式上传 | 负责文件服务端校验、存储、访问控制 |

---

## 二、前端专属职责

### 2.1 页面渲染与路由

- 根据用户角色（reviewer / submitter / admin）渲染对应的页面和菜单
- 路由守卫：访问 `/contracts/:id` 时，根据后端返回的 `ReviewSession.state` 和 `hitl_pending.subtype` 自动重定向至对应功能页
- 路由守卫：未登录用户重定向至 `/login`；非 admin 用户访问 `/admin` 重定向至 `/dashboard`

### 2.2 前端输入校验（仅辅助性，非最终权威）

| 校验项 | 校验位置 | 说明 |
|--------|---------|------|
| 合同文件格式（PDF/DOCX） | P04 上传前 | 减少无效请求；后端仍需二次校验 |
| 文件大小上限 | P04 上传前 | 上限值从后端配置接口获取 |
| `human_note` 字符数 ≥ 10 | P08 操作提交前 | 防 Automation Bias 机制的前端执行层 |
| 表单必填项非空 | 各表单提交前 | 通用交互规范 |

> **重要**：所有前端校验均为交互体验优化，不替代后端校验。后端必须对所有入参独立校验。

### 2.3 防 Automation Bias 前端执行层

以下行为约束**由前端负责执行**（与后端强制验证共同构成双重防护）：

| 机制 | 前端执行方式 |
|------|------------|
| Approve 按钮强制禁用（原文未进入视野） | 监听右栏滚动事件，判断高亮段落是否已进入视野，否则保持按钮 `disabled` |
| Approve 按钮强制禁用（human_note < 10 字） | 实时字符数校验，未达 10 字时保持按钮 `disabled` |
| 高风险 Approve 二次确认弹窗 | 前端拦截点击事件，弹出不可跳过的确认对话框 |
| 连续快速操作警示 | 前端计时器记录同会话高风险 Approve 操作时间间隔，触发警示弹窗 |
| 高风险条款无批量操作入口 | 前端不渲染任何高风险条款的批量操作 UI 元素 |

### 2.4 实时状态订阅

- 通过 WebSocket 或 SSE 订阅 `ReviewSession.state` 变更事件
- 在 P05（解析进度）、P07（扫描进度）、P10（报告生成中）页面，根据收到的状态变更事件自动跳转或刷新
- WorkflowStatusBar 组件实时更新节点状态

### 2.5 会话恢复定位

- 从中断点恢复审核时（P08），前端自动滚动至第一条 `human_decision=pending` 的高风险条款
- 显示恢复进度 banner（「已恢复上次审核进度，当前待处理第 N 条高风险条款」）
- banner 内容由前端根据后端返回数据计算渲染

---

## 三、后端专属职责

### 3.1 业务状态机管理

| 状态转换 | 后端职责 |
|---------|---------|
| `(new) → parsing` | 文件服务端校验通过后，创建 `Contract` 和 `ReviewSession`，提交 OCR 任务 |
| `parsing → scanning` | OCR 任务完成回调，更新 state，写入 `ExtractedField` 记录 |
| `scanning → hitl_pending/interrupt` | LangGraph routing 节点检测到高风险条款，调用 `interrupt()`，更新 state 及 subtype |
| `scanning → hitl_pending/batch_review` | LangGraph routing 节点仅检测到中风险，更新 state 及 subtype |
| `scanning → completed` | LangGraph routing 节点判断为纯低风险，自动通过 |
| `hitl_pending → completed` | 检测到所有 `risk_level=high` 的 `ReviewItem.human_decision ≠ pending` 后，调用 `resume()` |
| `completed → report_ready` | 报告异步生成完成，更新 state |
| 任意状态 → `aborted` | 用户主动放弃请求，或系统不可恢复故障 |

### 3.2 HITL 约束强制执行（后端权威校验）

| 约束 | 后端实现 |
|------|---------|
| 高风险条款不允许批量提交 | 接收到批量决策请求时，后端直接拒绝（返回 4xx 错误） |
| `human_note` 不能为空或过短 | 后端校验 `human_note` ≥ 10 字，否则拒绝写入 |
| `completed` 后禁止修改决策 | 后端校验 `ReviewSession.state ≠ completed`，否则拒绝更新 |
| 高风险条款不允许跳过 | 后端校验报告生成触发条件：所有 `risk_level=high` 的 `ReviewItem.human_decision ≠ pending` |

### 3.3 LangGraph 工作流管理

- 管理 LangGraph StateGraph 实例生命周期
- 通过 `ReviewSession.langgraph_thread_id` 绑定每个审核会话与 LangGraph 线程
- 负责 `interrupt()` 和 `resume()` 的调用时机
- 通过 Checkpointer 持久化所有工作流状态，支持跨天恢复

### 3.4 外部服务集成

| 外部服务 | 后端职责 | 前端职责 |
|---------|---------|---------|
| 外部 OCR 服务（如达观 TextIn） | 调用、结果解析、错误重试、数据写入 | 展示解析状态（进度条） |
| LLM / Agent 推理 | 调用、结果解析、置信度计算、风险条款写入 | 展示推理结果 |

### 3.5 审计日志记录

后端记录所有操作事件，前端**不参与**日志生成：

| 事件分组 | 事件类型 |
|---------|---------|
| 阶段一（上传与解析） | `contract_uploaded` / `contract_created` / `session_created` / `parse_started` / `parse_completed` / `parse_failed` / `parse_timeout` / `session_aborted` |
| 阶段二（扫描与路由） | `field_verified` / `field_modified` / `field_verify_skipped` / `scan_triggered` / `scan_completed` / `route_auto_passed` / `route_batch_review` / `route_interrupted` / `system_failure` / `business_failure` / `retry_triggered` |
| 阶段三（HITL 与报告） | `item_approved` / `item_edited` / `item_rejected` / `decision_revoked` / `session_resumed` / `report_generation_started` / `report_ready` / `report_downloaded` |

### 3.6 报告生成

- 异步生成审核报告（PDF + JSON），不阻塞前端
- 报告必须包含：执行摘要 + 详细条款清单 + 覆盖范围声明 + 免责声明
- 免责声明内容：「AI 辅助分析，最终判断由人工审核人员负责」（固定文本，不可删改）
- 提供 PDF 和 JSON 两种下载接口

---

## 四、数据归属矩阵

### 4.1 由后端提供、前端只读展示的数据

| 数据 | 来源实体 | 前端操作权限 |
|------|---------|------------|
| 合同基本信息（标题、文件类型、上传人、上传时间） | `Contract` | 只读 |
| 审核会话状态及子类型 | `ReviewSession.state` / `ReviewSession.hitl_subtype` | 只读（不可前端修改） |
| LangGraph 线程 ID | `ReviewSession.langgraph_thread_id` | 对前端透明（前端无需感知） |
| 结构化提取字段（字段名、AI 提取值、置信度、低置信度标记） | `ExtractedField` | 可读；值可由用户修改并提交 |
| 风险条款列表（条款原文、风险等级、置信度、判断来源、原文定位锚点、AI 描述） | `ReviewItem` | 只读（AI 判断部分）；`human_decision` 和 `human_note` 由用户填写后提交 |
| 人工决策状态（approve/edit/reject/pending） | `ReviewItem.human_decision` | 前端渲染当前状态；用户提交操作后由后端更新 |
| 审核报告内容（执行摘要、详细分析、覆盖范围声明） | `ReviewReport` | 只读 |
| 操作审计日志 | AuditLog（内部） | 只读（在报告中展示） |
| 扫描维度清单（已覆盖/进行中/未覆盖）| 后端配置 | 只读 |
| 用户列表及角色（admin 页） | `User` | admin 可操作 |
| 风险规则库（admin 页） | 规则库 | admin 可操作 |

### 4.2 由前端收集、提交至后端的数据

| 数据 | 触发场景 | 提交接口（逻辑描述）|
|------|---------|------------------|
| 合同文件 + 合同名称 + 备注 | P04 上传表单提交 | 创建合同及审核会话 |
| 字段修改值（field_value） | P06 字段核对修改 | 更新 ExtractedField |
| 字段核对确认/跳过事件 | P06 用户操作 | 记录 `field_verified` / `field_verify_skipped` 事件 |
| 扫描触发指令 | P06 点击「开始 AI 风险扫描」| 触发 LangGraph 风险扫描 |
| HITL 决策（human_decision + human_note） | P08 Approve/Edit/Reject 提交 | 更新 ReviewItem 决策 |
| 决策撤销指令 | P08 撤销操作 | 将 ReviewItem 回退至 pending |
| 报告下载操作 | P10 下载按钮 | 触发下载，后端记录 `report_downloaded` 事件 |
| 会话放弃指令 | 各页面放弃按钮 | 触发 `session_aborted` 状态转换 |

---

## 五、操作流程归属

### 5.1 必须由前端发起的操作（前端主动触发，后端被动响应）

| 操作 | 前端发起时机 | 后端响应 |
|------|------------|---------|
| 合同文件上传 | 用户提交上传表单 | 接收文件、校验、创建 Contract + ReviewSession，启动 OCR |
| 触发 AI 风险扫描 | 用户在字段核对页点击「开始 AI 风险扫描」| 启动 LangGraph 扫描流程 |
| 提交 HITL 决策 | 用户在审核页提交 Approve/Edit/Reject | 持久化决策，检查是否满足 resume 条件 |
| 撤销 HITL 决策 | 用户在审核页点击撤销 | 将对应 ReviewItem 回退至 pending |
| 放弃审核会话 | 用户确认放弃 | 将 ReviewSession 状态转换至 aborted |
| 下载报告 | 用户点击下载 PDF 或 JSON | 返回文件流 + 记录下载日志 |
| 修改提取字段值 | 用户在字段核对页修改并保存 | 更新 ExtractedField |

### 5.2 由后端自主执行（前端无法干预的后端内部流程）

| 操作 | 说明 |
|------|------|
| OCR 任务调度与解析 | 后端与外部 OCR 服务通信，前端无法直接控制 |
| LangGraph 节点执行（风险扫描、分级路由） | 后端 Agent 内部执行，前端订阅结果 |
| 状态机转换驱动 | 所有 ReviewSession.state 转换由后端决定，前端只读取 |
| Checkpointer 持久化 | 每步工作流状态自动持久化，前端无感知 |
| 报告异步生成 | 后端触发并完成，前端订阅 `report_ready` 事件 |
| 操作审计日志写入 | 所有事件日志由后端记录，前端不参与 |
| 会话并发锁管理 | 同一会话只允许一个活跃用户；锁超时 5 分钟自动释放 |

### 5.3 前端不得执行的操作（禁止越界行为）

| 禁止行为 | 原因 |
|---------|------|
| 前端直接调用 LLM / OCR API | 数据安全红线：合同文件不得经由前端传输至外部服务 |
| 前端自行计算风险等级或路由决策 | 业务规则由后端权威执行，前端计算结果不可信 |
| 前端直接修改 ReviewSession.state | 状态机由后端管理，前端修改会导致状态不一致 |
| 前端跳过 HITL 批量提交高风险决策 | 设计红线：高风险必须逐条人工处理 |
| 前端生成或修改审计日志 | 审计链路的可信度要求日志必须由后端系统记录 |
| 前端绕过 human_note 校验强制提交 | 防 Automation Bias 的核心机制，必须由后端最终校验 |

---

## 六、API 交互模式约定

### 6.1 接口调用基本约定

| 约定项 | 规范 |
|--------|------|
| 认证方式 | 所有接口需携带认证凭证（具体方案由 08_api_spec 定义） |
| 权限校验 | 所有接口后端独立校验权限，不信任前端传递的角色信息 |
| 错误处理 | 后端统一错误格式；前端根据错误码展示用户友好提示 |
| 幂等性 | HITL 决策提交接口需支持幂等（防重复提交） |

### 6.2 关键接口逻辑边界（按场景分组）

| 场景 | 前端发起 | 后端执行 | 后端响应 |
|------|---------|---------|---------|
| 文件上传 | POST 合同文件 + 元信息 | 服务端格式/大小校验 + 存储 + 创建实体 | 返回 `contract_id` + `session_id` + 初始 state |
| 字段修改 | PATCH 字段 ID + 新值 | 更新 ExtractedField + 记录 `field_modified` | 返回更新后的字段记录 |
| 触发扫描 | POST 触发扫描指令（携带 session_id） | 启动 LangGraph 扫描流程 | 返回扫描已启动确认 |
| 提交 HITL 决策 | POST 决策（session_id + item_id + decision + note） | 校验 note 长度 + 非批量 + state 合法 + 持久化 + 检查 resume 条件 | 返回更新后的 ReviewItem + 当前会话进度 |
| 撤销决策 | DELETE/PATCH 决策（item_id） | 校验 state ≠ completed + 回退 pending | 返回更新后的 ReviewItem |
| 放弃会话 | POST 放弃指令（session_id） | state → aborted + 记录日志 | 返回 aborted 确认 |
| 获取报告 | GET 报告（session_id） | 返回报告 JSON 内容 | 完整报告数据 |
| 下载报告 | GET 下载接口（session_id + format） | 生成并返回文件流 + 记录下载日志 | 文件流（PDF/JSON） |

### 6.3 批量操作限制约定

| 接口类型 | 是否允许批量 | 说明 |
|---------|-----------|------|
| 高风险 ReviewItem 决策提交 | **严禁批量** | 后端拒绝包含多条高风险 item 的批量请求 |
| 中风险 ReviewItem 决策提交 | 允许批量 | 对应 hitl_pending/batch_review 场景 |
| 低风险 ReviewItem | 不需要提交 | 后端自动处理，前端无操作入口 |

---

## 七、实时通信约定

### 7.1 WebSocket/SSE 使用边界

| 职责 | 前端 | 后端 |
|------|------|------|
| 建立连接 | 前端在进入 P05~P10 相关页面时主动建立 | 后端维护连接管理 |
| 推送事件 | 只接收 | 在 `ReviewSession.state` 发生变更时主动推送 |
| 断线重连 | 前端负责自动重连逻辑 | 后端支持断线后状态补偿（重连后推送当前最新 state） |

### 7.2 需要实时推送的关键事件

| 事件 | 触发时机 | 前端响应 |
|------|---------|---------|
| `state_changed: scanning` | OCR 解析完成 | P05 自动跳转至 P06 |
| `route_auto_passed` | 低风险路由完成 | P07 自动跳转至 P10 |
| `route_batch_review` | 中风险路由完成 | P07 自动跳转至 P09 |
| `route_interrupted` | 高风险路由完成 | P07 自动跳转至 P08 |
| `report_ready` | 报告生成完成 | P10 自动刷新展示报告内容 |
| `parse_failed` / `parse_timeout` | OCR 失败 | P05 展示错误状态 + 重试入口 |

---

## 八、设计红线落地分工

来自 `03_problem_modeling` 的 8 条设计红线，在前后端的落地方式：

| 设计红线 | 前端落地 | 后端落地 |
|---------|---------|---------|
| **人工决策不可绕过（高风险）** | 不渲染批量操作入口；Approve 按钮三项前置检查；二次确认弹窗 | 拒绝批量高风险决策请求；校验 human_note ≥ 10 字 |
| **AI 结论不可绝对化** | 使用模态表述；禁止显示"无风险"；展示置信度 | 接口返回数据中不含绝对化结论字段；报告生成时强制注入免责声明 |
| **覆盖范围必须声明** | 在 P07 展示扫描维度清单；P10 报告中强制展示覆盖范围声明区域（不可隐藏） | 报告生成时必须包含 `coverage_statement` 字段 |
| **判断来源必须可区分** | 用颜色 + 边框双维度渲染 `rule_engine` / `ai_inference` 标签（色盲友好） | 每条 ReviewItem 必须包含 `source` 字段，不可为空 |
| **操作全程可追溯** | 无需前端记录日志；不得绕过 API 直接操作数据 | 记录全部 27 类操作事件，含时间戳和操作人 |
| **不自研 OCR** | 无需前端关注 OCR 实现细节 | 接入外部 OCR 方案；禁止后端自研 OCR 模块 |
| **不做完整 CLM 平台** | 不渲染模板管理、电子签章、合同归档等非核心功能入口 | 不实现 CLM 平台相关业务逻辑 |
| **数据安全** | 合同文件通过后端 API 上传，不经由前端直传第三方 | OCR 调用符合数据主权合规；合同文件不明文传输至不受控外部 API |

---

*本文档严格基于 `03_problem_modeling/problem_model.md` 和 `04_interaction_design/flow_state_spec-v1.0.md` 的内容产出，不包含超出上述文档范围的新增假设。*
