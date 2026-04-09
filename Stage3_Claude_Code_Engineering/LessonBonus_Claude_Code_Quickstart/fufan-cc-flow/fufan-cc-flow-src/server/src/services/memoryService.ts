import fs from "fs/promises";
import path from "path";
import os from "os";
import { logger } from "../utils/logger.js";

interface MemoryFileInfo {
  name: string;
  preview: string;
  size: number;
  modified: string;
}

export class MemoryService {
  /**
   * Encode a project path the same way Claude Code CLI does:
   * replace path separators, non-ASCII chars, and spaces with `-`,
   * keep only letters, digits, `.`, `_`, `-`.
   */
  private encodeProjectPath(projectPath: string): string {
    return projectPath.replace(/[/\\]/g, "-").replace(/[^\x20-\x7E]/g, "-").replace(/ /g, "-").replace(/:/g, "");
  }

  /**
   * Get the project-specific directory under ~/.claude/projects/<encoded>/
   */
  private getProjectDir(projectPath: string): string {
    const encoded = this.encodeProjectPath(projectPath);
    return path.join(os.homedir(), ".claude", "projects", encoded);
  }

  /**
   * Get the project-specific memory directory path.
   * Claude Code uses an encoded project path (not a hash).
   */
  private getMemoryDir(projectPath: string): string {
    return path.join(this.getProjectDir(projectPath), "memory");
  }

  private getClaudeHome(): string {
    return path.join(os.homedir(), ".claude");
  }

  // ── Auto Memory ──

  async getAutoMemory(projectPath: string): Promise<{
    enabled: boolean;
    memoryDir: string;
    index: {
      path: string;
      content: string;
      lineCount: number;
      maxAutoLoadLines: number;
      size: number;
      modified: string;
    } | null;
    topicFiles: MemoryFileInfo[];
  }> {
    const memoryDir = this.getMemoryDir(projectPath);
    const enabled = await this.isAutoMemoryEnabled();

    let index = null;
    const topicFiles: MemoryFileInfo[] = [];

    try {
      const memoryMdPath = path.join(memoryDir, "MEMORY.md");
      const stat = await fs.stat(memoryMdPath);
      const content = await fs.readFile(memoryMdPath, "utf-8");
      index = {
        path: "MEMORY.md",
        content,
        lineCount: content.split("\n").length,
        maxAutoLoadLines: 200,
        size: stat.size,
        modified: stat.mtime.toISOString(),
      };
    } catch {
      // MEMORY.md doesn't exist yet
    }

    try {
      const entries = await fs.readdir(memoryDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || entry.name === "MEMORY.md") continue;
        if (!entry.name.endsWith(".md")) continue;

        const filePath = path.join(memoryDir, entry.name);
        const stat = await fs.stat(filePath);
        const content = await fs.readFile(filePath, "utf-8");
        const preview = content.slice(0, 100).replace(/\n/g, " ");

        topicFiles.push({
          name: entry.name,
          preview,
          size: stat.size,
          modified: stat.mtime.toISOString(),
        });
      }
    } catch {
      // memory directory doesn't exist yet
    }

