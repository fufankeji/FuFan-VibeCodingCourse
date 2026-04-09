import fs from "fs/promises";
import path from "path";
import { getClaudeHome } from "../utils/pathUtils.js";
import { logger } from "../utils/logger.js";
import type { ConfigData } from "../types/api.js";

export class ConfigService {
  private settingsPath = path.join(getClaudeHome(), "settings.json");

  async getConfig(): Promise<ConfigData> {
    try {
      const raw = await fs.readFile(this.settingsPath, "utf-8");
      const settings = JSON.parse(raw);
      return {
        model: settings.model || "opus",
        effort: settings.effortLevel || "high",
        thinking: settings.alwaysThinkingEnabled ?? true,
        autoCompactThreshold: settings.autoCompactThreshold ?? 95,
        httpProxy: settings.httpProxy || "",
        httpsProxy: settings.httpsProxy || "",
        socksProxy: settings.socksProxy || "",
        autoUpdatesChannel: settings.autoUpdatesChannel || "latest",
      };
    } catch {
      return {
        model: "opus",
        effort: "high",
        thinking: true,
        autoCompactThreshold: 95,
        httpProxy: "",
        httpsProxy: "",
        socksProxy: "",
        autoUpdatesChannel: "latest",
      };
    }
  }

  async updateConfig(partial: Partial<ConfigData>): Promise<void> {
    let settings: Record<string, unknown> = {};
    try {
      const raw = await fs.readFile(this.settingsPath, "utf-8");
      settings = JSON.parse(raw);
    } catch {
      // No existing settings
    }

    if (partial.model !== undefined) settings.model = partial.model;
    if (partial.effort !== undefined) settings.effortLevel = partial.effort;
    if (partial.thinking !== undefined)
      settings.alwaysThinkingEnabled = partial.thinking;
    if (partial.autoCompactThreshold !== undefined)
      settings.autoCompactThreshold = partial.autoCompactThreshold;
    if (partial.httpProxy !== undefined) settings.httpProxy = partial.httpProxy;
    if (partial.httpsProxy !== undefined) settings.httpsProxy = partial.httpsProxy;
    if (partial.socksProxy !== undefined) settings.socksProxy = partial.socksProxy;
    if (partial.autoUpdatesChannel !== undefined)
      settings.autoUpdatesChannel = partial.autoUpdatesChannel;

    await fs.mkdir(path.dirname(this.settingsPath), { recursive: true });
    await fs.writeFile(this.settingsPath, JSON.stringify(settings, null, 2));
    logger.info("Config updated");
  }
}
