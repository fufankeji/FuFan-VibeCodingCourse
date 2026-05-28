---
description: "Task list — 自选股 Dashboard (F1, 方案 A 报价优先版)"
---

# Tasks: 自选股 Dashboard（003-watchlist-dashboard）

**Input**: `specs/003-watchlist-dashboard/{spec.md, plan.md}`
**约束**: 本轮只产出文档；以下任务供实现轮执行，不写代码。
**任务总数**: 16（落在 12-18 区间）
**格式**: `[ID] [类型] [P?] 描述` · 每条标 `[FR 来源]`、`[依赖]`、`[出参验证]`
**类型**: `[FE]` 前端 / `[BE]` 后端 / `[INT]` 集成契约
**FE 任务额外标注**: ①引用的 DESIGN.md 章节 ②参考的 HTML 文件 ③用的 shadcn 组件
**前置**: F5（001）已交付，watchlist 读取接口可用；前端工程已由 F5 自建（同一工程）。

> **方案 A**：异动徽章不实现，仅预留展示位（T009 含徽章位），F2（005）落地后回填。
> **自主构建**：前端不 fork SD，基于 spec + `DESIGN.md` 自建；视觉照 `dashboard_a_ai` + `a_ai_1` 原型（看不抄）。

---

## Phase 1 · 后端行情服务（共享，F2/F4 部分复用）

- [ ] **T001** `[BE]` [P] 建 `backend/app/services/trading_calendar.py`：交易时段 / 交易日判定（AkShare 交易日历 + 本地缓存），判失败时保守降级
  - [FR 来源] FR-011 · [依赖] F5 T001 · [出参验证] 交易日 9:30-15:00 返回"交易中"；周末/节假日返回"非交易"；日历拉取失败返回"未知+时间戳"

- [ ] **T002** `[BE]` 建 `backend/app/services/quote_service.py`：AkShare 拉自选股 spot 报价 + 指数 + 短缓存 + 陈旧判定（>120s 标陈旧）+ 失败降级（返上次值）
  - [FR 来源] FR-002, FR-004, FR-008, FR-012 · [依赖] T001 · [出参验证] 正常返报价；源失败返上次值+stale 标记；停牌股标"无数据"

- [ ] **T003** `[BE]` [P] 建 `backend/app/services/kline_service.py`：AkShare 拉历史日 K（近 1 年）+ 当日分时
  - [FR 来源] FR-007 · [依赖] F5 T001 · [出参验证] 输入代码→返回日 K 数组；失败返错误标记不抛异常

- [ ] **T004** `[BE]` 建 `backend/app/models/`（quote 相关）：`QuoteSnapshot` / `MarketIndex` / `KlinePoint`（含数据状态枚举：正常/停牌/无数据/陈旧）
  - [FR 来源] §5 Key Entities · [依赖] F5 T001 · [出参验证] 模型校验通过；数据状态枚举完整

- [ ] **T005** `[INT]` 建 `backend/app/api/quotes.py`：REST 路由（`GET 自选股报价快照`合并 F5 清单 / `GET 市场指数` / `GET 单股 K 线`）
  - [FR 来源] FR-001, FR-002, FR-004, FR-007 · [依赖] T002, T003, T004 · [出参验证] 报价端点返回 F5 清单×行情合并视图；指数端点返回三大指数；K 线端点返回数组；契约即前端 sdk 对接面

---

## Phase 2 · 前端数据层（自建工程）

- [ ] **T006** `[FE]` 扩展 `frontend/src/services/sdk.ts`：增行情快照 / 指数 / K 线 / （可选）push 状态端点
  - [FR 来源] §6 集成边界 · [依赖] T005（契约即可 stub） · [出参验证] sdk 调用命中后端各端点，返回结构正确
  - ① DESIGN.md：N/A（数据层，无视觉） · ② 参考 HTML：N/A · ③ shadcn：N/A

