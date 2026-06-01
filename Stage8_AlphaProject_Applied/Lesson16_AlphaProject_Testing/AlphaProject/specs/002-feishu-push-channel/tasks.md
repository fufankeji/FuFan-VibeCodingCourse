---
description: "Task list — 飞书机器人推送通道 (F6)"
---

# Tasks: 飞书机器人推送通道（002-feishu-push-channel）

**Input**: `specs/002-feishu-push-channel/{spec.md, plan.md}`
**约束**: 本轮只产出文档；以下任务供实现轮执行，不写代码。
**任务总数**: 15（落在 12-18 区间）
**格式**: `[ID] [P?] 描述` · 每条标 `[FR 来源]`、`[依赖]`、`[出参验证]`

> **[P]** = 可并行（不同文件、无依赖）。

---

## Phase 1 · Setup / Foundational（扩展 F5 已建后端）

- [x] **T001** 扩展 `backend/app/config.py`：增推送配置（`LARK_APP_ID`、`LARK_APP_SECRET`、`LARK_RECEIVE_ID`、`LARK_RECEIVE_ID_TYPE`、`MUTE_FLAG`、`RATE_LIMIT`（按 IM OpenAPI 口径，待核实）、`DEDUP_TTL=300`、`UNDELIVERED_MAX=200`），凭证从本地加密配置读取
  - [FR 来源] FR-003, FR-004, §2.4 · [依赖] F5 T001 · [出参验证] 配置可读取，app_secret 不出现在 git 跟踪文件

- [x] **T002** 扩展 `backend/app/db.py`：新增 `push_log`、`undelivered` 两表（与 watchlist 表零交叉）
  - [FR 来源] FR-009, FR-013 · [依赖] F5 T002 · [出参验证] 两表自动建立；写一条日志可读出

- [x] **T003** 建 `backend/app/models/push.py`：`PushRequest`（类型/内容/优先级/code/signal）、`PushLog`、`UndeliveredItem`
  - [FR 来源] §5 Key Entities · [依赖] T001 · [出参验证] 模型校验：priority ∈ {持仓,自选,系统}；缺字段报错

---

## Phase 2 · 流水线组件（push/，多为独立文件可并行）

- [x] **T004** [P] 建 `push/lark_client.py`：用 `lark-oapi` 构建 Client（app_id/app_secret）+ 封装 `im.v1.message.create`（receive_id/receive_id_type/msg_type/content/uuid）+ 失效判定（区分网络失败 vs 鉴权/权限错误）；token 刷新交给 SDK
  - [FR 来源] FR-001, FR-003, FR-012, FR-016 · [依赖] T001 · [出参验证] mock lark-oapi Client：发送构造正确；网络错→可重试标记；鉴权/权限错→失效标记；uuid 透传

- [x] **T005** [P] 建 `push/card_renderer.py`：text / interactive 卡片 content 渲染（IM API content 格式）+ 飞书禁用词兜底替换 + 超长截断加跳转链接
  - [FR 来源] FR-002, FR-014 · [依赖] T003 · [出参验证] text 与 interactive 各渲出合法 content；含禁用词→替换；超长→截断+链接

- [x] **T006** [P] 建 `push/dedup.py`：`code+signal` 键 5 分钟 TTL 去重；`priority==持仓` 直接放行；为每次实际发送生成 uuid 幂等键
  - [FR 来源] FR-006, FR-007, FR-016 · [依赖] T001 · [出参验证] 同键 5min 内第二次返回"去重"；不同 signal 放行；持仓放行；同一逻辑消息重试复用同 uuid

- [x] **T007** 建 `push/rate_limiter.py`：滑动窗口令牌桶（70/min）+ 接近上限时转合并队列（≤10 股/卡）
  - [FR 来源] FR-004, FR-005 · [依赖] T001 · [出参验证] 灌 25 条→合并 ≤3 卡且不超 70/min；余量足→单条直发

- [x] **T008** 建 `push/retry_queue.py` 重试部分：对网络失败 / SDK 频控错误按 30s/90s 重试（共 3 次，复用同 uuid），耗尽入 `undelivered` 表
  - [FR 来源] FR-008, FR-009, FR-016 · [依赖] T002, T004 · [出参验证] mock 连续失败→两次重试时序正确且 uuid 不变→第 3 次后入未送达表

