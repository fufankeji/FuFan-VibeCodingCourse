# 合同审核系统 API 规范 v1.0

**文档编号**：08_api_spec/api_spec-v1.0
**版本**：v1.0
**编写日期**：2026-03-11
**状态**：初稿
**输入文档**：
- `06_architecture/data_model_spec-v1.0.md`
- `04_interaction_design/langchain_hitl_arch-v1.0.md`
- `03_problem_modeling/problem_model.md`
- `04_interaction_design/flow_state_spec-v1.0.md`
- `06_architecture/backend_service_arch-v1.0.md`

---

## 目录

1. [全局约定](#一全局约定)
2. [认证与权限](#二认证与权限)
3. [文档上传接口](#三文档上传接口)
4. [审核会话查询接口](#四审核会话查询接口)
5. [结构化字段查询接口](#五结构化字段查询接口)
6. [审核条款查询接口](#六审核条款查询接口)
7. [人工审核决策接口](#七人工审核决策接口)
8. [审核报告接口](#八审核报告接口)
9. [实时事件推送规范](#九实时事件推送规范)
10. [合同列表接口](#十合同列表接口)
11. [前后端联调接入顺序](#十一前后端联调接入顺序)

---

## 一、全局约定

### 1.1 基础信息

| 项目 | 值 |
|------|----|
| Base URL | `https://{host}/api/v1` |
| 协议 | HTTPS |
| 数据格式 | `application/json`（文件上传除外） |
| 时间格式 | ISO 8601 UTC，示例：`2026-03-11T08:00:00Z` |
| ID 格式 | UUID v4 |

### 1.2 统一错误响应格式

所有接口在发生错误时，返回以下统一结构：

```json
{
  "error_code": "VALIDATION_ERROR",
  "message": "高风险条款必须填写不少于 10 字的处理原因",
  "request_id": "req_abc123def456"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `error_code` | string | 机器可读的错误标识符（见下表） |
| `message` | string | 人类可读的错误描述（中文） |
| `request_id` | string | 请求追踪 ID，用于日志排查 |

**通用错误码表**：

| HTTP 状态码 | error_code | 含义 |
|-------------|------------|------|
| 400 | `BAD_REQUEST` | 请求参数格式错误 |
| 400 | `BULK_HIGH_RISK_FORBIDDEN` | 禁止批量操作高风险条款 |
| 400 | `HUMAN_NOTE_TOO_SHORT` | human_note 少于 10 字 |
| 401 | `UNAUTHORIZED` | 未提供有效认证凭证 |
| 403 | `FORBIDDEN` | 当前用户无操作权限 |
| 403 | `ROLE_NOT_ALLOWED` | 用户角色不允许此操作 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 409 | `SESSION_STATE_CONFLICT` | 会话当前状态不允许此操作 |
| 409 | `SESSION_LOCKED` | 会话已被其他用户锁定 |
| 413 | `FILE_TOO_LARGE` | 文件超过 50MB 限制 |
| 422 | `FILE_CORRUPTED` | 文件结构损坏 |
| 422 | `FILE_ENCRYPTED` | 文件已加密无法解析 |
| 422 | `FILE_EMPTY` | 文件内容为空 |
| 422 | `INVALID_FILE_TYPE` | 文件类型不符合要求 |
| 429 | `RATE_LIMITED` | 请求过于频繁 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

### 1.3 分页约定

列表接口统一使用游标分页（cursor-based），**禁止使用 offset 分页**。

**请求参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `limit` | integer | 否 | 每页条数，默认 20，最大 100 |
| `cursor` | string | 否 | 游标值，首次请求不传 |

**响应结构**：

```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6InV1aWQxIn0",
    "has_more": true,
    "total_count": 150
  }
}
```

### 1.4 幂等性约定

以下写入接口支持幂等性，通过请求头 `Idempotency-Key` 传递客户端生成的唯一键（UUID v4）：

- `POST /sessions/{session_id}/items/{item_id}/decision`

同一 `Idempotency-Key` 的重复请求，后端返回**首次成功**的响应体，HTTP 状态码为 200，不重复写入。

---

## 二、认证与权限

### 2.1 认证方式

所有接口须在请求头携带 JWT Bearer Token：

```
Authorization: Bearer <jwt_token>
```

Token 由独立鉴权服务签发，后端独立校验，**不信任请求体中的用户角色信息**。

### 2.2 用户角色权限矩阵

| 角色 | `reviewer` | `submitter` | `admin` |
|------|-----------|------------|--------|
| 上传合同 | ✓ | ✓ | ✓ |
| 查看自己的合同 | ✓ | ✓ | ✓ |
| 执行 HITL 决策 | ✓ | ✗ | ✓ |
| 查看审核条款详情 | ✓ | 只读，不含 decision_history | ✓ |
| 下载报告 | ✓ | ✓（仅自己提交的） | ✓ |
| 查看审计日志 | 仅自己操作的 | ✗ | ✓ |

---

## 三、文档上传接口

### 3.1 上传合同文件

**功能**：接收合同文件，执行服务端校验，创建 `Contract`、`FileUpload`、`ReviewSession` 实体，提交异步 OCR 解析任务。

```
POST /contracts/upload
Content-Type: multipart/form-data
```

**请求体（multipart/form-data）**：

| 字段 | 类型 | 必填 | 约束 | 说明 |
|------|------|------|------|------|
| `file` | binary | 是 | 格式：PDF/DOCX；大小：≤ 50MB | 合同文件流 |
| `contract_title` | string | 否 | 最长 200 字符 | 合同名称；为空则从文件名提取 |

> **安全约定**：上传人 ID 从 JWT Token 解析，**不从请求体传入**。

**服务端校验序列**（按顺序执行，任一失败即返回对应错误）：

1. 解析文件头（Magic Bytes）：PDF → `%PDF-`；DOCX → PK（ZIP 格式）
2. 文件大小确认（≤ 50MB）
3. 文件结构完整性检测（PDF 解析 xref 表；DOCX 尝试解压 ZIP）
4. 文件加密检测（拒绝加密 PDF）
5. 内容可读性预检（空文档拒绝；扫描件标记 `is_scanned_document = true`）

**成功响应（HTTP 201）**：

```json
{
  "contract_id": "550e8400-e29b-41d4-a716-446655440000",
  "session_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "state": "parsing",
  "is_scanned_document": false,
  "message": "文件上传成功，正在解析中"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `contract_id` | UUID | 创建的合同 ID |
| `session_id` | UUID | 创建的审核会话 ID，后续所有操作的主键 |
| `state` | string | 初始状态，固定为 `parsing` |
| `is_scanned_document` | boolean | 是否为扫描件（影响 OCR 精度提示） |
| `message` | string | 操作描述信息 |

**错误响应**：

| 场景 | HTTP 状态码 | error_code |
|------|------------|------------|
| 文件类型不符合（非 PDF/DOCX） | 400 | `INVALID_FILE_TYPE` |
| 文件超过 50MB | 413 | `FILE_TOO_LARGE` |
| 文件结构损坏 | 422 | `FILE_CORRUPTED` |
| 文件已加密 | 422 | `FILE_ENCRYPTED` |
| 文件内容为空 | 422 | `FILE_EMPTY` |

**触发的异步操作**：

接口成功返回后，后端异步执行：
1. 调用外部 OCR 服务（如达观 TextIn），提交解析任务
2. OCR 完成后，提取结构化字段（`ExtractedField`），`ReviewSession.state` 由 `parsing` → `scanning`
3. 通过 SSE/WebSocket 推送 `state_changed: scanning` 事件

---

### 3.2 重试解析（OCR 失败后）

**功能**：在 OCR 解析失败或超时后，用户主动触发重新解析（最多 3 次）。

```
POST /sessions/{session_id}/retry-parse
```

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `session_id` | UUID | 审核会话 ID |

**前置条件**：`ReviewSession.state = parsing` 且 `ParseResult.retry_count < 3`

**成功响应（HTTP 200）**：

```json
{
  "session_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "state": "parsing",
  "retry_count": 2,
  "message": "重新解析已提交"
}
```

**错误响应**：

| 场景 | HTTP 状态码 | error_code |
|------|------------|------------|
| 会话状态不是 `parsing` | 409 | `SESSION_STATE_CONFLICT` |
| 已达最大重试次数（3次） | 409 | `MAX_RETRY_EXCEEDED` |

---

### 3.3 放弃审核流程

**功能**：用户主动中止当前审核流程，将 `ReviewSession.state` 置为 `aborted`（终态，不可逆）。

```
POST /sessions/{session_id}/abort
```

**请求体**：

```json
{
  "reason": "用户取消"
}
```

**成功响应（HTTP 200）**：

```json
{
  "session_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "state": "aborted"
}
```

**约束**：已处于终态（`report_ready` 或 `aborted`）的会话不可再次放弃，返回 409。

---

## 四、审核会话查询接口

### 4.1 查询会话详情

**功能**：获取审核会话的完整状态信息，包含进度统计。前端工作流状态条、进度展示的主要数据源。

```
GET /sessions/{session_id}
```

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `session_id` | UUID | 审核会话 ID |

**成功响应（HTTP 200）**：

```json
{
  "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "contract_id": "550e8400-e29b-41d4-a716-446655440000",
  "state": "hitl_pending",
  "hitl_subtype": "interrupt",
  "is_scanned_document": false,
  "created_at": "2026-03-11T08:00:00Z",
  "completed_at": null,
  "progress_summary": {
    "total_high_risk": 5,
    "decided_high_risk": 2,
    "total_medium_risk": 8,
    "total_low_risk": 12
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `state` | enum | 见状态枚举：`parsing` / `scanning` / `hitl_pending` / `completed` / `report_ready` / `aborted` |
| `hitl_subtype` | enum \| null | `interrupt`（有高风险）/ `batch_review`（仅中风险）/ `null`（非 hitl_pending 状态） |
| `progress_summary.decided_high_risk` | integer | `human_decision != pending` 的高风险条款数，前端用于计算进度百分比 |

> **注意**：`langgraph_thread_id` 字段**不暴露给前端**，仅后端内部使用。

---

### 4.2 查询会话恢复信息

**功能**：用户重新进入处于 `hitl_pending` 的会话时，获取恢复断点信息（上次保存时间、已完成条数、下一条待处理条款 ID）。

```
GET /sessions/{session_id}/recovery
```

**前置条件**：`ReviewSession.state = hitl_pending`

**成功响应（HTTP 200）**：

```json
{
  "session_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "interrupted_at": "2026-03-10T18:30:00Z",
  "completed_count": 2,
  "total_high_risk_count": 5,
  "next_pending_item_id": "a3f8e200-1234-5678-abcd-000000000001",
  "recovery_status": "active"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `interrupted_at` | datetime | 上次中断时间，前端展示"上次保存时间" |
| `completed_count` | integer | 已完成的高风险条款数 |
| `total_high_risk_count` | integer | 高风险条款总数 |
| `next_pending_item_id` | UUID | 下一条 `human_decision = pending` 的高风险条款 ID，用于定位滚动 |

**后端副作用**：调用此接口会触发 LangGraph Checkpointer 状态校验与恢复，并记录 `session_resumed` 事件到 `AuditLog`。

---

## 五、结构化字段查询接口

### 5.1 查询结构化字段列表

**功能**：获取 OCR 解析后提取的合同结构化字段，用于字段核对视图展示。

```
GET /sessions/{session_id}/fields
```

**查询参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `needs_verification` | boolean | 否 | `true` 时只返回 `needs_human_verification = true` 的字段 |

**成功响应（HTTP 200）**：

```json
{
  "session_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "fields": [
    {
      "id": "field-uuid-001",
      "field_name": "party_a",
      "field_value": "ABC 科技有限公司",
      "original_value": "ABC 科技有限公司",
      "confidence_score": 92,
      "needs_human_verification": false,
      "verification_status": "unverified",
      "source_evidence_text": "甲方：ABC 科技有限公司（以下简称"甲方"）",
      "source_page_number": 1,
      "source_char_offset_start": 45,
      "source_char_offset_end": 57
    },
    {
      "id": "field-uuid-002",
      "field_name": "contract_amount",
      "field_value": "¥500,000",
      "original_value": "¥500,000",
      "confidence_score": 55,
      "needs_human_verification": true,
      "verification_status": "unverified",
      "source_evidence_text": "合同总价款为人民币伍拾万元整",
      "source_page_number": 2,
      "source_char_offset_start": 210,
      "source_char_offset_end": 230
    }
  ]
}
```

**字段置信度颜色规则（前端展示约定）**：

| `confidence_score` 范围 | 颜色 | `needs_human_verification` |
|------------------------|------|---------------------------|
| ≥ 85 | 绿色 | `false` |
| 60 – 84 | 黄色 | `false` |
| < 60 | 橙红色 + 橙色边框 | `true` |

---

### 5.2 提交字段核验

**功能**：用户在字段核对视图中确认或修改 AI 提取的字段值。

```
PATCH /sessions/{session_id}/fields/{field_id}
```

**请求体**：

```json
{
  "action": "confirm",
  "verified_value": "ABC 科技有限公司"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `action` | enum | `confirm`（确认 AI 值）/ `modify`（修改）/ `skip`（跳过） |
| `verified_value` | string | `action = modify` 时必填，人工修正后的值 |

**成功响应（HTTP 200）**：

```json
{
  "id": "field-uuid-002",
  "verification_status": "confirmed",
  "verified_value": "¥500,000",
  "verified_by": "user-uuid-001",
  "verified_at": "2026-03-11T09:15:00Z"
}
```

**触发的审计事件**：`field_verified`（confirm）/ `field_modified`（modify）/ `field_verify_skipped`（skip）

---

## 六、审核条款查询接口

### 6.1 查询审核条款列表

**功能**：获取会话下所有风险条款，支持按风险等级、决策状态、来源筛选。用于 HITL 审批页左栏条款列表和扫描结果展示。

```
GET /sessions/{session_id}/items
```

**查询参数**：

| 参数 | 类型 | 必填 | 可选值 | 说明 |
|------|------|------|--------|------|
| `risk_level` | string | 否 | `high` / `medium` / `low` / `all`（默认） | 按风险等级筛选 |
| `human_decision` | string | 否 | `pending` / `approve` / `edit` / `reject` / `all`（默认） | 按决策状态筛选 |
| `source` | string | 否 | `rule_engine` / `ai_inference` / `all`（默认） | 按判断来源筛选 |
| `sort_by` | string | 否 | `risk_level_desc`（默认）/ `confidence_desc` / `location_asc` | 排序方式 |
| `limit` | integer | 否 | 默认 20 | 游标分页每页数量 |
| `cursor` | string | 否 | — | 游标值 |

**成功响应（HTTP 200）**：

```json
{
  "data": [
    {
      "id": "item-uuid-001",
      "session_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "risk_level": "HIGH",
      "confidence_score": 88,
      "source_type": "rule_engine",
      "risk_category": "单边条款",
      "ai_finding": "可能存在单边修改权风险：甲方可单方面变更服务内容而无需乙方同意",
      "ai_reasoning": "该条款赋予甲方单方面变更权，缺乏对等制衡机制，可能存在权利滥用风险",
      "suggested_revision": "建议增加"重大变更需提前30日书面通知乙方并取得书面同意"的约束",
      "human_decision": "pending",
      "human_note": null,
      "human_edited_risk_level": null,
      "human_edited_finding": null,
      "is_false_positive": false,
      "decided_by": null,
      "decided_at": null,
      "clause_location": {
        "page_number": 3,
        "paragraph_index": 2,
        "highlight_anchor": "page3-para2"
      },
      "risk_evidence": [
        {
          "id": "evidence-uuid-001",
          "evidence_text": "甲方有权随时修改本协议条款，修改后即时生效",
          "context_before": "第五条 服务内容",
          "context_after": "乙方应予以配合",
          "page_number": 3,
          "paragraph_index": 2,
          "char_offset_start": 1250,
          "char_offset_end": 1298,
          "highlight_color": "#FFEBEE",
          "is_primary": true
        }
      ]
    }
  ],
  "pagination": {
    "next_cursor": "eyJpZCI6Iml0ZW0tdXVpZC0wMDIifQ",
    "has_more": true,
    "total_count": 25
  }
}
```

**关键字段说明**：

| 字段 | 说明 |
|------|------|
| `risk_level` | `HIGH` / `MEDIUM` / `LOW`（大写枚举） |
| `source_type` | `rule_engine`（蓝色标签"规则触发"）/ `ai_inference`（紫色标签"AI 推理"）/ `hybrid` |
| `ai_finding` | AI 风险描述，**必须**为模态表述，不含绝对化结论 |
| `risk_evidence[].is_primary` | 主要证据，前端双栏联动时优先使用此证据进行原文定位 |
| `clause_location.highlight_anchor` | 前端原文区滚动定位锚点 |

> **安全约束**：`risk_level`、`confidence_score`、`ai_finding`、`source_type` 为 AI 写入后**只读字段**，后端不提供修改接口；人工修正写入 `human_edited_*` 字段。

---

### 6.2 查询单条审核条款详情

**功能**：获取单条风险条款的完整信息，包含操作历史（用于审计追溯和 Edit 操作的差异对比）。

```
GET /sessions/{session_id}/items/{item_id}
```

**成功响应（HTTP 200）**：

在 6.1 响应结构基础上，增加：

```json
{
  "decision_history": [
    {
      "id": "decision-uuid-001",
      "decision_type": "approve",
      "operator_id": "user-uuid-001",
      "operator_name": "张三",
      "operated_at": "2026-03-11T10:00:00Z",
      "human_note": "经与业务方确认，此条款风险可接受",
      "original_ai_finding": "可能存在单边修改权风险...",
      "original_risk_level": "HIGH",
      "edited_ai_finding": null,
      "edited_risk_level": null,
      "is_false_positive": false,
      "is_revoked": false,
      "revoked_at": null
    }
  ]
}
```

---

## 七、人工审核决策接口

### 7.1 提交 HITL 决策（Approve / Edit / Reject）

**功能**：审核人员对单条风险条款提交处理决策。**每次只能提交单条**，高风险条款严禁批量提交。

```
POST /sessions/{session_id}/items/{item_id}/decision
Idempotency-Key: <uuid>
```

**请求体**：

```json
{
  "decision": "approve",
  "human_note": "经与业务法务确认，此条款风险在可接受范围内，已评估实际影响",
  "edited_risk_level": null,
  "edited_finding": null,
  "is_false_positive": false,
  "client_submitted_at": "2026-03-11T10:00:00Z"
}
```

| 字段 | 类型 | 必填 | 约束 | 说明 |
|------|------|------|------|------|
| `decision` | enum | 是 | `approve` / `edit` / `reject` | 决策类型 |
| `human_note` | string | 是 | 高风险条款 ≥ 10 字 | 处理原因或备注 |
| `edited_risk_level` | enum | 条件必填 | `decision = edit` 时必填 | 人工修正后的风险等级 |
| `edited_finding` | string | 条件必填 | `decision = edit` 时必填 | 人工修正后的风险描述 |
| `is_false_positive` | boolean | 否 | `decision = reject` 时为 `true` | 标记 AI 误报 |
| `client_submitted_at` | datetime | 否 | — | 客户端操作时间，用于行为分析 |

**后端校验序列**（按顺序执行，任一失败即拒绝）：

1. **会话状态校验**：`ReviewSession.state = hitl_pending`，否则返回 409 `SESSION_STATE_CONFLICT`
2. **批量操作禁止**：请求体若包含多条 item 决策且任一 `risk_level = HIGH`，返回 400 `BULK_HIGH_RISK_FORBIDDEN`
3. **human_note 长度**：`risk_level = HIGH` 时 `len(human_note) < 10`，返回 422 `HUMAN_NOTE_TOO_SHORT`
4. **操作人角色校验**：`current_user.role ∉ {reviewer, admin}`，返回 403 `ROLE_NOT_ALLOWED`
5. **幂等性检查**：`Idempotency-Key` 已存在且对应已成功请求，返回首次成功的响应体（HTTP 200）

**成功响应（HTTP 201）**：

```json
{
  "item_id": "item-uuid-001",
  "session_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "decision": "approve",
  "decided_at": "2026-03-11T10:00:00Z",
  "progress": {
    "decided_high_risk": 3,
    "total_high_risk": 5,
    "all_high_risk_completed": false
  }
}
```

| 字段 | 说明 |
|------|------|
| `progress.all_high_risk_completed` | 当所有高风险条款均已决策时为 `true`，前端可据此提示"即将进入报告生成" |

**成功决策后的后端副作用**：
1. 写入 `ReviewItem`（`human_decision`、`decided_by`、`decided_at`）
2. 写入 `HITLDecision`（含 AI 原始判断快照）
3. 写入 `AuditLog`（`item_approved` / `item_edited` / `item_rejected`）
4. 推送 SSE/WebSocket 事件 `item_decision_saved`
5. **检测 resume 触发条件**：若所有 `risk_level = HIGH` 的条款 `human_decision ≠ pending`，自动调用 LangGraph `resume()`，触发报告生成流程

---

### 7.2 撤销 HITL 决策

**功能**：审核人员撤销已提交的决策，将条款 `human_decision` 还原为 `pending`。

**前置条件**：`ReviewSession.state = hitl_pending` 且报告尚未生成（`state ≠ completed`）。

```
DELETE /sessions/{session_id}/items/{item_id}/decision
```

**成功响应（HTTP 200）**：

```json
{
  "item_id": "item-uuid-001",
  "human_decision": "pending",
  "revoked_at": "2026-03-11T10:30:00Z"
}
```

**约束**：`ReviewSession.state = completed` 或 `report_ready` 后，条款进入只读状态，撤销请求返回 409 `SESSION_STATE_CONFLICT`。

---

### 7.3 批量确认中风险条款

**功能**：仅在 `hitl_subtype = batch_review`（无高风险，仅中风险）时，允许批量确认中风险条款。**严禁在包含高风险条款时调用此接口**。

```
POST /sessions/{session_id}/items/batch-confirm
```

**请求体**：

```json
{
  "item_ids": ["item-uuid-010", "item-uuid-011", "item-uuid-012"],
  "human_note": "中风险条款已统一复核，风险可接受"
}
```

**前置条件校验**：

- `ReviewSession.hitl_subtype = batch_review`（否则返回 403）
- `item_ids` 中不含任何 `risk_level = HIGH` 的条款（否则返回 400 `BULK_HIGH_RISK_FORBIDDEN`）

**成功响应（HTTP 200）**：

```json
{
  "confirmed_count": 3,
  "session_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "all_medium_risk_completed": true
}
```

---

## 八、审核报告接口

### 8.1 查询报告状态与内容

**功能**：获取报告生成状态及结构化内容，用于报告在线预览。

```
GET /sessions/{session_id}/report
```

**前置条件**：`ReviewSession.state ∈ {completed, report_ready}`

**成功响应（HTTP 200）**：

```json
{
  "id": "report-uuid-001",
  "session_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "report_status": "ready",
  "generated_at": "2026-03-11T11:00:00Z",
  "summary": {
    "contract_parties": ["ABC 科技有限公司", "XYZ 咨询集团"],
    "contract_amount": "¥500,000",
    "effective_date": "2026-04-01",
    "overall_risk_level": "high",
    "conclusion": "发现已确认的高风险条款，建议谨慎评估后推进"
  },
  "item_stats": {
    "total": 25,
    "approved": 3,
    "edited": 1,
    "rejected": 1,
    "auto_passed": 20
  },
  "coverage_statement": {
    "covered_clause_types": ["单边条款", "违约金条款", "保密条款", "争议解决", "合同解除"],
    "not_covered_clause_types": ["知识产权归属（复杂嵌套结构）", "跨境数据合规条款"]
  },
  "disclaimer": "本报告由 AI 辅助分析生成，所有最终判断由人工审核人员 张三 于 2026-03-11 11:00 UTC 负责确认。AI 分析结论仅供参考，不构成法律意见。"
}
```

**关键设计红线字段（后端强制校验，不可省略）**：

| 字段 | 设计红线 | 后端保障 |
|------|---------|---------|
| `coverage_statement` | 必须声明已覆盖和未覆盖的条款类型 | 后端生成时强制非空校验，缺失则报告生成失败 |
| `disclaimer` | 必须包含固定免责声明文本 | 使用预定义模板强制注入，不可自定义覆盖 |
| `summary.conclusion` | 不可使用绝对化结论 | 只允许预定义的非绝对化结论模板 |

**报告状态说明**：

| `report_status` | 含义 | 前端行为 |
|-----------------|------|---------|
| `generating` | 报告生成中 | 展示等待动画，订阅 SSE `report_ready` 事件 |
| `ready` | 报告已就绪 | 展示报告内容，启用下载按钮 |

---

### 8.2 下载报告文件

**功能**：下载 PDF 或 JSON 格式的报告文件，后端生成临时预签名 URL 并重定向。

```
GET /sessions/{session_id}/report/download?format=pdf
```

**查询参数**：

| 参数 | 类型 | 必填 | 可选值 | 说明 |
|------|------|------|--------|------|
| `format` | string | 是 | `pdf` / `json` | 下载格式 |

**成功响应（HTTP 302）**：

重定向至对象存储临时预签名 URL（有效期 ≤ 30 分钟）。

> **安全约定**：响应中不包含对象存储路径（`pdf_path`/`json_path`），前端只能通过此接口下载，**不可直接构造存储 URL**。

**后端副作用**：记录 `AuditLog`（`report_downloaded`），含 `format`、`downloaded_by`。

---

## 九、实时事件推送规范

### 9.1 连接建立

前端通过 SSE 或 WebSocket 订阅会话事件：

```
GET /sessions/{session_id}/events
Accept: text/event-stream
```

**连接约定**：
- 前端进入审核相关页面时建立连接，页面销毁时关闭
- 断线后前端自动重连；重连后后端推送当前最新 `state` 作为初始化补偿
- 连接空闲超过 30 分钟自动断开

### 9.2 事件格式

```
event: route_interrupted
data: {"session_id": "...", "high_risk_count": 5, "pending_item_ids": ["...", "..."]}
id: evt_001
```

### 9.3 完整事件类型表

| `event` 名称 | 推送时机 | `data` 关键字段 | 前端响应行为 |
|-------------|----------|----------------|-------------|
| `state_changed` | `parsing → scanning` 完成 | `state: "scanning"` | 解析页自动跳转至字段核对页 |
| `scan_progress` | 风险扫描进行中，每发现 1 条 ReviewItem | `found_count: 3, risk_level: "HIGH"` | 扫描进度页更新已发现风险计数 |
| `route_auto_passed` | 低风险路由完成，无需人工介入 | `session_id` | 跳转至报告生成等待页 |
| `route_batch_review` | 中风险路由完成（无高风险） | `session_id, medium_count` | 跳转至中风险批量复核视图 |
| `route_interrupted` | 高风险路由，LangGraph interrupt 触发 | `session_id, high_risk_count, pending_item_ids` | 跳转至 HITL 双栏审批视图 |
| `item_decision_saved` | 单条 HITL 决策持久化成功 | `item_id, decision, decided_high_risk, total_high_risk` | 审批页更新该条款状态 + 进度计数 |
| `report_generation_started` | LangGraph `resume()` 成功，报告生成任务启动 | `session_id` | 审批页跳转至报告生成等待页 |
| `report_ready` | 报告异步生成完成 | `session_id, report_id` | 等待页跳转至报告下载页 |
| `parse_failed` | OCR 解析失败 | `error_code, retry_count` | 解析页展示失败状态 + 重试入口 |
| `parse_timeout` | OCR 解析超时（> 15 分钟） | `elapsed_seconds, retry_count` | 同上 |
| `system_failure` | 不可恢复系统故障 | `error_code, node_name` | 当前页展示系统错误状态 |

---

## 十、合同列表接口

### 10.1 查询合同列表

**功能**：获取当前用户有权查看的合同列表，聚合展示合同基本信息和审核状态。

```
GET /contracts
```

**查询参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `state` | string | 否 | 按 `ReviewSession.state` 筛选，多值用逗号分隔 |
| `date_from` | date | 否 | 上传时间起始，格式 `YYYY-MM-DD` |
| `date_to` | date | 否 | 上传时间截止，格式 `YYYY-MM-DD` |
| `limit` | integer | 否 | 默认 20 |
| `cursor` | string | 否 | 游标值 |

**成功响应（HTTP 200）**：

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "ABC与XYZ服务合同",
      "original_filename": "contract_2026_v3.pdf",
      "contract_status": "processing",
      "uploaded_at": "2026-03-11T08:00:00Z",
      "uploaded_by": "user-uuid-001",
      "session": {
        "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        "state": "hitl_pending",
        "hitl_subtype": "interrupt",
        "completed_at": null,
        "progress": {
          "decided_high_risk": 2,
          "total_high_risk_count": 5
        }
      }
    }
  ],
  "pagination": {
    "next_cursor": "eyJpZCI6InV1aWQyIn0",
    "has_more": false,
    "total_count": 1
  }
}
```

---

### 10.2 查询单个合同详情

**功能**：获取单个合同详情，包含该合同所有历史审核会话（如有前次 `aborted` 后重建的场景）。

```
GET /contracts/{contract_id}
```

**成功响应（HTTP 200）**：

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "ABC与XYZ服务合同",
  "original_filename": "contract_2026_v3.pdf",
  "file_type": "pdf",
  "is_scanned_document": false,
  "contract_status": "processing",
  "uploaded_at": "2026-03-11T08:00:00Z",
  "sessions": [
    {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "state": "hitl_pending",
      "created_at": "2026-03-11T08:00:00Z",
      "completed_at": null
    }
  ]
}
```

---

## 十一、前后端联调接入顺序

本章定义前后端在各阶段的联调接入顺序，以消除接入依赖的歧义。

---

### 阶段一：文档上传与解析

**联调顺序**：

```
Step 1  后端就绪：POST /contracts/upload 接口可用，服务端校验逻辑完整
Step 2  前端接入：上传文件，获取 contract_id 和 session_id
Step 3  前端接入：建立 SSE 连接，订阅 session_id 的事件流
Step 4  联调验证：等待 state_changed（parsing → scanning）事件推送
Step 5  后端就绪：GET /sessions/{id}/fields 接口可用（含 OCR 完成后的 ExtractedField）
Step 6  前端接入：渲染字段核对视图，置信度颜色展示，低置信度字段橙色边框提示
Step 7  后端就绪：PATCH /sessions/{id}/fields/{field_id} 接口可用
Step 8  前端接入：接入字段 confirm/modify/skip 操作，提交后更新 verification_status
Step 9  联调验证：confirm/modify 操作后，AuditLog 中对应事件写入正确
```

**依赖关系**：
- 前端渲染字段核对页，**严格依赖** `state = scanning`（不可在 `parsing` 时进入）
- 字段置信度颜色展示，**必须从 API 响应读取** `confidence_score`，**不可前端自行推断**

---

### 阶段二：AI 扫描与分级路由

**联调顺序**：

```
Step 1  联调验证：SSE 事件流推送 scan_progress，前端更新扫描进度计数
Step 2  联调验证：扫描完成后，SSE 推送分级路由事件之一：
          - route_auto_passed（无风险）→ 前端跳转报告生成等待页
          - route_batch_review（中风险）→ 前端跳转批量复核视图
          - route_interrupted（高风险）→ 前端跳转 HITL 双栏审批视图
Step 3  后端就绪：GET /sessions/{id}/items 接口可用（含 ReviewItem + RiskEvidence）
Step 4  前端接入：HITL 双栏视图左栏条款列表渲染，来源标签（规则触发/AI推理）颜色展示
Step 5  联调验证：双栏联动——点击左侧条款卡片，右侧原文 smooth scroll + 高亮，延迟 ≤ 100ms
Step 6  联调验证：高风险条款 Approve 按钮在用户触达原文高亮区域前为禁用状态
```

**依赖关系**：
- 前端双栏联动，**严格依赖** `RiskEvidence.char_offset_start/end`（文本定位）或 `bbox_*`（PDF 定位）
- 来源标签必须区分 `rule_engine`（蓝色）和 `ai_inference`（紫色），**此为设计红线，联调时必须验证**

---

### 阶段三：人工审核（HITL 决策）

**联调顺序**：

```
Step 1  后端就绪：POST /sessions/{id}/items/{item_id}/decision 接口可用，5 项校验逻辑完整
Step 2  前端接入：Approve 决策流程：
          2a. 用户展开原文，Approve 按钮解锁
          2b. 用户填写 human_note（≥ 10 字），提交按钮解锁
          2c. 触发二次确认弹窗（展示用户填写的 human_note）
          2d. 提交 POST decision，携带 Idempotency-Key
Step 3  联调验证：后端收到 approve 决策，写入 ReviewItem + HITLDecision + AuditLog 完整
Step 4  联调验证：SSE 推送 item_decision_saved，前端更新进度计数
Step 5  联调验证：所有高风险条款 decided 后，后端自动触发 LangGraph resume()
Step 6  联调验证：SSE 推送 report_generation_started，前端自动跳转报告生成等待页
Step 7  后端就绪：DELETE /sessions/{id}/items/{item_id}/decision 接口可用
Step 8  前端接入：撤销操作，撤销后条款回到 pending 状态，进度计数回退
Step 9  联调验证：连续 5 条高风险条款均在 10 秒内 Approve，后端记录 bias_warning，
         前端展示警示提示（防 Automation Bias 机制）
```

**关键约束验证清单（联调必查项）**：

| 验证项 | 验证方式 |
|--------|---------|
| 高风险条款不可批量提交 | 前端无批量入口；后端尝试批量提交返回 400 |
| human_note < 10 字时提交被拒绝 | 后端返回 422，前端展示错误提示 |
| completed 后 ReviewItem 只读 | 尝试修改已 completed 会话的 item，返回 409 |
| Idempotency-Key 重复提交 | 相同 key 第二次提交返回首次成功的响应（HTTP 200） |

---

### 阶段四：报告生成与下载

**联调顺序**：

```
Step 1  联调验证：SSE 推送 report_ready，前端跳转至报告下载页
Step 2  后端就绪：GET /sessions/{id}/report 接口可用
Step 3  前端接入：渲染报告预览页，验证以下设计红线字段必须展示：
          - coverage_statement（覆盖范围声明）
          - disclaimer（免责声明）
          - summary.conclusion（非绝对化结论）
Step 4  后端就绪：GET /sessions/{id}/report/download?format=pdf|json 接口可用
Step 5  联调验证：下载 PDF，确认以下内容必须存在：
          - 每个条款的 AI 原始判断 + 人工最终决策
          - 覆盖范围声明
          - 免责声明固定文本
Step 6  联调验证：下载后 AuditLog 中写入 report_downloaded 事件，含 format 和 downloaded_by
```

---

### 联调接入优先级总览

| 优先级 | 接口 | 阶段 | 说明 |
|--------|------|------|------|
| P0 | `POST /contracts/upload` | 上传 | 整个系统入口，必须最先联调 |
| P0 | SSE `/sessions/{id}/events` | 全程 | 所有状态流转依赖事件推送 |
| P0 | `GET /sessions/{id}` | 全程 | 工作流状态条的数据源 |
| P1 | `GET /sessions/{id}/fields` | 字段核对 | 字段核对视图 |
| P1 | `GET /sessions/{id}/items` | HITL | HITL 双栏视图左栏 |
| P1 | `POST /sessions/{id}/items/{item_id}/decision` | HITL | 核心 HITL 操作 |
| P2 | `PATCH /sessions/{id}/fields/{field_id}` | 字段核对 | 字段确认/修改 |
| P2 | `DELETE /sessions/{id}/items/{item_id}/decision` | HITL | 撤销决策 |
| P2 | `GET /sessions/{id}/report` | 报告 | 报告预览 |
| P2 | `GET /sessions/{id}/report/download` | 报告 | 报告下载 |
| P3 | `GET /sessions/{id}/recovery` | 跨天恢复 | 断点恢复场景 |
| P3 | `POST /sessions/{id}/retry-parse` | 上传 | OCR 失败重试 |
| P3 | `POST /sessions/{id}/items/batch-confirm` | HITL | 中风险批量确认 |
| P3 | `GET /contracts` | 合同列表 | 合同工作台 |

---

## 附录：接口清单速查

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/contracts/upload` | 上传合同文件 |
| GET | `/contracts` | 合同列表 |
| GET | `/contracts/{contract_id}` | 合同详情 |
| GET | `/sessions/{session_id}` | 会话状态与进度 |
| GET | `/sessions/{session_id}/events` | SSE 实时事件流 |
| GET | `/sessions/{session_id}/recovery` | 跨天恢复信息 |
| POST | `/sessions/{session_id}/retry-parse` | 重试 OCR 解析 |
| POST | `/sessions/{session_id}/abort` | 放弃审核流程 |
| GET | `/sessions/{session_id}/fields` | 结构化字段列表 |
| PATCH | `/sessions/{session_id}/fields/{field_id}` | 提交字段核验 |
| GET | `/sessions/{session_id}/items` | 审核条款列表 |
| GET | `/sessions/{session_id}/items/{item_id}` | 审核条款详情 |
| POST | `/sessions/{session_id}/items/{item_id}/decision` | 提交 HITL 决策 |
| DELETE | `/sessions/{session_id}/items/{item_id}/decision` | 撤销 HITL 决策 |
| POST | `/sessions/{session_id}/items/batch-confirm` | 批量确认中风险条款 |
| GET | `/sessions/{session_id}/report` | 报告内容查询 |
| GET | `/sessions/{session_id}/report/download` | 报告文件下载 |

---

*本文档严格基于上述五份输入文档的既有定义，不包含超出其范围的新增假设。所有接口的字段定义与约束以 `06_architecture/data_model_spec-v1.0.md` 为权威来源。任何变更需同步更新本文档和对应的上游架构文档。*
