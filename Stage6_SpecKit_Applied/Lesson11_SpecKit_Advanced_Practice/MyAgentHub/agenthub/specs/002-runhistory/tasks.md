---
description: "Task list for 002-runhistory feature implementation"
---

# Tasks: RunHistory 页（AI 调用历史与 Trace 瀑布图）

**Input**: [spec.md](./spec.md) + [plan.md](./plan.md)
**Branch**: `002-runhistory`

## Format: `[ID] [P?] [Story] Description (path · est.min · deps)`

- **[P]** = 可并行（不同文件、无未完成依赖）
- **[Story]** = US1 / US2 / US3
- **Priority**: P0 必须 / P1 应该 / P2 可选（每 Phase 开头标注）

## 已完成前置（不计入任务）

- ✅ `src/lib/schemas/runhistory.ts`（spanSchema / spanRowSchema / runSchema / 工具函数）
- ✅ `specs/002-runhistory/spec.md` + `plan.md`
- ✅ 宪法 v2.0.0 §0.3 作用域例外

---

## Phase 1: Setup · 环境与依赖（P0）

**Purpose**：安装 DB 依赖、配置环境变量、建表。

- [ ] T001 安装 `@libsql/client` + `drizzle-orm` + `drizzle-kit`（dev）：`pnpm add @libsql/client drizzle-orm && pnpm add -D drizzle-kit`（`package.json` · 5min · 无依赖）
- [ ] T002 [P] 在 `.env.local.example` 追加 `TURSO_DATABASE_URL=file:local.db` 与 `TURSO_AUTH_TOKEN=`（本地用 file: 方案无需 token）（`.env.local.example` · 5min · 无依赖）
- [ ] T003 [P] 在 `src/lib/env.ts` 的 `serverSchema` 追加 `TURSO_DATABASE_URL: z.string().min(1)` + `TURSO_AUTH_TOKEN: z.string().optional()`（`src/lib/env.ts` · 10min · 无依赖）
- [ ] T004 新建 `src/lib/db/client.ts`：`createClient({ url, authToken })` 单例 + `drizzle(client)` 导出；文件顶部注释标注"仅 §0.3 作用域，禁止在 playground/agent-run 等其他 route 引入"（`src/lib/db/client.ts` · 15min · T001 T002）
- [ ] T005 新建 `src/lib/db/schema.ts`：`runs` 表 + `spans` 表的 Drizzle table 定义，字段与 `runhistory.ts` 中 `runSchema` / `spanRowSchema` 一一对应（列名用 snake_case）（`src/lib/db/schema.ts` · 25min · T004）
- [ ] T006 配置 `drizzle.config.ts`（项目根）：指向 `src/lib/db/schema.ts`，output 目录 `src/lib/db/migrations`（`drizzle.config.ts` · 10min · T005）
- [ ] T007 运行 `pnpm drizzle-kit generate` → 检查产出 SQL → `pnpm drizzle-kit migrate`（本地 file:local.db）；确认 `runs` / `spans` 两表和全部索引创建成功（`src/lib/db/migrations/` · 20min · T006）

**Checkpoint**：`pnpm tsx -e "import './src/lib/db/client'; console.log('db ok')"` 无报错。

---

## Phase 2: Foundational · 数据读写层（P0）

**Purpose**：`writeRun` + 查询函数——US1 ~ US3 全部依赖，先完成。

**⚠️ CRITICAL**：US1 的列表和详情 API 依赖此 Phase，Phase 2 必须先于 Phase 3 完成。

