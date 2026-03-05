import { homedir } from "os";
import { join } from "path";
import { promises as fs } from "fs";
import { logger } from "../utils/logger.js";

// ── Types matching Claude Code CLI format ──

export interface CommandHook {
  type: "command";
  command: string;
  timeout?: number;
  async?: boolean;
}

export interface HttpHook {
  type: "http";
  url: string;
  method?: string;
  headers?: Record<string, string>;
  allowedEnvVars?: string[];
  timeout?: number;
  async?: boolean;
}

export interface PromptHook {
  type: "prompt";
  prompt: string;
  model?: string;
  timeout?: number;
  async?: boolean;
}

export interface AgentHook {
  type: "agent";
  prompt: string;
  model?: string;
  allowToolUse?: boolean;
  timeout?: number;
  async?: boolean;
}

export type HookHandler = CommandHook | HttpHook | PromptHook | AgentHook;

/**
 * A rule groups a matcher with one or more hook handlers.
 * CLI format: { "matcher": "Edit|Write", "hooks": [ { type, command, ... } ] }
 */
export interface HookRule {
  matcher: string;
  hooks: HookHandler[];
}

/**
 * Full hooks config: event name → array of rules.
 * This matches the Claude Code CLI settings.json format exactly.
 */
export type HooksConfig = Record<string, HookRule[]>;

type HooksScope = "user" | "project" | "project-local";

function getSettingsPath(scope: HooksScope, projectPath?: string): string {
  switch (scope) {
    case "user":
      return join(homedir(), ".claude", "settings.json");
    case "project":
      return join(projectPath || process.cwd(), ".claude", "settings.json");
    case "project-local":
      return join(projectPath || process.cwd(), ".claude", "settings.local.json");
  }
}

async function readSettings(path: string): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(path, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Read hooks from settings file for the given scope.
 */
export async function listHooks(
  scope: HooksScope = "user",
  projectPath?: string,
): Promise<HooksConfig> {
  const settingsPath = getSettingsPath(scope, projectPath);
  const settings = await readSettings(settingsPath);
  return (settings.hooks as HooksConfig) || {};
}

/**
 * Write hooks to settings file for the given scope.
 * Preserves all other settings keys.
 */
export async function saveHooks(
  hooks: HooksConfig,
  scope: HooksScope = "user",
  projectPath?: string,
): Promise<void> {
  const settingsPath = getSettingsPath(scope, projectPath);
  const settings = await readSettings(settingsPath);

  // Clean empty rules
  const cleaned: HooksConfig = {};
  for (const [event, rules] of Object.entries(hooks)) {
    const validRules = rules.filter((r) => r.hooks && r.hooks.length > 0);
    if (validRules.length > 0) cleaned[event] = validRules;
  }

  if (Object.keys(cleaned).length > 0) {
    settings.hooks = cleaned;
  } else {
    delete settings.hooks;
  }

  const dir = join(settingsPath, "..");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
  logger.info(`[hooksService] hooks updated (${scope}): ${Object.keys(cleaned).join(", ") || "(cleared)"}`);
}
