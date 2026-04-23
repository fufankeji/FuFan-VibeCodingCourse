// ============================================================
// Playground 模型注册表 (SSOT)
// ------------------------------------------------------------
// uiId              前端 & 请求体里使用的稳定 id（与 schemas/playground.ts 枚举对齐）
// providerRouteId   实际发给 OpenRouter / 兼容网关的 provider id
// 前端换 id 只改这张表即可，不用动 API 层
// ============================================================

import type { PlaygroundModelId } from "@/lib/schemas/playground";

export type ModelEntry = {
  uiId: PlaygroundModelId;
  displayName: string;
  provider: "openai" | "anthropic" | "google" | "deepseek" | "qwen";
  providerRouteId: string;
  contextWindow: number;
  structuredOutputSupport: "native" | "prompt-engineered" | "unreliable";
  enabled: boolean;
};

export const PLAYGROUND_MODELS: Record<PlaygroundModelId, ModelEntry> = {
  "gpt-5.3": {
    uiId: "gpt-5.3",
    displayName: "GPT-5.3",
    provider: "openai",
    providerRouteId: "openai/gpt-5.3",
    contextWindow: 200_000,
    structuredOutputSupport: "native",
    enabled: true,
  },
  "claude-4.7": {
    uiId: "claude-4.7",
    displayName: "Claude 4.7",
    provider: "anthropic",
    providerRouteId: "anthropic/claude-opus-4.7",
    contextWindow: 200_000,
    structuredOutputSupport: "native",
    enabled: true,
  },
  "gemini-3.1-flash": {
    uiId: "gemini-3.1-flash",
    displayName: "Gemini 3.1 Flash",
    provider: "google",
    providerRouteId: "google/gemini-3.1-flash",
    contextWindow: 1_000_000,
    structuredOutputSupport: "native",
    enabled: true,
  },
  "deepseek-v3.2": {
    uiId: "deepseek-v3.2",
    displayName: "DeepSeek V3.2",
    provider: "deepseek",
    providerRouteId: "deepseek/deepseek-v3.2",
    contextWindow: 128_000,
    structuredOutputSupport: "prompt-engineered",
    enabled: true,
  },
  "qwen-3.5-flash": {
    uiId: "qwen-3.5-flash",
    displayName: "Qwen 3.5 Flash",
    provider: "qwen",
    providerRouteId: "qwen/qwen3.5-flash",
    contextWindow: 128_000,
    structuredOutputSupport: "prompt-engineered",
    enabled: false, // 实现期冒烟后再开启
  },
};

export function resolveProviderRouteId(uiId: PlaygroundModelId): string {
  return PLAYGROUND_MODELS[uiId].providerRouteId;
}
