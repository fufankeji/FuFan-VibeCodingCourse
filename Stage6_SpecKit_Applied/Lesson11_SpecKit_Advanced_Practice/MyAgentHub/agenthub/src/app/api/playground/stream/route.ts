// ============================================================
// 流式 AI API Route · /api/playground/stream
// ------------------------------------------------------------
// Feature      specs/001-playground  (plan.md §4)
// Runtime      edge                          (宪法 §5.3 NON-NEGOTIABLE)
// maxDuration  60                            (Vercel Hobby 默认 10s 会截断)
// Provider     OpenAI-compatible gateway     (默认 OpenRouter)
// Schema       @/lib/schemas/playground      (前后端共用 SSOT)
//
// 请求体:
//   { prompt: string(1..50000), modelId: PlaygroundModelId }
//
// 响应:
//   text/plain (Object Stream)  — useObject 消费 partialObject
// 错误:
//   400 / 401 / 403 / 429 / 504 / 500  — 见 plan.md §4.1
// ============================================================

import { createOpenAI } from "@ai-sdk/openai";
import { streamObject } from "ai";
import {
  playgroundErrorSchema,
  playgroundRequestSchema,
  playgroundResponseSchema,
} from "@/lib/schemas/playground";
import {
  PLAYGROUND_MODELS,
  resolveProviderRouteId,
} from "@/lib/playground/models";
import { classifyError } from "@/lib/playground/errors";

// 宪法 §5.1：必须用工厂模式，baseURL 从 env 读取；禁止裸 import(...) 直接指向 api.openai.com
const openai = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL ?? process.env.OPENAI_BASE_URL,
});

export const runtime = "edge";
export const maxDuration = 60;

const SYSTEM_PROMPT = `你是一位严谨的结构化输出 AI Agent。对用户的 prompt，你必须以 JSON 结构作答，严格遵守传入的 schema：

1. 输出顺序：先产 thinking（含 summary 与 steps），再产 toolCalls（如有），最后产 finalAnswer——这是流式字段级渐进渲染的前提
2. 若本次不需要调用任何工具，请**省略** toolCalls 字段（不要给空数组 []）
3. 所有枚举字段必须精确匹配：
   - thinking.steps[].kind ∈ {analyze, plan, verify, decide}
   - toolCalls[].status ∈ {ok, error, timeout}
4. finalAnswer 是 markdown 字符串，禁止使用 $...$ 或 $$...$$ 包裹的数学公式（前端不渲染 KaTeX）
5. 不要返回 schema 之外的字段，不要返回纯文本或附加解释`;

function errorResponse(err: unknown, fallbackStatus = 500): Response {
  const classified = classifyError(err);
  const status =
    classified.category === "auth"
      ? 401
      : classified.category === "rate_limit"
      ? 429
      : classified.category === "context_too_long"
      ? 400
      : classified.category === "upstream_timeout"
      ? 504
      : classified.category === "schema_parse_error"
      ? 400
      : fallbackStatus;

  // 错误体过一次 schema 自校验，保证前端拿到的错误结构稳定
  const body = playgroundErrorSchema.parse(classified);
  return Response.json(body, { status });
}

export async function POST(req: Request) {
  // —— 入口校验 ——
  let raw: unknown;
  try {
    raw = await req.json();
  } catch (err) {
    return errorResponse(err, 400);
  }

  const parsed = playgroundRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      playgroundErrorSchema.parse({
        category: "schema_parse_error",
        message: "请求格式错误：prompt 或 modelId 不合法",
        retryable: false,
        originalHint: parsed.error.message.slice(0, 1000),
      }),
      { status: 400 },
    );
  }

  const { prompt, modelId } = parsed.data;

  const modelEntry = PLAYGROUND_MODELS[modelId];
  if (!modelEntry.enabled) {
    return Response.json(
      playgroundErrorSchema.parse({
        category: "unknown",
        message: `模型 ${modelEntry.displayName} 暂未启用，请在选择器中换一个`,
        retryable: false,
      }),
      { status: 400 },
    );
  }

  // —— 流式生成 ——
  try {
    const result = streamObject({
      model: openai(resolveProviderRouteId(modelId)),
      schema: playgroundResponseSchema,
      system: SYSTEM_PROMPT,
      prompt,
      // 宪法 §5.3：onError 必须设置，禁止静默
      onError: ({ error }) => {
        console.error("[api/playground/stream] streamObject error", {
          modelId,
          error,
        });
      },
    });

    // 宪法 §5.3：只用 toTextStreamResponse()，保证 useObject 能消费
    return result.toTextStreamResponse();
  } catch (err) {
    console.error("[api/playground/stream] fatal", err);
    return errorResponse(err);
  }
}
