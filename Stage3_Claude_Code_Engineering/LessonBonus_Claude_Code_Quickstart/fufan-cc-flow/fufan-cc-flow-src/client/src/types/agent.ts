export interface AgentInfo {
  name: string;
  description: string;
  model?: string;
  background?: boolean;
  isolation?: string;
  tools?: string[];
  maxTurns?: number;
  path: string;
}

export interface AgentDetail {
  name: string;
  frontmatter: Record<string, unknown>;
  content: string;
}

export interface SubAgentNode {
  id: string;
  agentType: string;
  description: string;
  model?: string;
  status: "started" | "running" | "completed" | "error";
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  result?: string;
  isBackground: boolean;
  worktree?: string;
  children: SubAgentNode[];
  toolCalls: {
    id: string;
    toolName: string;
    summary: string;
    status: "running" | "done" | "error";
  }[];
}

export interface BackgroundTask {
  id: string;
  agentName: string;
  description: string;
  status: "running" | "completed" | "error";
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  worktree?: string;
  result?: string;
  error?: string;
}
