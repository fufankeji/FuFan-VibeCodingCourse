import { findModel, type ModelPricing } from "@/lib/schemas/model-pricing";

/**
 * 粗估 token 数：按 4 字符 ≈ 1 token（Edge 兼容，不依赖 tiktoken）。
 * 中英混排时偏差在 ±30%，适合实时预警，不用于计费。
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * 估算一次调用的成本（USD），假设输出约等于输入长度（简化）。
 * 需要更精确可拆成 input/output 两路。
 */
export function estimateCost(
  text: string,
  modelId: string,
  outputRatio = 1,
): { inputTokens: number; outputTokens: number; costUSD: number } {
  const model = findModel(modelId);
  const inputTokens = estimateTokens(text);
  const outputTokens = Math.ceil(inputTokens * outputRatio);
  if (!model) {
    return { inputTokens, outputTokens, costUSD: 0 };
  }
  const costUSD =
    (inputTokens / 1_000_000) * model.inputPricePer1M +
    (outputTokens / 1_000_000) * model.outputPricePer1M;
  return { inputTokens, outputTokens, costUSD };
}

export type CostLevel = "green" | "yellow" | "red";

/**
 * 绿/黄/红 三级预警。阈值可自定。
 * 默认：< $0.01 绿；$0.01 - $0.10 黄；> $0.10 红。
 */
export function levelOf(
  costUSD: number,
  thresholds: { green: number; red: number } = { green: 0.01, red: 0.1 },
): CostLevel {
  if (costUSD < thresholds.green) return "green";
  if (costUSD < thresholds.red) return "yellow";
  return "red";
}

export function formatUSD(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(n);
}

export type { ModelPricing };
