import { spawn } from "child_process";
import { homedir } from "os";
import { promises as fs } from "fs";
import { join } from "path";
import { logger } from "../utils/logger.js";

export interface PluginInfo {
  name: string;
  version?: string;
  author?: string;
  description?: string;
  enabled: boolean;
  scope?: string;
  marketplace?: string;
  installPath?: string;
  gitCommitSha?: string;
  installedAt?: string;
  components?: {
    skills?: string[];
    mcpServers?: string[];
    agents?: string[];
    hooks?: string[];
  };
}

interface InstalledPluginEntry {
  scope: string;
  version?: string;
  installPath: string;
  gitCommitSha?: string;
  installedAt?: string;
}

const PLUGINS_DIR = join(homedir(), ".claude", "plugins");
const INSTALLED_PLUGINS_PATH = join(PLUGINS_DIR, "installed_plugins.json");

export class PluginService {
  private async runClaude(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn("claude", args, {
        shell: true,
        env: { ...process.env },
      });
      let stdout = "";
      let stderr = "";
      proc.stdout?.on("data", (d: Buffer) => (stdout += d.toString()));
      proc.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));
      proc.on("close", (code: number | null) => {
        if (code !== 0) {
          reject(new Error(stderr || `Exit code ${code}`));
        } else {
          resolve(stdout.trim());
        }
      });
      proc.on("error", reject);
    });
  }

  /**
   * Read installed_plugins.json directly instead of spawning CLI.
   * Also reads each plugin's .claude-plugin/plugin.json for metadata.
   */
  async listPlugins(): Promise<PluginInfo[]> {
    try {
      let raw: string;
      try {
        raw = await fs.readFile(INSTALLED_PLUGINS_PATH, "utf-8");
      } catch {
        return [];
      }

      const data = JSON.parse(raw);
      const installedMap = (data.plugins || {}) as Record<string, InstalledPluginEntry[]>;
      const result: PluginInfo[] = [];

      for (const [key, installs] of Object.entries(installedMap)) {
        if (!Array.isArray(installs) || installs.length === 0) continue;
        const install = installs[0];

        // Read plugin.json for metadata
        let meta: { name?: string; description?: string; author?: { name?: string } } = {};
        try {
          const pluginJsonPath = join(install.installPath, ".claude-plugin", "plugin.json");
          meta = JSON.parse(await fs.readFile(pluginJsonPath, "utf-8"));
        } catch {
          // plugin.json may not exist
        }

        // Scan skills/ directory for component listing
        const components = await this.scanPluginComponents(install.installPath);

        // Parse name and marketplace from key (format: "name@marketplace")
        const atIdx = key.indexOf("@");
        const pluginName = atIdx > 0 ? key.slice(0, atIdx) : key;
        const marketplace = atIdx > 0 ? key.slice(atIdx + 1) : undefined;

        result.push({
          name: meta.name || pluginName,
          description: meta.description || "",
          author: meta.author?.name,
          version: install.version?.slice(0, 8),
          scope: install.scope || "user",
          enabled: true,
          marketplace,
          installPath: install.installPath,
          gitCommitSha: install.gitCommitSha,
          installedAt: install.installedAt,
          components,
        });
      }

      return result;
    } catch (err) {
      logger.error("Failed to list plugins:", err);
      return [];
    }
  }

  private async scanPluginComponents(installPath: string): Promise<PluginInfo["components"]> {
    const components: PluginInfo["components"] = {};

    // Scan skills/
    try {
      const skillsDir = join(installPath, "skills");
      const entries = await fs.readdir(skillsDir, { withFileTypes: true });
      components.skills = entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch {
      // no skills directory
    }

    return components;
  }

  async installPlugin(name: string, scope?: string): Promise<void> {
    const args = ["plugin", "install", name];
    if (scope) args.push("-s", scope);
    await this.runClaude(args);
  }

  async uninstallPlugin(name: string): Promise<void> {
    await this.runClaude(["plugin", "uninstall", name]);
  }

  async togglePlugin(name: string, enabled: boolean): Promise<void> {
    if (enabled) {
      await this.runClaude(["plugin", "enable", name]);
    } else {
      await this.runClaude(["plugin", "disable", name]);
    }
  }
}
