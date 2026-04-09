# 前后端联调计划 v1.0

**编写日期**：2026-03-11
**状态**：待确认
**输入文档**：`docs/08_api_spec/api_spec-v1.0.md`

---

## 一、现状分析

### 1.1 前端现状

前端所有页面 **100% 使用 Mock 数据**，无任何真实 API 调用（无 fetch/axios/API client）。

| 页面 | 文件 | Mock 使用方式 |
|------|------|--------------|
| DashboardPage | `pages/DashboardPage.tsx` | 直接导入 `MOCK_CONTRACTS` |
| ContractListPage | `pages/ContractListPage.tsx` | 直接导入 `MOCK_CONTRACTS` |
| ContractUploadPage | `pages/ContractUploadPage.tsx` | 硬编码 `mockSessionId = 'session-003'`，无真实上传 |
| FieldVerificationPage | `pages/FieldVerificationPage.tsx` | 直接导入 `MOCK_FIELDS` |
| HITLReviewPage | `pages/HITLReviewPage.tsx` | 直接导入 `MOCK_REVIEW_ITEMS` |
| BatchReviewPage | `pages/BatchReviewPage.tsx` | 直接导入 `MOCK_BATCH_ITEMS` |
| ReportPage | `pages/ReportPage.tsx` | 直接导入 `MOCK_REPORT` + `MOCK_REVIEW_ITEMS` |
| AdminPage | `pages/AdminPage.tsx` | 页面内硬编码 `MOCK_USERS_LIST` + `MOCK_RULES` |
| ParsingProgressPage | `pages/ParsingProgressPage.tsx` | 待确认（无 mock 导入，可能是纯 UI） |
| AIScanningPage | `pages/AIScanningPage.tsx` | 待确认 |

### 1.2 后端现状

后端基于 FastAPI + SQLAlchemy + SQLite，已实现以下 API 路由：

| 接口 | 方法 | 后端实现状态 |
|------|------|-------------|
| `/api/v1/contracts/upload` | POST | **已实现** - 含文件校验 + OCR 异步任务 |
| `/api/v1/contracts` | GET | **已实现** - 游标分页 |
| `/api/v1/contracts/{contract_id}` | GET | **已实现** |
| `/api/v1/sessions/{session_id}` | GET | **已实现** - 含 progress_summary |
| `/api/v1/sessions/{session_id}/events` | GET | **已实现** - SSE 事件流 |
| `/api/v1/sessions/{session_id}/recovery` | GET | **已实现** |
| `/api/v1/sessions/{session_id}/retry-parse` | POST | **已实现** |
| `/api/v1/sessions/{session_id}/abort` | POST | **已实现** |
| `/api/v1/sessions/{session_id}/fields` | GET | **已实现** |
| `/api/v1/sessions/{session_id}/fields/{field_id}` | PATCH | **已实现** |
| `/api/v1/sessions/{session_id}/items` | GET | **已实现** - 含筛选 + 游标分页 |
| `/api/v1/sessions/{session_id}/items/{item_id}` | GET | **已实现** |
| `/api/v1/sessions/{session_id}/items/{item_id}/decision` | POST | **已实现** - 含完整校验链 |
| `/api/v1/sessions/{session_id}/items/{item_id}/decision` | DELETE | **已实现** |
| `/api/v1/sessions/{session_id}/items/batch-confirm` | POST | **已实现** |
| `/api/v1/sessions/{session_id}/report` | GET | **已实现** - 含自动生成触发 |
| `/api/v1/sessions/{session_id}/report/download` | GET | **已实现** - FileResponse |

### 1.3 关键差异

1. **认证方式**：API 规范要求 JWT Bearer Token，后端当前使用 `X-User-ID` / `X-User-Role` Header 简化认证
2. **分页格式**：API 规范使用 `{data: [], pagination: {next_cursor, has_more, total_count}}`，后端返回 `{items: [], total, next_cursor}` — 需确认是否对齐
3. **前端无 API Client**：需新建统一的 API 调用层

---

## 二、联调前置准备

### 2.1 新建前端 API Client 层

在 `frontend/src/app/` 下新建 `api/` 目录：

