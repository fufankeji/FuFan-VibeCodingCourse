# 合同审核 LangChain HITL 工作流规范 v1.0

**文档编号**：06_architecture/langchain_hitl_workflow-v1.0
**版本**：v1.0
**编写日期**：2026-03-11
**编写角色**：Teammate 2（架构研究）
**输入文档**：
- `01_business_research/business_summary.md`
- `03_problem_modeling/problem_model.md`
- `04_interaction_design/flow_state_spec-v1.0.md`
- `04_interaction_design/t3_hitl_approval.md`
- `06_architecture/frontend_backend_boundary_spec-v1.0.md`
**官方文档来源**：LangChain / LangGraph 官方文档（查询日期：2026-03-11）

---

## 一、概述：LangGraph HITL 机制简介

### 1.1 为何选用 LangGraph 的 HITL 机制

合同审核系统的核心业务约束是：**高风险条款必须由人工逐条确认，AI 不得自主做最终法律判断**。这一约束不能通过普通的 API 调用流程满足，因为普通 API 调用是同步短生命周期的，无法支撑"审核人员离开系统后次日再继续"的异步场景。

LangGraph 的 HITL 机制（Human-in-the-Loop）通过以下核心能力原生支撑这一场景：

| 能力 | LangGraph 提供方式 | 在本系统中的用途 |
|------|------------------|----------------|
| **工作流暂停** | `interrupt()` 函数 | 在高风险路由节点暂停工作流，等待人工介入 |
| **无限期等待** | interrupt 后工作流等待，无超时限制 | 支持审核人员跨天、跨会话恢复 |
| **状态持久化** | Checkpointer 层自动在每步写入快照 | 保存完整工作流状态，支持任意时间点恢复 |
| **工作流恢复** | `Command(resume=...)` | 人工决策完成后触发后续报告生成节点 |
| **线程隔离** | `thread_id` 参数 | 每个合同审核会话对应独立线程，状态互不干扰 |

**官方定义（来自 LangGraph 文档）**：

> "Interrupts allow you to pause graph execution at specific points and wait for external input before continuing. When an interrupt is triggered, LangGraph saves the graph state using its persistence layer and waits indefinitely until you resume execution."
>
> — LangGraph Interrupts 文档，https://docs.langchain.com/oss/python/langgraph/interrupts

> "LangGraph has a built-in persistence layer that saves graph state as checkpoints. When you compile a graph with a checkpointer, a snapshot of the graph state is saved at every step of execution, organized into threads. This enables human-in-the-loop workflows, conversational memory, time travel debugging, and fault-tolerant execution."
>
> — LangGraph Persistence 文档，https://docs.langchain.com/oss/python/langgraph/persistence

### 1.2 HITL 适用场景对照

LangGraph 官方文档指出 HITL 适用于以下场景，与本系统高度重叠：

| 官方适用场景 | 本系统对应场景 |
|------------|--------------|
| 高风险操作需要人工审批（如数据库写入、金融交易） | 高风险条款的法律认定，错误决策可能导致合同纠纷 |
| 合规工作流中人工监督是强制要求 | 受监管行业的合同审核审计合规要求 |
| 需要人工反馈引导的长期任务 | 跨天异步审核，完整生命周期可达数天 |

---

## 二、审核状态定义

### 2.1 ReviewSession 顶层状态枚举

以下状态枚举由 `03_problem_modeling` 和 `04_interaction_design` 阶段定义，在此处与 LangGraph 机制对齐说明：

