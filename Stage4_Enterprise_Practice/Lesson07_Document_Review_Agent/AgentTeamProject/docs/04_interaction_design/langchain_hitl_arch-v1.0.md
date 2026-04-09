# 合同审核系统 HITL 架构总览 v1.0

**文档编号**：04_interaction_design/langchain_hitl_arch-v1.0
**版本**：v1.0
**编写日期**：2026-03-11
**编写角色**：Lead（汇总）
**输入文档**：
- `06_architecture/backend_service_arch-v1.0.md`（Teammate 1 产出）
- `06_architecture/langchain_hitl_workflow-v1.0.md`（Teammate 2 产出）

---

## 一、本文档的定位

本文档是本阶段 Agent Team 工作的跨视角架构汇总，整合以下两个视角：

| 视角 | 来源文档 | 核心内容 |
|------|---------|---------|
| **后端服务架构**（Teammate 1） | `06_architecture/backend_service_arch-v1.0.md` | 文件上传、任务状态管理、审核结构查询三大模块的职责与状态机 |
| **LangChain HITL 工作流**（Teammate 2） | `06_architecture/langchain_hitl_workflow-v1.0.md` | 基于 LangGraph 官方规范的中断点、Checkpoint、人工介入节点设计 |

本文档不重复两篇子文档的详细内容，而是聚焦于：**两个视角如何协同，形成完整的合同审核闭环**。

---

## 二、核心架构对齐：双视角统一状态表

以下表格是全系统状态的权威对齐表，将数据库层（ReviewSession.state）、LangGraph 工作流层和交互层三者统一：

| ReviewSession.state | hitl_subtype | LangGraph 工作流状态 | 前端交互层状态 | 后端服务模块 |
|---------------------|-------------|---------------------|--------------|------------|
| `parsing` | — | OCR 任务队列中，LangGraph 尚未启动 | 解析进度页（等待动画） | 文件上传模块 |
| `scanning` | — | `scanning_node` 执行中 | 扫描进度页（实时计数更新） | 任务状态管理模块 |
| `hitl_pending` | `interrupt` | 图在 `human_review_node` 处 interrupt 挂起 | HITL 双栏对照视图（逐条审批） | 任务状态管理模块 |
| `hitl_pending` | `batch_review` | 图在 `human_review_node` 处 interrupt 挂起 | 中风险批量复核视图 | 任务状态管理模块 |
| `completed` | — | `Command(resume=...)` 已调用，图执行中 | 报告生成等待页 | 任务状态管理模块 |
| `report_ready` | — | 图执行完成（终态） | 报告下载页 | 审核结构查询模块 |
| `aborted` | — | 图 thread 不再 resume（终态） | 流程终止提示页 | 文件上传/任务状态管理模块 |

---

## 三、关键接口：后端服务层与 LangGraph 的协作边界

两个视角在以下四个关键接口处交汇，这些接口是系统正确性的核心保障：

### 3.1 interrupt 触发接口（任务状态管理 → LangGraph）

```
触发时机：routing_node 检测到中风险或高风险条款
后端执行序列：
  1. LangGraph 内部：调用 interrupt(payload)，工作流暂停
  2. 同数据库事务中：
     ReviewSession.state  = 'hitl_pending'
     ReviewSession.hitl_subtype = 'interrupt' | 'batch_review'
  3. PostgresSaver Checkpointer 写入工作流快照
  4. SSE/WebSocket 推送 route_interrupted 或 route_batch_review 事件

一致性保障：LangGraph Checkpointer 写入失败时，数据库事务回滚
```

### 3.2 HITL 决策持久化接口（前端 → 后端 API → 数据库）

```
接口：POST /sessions/{session_id}/items/{item_id}/decision
执行序列：
  1. 后端校验序列（5 项，见 backend_service_arch-v1.0.md 第 3.5 节）
  2. 写入 ReviewItem.human_decision / human_note / decided_by / decided_at
  3. 写入 AuditLog（INSERT ONLY）
  4. 检查 resume 触发条件（所有 high risk 条款均已决策）
  5. 推送 item_decision_saved 事件

注意：此接口不直接操作 LangGraph，仅更新数据库
     LangGraph resume 由下方 3.3 接口独立触发
```

### 3.3 resume 触发接口（后端服务层 → LangGraph）

```
触发时机：所有 risk_level=high 的 ReviewItem.human_decision != 'pending'
后端执行序列：
  1. 构造 Command(resume=decisions_payload)（格式见 langchain_hitl_workflow-v1.0.md 第 5.3 节）
  2. 调用 graph.invoke(Command(resume=...), {"configurable": {"thread_id": session.langgraph_thread_id}})
  3. 同步更新 ReviewSession.state = 'completed'
  4. 推送 report_generation_started 事件
  5. 图执行恢复，进入 resume_check_node → report_generation_node
```