- [ ] **T007** `[FE]` 新建 `frontend/src/store/dashboardStore.ts`：F5 清单 × 行情合并为 DashboardRow + 60s 刷新计时 + 排序（持仓优先→涨跌幅→字母序）
  - [FR 来源] FR-001, FR-003, FR-005 · [依赖] T006 · [出参验证] 60s 自动刷新触发；持仓股排最前；手动刷新立即更新
  - ① DESIGN.md：N/A（状态层，无视觉） · ② 参考 HTML：N/A · ③ shadcn：N/A

---

## Phase 3 · 前端展示组件（自主构建，对照参考 HTML 看不抄）

- [ ] **T008** `[FE]` [P] 新建 `frontend/src/components/market-overview/`：顶部上证/深证/创业板指数概览栏（随 60s 刷新）
  - [FR 来源] FR-004 · [依赖] T007 · [出参验证] 显示三指数点位+涨跌幅；非交易时段标"收盘价"
  - ① DESIGN.md：§Components（指数卡）、§Colors（涨跌色）、§Typography（headline-sm/caption） · ② 参考 HTML：`dashboard_a_ai/code.html`（Top Market Bar 指数卡） · ③ shadcn：`Card`（横向滚动）

- [ ] **T009** `[FE]` [P] 新建 `frontend/src/components/quote-table/`：报价行（代码/名称/价/涨跌幅/量比/持仓标记/分组）+ 持仓置顶 + 停牌灰显 + **异动徽章位预留（暂空）**
  - [FR 来源] FR-005, FR-012, FR-015 · [依赖] T007 · [出参验证] 列渲染完整；停牌灰显不参与排序；徽章位存在但 F2 未就绪时不显示
  - ① DESIGN.md：§Components（Data Tables：zebra/1px 底边/即时 hover；Status Badges）、§Layout（密度）、§Typography（table-data/mono-label/table-header） · ② 参考 HTML：`dashboard_a_ai/code.html`（Data Grid + 持仓行 border-l-primary + 突破/量能异常 徽章） · ③ shadcn：`Table` + TanStack Table（虚拟/排序）+ `Badge`（徽章位）

- [ ] **T010** `[FE]` 新建 `frontend/src/pages/Dashboard.tsx`：组装列表 + 市场概览 + 分组筛选 + 空状态引导（跳 F5）+ 刷新按钮
  - [FR 来源] FR-001, FR-003, FR-006, FR-010 · [依赖] T008, T009 · [出参验证] 5 只自选 60s 内出报价；0 只显空状态+跳转；分组筛选生效
  - ① DESIGN.md：§Layout & Spacing（12 列网格/Sections/密度）、§Brand（信息密度优先） · ② 参考 HTML：`dashboard_a_ai/code.html`（整页布局 + Filter/Sort/Manage 控件 + Watchlist Overview） · ③ shadcn：`Button`（Filter/Sort/Manage）、`Select`（分组筛选）+ 组装 T008/T009

- [ ] **T011** `[FE]` [P] 新建 `frontend/src/components/charts/KlineChart.tsx`：TradingView Lightweight Charts 封装，严格管理实例创建/销毁
  - [FR 来源] FR-007 · [依赖] T006 · [出参验证] 渲染日 K；组件卸载调 remove() 无内存泄漏
  - ① DESIGN.md：§Components（图表区）、§Colors（涨跌色 K 线） · ② 参考 HTML：`a_ai_1/code.html`（Chart Canvas） · ③ shadcn：—（lightweight-charts 自封装，非 shadcn）

- [ ] **T012** `[FE]` 新建 `frontend/src/pages/StockDetail.tsx`：单股详情（K 线 + 基础行情）+ K 线失败降级
  - [FR 来源] FR-007 · [依赖] T011 · [出参验证] 点击单股进详情显 K 线+开高低收量；K 线失败显提示，基础行情仍在
  - ① DESIGN.md：§Typography（display-price 大字价）、§Layout · ② 参考 HTML：`a_ai_1/code.html`（NVDA display-price + tab 切换） · ③ shadcn：`Tabs` + `Card`

- [ ] **T013** `[FE]` [P] 新建 `frontend/src/components/push-status-bar/`：消费 F6 push_status（未送达数/连接/静音），F6 未就绪降级隐藏
  - [FR 来源] FR-014 · [依赖] T006 · [出参验证] 有未送达→显示"N 条未送达"；探测不到 F6→隐藏不报错
  - ① DESIGN.md：§Components（Budget Guard Banner 同款条幅）、§Colors（anomaly 警示色） · ② 参考 HTML：`ai_a_ai/code.html`（告警条参考） · ③ shadcn：`Alert`