```
frontend/src/app/api/
├── client.ts          # axios/fetch 封装，baseURL、请求拦截器、错误处理
├── contracts.ts       # 合同相关 API
├── sessions.ts        # 会话相关 API
├── fields.ts          # 字段相关 API
├── items.ts           # 审核条款相关 API
├── reports.ts         # 报告相关 API
└── sse.ts             # SSE 事件订阅封装
```

**配置约定**：
- `API_BASE_URL` = `http://localhost:8000/api/v1`
- 认证 Header：从 AuthContext 获取当前用户，设置 `X-User-ID` 和 `X-User-Role`
- 统一错误处理：解析后端 `{error_code, message}` 格式

### 2.2 后端启动确认

```bash
cd F:/AgentTeamProject/backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

验证：`GET http://localhost:8000/health` 返回 `{"status": "ok"}`

---

## 三、联调阶段与执行步骤

### 阶段一：文档上传与解析（P0 优先级）

**涉及页面**：ContractUploadPage → ParsingProgressPage → FieldVerificationPage

**涉及接口**：

| 步骤 | 操作 | 接口 | 页面改动 |
|------|------|------|---------|
| 1-1 | 创建 API Client 基础设施 | - | 新建 `api/client.ts` |
| 1-2 | 替换文件上传 Mock | `POST /contracts/upload` | `ContractUploadPage.tsx` — 替换硬编码 mockSessionId，使用真实上传响应的 `session_id` 进行路由跳转 |
| 1-3 | 接入 SSE 事件流 | `GET /sessions/{id}/events` | `ParsingProgressPage.tsx` — 订阅 `state_changed` 事件，解析完成自动跳转 |
| 1-4 | 替换字段列表 Mock | `GET /sessions/{id}/fields` | `FieldVerificationPage.tsx` — 替换 `MOCK_FIELDS` 为真实 API 调用 |
| 1-5 | 接入字段核验提交 | `PATCH /sessions/{id}/fields/{field_id}` | `FieldVerificationPage.tsx` — confirm/modify/skip 操作调用真实 API |

**验证清单**：
- [ ] 上传 PDF 文件后获得真实 `contract_id` + `session_id`
- [ ] 页面跳转到 `/contracts/{session_id}/parsing`
- [ ] SSE 连接成功建立，收到 `connected` 事件
- [ ] 解析完成后收到 `state_changed` 事件并自动跳转
- [ ] 字段列表从后端加载，置信度颜色正确显示
- [ ] 字段核验提交后状态更新

---

### 阶段二：合同列表与会话状态（P0/P3 优先级）

**涉及页面**：DashboardPage, ContractListPage

**涉及接口**：

| 步骤 | 操作 | 接口 | 页面改动 |
|------|------|------|---------|
| 2-1 | 替换合同列表 Mock | `GET /contracts` | `ContractListPage.tsx` — 替换 `MOCK_CONTRACTS` |
| 2-2 | 替换仪表盘 Mock | `GET /contracts` | `DashboardPage.tsx` — 替换 `MOCK_CONTRACTS` |
| 2-3 | 接入会话状态查询 | `GET /sessions/{id}` | 工作流状态条 `WorkflowStatusBar.tsx`（如使用 session 数据） |

**验证清单**：
- [ ] 合同列表从后端加载，包含正确的 session state
- [ ] 仪表盘统计数据来自真实合同数据
- [ ] 点击合同行能正确跳转到对应审核阶段页面

---

### 阶段三：AI 扫描与 HITL 审批（P0/P1 优先级）

**涉及页面**：AIScanningPage → HITLReviewPage

**涉及接口**：

| 步骤 | 操作 | 接口 | 页面改动 |
|------|------|------|---------|
| 3-1 | 接入扫描进度 SSE | `GET /sessions/{id}/events` | `AIScanningPage.tsx` — 订阅 `scan_progress` + 路由事件 |
| 3-2 | 替换审核条款列表 Mock | `GET /sessions/{id}/items` | `HITLReviewPage.tsx` — 替换 `MOCK_REVIEW_ITEMS` |
| 3-3 | 接入 HITL 决策提交 | `POST /sessions/{id}/items/{item_id}/decision` | `HITLReviewPage.tsx` — Approve/Edit/Reject 调用真实 API |
| 3-4 | 接入决策撤销 | `DELETE /sessions/{id}/items/{item_id}/decision` | `HITLReviewPage.tsx` |
| 3-5 | 接入 SSE 决策反馈 | `item_decision_saved` 事件 | `HITLReviewPage.tsx` — 更新进度条 |