- [ ] T008 新建 `src/lib/db/write-run.ts`：`writeRun(run: Run, rootSpan: Span): Promise<void>`；内部顺序：schema 校验 → flattenSpanTree → `db.insert(runs)` → `db.insert(spans).values(rows)`；catch 只 console.error 不 throw（宪法 §5.3 精神：写失败不阻塞 Playground）（`src/lib/db/write-run.ts` · 35min · T005 T007）
- [ ] T009 [P] 新建 `src/lib/db/queries.ts`：`listRuns(query: RunListQuery): Promise<RunListResponse>`——游标条件构建（startedAt/runId 复合）+ status/modelId/timeRange 筛选 AND 叠加 + LIMIT 50；`getSpanRows(runId: string): Promise<SpanRow[]>`——按 `(run_id, start_ms ASC)` 查询（`src/lib/db/queries.ts` · 45min · T005 T007）
- [ ] T010 在 `src/app/api/playground/stream/route.ts` 的 `onFinish` 回调里接入 `writeRun`：用 `Promise.allSettled([ writeRun(...) ])` 异步不阻塞；构建 `Run` 元数据（modelId / promptSummary / token 聚合 / 耗时）和根 Span 树（`src/app/api/playground/stream/route.ts` · 40min · T008）
- [ ] T011 [P] 新建 `src/app/api/runs/list/route.ts`：Node Runtime（不加 edge 声明）；`POST`；`runListQuerySchema.safeParse` 入参；调 `listRuns`；`runListResponseSchema.parse` 出参（`src/app/api/runs/list/route.ts` · 20min · T009）
- [ ] T012 [P] 新建 `src/app/api/runs/[runId]/route.ts`：`GET`；调 `getSpanRows` → `buildSpanTree` → `spanSchema.nullable().parse`；无数据返回 `null`（`src/app/api/runs/[runId]/route.ts` · 20min · T009）
- [ ] T013 [P] 冒烟测试数据层：`pnpm tsx scripts/seed-runs.ts`（手写一个脚本，塞 5 条 Run + 各 3-8 条 Span）；验证 `GET /api/runs/list` 返回 5 条，`GET /api/runs/{id}` 返回 span 树结构正确（`scripts/seed-runs.ts` · 25min · T011 T012）

**Checkpoint**：curl 两条 API，结果符合 schema。

---

## Phase 3: User Story 1 — 列表 + Trace 瀑布图（P1 · MVP 🎯）

**Goal**：进 RunHistory 页 → 看到 Run 列表 → 选中 → 右侧瀑布图渲染 → 点 span 展开详情。

**Independent Test**：Phase 2 完成后，从 Playground 跑一次 → 刷 RunHistory → 列表出现该条 → 点击看瀑布图 → 展开任意 span 看 input/output。

### 实现 — User Story 1

- [ ] T014 [P] [US1] 新建 `src/app/runs/_components/run-row.tsx`：接收 `run: Run` + `isSelected: boolean`；渲染 status icon（CheckCircle2 / XCircle / Loader2 lucide）/ prompt 摘要（`promptSummary.slice(0,60)`）/ 耗时色阶（durationMs 三档 token）/ token 总数；选中态用 `bg-muted` + 左边框 accent（`src/app/runs/_components/run-row.tsx` · 25min · Phase 2）
- [ ] T015 [P] [US1] 新建 `src/app/runs/_components/empty-state.tsx`：零数据空态，图标 `ClipboardList` + 文案 + Link 指向 `/playground`（`src/app/runs/_components/empty-state.tsx` · 15min · 无依赖）
- [ ] T016 [US1] 新建 `src/app/runs/_components/run-list.tsx`：`"use client"`；`useState` 管 pages / cursor / done；`IntersectionObserver` sentinel 触发 `loadMore`；filter 变更时重置全部状态；调 `POST /api/runs/list`；结果用 `runListResponseSchema.parse` 客户端回验（`src/app/runs/_components/run-list.tsx` · 50min · T014 T015）
- [ ] T017 [P] [US1] 新建 `src/app/runs/_components/waterfall/time-axis.tsx`：SVG `<g>` 顶部刻度轴；接收 `totalMs` + `svgWidth`；调 `pickTickInterval` 算刻度间距；`<text>` 标注 ms/s 单位（`src/app/runs/_components/waterfall/time-axis.tsx` · 25min · 无依赖）
- [ ] T018 [P] [US1] 新建 `src/app/runs/_components/waterfall/span-row.tsx`：单 span 行：`depth * 24px` 左缩进（4px×6，宪法间距）/ 耗时色阶 `<rect>` / 虚线连接线 / span name `<text>` / 点击展开 toggle；颜色全部走 CSS var（`src/app/runs/_components/waterfall/span-row.tsx` · 40min · 无依赖）
- [ ] T019 [P] [US1] 新建 `src/app/runs/_components/waterfall/span-detail.tsx`：展开后显示 input / output / error 三段；`<pre>` 包裹 + JSON 格式化（`JSON.stringify(v, null, 2)`）；文字可选中（`select-text`）；满足 SC-005（`src/app/runs/_components/waterfall/span-detail.tsx` · 20min · 无依赖）
- [ ] T020 [US1] 新建 `src/app/runs/_components/waterfall/waterfall.tsx`：`flattenForRender(root, svgWidth)` 产出渲染行列表；组合 `<TimeAxis>` + 多个 `<SpanRow>`；`svgWidth` 从 `ResizeObserver` 读容器实际宽度（响应式）；`<svg role="img" aria-label="Trace 瀑布图">` 满足无障碍（`src/app/runs/_components/waterfall/waterfall.tsx` · 55min · T017 T018 T019）
- [ ] T021 [US1] 新建 `src/app/runs/_components/run-detail.tsx`：`"use client"`；`useEffect` fetch `/api/runs/[runId]` → `spanSchema.nullable().parse` → 渲染 `<Waterfall>` 或空态；error 用 `<ErrorBanner>`（复用 Playground 组件，宪法 §6）（`src/app/runs/_components/run-detail.tsx` · 30min · T020）
- [ ] T022 [US1] 重写 `src/app/runs/page.tsx`：两栏布局（`grid grid-cols-[350px_1fr]`）；`<RunList>` 左栏 + `<RunDetail runId={selectedRunId}>` 右栏；`useState` 管 `selectedRunId`；顶部标题 + 写入失败的顶部非阻塞提示（`src/app/runs/page.tsx` · 25min · T016 T021）
- [ ] T023 [US1] 手工冒烟（US1 MVP）：从 Playground 跑 2 次调用（一成功一刻意让 Key 出错）→ 进 RunHistory → 验证两条都出现 → 选中成功条看瀑布图 → 展开 LLM span 看 input/output → 选中失败条看错误展示（无新增文件 · 20min · T022 T013）