### 3.4 跨天恢复接口（审核人员重新进入系统）

```
触发时机：用户点击"继续审批"，session.state = hitl_pending
后端执行序列：
  1. 查询 ReviewSession，获取 langgraph_thread_id
  2. 调用 graph.get_state({"configurable": {"thread_id": thread_id}})
  3. 从 Checkpointer 恢复工作流上下文（已处理条款数 / 待处理条款列表）
  4. 以数据库中的 ReviewItem 状态为权威来源，修复 Checkpointer 中不一致的状态（如有）
  5. 前端渲染恢复进度 banner，定位至第一条 human_decision = pending 的高风险条款
```

---

## 四、单一中断点原则

根据 LangGraph 官方文档的顺序约束警告（Teammate 2 第 3.5 节），本系统确立以下强制规范：

> **全工作流只在 `routing_node` 末尾设置一个 interrupt 调用点。**
> 中断时一次性传入所有待处理条款 ID，通过单次 `Command(resume=...)` 恢复执行。

此原则避免多次 interrupt 的 index-based 顺序匹配陷阱，同时简化了后端 resume 逻辑。与之配套的是 `resume_check_node`（Teammate 2 第 6.1 节设计），负责在 resume 后二次校验所有高风险条款已处理，否则可重新触发 interrupt。

---

## 五、数据一致性关键约束汇总

以下约束从两份子文档中提取，是系统实现时的强制红线：

| 约束 | 来源 | 保障机制 |
|------|------|---------|
| `ReviewSession.state` 与 LangGraph Checkpointer 状态同步 | Teammate 1 第 5.3 节 | 同数据库事务中执行；Checkpointer 失败则回滚 |
| `state = completed` 时，所有高风险 `human_decision != pending` | Teammate 1 第 5.3 节 | resume() 触发前后端强制校验 + resume_check_node 二次校验 |
| `state = completed` 后，ReviewItem 进入只读锁定 | Teammate 1 第 5.3 节 | 后端 API 层拒绝一切修改请求 |
| AuditLog INSERT ONLY，不可修改删除 | Teammate 1 第 3.7 节 | 数据库约束层保障 |
| 同一 session 同时只有一个活跃审核人员 | Teammate 1 第 3.4 节 & Teammate 2 第 6.4 节 | Redis session_lock，TTL 5 分钟 |
| 高风险条款严禁批量操作 | Teammate 1 第 3.5 节 & Teammate 2 第 5.5 节 | API 层校验 + human_review_node 完整性校验 |
| Checkpointer 生产环境使用 PostgresSaver | Teammate 2 第 4.3 节 | 与业务数据库同库，禁止使用云托管存储真实合同数据 |

---

## 六、各阶段文档衔接索引

本架构汇总确认以下后续阶段应直接引用的文档条款：

| 后续阶段 | 应引用的关键条款 |
|---------|---------------|
| `07_data_model` | T1 第 4.2 节（核心实体伪代码结构）；T2 第 2 节（状态枚举）；T2 第 4.2 节（thread_id 绑定） |
| `08_api_spec` | T1 第 3.5 节（HITL 决策接口校验序列）；T2 第 5.3 节（resume payload 格式）；T1 第 3.6 节（SSE 事件类型） |
| `10_backend_plan` | T1 第 3.3 节（LangGraph 节点清单）；T2 第 4.3 节（Checkpointer 选型）；T2 第 5.2 节（human_review_node 职责边界） |
| `11_integration_testing` | T2 第 6 章（完整流程图作为端到端测试基准）；T2 第 4.5 节（跨天恢复场景作为集成测试用例） |

---

## 七、本阶段交付物清单

| 文件 | 编写者 | 状态 |
|------|--------|------|
| `docs/06_architecture/backend_service_arch-v1.0.md` | Teammate 1 | 已完成 |
| `docs/06_architecture/langchain_hitl_workflow-v1.0.md` | Teammate 2 | 已完成 |
| `docs/04_interaction_design/langchain_hitl_arch-v1.0.md` | Lead（汇总） | 已完成 |

---

*本文档为 Lead 基于 Teammate 1（后端服务架构）与 Teammate 2（LangChain HITL 工作流）的产出整合而成，聚焦双视角协作边界与数据一致性约束，不重复子文档内容。详细规范请直接查阅对应子文档。*
