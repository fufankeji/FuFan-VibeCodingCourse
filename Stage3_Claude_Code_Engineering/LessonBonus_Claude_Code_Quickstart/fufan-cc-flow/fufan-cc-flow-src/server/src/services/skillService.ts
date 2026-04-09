import fs from "fs/promises";
import path from "path";
import os from "os";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { parseFrontmatter, serializeFrontmatter } from "../utils/frontmatterParser.js";

interface SkillInfo {
  name: string;
  description: string;
  model?: string;
  argumentHint?: string;
  path: string;
  content?: string;
  pluginName?: string;
  source?: "skills" | "commands";
}

interface InstalledPluginEntry {
  scope: string;
  installPath: string;
  version?: string;
}

export class SkillService {
  private getProjectSkillsDir(projectPath: string): string {
    return path.join(projectPath, ".claude", "skills");
  }

  private getUserSkillsDir(): string {
    return path.join(os.homedir(), ".claude", "skills");
  }

  private getProjectCommandsDir(projectPath: string): string {
    return path.join(projectPath, ".claude", "commands");
  }

  private getUserCommandsDir(): string {
    return path.join(os.homedir(), ".claude", "commands");
  }

  async listSkills(projectPath: string): Promise<{
    project: SkillInfo[];
    user: SkillInfo[];
    plugin: SkillInfo[];
  }> {
    const projectSkillsDir = this.getProjectSkillsDir(projectPath);
    const userSkillsDir = this.getUserSkillsDir();
    const projectCommandsDir = this.getProjectCommandsDir(projectPath);
    const userCommandsDir = this.getUserCommandsDir();

    const [projectSkills, userSkills, projectCommands, userCommands, plugin] = await Promise.all([
      this.scanSkillsDir(projectSkillsDir),
      this.scanSkillsDir(userSkillsDir),
      this.scanCommandsDir(projectCommandsDir),
      this.scanCommandsDir(userCommandsDir),
      this.scanPluginBundledSkills(),
    ]);

    // Merge: skills/ takes priority over commands/ for same name
    const projectNames = new Set(projectSkills.map((s) => s.name));
    const project = [
      ...projectSkills,
      ...projectCommands.filter((s) => !projectNames.has(s.name)),
    ];

    const userNames = new Set(userSkills.map((s) => s.name));
    const user = [
      ...userSkills,
      ...userCommands.filter((s) => !userNames.has(s.name)),
    ];

    return { project, user, plugin };
  }

