---
description: "Task list — 早盘简报 (F4)"
---

# Tasks: 早盘简报（006-morning-briefing）

**Input**: `specs/006-morning-briefing/{spec.md, plan.md}`
**约束**: 本轮只产出文档；以下任务供实现轮执行，不写代码。
**任务总数**: 15（落在 12-18 区间）
**格式**: `[ID] [P?] 描述` · 每条标 `[FR 来源]`、`[依赖]`、`[出参验证]`
**前置**: F3/F5/F6/F1 均已交付，各接口可用。

---

## Phase 1 · Setup / Foundational

- [x] **T001** 扩展 `backend/app/config.py`：增简报配置（触发 `09:15`、补发 `09:18`、正文上限 `1200`、历史保留 `30` 天）
  - [FR 来源] FR-001, FR-003, FR-011 · [依赖] F1 config · [出参验证] 配置可读

- [x] **T002** 扩展 `backend/app/db.py`：新增 `briefing_record` 表（日期/内容/版本/推送状态）
  - [FR 来源] FR-011 · [依赖] F5 db.py · [出参验证] 写一条简报可按日期读出

- [x] **T003** 建 `backend/app/models/briefing.py`：`BriefingContent`（4 区块+版本）/ `DataBlock`（数据+状态）/ `BriefingRecord`
  - [FR 来源] §5 Key Entities · [依赖] F1 config · [出参验证] 模型校验；版本枚举（预热/完整/裸数据/占位）完整

---

## Phase 2 · 数据源（可并行）

- [x] **T004** [P] 建 `backend/app/services/market_overview_source.py`：隔夜外盘指数（AkShare 全球指数）+ 昨收+板块涨跌幅（复用 F1 quote_service）
  - [FR 来源] FR-002 · [依赖] F1 quote_service · [出参验证] 返回外盘+昨收+板块 DataBlock；源失败返状态"暂无数据"

- [x] **T005** [P] 建 `backend/app/services/calendar_source.py`：今日财报披露 + 经济数据日历（AkShare，接口实现时核实）
  - [FR 来源] FR-002 · [依赖] F1 T001 · [出参验证] 返回今日日历 DataBlock；源失败返"暂无数据"

---

## Phase 3 · Prompt 与卡片（可并行）

- [x] **T006** [P] 建 `backend/app/briefing/briefing_prompt.py`：简报级 prompt（4 区块结构 + ≤1200 字约束，区别于 F3 单股解释 prompt）
  - [FR 来源] FR-003 · [依赖] T003 · [出参验证] 渲出 prompt 含 4 区块指引 + 字数约束

- [x] **T007** 建 `backend/app/briefing/card_builder.py`：4 区块 Markdown 卡片组装 + 区块降级（"数据获取中"/"暂无数据"）
  - [FR 来源] FR-004, FR-006 · [依赖] T003 · [出参验证] 4 区块齐全渲完整卡片；缺块渲降级占位；自选 0 只跳过该区块

---

## Phase 4 · 编排

- [x] **T008** 建 `backend/app/services/briefing_service.py` 拉取部分：并发拉 5 类 DataBlock（外盘/昨收板块/财联社/自选/日历），各源独立超时 + 失败标记
  - [FR 来源] FR-002, FR-006 · [依赖] T004, T005, F3 news_source, F5 watchlist · [出参验证] 5 类并发；单源超时不拖整体；失败源标状态

- [x] **T009** `briefing_service` 生成部分：组装 prompt → 调 F3 llm_service 生成 → 截断 ≤1200 字；LLM 超时 60s → 裸数据版
  - [FR 来源] FR-003, FR-008 · [依赖] T006, T008, F3 llm_service · [出参验证] 正常出 ≤1200 字正文；LLM 超时→裸数据版（结构化无 AI 提炼）

- [x] **T010** `briefing_service` 推送+归档：card_builder 渲染 → F3 sensitive_filter 加尾标 → F6 push（priority=系统，不带 dedup_key）→ 存 briefing_record
  - [FR 来源] FR-004, FR-005, FR-010, FR-011 · [依赖] T007, T009, F3 sensitive_filter, F6 push_service · [出参验证] 飞书收到 4 区块卡片含尾标；简报不被 dedup；历史存一条

- [x] **T011** `briefing_service` 降级策略：区块缺失跳过 / 自选 0 只跳自选区块 / 全数据源失败发占位简报
  - [FR 来源] FR-006, FR-009, FR-012 · [依赖] T008, T010 · [出参验证] 某源失败仍发；0 自选跳区块；全失败发"今日数据获取异常"占位

- [x] **T012** `briefing_service` 预热/补发：9:14:59 未集齐发预热版（已就绪区块）+ 9:18 补完整版（版本标注区分）
  - [FR 来源] FR-007 · [依赖] T010 · [出参验证] mock 慢源→9:15 预热版（标"预热版"）+ 9:18 完整版（标"完整版"）

---

## Phase 5 · 调度与 API

- [x] **T013** 调度注册：APScheduler（复用 F2/F6 实例）09:15 + 09:18 cron + F1 trading_calendar 工作日门控 + 每日清理 30 天前历史
  - [FR 来源] FR-001, FR-011 · [依赖] T010, F1 trading_calendar, F6 scheduler · [出参验证] 工作日 09:15 触发；周末/节假日跳过；超 30 天记录被清

- [x] **T014** 建 `backend/app/api/briefing.py`：简报历史回看端点（供 Dashboard，按日期列出 + 详情）
  - [FR 来源] FR-011 · [依赖] T002, T010 · [出参验证] `GET /briefing/history` 返 30 天内列表；`GET /briefing/{date}` 返详情

---

## Phase 6 · 测试

- [x] **T015** 建 `backend/tests/test_briefing.py`：区块降级 / 预热补发 / 节假日跳过 / 全失败占位 / 字数上限 / 尾标 单测（mock 数据源+F3+F6）
  - [FR 来源] 全部 FR · [依赖] T008-T014 · [出参验证] 覆盖 SC-001~006；降级/预热/节假日路径全绿

---

## 依赖与并行执行说明

### 串行主链
`T001 → T002/T003 → {T004/T005/T006 并行} → T007 → T008 → T009 → T010 → T011/T012 → T013 → T014 → T015`

### 并行组
- **并行组 A**（数据源 + prompt）：`T004`（外盘）、`T005`（日历）、`T006`（prompt）独立文件 [P]
- `T011`、`T012` 都改 briefing_service，建议串行（同文件）

### MVP 最小可用切片
`T001-T010 + T013` = 拉数据 + 生成 + 推送 + 调度（US1 准时简报可独立验收）。预热补发（T012）、历史 API（T014）、占位降级（T011）紧随补齐。

---

## Notes

- 本轮 **不写代码**；以上为实现轮清单。
- 测试内联到各任务 `[出参验证]`，未单列 TDD（遵循本轮约束）。
- ✅ **最大化复用 F3**：news_source（电报）+ llm_service（生成/降级/预算）+ sensitive_filter（尾标/禁词）全复用，F4 只写简报级 prompt + 卡片组装 + 编排。
- ✅ 简报 PushRequest 标 priority=系统、**不带 dedup_key**，F6 不去重（区别于异动推送）。
- ✅ 自选排序软依赖 F2 徽章：F2 就绪读徽章，未就绪按涨跌幅降级。
- ⚠️ **R-1**：9:15 准时性依赖 Mac 不睡眠（caffeinate）；未开机错过不补发。
- ⚠️ 外盘指数 / 财报经济日历 AkShare 接口名实现时核实可用性。
- ⚠️ 盘后/盘中简报推 v1.1；自定义模板推 v2。
