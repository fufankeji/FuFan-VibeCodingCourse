import { homedir } from "os";
import { join } from "path";
import { promises as fs, existsSync } from "fs";
import { logger } from "../utils/logger.js";

const SETTINGS_PATH = join(homedir(), ".claude", "settings.json");
const CLAUDE_DIR = join(homedir(), ".claude");

export interface ClaudeSettings {
  env?: Record<string, string>;
  [key: string]: unknown;
}

/** Read ~/.claude/settings.json; returns {} if missing or corrupt */
export async function readClaudeSettings(): Promise<ClaudeSettings> {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf-8");
    return JSON.parse(raw) as ClaudeSettings;
  } catch {
    return {};
  }
}

/**
 * Merge env entries into ~/.claude/settings.json.
 * Pass `undefined` or `""` for a key to remove it.
 */
export async function writeClaudeSettingsEnv(
  env: Record<string, string | undefined>
): Promise<void> {
  const settings = await readClaudeSettings();
  const existing: Record<string, string> = { ...(settings.env ?? {}) };

  for (const [k, v] of Object.entries(env)) {
    if (v === undefined || v === "") {
      delete existing[k];
    } else {
      existing[k] = v;
    }
  }

  if (Object.keys(existing).length > 0) {
    settings.env = existing;
  } else {
    delete settings.env;
  }

  await fs.mkdir(CLAUDE_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
  logger.info(`[claudeSettings] env updated: ${Object.keys(existing).join(", ") || "(cleared)"}`);
}

/** Check if OAuth credentials file exists */
export function hasOAuthCredentials(): boolean {
  return existsSync(join(CLAUDE_DIR, ".credentials.json"));
}
