# 前后端联调测试结果

> 执行日期：2026-03-11

## 总览

| 阶段 | 状态 | 说明 |
|------|------|------|
| Stage 1: 上传/解析/字段 | PASS | 全部接口联通 |
| Stage 2: 合同列表 | PASS | 含 state 筛选 + 游标分页 |
| Stage 3: HITL 审核 | PASS (结构) | 接口格式正确，无测试数据 |
| Stage 4: 批量审核 | PASS (结构) | 接口格式正确，无测试数据 |
| Stage 5: 报告 | PASS (结构) | 接口格式正确，无测试数据 |
| Stage 6: 管理后台 | N/A | 标注"未开发" |

## Stage 1: 上传 → 解析 → 字段核对

### POST /contracts/upload
- **状态**: PASS
- **测试**: 上传有效 PDF → 返回 `contract_id`, `session_id`, `state: "parsing"`
- **错误路径**: 损坏 PDF → 返回 `CORRUPT_FILE` 错误码

### GET /sessions/{id}
- **状态**: PASS
- **返回**: `state`, `progress_summary`, `langgraph_thread_id` 等完整字段

### GET /sessions/{id}/recovery
- **状态**: PASS
- **返回**: `resumable`, `message` 等恢复信息

### POST /sessions/{id}/retry-parse
- **状态**: PASS
- **测试**: 非 parsing 状态调用 → 正确返回 `SESSION_STATE_INVALID`

### POST /sessions/{id}/abort
- **状态**: PASS
- **测试**: 成功将 session 状态变更为 `aborted`

### GET /sessions/{id}/events (SSE)
- **状态**: PASS
- **测试**: 成功建立连接，收到 `connected` 事件

### GET /sessions/{id}/fields
- **状态**: PASS
- **返回**: `{ items: [...], total: 5 }` 结构正确
- **字段结构**: `field_name`, `field_value`, `confidence_score`, `verification_status` 等

### PATCH /sessions/{id}/fields/{field_id}
- **状态**: PASS
- **测试**: 发送 `{ action, verified_value }` → 后端忽略 action，返回 `verification_status: "verified"`
- **注意**: 前端使用乐观更新显示 confirmed/modified/skipped 状态

## Stage 2: 合同列表

### GET /contracts
- **状态**: PASS
- **测试**: 返回所有合同，含 `session_id` + `session_state`（后端 join session 表）

### GET /contracts?state=scanning
- **状态**: PASS（本次修复）
- **修复**: 后端原未实现 state 参数，已添加 session state 筛选

### GET /contracts?limit=2 (游标分页)
- **状态**: PASS
- **测试**: `limit=2` → 返回 2 条 + `next_cursor`

### GET /contracts/{id}
- **状态**: PASS
- **返回**: 含 `session_id` + `session_state`

## Stage 3-5: HITL 审核 / 批量审核 / 报告

### GET /sessions/{id}/items
- **状态**: PASS (结构)
- **返回**: `{ items: [], total: 0, next_cursor: null }`
- **说明**: 当前无 review items 数据（测试 PDF 未产生扫描结果）

### GET /sessions/{id}/report
- **状态**: PASS (结构)
- **返回**: `NOT_FOUND`（无报告生成，预期行为）

## 发现的问题与修复

### 已修复

| 问题 | 修复 |
|------|------|
| ContractResponse 缺少 session_id/session_state | 添加字段到 schema + join 逻辑 |
| GET /contracts 不支持 state 筛选 | 添加 state 查询参数 + session join 筛选 |
| ReviewItem 后端扁平结构 vs 前端嵌套结构 | 前端 adapter 层 transformItem() 转换 |
| DecisionResponse 缺少 progress 字段 | 前端改为 optional chaining |
| BatchConfirmResponse 缺少 all_medium_risk_completed | 前端改为 optional |

### 已知限制（非阻塞）

| 限制 | 说明 |
|------|------|
| 字段核验状态单一 | 后端只返回 `verified`，不区分 confirmed/modified/skipped（前端乐观更新） |
| 关键字搜索未开发 | GET /contracts?keyword 后端未实现，前端本地过滤（已标注"未开发"） |
| 管理后台 API 未开发 | AdminPage 已标注"未开发" |
| 批量拒绝未开发 | BatchReviewPage 按钮已禁用并标注 |

## 前端构建验证

```
npm run build → SUCCESS (2.13s)
- 1635 modules transformed
- dist/assets/index-CXkFVVHn.js: 347.20 kB (gzip: 103.60 kB)
- dist/assets/index-DWUQr1lo.css: 105.70 kB (gzip: 17.19 kB)
- 0 TypeScript errors
```
