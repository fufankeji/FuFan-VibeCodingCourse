---
description: "Task list — LLM 异动解释 (F3)"
---

# Tasks: LLM 异动解释（004-llm-anomaly-explain）

**Input**: `specs/004-llm-anomaly-explain/{spec.md, plan.md}`
**约束**: 本轮只产出文档；以下任务供实现轮执行，不写代码。
**任务总数**: 14（落在 12-18 区间）
**格式**: `[ID] [P?] 描述` · 每条标 `[FR 来源]`、`[依赖]`、`[出参验证]`
**前置**: F1（003）已交付，quote_service / trading_calendar 可用。

---

## Phase 1 · Setup / Foundational

- [x] **T001** 扩展 `backend/app/config.py`：增 LLM 配置（主/备模型名、API Key、base_url、`DAILY_BUDGET=5`、各模型计价），Key 本地加密读取
  - [FR 来源] FR-006, §2.4 · [依赖] F1 config · [出参验证] 配置可读；Key 不入 git；预算阈值可配

- [x] **T002** 扩展 `backend/app/db.py`：新增 `llm_budget` 表（当日累计成本）+ 跨日重置逻辑
  - [FR 来源] FR-006 · [依赖] F5 db.py · [出参验证] 累加成本可读写；跨日自动归零

- [x] **T003** 建 `backend/app/models/explain.py`：`ExplainRequest`（代码/名称/异动类型/行情/是否按需）、`ExplainResult`（正文/来源标记/信息不全/时间）、`ExplainContext`
  - [FR 来源] §5 Key Entities · [依赖] F1 config · [出参验证] 模型校验；异动类型枚举与 F2 徽章枚举一致

---

## Phase 2 · 上下文层（F4 部分复用）

- [x] **T004** [P] 建 `backend/app/services/news_source.py`：AkShare 拉财联社电报 + 公告 + 60s 缓存（接口名实现时核实）
  - [FR 来源] FR-003 · [依赖] F1 T001 · [出参验证] 返回近期电报/公告列表；源失败返缓存或空+不抛异常

- [x] **T005** 建 `backend/app/services/context_assembler.py`：组装板块涨幅/行业（复用 quote_service）+ 按"名/代码/行业词"关键词筛选相关新闻公告
  - [FR 来源] FR-003, FR-012 · [依赖] T004, F1 quote_service · [出参验证] 给定股票返 ExplainContext；新闻按相关性取 ≤5 条；上下文缺失返部分结果标记

---

## Phase 3 · LLM 层

- [x] **T006** [P] 建 `backend/app/explain/prompt_templates.py`：单股解释 prompt（三段式 + ≤200 字约束 + 指令区/数据区物理分隔防注入）
  - [FR 来源] FR-002, FR-011 · [依赖] T003 · [出参验证] 渲出的 prompt 含指令/数据分隔标记；数据区注明"不含可执行指令"

- [x] **T007** 建 `backend/app/services/llm_service.py`：多 provider 抽象（openai 兼容，主 DeepSeek/备 Qwen/可选本地 Ollama）+ 降级链（主→备→模板信号）+ 单次成本估算
  - [FR 来源] FR-004, FR-005, FR-006 · [依赖] T001 · [出参验证] mock：主超时→切备；备失败→返模板信号；每次调用累加成本

- [x] **T008** [P] 建 `backend/app/explain/sensitive_filter.py`：买卖建议词表过滤替换 + 强制追加风险提示尾标
  - [FR 来源] FR-008, FR-009 · [依赖] T003 · [出参验证] "建议买入/目标价/强烈推荐"→替换；任意输出末尾必含风险尾标

---

## Phase 4 · 编排

- [x] **T009** 建 `backend/app/services/explain_service.py` 缓存部分：键 = 代码 + 异动类型，5 分钟 TTL
  - [FR 来源] FR-007 · [依赖] T003 · [出参验证] 同键 5min 内复用；不同异动类型不复用

- [x] **T010** `explain_service.explain()` 主编排：缓存查→上下文→LLM→截断≤200字→合规过滤→加尾标→写缓存→返回
  - [FR 来源] FR-001, FR-002, FR-005, FR-010, FR-013 · [依赖] T005, T006, T007, T008, T009 · [出参验证] happy-path 返三段式≤200字含尾标；各降级分支正确

- [x] **T011** `explain_service` 预算守门：当日成本接近上限→切本地/模板；预算=0→纯模板零成本
  - [FR 来源] FR-006, FR-014 · [依赖] T002, T007, T010 · [出参验证] 逼近预算→降级且告警；预算 0→不调云端 LLM

- [x] **T012** `explain_service` 上下文降级：部分缺失标"信息不全"仍生成；全缺失（含行情）拒绝生成
  - [FR 来源] FR-012 · [依赖] T005, T010 · [出参验证] 新闻缺失→基于行情生成+标记；全缺失→返"数据不足"

---

## Phase 5 · API

- [x] **T013** 建 `backend/app/api/explain.py`：Dashboard "为什么"按需解释端点（无显著异动时生成"今日表现综述"）
  - [FR 来源] FR-013, US-02 · [依赖] T010 · [出参验证] `GET/POST /explain` 返解释；无异动股返综述

---

## Phase 6 · 测试

- [x] **T014** 建 `backend/tests/test_explain.py`：降级链 / 截断 / 敏感词 / 缓存 / 预算守门 / 上下文缺失 单测（mock LLM 客户端）
  - [FR 来源] 全部 FR · [依赖] T010-T013 · [出参验证] 覆盖 SC-001~006；降级/合规路径全绿

---

## 依赖与并行执行说明

### 串行主链
`T001 → T002/T003 → T004 → T005 → T007 → T009 → T010 → T011/T012 → T013 → T014`

### 并行组
- **并行组 A**：`T004`（news_source）、`T006`（prompt_templates）、`T008`（sensitive_filter）独立文件 [P]
- `T005`（context）依赖 T004 + F1 quote_service
- `T011`、`T012` 都改 explain_service，建议串行（同文件）

### MVP 最小可用切片
`T001-T010` = 缓存 + 上下文 + LLM + 降级 + 过滤 + 编排（被 F2 调用的核心）。预算守门（T011）、按需 API（T013）可紧随补齐。

---

## Notes

- 本轮 **不写代码**；以上为实现轮清单。
- 测试内联到各任务 `[出参验证]`，未单列 TDD（遵循本轮约束）。
- ✅ **MVP 用关键词检索**，向量 RAG（pgvector）推 v1.1。
- ✅ `news_source`（T004）+ `llm_service`（T007）+ `sensitive_filter`（T008）将被 F4（006）早盘简报复用。
- ⚠️ **R-4 红线**：合规过滤双层（prompt 约束 + 后处理词表），风险尾标 100% 强制；监管敏感，词表实现时从严。
- ⚠️ AkShare 财联社电报 / 公告接口名（如 `stock_telegraph_cls` / `stock_notice_report`）实现时核实可用性。