---

## Phase 4 · 降级与响应式

- [ ] **T014** `[FE]` Dashboard 行情降级 UI：源持续失败 >5min 顶部红 banner + 单次失败显上次值+时间戳 + 前端离线重试
  - [FR 来源] FR-008, FR-009 · [依赖] T010 · [出参验证] mock 源失败：>5min 出 banner；单次失败展示陈旧值不崩溃；断网显离线提示
  - ① DESIGN.md：§Components（Budget Guard Banner 同款）、§Colors（error/anomaly） · ② 参考 HTML：`dashboard_a_ai/code.html`（顶部 banner 位） · ③ shadcn：`Alert`/`Banner`

- [ ] **T015** `[FE]` [P] 响应式适配：移动端窄屏列表转紧凑卡片，关键字段（名称/价/涨跌幅）优先，隐藏次要列（量比/振幅）
  - [FR 来源] FR-013 · [依赖] T010 · [出参验证] 窄屏视口下关键字段不溢出可读
  - ① DESIGN.md：§Layout & Spacing（Breakpoints / Mobile：隐次要列、紧凑卡片）（落地 FD-8） · ② 参考 HTML：`dashboard_a_ai/code.html`（`md:` 响应式类） · ③ shadcn：—（Tailwind 响应式 utility）

---

## Phase 5 · 测试

- [ ] **T016** `[BE]` 建 `backend/tests/test_quotes.py`：报价拉取 / 指数 / 降级 / 陈旧判定 / 交易日历 单测
  - [FR 来源] FR-002/004/008/011/012 · [依赖] T001-T005 · [出参验证] 覆盖 SC-001/003；降级路径全绿

---

## 依赖与并行执行说明（按类型重评）

### 串行主链
`[BE] T001 → T002 → T004 → T005[INT] → [FE] T006 → T007 → {T008/T009/T011/T013 并行} → T010 → T012 → T014`

### 并行组
- **并行组 A**（[BE]）：`T001`（calendar）、`T003`（kline）独立文件 [P]，与 `T002` 部分并行
- **并行组 B**（[FE] 组件）：`T008`（概览）、`T009`（报价表）、`T011`（K线）、`T013`（推送条）独立文件 [P]
- **并行组 C**：`T015`（响应式）可与 `T014` 并行

### FE / BE 并行说明
- [FE]（T006-T015）与 [BE]（T001-T004, T016）**分属 frontend/ 与 backend/ 两目录，零文件冲突**，可并行
- 唯一同步点：[INT] T005 的 REST 契约 —— 前端按契约 stub 先行，契约确定后联调

### MVP 最小可用切片（US1 + US2 报价优先）
`[BE] T001-T005 + [FE] T006-T010 + T014` = 列表报价 + 市场概览 + 排序 + 降级。详情页 K 线（US3：T011/T012）与推送条（US4：T013）属 P2 可后补。

---

## Notes

- 本轮 **不写代码**；以上为实现轮清单。
- 测试内联到各任务 `[出参验证]`，未单列 TDD（遵循本轮约束）。
- ✅ **方案 A**：异动徽章（T009 徽章位）保持空置，F2（005）落地后回填 badge 枚举（空/涨停/跌停/涵盖/突破/量能）。
- ✅ **自主构建**：前端不 fork SD，全部新建；`design-reference/`（dashboard_a_ai/a_ai_1）仅视觉参考（看不抄）；视觉取值全来自 `DESIGN.md`（FD-1）。
- `trading_calendar`（T001）是公共能力，F2 扫描时段、F4 简报日判定均复用。
- K 线用 lightweight-charts（06 决议）。
- 本次重跑变更：全任务加 [FE]/[BE]/[INT] 类型标；FE 视觉任务补 DESIGN.md 章节 / 参考 HTML / shadcn 组件三项标注；前端从"改造 fork"改为"新建（自主构建）"；并行组按 FE/BE 重评。