  private async scanSkillsDir(dir: string): Promise<SkillInfo[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const skills: SkillInfo[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillMdPath = path.join(dir, entry.name, "SKILL.md");
        try {
          const raw = await fs.readFile(skillMdPath, "utf-8");
          const { frontmatter } = parseFrontmatter(raw);
          skills.push({
            name: (frontmatter.name as string) || entry.name,
            description: (frontmatter.description as string) || "",
            model: frontmatter.model as string | undefined,
            argumentHint: frontmatter["argument-hint"] as string | undefined,
            path: skillMdPath,
            source: "skills",
          });
        } catch {
          // SKILL.md doesn't exist or can't be parsed
          skills.push({
            name: entry.name,
            description: "",
            path: skillMdPath,
            source: "skills",
          });
        }
      }

      return skills;
    } catch {
      return [];
    }
  }

  /**
   * Scan .claude/commands/ for legacy flat {name}.md skill files.
   */
  private async scanCommandsDir(dir: string): Promise<SkillInfo[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const skills: SkillInfo[] = [];

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
        const name = entry.name.replace(/\.md$/, "");
        const filePath = path.join(dir, entry.name);
        try {
          const raw = await fs.readFile(filePath, "utf-8");
          const { frontmatter } = parseFrontmatter(raw);
          skills.push({
            name,
            description: (frontmatter.description as string) || "",
            model: frontmatter.model as string | undefined,
            argumentHint: frontmatter["argument-hint"] as string | undefined,
            path: filePath,
            source: "commands",
          });
        } catch {
          skills.push({
            name,
            description: "",
            path: filePath,
            source: "commands",
          });
        }
      }

      return skills;
    } catch {
      return [];
    }
  }

  /**
   * Scan installed plugins for bundled skills.
   * Reads installed_plugins.json, then scans each plugin's installPath/skills/ directory.
   */
  private async scanPluginBundledSkills(): Promise<SkillInfo[]> {
    try {
      const installedPath = path.join(os.homedir(), ".claude", "plugins", "installed_plugins.json");
      let raw: string;
      try {
        raw = await fs.readFile(installedPath, "utf-8");
      } catch {
        return [];
      }

      const data = JSON.parse(raw);
      const installedMap = (data.plugins || {}) as Record<string, InstalledPluginEntry[]>;
      const skills: SkillInfo[] = [];

      for (const [key, installs] of Object.entries(installedMap)) {
        if (!Array.isArray(installs) || installs.length === 0) continue;
        const install = installs[0];

        // Parse plugin name from key (format: "name@marketplace")
        const atIdx = key.indexOf("@");
        const pluginName = atIdx > 0 ? key.slice(0, atIdx) : key;

        // Scan skills/ directory inside installPath
        const skillsDir = path.join(install.installPath, "skills");
        try {
          const entries = await fs.readdir(skillsDir, { withFileTypes: true });
          for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const skillMdPath = path.join(skillsDir, entry.name, "SKILL.md");
            try {
              const skillRaw = await fs.readFile(skillMdPath, "utf-8");
              const { frontmatter } = parseFrontmatter(skillRaw);
              skills.push({
                name: (frontmatter.name as string) || entry.name,
                description: (frontmatter.description as string) || "",
                model: frontmatter.model as string | undefined,
                argumentHint: frontmatter["argument-hint"] as string | undefined,
                path: skillMdPath,
                pluginName,
              });
            } catch {
              skills.push({
                name: entry.name,
                description: "",
                path: skillMdPath,
                pluginName,
              });
            }
          }
        } catch {
          // no skills directory in this plugin
        }
      }

      return skills;
    } catch {
      return [];
    }
  }

  async getSkill(
    scope: "project" | "user",
    name: string,
    projectPath: string
  ): Promise<{ name: string; frontmatter: Record<string, unknown>; content: string } | null> {
    const skillsDir =
      scope === "project"
        ? this.getProjectSkillsDir(projectPath)
        : this.getUserSkillsDir();

    // Try new format first: .claude/skills/{name}/SKILL.md
    const skillPath = path.join(skillsDir, name, "SKILL.md");
    try {
      const raw = await fs.readFile(skillPath, "utf-8");
      const { frontmatter, content } = parseFrontmatter(raw);
      return { name, frontmatter, content };
    } catch {
      // fall through to legacy format
    }

    // Fallback: .claude/commands/{name}.md
    const commandsDir =
      scope === "project"
        ? this.getProjectCommandsDir(projectPath)
        : this.getUserCommandsDir();
    const commandPath = path.join(commandsDir, `${name}.md`);
    try {
      const raw = await fs.readFile(commandPath, "utf-8");
      const { frontmatter, content } = parseFrontmatter(raw);
      return { name, frontmatter, content };
    } catch {
      return null;
    }
  }

  async saveSkill(
    scope: "project" | "user",
    name: string,
    frontmatter: Record<string, unknown>,
    content: string,
    projectPath: string
  ): Promise<string> {
    const dir =
      scope === "project"
        ? this.getProjectSkillsDir(projectPath)
        : this.getUserSkillsDir();

    const skillDir = path.join(dir, name);
    await fs.mkdir(skillDir, { recursive: true });

    const skillPath = path.join(skillDir, "SKILL.md");
    const raw = serializeFrontmatter(frontmatter, content);
    await fs.writeFile(skillPath, raw, "utf-8");

    return skillPath;
  }

  async deleteSkill(
    scope: "project" | "user",
    name: string,
    projectPath: string
  ): Promise<boolean> {
    const dir =
      scope === "project"
        ? this.getProjectSkillsDir(projectPath)
        : this.getUserSkillsDir();

    const skillDir = path.join(dir, name);

    try {
      await fs.rm(skillDir, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * AI-generate a SKILL.md file from a natural language description.
   * Uses the Claude Agent SDK query() one-shot mode.
   */
  async generateSkill(
    description: string,
    model?: string,
    signal?: AbortSignal
  ): Promise<{ content: string; frontmatter: Record<string, unknown> }> {
    const generationPrompt = `You are a Claude Code skill file generator. Generate a valid SKILL.md file following the official Claude Code skill format.

## Frontmatter fields (YAML between --- markers, all optional except description)

- description: (REQUIRED) One concise line describing what the skill does and when to use it. Max 1024 chars.
- argument-hint: Parameter hint shown during autocomplete, e.g. "[file] [options]". Omit if no parameters.
- model: Specific model ID (e.g. "claude-sonnet-4-20250514"). Omit to use the current session model. Do NOT use "inherit".
- disable-model-invocation: Set to true for skills with side effects (deploy, commit, send messages) that should only be triggered manually via /name. Default false, omit if false.
- user-invocable: Set to false for background knowledge skills that users should not invoke directly. Default true, omit if true.
- allowed-tools: Comma-separated list of tools Claude can use without permission when this skill is active (e.g. "Read, Grep, Glob"). Omit if not needed.
- context: Set to "fork" to run in an isolated subagent context. Omit for inline execution.
- agent: Subagent type when context is fork (e.g. "Explore", "Plan"). Omit if context is not fork.

## Body format

- Markdown formatted detailed instructions
- Use $ARGUMENTS as placeholder for user input
- Use $ARGUMENTS[0], $ARGUMENTS[1] or $0, $1 for positional arguments
- Keep SKILL.md under 500 lines, move detailed reference to separate files

## Example

---
description: Fix a GitHub issue by number
argument-hint: "[issue-number]"
disable-model-invocation: true
allowed-tools: Bash(gh *), Read, Grep, Glob
---

Fix GitHub issue $ARGUMENTS following our coding standards.

1. Read the issue description with \`gh issue view $ARGUMENTS\`
2. Understand the requirements
3. Implement the fix
4. Write tests
5. Create a commit

## User request

${description}

## Requirements

1. Wrap frontmatter in --- delimiters
2. description must be a single concise line
3. Only include frontmatter fields that are relevant — do NOT include fields with default values
4. Body must contain detailed, actionable Claude instructions
5. Use $ARGUMENTS where appropriate for user input
6. If the skill has side effects (deploy, send, delete, commit), add disable-model-invocation: true
7. If the skill only needs read access, add appropriate allowed-tools
8. Output ONLY the SKILL.md content, no extra explanation or code blocks`;

    const controller = new AbortController();
    const hardTimeout = setTimeout(() => controller.abort(), 60_000);

    // Forward external signal
    if (signal) {
      signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    let responseText = "";

    try {
      const stream = query({
        prompt: generationPrompt,
        options: {
          cwd: os.tmpdir(),
          model: model || "sonnet",
          maxTurns: 1,
          maxBudgetUsd: 0.10,
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          abortController: controller,
        },
      });

      for await (const msg of stream) {
        if (msg.type === "assistant") {
          const raw = msg as Record<string, unknown>;
          const message = raw.message as Record<string, unknown>;
          const content = message?.content as { type: string; text?: string }[];
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === "text" && block.text) responseText += block.text;
            }
          }
        }
      }
    } finally {
      clearTimeout(hardTimeout);
    }

    let text = responseText.trim();
    if (!text) {
      throw new Error("AI 生成未返回内容");
    }

    // Strip possible markdown code block wrapping
    if (text.startsWith("```")) {
      const lines = text.split("\n");
      lines.shift();
      if (lines[lines.length - 1]?.trim() === "```") lines.pop();
      text = lines.join("\n").trim();
    }

    const { frontmatter, content } = parseFrontmatter(text);
    return { content: text, frontmatter };
  }
}
