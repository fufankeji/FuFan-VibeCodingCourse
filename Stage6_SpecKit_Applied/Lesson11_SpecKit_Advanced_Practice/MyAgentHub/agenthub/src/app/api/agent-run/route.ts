// ============================================================
// 流式 AI API Route · /api/agent-run
// ------------------------------------------------------------
// provider    = OpenAI-compatible                ← OpenRouter / Azure / 自建也能用
// baseURL     = OPENAI_BASE_URL env（可选）       ← 未设就走官方 OpenAI
// model       = openai/gpt-5.4-mini (OpenRouter 命名，2026-04 默认)
//              其他 OpenRouter 可选:
//              - openai/gpt-5.4-nano          ($0.20/$1.25)  更便宜
//              - anthropic/claude-haiku-4.5   ($1/$5)        Claude 便宜档
//              - anthropic/claude-sonnet-4.6  ($3/$15)       Claude 旗舰
//              - google/gemini-2.5-flash      ($0.30/$2.50)  Google 便宜
//              - google/gemini-2.5-pro        ($1.25/$10)    Google 旗舰
//              - deepseek/deepseek-v3.2       ($0.26/$0.42)  成本王
//              - qwen/qwen3.5-flash-02-23     ($0.07/$0.26)  国产极便宜
// maxDuration = 60 秒                             ← 预估更久就调大
// schema      = @/lib/schemas/agent-output       ← 前后端共用
// ============================================================

import { createOpenAI } from "@ai-sdk/openai";
import { streamObject } from "ai";
import { agentOutputSchema } from "@/lib/schemas/agent-output";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

const DEFAULT_MODEL = process.env.OPENAI_BASE_URL?.includes("openrouter")
  ? "openai/gpt-5.4-mini"
  : "gpt-5.4-mini";

export const runtime = "edge";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { prompt, model } = (await req.json()) as {
    prompt?: string;
    model?: string;
  };

  const userPrompt = (prompt ?? "").trim();
  if (!userPrompt) {
    return new Response("prompt is required", { status: 400 });
  }

  const result = streamObject({
    model: openai(DEFAULT_MODEL),
    schema: agentOutputSchema,
    system:
      "你是一位写作助手。用户会给你一个 prompt，你必须严格遵守传入的 schema 产出结构化响应：" +
      "title 是简洁主标题，sections 是 1-8 段分段正文（合理混用 heading/paragraph/bullet），" +
      "summary 是一句话摘要。" +
      "不要返回纯文本，不要附加解释说明，所有内容必须塞进 schema 的对应字段，一个字段都不能漏。" +
      (model ? `\n\n（前端声明的 UI 模型标签：${model}，仅供参考，实际由后端模型生成。）` : ""),
    prompt: userPrompt,
    onError: ({ error }) => {
      console.error("[api/agent-run] streamObject error:", error);
    },
  });

  return result.toTextStreamResponse();
}
