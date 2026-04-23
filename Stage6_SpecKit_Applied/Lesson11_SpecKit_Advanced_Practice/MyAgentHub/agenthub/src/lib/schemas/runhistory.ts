// ============================================================
// RunHistory Schema (SSOT · Feature 002-runhistory)
// ------------------------------------------------------------
// 本文件定义三种形态的 schema：
//
// 1. spanSchema        递归树形 — 前端瀑布图渲染 / 写入前构造
// 2. spanRowSchema     扁平化（parentSpanId FK）— Drizzle 入库 / 游标分页查询
// 3. runSchema         单条 Run 的元数据
//
// 为什么需要两种 span 形态：
//   SQLite/libSQL 里**不存嵌套 JSON**（索引 / 筛选 / 游标全都要列），
//   所以落库走扁平；读出后用 buildSpanTree() 还原成树供 UI 消费。
//
// 宪法依据：v2.0.0 §0.3 作用域例外（Turso + Drizzle 仅限 RunHistory）
// ============================================================

import { z } from "zod";

/* -------------------------------------------------------------------------- *
 * 枚举
 * -------------------------------------------------------------------------- */

export const spanKindSchema = z
  .enum(["llm", "tool", "retrieval", "agent"])
  .describe(
    "span 种类：llm=模型调用，tool=工具调用，retrieval=知识检索，agent=子 Agent 嵌套",
  );

export const spanStatusSchema = z
  .enum(["success", "error", "running", "timeout"])
  .describe("span 状态：success 成功 / error 失败 / running 进行中 / timeout 超时");

export const runStatusSchema = z
  .enum(["success", "error", "running"])
  .describe("Run 整体状态，running 表示尚在写入中");

export const modelIdSchema = z
  .string()
  .min(1)
  .max(64)
  .describe("模型 id，透传自 Playground（如 gpt-5.3 / claude-4.7）");

/* -------------------------------------------------------------------------- *
 * Span — 递归树形（前端 / 内存）
 * -------------------------------------------------------------------------- */

/** TS 递归类型必须先手写（Zod v4 的 z.lazy 需要显式标注） */
export type Span = {
  spanId: string;
  parentSpanId: string | null;
  kind: z.infer<typeof spanKindSchema>;
  name: string;
  startMs: number;
  durationMs: number;
  status: z.infer<typeof spanStatusSchema>;
  input?: unknown;
  output?: unknown;
  error?: string;
  promptTokens?: number;
  completionTokens?: number;
  model?: string;
  children: Span[];
};

export const spanSchema: z.ZodType<Span> = z.lazy(() =>
  z.object({
    spanId: z
      .string()
      .min(1)
      .max(64)
      .describe("span 唯一 id（建议 nanoid/uuid），React key 与父子关联"),
    parentSpanId: z
      .string()
      .min(1)
      .max(64)
      .nullable()
      .describe("父 span id；根 span 为 null"),
    kind: spanKindSchema,
    name: z
      .string()
      .min(1)
      .max(120)
      .describe("span 展示名，如 'LLM:openai/gpt-5.3' / 'Tool:web_search'"),
    startMs: z
      .number()
      .int()
      .min(0)
      .max(24 * 60 * 60_000)
      .describe(
        "相对 Run 开始的毫秒偏移，用于瀑布图 x 轴定位；上限 24h 防脏数据",
      ),
    durationMs: z
      .number()
      .int()
      .min(0)
      .max(10 * 60_000)
      .describe("耗时毫秒，上限 10 分钟；超过视为 timeout"),
    status: spanStatusSchema,
    input: z
      .unknown()
      .optional()
      .describe("span 输入原始值（JSON 或字符串）；未完成时可为 undefined"),
    output: z
      .unknown()
      .optional()
      .describe("span 输出原始值（JSON 或字符串）"),
    error: z
      .string()
      .max(5000)
      .optional()
      .describe("错误信息，status 为 error 时必填（由业务层保证，而非 schema）"),
    promptTokens: z
      .number()
      .int()
      .min(0)
      .max(1_000_000)
      .optional()
      .describe("（仅 llm）prompt tokens"),
    completionTokens: z
      .number()
      .int()
      .min(0)
      .max(1_000_000)
      .optional()
      .describe("（仅 llm）completion tokens"),
    model: z
      .string()
      .min(1)
      .max(64)
      .optional()
      .describe("（仅 llm）实际模型 id，方便展开详情时区分"),
    children: z
      .array(spanSchema)
      .max(50)
      .default([])
      .describe(
        "子 span 数组；spec FR-008 约束前端最多渲染 5 层嵌套，schema 层只挡异常扇出（上限 50）",
      ),
  }),
);

