import fs from "fs/promises";
import path from "path";
import os from "os";
import { parseFrontmatter, serializeFrontmatter } from "../utils/frontmatterParser.js";

interface AgentInfo {
  name: string;
  description: string;
  model?: string;
  background?: boolean;
  isolation?: string;
  tools?: string[];
  maxTurns?: number;
  path: string;
}

interface AgentDetail {
  name: string;
  frontmatter: Record<string, unknown>;
  content: string;
}

const BUILTIN_AGENTS: AgentInfo[] = [
  {
    name: "Explore",
    description: "快速只读代码搜索",
    model: "haiku",
    path: "(builtin)",
  },
  {
    name: "Plan",
    description: "规划模式研究",
    model: "inherit",
    path: "(builtin)",
  },
  {
    name: "general-purpose",
    description: "复杂多步骤任务",
    model: "inherit",
    path: "(builtin)",
  },
];

export class AgentService {
  private getProjectAgentsDir(projectPath: string): string {
    return path.join(projectPath, ".claude", "agents");
  }

  private getUserAgentsDir(): string {
    return path.join(os.homedir(), ".claude", "agents");
  }

  async listAgents(projectPath: string): Promise<{
    builtin: AgentInfo[];
    project: AgentInfo[];
    user: AgentInfo[];
  }> {
    const projectDir = this.getProjectAgentsDir(projectPath);
    const userDir = this.getUserAgentsDir();

    const [project, user] = await Promise.all([
      this.scanAgentsDir(projectDir),
      this.scanAgentsDir(userDir),
    ]);

    return { builtin: BUILTIN_AGENTS, project, user };
  }

  private async scanAgentsDir(dir: string): Promise<AgentInfo[]> {
    try {
      const entries = await fs.readdir(dir);
      const agents: AgentInfo[] = [];

      for (const entry of entries) {
        if (!entry.endsWith(".md")) continue;

        const filePath = path.join(dir, entry);
        try {
          const raw = await fs.readFile(filePath, "utf-8");
          const { frontmatter } = parseFrontmatter(raw);
          const name = (frontmatter.name as string) || entry.replace(".md", "");

          agents.push({
            name,
            description: (frontmatter.description as string) || "",
            model: frontmatter.model as string | undefined,
            background: frontmatter.background as boolean | undefined,
            isolation: frontmatter.isolation as string | undefined,
            tools: frontmatter.tools as string[] | undefined,
            maxTurns: frontmatter.maxTurns as number | undefined,
            path: filePath,
          });
        } catch {
          // Skip unparseable files
        }
      }

      return agents;
    } catch {
      return [];
    }
  }

  async getAgent(
    scope: "project" | "user",
    name: string,
    projectPath: string
  ): Promise<AgentDetail | null> {
    const dir =
      scope === "project"
        ? this.getProjectAgentsDir(projectPath)
        : this.getUserAgentsDir();

    const filePath = path.join(dir, `${name}.md`);

    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const { frontmatter, content } = parseFrontmatter(raw);
      return { name, frontmatter, content };
    } catch {
      return null;
    }
  }

  async saveAgent(
    scope: "project" | "user",
    name: string,
    frontmatter: Record<string, unknown>,
    content: string,
    projectPath: string
  ): Promise<string> {
    const dir =
      scope === "project"
        ? this.getProjectAgentsDir(projectPath)
        : this.getUserAgentsDir();

    await fs.mkdir(dir, { recursive: true });

    const filePath = path.join(dir, `${name}.md`);
    const raw = serializeFrontmatter(frontmatter, content);
    await fs.writeFile(filePath, raw, "utf-8");

    return filePath;
  }

  async deleteAgent(
    scope: "project" | "user",
    name: string,
    projectPath: string
  ): Promise<boolean> {
    const dir =
      scope === "project"
        ? this.getProjectAgentsDir(projectPath)
        : this.getUserAgentsDir();

    try {
      await fs.unlink(path.join(dir, `${name}.md`));
      return true;
    } catch {
      return false;
    }
  }
}