| 状态值 | 中文含义 | LangGraph 对应机制 | 进入条件 | 退出条件 |
|--------|----------|-------------------|----------|----------|
| `parsing` | OCR 解析中 | 普通节点执行，无 interrupt | Contract 和 ReviewSession 创建后，OCR 任务已提交 | OCR 完成 → `scanning`；不可恢复错误 → `aborted` |
| `scanning` | AI 风险扫描中 | LangGraph `scanning_node` 执行中 | OCR 完成，用户触发扫描 | routing 节点完成路由判断后转移 |
| `hitl_pending` | 等待人工介入 | **LangGraph `interrupt()` 已触发，图执行暂停** | `routing_node` 检测到高风险或中风险条款 | 所有高风险条款 `human_decision != pending` → `completed` |
| `completed` | 审核流程完成 | LangGraph `Command(resume=...)` 已调用，图继续执行 | 后端检测到高风险条款全部处理完毕 | 报告生成完成 → `report_ready` |
| `report_ready` | 报告已就绪 | `report_generation_node` 执行完成 | 报告异步生成完成 | 终态 |
| `aborted` | 流程已中止 | LangGraph thread 不再 resume | 用户主动放弃或系统不可恢复故障 | 终态 |

### 2.2 hitl_pending 子类型区分

`hitl_pending` 通过 `subtype` 字段区分，两种子类型对应不同的 interrupt 语义：

| subtype | 含义 | interrupt 是否触发 | 人工操作约束 |
|---------|------|-------------------|-------------|
| `interrupt` | 存在高风险条款，强制逐条处理 | **是，LangGraph 图执行完全暂停** | 严禁批量操作；每条必须逐一处理 |
| `batch_review` | 仅中风险条款，可批量复核 | 是，图执行暂停，但操作限制宽松 | 允许批量确认中风险条款 |

### 2.3 ReviewItem.human_decision 枚举

每条风险条款（ReviewItem）的人工决策状态：

| 枚举值 | 含义 | 对应 HITL 操作 | 前置状态 |
|--------|------|--------------|---------|
| `pending` | 待处理，初始状态 | 尚未处理 | 系统初始化 |
| `approve` | 接受 AI 判断 | 审核人员确认通过（需附接受原因） | `pending` |
| `edit` | 修改 AI 判断 | 审核人员修正风险等级或描述 | `pending` |
| `reject` | 驳回 AI 判断 | 审核人员认为 AI 误报 | `pending` |

**状态转换约束**：所有状态均只能从 `pending` 单向转入；在 `ReviewSession.state = completed` 后，所有 `human_decision` 进入只读锁定状态，不可再修改。

---

## 三、中断点（Interrupt Point）设计

### 3.1 interrupt() 的官方行为

根据 LangGraph 官方文档：

> "Interrupts work by calling the `interrupt()` function at any point in your graph nodes. The function accepts any JSON-serializable value which is surfaced to the caller. When you're ready to continue, you resume execution by re-invoking the graph using `Command`, which then becomes the return value of the `interrupt()` call from inside the node."
>
> "Unlike static breakpoints (which pause before or after specific nodes), interrupts are **dynamic**: they can be placed anywhere in your code and can be conditional based on your application logic."
>
> — LangGraph Interrupts 文档，https://docs.langchain.com/oss/python/langgraph/interrupts

### 3.2 本系统的中断点位置

本系统在工作流的以下位置设置中断点：

```
[parse_node]
      |
      | OCR 解析完成，ExtractedField 写入
      v
[scanning_node]
      |
      | AI 风险扫描完成，ReviewItem 创建
      v
[routing_node]  <-- 核心路由决策节点
      |
      |-- 纯低风险 --> 无 interrupt --> [report_generation_node]
      |
      |-- 含中风险 --> interrupt("batch_review", pending_item_ids) --> 等待
      |
      +-- 含高风险 --> interrupt("high_risk_review", pending_item_ids) --> 等待
                                  |
                        [人工逐条处理：Approve/Edit/Reject]
                                  |
                        Command(resume=human_decisions_payload)
                                  |
                                  v
                        [resume_check_node]
                                  |
                                  v
                        [report_generation_node]
```

### 3.3 中断点触发条件规范

`routing_node` 执行路由判断时，按照以下逻辑决定是否触发 interrupt：

| 条件 | 操作 | ReviewSession.state 结果 |
|------|------|------------------------|
| 全部 ReviewItem.risk_level = low | 不触发 interrupt，直接进入报告生成 | `scanning` → `completed` |
| 存在 risk_level = medium，无 high | 触发 interrupt，subtype = batch_review | `scanning` → `hitl_pending/batch_review` |
| 存在至少一条 risk_level = high | 触发 interrupt，subtype = interrupt | `scanning` → `hitl_pending/interrupt` |