/* -------------------------------------------------------------------------- *
 * SpanRow — 扁平化（Drizzle 入库 / 游标查询）
 * -------------------------------------------------------------------------- */

export const spanRowSchema = z
  .object({
    spanId: z.string().min(1).max(64),
    runId: z.string().min(1).max(64).describe("外键：所属 Run"),
    parentSpanId: z.string().min(1).max(64).nullable(),
    kind: spanKindSchema,
    name: z.string().min(1).max(120),
    startMs: z.number().int().min(0).max(24 * 60 * 60_000),
    durationMs: z.number().int().min(0).max(10 * 60_000),
    status: spanStatusSchema,
    /** input/output/error 在 DB 里存 TEXT（JSON.stringify），读出后再 JSON.parse */
    inputJson: z.string().max(100_000).nullable().describe("JSON.stringify 后的 input，NULL 表示无"),
    outputJson: z.string().max(100_000).nullable(),
    error: z.string().max(5000).nullable(),
    promptTokens: z.number().int().min(0).max(1_000_000).nullable(),
    completionTokens: z.number().int().min(0).max(1_000_000).nullable(),
    model: z.string().min(1).max(64).nullable(),
  })
  .describe("扁平化 span 行，对应 Drizzle `spans` 表的 Row 形态");

export type SpanRow = z.infer<typeof spanRowSchema>;

/* -------------------------------------------------------------------------- *
 * Run — 单次调用的聚合元数据
 * -------------------------------------------------------------------------- */

export const runSchema = z
  .object({
    runId: z
      .string()
      .min(1)
      .max(64)
      .describe("Run 唯一 id（nanoid/uuid）"),
    startedAt: z
      .number()
      .int()
      .min(0)
      .describe("Run 开始的 UNIX ms 时间戳（列表排序用）"),
    endedAt: z
      .number()
      .int()
      .min(0)
      .nullable()
      .describe("Run 结束 UNIX ms，running 状态为 null"),
    modelId: modelIdSchema,
    promptSummary: z
      .string()
      .min(1)
      .max(500)
      .describe("prompt 首行截断摘要，列表行显示 ≤ 60 字符由前端再截"),
    status: runStatusSchema,
    totalDurationMs: z
      .number()
      .int()
      .min(0)
      .max(24 * 60 * 60_000)
      .describe("总耗时毫秒（= endedAt - startedAt，running 状态为 0）"),
    totalPromptTokens: z.number().int().min(0).max(10_000_000).default(0),
    totalCompletionTokens: z.number().int().min(0).max(10_000_000).default(0),
    errorMessage: z
      .string()
      .max(1000)
      .nullable()
      .describe("Run 级错误摘要，只在 status=error 时非空"),
  })
  .describe("RunHistory 列表的行记录");

export type Run = z.infer<typeof runSchema>;

/* -------------------------------------------------------------------------- *
 * 游标分页（cursor-based）
 * -------------------------------------------------------------------------- */

export const runCursorSchema = z
  .object({
    startedAt: z.number().int().min(0),
    runId: z.string().min(1).max(64).describe("tiebreaker：同毫秒时间戳下的排序依据"),
  })
  .describe("游标：(startedAt, runId) 复合，避免同毫秒丢记录");

export type RunCursor = z.infer<typeof runCursorSchema>;

export const runFilterSchema = z
  .object({
    status: z.enum(["all", "success", "error"]).default("all"),
    modelId: z.string().min(1).max(64).optional(),
    timeRangeMs: z
      .number()
      .int()
      .min(60_000)
      .max(90 * 24 * 60 * 60_000)
      .optional()
      .describe("相对当前时间的往回毫秒范围（1min ~ 90d）；不填表示全部"),
  })
  .describe("列表筛选条件，三段可叠加（交集）");

