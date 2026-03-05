/**
 * Global registry for active ClaudeAgentService instances.
 *
 * chatHandler 在 session_init 时注册，close 时注销。
 * REST 路由（如 rewind）通过此 registry 查找活跃的 service 实例。
 */
import type { ClaudeAgentService } from "./claudeAgentService.js";

const registry = new Map<string, ClaudeAgentService>();

export function registerAgent(sessionId: string, service: ClaudeAgentService) {
  registry.set(sessionId, service);
}

export function unregisterAgent(sessionId: string) {
  registry.delete(sessionId);
}

export function getAgent(sessionId: string): ClaudeAgentService | undefined {
  return registry.get(sessionId);
}
