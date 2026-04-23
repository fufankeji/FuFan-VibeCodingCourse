import { z } from "zod";

const serverSchema = z.object({
  OPENAI_API_KEY: z
    .string()
    .startsWith("sk-", "OPENAI_API_KEY 必须以 sk- 开头")
    .describe("OpenAI API Key，用于调用 GPT 模型；从 platform.openai.com/api-keys 获取"),
  ANTHROPIC_API_KEY: z
    .string()
    .startsWith("sk-ant-", "ANTHROPIC_API_KEY 必须以 sk-ant- 开头")
    .describe("Anthropic API Key，用于调用 Claude 模型；从 console.anthropic.com/settings/keys 获取"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("NEXT_PUBLIC_APP_URL 必须是合法 URL")
    .describe("应用对外 URL，用于 OAuth 回调 / 分享链接；本地填 http://localhost:3000"),
});

const sharedSchema = z.object({});

const processEnv = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
};

const merged = serverSchema.merge(clientSchema).merge(sharedSchema);

const parsed = merged.safeParse(processEnv);

if (!parsed.success) {
  const flat = parsed.error.flatten().fieldErrors;
  const lines = Object.entries(flat).map(
    ([k, msgs]) => `  - ${k}: ${(msgs ?? []).join("; ")}`,
  );
  throw new Error(
    "❌ 环境变量校验失败：\n" +
      lines.join("\n") +
      "\n\n请对照 .env.example 检查 .env.local，确保所有必填变量都填了且格式正确。",
  );
}

export const env = parsed.data;