**优先级规则**：高风险优先于中风险。只要存在任意一条高风险条款，即触发 `interrupt` 子类型，不论中风险条款数量多少。

### 3.4 interrupt() 调用的 Payload 规范

`routing_node` 调用 interrupt 时，传入的 payload 应包含足够的上下文，使前端能够定位到待处理条款。payload 为 JSON-serializable 对象，包含以下字段：

| 字段 | 类型 | 含义 |
|------|------|------|
| `review_type` | string | `"high_risk_review"` 或 `"batch_review"` |
| `session_id` | string | ReviewSession 的唯一标识 |
| `pending_item_ids` | string[] | 所有 `human_decision = pending` 的 ReviewItem ID 列表 |
| `high_risk_count` | int | 高风险条款总数 |
| `medium_risk_count` | int | 中风险条款总数 |

前端通过监听 `__interrupt__` 字段（或 SSE 推送的 `route_interrupted` / `route_batch_review` 事件）感知中断状态，并据此渲染 HITL 审批界面。

### 3.5 多次 interrupt 调用的顺序约束

根据 LangGraph 官方文档的重要警告：

> "When a node contains multiple interrupt calls, LangGraph keeps a list of resume values specific to the task executing the node. Matching is strictly **index-based**, so the order of interrupt calls within the node is important."
>
> "Do not conditionally skip interrupt calls within a node. Do not loop interrupt calls using logic that isn't deterministic across executions."
>
> — LangGraph Interrupts 文档

**本系统规范**：为避免此问题，`routing_node` 中只在最后一步调用一次 interrupt（而非对每条高风险条款各调用一次 interrupt）。中断时一次性传入所有待处理条款的 ID 列表，由人工在界面上逐条完成操作后，通过单次 `Command(resume=...)` 恢复流程。

---

## 四、Checkpoint / Resume 机制在审核中的应用

### 4.1 Checkpointer 的官方行为

根据 LangGraph 官方文档：

> "When you compile a graph with a checkpointer, a snapshot of the graph state is saved at every step of execution, organized into threads."
>
> "Checkpointing keeps your place: the checkpointer writes the exact graph state so you can resume later, even when in an error state."
>
> "thread_id is your pointer: set `config={"configurable": {"thread_id": ...}}` to tell the checkpointer which state to load. Reusing it resumes the same checkpoint; using a new value starts a brand-new thread with an empty state."
>
> — LangGraph Persistence 文档 & Interrupts 文档

### 4.2 thread_id 与 ReviewSession 的绑定关系

每个合同审核会话与一个 LangGraph thread 一一对应：

```
Contract（合同文件）
    |
    | 1:1
    v
ReviewSession（审核会话）
    |-- id: UUID
    |-- langgraph_thread_id: string  <-- 与 LangGraph Checkpointer 的线程标识绑定
    |-- state: 枚举
    `-- ...
