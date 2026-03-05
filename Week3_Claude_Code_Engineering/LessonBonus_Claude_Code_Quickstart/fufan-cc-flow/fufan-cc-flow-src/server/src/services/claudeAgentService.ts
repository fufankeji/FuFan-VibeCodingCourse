/**
 * Claude Agent Service — 基于 Agent SDK 的 Claude 通信层
 *
 * 使用 @anthropic-ai/claude-agent-sdk 的 V1 query() API。
 *
 * EventEmitter 事件接口:
 *   session_init, assistant_text, assistant_thinking,
 *   tool_use_start, tool_input_complete, tool_use_result, new_turn,
 *   context_compact, context_usage, task_complete,
 *   permission_request, close, error, process_stderr
 *
 * 核心能力:
 *   - HIL 权限确认 (canUseTool → permission_request → resolvePermission)
 *   - Checkpoint/Rewind (rewindFiles → SDK Query.rewindFiles)
 *   - Session Fork (forkSession: true)
 *   - 优雅中断 (AbortController)
 */

import { EventEmitter } from "events";
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { Query, PermissionUpdate } from "@anthropic-ai/claude-agent-sdk";
import { logger } from "../utils/logger.js";
import type { AgentServiceOptions, ContentBlock } from "../types/claude.js";
import type { PermissionRequest } from "../types/api.js";

// 关键：清除嵌套会话检测环境变量
// Claude Code CLI 检测到 CLAUDECODE 环境变量会拒绝启动（防止嵌套）
// 当 Fufan-CC Flow 的 server 由 Claude Code 会话启动时，需要清除此变量
delete process.env.CLAUDECODE;

export class ClaudeAgentService extends EventEmitter {
  /** 活跃的 query 流（sessionId → Query） */
  private activeStreams = new Map<string, Query>();
  /** 中断控制器（sessionId → AbortController） */
  private abortControllers = new Map<string, AbortController>();
  /** Dedup tool_use blocks across partial messages (reset per session) */
  private seenToolIds = new Set<string>();
  /** Track API message ID to detect new turns within a task */
  private lastMessageId: string | null = null;
  /** Internal session ID counter */
  private idCounter = 0;
  /** Pending HIL permission requests (requestId → Promise resolver) */
  private pendingPermissions = new Map<
    string,
    {
      resolve: (decision: { behavior: "allow"; updatedPermissions?: PermissionUpdate[] } | { behavior: "deny"; message: string }) => void;
      suggestions?: PermissionUpdate[];
    }
  >();
  /** Permission request ID counter */
  private permissionIdCounter = 0;

  async start(options: AgentServiceOptions): Promise<string> {
    if (!options.projectPath?.trim()) {
      throw new Error("projectPath 不能为空，请先选择项目文件夹");
    }

    // 生成临时 sessionId（真正的 CLI sessionId 从 system.init 消息获取）
    const sessionId =
      options.sessionId || `session_${Date.now()}_${++this.idCounter}`;

    const controller = new AbortController();

    // 构建环境变量
    const env: Record<string, string | undefined> = {};
    if (options.apiKey) {
      env["ANTHROPIC_API_KEY"] = options.apiKey;
    }
    if (options.httpProxy) {
      env["HTTP_PROXY"] = options.httpProxy;
      env["http_proxy"] = options.httpProxy;
    }
    if (options.httpsProxy) {
      env["HTTPS_PROXY"] = options.httpsProxy;
      env["https_proxy"] = options.httpsProxy;
    }
    if (options.socksProxy) {
      env["ALL_PROXY"] = options.socksProxy;
    }
    if (options.effort) {
      env["CLAUDE_CODE_EFFORT_LEVEL"] = options.effort;
    }

    logger.info(`Starting SDK query [${sessionId}]`, {
      model: options.model,
      cwd: options.projectPath,
      promptLength: options.prompt.length,
      hasResume: !!options.sessionId,
    });
    logger.debug(
      `[${sessionId}] prompt: ${options.prompt.slice(0, 200)}${options.prompt.length > 200 ? "..." : ""}`
    );

    const stream = query({
      prompt: options.prompt,
      options: {
        cwd: options.projectPath,
        resume: options.sessionId || undefined,
        forkSession: options.forkSession,
        model: options.model,
        effort: options.effort as "low" | "medium" | "high" | "max" | undefined,
        maxBudgetUsd: options.maxBudget,
        enableFileCheckpointing: true,
        includePartialMessages: true,
        settingSources: ["user", "project"],
        abortController: controller,

        // Phase 2：HIL 权限确认 — 通过 canUseTool 回调暂停工具执行，
        // 等待前端用户确认后再继续。bypassPermissions 确保 CLI 内部不弹权限提示。
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        canUseTool: async (toolName, toolInput, options) => {
          return this.requestPermission(sessionId, toolName, toolInput, {
            toolUseID: options.toolUseID,
            decisionReason: options.decisionReason,
            blockedPath: options.blockedPath,
            suggestions: options.suggestions,
          });
        },

        // 环境变量
        env,

        // 捕获 stderr
        stderr: (data: string) => {
          const text = data.trim();
          if (text) {
            logger.warn(`stderr [${sessionId}]: ${text}`);
            this.emit("process_stderr", { sessionId, text });
          }
        },
      },
    });

    this.activeStreams.set(sessionId, stream);
    this.abortControllers.set(sessionId, controller);
    this.seenToolIds.clear();
    this.lastMessageId = null;

    // 后台消费流，不阻塞 start() 返回
    this.consumeStream(sessionId, stream);

    return sessionId;
  }

