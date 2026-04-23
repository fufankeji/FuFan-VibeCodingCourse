import { z } from "zod";

/* -------------------------------------------------------------------------- *
 * Playground 结构化响应 Schema (SSOT · 前后端共用)
 * 来源：specs/001-playground/plan.md §3
 * -------------------------------------------------------------------------- */

/** 5 个模型的 UI id（与 src/lib/playground/models.ts 对齐） */
export const playgroundModelIdSchema = z
  .enum([
    "gpt-5.3",
    "claude-4.7",
    "gemini-3.1-flash",
    "deepseek-v3.2",
    "qwen-3.5-flash",
  ])
  .describe("模型选择器中可选的 5 个模型 id，必须从枚举中选一个");

export type PlaygroundModelId = z.infer<typeof playgroundModelIdSchema>;

/* ------------------------------- 请求 schema ------------------------------ */

export const playgroundRequestSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .max(50_000)
    .describe("用户输入的 prompt，去首尾空白后非空，硬上限 50000 字防止误粘贴"),
  modelId: playgroundModelIdSchema,
});

export type PlaygroundRequest = z.infer<typeof playgroundRequestSchema>;

/* ------------------------------- 响应 schema ------------------------------ */

export const thinkingStepSchema = z.object({
  title: z.string().min(1).max(80).describe("思考步骤的标题，一句话"),
  content: z
    .string()
    .max(2000)
    .optional()
    .describe("（流式可晚到）步骤正文；未到时前端显示字段级骨架屏"),
  kind: z
    .enum(["analyze", "plan", "verify", "decide"])
    .optional()
    .describe("步骤类型：分析 / 规划 / 验证 / 决策；用于前端着色与图标"),
});

export const thinkingBlockSchema = z.object({
  summary: z.string().min(1).max(200).optional().describe("思考总览，一句话"),
  steps: z
    .array(thinkingStepSchema)
    .min(1)
    .max(20)
    .optional()
    .describe("思考步骤列表，1 到 20 条"),
});

export const toolCallSchema = z.object({
  toolName: z.string().min(1).max(64).describe("工具名称"),
  input: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("（流式可晚到）工具入参 JSON 对象"),
  output: z
    .string()
    .max(10_000)
    .optional()
    .describe("（流式可晚到）工具返回，JSON 字符串或纯文本"),
  durationMs: z
    .number()
    .int()
    .min(0)
    .max(120_000)
    .optional()
    .describe("工具调用耗时（毫秒），0 到 120000"),
  status: z
    .enum(["ok", "error", "timeout"])
    .optional()
    .describe("工具调用状态：成功 / 失败 / 超时"),
});

export const responseMetadataSchema = z.object({
  modelId: playgroundModelIdSchema.describe("本次响应实际使用的模型 id"),
  promptTokens: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("输入 token 数；流式过程中可能未计"),
  completionTokens: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("输出 token 数；流式过程中可能未计"),
  elapsedMs: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("从请求到当前的耗时（毫秒）"),
});

export const playgroundResponseSchema = z
  .object({
    thinking: thinkingBlockSchema
      .optional()
      .describe("（可选）思考过程时间线；无此块时前端不渲染思考卡"),
    toolCalls: z
      .array(toolCallSchema)
      .max(20)
      .optional()
      .describe("（可选）工具调用列表，最多 20 条；无调用时前端不渲染工具卡"),
    finalAnswer: z
      .string()
      .min(1)
      .max(20_000)
      .optional()
      .describe("（流式最后到达）最终答案 markdown 原文；不含 KaTeX 公式"),
    metadata: responseMetadataSchema
      .optional()
      .describe("（可选）本次响应的元数据：模型、token、耗时"),
  })
  .describe(
    "Playground 结构化响应。顶层字段全部 optional，支撑流式字段级渐进渲染。",
  );

export type PlaygroundResponse = z.infer<typeof playgroundResponseSchema>;

/* ------------------------------- 错误 schema ------------------------------ */

export const playgroundErrorCategorySchema = z.enum([
  "network",
  "auth",
  "rate_limit",
  "context_too_long",
  "upstream_timeout",
  "schema_parse_error",
  "unknown",
]);

export type PlaygroundErrorCategory = z.infer<
  typeof playgroundErrorCategorySchema
>;

export const playgroundErrorSchema = z.object({
  category: playgroundErrorCategorySchema.describe("错误分类（6 档 + unknown 兜底）"),
  message: z
    .string()
    .min(1)
    .max(500)
    .describe("面向用户的错误文案，必须来自 errors.ts 映射，禁止直出原始错误"),
  retryable: z.boolean().describe("是否允许前端一键重试"),
  originalHint: z
    .string()
    .max(1000)
    .optional()
    .describe("（可选）原始错误摘要，供「查看详情」抽屉展开"),
});

export type PlaygroundError = z.infer<typeof playgroundErrorSchema>;

/* -------------------------------------------------------------------------- *
 * 使用示例
 * -------------------------------------------------------------------------- */

/*
// —— 流式路径（前端，通过 useObject 消费）——
//   详见 src/app/playground/_components/response-area.tsx
//
//   import { experimental_useObject as useObject } from "@ai-sdk/react";
//   const { object, submit, isLoading, error, stop } = useObject({
//     api: "/api/playground/stream",
//     schema: playgroundResponseSchema,
//   });

// —— 非流式校验（服务端回验 / 入库前）——
//   适用于 RunHistory 另存场景、e2e 测试断言、日志归档：

const parsed = playgroundResponseSchema.parse(rawJson);     // 抛错，受信任场景
const result = playgroundResponseSchema.safeParse(rawJson); // 不抛，受控错误
if (!result.success) {
  console.error(result.error.format());                      // 结构化错误，可直接喂前端
}

// —— 请求体校验（Edge API Route 入口）——
const reqParse = playgroundRequestSchema.safeParse(await req.json());
if (!reqParse.success) {
  return Response.json({ category: "schema_parse_error", message: "请求格式错误", retryable: false }, { status: 400 });
}
*/