```

**创建时机**：`ReviewSession` 创建时，后端同步生成一个唯一的 `langgraph_thread_id`，在整个审核生命周期内不变。

**使用规范**：

| 操作 | 使用方式 |
|------|---------|
| 启动 LangGraph 工作流 | 以 `{"configurable": {"thread_id": session.langgraph_thread_id}}` 作为 config 调用 `graph.invoke()` 或 `graph.stream()` |
| 恢复被 interrupt 的工作流 | 以相同 thread_id 调用 `graph.invoke(Command(resume=payload), config)` |
| 查询当前工作流状态 | 通过 `graph.get_state(config)` 获取当前 checkpoint 快照 |

`langgraph_thread_id` 对前端透明，前端通过 `session_id` 操作，后端负责维护映射关系。

### 4.3 Checkpointer 存储后端选型规范

根据 LangGraph 官方文档，Checkpointer 支持多种存储后端：

| 后端类型 | 适用场景 | 本系统建议 |
|---------|---------|-----------|
| `InMemorySaver` | 开发测试，进程重启后数据丢失 | 仅用于本地开发环境 |
| `PostgresSaver` | 生产环境，持久化到 PostgreSQL | **推荐用于生产环境**（与业务数据库一致，运维成本低） |
| `RedisSaver` | 需要高吞吐量的场景 | 可作为备选，适合高并发场景 |
| 自定义 `BaseCheckpointSaver` | 特殊存储需求 | 如企业有现有存储基础设施（如私有云对象存储），可实现自定义 |

**本系统约束**：合同文件属于高敏感数据，所有存储后端必须部署在企业内网或受控私有云环境内，禁止使用云托管服务（如 LangSmith 云端 Checkpointer）处理真实合同数据。

### 4.4 Checkpoint 快照内容

每次 Checkpointer 写入时，快照包含以下内容：

| 内容 | 说明 |
|------|------|
| LangGraph 图执行状态 | 当前执行到哪个节点、各节点的输出值 |
| 自定义 StateGraph 状态字段 | 包括 `session_id`、`reviewed_items`、`pending_items`、`routing_result` 等业务字段 |
| interrupt 等待状态 | 当前 interrupt 的 payload 和期望的 resume 值类型 |
| 历史执行步骤 | 可用于 time travel debugging 和审计追溯 |

### 4.5 跨天恢复的完整路径

```
[第一天 14:00]
审核人员处理至第 4/7 条高风险条款，主动退出系统

   --> 系统行为：
       1. 最后一次 Approve 操作成功 → 后端立即触发 Checkpointer 写入
       2. ReviewSession.state 保持 hitl_pending
       3. LangGraph thread 在 interrupt 处持续等待（无超时）
       4. 前端跳转至合同列表，显示"待继续审批"标签

[第二天 09:00]
审核人员点击"继续审批"按钮

   --> 系统行为：
       1. 后端以 thread_id 调用 graph.get_state(config)，加载最新 checkpoint
       2. 返回当前状态：已处理 4 条（approve/edit/reject），待处理 3 条（pending）
       3. 前端渲染审批页面，自动定位至第 5 条（第一条 pending 的高风险条款）
       4. 显示恢复进度 banner："已恢复上次审批进度（昨天 14:03），继续从第 5 条开始"

[第二天 09:30]
审核人员完成剩余 3 条条款的处理

   --> 系统行为：
       1. 后端检测到所有 risk_level=high 的 ReviewItem.human_decision != pending
       2. 后端调用 graph.invoke(Command(resume=decisions_payload), config)
       3. LangGraph 从 interrupt 点恢复，执行 report_generation_node
       4. ReviewSession.state: hitl_pending → completed → report_ready
       5. 前端收到 SSE 事件 report_ready，展示下载入口
