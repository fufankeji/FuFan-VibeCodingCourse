# Implementation Plan: RunHistory 页（AI 调用历史与 Trace 瀑布图）

**Feature Branch**: `002-runhistory`
**Spec**: [./spec.md](./spec.md)
**Created**: 2026-04-23
**Status**: Draft
**Constitution**: v2.0.0（§0.3 Turso + Drizzle 作用域例外已激活）

---

## 0. 已完成前置（不计入任务）

- ✅ `src/lib/schemas/runhistory.ts`（schema-design 产出：spanSchema / spanRowSchema / runSchema / 游标 / 工具函数）
- ✅ `specs/002-runhistory/spec.md`
- ✅ 宪法 v2.0.0 §0.3 作用域例外声明

**注**：用户提到 `shared/schemas/trace.ts` + `drizzle/schema/traces.ts`——项目实际路径是 `src/lib/schemas/runhistory.ts`（宪法 §1.1 NON-NEGOTIABLE），Drizzle schema 将落到 `src/lib/db/schema.ts`（见下方文件结构）。

---

## 1. 文件结构（新增 / 修改）

### 新增

| 路径 | 职责 |
|---|---|
| `src/lib/db/client.ts` | Turso libSQL 客户端单例 + Drizzle 实例（`createClient` + `drizzle`）|
| `src/lib/db/schema.ts` | Drizzle table 定义：`runs` 表 + `spans` 表 + 枚举（与 `runhistory.ts` schema 字段一一对应）|
| `src/lib/db/migrations/0001_init_runs_spans.sql` | 建表 + 索引的 SQL 文件（`drizzle-kit generate` 产出，手动确认后提交）|
| `src/lib/db/write-run.ts` | `writeRun(run, rootSpan)` — 原子写入 Run + SpanRows；失败不抛（降级 + console.error）|
| `src/lib/db/queries.ts` | `listRuns(query)` / `getSpanRows(runId)` — 两条复用查询，含游标逻辑与筛选条件构建 |
| `src/app/api/runs/list/route.ts` | `POST /api/runs/list` — Node Runtime；接收 `runListQuerySchema`；返回 `runListResponseSchema` |
| `src/app/api/runs/[runId]/route.ts` | `GET /api/runs/[runId]` — Node Runtime；查 spans 行 → `buildSpanTree` → 返回 span 树 JSON |
| `src/app/runs/_components/run-list.tsx` | 左侧 Run 列表（无限滚动 + `IntersectionObserver`）；消费 `/api/runs/list` |
| `src/app/runs/_components/run-row.tsx` | 单行：status icon / prompt 摘要（≤ 60 字符截断）/ 耗时色阶 / token 总数 |
| `src/app/runs/_components/filter-panel.tsx` | 筛选面板：状态 / 模型（下拉）/ 时间范围（radio）；URL search params 持久化 |
| `src/app/runs/_components/run-detail.tsx` | 右侧详情容器（Client Component）；加载 span 树 → 分发给 Waterfall |
| `src/app/runs/_components/waterfall/waterfall.tsx` | SVG 瀑布图总控：计算 x 轴映射 + 布局，渲染所有 SpanRow |
| `src/app/runs/_components/waterfall/span-row.tsx` | 单个 span 行：缩进条 + 虚线 + 耗时色阶矩形 + 展开/折叠 |
| `src/app/runs/_components/waterfall/span-detail.tsx` | span 展开详情：input / output / error 三段（`<pre>` + JSON highlight）|
| `src/app/runs/_components/waterfall/time-axis.tsx` | 时间刻度轴（顶部）：按 4px 阶梯间距，刻度间距自适应总时长 |
| `src/app/runs/_components/empty-state.tsx` | 零数据空态（文案 + 图标 + "去 Playground 跑一条" CTA）|
| `src/app/runs/page.tsx` | **重写**（替换 mock 实现）：两栏布局 Server Component 壳；`<RunList>` + `<RunDetail>` |

### 修改