**验证清单**：
- [ ] 审核条款列表从后端加载，风险等级/来源标签颜色正确
- [ ] Approve 操作：填写 human_note ≥ 10 字 → 二次确认 → 提交成功
- [ ] human_note < 10 字时后端返回 422 错误，前端展示错误提示
- [ ] 撤销决策后条款回到 pending 状态
- [ ] 所有高风险条款决策完毕后自动触发报告生成

---

### 阶段四：批量复核（P3 优先级）

**涉及页面**：BatchReviewPage

**涉及接口**：

| 步骤 | 操作 | 接口 | 页面改动 |
|------|------|------|---------|
| 4-1 | 替换批量复核列表 Mock | `GET /sessions/{id}/items?risk_level=MEDIUM` | `BatchReviewPage.tsx` — 替换 `MOCK_BATCH_ITEMS` |
| 4-2 | 接入批量确认提交 | `POST /sessions/{id}/items/batch-confirm` | `BatchReviewPage.tsx` |

**验证清单**：
- [ ] 仅展示中风险条款
- [ ] 批量确认提交成功后更新状态

---

### 阶段五：报告生成与下载（P2 优先级）

**涉及页面**：ReportPage

**涉及接口**：

| 步骤 | 操作 | 接口 | 页面改动 |
|------|------|------|---------|
| 5-1 | 替换报告数据 Mock | `GET /sessions/{id}/report` | `ReportPage.tsx` — 替换 `MOCK_REPORT` |
| 5-2 | 替换已决策条款 Mock | `GET /sessions/{id}/items?human_decision=approve,edit,reject` | `ReportPage.tsx` — 替换 `MOCK_REVIEW_ITEMS` |
| 5-3 | 接入报告下载 | `GET /sessions/{id}/report/download?format=pdf` | `ReportPage.tsx` |

**验证清单**：
- [ ] 报告内容从后端加载
- [ ] 设计红线字段必须展示：coverage_statement、disclaimer、conclusion
- [ ] 下载按钮触发真实文件下载

---

### 阶段六：管理后台（标注为"未开发"）

**涉及页面**：AdminPage

**现状**：AdminPage 使用页面内硬编码的 Mock 数据（用户列表、规则列表）。后端 **无对应 API 实现**（无用户管理接口、无规则管理接口）。

**处理方式**：在 AdminPage 页面顶部添加醒目的 **"未开发"** 标注提示，保留现有 Mock 展示作为 UI 参考，不进行 API 接入。

---

## 四、接口集成测试矩阵

每个接口接入后需逐一执行以下测试：

### 4.1 正向测试（Happy Path）

| 接口 | 测试场景 | 预期结果 |
|------|---------|---------|
| `POST /contracts/upload` | 上传有效 PDF（< 50MB） | 201，返回 contract_id + session_id |
| `GET /contracts` | 无参请求 | 200，返回合同列表 |
| `GET /sessions/{id}` | 有效 session_id | 200，包含 state + progress_summary |
| `GET /sessions/{id}/fields` | 解析完成的 session | 200，返回字段列表 |
| `PATCH /sessions/{id}/fields/{fid}` | 提交 confirm 核验 | 200，verification_status 更新 |
| `GET /sessions/{id}/items` | 有效 session | 200，返回条款列表含 risk_evidence |
| `POST /sessions/{id}/items/{iid}/decision` | approve + note ≥ 10 字 | 201，决策保存成功 |
| `DELETE /sessions/{id}/items/{iid}/decision` | hitl_pending 状态下撤销 | 200，回到 pending |
| `POST /sessions/{id}/items/batch-confirm` | 中风险条款批量确认 | 200 |
| `GET /sessions/{id}/report` | completed/report_ready 状态 | 200，含报告内容 |
| `GET /sessions/{id}/report/download` | 报告已生成 | 文件下载响应 |
| `GET /sessions/{id}/events` | SSE 连接 | 收到 connected 事件 |