  abort(sessionId: string): boolean {
    const controller = this.abortControllers.get(sessionId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(sessionId);
      this.abortControllers.delete(sessionId);
      logger.info(`Aborted [${sessionId}]`);
      return true;
    }
    return false;
  }

  isRunning(sessionId: string): boolean {
    return this.activeStreams.has(sessionId);
  }

  /**
   * 获取活跃的 Query 流（供 Phase 3 rewindFiles 使用）
   */
  getActiveStream(sessionId: string): Query | undefined {
    return this.activeStreams.get(sessionId);
  }

  // ── Checkpoint / Rewind ──

  /**
   * 使用 SDK 的 rewindFiles() 将文件恢复到指定用户消息时的状态。
   * 要求 enableFileCheckpointing: true 且 stream 仍然活跃。
   *
   * @throws 如果没有活跃的 stream（session 已结束）
   */
  async rewindFiles(
    sessionId: string,
    messageUuid: string,
    dryRun = false
  ): Promise<{ canRewind: boolean; error?: string; filesChanged?: string[]; insertions?: number; deletions?: number }> {
    const stream = this.activeStreams.get(sessionId);
    if (!stream) {
      throw new Error(`No active stream for session ${sessionId}. Use fallback rollback.`);
    }
    logger.info(`rewindFiles [${sessionId}] messageUuid=${messageUuid} dryRun=${dryRun}`);
    const result = await stream.rewindFiles(messageUuid, { dryRun });
    logger.info(`rewindFiles result [${sessionId}]:`, result);
    return result;
  }

  // ── HIL 权限管理 ──

  /**
   * 外部（chatHandler）调用此方法来响应权限请求
   */
  resolvePermission(
    requestId: string,
    decision: "allow" | "deny",
    reason?: string,
    alwaysAllow?: boolean
  ): boolean {
    const pending = this.pendingPermissions.get(requestId);
    if (!pending) return false;
    this.pendingPermissions.delete(requestId);
    logger.info(`Permission resolved: ${requestId} → ${decision}${alwaysAllow ? " (always)" : ""}`);
    if (decision === "allow") {
      pending.resolve({
        behavior: "allow",
        // Pass back SDK suggestions to persist "always allow" rules
        ...(alwaysAllow && pending.suggestions ? { updatedPermissions: pending.suggestions } : {}),
      });
    } else {
      pending.resolve({ behavior: "deny", message: reason || "User denied" });
    }
    return true;
  }