| 路径 | 改什么 |
|---|---|
| `src/app/api/playground/stream/route.ts` | 流式完成后调 `writeRun`（用 `ctx.waitUntil` 或 Promise.allSettled 不阻塞响应）|
| `.env.local.example` | 追加 `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` 说明 |
| `src/lib/env.ts`（若存在）| `serverSchema` 追加 `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`（宪法 §5.2）|
| `package.json` / `pnpm-lock.yaml` | 追加 `@libsql/client` + `drizzle-orm` + `drizzle-kit`（dev）|

### 不改动

- `src/lib/schemas/trace.ts`（legacy，被现有 `src/app/runs/page.tsx` 引用，等本 feature 完成后统一迁移）
- `src/components/ui/**`（宪法 §1.1 NON-NEGOTIABLE）

---

## 2. 数据流（完整链路）

```
[Playground 调用完成]
  └─ /api/playground/stream/route.ts
       │ 流式完成后（onFinish 或 promise 尾）：
       │ Promise.allSettled([
       │   writeRun(run, rootSpan)    ← 非阻塞，失败降级
       │ ])
       │  ↓（异步，不等待）
       │ 响应已返回给前端

[writeRun]
  └─ src/lib/db/write-run.ts
       │ 1. runSchema.parse(run)              ← schema 校验
       │ 2. spanSchema.parse(rootSpan)        ← 递归校验
       │ 3. flattenSpanTree(rootSpan, runId)  ← 树 → 扁平行
       │ 4. db.insert(runs).values(run)       ← Drizzle
       │ 5. db.insert(spans).values(spanRows) ← 批量插入
       │ catch: console.error + 页面顶部非阻塞提示

[RunHistory 页 · 列表]
  └─ /api/runs/list (POST · Node Runtime)
       │ 1. runListQuerySchema.safeParse(body)  ← 入参校验
       │ 2. queries.listRuns(query)              ← Drizzle 游标查询（见 §§ 索引）
       │ 3. runListResponseSchema.parse(result)  ← 出参校验
       │ 返回 { runs: Run[], nextCursor }
       │
  └─ src/app/runs/_components/run-list.tsx
       │ IntersectionObserver → 滚到底 → fetch /api/runs/list（cursor, filter）
       │ 新一批 runs 追加到列表
       │ 点击某行 → onSelect(runId) → 父组件更新 selectedRunId

[RunHistory 页 · 详情]
  └─ /api/runs/[runId] (GET · Node Runtime)
       │ 1. queries.getSpanRows(runId)        ← Drizzle 按 (runId, startMs) 排序
       │ 2. buildSpanTree(rows)               ← 扁平 → 递归树（src/lib/schemas/runhistory.ts）
       │ 3. spanSchema.nullable().parse(tree) ← 出参校验
       │ 返回 Span 树 JSON
       │
  └─ src/app/runs/_components/run-detail.tsx  ("use client")
       │ fetch → spanSchema.nullable().parse → 传给 <Waterfall root={tree} />

[SVG 瀑布图渲染算法]
  └─ src/app/runs/_components/waterfall/waterfall.tsx
       │ 1. 遍历 span 树，拍扁成"渲染行"列表（含 depth / absoluteStartMs / durationMs）
       │ 2. 计算 totalMs = max(startMs + durationMs)
       │ 3. 映射函数：toX(ms) = (ms / totalMs) * SVG_CONTENT_WIDTH
       │ 4. 每行高度固定 = 28px（4px 阶梯的 7x）
       │ 5. 渲染 <TimeAxis> + 每行 <SpanRow depth={d} x={toX(startMs)} width={toX(durationMs)} />
       │ 6. 嵌套连接线：父行右侧 → 子行左侧的虚线 <line stroke-dasharray="2 2" />
```

**技术栈映射**：

| 层 | 选型 | 宪法依据 |
|---|---|---|
| DB 客户端 | `@libsql/client` + `drizzle-orm` | §0.3 作用域例外（仅 RunHistory）|
| 列表 API | Node Runtime（非 Edge）| Drizzle 不兼容 Edge Runtime（依赖 Node fs + crypto）|
| 详情 API | Node Runtime | 同上 |
| 瀑布图 | SVG（`<svg>` + `<rect>` + `<text>` + `<line>`）| spec AC-10 NON-NEGOTIABLE |
| 列表组件 | Client Component（`"use client"`）| 需要 IntersectionObserver + filter 交互 |
| 详情容器 | Client Component | 需要 span 展开 / hover |
| 空态 | Server 或 Client 均可 | 静态，无交互 |