### 4.2 异常测试（Error Path）

| 接口 | 测试场景 | 预期错误 |
|------|---------|---------|
| `POST /contracts/upload` | 上传非 PDF/DOCX 文件 | 400 `INVALID_FILE_TYPE` |
| `POST /contracts/upload` | 上传超过 50MB 文件 | 413 `FILE_TOO_LARGE` |
| `GET /sessions/{bad_id}` | 不存在的 session_id | 404 `NOT_FOUND` |
| `POST .../decision` | human_note < 10 字 + HIGH risk | 422 `HUMAN_NOTE_TOO_SHORT` |
| `POST .../decision` | 非 hitl_pending 状态提交 | 409 `SESSION_STATE_CONFLICT` |
| `DELETE .../decision` | completed 状态撤销 | 409 `SESSION_STATE_CONFLICT` |
| `POST .../abort` | 已 aborted 的会话 | 409 `SESSION_STATE_CONFLICT` |

---

## 五、联调执行顺序总览

```
准备工作
  └─ 创建 frontend/src/app/api/ 目录 + API Client 基础设施

阶段一：上传文档（核心入口）
  ├─ 1-1  api/client.ts（基础 HTTP 封装）
  ├─ 1-2  ContractUploadPage → POST /contracts/upload
  ├─ 1-3  ParsingProgressPage → SSE /sessions/{id}/events
  ├─ 1-4  FieldVerificationPage → GET /sessions/{id}/fields
  └─ 1-5  FieldVerificationPage → PATCH /sessions/{id}/fields/{fid}
       └─ [接口测试] 上传 + 字段查询 + 字段核验

阶段二：合同列表
  ├─ 2-1  ContractListPage → GET /contracts
  ├─ 2-2  DashboardPage → GET /contracts
  └─ 2-3  WorkflowStatusBar → GET /sessions/{id}
       └─ [接口测试] 合同列表 + 会话详情

阶段三：HITL 审批（核心流程）
  ├─ 3-1  AIScanningPage → SSE scan_progress
  ├─ 3-2  HITLReviewPage → GET /sessions/{id}/items
  ├─ 3-3  HITLReviewPage → POST .../decision
  ├─ 3-4  HITLReviewPage → DELETE .../decision
  └─ 3-5  HITLReviewPage → SSE item_decision_saved
       └─ [接口测试] 条款列表 + 决策提交 + 撤销 + 异常校验

阶段四：批量复核
  ├─ 4-1  BatchReviewPage → GET /sessions/{id}/items?risk_level=MEDIUM
  └─ 4-2  BatchReviewPage → POST .../batch-confirm
       └─ [接口测试] 批量确认

阶段五：报告
  ├─ 5-1  ReportPage → GET /sessions/{id}/report
  ├─ 5-2  ReportPage → GET /sessions/{id}/items（已决策条款）
  └─ 5-3  ReportPage → GET .../report/download
       └─ [接口测试] 报告查询 + 下载

阶段六：管理后台
  └─ AdminPage → 标注"未开发"（后端无对应 API）
```

---

## 六、注意事项

1. **不伪造功能**：后端未实现的接口（如用户管理、规则管理），前端直接标注"未开发"
2. **认证简化**：当前后端使用 `X-User-ID` / `X-User-Role` Header 而非 JWT，前端 API Client 按此对接
3. **数据响应格式差异**：如发现后端返回格式与 API 规范不一致（如分页结构），在联调过程中记录差异，前端按后端实际返回适配
4. **SSE 断线重连**：前端 SSE 封装需包含自动重连逻辑
5. **逐步替换**：每个页面替换 Mock 后立即进行接口集成测试，确保该页面功能正常后再进入下一阶段
6. **Mock 数据保留**：`mock/data.ts` 文件暂不删除，作为后备参考；联调完成后统一清理

---

*本计划待确认后逐阶段执行。每个阶段完成后产出对应的联调测试记录。*
