import { spawn } from "child_process";
import { homedir } from "os";
import { promises as fs } from "fs";
import { join } from "path";
import { logger } from "../utils/logger.js";

interface McpServerConfig {
  type?: string;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

interface McpServer {
  name: string;
  transport: string;
  url?: string;
  command?: string;
  args?: string[];
  scope: string;
  status: string;
}

const CLAUDE_JSON = join(homedir(), ".claude.json");

export class McpService {
  private async runClaude(args: string[], customEnv?: Record<string, string>): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn("claude", args, {
        shell: true,
        env: customEnv || { ...process.env },
      });
      let stdout = "";
      let stderr = "";
      proc.stdout?.on("data", (d) => (stdout += d.toString()));
      proc.stderr?.on("data", (d) => (stderr += d.toString()));
      proc.on("close", (code) => {
        if (code !== 0) {
          logger.warn(`claude mcp command failed: ${stderr}`);
          reject(new Error(stderr || `Exit code ${code}`));
        } else {
          resolve(stdout.trim());
        }
      });
      proc.on("error", reject);
    });
  }

  /**
   * Read ~/.claude.json to extract MCP servers.
   * User-level: top-level `mcpServers` key
   * Project-level: `projects[projectPath].mcpServers`
   */
  private async readClaudeJson(): Promise<Record<string, unknown>> {
    try {
      const raw = await fs.readFile(CLAUDE_JSON, "utf-8");
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  async listServers(projectPath?: string): Promise<McpServer[]> {
    try {
      const data = await this.readClaudeJson();
      const servers: McpServer[] = [];

      // User-level servers (top-level mcpServers)
      const userServers = (data.mcpServers || {}) as Record<string, McpServerConfig>;
      for (const [name, config] of Object.entries(userServers)) {
        servers.push(this.configToServer(name, config, "user"));
      }

      // Project-level servers
      if (projectPath) {
        const projects = (data.projects || {}) as Record<string, { mcpServers?: Record<string, McpServerConfig> }>;
        // Normalize both key and lookup path to forward-slashes for cross-platform match
        const normKey = projectPath.replace(/\\/g, "/");
        const projectData = Object.entries(projects).find(
          ([k]) => k.replace(/\\/g, "/") === normKey
        )?.[1];
        if (projectData?.mcpServers) {
          for (const [name, config] of Object.entries(projectData.mcpServers)) {
            // Skip if already added from user level
            if (!servers.some((s) => s.name === name)) {
              servers.push(this.configToServer(name, config, "project"));
            }
          }
        }
      }

      return servers;
    } catch (err) {
      logger.error("Failed to list MCP servers:", err);
      return [];
    }
  }

  private configToServer(name: string, config: McpServerConfig, scope: string): McpServer {
    const transport = config.type || (config.url ? "http" : config.command ? "stdio" : "unknown");
    return {
      name,
      transport,
      url: config.url,
      command: config.command,
      args: config.args,
      scope,
      status: "unknown",
    };
  }

  async addServer(opts: {
    name: string;
    transport: string;
    url?: string;
    command?: string;
    args?: string[];
    scope?: string;
    env?: Record<string, string>;
    headers?: Record<string, string>;
    clientId?: string;
    clientSecret?: string;
    callbackPort?: number;
  }): Promise<void> {
    const cmdArgs = ["mcp", "add", opts.name];

    if (opts.transport) {
      cmdArgs.push("--transport", opts.transport);
    }
    if (opts.scope) {
      cmdArgs.push("--scope", opts.scope);
    }

    // Environment variables
    for (const [k, v] of Object.entries(opts.env || {})) {
      if (k && v) cmdArgs.push("-e", `${k}=${v}`);
    }

    // HTTP headers (http/sse only)
    for (const [k, v] of Object.entries(opts.headers || {})) {
      if (k && v) cmdArgs.push("-H", `${k}: ${v}`);
    }

    // OAuth options
    if (opts.clientId) {
      cmdArgs.push("--client-id", opts.clientId);
    }
    if (opts.callbackPort) {
      cmdArgs.push("--callback-port", String(opts.callbackPort));
    }

    if ((opts.transport === "http" || opts.transport === "sse") && opts.url) {
      cmdArgs.push(opts.url);
    } else if (opts.transport === "stdio" && opts.command) {
      cmdArgs.push("--", opts.command, ...(opts.args || []));
    }

    // Pass client secret via env var (CLI --client-secret is interactive)
    const spawnEnv = opts.clientSecret
      ? { ...process.env, MCP_CLIENT_SECRET: opts.clientSecret }
      : undefined;
    await this.runClaude(cmdArgs, spawnEnv);
  }

  async addServerJson(name: string, json: string, scope?: string): Promise<void> {
    const cmdArgs = ["mcp", "add-json", name, json];
    if (scope) {
      cmdArgs.push("--scope", scope);
    }
    await this.runClaude(cmdArgs);
  }

  async removeServer(name: string): Promise<void> {
    await this.runClaude(["mcp", "remove", name]);
  }

  async getServerConfig(
    name: string,
    projectPath?: string
  ): Promise<{ config: McpServerConfig; scope: string } | null> {
    try {
      const data = await this.readClaudeJson();

      // Check project-level first
      if (projectPath) {
        const projects = (data.projects || {}) as Record<string, { mcpServers?: Record<string, McpServerConfig> }>;
        const projectData = projects[projectPath]
          || projects[projectPath.replace(/\\/g, "/")]
          || projects[projectPath.replace(/\//g, "\\")];
        if (projectData?.mcpServers?.[name]) {
          return { config: projectData.mcpServers[name], scope: "project" };
        }
      }

      // Check user-level
      const userServers = (data.mcpServers || {}) as Record<string, McpServerConfig>;
      if (userServers[name]) {
        return { config: userServers[name], scope: "user" };
      }

      return null;
    } catch {
      return null;
    }
  }

  async updateServerConfig(
    name: string,
    config: McpServerConfig,
    scope: string,
    projectPath?: string
  ): Promise<void> {
    const data = await this.readClaudeJson();

    if (scope === "project" && projectPath) {
      const normalizedPath = projectPath.replace(/\\/g, "/");
      if (!data.projects) data.projects = {};
      const projects = data.projects as Record<string, { mcpServers?: Record<string, McpServerConfig> }>;

      // Find existing project key
      const existingKey = Object.keys(projects).find(
        (k) => k === projectPath || k === normalizedPath || k === projectPath.replace(/\//g, "\\")
      );
      const key = existingKey || normalizedPath;

      if (!projects[key]) projects[key] = {};
      if (!projects[key].mcpServers) projects[key].mcpServers = {};
      projects[key].mcpServers![name] = config;
    } else {
      // User-level
      if (!data.mcpServers) data.mcpServers = {};
      (data.mcpServers as Record<string, McpServerConfig>)[name] = config;
    }

    await fs.writeFile(CLAUDE_JSON, JSON.stringify(data, null, 2), "utf-8");
  }

  async importFromDesktop(): Promise<string[]> {
    const output = await this.runClaude(["mcp", "add-from-claude-desktop"]);
    // Parse imported server names from output
    const imported = output.match(/Added: (.+)/g)?.map((m) => m.replace("Added: ", "")) || [];
    return imported;
  }
}
