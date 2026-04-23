import { z } from "zod";

export const providerSchema = z
  .enum(["openai", "anthropic", "google", "deepseek", "qwen"])
  .describe("模型提供商：openai / anthropic / google / deepseek / qwen（阿里千问）");

export const tierSchema = z
  .enum(["flagship", "balanced", "economy"])
  .describe("档位：flagship=旗舰（最贵最强）、balanced=均衡、economy=经济（最便宜）");

export const modelPricingSchema = z.object({
  id: z
    .string()
    .min(1)
    .describe("模型唯一 ID（OpenRouter 命名空间），用于 API 调用，例：openai/gpt-5.4-mini"),
  displayName: z
    .string()
    .min(1)
    .describe("UI 展示名，人类可读，例：GPT-5.4 Mini"),
  provider: providerSchema,
  tier: tierSchema,
  inputPricePer1M: z
    .number()
    .min(0)
    .max(1000)
    .describe("每百万输入 token 的价格（USD），0-1000 之间"),
  outputPricePer1M: z
    .number()
    .min(0)
    .max(1000)
    .describe("每百万输出 token 的价格（USD），0-1000 之间"),
});

export type ModelPricing = z.infer<typeof modelPricingSchema>;

export const modelPricingTableSchema = z
  .array(modelPricingSchema)
  .min(1)
  .describe("模型定价表，至少包含一条记录");

/**
 * 预填定价数据（2026-04 参考价，按 OpenRouter 公示价，以官网实时价为准）。
 * 改价只改这里一处，UI / 预估器 / 成本计算全链路自动生效。
 */
export const MODEL_PRICING: ModelPricing[] = [
  // ── OpenAI 家族 ───────────────────────────────────────────
  {
    id: "openai/gpt-5.4-nano",
    displayName: "GPT-5.4 Nano",
    provider: "openai",
    tier: "economy",
    inputPricePer1M: 0.2,
    outputPricePer1M: 1.25,
  },
  {
    id: "openai/gpt-5.4-mini",
    displayName: "GPT-5.4 Mini",
    provider: "openai",
    tier: "balanced",
    inputPricePer1M: 0.75,
    outputPricePer1M: 4.5,
  },
  {
    id: "openai/gpt-5.4",
    displayName: "GPT-5.4",
    provider: "openai",
    tier: "flagship",
    inputPricePer1M: 2.5,
    outputPricePer1M: 15,
  },

  // ── Anthropic Claude 家族 ─────────────────────────────────
  {
    id: "anthropic/claude-haiku-4.5",
    displayName: "Claude Haiku 4.5",
    provider: "anthropic",
    tier: "economy",
    inputPricePer1M: 1,
    outputPricePer1M: 5,
  },
  {
    id: "anthropic/claude-sonnet-4.6",
    displayName: "Claude Sonnet 4.6",
    provider: "anthropic",
    tier: "balanced",
    inputPricePer1M: 3,
    outputPricePer1M: 15,
  },
  {
    id: "anthropic/claude-opus-4.7",
    displayName: "Claude Opus 4.7",
    provider: "anthropic",
    tier: "flagship",
    inputPricePer1M: 5,
    outputPricePer1M: 25,
  },

  // ── Google Gemini 家族 ────────────────────────────────────
  {
    id: "google/gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    provider: "google",
    tier: "economy",
    inputPricePer1M: 0.3,
    outputPricePer1M: 2.5,
  },
  {
    id: "google/gemini-2.5-pro",
    displayName: "Gemini 2.5 Pro",
    provider: "google",
    tier: "flagship",
    inputPricePer1M: 1.25,
    outputPricePer1M: 10,
  },

  // ── DeepSeek 家族（国产 · 成本王） ──────────────────────────
  {
    id: "deepseek/deepseek-v3.2",
    displayName: "DeepSeek V3.2",
    provider: "deepseek",
    tier: "economy",
    inputPricePer1M: 0.26,
    outputPricePer1M: 0.42,
  },
  {
    id: "deepseek/deepseek-v3.2-speciale",
    displayName: "DeepSeek V3.2 Speciale",
    provider: "deepseek",
    tier: "balanced",
    inputPricePer1M: 0.4,
    outputPricePer1M: 1.2,
  },

  // ── Qwen 千问家族（国产 · 阿里） ─────────────────────────────
  {
    id: "qwen/qwen3.5-flash-02-23",
    displayName: "Qwen 3.5 Flash",
    provider: "qwen",
    tier: "economy",
    inputPricePer1M: 0.07,
    outputPricePer1M: 0.26,
  },
  {
    id: "qwen/qwen3.6-plus",
    displayName: "Qwen 3.6 Plus",
    provider: "qwen",
    tier: "balanced",
    inputPricePer1M: 0.33,
    outputPricePer1M: 1.95,
  },
];

modelPricingTableSchema.parse(MODEL_PRICING);

export function findModel(id: string): ModelPricing | undefined {
  return MODEL_PRICING.find((m) => m.id === id);
}