export type RunFilter = z.infer<typeof runFilterSchema>;

export const runListQuerySchema = z.object({
  cursor: runCursorSchema.optional(),
  limit: z.number().int().min(1).max(50).default(50),
  filter: runFilterSchema.default({ status: "all" }),
});

export type RunListQuery = z.infer<typeof runListQuerySchema>;

export const runListResponseSchema = z.object({
  runs: z.array(runSchema).max(50),
  nextCursor: runCursorSchema.nullable().describe("下一页游标；null 表示已到底"),
});

export type RunListResponse = z.infer<typeof runListResponseSchema>;

/* -------------------------------------------------------------------------- *
 * 树 ↔ 扁平 转换（DB ↔ UI 的唯一桥）
 * -------------------------------------------------------------------------- */

/** 扁平行列表还原成 span 树（按 startMs 升序稳定排序） */
export function buildSpanTree(rows: SpanRow[]): Span | null {
  if (rows.length === 0) return null;
  const byId = new Map<string, Span>();
  for (const row of rows) {
    byId.set(row.spanId, {
      spanId: row.spanId,
      parentSpanId: row.parentSpanId,
      kind: row.kind,
      name: row.name,
      startMs: row.startMs,
      durationMs: row.durationMs,
      status: row.status,
      input: row.inputJson ? safeJsonParse(row.inputJson) : undefined,
      output: row.outputJson ? safeJsonParse(row.outputJson) : undefined,
      error: row.error ?? undefined,
      promptTokens: row.promptTokens ?? undefined,
      completionTokens: row.completionTokens ?? undefined,
      model: row.model ?? undefined,
      children: [],
    });
  }
  let root: Span | null = null;
  for (const span of byId.values()) {
    if (span.parentSpanId === null) {
      root = span;
    } else {
      const parent = byId.get(span.parentSpanId);
      if (parent) parent.children.push(span);
      // 孤儿 span（父不在同次查询内）丢弃，避免残树
    }
  }
  // 同级按 startMs 排序，保证瀑布图上而下的视觉一致性
  const sortTree = (s: Span) => {
    s.children.sort((a, b) => a.startMs - b.startMs);
    s.children.forEach(sortTree);
  };
  if (root) sortTree(root);
  return root;
}

/** 树拍平成 DB 行（写入前用） */
export function flattenSpanTree(root: Span, runId: string): SpanRow[] {
  const rows: SpanRow[] = [];
  const walk = (span: Span) => {
    rows.push({
      spanId: span.spanId,
      runId,
      parentSpanId: span.parentSpanId,
      kind: span.kind,
      name: span.name,
      startMs: span.startMs,
      durationMs: span.durationMs,
      status: span.status,
      inputJson: span.input === undefined ? null : JSON.stringify(span.input),
      outputJson: span.output === undefined ? null : JSON.stringify(span.output),
      error: span.error ?? null,
      promptTokens: span.promptTokens ?? null,
      completionTokens: span.completionTokens ?? null,
      model: span.model ?? null,
    });
    span.children.forEach(walk);
  };
  walk(root);
  return rows;
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s; // 不合法 JSON 按原字符串留回
  }
}

/* -------------------------------------------------------------------------- *
 * 使用示例（非流式路径，入库前 / API 边界校验）
 * -------------------------------------------------------------------------- */

/*
// 1) Playground 完成后构造 span 树，写入前校验并拍平：
const rootSpan: Span = { ...build span tree... };
const parsed = spanSchema.parse(rootSpan);            // 抛错，受信任内部代码
const rows = flattenSpanTree(parsed, runId);
await db.insert(schema.spans).values(rows);

// 2) RunHistory 列表 API 入口：
const query = runListQuerySchema.safeParse(await req.json());
if (!query.success) return Response.json(query.error.format(), { status: 400 });

// 3) 详情 API：DB 读出扁平行 → 还原树 → 给前端：
const rows: SpanRow[] = await db.select().from(schema.spans).where(eq(schema.spans.runId, runId));
const tree = buildSpanTree(rows);                    // null 表示空 Run（UI 给空态）
*/