---

## 3. 索引设计

### `runs` 表

```sql
CREATE TABLE runs (
  run_id           TEXT        PRIMARY KEY,           -- nanoid(21)
  started_at       INTEGER     NOT NULL,              -- UNIX ms，游标字段
  ended_at         INTEGER,                           -- UNIX ms，NULL 表示 running
  model_id         TEXT        NOT NULL,
  prompt_summary   TEXT        NOT NULL,
  status           TEXT        NOT NULL CHECK(status IN ('success','error','running')),
  total_duration_ms INTEGER    NOT NULL DEFAULT 0,
  total_prompt_tokens INTEGER  NOT NULL DEFAULT 0,
  total_completion_tokens INTEGER NOT NULL DEFAULT 0,
  error_message    TEXT
);

-- 列表分页：倒序 + tiebreaker
CREATE INDEX idx_runs_cursor ON runs (started_at DESC, run_id DESC);

-- 状态筛选（AND 查询时走 Index Merge 或让优化器选择）
CREATE INDEX idx_runs_status ON runs (status);

-- 模型筛选
CREATE INDEX idx_runs_model_id ON runs (model_id);
```

**游标查询逻辑（cursored pagination）**：

```sql
-- 游标: cursor = { startedAt: 1714000000000, runId: "abc123" }
-- 查询: 找 (started_at, run_id) < (cursor.startedAt, cursor.runId) 的下一批
-- SQLite 行值比较：(a, b) < (x, y) ↔ a < x OR (a = x AND b < y)
WHERE (started_at < :startedAt) OR (started_at = :startedAt AND run_id < :runId)
ORDER BY started_at DESC, run_id DESC
LIMIT 50
```

### `spans` 表

```sql
CREATE TABLE spans (
  span_id          TEXT        PRIMARY KEY,
  run_id           TEXT        NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
  parent_span_id   TEXT,                              -- NULL = 根 span
  kind             TEXT        NOT NULL CHECK(kind IN ('llm','tool','retrieval','agent')),
  name             TEXT        NOT NULL,
  start_ms         INTEGER     NOT NULL,              -- 相对 Run 开始的偏移
  duration_ms      INTEGER     NOT NULL,
  status           TEXT        NOT NULL CHECK(status IN ('success','error','running','timeout')),
  input_json       TEXT,                              -- JSON.stringify 或 NULL
  output_json      TEXT,                              -- JSON.stringify 或 NULL
  error            TEXT,
  prompt_tokens    INTEGER,
  completion_tokens INTEGER,
  model            TEXT
);

-- 瀑布图查询：按 Run 聚合 + 时间排序
CREATE INDEX idx_spans_run_start ON spans (run_id, start_ms ASC);
```

**为什么不加 `user_id`**：宪法 §0.2 + §0.3——本项目无用户账号系统，所有 Trace 属于本地设备，不按用户隔离。

---

## 4. 瀑布图渲染算法

### 4.1 树 → 渲染行列表（前端扁平化）

```ts
type RenderRow = {
  span: Span;
  depth: number;           // 缩进层级，根 = 0
  x: number;               // SVG x 坐标（已映射）
  width: number;           // SVG 宽度（已映射）
  parentY: number | null;  // 父行的 cy，用于绘制连接线
};

function flattenForRender(root: Span, svgWidth: number): RenderRow[] {
  const totalMs = calcTotalMs(root);  // max(startMs + durationMs) 递归
  const toX = (ms: number) => (ms / totalMs) * svgWidth;

  const rows: RenderRow[] = [];
  const walk = (span: Span, depth: number, parentY: number | null) => {
    const row: RenderRow = {
      span,
      depth,
      x: toX(span.startMs),
      width: Math.max(toX(span.durationMs), 2),  // 极短 span 最少 2px
      parentY,
    };
    rows.push(row);
    const myY = (rows.length - 1) * ROW_HEIGHT + ROW_HEIGHT / 2;
    // 超过 5 层嵌套：折叠占位，不递归（spec FR-008）
    if (depth < 5) {
      span.children.forEach((c) => walk(c, depth + 1, myY));
    } else if (span.children.length > 0) {
      rows.push({ span: TRUNCATED_PLACEHOLDER, depth: 5, x: 0, width: 0, parentY: myY });
    }
  };
  walk(root, 0, null);
  return rows;
}
```