**Checkpoint**：US1 MVP 可 demo。

---

## Phase 4: User Story 2 — 筛选（P1）

**Goal**：按 status / 模型 / 时间范围筛选，结果在 500ms 内收敛（SC-003）。

**Independent Test**：US1 可用后，塞 10 条混合 Run（成功/失败/不同模型）→ 筛 error → 只剩失败条；再叠加模型筛选 → 结果是交集。

### 实现 — User Story 2

- [ ] T024 [US2] 新建 `src/app/runs/_components/filter-panel.tsx`：shadcn `Select`（status）+ `Select`（modelId，从 API 动态查已用过的模型）+ `RadioGroup`（时间范围：1h/24h/7d/all）；筛选变更写入 URL search params（`useRouter + useSearchParams`）以便刷新不丢状态（`src/app/runs/_components/filter-panel.tsx` · 40min · T016）
- [ ] T025 [US2] 在 `queries.ts` 的 `listRuns` 里补全 `modelId` / `timeRange` 的 WHERE 子句（框架已写，参数化查询）；新增 `getUsedModelIds(): Promise<string[]>` 供筛选面板下拉（`src/lib/db/queries.ts` · 20min · T009）
- [ ] T026 [US2] 在 `run-list.tsx` 里接受 `filter` prop，filter 变更时重置 cursor 并重新 fetch；在 `page.tsx` 里挂入 `<FilterPanel onFilterChange={...} />`（`src/app/runs/_components/run-list.tsx` / `page.tsx` · 20min · T024 T025）
- [ ] T027 [US2] 冒烟：验证 status=error 筛选、model=claude-4.7 筛选、两者叠加时列表正确收敛（无新增文件 · 10min · T026）

**Checkpoint**：US1 + US2 独立可用。

---

## Phase 5: User Story 3 — 无限滚动游标分页（P2）

**Goal**：滚到底自动加载下一批 ≤ 50 条，已到底显示"到底了"（spec FR-011 / US3）。

**Independent Test**：`scripts/seed-runs.ts` 塞 120 条 → 进列表 → 首屏 50 条 → 滚到底 → 加载 50 条 → 再滚 → 加载 20 条 → 再滚无响应。

### 实现 — User Story 3

- [ ] T028 [US3] 在 `run-list.tsx` 里验证 IntersectionObserver sentinel 正确触发，且 `done = true` 时不再 fetch；补充"到底了"文案（Phase 3 T016 已有骨架，此处做最终验证和调整）（`src/app/runs/_components/run-list.tsx` · 20min · T016）
- [ ] T029 [US3] 在 `scripts/seed-runs.ts` 扩展到 120 条；跑全流程冒烟（`scripts/seed-runs.ts` · 15min · T028）

**Checkpoint**：US1 + US2 + US3 全部独立可用。

---

## Phase 6: Polish & Cross-Cutting（P1 除 T035 其余 P2）