- [x] **T009** `push/retry_queue.py` 回放部分：webhook 恢复后回放未送达（过多则汇总）+ 启动即检查队列
  - [FR 来源] FR-010 · [依赖] T008 · [出参验证] 队列有积压且发送成功→自动补发；启动时检查并回放

- [x] **T010** `push/retry_queue.py` 溢出策略：未送达队列满 200 条时丢弃最旧**非持仓**消息，持仓优先保留 + 汇总提示
  - [FR 来源] Edge Cases · [依赖] T008 · [出参验证] 灌 > 200 条→非持仓被淘汰，持仓全保留

---

## Phase 3 · 统一入口编排

- [x] **T011** 建 `backend/app/services/push_service.py`：`send(PushRequest)` 串起 静音→dedup→限频/合并→渲染→发送→失败入重试→写日志
  - [FR 来源] FR-001, FR-015 · [依赖] T004, T005, T006, T007, T008 · [出参验证] happy-path 送达并记日志；各分支（静音/去重/合并/失败）路由正确

- [x] **T012** `push_service` 全局静音：静音开关开启时不发送但记日志（静音态）
  - [FR 来源] FR-011 · [依赖] T011 · [出参验证] 静音 ON→上游提交不发飞书，日志记"静音"

- [x] **T013** `push_service` + `lark_client` 连接失效处理：连续 N 次鉴权/权限错误→暂停推送+置失效状态；启动时做一次轻量鉴权探测自检（缺 app_secret/scope/机器人未入会话则明确提示）
  - [FR 来源] FR-012 · [依赖] T004, T011 · [出参验证] 连续鉴权失败→暂停；启动自检能区分提示缺哪一步；状态可被 push_status 读取

---

## Phase 4 · 对外状态接口

- [x] **T014** 建 `backend/app/api/push_status.py`：向 Dashboard 暴露未送达数 / webhook 状态 / 静音态
  - [FR 来源] §6 集成边界 · [依赖] T011 · [出参验证] `GET /push/status` 返回 {undelivered_count, webhook_ok, muted}

---

## Phase 5 · 测试

- [x] **T015** 建 `backend/tests/test_push.py`：限频/合并/去重/持仓绕过/重试/未送达回放/静音/uuid 幂等 单测（mock `lark-oapi` Client）
  - [FR 来源] 全部 FR · [依赖] T011-T014 · [出参验证] 所有用例通过；覆盖 SC-002/003/004/005 场景

---

## 依赖与并行执行说明

### 串行主链
`T001 → T002/T003 → {T004,T005,T006 并行} → T007 → T008 → T009/T010 → T011 → T012/T013 → T014 → T015`

### 并行组
- **并行组 A**：`T004`（lark_client）、`T005`（card_renderer）、`T006`（dedup）三者独立文件 [P]
- **并行组 B**：`T009`、`T010` 同属 retry_queue 但逻辑独立，可分别实现后合并
- **并行组 C**：`T012`、`T013` 都改 push_service，建议串行（同文件）

### MVP 最小可用切片（US1+US2+US3）
`T001-T005 + T007 + T008 + T011` = 送达 + 限频合并 + 重试。dedup（T006）属 US4（P2）、静音/失效（T012/T013）属 US5（P2）可后补。

---

## 外部前置（飞书开放平台，实现前用户一次性配置）

- 创建企业自建 Lark App → 开通机器人能力 → 申请 IM 发消息 scope（如 `im:message:send_as_bot`）→ 把机器人加入目标群/单聊 → 取得 `app_id` / `app_secret` / 目标会话 `receive_id`，填入本地加密配置（T001 读取）。

## Notes

- 本轮 **不写代码**；以上为实现轮清单。
- 测试内联到各任务 `[出参验证]`，未单列 TDD（遵循本轮约束）。
- ⚠️ **R-1 红线**：push/ 全部独立实现，仅参考 go-stock 设计思路，禁止 copy 其 GPLv3 代码。
- ✅ **飞书接入决议（2026-05-20）**：源码调研 larksuite/cli 后，用户选定「完整 Lark App + 官方 Python SDK `lark-oapi`」，非 Go CLI、非自定义机器人 webhook。鉴权走 app_id/app_secret→SDK 托管 token，发消息走 `im.v1.message.create`。
- ✅ **静音范围**：用户确认 A 全静音（含持仓），T012 按此实现。
