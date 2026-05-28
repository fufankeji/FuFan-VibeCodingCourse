---
description: "Task list — 自选股管理 CRUD (F5)"
---

# Tasks: 自选股管理 CRUD（001-watchlist-crud）

**Input**: `specs/001-watchlist-crud/{spec.md, plan.md}`
**约束**: 本轮只产出文档；以下任务供后续实现轮执行，不在本轮写代码。
**任务总数**: 17（落在 12-18 区间）
**格式**: `[ID] [类型] [P?] 描述` · 每条标 `[FR 来源]`、`[依赖]`、`[出参验证]`
**类型**: `[FE]` 前端 / `[BE]` 后端 / `[INT]` 集成契约
**FE 任务额外标注**: ①引用的 DESIGN.md 章节 ②参考的 HTML 文件 ③用的 shadcn 组件

> **[P]** = 可并行（不同文件、无依赖）。[FE] 与 [BE] 任务多数可并行（前端依赖后端契约即可 stub）。
> 设计真理来源 `DESIGN.md`；视觉参考 `design-reference/stitch-export/dashboard_a_ai/code.html`。

---

## Phase 1 · Setup / Foundational（共享后端骨架，阻塞所有 US）

- [ ] **T001** `[BE]` 建 `backend/app/{main.py, config.py}`：FastAPI 应用入口 + 配置（上限常量 `MAX_WATCHLIST=30 / MAX_HOLDING=5 / MAX_GROUP=5`、SQLite 路径）
  - [FR 来源] §2.3 MVP 约束 · [依赖] 无 · [出参验证] `uvicorn` 能起服务，`GET /health` 返回 200

- [ ] **T002** `[BE]` [P] 建 `backend/app/db.py`：SQLite 连接 + 初始化建表（watchlist_item、group）+ 启动时损坏校验钩子
  - [FR 来源] FR-010, FR-013 · [依赖] T001 · [出参验证] 首次启动自动建库，损坏文件触发降级日志

- [ ] **T003** `[BE]` 建 `backend/app/models/watchlist.py`：`WatchlistItem` / `Group` Pydantic + 领域模型（代码/名称/分组/持仓/顺序/加入时间）
  - [FR 来源] §5 Key Entities · [依赖] T001 · [出参验证] 模型实例化 + 字段校验单测通过

- [ ] **T004** `[BE]` 建 `backend/app/repositories/watchlist_repo.py`：持久化出入口（基础 CRUD 读写，唯一接触 SQLite 的层）
  - [FR 来源] FR-010 · [依赖] T002, T003 · [出参验证] 写入一条→读出一条字段一致；重启后仍在

---

## Phase 2 · 全市场检索（US1 前置）

- [ ] **T005** `[BE]` [P] 建 `backend/app/services/stock_basic_service.py`：AkShare 拉全市场代码↔名称 + 本地缓存（每日刷新，缓存时用 pypinyin 预计算拼音首字母索引）+ 检索（代码精确/前缀、名称包含、拼音首字母）
  - [FR 来源] FR-001, FR-014 · [依赖] T001 · [出参验证] 输入"600519"→返回"贵州茅台"；输入"贵州"→名称包含匹配；输入"gzmt"→拼音首字母匹配贵州茅台；源不可用→返回缓存且不抛错

---

## Phase 3 · US1 新增自选股（P1）🎯 MVP

- [ ] **T006** `[BE]` `watchlist_service.add()`：去重校验 + 30 只总量上限 + 5 只持仓上限校验 + 写入
  - [FR 来源] FR-002, FR-003, FR-004, FR-005 · [依赖] T004 · [出参验证] 第 31 只被拒；第 6 个持仓标记被拒；重复加被拒；正常加入返回新条目

---

## Phase 4 · US2 删除自选股（P1）🎯 MVP

- [ ] **T007** `[BE]` `watchlist_service.remove()`：软删除标记 + 清空该股待推送队列（占位接口，F2 落地后接实）
  - [FR 来源] FR-006, FR-007 · [依赖] T004 · [出参验证] 删除后全量读取不含该股；待推送队列被清空（占位返回空）

- [ ] **T008** `[BE]` `watchlist_service` 撤销逻辑：30 秒内 `undo()` 清除软删除标记；超时定时任务物理清理
  - [FR 来源] FR-006 · [依赖] T007 · [出参验证] 删除后 30 秒内 undo→恢复原分组/持仓；超时后 undo 失败 + 物理删除

- [ ] **T009** `[INT]` 建 `backend/app/events/watchlist_events.py`：删除事件契约 `{action:"removed", code:str}`（仅定义 payload + 广播接口，F2/005 订阅）
  - [FR 来源] FR-007 · [依赖] T007 · [出参验证] 删除触发一次事件广播，payload schema 校验通过；契约与 F2 spec 对齐

---

## Phase 5 · US3 修改分组 / 持仓 / 排序（P2）

- [ ] **T010** `[BE]` `watchlist_service.update()`：改持仓标记（≤5 校验）+ 改分组归属 + 改显示顺序
  - [FR 来源] FR-008 · [依赖] T004 · [出参验证] 观察股切持仓成功；持仓满 5 时切换被拒；顺序变更持久化

- [ ] **T011** `[BE]` `watchlist_service` 分组管理：创建/重命名/删除自定义分组（≤5 上限校验）
  - [FR 来源] FR-009 · [依赖] T004 · [出参验证] 第 6 个分组被拒；删除分组时其下股票回落默认分组

---

## Phase 6 · 对外读取 + 持久化保障（被 F1/F4 消费）

