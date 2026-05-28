---
description: "Task list — 异动检测与推送 (F2)"
---

# Tasks: 异动检测与推送（005-anomaly-detection-push）

**Input**: `specs/005-anomaly-detection-push/{spec.md, plan.md}`
**约束**: 本轮只产出文档；以下任务供实现轮执行，不写代码。
**任务总数**: 16（落在 12-18 区间）
**格式**: `[ID] [P?] 描述` · 每条标 `[FR 来源]`、`[依赖]`、`[出参验证]`
**前置**: F5/F6/F3/F1 均已交付，各接口可用。

---

## Phase 1 · Setup / Foundational

- [ ] **T001** 扩展 `backend/app/config.py`：增异动阈值默认值（振幅 8% / 量比 3 倍 / 涵盖窗口 60 日 / 各板涨跌停 % 主板 10·创业科创 20·ST 5）
  - [FR 来源] FR-013, FR-004 · [依赖] F1 config · [出参验证] 阈值可读可覆盖

- [ ] **T002** 建 `backend/app/models/anomaly.py`：`AnomalyRule` / `AnomalySignal`（异动类型=F1 徽章枚举）/ `AnomalyState` / `RuleConfig`
  - [FR 来源] §5 Key Entities · [依赖] F1 config · [出参验证] 异动类型枚举与 F1 徽章 + F3 异动类型三方一致

- [ ] **T003** [P] 建 `backend/app/anomaly/rule_config.py`：规则类开关 + 阈值覆盖读写
  - [FR 来源] FR-008, FR-013 · [依赖] T001 · [出参验证] 关闭某规则后该规则不参与扫描

---

## Phase 2 · 规则引擎（纯函数，可并行）

- [ ] **T004** [P] `anomaly/price_rules.py` 涨停/跌停：按板块类型取阈值判定（主板/创业科创/ST）
  - [FR 来源] FR-001, FR-004 · [依赖] T002 · [出参验证] 茅台涨幅≥10%→涨停；ST 股≥5%→涨停；科创≥20%→涨停

- [ ] **T005** [P] `anomaly/price_rules.py` 涵盖：突破前 60 日新高 / 跌破新低（用 F1 kline_service，日级缓存）
  - [FR 来源] FR-001 · [依赖] T002, F1 kline_service · [出参验证] 现价 > 近 60 日最高→"涵盖/突破"；新股按实际天数

- [ ] **T006** [P] `anomaly/price_rules.py` 量能异常 + 振幅异常：量比 > 5 日均量×3；日内振幅 > 8%
  - [FR 来源] FR-001 · [依赖] T002 · [出参验证] 构造量比 3.5 倍→量能信号；振幅 9%→振幅信号

- [ ] **T007** 建 `backend/app/anomaly/event_rules.py`：复用 F3 news_source 取电报/公告，按 F5 清单"代码>全称>行业"匹配
  - [FR 来源] FR-002 · [依赖] T002, F3 news_source · [出参验证] 红色电报含自选股名→事件信号；同名公司误匹配可控

---

## Phase 3 · 状态与转换检测

- [ ] **T008** 建 `backend/app/anomaly/anomaly_state.py`：维护每股当前异动集合 + 本周期 vs 上周期差集 = 新异动
  - [FR 来源] FR-003 · [依赖] T002 · [出参验证] 持续涨停第二周期不报新；封板→打开→封回 第二次封报新

- [ ] **T009** `anomaly_state` 删除清理：订阅 F5 watchlist_events，删除股即时移出状态 + 扫描清单
  - [FR 来源] FR-010 · [依赖] T008, F5 watchlist_events · [出参验证] 删股后该股不再产生异动/推送

---

## Phase 4 · 扫描编排

- [ ] **T010** 建 `backend/app/services/anomaly_service.py` 扫描主体：读 F5 清单 → 读 F1 行情/K线 → 跑启用规则 → 转换检测 → 跳过停牌
  - [FR 来源] FR-001, FR-003, FR-012 · [依赖] T003-T008, F1 quote_service · [出参验证] 一周期产出新异动列表；停牌股跳过不误报

