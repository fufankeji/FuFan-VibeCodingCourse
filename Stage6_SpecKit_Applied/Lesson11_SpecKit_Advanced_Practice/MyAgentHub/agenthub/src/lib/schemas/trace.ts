import { z } from "zod";

export const traceStepTypeSchema = z
  .enum(["llm", "tool", "retrieval", "agent"])
  .describe(
    "节点类型：llm=模型调用，tool=工具调用，retrieval=知识检索，agent=子 Agent 嵌套",
  );

export const traceStepStatusSchema = z
  .enum(["success", "error", "running"])
  .describe("执行状态：success=成功，error=失败，running=进行中");

export type TraceStep = {
  stepId: string;
  parentStepId: string | null;
  type: z.infer<typeof traceStepTypeSchema>;
  name: string;
  durationMs: number;
  status: z.infer<typeof traceStepStatusSchema>;
  children: TraceStep[];
};

export const traceStepSchema: z.ZodType<TraceStep> = z.lazy(() =>
  z.object({
    stepId: z
      .string()
      .min(1)
      .max(64)
      .describe("节点唯一 id，用于 React key 与父子关联"),
    parentStepId: z
      .string()
      .min(1)
      .max(64)
      .nullable()
      .describe("父节点 id；根节点为 null"),
    type: traceStepTypeSchema,
    name: z
      .string()
      .min(1)
      .max(80)
      .describe("节点展示名，如 'LLM:openai/gpt-5.4-mini' / 'Tool:web_search'"),
    durationMs: z
      .number()
      .int()
      .min(0)
      .max(600_000)
      .describe("耗时毫秒，上限 10 分钟，便于瀑布图 x 轴映射"),
    status: traceStepStatusSchema,
    children: z
      .array(traceStepSchema)
      .max(20)
      .default([])
      .describe("子节点数组，扁平化扇出上限 20；无子节点时为空数组而非 null"),
  }),
);

export const traceSchema = z
  .object({
    traceId: z.string().min(1).max(64).describe("Trace 唯一 id"),
    rootStep: traceStepSchema.describe("递归 span 树的根节点"),
  })
  .describe("一次完整 AI 调用的 Trace，包裹一棵 span 树");

export type Trace = z.infer<typeof traceSchema>;
