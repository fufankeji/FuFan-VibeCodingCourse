# 后端服务架构规范 v1.0

**文档编号**：06_architecture/backend_service_arch-v1.0
**版本**：v1.0
**编写日期**：2026-03-11
**编写角色**：Teammate 1（后端服务架构视角）
**输入文档**：
- `01_business_research/business_summary.md`
- `01_business_research/contract_review_agent_research.md`
- `03_problem_modeling/problem_model.md`
- `04_interaction_design/flow_state_spec-v1.0.md`
- `04_interaction_design/t1_upload_and_parse.md`
- `04_interaction_design/t2_review_states.md`
- `04_interaction_design/t3_hitl_approval.md`
- `06_architecture/frontend_backend_boundary_spec-v1.0.md`

---

## 目录

1. [概述（模块职责边界）](#一概述模块职责边界)
2. [文件上传模块架构](#二文件上传模块架构)
3. [任务状态管理架构（含状态机图）](#三任务状态管理架构)
4. [审核结构查询架构](#四审核结构查询架构)
5. [模块间依赖关系说明](#五模块间依赖关系说明)

---

## 一、概述（模块职责边界）

### 1.1 后端核心职责定位

合同审核系统后端是所有业务逻辑、数据持久化、状态管理与外部服务集成的权威执行层。根据 `06_architecture/frontend_backend_boundary_spec-v1.0.md` 的职责划分，后端对前端只暴露 HTTP API，所有内部执行对前端不透明。

本文档聚焦后端三个核心模块的架构规范：

| 模块 | 核心职责 | 触发者 |
|------|----------|--------|
| **文件上传模块** | 接收合同文件、执行服务端校验、持久化存储、触发 OCR 解析流程、创建审核会话 | 前端 POST 请求 |
| **任务状态管理** | 管理 `ReviewSession.state` 完整生命周期、驱动 LangGraph 状态机、协调各阶段状态流转 | 系统内部事件 + 前端请求 |
| **审核结构查询** | 对外提供 `ReviewItem`、`ExtractedField`、`ReviewReport` 等审核结果数据的查询接口 | 前端 GET 请求 |

### 1.2 三个模块的关系总览

```
前端上传请求
      │
      ▼
┌───────────────────────────────────────┐
│         文件上传模块                   │
│  校验 → 存储 → 创建实体 → 触发 OCR   │
└──────────────────┬────────────────────┘
                   │ OCR 完成回调
                   ▼
┌───────────────────────────────────────┐
│         任务状态管理模块               │
│  状态机驱动 → LangGraph 工作流编排    │
│  interrupt/resume → 实时事件推送      │
└──────────────────┬────────────────────┘
                   │ 持久化审核结果
                   ▼
┌───────────────────────────────────────┐
│         审核结构查询模块               │
│  提供 ReviewItem / ExtractedField /   │
│  ReviewReport 的查询接口              │
└───────────────────────────────────────┘
```

### 1.3 对外 API 边界约定

- 所有接口均需携带认证凭证，后端独立校验
- 所有前端传入的角色信息不信任，后端基于数据库用户记录校验权限
- 错误响应遵循统一格式：`{ "error_code": "...", "message": "...", "request_id": "..." }`
- HITL 决策提交接口必须实现幂等性，防止重复提交

---

## 二、文件上传模块架构

### 2.1 模块职责说明

文件上传模块负责从接收原始文件到产出可审核的结构化合同实体的完整流程。该模块是整个审核链路的入口，其输出（Contract 记录 + ReviewSession 记录 + ExtractedField 记录）是后续所有模块的数据基础。

**模块边界**：
- 入口：前端 `POST /contracts/upload` 请求（含文件二进制 + 元信息）
- 出口：`ReviewSession.state` 由 `parsing` 流转至 `scanning`，`ExtractedField` 记录写入完成

**明确不包含**：
- AI 风险扫描（由任务状态管理模块的 LangGraph 扫描节点负责）
- OCR 算法自研（接入外部服务，本模块只负责调度）

### 2.2 上传接收与服务端校验流程

```
接收前端 multipart/form-data 请求
        │
        │ 提取文件流 + 元信息（合同名称、上传人 ID）
        ▼
┌───────────────────────────────────┐
│         服务端校验层               │
│                                   │
│  1. 解析文件头（Magic Bytes）      │
│     PDF: %PDF-                    │
│     DOCX: PK (ZIP 格式)           │
│     不符合 → 返回 400，原因：格式伪造│
│                                   │
│  2. 文件大小二次确认（≤ 50MB）     │
│     超出 → 返回 413               │
│                                   │
│  3. 文件结构完整性检测             │
│     PDF: 尝试解析 xref 表          │
│     DOCX: 尝试解压 ZIP 包          │
│     损坏 → 返回 422，原因：文件损坏 │
│                                   │
│  4. 文件加密检测                   │
│     PDF 加密标记检测               │
│     加密 → 返回 422，原因：文件加密 │
│                                   │
│  5. 内容可读性预检（不阻断，产生标记）│
│     检测是否有文本层               │
│     扫描件 → 设置 is_scanned = true│
│     空文档 → 返回 422，原因：空文档  │
└───────────────┬───────────────────┘
                │ 校验通过
                ▼
```

### 2.3 文件存储策略

```
校验通过后的文件持久化
        │
        ▼
┌────────────────────────────────────┐
│         文件存储层                  │
│                                    │
│  存储介质：对象存储（如 MinIO /     │
│           阿里云 OSS）             │
│                                    │
│  路径规则：                         │
│    /contracts/{year}/{month}/      │
│    {contract_id}/{filename}        │
│                                    │
│  访问控制：                         │
│    - 文件不可公开访问               │
│    - 通过后端接口生成临时签名 URL   │
│    - OCR 服务调用时使用临时凭证     │
│                                    │
│  数据安全要求（来自设计红线）：      │
│    - 合同文件不得明文传至不受控外部 API│
│    - OCR 调用须符合数据主权合规     │
│    - 临时签名 URL 有效期 ≤ 30 分钟  │
└──────────────────┬─────────────────┘
                   │ 存储完成，得到 file_path
                   ▼
```

### 2.4 合同实体与会话创建

```
文件存储完成后，在数据库中创建关联实体
        │
        ▼
┌────────────────────────────────────────┐
│         实体创建流程（事务保障）         │
│                                        │
│  步骤 1：创建 Contract 记录             │
│    - id: 生成 UUID                     │
│    - title: 从文件名提取或用户填写      │
│    - file_path: 对象存储路径            │
│    - file_type: pdf / docx             │
│    - is_scanned_document: 预检结果      │
│    - uploaded_by: 请求携带的用户 ID     │
│    - uploaded_at: 服务端 UTC 时间戳     │
│                                        │
│  步骤 2：创建 ReviewSession 记录        │
│    - id: 生成 UUID                     │
│    - contract_id: 上一步生成的 ID       │
│    - state: parsing（初始值）           │
│    - langgraph_thread_id: 生成唯一标识  │
│    - created_at: 服务端 UTC 时间戳      │
│                                        │
│  步骤 3：写入操作日志                   │
│    事件：contract_uploaded             │
│    事件：contract_created              │
│    事件：session_created               │
│                                        │
│  以上三步在数据库事务中执行             │
│  任一步骤失败则全部回滚                │
└──────────────────┬─────────────────────┘
                   │ 实体创建成功
                   ▼
```

### 2.5 OCR 解析任务调度

```
实体创建完成后，触发异步 OCR 解析任务
        │
        ▼
┌──────────────────────────────────────────┐
│         OCR 任务调度层                    │
│                                          │
│  调度方式：将任务推入异步任务队列         │
│  （如 Celery + Redis / RQ）              │
│                                          │
│  任务参数：                               │
│    - session_id: ReviewSession 的 ID     │
│    - file_path: 对象存储路径             │
│    - is_scanned: 扫描件标记              │
│                                          │
│  任务执行流程：                           │
│    1. 生成临时签名 URL（有效期 30 分钟）  │
│    2. 调用外部 OCR 服务（达观 TextIn 等）│
│    3. 轮询或回调接收解析结果              │
│    4. 超时判定：单次等待上限 15 分钟     │
│    5. 最大重试次数：3 次                 │
│                                          │
│  写入操作日志：parse_started             │
└──────────────────┬───────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
   解析成功                解析失败/超时
        │                     │
        ▼                     ▼
  [OCR 结果处理]          [错误状态处理]
```

### 2.6 OCR 结果处理与状态流转

```
OCR 解析成功后的处理流程
        │
        ▼
┌──────────────────────────────────────────┐
│         OCR 结果写入层                    │
│                                          │
│  处理步骤：                               │
│                                          │
│  1. 将 OCR 输出文本写入文档文本存储       │
│     关联至 ReviewSession                 │
│                                          │
│  2. 调用结构化字段提取                    │
│     （LangChain Structured Output）      │
│     提取：合同主体、金额、日期、           │
│            适用法律、争议解决方式等        │
│                                          │
│  3. 为每个 ExtractedField 生成置信度      │
│     置信度来源：                          │
│       - OCR 服务返回的字符置信度           │
│       - is_scanned 标记综合调整           │
│     阈值规则：                            │
│       - confidence_score < 60           │
│         → needs_human_verification = true│
│                                          │
│  4. 批量写入 ExtractedField 记录          │
│                                          │
│  5. 更新 ReviewSession.state             │
│     parsing → scanning                  │
│                                          │
│  6. 写入操作日志：parse_completed         │
│                                          │
│  7. 通过 WebSocket/SSE 推送状态变更事件  │
│     event: state_changed: scanning      │
└──────────────────────────────────────────┘
```

**解析失败处理规范**：

| 失败类型 | 处理方式 | state 变化 |
|----------|----------|-----------|
| OCR 服务返回错误（非超时） | 写入 `parse_failed` 日志，保持 `parsing` 状态，允许前端重试（最多 3 次） | 保持 `parsing` |
| 解析超时（超过 15 分钟） | 写入 `parse_timeout` 日志，通知前端（SSE/推送），允许重试 | 保持 `parsing` |
| 超出最大重试次数 | 写入 `session_aborted` 日志，state → `aborted` | `parsing → aborted` |
| 用户主动放弃 | 向 OCR 服务发送取消请求，写入 `session_aborted` 日志，state → `aborted` | `parsing → aborted` |

### 2.7 文件上传模块关键数据结构

```
上传请求数据结构（伪代码）：
  UploadRequest:
    file: binary          # multipart/form-data 文件流
    contract_title: str   # 可选，用户输入；为空则从文件名提取
    uploader_user_id: str # 从 JWT 或 session 解析，不信任请求体传值

上传响应数据结构（伪代码）：
  UploadResponse:
    contract_id: UUID
    session_id: UUID
    state: "parsing"
    is_scanned_document: bool
    message: str          # 如 "文件上传成功，正在解析中"

ExtractedField 记录结构（伪代码）：
  ExtractedField:
    id: UUID
    session_id: UUID
    field_name: enum      # party_a | party_b | amount | effective_date | ...
    field_value: str
    confidence_score: int # 0-100
    needs_human_verification: bool
    ocr_source_page: int  # OCR 提取来源页码
    ocr_source_offset: int # 页内段落偏移
```

---

## 三、任务状态管理架构

### 3.1 模块职责说明

任务状态管理模块是整个系统的神经中枢，负责：

- 维护 `ReviewSession.state` 的完整生命周期
- 驱动 LangGraph StateGraph 工作流的执行
- 在恰当时机触发 `interrupt()`（等待人工介入）和 `resume()`（恢复工作流）
- 向前端推送实时状态变更事件（通过 WebSocket/SSE）
- 记录全部操作审计日志

**模块边界**：
- 本模块管理状态，不直接接触合同文件二进制内容
- LangGraph 作为工作流引擎嵌入本模块内部，不直接暴露给前端

### 3.2 ReviewSession 完整状态机

#### 3.2.1 状态枚举定义

| 状态值 | 含义 | 是否终态 |
|--------|------|----------|
| `parsing` | OCR 解析任务提交，等待解析完成 | 否 |
| `scanning` | AI 风险扫描进行中（LangGraph 工作流执行中） | 否 |
| `hitl_pending` | 等待人工介入（工作流已 interrupt） | 否 |
| `completed` | 所有高风险条款已由人工处理，工作流已 resume | 否（子状态待跳转） |
| `report_ready` | 审核报告异步生成完成 | 是（正常终态） |
| `aborted` | 流程中止（用户放弃或系统不可恢复故障） | 是（异常终态） |

`hitl_pending` 通过 `subtype` 字段区分内部模式，不扩展为独立顶层状态：

| subtype 值 | 触发条件 | 允许的操作 |
|------------|----------|-----------|
| `interrupt` | 存在至少一条 `risk_level = high` 的 ReviewItem | 仅允许逐条处理；后端拒绝批量高风险决策请求 |
| `batch_review` | 存在中风险条款，无高风险条款 | 允许批量中风险条款确认 |

#### 3.2.2 完整状态流转图（文字描述型状态机）

```
状态：(新建)
  触发：文件上传完成 + 实体创建成功
  → 进入 parsing

状态：parsing
  触发 A：OCR 解析成功，ExtractedField 写入完成
  → 进入 scanning
  触发 B：解析失败 / 超时（重试次数耗尽）
  → 进入 aborted
  触发 C：用户主动放弃
  → 进入 aborted

状态：scanning
  内部：LangGraph `risk_scanning` 节点执行中
  触发 A：扫描完成 + routing 节点判定为纯低风险
  → 进入 completed（直接跳过 hitl_pending）
  触发 B：扫描完成 + routing 节点判定为中风险（无高风险）
  → 进入 hitl_pending（subtype: batch_review）
  触发 C：扫描完成 + routing 节点判定有高风险
  → LangGraph 调用 interrupt()
  → 进入 hitl_pending（subtype: interrupt）
  触发 D：LLM 调用失败 / 系统异常（不可恢复）
  → 进入 aborted

状态：hitl_pending（subtype: interrupt）
  内部：LangGraph 工作流在 interrupt 节点挂起等待
  触发 A：所有 risk_level=high 的 ReviewItem.human_decision ≠ pending
  → 调用 LangGraph resume()
  → 进入 completed
  触发 B：用户主动放弃
  → 进入 aborted

状态：hitl_pending（subtype: batch_review）
  触发 A：所有中风险条款处理完成
  → 进入 completed
  触发 B：用户主动放弃
  → 进入 aborted

状态：completed
  内部：报告异步生成任务启动
  触发 A：报告生成任务完成
  → 进入 report_ready

状态：report_ready（终态）
  不可离开。

状态：aborted（终态）
  不可离开。用户可基于同一 Contract 新建 ReviewSession。
```

#### 3.2.3 状态流转图（ASCII 示意）

```
              (新建)
                │
                │ 上传成功 + 实体创建
                ▼
            parsing ◄─────────── OCR 重试（≤3次）
                │                    ▲
                │ OCR 成功            │
                ▼              parse_failed /
            scanning           parse_timeout
                │
         ┌──────┼──────┐
         │      │      │
         │      │    系统故障
         │      │      │
       低风险  中风险    ▼
         │      │    aborted（终态）
         │      ▼      ▲
         │  hitl_pending│
         │  (batch_review)│
         │      │      │ 用户放弃（任意阶段）
         │      │      │
       高风险    │      │
         │      │      │
         ▼      │      │
     hitl_pending       │
    (interrupt) │       │
         │      │       │
         │ 全部高风险处理完
         ▼      │
      completed ◄┘
         │
         │ 报告生成完成
         ▼
    report_ready（终态）
```

### 3.3 LangGraph 工作流节点定义

LangGraph StateGraph 是任务状态管理模块内部的工作流引擎。以下定义各节点的职责和路由逻辑。

#### 3.3.1 节点清单

| 节点名称 | 对应 ReviewSession.state | 节点职责 |
|----------|--------------------------|----------|
| `file_ingestion` | `parsing` | OCR 任务调度（由上传模块触发，该节点等待回调） |
| `field_extraction` | `parsing`（扩展阶段） | 结构化字段提取，写入 ExtractedField |
| `risk_scanning` | `scanning` | 调用 LLM + 规则引擎，逐段落扫描风险，实时写入 ReviewItem |
| `routing` | `scanning`（路由判断中） | 根据 ReviewItem 风险等级分布决定路由目标 |
| `hitl_review` | `hitl_pending` | 工作流在此节点 interrupt 挂起，等待人工操作触发 resume |
| `report_generation` | `completed` | 异步生成 PDF + JSON 报告，更新 state → `report_ready` |

#### 3.3.2 路由节点（routing）逻辑描述

```
routing 节点执行逻辑（伪代码描述）：

输入：当前 ReviewSession 下所有 ReviewItem 列表
输出：路由目标（route_target）

high_risk_count = COUNT(ReviewItem WHERE risk_level = 'high')
medium_risk_count = COUNT(ReviewItem WHERE risk_level = 'medium')

IF high_risk_count > 0 THEN
  route_target = 'hitl_interrupt'
  调用 interrupt()
  更新 ReviewSession.state = 'hitl_pending'
  更新 ReviewSession.hitl_subtype = 'interrupt'
  记录事件：route_interrupted

ELSE IF medium_risk_count > 0 THEN
  route_target = 'hitl_batch_review'
  更新 ReviewSession.state = 'hitl_pending'
  更新 ReviewSession.hitl_subtype = 'batch_review'
  记录事件：route_batch_review

ELSE
  route_target = 'auto_pass'
  更新 ReviewSession.state = 'completed'
  记录事件：route_auto_passed
  异步启动 report_generation 任务

推送 SSE/WebSocket 事件至前端
```

#### 3.3.3 风险扫描节点（risk_scanning）执行规范

```
risk_scanning 节点执行规范（伪代码描述）：

输入：合同全文文本（分段落），ReviewSession 的 langgraph_thread_id
执行：对每个合同段落执行双层检测

  第一层（规则引擎匹配）：
    - 将段落文本向量化
    - 检索风险规则向量库（Top-K，K=5）
    - 若相似度 > 阈值，标记为命中规则，记录 rule_id
    - source = 'rule_engine'

  第二层（LLM 推理）：
    - 将段落文本 + 检索到的规则描述 + 审核提示词送入 LLM
    - 解析 LLM 返回的结构化输出（Structured Output）：
        risk_level: low | medium | high
        confidence_score: 0-100
        ai_finding: 风险描述（非绝对化表述）
        suggested_modification: 修改建议
    - 若 LLM 判断风险，source = 'ai_inference'（或规则 + AI 联合）

  结果写入：
    FOR EACH 段落 WHERE 风险等级 ≠ low OR 规则命中:
      创建 ReviewItem 记录：
        session_id, clause_text, clause_location（页码 + 段落偏移）,
        risk_level, confidence_score, source, ai_finding,
        human_decision = 'pending'
      持久化（通过 LangGraph Checkpointer 保障一致性）
      实时推送：已发现 N 处潜在风险（计数更新）

所有段落扫描完成 → 转入 routing 节点
```

**风险扫描的 LLM 输出约束**：
- `ai_finding` 字段必须使用模态表述（"可能存在…风险"），后端生成报告时校验此约束
- 后端不允许将绝对化结论写入 `ai_finding`（如"该条款违法"）
- 若 LLM 返回绝对化表述，后端需进行后处理（添加"可能"等修饰词）或要求 LLM 重新生成

### 3.4 LangGraph interrupt/resume 机制规范

#### 3.4.1 interrupt 触发规范

```
interrupt 触发时序（伪代码描述）：

1. routing 节点检测到 high_risk_count > 0
2. 将以下信息写入 LangGraph State：
     - interrupt_reason: 'high_risk_clauses_detected'
     - pending_items_count: high_risk_count
     - checkpoint_timestamp: UTC 时间戳
3. 调用 LangGraph interrupt()
   工作流在 hitl_review 节点挂起，等待外部 resume 信号
4. 后端同步更新数据库：
     ReviewSession.state = 'hitl_pending'
     ReviewSession.hitl_subtype = 'interrupt'
5. 推送 SSE/WebSocket 事件：
     event_type: route_interrupted
     payload: { session_id, high_risk_count, pending_item_ids }
```

#### 3.4.2 resume 触发规范

```
resume 触发时序（伪代码描述）：

触发条件检测（在每次 HITL 决策提交成功后执行）：
  all_high_risk_decided = ALL(
    ReviewItem WHERE session_id = current_session AND risk_level = 'high'
    HAVE human_decision IN ('approve', 'edit', 'reject')
  )

IF all_high_risk_decided THEN
  1. 调用 LangGraph resume()，传入最终人工决策摘要
  2. 后端更新数据库：
       ReviewSession.state = 'completed'
  3. 记录事件：report_generation_started
  4. 异步启动报告生成任务
  5. 推送 SSE/WebSocket 事件：
       event_type: report_generation_started
       payload: { session_id }
```

#### 3.4.3 跨天异步恢复规范

| 机制 | 规范 |
|------|------|
| 持久化载体 | LangGraph Checkpointer（生产环境使用 PostgresSaver） |
| 绑定方式 | `ReviewSession.langgraph_thread_id` 与 LangGraph thread_id 一对一绑定 |
| 检查点时机 | 每个节点执行完成后自动写入；每次 HITL 决策提交后写入 |
| 恢复方式 | 通过 `thread_id` 调用 LangGraph 的 `get_state()`，恢复至最后一个有效 checkpoint |
| 并发保护 | 同一 session 同一时间只允许一个活跃用户；基于数据库行级锁实现；锁超时 5 分钟自动释放 |
| 恢复后验证 | 恢复后后端验证 Checkpointer 中的状态与数据库中的 ReviewItem 状态是否一致；如不一致以数据库为准并修复 Checkpointer |

### 3.5 HITL 决策提交的后端校验规范

所有 HITL 决策（Approve / Edit / Reject）在写入数据库前，后端执行以下校验序列：

```
HITL 决策写入校验序列（伪代码描述）：

接收请求：POST /sessions/{session_id}/items/{item_id}/decision
请求体：{ decision: 'approve'|'edit'|'reject', human_note: str, ... }

校验 1：会话状态合法性
  IF ReviewSession.state NOT IN ('hitl_pending') THEN
    返回 409 Conflict，"当前会话状态不允许提交决策"

校验 2：禁止批量提交（高风险）
  IF 请求体包含多条 ReviewItem 的决策 AND 任一 item.risk_level = 'high' THEN
    返回 400 Bad Request，"高风险条款必须逐条提交，不允许批量操作"

校验 3：human_note 长度（高风险条款）
  IF item.risk_level = 'high' AND len(human_note) < 10 THEN
    返回 422，"高风险条款必须填写不少于 10 字的处理原因"

校验 4：操作人权限
  IF current_user.role NOT IN ('reviewer') THEN
    返回 403 Forbidden

校验 5：幂等性检查
  IF item.human_decision != 'pending' AND 请求为重复提交 THEN
    返回已有记录（幂等响应），不重复写入

全部校验通过 → 写入数据库 → 检查 resume 条件
```

### 3.6 实时事件推送规范

后端通过 WebSocket 或 SSE 向前端推送状态变更事件。

#### 3.6.1 事件类型与推送时机

| 事件 event_type | 推送时机 | 前端响应 |
|-----------------|----------|---------|
| `state_changed: scanning` | `parsing → scanning` 流转完成 | 解析进度页自动跳转至字段核对页 |
| `scan_progress` | 风险扫描进行中，每发现 1 条 ReviewItem | 扫描进度页更新已发现风险计数 |
| `route_auto_passed` | 低风险路由完成 | 扫描页跳转至报告生成等待页 |
| `route_batch_review` | 中风险路由完成 | 跳转至中风险批量复核视图 |
| `route_interrupted` | 高风险路由，interrupt 触发 | 跳转至 HITL 双栏审批视图 |
| `item_decision_saved` | 单条 HITL 决策持久化成功 | 审批页更新该条款状态 + 进度计数 |
| `report_generation_started` | resume 调用成功，报告生成任务启动 | 审批页跳转至报告生成等待页 |
| `report_ready` | 报告生成完成 | 等待页跳转至报告下载页 |
| `parse_failed` | OCR 解析失败 | 解析进度页展示失败状态 + 重试入口 |
| `parse_timeout` | OCR 解析超时 | 同上 |
| `system_failure` | 不可恢复系统故障 | 当前页展示系统错误状态 |

#### 3.6.2 连接管理规范

- 前端在进入审核相关页面时建立连接，通过 `session_id` 订阅该会话的事件
- 后端维护 `session_id → connection` 映射
- 断线重连：前端自动重连，重连后后端推送当前最新 state 作为补偿
- 连接空闲超过 30 分钟自动断开（与会话超时一致）

### 3.7 操作审计日志规范

所有操作日志由后端写入，前端不参与日志生成。

**日志记录结构（伪代码）**：

```
AuditLog:
  id: UUID
  session_id: UUID
  event_type: enum（见下方完整枚举）
  actor_id: UUID        # 操作人用户 ID；系统触发的事件记为 system
  actor_type: 'user' | 'system'
  occurred_at: datetime # 服务端 UTC 时间戳
  metadata: JSON        # 事件特定的附加信息（详见下方枚举）
```

**完整事件类型枚举**（共 27 类）：

| 分组 | 事件类型 | metadata 关键字段 |
|------|----------|-------------------|
| 上传阶段 | `contract_uploaded` | file_name, file_size, file_type, is_scanned_document |
| 上传阶段 | `contract_created` | contract_id, uploaded_by |
| 上传阶段 | `session_created` | session_id, langgraph_thread_id |
| 上传阶段 | `parse_started` | ocr_service_provider, submitted_at |
| 上传阶段 | `parse_completed` | ocr_service_version, duration_seconds |
| 上传阶段 | `parse_failed` | error_code, error_message, retry_count |
| 上传阶段 | `parse_timeout` | elapsed_seconds, retry_count |
| 上传阶段 | `session_aborted` | aborted_by, abort_reason |
| 扫描阶段 | `field_verified` | field_id, verified_by |
| 扫描阶段 | `field_modified` | field_id, old_value, new_value |
| 扫描阶段 | `field_verify_skipped` | field_ids_skipped |
| 扫描阶段 | `scan_triggered` | triggered_by |
| 扫描阶段 | `scan_completed` | total_items, high_count, medium_count, low_count |
| 扫描阶段 | `route_auto_passed` | — |
| 扫描阶段 | `route_batch_review` | medium_count |
| 扫描阶段 | `route_interrupted` | high_count |
| 扫描阶段 | `system_failure` | error_code, node_name, stack_trace_ref |
| 扫描阶段 | `business_failure` | failure_reason |
| 扫描阶段 | `retry_triggered` | retry_count, node_name |
| HITL 阶段 | `item_approved` | item_id, human_note_length |
| HITL 阶段 | `item_edited` | item_id, old_risk_level, new_risk_level |
| HITL 阶段 | `item_rejected` | item_id, is_false_positive |
| HITL 阶段 | `decision_revoked` | item_id |
| HITL 阶段 | `session_resumed` | resumed_by |
| HITL 阶段 | `report_generation_started` | — |
| HITL 阶段 | `report_ready` | pdf_path, json_path |
| HITL 阶段 | `report_downloaded` | format (pdf\|json), downloaded_by |

---

## 四、审核结构查询架构

### 4.1 模块职责说明

审核结构查询模块对外提供审核过程中产生的所有结构化数据的查询接口。该模块为只读接口层，不修改任何业务状态（HITL 决策写入由任务状态管理模块处理）。

**模块边界**：
- 提供 `ReviewSession`、`ReviewItem`、`ExtractedField`、`ReviewReport` 的查询
- 提供报告文件（PDF/JSON）的下载接口
- 提供 `AuditLog` 的查询接口（报告内展示）
- 不负责数据的创建或修改

### 4.2 核心审核数据结构定义

以下数据结构定义了查询接口的返回值形态（伪代码描述，非实际代码）。

#### 4.2.1 ReviewSession 查询结构

```
ReviewSession（查询返回）：
  id: UUID
  contract_id: UUID
  state: enum（parsing | scanning | hitl_pending | completed | report_ready | aborted）
  hitl_subtype: enum（interrupt | batch_review | null）
  is_scanned_document: bool
  created_at: datetime（UTC）
  completed_at: datetime | null（UTC）
  langgraph_thread_id: str    # 对前端透明，仅后端内部使用

  # 聚合统计（查询时实时计算）
  progress_summary:
    total_high_risk: int
    decided_high_risk: int     # human_decision != 'pending' 的高风险数量
    total_medium_risk: int
    total_low_risk: int
```

#### 4.2.2 ReviewItem 查询结构（核心数据结构）

```
ReviewItem（查询返回）：
  id: UUID
  session_id: UUID

  # 原文定位信息
  clause_text: str             # 原文段落全文（只读）
  clause_location:
    page_number: int           # 页码（1-indexed）
    paragraph_offset: int      # 页内段落序号（0-indexed）
    highlight_anchor: str      # 前端滚动定位用的锚点标识符

  # AI 判断结果
  risk_level: enum（low | medium | high）
  confidence_score: int（0-100）
  source: enum（rule_engine | ai_inference）
  rule_id: str | null          # 规则触发时的规则 ID（source=rule_engine 时有值）
  ai_finding: str              # AI 风险描述（模态表述，非绝对化）
  suggested_modification: str | null  # AI 修改建议

  # 人工决策结果
  human_decision: enum（pending | approve | edit | reject）
  human_note: str | null       # 人工填写的接受原因或修改内容
  human_modified_risk_level: enum | null   # Edit 操作时人工修正的风险等级
  human_modified_finding: str | null       # Edit 操作时人工修正的风险描述
  decided_by: UUID | null      # 操作人用户 ID
  decided_at: datetime | null  # 操作时间（UTC）
  is_false_positive: bool      # Reject 时标记为误报

  # 快照（用于报告 Edit 对照展示）
  decision_history: List[DecisionSnapshot]  # 含撤销记录的操作历史
```

**查询过滤规范**：

| 过滤参数 | 允许值 | 说明 |
|----------|--------|------|
| `risk_level` | low / medium / high / all | 按风险等级筛选 |
| `human_decision` | pending / approve / edit / reject / all | 按决策状态筛选 |
| `source` | rule_engine / ai_inference / all | 按判断来源筛选 |
| `sort_by` | risk_level_desc / confidence_desc / location_asc | 排序方式 |

**分页规范**：
- 默认每页 20 条
- 使用游标分页（cursor-based）而非 offset 分页，避免高并发下数据漂移
- 返回 `next_cursor` 和 `total_count`

#### 4.2.3 ExtractedField 查询结构

```
ExtractedField（查询返回）：
  id: UUID
  session_id: UUID
  field_name: enum（party_a | party_b | amount | effective_date | expiry_date |
                    governing_law | dispute_resolution | ...）
  field_value: str             # 当前值（用户修改后为修改后的值）
  original_value: str          # AI 原始提取值（修改后保留原始值用于对照）
  confidence_score: int（0-100）
  needs_human_verification: bool（confidence_score < 60 时为 true）
  verification_status: enum（unverified | confirmed | modified）
  ocr_source_page: int         # 字段来源页码
  ocr_source_offset: int       # 页内段落偏移
```

#### 4.2.4 ReviewReport 查询结构

```
ReviewReport（查询返回）：
  id: UUID
  session_id: UUID
  generated_at: datetime（UTC）

  # 执行摘要（来自 ExtractedField 聚合）
  summary:
    contract_parties: List[str]    # 合同主体列表
    contract_amount: str | null    # 合同金额
    effective_date: str | null     # 生效日期
    overall_risk_level: enum（low | medium | high）
    conclusion: str                # 审核结论（非绝对化，如"建议有条件推进"）

  # 条款统计
  item_stats:
    total: int
    approved: int
    edited: int
    rejected: int
    auto_passed: int        # 低风险自动通过数量

  # 覆盖范围声明（设计红线：必须包含）
  coverage_statement:
    covered_clause_types: List[str]    # 已覆盖的条款类型
    not_covered_clause_types: List[str]  # 明确未覆盖的条款类型

  # 免责声明（设计红线：必须包含，固定文本）
  disclaimer: str  # "本报告由 AI 辅助分析生成，所有最终判断由人工审核人员 {reviewer_name} 负责..."

  # 报告文件路径（下载用）
  pdf_path: str | null     # 报告 PDF 对象存储路径
  json_path: str | null    # 报告 JSON 对象存储路径
```

### 4.3 查询接口设计思路

#### 4.3.1 查询接口分组

**会话级查询**（获取整体状态）：

```
GET /sessions/{session_id}
  → 返回 ReviewSession 完整信息 + progress_summary
  → 用途：前端工作流状态条展示、进度百分比计算

GET /sessions/{session_id}/fields
  → 返回该会话的所有 ExtractedField 列表
  → 支持过滤：needs_human_verification = true（仅低置信度字段）
  → 用途：字段核对页展示

GET /sessions/{session_id}/items
  → 返回该会话的所有 ReviewItem 列表
  → 支持过滤参数：risk_level, human_decision, source, sort_by
  → 支持游标分页
  → 用途：HITL 审批页条款列表、扫描结果页展示

GET /sessions/{session_id}/items/{item_id}
  → 返回单条 ReviewItem 详情（含 decision_history）
  → 用途：条款详情展示、审计追溯

GET /sessions/{session_id}/report
  → 返回 ReviewReport 结构化内容（JSON 格式）
  → 用途：报告在线预览页

GET /sessions/{session_id}/report/download?format=pdf|json
  → 返回文件流（PDF 或 JSON 文件下载）
  → 后端记录 report_downloaded 事件
  → 用途：报告下载
```

**列表级查询**（合同列表）：

```
GET /contracts
  → 返回当前用户有权查看的合同列表
  → 聚合信息：contract 基本信息 + 关联 ReviewSession 的 state
  → 支持过滤：state, uploaded_by, date_range
  → 支持分页

GET /contracts/{contract_id}
  → 返回合同详情 + 关联的所有 ReviewSession（一个合同可有多个会话，前次 aborted 后重建的场景）
```

#### 4.3.2 查询性能策略

| 场景 | 性能策略 |
|------|----------|
| `GET /sessions/{id}/items` 高并发 | 为 `(session_id, risk_level, human_decision)` 建立复合索引 |
| 会话进度 `progress_summary` 计算 | 在 HITL 决策写入时同步更新预计算的计数字段，避免查询时 COUNT 扫描 |
| 报告 JSON 内容查询 | 报告生成后缓存至 Redis，TTL 24 小时；缓存命中直接返回 |
| 合同列表分页 | 使用 keyset 分页（`WHERE id > cursor`），不使用 OFFSET 分页 |

#### 4.3.3 查询权限矩阵

| 接口 | reviewer 角色 | submitter 角色 | admin 角色 |
|------|--------------|---------------|-----------|
| `GET /sessions/{id}` | 自己参与的会话 | 自己提交的合同的会话（只读） | 所有 |
| `GET /sessions/{id}/items` | 自己参与的会话 | 只读（不含 decision_history 明细） | 所有 |
| `GET /sessions/{id}/report` | 自己参与的会话 | 自己提交的合同的报告 | 所有 |
| `GET /contracts` | 自己参与的合同 | 自己提交的合同 | 所有 |
| 审计日志查询 | 自己操作的日志 | 无权限 | 所有 |

### 4.4 报告生成逻辑

报告生成是审核结构查询模块的写入操作（仅在 `completed` 状态时触发一次），生成后转为只读。

```
报告生成任务执行流程（伪代码描述）：

输入：session_id

步骤 1：从数据库聚合报告所需数据
  - 查询 ReviewSession 完整信息
  - 查询所有 ExtractedField（用于执行摘要）
  - 查询所有 ReviewItem（含 decision_history）
  - 查询关联 AuditLog（用于审计链路）

步骤 2：校验报告完整性
  - 确认所有 high risk ReviewItem.human_decision != 'pending'
  - 确认 coverage_statement 不为空
  - 确认 disclaimer 模板存在

步骤 3：计算整体风险结论（非绝对化）
  IF 存在 approved 且 risk_level=high 的条款:
    overall_risk_level = 'high'
    conclusion = "发现已确认的高风险条款，建议谨慎评估后推进"
  ELSE IF 存在 edited 的条款:
    overall_risk_level = 'medium'
    conclusion = "审核人员已对部分条款作出修正判断，建议按修正意见处理后推进"
  ELSE:
    overall_risk_level = 'low'
    conclusion = "未发现强制阻止推进的风险条款，建议结合业务背景最终决策"

步骤 4：生成 JSON 格式报告
  将 ReviewReport 结构序列化为 JSON
  写入对象存储：{base_path}/reports/{session_id}/report.json

步骤 5：生成 PDF 格式报告
  使用模板引擎（如 WeasyPrint）将 JSON 数据渲染为 PDF
  写入对象存储：{base_path}/reports/{session_id}/report.pdf
  PDF 页眉：合同标题
  PDF 页脚：页码 + 生成时间 + 免责声明简版

步骤 6：更新数据库
  ReviewReport 记录写入 pdf_path + json_path + generated_at
  ReviewSession.state = 'report_ready'
  ReviewSession.completed_at = UTC 时间戳

步骤 7：推送事件
  SSE/WebSocket 推送：report_ready
  记录审计日志：report_ready
```

**报告内容强制校验规则**：

| 校验项 | 规则 | 违反时处理 |
|--------|------|-----------|
| 覆盖范围声明 | `coverage_statement` 不可为空 | 生成任务失败，记录 system_failure 并告警 |
| 免责声明 | 必须包含固定文本"AI 辅助分析" | 使用预定义模板强制注入 |
| AI 结论不绝对化 | `ai_finding` 字段不含"该条款违法"等绝对化表述 | 自动后处理（添加修饰词），同时记录告警 |
| Edit 对照展示 | `human_decision = 'edit'` 的条款必须有 decision_history | 如历史快照缺失，阻止报告生成并告警 |
| 操作审计日志完整性 | 报告中必须包含完整 AuditLog 链路 | 如日志不完整，在报告中标注"部分审计记录可能缺失" |

---

## 五、模块间依赖关系说明

### 5.1 数据流向图

```
┌─────────────────────────────────────────────────────────┐
│                    前端（HTTP 请求）                      │
└─────────┬────────────────────────────┬──────────────────┘
          │ POST /contracts/upload     │ GET 查询类请求
          ▼                            ▼
┌─────────────────┐          ┌─────────────────────┐
│   文件上传模块   │          │  审核结构查询模块    │
│                 │          │                     │
│ - 接收 + 校验   │          │ - ReviewItem 查询   │
│ - 文件存储      │          │ - ExtractedField 查询│
│ - 创建实体      │          │ - ReviewReport 查询  │
│ - 触发 OCR     │          │ - 报告下载           │
│                 │          │                     │
└───────┬─────────┘          └──────────┬──────────┘
        │ OCR 完成，                     │
        │ ExtractedField 写入完成        │ 读取持久化数据
        ▼                               ▼
┌────────────────────────────────────────────────────────┐
│                   任务状态管理模块                       │
│                                                        │
│  LangGraph StateGraph                                  │
│  ┌──────────┐  ┌─────────────┐  ┌────────────────┐   │
│  │risk_scan │→ │  routing   │→ │  hitl_review   │   │
│  │   node   │  │    node     │  │     node       │   │
│  └──────────┘  └─────────────┘  └────────────────┘   │
│                                         │               │
│  Checkpointer（PostgresSaver）          │               │
│  SSE/WebSocket 事件推送                  │ resume()      │
│                                         ▼               │
│                                 ┌──────────────────┐   │
│                                 │ report_generation│   │
│                                 │      node        │   │
│                                 └──────────────────┘   │
└────────────────────────────────────────────────────────┘
                         │
                         │ 持久化数据
                         ▼
┌────────────────────────────────────────────────────────┐
│                      数据存储层                         │
│                                                        │
│  关系型数据库（PostgreSQL）：                           │
│    Contract / ReviewSession / ReviewItem /              │
│    ExtractedField / ReviewReport / AuditLog / User     │
│                                                        │
│  对象存储（MinIO / OSS）：                              │
│    合同原文件 / 报告 PDF / 报告 JSON                   │
│                                                        │
│  向量数据库（pgvector 生产 / Chroma 开发）：            │
│    风险规则库向量索引 / 历史案例库                      │
│                                                        │
│  LangGraph Checkpointer 存储（PostgreSQL）：           │
│    工作流状态快照（thread_id → checkpoint）            │
│                                                        │
│  缓存（Redis）：                                        │
│    报告 JSON 缓存（TTL 24h）/ 会话并发锁                │
└────────────────────────────────────────────────────────┘
```

### 5.2 模块间调用依赖矩阵

| 调用方 | 被调用方 | 调用内容 | 调用时机 |
|--------|---------|---------|---------|
| 文件上传模块 | 任务状态管理模块 | 通知 OCR 完成，触发状态流转 `parsing → scanning` | OCR 回调成功后 |
| 文件上传模块 | 数据存储层 | 创建 Contract / ReviewSession / ExtractedField 记录 | 校验通过后 |
| 任务状态管理模块 | 数据存储层 | 读写 ReviewSession / ReviewItem / AuditLog | 工作流各节点执行时 |
| 任务状态管理模块 | LangGraph Checkpointer | 写入/读取工作流状态快照 | 每个节点完成后 |
| 任务状态管理模块 | 向量数据库 | 语义检索风险规则库（RAG） | risk_scanning 节点 |
| 任务状态管理模块 | 外部 LLM | 结构化输出推理（风险判断 + 字段提取） | risk_scanning 节点 |
| 任务状态管理模块 | 外部 OCR 服务 | 调用解析 + 接收回调 | parsing 阶段 |
| 审核结构查询模块 | 数据存储层 | 只读查询各实体 | 前端 GET 请求时 |
| 审核结构查询模块 | 对象存储 | 读取报告文件（PDF/JSON）并提供下载 | 报告下载请求时 |
| 审核结构查询模块 | 缓存（Redis） | 读取报告 JSON 缓存 | 报告内容查询时 |

### 5.3 关键数据一致性约束

以下数据一致性约束必须在架构设计中保障：

| 约束 | 保障机制 |
|------|---------|
| `ReviewSession.state` 与 LangGraph Checkpointer 中的工作流状态保持同步 | 状态流转时在数据库事务中同时写入，Checkpointer 写入失败则数据库回滚 |
| `ReviewSession.state = completed` 时，所有 `high risk ReviewItem.human_decision != 'pending'` | resume() 触发前后端服务层强制校验；数据库层通过事务保障 |
| 报告内容引用的 ReviewItem 快照不可被事后修改 | `ReviewSession.state = completed` 后，ReviewItem 进入只读状态，后端拒绝一切修改请求 |
| 操作审计日志不可删除、不可修改 | AuditLog 表设置为 INSERT ONLY，不提供 UPDATE/DELETE 接口；由数据库约束保障 |
| 同一会话同时只有一个活跃审核人员 | Redis 行级锁，锁 key = `session_lock:{session_id}`，TTL = 5 分钟 |

### 5.4 外部服务依赖说明

| 外部服务 | 依赖模块 | 集成方式 | 故障处理策略 |
|----------|---------|---------|------------|
| 外部 OCR 服务（达观 TextIn 等） | 文件上传模块 | 异步任务队列调用 + 回调/轮询 | 超时重试（最多 3 次）；超出后 state → aborted |
| LLM 服务（GPT-4.1 / Claude / 私有化部署） | 任务状态管理模块（风险扫描节点） | 同步 API 调用，带超时 | 单次调用超时 60 秒；失败重试 2 次；仍失败则 state → aborted，记录 system_failure |
| 向量数据库（pgvector） | 任务状态管理模块（风险扫描节点） | 直接数据库查询 | 降级策略：向量检索失败时跳过规则库检索，仅使用 LLM 推理，并在 ReviewItem 上标注 `rule_search_degraded = true` |

---

*本文档为 Teammate 1 基于现有业务调研、问题建模、交互链路与前后端边界规范产出的后端服务架构规范，覆盖文件上传模块、任务状态管理模块和审核结构查询模块三个核心后端服务。文档不包含实际可执行代码，仅以伪代码、流程描述、表格和状态机文字描述形式呈现架构规范，供后续 implementer 阶段执行使用。*
