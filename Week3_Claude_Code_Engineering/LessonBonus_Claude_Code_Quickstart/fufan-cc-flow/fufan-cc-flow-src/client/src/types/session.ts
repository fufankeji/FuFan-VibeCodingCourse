export interface Session {
  id: string;
  name: string | null;
  model: string | null;
  projectPath: string | null;
  projectPathValid: boolean;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  /** One-line summary from sessions-index.json (Claude-generated) */
  summary: string | null;
  /** Git branch active when session was created */
  gitBranch: string | null;
  /** Parent session ID if this session was forked (e.g. from a rewind) */
  parentSessionId: string | null;
  /** True if this session was auto-created by plan mode execution */
  isPlanExecution?: boolean;
}