- [ ] T030 [P] 响应式：两栏在 ≥ 768px 用 `grid-cols-[280px_1fr]`，< 768px 用 `grid-cols-1`（右侧详情 sheet/drawer 模式，tap 列表行打开）（`src/app/runs/page.tsx` · 25min · T022）
- [ ] T031 [P] 硬编码颜色扫描：`grep -rE "#[0-9a-f]{6}|fill=\"#|stroke=\"#" src/app/runs src/lib/db` 必须为空（宪法 §3.1 NON-NEGOTIABLE）（无新增文件 · 10min · T022）
- [ ] T032 [P] 无障碍核查：`<svg aria-label>` 已加 → 键盘 Tab 可到达每个 span 行 → 展开 span 用 `<button>` 而非 `<div onClick>` → SR 可读 span 名和耗时（宪法 §3.3 + spec SC-005）（涉及 `span-row.tsx` · 20min · T018）
- [ ] T033 [P] `formatRunTime(ms)` 封装进 `src/lib/utils.ts`，用 `Intl.DateTimeFormat` + 浏览器时区；所有时间展示改走此函数（`src/lib/utils.ts` · 15min · T022）
- [ ] T034 [P] Dark mode 验证：SVG `fill` / `stroke` 全走 CSS var → 切换 `dark` class 后瀑布图配色跟随（无新增文件 · 15min · T022）
- [ ] T035 `pnpm build` exit 0 + `pnpm lint` 无 error（宪法 §7 Quality Gate）（无新增文件 · 10min · T022 T030-T034）
- [ ] T036 [P] 更新 `specs/002-runhistory/checklists/requirements.md`：勾选所有已实现 AC 和 Constitution Gate 检查项（`specs/002-runhistory/checklists/requirements.md` · 10min · T023 T027 T029）

---

## Dependencies & Execution Order

### Critical Path

```
T001 → T004 → T005 → T007 → T008 → T010 → T020 → T021 → T022 → T023 → T035
(5)    (15)   (25)   (20)   (35)   (40)   (55)   (30)   (25)   (20)   (10)
= 280 min ≈ 4.7h（纯串行关键路径）
```

### Parallel Opportunities

- **Phase 1**：T002 / T003 并行（无依赖）
- **Phase 2**：T009 / T011 / T012 / T013 并行（都依赖 T007 完成后）
- **Phase 3**：T014 / T015 / T017 / T018 / T019 **五条并行**（相互独立文件）
- **Phase 6**：T030 / T031 / T032 / T033 / T034 / T036 六条并行

### 推荐提交顺序

```
chore(002): [T001] install libsql drizzle
chore(002): [T002-T003] env vars
feat(002): [T004-T007] db client + schema + migration
feat(002): [T008] write-run utility
feat(002): [T009] list/getSpanRows queries
feat(002): [T010] wire writeRun into playground route
feat(002): [T011-T012] runs API routes
feat(002): [T014-T015] run-row + empty-state
feat(002): [T016] run-list infinite scroll
feat(002): [T017-T019] waterfall parts (time-axis, span-row, span-detail)
feat(002): [T020] waterfall composer
feat(002): [T021-T022] run-detail + page rebuild
chore(002): [T023] US1 MVP smoke
feat(002): [T024-T026] filter panel (US2)
feat(002): [T028-T029] cursor pagination validation (US3)
chore(002): [T030-T036] polish + quality gate
```

---

## 任务总量与工时估算

| Phase | 任务数 | 单人估时 |
|---|---|---|
| 1 Setup | 7 | 90 min |
| 2 Foundational | 6 | 185 min |
| 3 US1 MVP | 10 | 305 min |
| 4 US2 筛选 | 4 | 90 min |
| 5 US3 分页 | 2 | 35 min |
| 6 Polish | 7 | 105 min |
| **合计** | **36** | **≈ 13.5h 单人 / 6h 三人并行** |

---

## Implementation Strategy

### MVP First（US1 Only）

1. Phase 1 全部（数据库起来）
2. Phase 2 T008 → T013（读写层验证）
3. Phase 3 T014 → T023（完整 US1）
4. **STOP & VALIDATE**：T023 手工冒烟过 → 可 demo

### 渐进交付

- US1 跑通 → 部署 → 收反馈
- 追加 US2（筛选，4 个任务）
- 追加 US3（分页验证，2 个任务）
- Phase 6 Quality Gate

---

## Notes

- Drizzle 的 `db.insert` 在 Turso file: 模式下是同步的——`writeRun` 的 `async/await` 仍然需要，因为生产环境走 HTTP 模式是真异步
- `src/app/runs/page.tsx` 存在 legacy mock 实现，**T022 是重写**，不是追加
- 瀑布图 SVG 宽度用 `ResizeObserver` 动态读取，避免 SSR 时 `window.innerWidth` 报错（宪法 §5.4）
- `/speckit.analyze` 建议在 T023 之后 + T035 之前各跑一次
