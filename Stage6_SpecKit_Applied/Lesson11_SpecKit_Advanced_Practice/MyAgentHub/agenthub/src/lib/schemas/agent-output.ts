import { z } from "zod";

export const sectionSchema = z.object({
  type: z
    .enum(["heading", "paragraph", "bullet"])
    .describe("段落类型：heading=小标题，paragraph=正文段，bullet=要点列表项"),
  content: z
    .string()
    .min(1)
    .max(500)
    .describe("段落正文，单段不超过 500 字，保持可阅读的呼吸感"),
});

export const agentOutputSchema = z.object({
  title: z
    .string()
    .min(2)
    .max(80)
    .describe("响应主标题，简洁直白，2-80 字"),
  sections: z
    .array(sectionSchema)
    .min(1)
    .max(8)
    .describe(
      "分段正文，1-8 段；合理混用 heading/paragraph/bullet，避免全是 paragraph 的大块文字",
    ),
  summary: z
    .string()
    .min(10)
    .max(200)
    .describe("一句话摘要，10-200 字，用于顶部概览"),
});

export type AgentOutput = z.infer<typeof agentOutputSchema>;
export type AgentOutputSection = z.infer<typeof sectionSchema>;
