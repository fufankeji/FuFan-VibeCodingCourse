import { spawn } from "child_process";
import { homedir } from "os";
import { promises as fs } from "fs";
import { join } from "path";
import { logger } from "../utils/logger.js";

export interface MarketplacePlugin {
  name: string;
  description: string;
  author: string;
  marketplace: string;
  installed: boolean;
  installCount?: number;
  isExternal: boolean;
}

interface Marketplace {
  name: string;
  source: string;
}

interface InstalledPluginEntry {
  scope: string;
  installPath: string;
  version?: string;
}

const PLUGINS_DIR = join(homedir(), ".claude", "plugins");
const KNOWN_MARKETPLACES_PATH = join(PLUGINS_DIR, "known_marketplaces.json");
const INSTALLED_PLUGINS_PATH = join(PLUGINS_DIR, "installed_plugins.json");
const INSTALL_COUNTS_CACHE_PATH = join(PLUGINS_DIR, "install-counts-cache.json");
const MARKETPLACES_DIR = join(PLUGINS_DIR, "marketplaces");

export class MarketplaceService {
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

  async listMarketplaces(): Promise<Marketplace[]> {
    try {
      const raw = await fs.readFile(KNOWN_MARKETPLACES_PATH, "utf-8");
      const data = JSON.parse(raw);
      // Format: { "marketplaces": { "name": "source" } } or array
      if (data.marketplaces && typeof data.marketplaces === "object") {
        return Object.entries(data.marketplaces).map(([name, source]) => ({
          name,
          source: source as string,
        }));
      }
      if (Array.isArray(data)) {
        return data.map((m: { name: string; source: string }) => ({
          name: m.name || m.source,
          source: m.source || m.name,
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  async listAvailablePlugins(): Promise<MarketplacePlugin[]> {
    try {
      // 1. Read installed plugins for matching
      const installedNames = new Set<string>();
      try {
        const raw = await fs.readFile(INSTALLED_PLUGINS_PATH, "utf-8");
        const data = JSON.parse(raw);
        const installedMap = (data.plugins || {}) as Record<string, InstalledPluginEntry[]>;
        for (const key of Object.keys(installedMap)) {
          const atIdx = key.indexOf("@");
          const pluginName = atIdx > 0 ? key.slice(0, atIdx) : key;
          installedNames.add(pluginName);
        }
      } catch {
        // no installed plugins
      }

      // 2. Read install counts cache
      const installCounts: Record<string, number> = {};
      try {
        const raw = await fs.readFile(INSTALL_COUNTS_CACHE_PATH, "utf-8");
        const data = JSON.parse(raw);
        // Format: { "plugin-name": { "unique_installs": 12345 } } or similar
        if (data && typeof data === "object") {
          for (const [name, info] of Object.entries(data)) {
            if (typeof info === "object" && info !== null) {
              installCounts[name] = (info as { unique_installs?: number }).unique_installs || 0;
            } else if (typeof info === "number") {
              installCounts[name] = info;
            }
          }
        }
      } catch {
        // no cache
      }

      // 3. Scan marketplace directories
      const result: MarketplacePlugin[] = [];
      let marketplaceDirs: string[];
      try {
        const entries = await fs.readdir(MARKETPLACES_DIR, { withFileTypes: true });
        marketplaceDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
      } catch {
        return [];
      }

      for (const marketplaceName of marketplaceDirs) {
        const marketplaceDir = join(MARKETPLACES_DIR, marketplaceName);

        // Scan plugins/ (official)
        await this.scanPluginDir(
          join(marketplaceDir, "plugins"),
          marketplaceName,
          false,
          installedNames,
          installCounts,
          result
        );

        // Scan external_plugins/
        await this.scanPluginDir(
          join(marketplaceDir, "external_plugins"),
          marketplaceName,
          true,
          installedNames,
          installCounts,
          result
        );
      }

      // Sort by install count descending
      result.sort((a, b) => (b.installCount || 0) - (a.installCount || 0));

      return result;
    } catch (err) {
      logger.error("Failed to list available plugins:", err);
      return [];
    }
  }

  private async scanPluginDir(
    dir: string,
    marketplace: string,
    isExternal: boolean,
    installedNames: Set<string>,
    installCounts: Record<string, number>,
    result: MarketplacePlugin[]
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        // Read .claude-plugin/plugin.json
        const pluginJsonPath = join(dir, entry.name, ".claude-plugin", "plugin.json");
        try {
          const raw = await fs.readFile(pluginJsonPath, "utf-8");
          const meta = JSON.parse(raw) as {
            name?: string;
            description?: string;
            author?: { name?: string };
          };

          const name = meta.name || entry.name;
          result.push({
            name,
            description: meta.description || "",
            author: meta.author?.name || "",
            marketplace,
            installed: installedNames.has(name),
            installCount: installCounts[name],
            isExternal,
          });
        } catch {
          // plugin.json not found or invalid, add with minimal info
          result.push({
            name: entry.name,
            description: "",
            author: "",
            marketplace,
            installed: installedNames.has(entry.name),
            installCount: installCounts[entry.name],
            isExternal,
          });
        }
      }
    } catch {
      // directory doesn't exist
    }
  }

  async updateMarketplace(name?: string): Promise<void> {
    const args = ["plugin", "marketplace", "update"];
    if (name) args.push(name);
    await this.runClaude(args);
  }

  async installPlugin(name: string, scope?: string): Promise<void> {
    const args = ["plugin", "install", name];
    if (scope) args.push("-s", scope);
    await this.runClaude(args);
  }
}
