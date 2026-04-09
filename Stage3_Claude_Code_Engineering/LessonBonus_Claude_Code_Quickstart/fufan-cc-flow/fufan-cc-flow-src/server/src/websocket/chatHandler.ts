import type { WebSocket } from "ws";
import { ClaudeAgentService } from "../services/claudeAgentService.js";
import { registerAgent, unregisterAgent } from "../services/agentRegistry.js";
import { readProxy } from "../services/proxyConfig.js";
import { cleanupFiles } from "../services/attachmentService.js";
import { serverMsg } from "./protocol.js";
import { logger } from "../utils/logger.js";
import type { ClientMessage, PermissionRequest } from "../types/api.js";

/** Tools that are auto-approved (read-only / low-risk) */
const AUTO_APPROVE_TOOLS = new Set([
  "Read", "Glob", "Grep", "WebSearch", "WebFetch",
  "TodoRead", "Task", "Agent", "TodoWrite",
  "NotebookRead", "LS",
]);

export function handleChatConnection(ws: WebSocket, projectPath: string) {
  const claude = new ClaudeAgentService();
  let activeSessionId: string | null = null;

  const forward = (event: string, data: Record<string, unknown>) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(serverMsg(event, data));
    } else {
      logger.warn(`[forward] Socket not open (state=${ws.readyState}), dropping event: ${event}`);
    }
  };

  claude.on("session_init", (d) => {
    activeSessionId = d.sessionId;
    registerAgent(d.sessionId, claude);
    forward("session_init", d);
  });

  claude.on("assistant_text", (d) => forward("assistant_text", d));
  claude.on("assistant_thinking", (d) => forward("assistant_thinking", d));
  claude.on("new_turn", (d) => forward("new_turn", d));
  claude.on("tool_use_start", (d) => forward("tool_use_start", d));
  claude.on("tool_input_complete", (d) => forward("tool_input_complete", d));
  claude.on("tool_use_result", (d) => forward("tool_use_result", d));
  claude.on("context_compact", (d) => forward("context_compact", d));
  claude.on("context_usage", (d) => forward("context_usage", d));

  // Track attachment IDs per message for cleanup
  let pendingAttachmentIds: string[] = [];

  claude.on("task_complete", (d) => {
    forward("task_complete", d);
    // Do NOT reset activeSessionId here — it breaks session resume for
    // the next message.  The session stays valid until the process closes.
  });

  claude.on("close", (d) => {
    forward("process_close", d);
    // Cleanup attachment temp files only after process fully exits,
    // giving Claude enough time to read them via its Read tool.
    if (pendingAttachmentIds.length > 0) {
      cleanupFiles(pendingAttachmentIds, projectPath);
      pendingAttachmentIds = [];
    }
    if (activeSessionId) {
      unregisterAgent(activeSessionId);
    }
    activeSessionId = null;
  });

  claude.on("error", (d) => forward("error", d));
  claude.on("process_stderr", (d) => forward("process_stderr", d));

  // ── HIL 权限请求处理 ──
  claude.on("permission_request", (d: PermissionRequest) => {
    if (AUTO_APPROVE_TOOLS.has(d.toolName)) {
      // 安全工具自动批准
      claude.resolvePermission(d.requestId, "allow");
      logger.debug(`Auto-approved tool: ${d.toolName} (${d.requestId})`);
    } else {
      // 危险工具转发给前端等待用户确认
      forward("permission_request", d as unknown as Record<string, unknown>);
      logger.info(`Permission requested for ${d.toolName} (${d.requestId})`);
    }
  });

  ws.on("message", async (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      forward("error", { code: "INVALID_JSON", message: "Invalid JSON" });
      return;
    }

    logger.info(`WS action: ${msg.action}`);

    switch (msg.action) {
      case "send_message": {
        const p = msg.payload;
        if (!projectPath || !projectPath.trim()) {
          forward("error", { code: "NO_PROJECT", message: "请先在侧栏选择项目文件夹，再开始对话" });
          break;
        }
        try {
          const proxy = await readProxy();
          // Adjust prompt based on run mode
          let prompt = p.prompt as string;
          const runMode = (p.runMode as string) || "default";
          if (runMode === "plan") {
            prompt =
              "【PLAN MODE】请先分析需求并制定详细的执行计划，" +
              "不要修改任何文件，不要执行任何命令，只输出计划。  " +
              prompt;
          }

          // Handle attachments — append relative file paths to the prompt.
          // Claude will use its built-in Read tool to read these files
          // (images are auto-base64-encoded for vision analysis).
          // Paths are relative to projectPath (the spawn cwd), using UUID
          // filenames with no spaces to avoid cmd.exe truncation.
          const attachmentPaths = (p.attachmentPaths as string[]) || [];
          if (attachmentPaths.length > 0) {
            // Extract IDs from relative path for cleanup later
            pendingAttachmentIds = attachmentPaths.map((fp) => {
              const basename = fp.split("/").pop() || "";
              return basename.replace(/\.[^.]+$/, "");
            });
            const refs = attachmentPaths.join(" ");
            prompt += " (附件：" + refs + ")";
          }
          const sid = await claude.start({
            prompt,
            projectPath,
            sessionId: (p.sessionId as string) || undefined,
            forkSession: (p.forkSession as boolean) || undefined,
            model: (p.model as string) || undefined,
            effort: (p.effort as "low" | "medium" | "high") || undefined,
            maxBudget: (p.maxBudget as number) || undefined,
            apiKey: (p.apiKey as string) || undefined,
            httpProxy: proxy.httpProxy || undefined,
            httpsProxy: proxy.httpsProxy || undefined,
            socksProxy: proxy.socksProxy || undefined,
          });
          activeSessionId = sid;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          forward("error", { code: "START_FAILED", message });
        }
        break;
      }

      case "abort": {
        if (activeSessionId) {
          claude.abort(activeSessionId);
          forward("aborted", { sessionId: activeSessionId });
          activeSessionId = null;
        }
        break;
      }

      case "permission_response": {
        const reqId = msg.payload.requestId as string;
        const decision = msg.payload.decision as "allow" | "deny";
        const reason = msg.payload.reason as string | undefined;
        const alwaysAllow = msg.payload.alwaysAllow as boolean | undefined;
        if (reqId) {
          const resolved = claude.resolvePermission(reqId, decision, reason, !!alwaysAllow);
          if (!resolved) {
            logger.warn(`Permission response for unknown request: ${reqId}`);
          }
        }
        break;
      }

      case "compact": {
        const instructions = (msg.payload.instructions as string) || "";
        // Prefer client-provided sessionId (survives server-side activeSessionId resets)
        const clientSessionId = (msg.payload.sessionId as string) || undefined;
        const compactPrompt = instructions
          ? `/compact ${instructions}`
          : "/compact";
        try {
          const proxy = await readProxy();
          await claude.start({
            prompt: compactPrompt,
            projectPath,
            sessionId: clientSessionId || activeSessionId || undefined,
            httpProxy: proxy.httpProxy || undefined,
            httpsProxy: proxy.httpsProxy || undefined,
            socksProxy: proxy.socksProxy || undefined,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          forward("error", { code: "COMPACT_FAILED", message });
        }
        break;
      }

      default:
        forward("error", {
          code: "UNKNOWN_ACTION",
          message: `Unknown action: ${msg.action}`,
        });
    }
  });

  ws.on("close", () => {
    if (activeSessionId) {
      claude.abort(activeSessionId);
    }
    claude.removeAllListeners();
    logger.info("WS chat connection closed");
  });
}