  /**
   * 内部：发起权限请求并等待响应
   *
   * 修复要点：
   * 1. 优先使用 SDK 提供的 toolUseID 作为 requestId（保持与 SDK 内部一致）
   * 2. pendingPermissions.set() 在 emit() 之前执行（防止同步 auto-approve 路径找不到 entry）
   * 3. 如果 SDK 因 sibling error 重新调度同一 toolUseID，复用已有 Promise
   */
  private requestPermission(
    sessionId: string,
    toolName: string,
    toolInput: Record<string, unknown>,
    opts?: {
      toolUseID?: string;
      decisionReason?: string;
      blockedPath?: string;
      suggestions?: PermissionUpdate[];
    }
  ): Promise<{ behavior: "allow"; updatedPermissions?: PermissionUpdate[] } | { behavior: "deny"; message: string }> {
    const requestId = opts?.toolUseID || `perm_${Date.now()}_${++this.permissionIdCounter}`;

    // Fix 3: SDK 重新调度同一个 toolUseID 时，链接到已有 Promise
    if (this.pendingPermissions.has(requestId)) {
      return new Promise((resolve) => {
        const existing = this.pendingPermissions.get(requestId)!;
        const orig = existing.resolve;
        existing.resolve = (d) => { orig(d); resolve(d); };
      });
    }

    return new Promise((resolve) => {
      // Fix 2: 先注册到 Map，再 emit（防止同步 resolvePermission 找不到 entry）
      this.pendingPermissions.set(requestId, { resolve, suggestions: opts?.suggestions });

      // 超时自动拒绝（60s）
      const timer = setTimeout(() => {
        if (this.pendingPermissions.has(requestId)) {
          this.pendingPermissions.delete(requestId);
          logger.warn(`Permission request timed out: ${requestId}`);
          this.emit("permission_timeout", { requestId, sessionId });
          resolve({ behavior: "deny", message: "Permission request timed out (60s)" });
        }
      }, 60_000);
      timer.unref();

      this.emit("permission_request", {
        requestId,
        sessionId,
        toolName,
        toolInput,
        decisionReason: opts?.decisionReason,
        blockedPath: opts?.blockedPath,
        suggestions: opts?.suggestions,
      } satisfies PermissionRequest);
    });
  }

  // ── 流消费 ──

  private async consumeStream(sessionId: string, stream: Query) {
    let exitCode: number | null = 0;

    try {
      for await (const msg of stream) {
        this.dispatch(sessionId, msg);
      }
      // 流正常结束
      logger.info(`Stream completed [${sessionId}]`);
    } catch (err: unknown) {
      const errObj = err as Error;
      const isAbort =
        errObj?.name === "AbortError" || String(err).includes("abort");

      if (isAbort) {
        exitCode = null;
        logger.info(`Stream aborted [${sessionId}]`);
      } else {
        // 提取退出码（如有）
        const codeMatch = String(err).match(/exited with code (\d+)/);
        exitCode = codeMatch ? parseInt(codeMatch[1], 10) : 1;

        this.emit("error", {
          sessionId,
          code: "PROCESS_ERROR",
          message: errObj?.message || String(err),
        });
        logger.error(`Stream error [${sessionId}]`, errObj?.message);
      }
    } finally {
      // 始终清理并发出 close（和旧版 proc.on("close") 行为一致）
      this.cleanup(sessionId);
      this.emit("close", { sessionId, code: exitCode });
    }
  }

  private cleanup(sessionId: string) {
    this.activeStreams.delete(sessionId);
    this.abortControllers.delete(sessionId);
    // 拒绝所有未决权限请求
    for (const [, pending] of this.pendingPermissions) {
      pending.resolve({ behavior: "deny", message: "Session ended" });
    }
    this.pendingPermissions.clear();
  }

  // ── 消息分发（映射 SDK 消息到旧版 EventEmitter 事件） ──