    return { enabled, memoryDir, index, topicFiles };
  }

  async getMemoryFile(
    projectPath: string,
    filename: string
  ): Promise<{ name: string; content: string; lineCount: number; size: number } | null> {
    const memoryDir = this.getMemoryDir(projectPath);
    const filePath = path.join(memoryDir, filename);

    try {
      const stat = await fs.stat(filePath);
      const content = await fs.readFile(filePath, "utf-8");
      return {
        name: filename,
        content,
        lineCount: content.split("\n").length,
        size: stat.size,
      };
    } catch {
      return null;
    }
  }

  async saveMemoryFile(
    projectPath: string,
    filename: string,
    content: string
  ): Promise<{ lineCount: number }> {
    const memoryDir = this.getMemoryDir(projectPath);
    await fs.mkdir(memoryDir, { recursive: true });
    await fs.writeFile(path.join(memoryDir, filename), content, "utf-8");
    return { lineCount: content.split("\n").length };
  }

  async deleteMemoryFile(projectPath: string, filename: string): Promise<boolean> {
    const memoryDir = this.getMemoryDir(projectPath);
    try {
      await fs.unlink(path.join(memoryDir, filename));
      return true;
    } catch {
      return false;
    }
  }

  async clearAllMemory(projectPath: string): Promise<number> {
    const memoryDir = this.getMemoryDir(projectPath);
    try {
      const entries = await fs.readdir(memoryDir);
      for (const entry of entries) {
        await fs.unlink(path.join(memoryDir, entry));
      }
      return entries.length;
    } catch {
      return 0;
    }
  }

  private async isAutoMemoryEnabled(): Promise<boolean> {
    try {
      const settingsPath = path.join(this.getClaudeHome(), "settings.json");
      const raw = await fs.readFile(settingsPath, "utf-8");
      const settings = JSON.parse(raw);
      return settings.autoMemoryEnabled !== false;
    } catch {
      return true; // enabled by default
    }
  }

  async setAutoMemoryEnabled(enabled: boolean): Promise<void> {
    const settingsPath = path.join(this.getClaudeHome(), "settings.json");
    let settings: Record<string, unknown> = {};
    try {
      const raw = await fs.readFile(settingsPath, "utf-8");
      settings = JSON.parse(raw);
    } catch {
      // fresh settings
    }
    settings.autoMemoryEnabled = enabled;
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
  }

  // ── CLAUDE.md ──

  async getClaudeMdLevels(projectPath: string): Promise<
    {
      scope: string;
      path: string;
      exists: boolean;
      content: string | null;
      lineCount: number;
      files?: { name: string; lineCount: number }[];
    }[]
  > {
    const levels = [
      {
        scope: "project",
        filePath: path.join(projectPath, "CLAUDE.md"),
      },
      {
        scope: "project-alt",
        filePath: path.join(projectPath, ".claude", "CLAUDE.md"),
      },
      {
        scope: "project-rules",
        filePath: path.join(projectPath, ".claude", "rules"),
      },
      {
        scope: "user",
        filePath: path.join(os.homedir(), ".claude", "CLAUDE.md"),
      },
      {
        scope: "project-local",
        filePath: path.join(projectPath, "CLAUDE.local.md"),
      },
    ];

    const results = [];

    for (const level of levels) {
      if (level.scope === "project-rules") {
        // Scan directory for rule files
        try {
          const entries = await fs.readdir(level.filePath);
          const files = [];
          for (const entry of entries) {
            if (!entry.endsWith(".md")) continue;
            const content = await fs.readFile(
              path.join(level.filePath, entry),
              "utf-8"
            );
            files.push({
              name: entry,
              lineCount: content.split("\n").length,
            });
          }
          results.push({
            scope: level.scope,
            path: level.filePath,
            exists: files.length > 0,
            content: null,
            lineCount: 0,
            files,
          });
        } catch {
          results.push({
            scope: level.scope,
            path: level.filePath,
            exists: false,
            content: null,
            lineCount: 0,
            files: [],
          });
        }
      } else {
        try {
          const content = await fs.readFile(level.filePath, "utf-8");
          results.push({
            scope: level.scope,
            path: level.filePath,
            exists: true,
            content,
            lineCount: content.split("\n").length,
          });
        } catch {
          results.push({
            scope: level.scope,
            path: level.filePath,
            exists: false,
            content: null,
            lineCount: 0,
          });
        }
      }
    }

    return results;
  }

  async saveClaudeMd(
    scope: string,
    content: string,
    projectPath: string
  ): Promise<void> {
    let filePath: string;

    switch (scope) {
      case "project":
        filePath = path.join(projectPath, "CLAUDE.md");
        break;
      case "user":
        filePath = path.join(os.homedir(), ".claude", "CLAUDE.md");
        break;
      case "project-alt":
        filePath = path.join(projectPath, ".claude", "CLAUDE.md");
        break;
      case "project-local":
        filePath = path.join(projectPath, "CLAUDE.local.md");
        break;
      default:
        throw new Error(`Unknown scope: ${scope}`);
    }

    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, "utf-8");
  }

  // ── Rules ──

  private getRulesDir(projectPath: string, scope: "project" | "user" = "project"): string {
    if (scope === "user") {
      return path.join(os.homedir(), ".claude", "rules");
    }
    return path.join(projectPath, ".claude", "rules");
  }

  async getRules(projectPath: string, scope: "project" | "user" = "project"): Promise<{ name: string; content: string; lineCount: number }[]> {
    const rulesDir = this.getRulesDir(projectPath, scope);
    try {
      const entries = await fs.readdir(rulesDir);
      const rules = [];
      for (const entry of entries) {
        if (!entry.endsWith(".md")) continue;
        const content = await fs.readFile(path.join(rulesDir, entry), "utf-8");
        rules.push({
          name: entry,
          content,
          lineCount: content.split("\n").length,
        });
      }
      return rules;
    } catch {
      return [];
    }
  }

  async saveRule(projectPath: string, name: string, content: string, scope: "project" | "user" = "project"): Promise<void> {
    const rulesDir = this.getRulesDir(projectPath, scope);
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.writeFile(path.join(rulesDir, name), content, "utf-8");
  }

  async deleteRule(projectPath: string, name: string, scope: "project" | "user" = "project"): Promise<boolean> {
    try {
      await fs.unlink(path.join(this.getRulesDir(projectPath, scope), name));
      return true;
    } catch {
      return false;
    }
  }
}
