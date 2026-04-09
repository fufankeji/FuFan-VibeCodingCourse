export type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock;

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ThinkingBlock {
  type: "thinking";
  thinking: string;
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
  content: string | unknown[];  // MCP 工具可能返回内容块数组（含 image 等）
  is_error?: boolean;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/* ── Agent SDK Options ── */

export interface AgentServiceOptions {
  prompt: string;
  projectPath: string;
  sessionId?: string;         // resume 已有 session
  forkSession?: boolean;      // fork 而非 resume
  model?: string;
  effort?: "low" | "medium" | "high";
  maxBudget?: number;
  allowedTools?: string[];
  apiKey?: string;
  httpProxy?: string;
  httpsProxy?: string;
  socksProxy?: string;
}
