export interface ClaudeStreamMessage {
  type: "system" | "assistant" | "result";
  subtype?: string;
  session_id?: string;
  model?: string;
  message?: {
    id: string;
    role: string;
    content: ContentBlock[];
    usage?: RawTokenUsage;
  };
  result?: string;
  is_partial?: boolean;
  usage?: RawTokenUsage;
  cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface RawTokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface ClaudeProcessOptions {
  prompt: string;
  projectPath: string;
  sessionId?: string;
  model?: string;
  effort?: "low" | "medium" | "high";
  maxBudget?: number;
  allowedTools?: string[];
  apiKey?: string;
}

// ─── Client-specific types ───────────────────────────────────

export type ModelId = "opus" | "sonnet" | "haiku";
export type EffortLevel = "low" | "medium" | "high";

export const MODEL_LABELS: Record<ModelId, string> = {
  opus: "Claude Opus",
  sonnet: "Claude Sonnet",
  haiku: "Claude Haiku",
};

export interface ToolCall {
  id: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  status: "pending" | "running" | "done" | "error" | "awaiting_permission";
  /** HIL permission request ID (present when status === "awaiting_permission") */
  permissionRequestId?: string;
}

/** Pending permission request from backend */
export interface PermissionRequest {
  requestId: string;
  sessionId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  /** Human-readable reason why permission is needed */
  decisionReason?: string;
  /** File path that triggered the request */
  blockedPath?: string;
  /** Whether SDK provided "always allow" suggestions */
  hasSuggestions?: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  previewUrl?: string;
  serverPath?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  thinking?: string;
  toolCalls?: ToolCall[];
  taskResult?: TaskResult;
  attachments?: Attachment[];
  /** Present only when role === "system" and this is a compact divider */
  compactData?: { tokensBefore: number; tokensAfter: number; summary?: string };
  /** True if this message was part of a rolled-back segment */
  rolledBack?: boolean;
}

export interface TaskResult {
  costUsd?: number;
  durationMs?: number;
  numTurns?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
}

/** Token usage with camelCase keys (client-side) */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}