  private dispatch(sessionId: string, msg: SDKMessage) {
    // 使用 Record 访问可能不在类型定义中的字段
    const raw = msg as Record<string, unknown>;

    // Debug: log message types to understand SDK output flow
    if (msg.type !== "stream_event") {
      logger.debug(`[${sessionId}] SDK msg type=${msg.type} subtype=${raw.subtype || "-"}`);
    }

    // ── system.init ──
    if (msg.type === "system" && raw.subtype === "init") {
      const realSessionId = (raw.session_id as string) || sessionId;

      // 如果 CLI 返回了不同的 sessionId，更新映射
      if (realSessionId !== sessionId) {
        const stream = this.activeStreams.get(sessionId);
        const controller = this.abortControllers.get(sessionId);
        if (stream) {
          this.activeStreams.delete(sessionId);
          this.activeStreams.set(realSessionId, stream);
        }
        if (controller) {
          this.abortControllers.delete(sessionId);
          this.abortControllers.set(realSessionId, controller);
        }
      }

      this.emit("session_init", {
        sessionId: realSessionId,
        model: raw.model as string,
      });
      return;
    }

    // ── system.compact_boundary（SDK 用 compact_boundary，旧版用 compact） ──
    if (msg.type === "system" && raw.subtype === "compact_boundary") {
      const meta = raw.compact_metadata as Record<string, unknown> | undefined;
      logger.info(`[${sessionId}] context_compact event (SDK compact_boundary):`, {
        trigger: meta?.trigger,
        preTokens: meta?.pre_tokens,
      });
      // 发送格式兼容旧版前端期望的字段名
      this.emit("context_compact", {
        sessionId,
        type: "system",
        subtype: "compact",
        compact_metadata: meta,
      });
      return;
    }

    // ── assistant 消息（完整的 Claude 回复） ──
    if (msg.type === "assistant" && raw.message) {
      const message = raw.message as Record<string, unknown>;
      const msgId = message.id as string;
      const content = (message.content as ContentBlock[]) || [];
      const isPartial = false; // SDKAssistantMessage = 完整消息

      // 检测新 turn
      if (msgId && msgId !== this.lastMessageId) {
        const hasTextOrTool = content.some(
          (b) =>
            b.type === "text" || b.type === "tool_use" || b.type === "thinking"
        );
        if (hasTextOrTool && this.lastMessageId !== null) {
          logger.debug(
            `[${sessionId}] new_turn: ${this.lastMessageId} → ${msgId}`
          );
          this.emit("new_turn", { sessionId });
        }
        this.lastMessageId = msgId;
      }

      // Usage 统计
      const usage = message.usage as Record<string, unknown> | undefined;
      if (usage) {
        logger.debug(
          `[${sessionId}] context_usage: input=${usage.input_tokens} output=${usage.output_tokens}`
        );
        this.emit("context_usage", { sessionId, usage });
      }

      // 分发内容块 — 区分已流式传输 vs 需要补全的内容
      for (const block of content) {
        if (block.type === "text" || block.type === "thinking") {
          // stream_event delta 已经发送过这些内容，跳过避免重复
          continue;
        }
        if (block.type === "tool_use") {
          // tool_use_start 已通过 content_block_start 发送（input 为空）
          // 现在补全完整 input
          if (this.seenToolIds.has(block.id)) {
            this.emit("tool_input_complete", {
              sessionId,
              toolCallId: block.id,
              toolInput: block.input,
            });
          } else {
            // 罕见情况：没有收到 stream_event 直接收到 complete message
            this.seenToolIds.add(block.id);
            this.emit("tool_use_start", {
              sessionId,
              toolCallId: block.id,
              toolName: block.name,
              toolInput: block.input,
            });
          }
          continue;
        }
        // tool_result 等其他类型正常分发
        this.dispatchContentBlock(sessionId, block, false);
      }
      return;
    }

    // ── stream_event（部分消息 — includePartialMessages: true 时） ──
    if (msg.type === "stream_event" as string) {
      this.handleStreamEvent(sessionId, raw);
      return;
    }

    // ── user 消息（tool_result） ──
    // SDK user messages contain tool results in message.content[] array
    if (msg.type === "user") {
      const message = raw.message as Record<string, unknown> | undefined;
      const content = (message?.content as ContentBlock[]) || [];
      for (const block of content) {
        if (block.type === "tool_result") {
          this.dispatchContentBlock(sessionId, block, false);
        }
      }
      return;
    }

    // ── result（任务完成） ──
    if (msg.type === "result") {
      // SDK 用 total_cost_usd，旧版 stream-json 用 cost_usd
      const costUsd =
        (raw.total_cost_usd as number) ?? (raw.cost_usd as number) ?? 0;
      const usage = raw.usage as Record<string, unknown> | undefined;

      logger.info(
        `[${sessionId}] task_complete: cost=$${costUsd.toFixed(4)} input=${usage?.input_tokens} output=${usage?.output_tokens} turns=${raw.num_turns}`
      );
      this.emit("task_complete", {
        sessionId,
        result: raw.result as string,
        usage,
        costUsd,
        durationMs: raw.duration_ms as number,
        numTurns: raw.num_turns as number,
        isError: raw.is_error as boolean,
        subtype: raw.subtype as string,
      });
      return;
    }

    // 其余 SDK 消息类型暂不处理（auth_status, tool_progress, task_notification 等）
    // 可在后续 Phase 中按需添加
  }