- [ ] **T012** `[INT]` `watchlist_repo` 全量快照读取：返回完整清单（代码/名称/分组/持仓/顺序），供 F1（003）/F4（006）消费
  - [FR 来源] FR-012 · [依赖] T004 · [出参验证] 返回结构含全部字段；空清单返回空集合不报错；契约稳定供下游

- [ ] **T013** `[BE]` `db.py` 每日备份任务 + 损坏降级恢复（备份→重置兜底）
  - [FR 来源] FR-011, FR-013 · [依赖] T002 · [出参验证] 触发备份生成快照文件；删库后启动自动从备份恢复

---

## Phase 7 · API 路由（前后端契约）

- [ ] **T014** `[INT]` 建 `backend/app/api/watchlist.py`：REST 路由挂载（增 `POST` / 删 `DELETE` / 改 `PATCH` / 查 `GET` / 撤销 `POST :undo` / 检索 `GET :search`）
  - [FR 来源] FR-001~FR-012 · [依赖] T006, T007, T008, T010, T011, T012 · [出参验证] 各端点 happy-path + 上限拒绝路径返回正确状态码与提示；契约即前端 sdk 对接面

---

## Phase 8 · 前端（自主构建，与后端并行）

- [ ] **T015** `[FE]` [P] 新建 `frontend/src/services/sdk.ts`：API client 层，fetch 本地 backend REST 端点（自建，不 copy SD）
  - [FR 来源] §6 集成边界 · [依赖] T014（契约即可 stub） · [出参验证] sdk 调用命中本地 backend，返回清单
  - ① DESIGN.md：N/A（数据层，无视觉） · ② 参考 HTML：N/A · ③ shadcn：N/A

- [ ] **T016** `[FE]` [P] 新建 `frontend/src/pages/Watchlist.tsx` + `components/watchlist/`：管理抽屉（搜索加股/分组/持仓切换/删除）+ 30 秒撤销 toast，自主构建、全部用 DESIGN.md token
  - [FR 来源] US1, US2, US3 · [依赖] T015 · [出参验证] UI 完成加/删/改三流程；删后出现撤销 toast；视觉**对照** 参考 HTML（看不抄）、取值全来自 token
  - ① DESIGN.md：§Components（Stock Cards / Status Badges）、§Shapes（Inputs/Buttons 4px）、§Elevation & Depth（Level 3 侧抽屉）、§Typography（table-data/mono-label）
  - ② 参考 HTML（仅视觉参考）：`design-reference/stitch-export/dashboard_a_ai/code.html`（Drawer「Manage Stock」段 + Search to Add + 600519 卡片 + Untag/Remove）
  - ③ shadcn：`Sheet`（ManageDrawer）/ `Command`+`Input`（StockSearchInput）/ `Card`（StockCard）/ `Badge`（StatusBadge）/ `Button`（ActionButton）/ `Sonner`（UndoToast）/ `Select`（GroupSelect）

- [ ] **T017** `[FE]` [P] 新建 `frontend/src/store/watchlistStore.ts`：自选清单前端状态（含上限提示态）
  - [FR 来源] FR-003, FR-004, FR-009 · [依赖] T015 · [出参验证] 达上限时 store 暴露禁用态，UI 给提示
  - ① DESIGN.md：N/A（状态层，无视觉） · ② 参考 HTML：N/A · ③ shadcn：N/A（驱动 T016 组件态）

---

## 依赖与并行执行说明（按类型重评）

### 串行主链（[BE] 骨架）
`T001 → T002 → T003 → T004 → {T006, T007, T010, T011, T012}[BE] → T014[INT]`

### 并行组
- **并行组 A**（[BE] Phase 1 后）：`T002`、`T005` 可与 `T003` 并发（不同文件）
- **并行组 B**（[BE] service 层）：`T006 / T007 / T010 / T011 / T012` 同属 `watchlist_service`/`repo`，**建议串行**（同文件）；`T009`[INT]（events 独立文件）可与之并行
- **并行组 C**（[FE]）：`T015 / T016 / T017` 三者 [P]，**可与全部 [BE] 任务并行**（前端先按 T014 契约 stub，后端就绪后联调）
- `T008` 依赖 `T007`（撤销基于删除）；`T013` 依赖 `T002`（备份基于 db）

### FE / BE 并行说明
- [FE]（T015-T017）与 [BE]（T001-T013）**分属 frontend/ 与 backend/ 两目录，零文件冲突**，可全程并行开发
- 唯一同步点：[INT] T014 的 REST 契约 —— 前端按契约 stub 先行，契约确定后去 stub 联调

### MVP 最小可用切片
`[BE] T001-T008 + T012 + T014` + `[FE] T015-T016` = 新增 + 删除 + 撤销 + 对外读取 + 管理抽屉 UI（US1+US2 可独立验收）；US3（T010/T011）与备份（T013）可后补。

---

## Notes

- 本轮 **不写代码**；以上为实现轮的执行清单。
- 测试任务（单测）已内联到各任务的 `[出参验证]`，未单列 TDD 任务（遵循本轮"不跑 TDD"约束）。
- 所有任务遵守 PRD What/边界，技术细节以 `plan.md` 为准；前端视觉取值全部来自 `DESIGN.md`（宪法 FD-1）。
- 删除→停扫描的 F2 端订阅不在本 feature；T009 仅定义事件契约。
- 本次重跑变更：全任务加 [FE]/[BE]/[INT] 类型标；T016 补 DESIGN.md 章节 / 参考 HTML / shadcn 组件三项标注；并行组按 FE/BE 重评（FE 与 BE 全程可并行）。
