import fs from "fs/promises";
import path from "path";
import os from "os";
import type { TeamInfo, TeamMember, TeamTask, TeamMessage } from "../types/team.js";

export class TeamService {
  private claudeHome = path.join(os.homedir(), ".claude");

  // ── Path helpers with safety checks ──

  private teamsDir(): string {
    return path.normalize(path.join(this.claudeHome, "teams"));
  }

  private tasksDir(): string {
    return path.normalize(path.join(this.claudeHome, "tasks"));
  }

  private teamDir(teamName: string): string {
    const dir = path.normalize(path.join(this.teamsDir(), teamName));
    if (!dir.startsWith(this.teamsDir())) {
      throw new Error("Invalid team name: path traversal detected");
    }
    return dir;
  }

  private taskDir(teamName: string): string {
    const dir = path.normalize(path.join(this.tasksDir(), teamName));
    if (!dir.startsWith(this.tasksDir())) {
      throw new Error("Invalid team name: path traversal detected");
    }
    return dir;
  }

  private inboxesDir(teamName: string): string {
    return path.join(this.teamDir(teamName), "inboxes");
  }

  private tasksFile(teamName: string): string {
    return path.join(this.taskDir(teamName), "tasks.json");
  }

  // ── Feature detection ──

  isEnabled(): boolean {
    return process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === "1";
  }

  // ── Team CRUD ──

  async listTeams(): Promise<TeamInfo[]> {
    const dir = this.teamsDir();
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const teams: TeamInfo[] = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const team = await this.getTeam(entry.name);
          if (team) teams.push(team);
        }
      }
      return teams;
    } catch {
      return [];
    }
  }

  async getTeam(name: string): Promise<TeamInfo | null> {
    const dir = this.teamDir(name);
    try {
      await fs.access(dir);
    } catch {
      return null;
    }

    const members = await this.getMembers(name);
    const tasks = await this.getTasks(name);
    let createdAt: string;
    try {
      const stat = await fs.stat(dir);
      createdAt = stat.birthtime.toISOString();
    } catch {
      createdAt = new Date().toISOString();
    }

    const isActive = members.some((m) => m.status === "active");

    return { name, members, tasks, createdAt, isActive };
  }

  async createTeam(name: string, _leadDescription?: string): Promise<TeamInfo> {
    const inboxes = this.inboxesDir(name);
    const taskDirPath = this.taskDir(name);
    const tasksFilePath = this.tasksFile(name);

    await fs.mkdir(inboxes, { recursive: true });
    await fs.mkdir(taskDirPath, { recursive: true });

    // Initialize empty tasks.json if it doesn't exist
    try {
      await fs.access(tasksFilePath);
    } catch {
      await fs.writeFile(tasksFilePath, JSON.stringify({ tasks: [] }, null, 2), "utf-8");
    }

    return (await this.getTeam(name))!;
  }

  async deleteTeam(name: string): Promise<void> {
    const teamDirPath = this.teamDir(name);
    const taskDirPath = this.taskDir(name);

    try {
      await fs.rm(teamDirPath, { recursive: true, force: true });
    } catch {
      // ignore if not exists
    }
    try {
      await fs.rm(taskDirPath, { recursive: true, force: true });
    } catch {
      // ignore if not exists
    }
  }

  // ── Tasks ──

  async getTasks(teamName: string): Promise<TeamTask[]> {
    const filePath = this.tasksFile(teamName);
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(raw);
      // Support both { tasks: [...] } and raw array
      return Array.isArray(data) ? data : (data.tasks ?? []);
    } catch {
      return [];
    }
  }

  async updateTask(
    teamName: string,
    taskId: string,
    updates: Partial<TeamTask>
  ): Promise<TeamTask | null> {
    const filePath = this.tasksFile(teamName);
    const tasks = await this.getTasks(teamName);
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) return null;

    tasks[idx] = { ...tasks[idx], ...updates, updatedAt: new Date().toISOString() };
    await fs.writeFile(filePath, JSON.stringify({ tasks }, null, 2), "utf-8");
    return tasks[idx];
  }

  // ── Messages ──

  async getMessages(teamName: string, agentName: string): Promise<TeamMessage[]> {
    const inboxFile = path.join(this.inboxesDir(teamName), `${agentName}.jsonl`);
    // Safety check
    const normalized = path.normalize(inboxFile);
    if (!normalized.startsWith(this.inboxesDir(teamName))) {
      throw new Error("Invalid agent name: path traversal detected");
    }

    try {
      const raw = await fs.readFile(inboxFile, "utf-8");
      const messages: TeamMessage[] = [];
      for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          messages.push(JSON.parse(trimmed));
        } catch {
          // skip malformed lines
        }
      }
      return messages;
    } catch {
      return [];
    }
  }

  async getRecentMessages(teamName: string, limit = 50): Promise<TeamMessage[]> {
    const inboxes = this.inboxesDir(teamName);
    let allMessages: TeamMessage[] = [];

    try {
      const files = await fs.readdir(inboxes);
      for (const file of files) {
        if (!file.endsWith(".jsonl")) continue;
        const agentName = file.replace(/\.jsonl$/, "");
        const msgs = await this.getMessages(teamName, agentName);
        allMessages = allMessages.concat(msgs);
      }
    } catch {
      return [];
    }

    // Sort by timestamp descending, then take limit
    allMessages.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return allMessages.slice(0, limit);
  }

  // ── Members ──

  async getMembers(teamName: string): Promise<TeamMember[]> {
    const inboxes = this.inboxesDir(teamName);
    try {
      const files = await fs.readdir(inboxes);
      return files
        .filter((f) => f.endsWith(".jsonl"))
        .map((f) => {
          const name = f.replace(/\.jsonl$/, "");
          return {
            name,
            // First member is typically the lead; infer from name convention
            role: name.toLowerCase().includes("lead") ? "lead" as const : "teammate" as const,
            status: "idle" as const,
          };
        });
    } catch {
      return [];
    }
  }
}