```

---

## 五、人工介入节点规范

### 5.1 人工介入节点的定义

人工介入节点（Human Intervention Node）是指 LangGraph StateGraph 中专门设计用于等待人工输入的节点。该节点在图中的位置是固定的，但 interrupt 的触发条件是动态的（根据路由结果决定是否暂停）。

根据 LangGraph 官方文档：

> "Human input is first-class: The `interrupt()` function pauses execution indefinitely, saves all state, and resumes exactly where it left off when you provide input. When combined with other operations in a node, it must come first."
>
> — LangGraph Thinking in LangGraph 文档

> "A human decision then determines what happens next: the action can be approved as-is (approve), modified before running (edit), or rejected with feedback (reject)."
>
> — LangGraph HITL Middleware 文档

### 5.2 本系统人工介入节点的职责边界

本系统定义一个专用的 `human_review_node`，其职责如下：

**节点职责**：

| 职责 | 说明 |
|------|------|
| 接收路由结果 | 从图状态中读取 `routing_result`，包含高风险/中风险条款列表 |
| 触发 interrupt | 构造 interrupt payload，调用 `interrupt()` 暂停执行 |
| 接收 resume payload | 通过 `Command(resume=...)` 接收人工决策数据 |
| 更新图状态 | 将人工决策（approve/edit/reject + note）写入图状态，供报告节点使用 |
| 完成性校验 | 验证所有高风险条款均已处理，否则拒绝 resume |

**节点不负责的事项**：

- 不直接操作数据库（数据持久化由后端 API 层在接收 HITL 决策请求时完成）
- 不渲染任何 UI（UI 完全由前端负责）
- 不执行业务规则校验（如 human_note 长度校验由后端 API 层执行）

### 5.3 人工决策 Payload 规范（resume 时的输入格式）

当审核人员完成所有高风险条款处理后，后端构造以下 payload 调用 `Command(resume=...)`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `decisions` | object[] | 每条 ReviewItem 的决策列表 |
| `decisions[].item_id` | string | ReviewItem 的唯一标识 |
| `decisions[].decision` | string | `"approve"` / `"edit"` / `"reject"` |
| `decisions[].note` | string | 人工填写的原因（高风险必填，≥10 字） |
| `decisions[].edited_risk_level` | string \| null | Edit 操作时修正的风险等级（可选） |
| `decisions[].edited_finding` | string \| null | Edit 操作时修正的风险描述（可选） |
| `decisions[].is_false_positive` | boolean | Reject 操作时是否标记为误报 |
| `reviewer_id` | string | 执行操作的审核人员 ID |
| `completed_at` | string | ISO 8601 格式的完成时间戳 |

### 5.4 三种人工决策的语义规范

与 LangGraph 官方文档的三选项（approve / edit / reject）对应，本系统定义如下语义：

| 决策类型 | LangGraph 官方语义 | 本系统合同审核语义 | 后续影响 |
|---------|------------------|-----------------|---------|
| **Approve** | 批准动作按原样执行 | 审核人员接受 AI 的风险判断，确认该条款存在风险 | 条款在报告中以"人工确认高风险"标注 |
| **Edit** | 修改动作后执行 | 审核人员修正 AI 判断的风险等级或描述 | 报告中展示 AI 原始判断与人工修正内容的对照 |
| **Reject** | 拒绝执行动作 | 审核人员认为 AI 判断有误（误报），该条款无风险 | 条款从风险清单移除；is_false_positive 数据用于规则库优化 |

### 5.5 防 Automation Bias 的节点级规范

人工介入节点在设计上必须配合以下机制，防止审核人员对 AI 判断的无批判性接受：

| 机制 | 在节点层面的规范 |
|------|---------------|
| 禁止批量 resume | `human_review_node` 的 resume payload 必须包含每条条款的独立决策，不接受"批量通过所有高风险"的简化指令 |
| 强制完整性检查 | 节点在接收 resume 时，验证 `decisions` 数组长度等于 `pending_item_ids` 长度，缺少任何一条则拒绝恢复 |
| 操作记录完整性 | 节点将完整 decisions payload 写入图状态，作为 Checkpointer 快照的一部分，永久保留 |

---

## 六、完整审核流程图

### 6.1 顶层流程图（文字描述）

```
                        ┌──────────────────────────────────────────────┐
                        │         LangGraph StateGraph 工作流           │
                        │         （thread_id = session.langgraph_id）  │
                        └──────────────────┬───────────────────────────┘
                                           │
                        ┌──────────────────▼──────────────────┐
                        │           parse_node                  │
                        │  职责：接收 OCR 结果，提取结构化字段     │
                        │  输出：ExtractedField 列表             │
                        │  状态：ReviewSession.state = scanning  │
                        └──────────────────┬──────────────────┘
                                           │ 解析成功
                        ┌──────────────────▼──────────────────┐
                        │          scanning_node               │
                        │  职责：调用 RAG + LLM 扫描风险条款     │
                        │  输出：ReviewItem 列表                │
                        │  （含 risk_level / confidence /       │
                        │    source / clause_location）         │
                        └──────────────────┬──────────────────┘
                                           │ 扫描完成
                        ┌──────────────────▼──────────────────┐
                        │          routing_node                 │
                        │  职责：按风险等级分级路由               │
                        └──┬──────────────┬──────────────┬────┘
                           │              │              │
                    纯低风险           含中风险         含高风险
                           │              │              │
                    ┌──────▼──────┐       │              │
                    │ 直通报告生成 │       └──────┬───────┘
                    └──────┬──────┘              │
                           │                     │ interrupt()
                           │              ┌──────▼──────────────────────┐
                           │              │      human_review_node        │
                           │              │  ★ interrupt() 触发            │
                           │              │  图执行暂停，等待 Command(resume) │
                           │              │                               │
                           │              │  Checkpointer 持久化当前状态   │
                           │              │                               │
                           │              │  ← 前端：审核人员逐条处理条款   │
                           │              │     Approve / Edit / Reject   │
                           │              │                               │
                           │              │  → 后端：调用                  │
                           │              │    Command(resume=decisions)  │
                           │              └──────┬────────────────────────┘
                           │                     │ resume 成功，图恢复执行
                           │              ┌──────▼──────────────────────┐
                           │              │      resume_check_node        │
                           │              │  职责：校验所有高风险条款已处理   │
                           │              │  失败则重新触发 interrupt       │
                           │              └──────┬────────────────────────┘
                           │                     │ 校验通过
                           └──────────┬──────────┘
                                      │
                        ┌─────────────▼────────────────────────┐
                        │       report_generation_node           │
                        │  职责：生成 PDF + JSON 审核报告         │
                        │  状态：ReviewSession.state = completed │
                        │        → report_ready                  │
                        └──────────────────────────────────────┘