### 4.2 时间刻度轴（自适应间距）

```ts
// 总时长 totalMs → 选一个"人类友好"的刻度间距
const TICK_TARGETS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 10000];
function pickTickInterval(totalMs: number, svgWidth: number): number {
  const minPixelPerTick = 48;  // 刻度标签不重叠的最小间距
  const maxTicks = Math.floor(svgWidth / minPixelPerTick);
  for (const t of TICK_TARGETS) {
    if (totalMs / t <= maxTicks) return t;
  }
  return Math.ceil(totalMs / maxTicks / 1000) * 1000;
}
```

### 4.3 耗时色阶（token 化，宪法第二法衣）

- `durationMs < 200` → `bg-emerald-500`（`--color-emerald-500` @theme token）
- `durationMs < 1000` → `bg-amber-400`（`--color-amber-400` @theme token）
- `durationMs ≥ 1000` → `bg-rose-500`（`--color-rose-500` @theme token）

SVG 里用 `className`（配合 Tailwind 的 SVG 支持），或者 CSS var 直接注入 `fill`：

```tsx
const fill = durationMs < 200
  ? "var(--color-emerald-500)"
  : durationMs < 1000
  ? "var(--color-amber-400)"
  : "var(--color-rose-500)";
<rect fill={fill} ... />
```

禁止直接写 `fill="#10B981"` 等 hex 字面量（宪法 §3.1 NON-NEGOTIABLE）。

### 4.4 嵌套连接线

```tsx
// 父行中心 → 子行起点的虚线
// parentY: 父行的 SVG cy；childX: 子行的 SVG x 起点；childY: 子行的 cy
<line
  x1={childX}  y1={parentY}
  x2={childX}  y2={childY}
  stroke="var(--color-border)"
  strokeDasharray="2 2"
  strokeWidth={1}
/>
```

---

## 5. 技术决策

### 决策 1：为什么列表 API 走 Node Runtime 不走 Edge

Drizzle + `@libsql/client` 依赖 Node.js 原生 `fetch`、`crypto`、可选 `better-sqlite3`——**不兼容 Cloudflare Workers/Edge Runtime**。宪法 §0.3 开的口子是"允许 Turso"，但 Edge 的部署模型与 libSQL 嵌入式模式不兼容。解决方案：`/api/runs/**` 不加 `export const runtime = "edge"`，走 Node Runtime（Vercel 默认 Serverless Function），maxDuration 也不需要 60s 拉长。

### 决策 2：为什么 Server Component 读列表，Client Component 渲染瀑布图

- **列表**：run-list 的无限滚动需要 `IntersectionObserver` → 必须 Client Component（非 Server）
- **瀑布图**：hover / click 展开 span 详情 → 必须 Client Component
- **页面壳**（`src/app/runs/page.tsx`）：可以是 Server Component，`<RunList>` + `<RunDetail>` 是 Client 子树

> 用户 plan 里提到 "Server Component 读列表（SEO + 首屏性能）"——实际上无限滚动和筛选都需要客户端 JS，SSR 的首屏价值有限。本 plan 选择 API Route + Client Component，避免 Server Component 与游标状态的混合模式带来的复杂度。

### 决策 3：为什么 SVG 不 Canvas

spec AC-10 NON-NEGOTIABLE。补充理由：
- SVG 是 DOM 节点 → `<text>` 可以被屏幕阅读器朗读，满足 spec SC-005
- `<text>` 文字可以鼠标选中 + Cmd+C 复制（span 名称、时间戳）
- Canvas 绘图的 a11y 成本极高（需要 fallback `aria-label` + 手动 hit-test）

### 决策 4：为什么 Drizzle 不 Prisma