  /**
   * 处理 stream_event（SDK 的 includePartialMessages 输出）
   *
   * stream_event 包含 Anthropic API 的原始流事件（content_block_delta 等），
   * 我们从中提取文本和 thinking 的增量更新，以实现 token 级流式输出。
   */
  private handleStreamEvent(
    sessionId: string,
    raw: Record<string, unknown>
  ) {
    const event = raw.event as Record<string, unknown> | undefined;
    if (!event) return;

    const eventType = event.type as string;

    // content_block_delta — token 级增量
    if (eventType === "content_block_delta") {
      const delta = event.delta as Record<string, unknown> | undefined;
      if (!delta) return;

      if (delta.type === "text_delta" && delta.text) {
        this.emit("assistant_text", {
          sessionId,
          text: delta.text as string,
          isPartial: true,
        });
      }
      if (delta.type === "thinking_delta" && delta.thinking) {
        this.emit("assistant_thinking", {
          sessionId,
          thinking: delta.thinking as string,
          isPartial: true,
        });
      }
    }

    // content_block_start — 检测 tool_use 开始
    if (eventType === "content_block_start") {
      const block = event.content_block as Record<string, unknown> | undefined;
      if (block?.type === "tool_use") {
        const toolId = block.id as string;
        if (!this.seenToolIds.has(toolId)) {
          this.seenToolIds.add(toolId);
          this.emit("tool_use_start", {
            sessionId,
            toolCallId: toolId,
            toolName: block.name as string,
            toolInput: (block.input as Record<string, unknown>) || {},
          });
        }
      }
    }

    // message_start — 可提取 usage
    if (eventType === "message_start") {
      const message = event.message as Record<string, unknown> | undefined;
      const usage = message?.usage as Record<string, unknown> | undefined;
      if (usage) {
        this.emit("context_usage", { sessionId, usage });
      }
    }

    // message_delta — 结束时的 usage 更新
    if (eventType === "message_delta") {
      const usage = event.usage as Record<string, unknown> | undefined;
      if (usage) {
        this.emit("context_usage", { sessionId, usage });
      }
    }
  }

  private dispatchContentBlock(
    sessionId: string,
    block: ContentBlock,
    isPartial: boolean
  ) {
    switch (block.type) {
      case "text":
        this.emit("assistant_text", {
          sessionId,
          text: block.text,
          isPartial,
        });
        break;
      case "thinking":
        this.emit("assistant_thinking", {
          sessionId,
          thinking: block.thinking,
          isPartial,
        });
        break;
      case "tool_use":
        // Dedup: partial messages re-emit the same tool_use block on every update
        if (this.seenToolIds.has(block.id)) break;
        this.seenToolIds.add(block.id);
        this.emit("tool_use_start", {
          sessionId,
          toolCallId: block.id,
          toolName: block.name,
          toolInput: block.input,
        });
        break;
      case "tool_result": {
        // MCP 工具可能返回内容块数组（含 image 等），需序列化为 JSON 字符串
        const resultContent = typeof block.content === "string"
          ? block.content
          : JSON.stringify(block.content);
        this.emit("tool_use_result", {
          sessionId,
          toolCallId: block.tool_use_id,
          result: resultContent,
          isError: block.is_error || false,
        });
        break;
      }
    }
  }
}