```

### 6.2 interrupt / resume 局部放大图（ASCII）

```
graph.stream("scan_input", config)
           │
           │  [scanning_node] 执行完成
           │
           │  [routing_node] 检测到高风险条款
           │
           ▼
    ┌──────────────────────────────────────────────────────┐
    │   interrupt({                                         │
    │     "review_type": "high_risk_review",               │
    │     "session_id": "sess_abc123",                     │
    │     "pending_item_ids": ["item_01","item_02","item_03"]│
    │     "high_risk_count": 3,                            │
    │     "medium_risk_count": 5                           │
    │   })                                                 │
    └──────────────────────────────────────────────────────┘
           │
           │  图执行挂起，Checkpointer 写入快照
           │  ReviewSession.state = hitl_pending (interrupt)
           │
           │  [异步等待，时间不限定]
           │  前端：渲染双栏对照视图
           │  审核人员：逐条 Approve / Edit / Reject
           │  每次操作：后端 API 持久化到数据库
           │
           │  [所有高风险条款处理完成]
           │
           ▼
    graph.invoke(
      Command(resume={
        "decisions": [
          {"item_id":"item_01","decision":"approve","note":"条款风险已知晓，已与法务确认"},
          {"item_id":"item_02","decision":"edit","note":"违约金比例应为 1.5 倍而非 2 倍"},
          {"item_id":"item_03","decision":"reject","note":"该条款为标准格式，非单边约定"}
        ],
        "reviewer_id": "user_456",
        "completed_at": "2026-03-11T14:23:00Z"
      }),
      config  # 相同的 thread_id
    )
           │
           │  [human_review_node] 接收 resume，更新图状态
           │  [resume_check_node] 校验通过
           │  [report_generation_node] 执行
           │  ReviewSession.state: hitl_pending → completed → report_ready
           ▼
    图执行完成
```

### 6.3 完整状态流转图

```
                (new)
                  │
                  │ 上传文件，创建 ReviewSession + langgraph_thread_id
                  ▼
              parsing
                  │
                  │ OCR 解析成功，graph.stream() 启动
                  ▼
              scanning ◄─── 用户触发扫描
                  │
                  │ routing_node 完成路由判断
                  │
                  ├─── 纯低风险 ──────────────────────────────► completed
                  │                                                  │
                  ├─── 含中风险（无高风险）── interrupt ──► hitl_pending│
                  │                          subtype=batch_review    │
                  │                                │                 │
                  └─── 含高风险 ─────── interrupt ──┘                 │
                                       subtype=interrupt             │
                                                │                    │
                                    [人工审批：逐条处理]              │
                                                │                    │
                                    Command(resume=decisions)        │
                                                │                    │
                                                ▼                    │
                                            completed ◄──────────────┘
                                                │
                                                │ 报告异步生成完成
                                                ▼
                                          report_ready（终态）

    任意阶段 ──── 用户放弃 / 系统不可恢复故障 ──► aborted（终态）
