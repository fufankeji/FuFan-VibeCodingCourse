export interface ClientMessage {
  action: string;
  payload: Record<string, unknown>;
  requestId?: string;
}

export interface ServerMessage {
  event: string;
  payload: Record<string, unknown>;
  timestamp: number;
  requestId?: string;
}

export interface SessionInfo {
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

export interface ConfigData {
  model: string;
  effort: string;
  thinking: boolean;
  autoCompactThreshold: number;
  httpProxy?: string;
  httpsProxy?: string;
  socksProxy?: string;
  autoUpdatesChannel?: "latest" | "stable";
}

export interface ApiError {
  code: string;
  message: string;
  details?: string;
}

/* ── Checkpoint / Rollback ── */

export interface FileBackupMeta {
  backupFileName: string | null;
  version: number;
  backupTime: string;
}

export interface CheckpointData {
  messageId: string;
  userContent: string;
  timestamp: string;
  changedFiles: {
    path: string;
    backupFileName: string | null;
    isNewFile: boolean;
  }[];
  hasFileChanges: boolean;
}

export interface CheckpointsResult {
  checkpoints: CheckpointData[];
  projectCwd: string | null;
}

export interface FileRollbackResult {
  path: string;
  action: "restored" | "deleted" | "skipped" | "failed";
  error?: string;
}

export interface RollbackResult {
  success: boolean;
  fileResults: FileRollbackResult[];
  error?: string;
}

/* ── Permission (HIL) ── */

export interface PermissionRequest {
  requestId: string;
  sessionId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  /** Human-readable reason why permission is needed */
  decisionReason?: string;
  /** File path that triggered the permission (e.g., Bash accessing outside project) */
  blockedPath?: string;
  /** SDK-provided suggestions for "always allow" rules */
  suggestions?: unknown[];
}

export interface PermissionResponse {
  requestId: string;
  decision: "allow" | "deny";
  reason?: string;
  /** Pass back suggestions to persist "always allow" rules */
  updatedPermissions?: unknown[];
}

/* ── Rewind (SDK) ── */

export interface RewindRequest {
  messageUuid: string;
  dryRun?: boolean;
}

export interface RewindResult {
  canRewind: boolean;
  error?: string;
  filesChanged?: string[];
  insertions?: number;
  deletions?: number;
  /** "sdk" = used SDK rewindFiles(), "fallback" = used manual file-history */
  method: "sdk" | "fallback";
}