| 维度 | Drizzle | Prisma |
|---|---|---|
| libSQL/Turso 支持 | 官方一级支持 | 需要 preview driver adapter |
| 包体积 | ~50 KB | ~500 KB（含 query engine）|
| Edge 兼容性 | 接近（libSQL HTTP 模式） | 差 |
| 类型推断 | 从 schema 自动推，无 codegen | 需要 `prisma generate` |
| SQL 可见性 | 显式（`.select()` 就是 SQL） | 隐式（容易写出 N+1）|

**宪法 §1.2** 明确禁止 Prisma，此处只补理由。

### 决策 5：为什么游标用 `(startedAt, runId)` 不用 `rowid`

SQLite 自增 rowid 不保证与业务 `started_at` 排序一致（批量插入时 rowid 可能乱序）。用 `(started_at DESC, run_id DESC)` 的复合游标：
- 对应数据库索引，查询走 index scan 不走 seq scan
- tiebreaker 用 `run_id`（text 字典序），同毫秒时间戳不丢记录
- 游标可序列化为 JSON string 放 URL query params，浏览器刷新不丢

---

## 6. 风险预估

### 风险 1：数据量大时列表首屏慢

**表现**：Turso libSQL 在本地是文件 I/O，1000 条 Run 的初始查询 + 序列化可能超 300ms（SC-002 要求 ≤ 500ms）。

**应对**：
- 默认每页 50 条（spec FR-011），不加载全量
- `runs` 表的 `idx_runs_cursor` 复合索引保证游标查询是 index seek，O(log n)
- 若实测超 500ms，`SELECT` 只取列表行需要的 7 列（不 `SELECT *`），避免拉 `error_message` 等长文本字段
- 必要时可给 `runs` 加 `prompt_summary` 长度截断（DB 层 SUBSTR 而不是 JS 截断）

### 风险 2：Trace 嵌套太深导致 SVG 超高

**表现**：若实际嵌套 > 5 层（如 Agent-of-agents），每层 28px，10 层就是 280px 有效高度，但 SVG 用 `overflow: visible` 不会裁，会溢出父容器。

**应对**：
- `flattenForRender` 中 depth ≥ 5 的 span 折叠成占位行（plan §4.1 已描述）
- 容器用 `overflow-y: auto` + `max-h-[600px]`（或 `max-h-screen - header`），让内容可滚
- 折叠行点击展开仅展示第 6+ 层的扁平文本详情，不再嵌套 SVG

### 风险 3：跨时区时间显示乱码

**表现**：Playground 在北京时间写入 `started_at = 1714000000000`，用户用 UTC+8 → UTC+0 的机器看 RunHistory，"昨天"的 Run 显示成"今天"。

**应对**：
- DB 存 **UNIX ms UTC**（已设计如此），展示层全部用 `Intl.DateTimeFormat` + `timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone`（读取浏览器时区）
- 封装 `formatRunTime(ms: number): string` 放 `src/lib/utils.ts`（宪法 §6 复用 `cn()` 的同一文件）
- 筛选"时间范围"的计算（如"最近 24h"）用 `Date.now() - 24*60*60*1000`，不依赖时区

### 风险 4：writeRun 与 streamObject 的竞争条件

**表现**：Playground 流式过程中，model 返回的 Span 树可能在 `onFinish` 回调里才完整——如果提前调 `writeRun`，Span 的 `output` 还是 `undefined`，写入残缺数据。

**应对**：
- `writeRun` **只在 `onFinish`（或 `onError`）里调用**，不在流式中途调用
- 在 playground route 里：
  ```ts
  const result = streamObject({ ..., onFinish: async ({ object }) => {
    await writeRun(buildRun(modelId, prompt, object), buildSpanTree(object));
  }});
  ```
- `onFinish` 是 AI SDK 保证的"对象完整"时机，不存在竞争

### 风险 5：SVG text 在黑暗模式下颜色冲突

**表现**：`<text fill="black">` 在 dark mode 背景 `#0a0a0a` 上完全不可见。

**应对**：
- 所有 SVG `fill` / `stroke` 用 CSS variable（`var(--color-fg)`，`var(--color-border)`）
- `globals.css` 里已有 `@theme` 的亮/暗双色 token，SVG 元素会跟随
- 禁止在 SVG 属性里写字面量颜色（宪法 §3.1，grep 扫描 `fill="#` 必须为空）