```

### 6.4 并发与会话锁机制

| 机制 | 规范 |
|------|------|
| 同一 thread_id 同时只允许一个活跃调用 | LangGraph 通过 thread_id 串行化操作，后端额外增加会话锁防止并发提交 |
| 会话锁超时 | 活跃用户最后操作后 5 分钟自动释放 |
| 并发检测 | 若检测到同一 ReviewSession 已有另一用户打开审批页面，新用户只获得只读视图 |

---

## 七、官方文档参考链接

以下为本规范撰写过程中参考的 LangChain / LangGraph 官方文档：

| 主题 | 文档标题 | URL |
|------|---------|-----|
| HITL 总体介绍 | Human-in-the-loop (Python) | https://docs.langchain.com/oss/python/langchain/human-in-the-loop |
| HITL 总体介绍 | Human-in-the-loop (JavaScript) | https://docs.langchain.com/oss/javascript/langchain/human-in-the-loop |
| Deep Agents HITL | Human-in-the-loop (Deep Agents Python) | https://docs.langchain.com/oss/python/deepagents/human-in-the-loop |
| Interrupt 机制 | Interrupts (Python) | https://docs.langchain.com/oss/python/langgraph/interrupts |
| Interrupt 机制 | Interrupts (JavaScript) | https://docs.langchain.com/oss/javascript/langgraph/interrupts |
| Resume / Command | Graph API - resume (Python) | https://docs.langchain.com/oss/python/langgraph/graph-api |
| Checkpoint 持久化 | Persistence (Python) | https://docs.langchain.com/oss/python/langgraph/persistence |
| Checkpoint 持久化 | Persistence (JavaScript) | https://docs.langchain.com/oss/javascript/langgraph/persistence |
| 自定义 Checkpointer | How to use a custom checkpointer | https://docs.langchain.com/langsmith/custom-checkpointer |
| Functional API / HITL | Human-in-the-loop (Functional API Python) | https://docs.langchain.com/oss/python/langgraph/use-functional-api |
| HITL 中间件 | Built-in Middleware (Python) | https://docs.langchain.com/oss/python/langchain/middleware/built-in |
| LangGraph Server API | Human-in-the-loop using server API | https://docs.langchain.com/langsmith/add-human-in-the-loop |
| LangGraph 概览 | LangGraph overview (Python) | https://docs.langchain.com/oss/python/langgraph/overview |
| LangGraph 思维模型 | Thinking in LangGraph | https://docs.langchain.com/oss/python/langgraph/thinking-in-langgraph |
| LangGraph v1 更新 | What's new in LangGraph v1 | https://docs.langchain.com/oss/python/releases/langgraph-v1 |

---

## 八、与其他架构文档的衔接

| 后续阶段 | 应参考本文档的内容 |
|---------|-----------------|
| `06_architecture`（后续细化） | 第三章中断点位置、第四章 thread_id 绑定规范、第五章 resume payload 格式 |
| `07_data_model` | ReviewSession.langgraph_thread_id 字段定义；ReviewItem.human_decision 枚举映射 |
| `08_api_spec` | 第五章 5.3 节 resume payload 格式（直接映射为 HITL 决策提交接口的请求体 schema）；interrupt 触发后的 SSE 推送事件格式 |
| `10_backend_plan` | 第四章 4.3 节 Checkpointer 存储后端选型；human_review_node 的实现职责边界（第五章 5.2 节）|
| `11_integration_testing` | 第六章流程图作为端到端测试场景的基准；4.5 跨天恢复路径作为集成测试用例 |

---

*本文档由 Teammate 2 基于 LangChain/LangGraph 官方文档查询结果（查询日期：2026-03-11）与项目已有文档（01、03、04、06 阶段）整合产出，不包含实际可运行代码，仅定义工作流行为规范与节点职责边界。*
