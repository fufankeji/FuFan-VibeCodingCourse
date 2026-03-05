import { useSystemStore } from "../stores/systemStore";
import { useConfigStore } from "../stores/configStore";

export type ClaudeStatus = "not-installed" | "unauthorized" | "ready";

/**
 * Derive 3-state Claude Code status from system store + in-memory API key.
 *
 * 🔴 not-installed  — claude CLI not found
 * 🟡 unauthorized   — installed but no OAuth / API key
 * 🟢 ready          — installed + authorized (OAuth OR in-memory API key OR domestic base URL)
 */
export function useClaudeStatus(): ClaudeStatus {
  const { claudeInfo, authStatus, claudeSettingsEnv } = useSystemStore();
  const { apiKey } = useConfigStore();

  // Prefer authStatus (more accurate); fall back to claudeInfo.installed
  const installed = authStatus?.installed ?? claudeInfo?.installed ?? true;

  if (!installed) return "not-installed";

  const oauthOk   = authStatus?.authMethod === "oauth";
  const apiKeyOk  = authStatus?.authMethod === "apikey";
  const memKeyOk  = !!apiKey;
  const domesticOk = !!claudeSettingsEnv.ANTHROPIC_BASE_URL;

  if (oauthOk || apiKeyOk || memKeyOk || domesticOk) return "ready";
  return "unauthorized";
}