- [ ] **T011** `anomaly_service` 数据延迟保护：行情快照戳距今 > 5min → 暂停价格规则 + 告警（事件规则不受限）
  - [FR 来源] FR-009 · [依赖] T010 · [出参验证] mock 陈旧行情→价格规则暂停 + Dashboard 告警；事件规则照常

- [ ] **T012** `anomaly_service` 推送编排：优先级排队（持仓>自选）→ 对新异动并发调 F3 explain（超时裸卡片）→ 组装 PushRequest（priority+dedup_key）→ 调 F6 send；单股多规则合并一次
  - [FR 来源] FR-005, FR-006, FR-011, FR-014 · [依赖] T010, F3 explain_service, F6 push_service · [出参验证] 持仓优先；F3 超时→裸卡片；同股涨停+量能→一次推送多标签

- [ ] **T013** 调度注册：APScheduler 60s job（复用 F6 实例）+ F1 trading_calendar 门控（午休/非交易时段不扫价格）
  - [FR 来源] FR-001 · [依赖] T010, F6 scheduler, F1 trading_calendar · [出参验证] 交易时段每 60s 触发；午休/收盘后不扫价格规则

---

## Phase 5 · 对外接口

- [ ] **T014** 建 `backend/app/api/anomaly.py` 徽章接口：暴露每股当前异动徽章（枚举）供 F1 回填
  - [FR 来源] FR-007 · [依赖] T008 · [出参验证] `GET /anomaly/badges` 返 {code: badge}；与 anomaly_state 一致

- [ ] **T015** `api/anomaly.py` 规则开关接口：读写规则类开关 + 阈值
  - [FR 来源] FR-008 · [依赖] T003 · [出参验证] 关闭"量能"后扫描不产量能信号

---

## Phase 6 · 测试

- [ ] **T016** 建 `backend/tests/test_anomaly.py`：各规则函数 / 转换检测 / 优先级 / 延迟暂停 / 徽章一致 / 删除清理 单测（mock F1/F3/F6）
  - [FR 来源] 全部 FR · [依赖] T010-T015 · [出参验证] 覆盖 SC-001~006；转换检测无漏报无重报

---

## 依赖与并行执行说明

### 串行主链
`T001 → T002 → {T003-T008 多数并行} → T009 → T010 → T011/T012 → T013 → T014/T015 → T016`

### 并行组
- **并行组 A**（规则纯函数）：`T004`、`T005`、`T006`、`T007` 独立逻辑 [P]；`T003`（config）也可并行
- **并行组 B**（API）：`T014`、`T015` 可并行
- `T012`（推送编排）依赖规则 + 状态 + F3 + F6 全就位

### MVP 最小可用切片
`T001-T010 + T012 + T013` = 价格规则 + 转换检测 + 扫描 + 推送编排 + 调度（US1 可独立验收）。事件规则（T007）、徽章接口（T014）、规则开关（T015）紧随补齐。

---

## Notes

- 本轮 **不写代码**；以上为实现轮清单。
- 测试内联到各任务 `[出参验证]`，未单列 TDD（遵循本轮约束）。
- ✅ **两层去重职责**：F2 状态转换检测（T008，省 F3 调用）+ F6 发送级 dedup（兜底），互补不打架。
- ✅ **兑现方案 A**：T014 徽章接口让 F1（003）预留的徽章位亮起；枚举三方对齐（F1/F2/F3）。
- ⚠️ **R-1 红线**：状态转换检测是 F2 正确性核心，T016 必须覆盖封板/打开/多规则并发等转换场景。
- ⚠️ 涨跌停 MVP 用涨跌幅近似（无封单数据），一字板/封单精确判定推 v1.1。
- ⚠️ 板块整体异动推 v1.1；规则编辑器推 v2。
