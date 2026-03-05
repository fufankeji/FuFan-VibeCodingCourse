import { useEffect } from "react";
import { wsService } from "../services/websocket";
import { useChatStore } from "../stores/chatStore";
import { useUIStore } from "../stores/uiStore";
import { useAgentStore } from "../stores/agentStore";
import type { SubAgentNode } from "../types/agent";

/**
 * Map tool names to Chinese status descriptions (mimics Claude Code CLI status line).
 */
const TOOL_STATUS: Record<string, string> = {
  Bash: "正在执行命令...",
  Read: "正在读取文件...",
  Write: "正在写入文件...",
  Edit: "正在编辑文件...",
  Glob: "正在搜索文件...",
  Grep: "正在搜索内容...",
  WebFetch: "正在获取网页...",
  WebSearch: "正在搜索网络...",
  Agent: "正在执行子任务...",
  Task: "正在派发任务...",
  TodoWrite: "正在更新任务列表...",
  NotebookEdit: "正在编辑笔记本...",
};

export function useWebSocket() {
  const projectPath = useUIStore((s) => s.projectPath);
  const setWsConnected = useUIStore((s) => s.setWsConnected);

  useEffect(() => {
    // Connect always — server defaults to process.cwd() when no project param
    wsService.connect(projectPath);

    // ── Per-task mutable state ──
    let accumulatedText = "";
    let accumulatedThinking = "";
    /** Stores the post-compact token count to protect it from being overwritten. */
    let postCompactTokens: number | null = null;
    /** When true, the next context_usage event should update the compact divider's tokensAfter */
    let pendingCompactAfterUpdate = false;
    /**
     * Track latest per-call usage from context_usage events.
     * Used for accurate TaskResult (instead of cumulative result.usage).
     */
    let latestUsage: Record<string, number> | null = null;

    const store = useChatStore;

    // ── Throttled streaming UI updates ──
    // Markdown parsing on every token is expensive; batch updates at ~60ms intervals.
    let textDirty = false;
    let thinkingDirty = false;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    function flushStreaming() {
      flushTimer = null;
      if (textDirty) {
        store.setState({ streamingText: accumulatedText, statusText: "正在生成回复..." });
        textDirty = false;
      }
      if (thinkingDirty) {
        store.getState().updateAssistantThinking(accumulatedThinking);
        thinkingDirty = false;
      }
    }

    function scheduleFlush() {
      if (!flushTimer) {
        flushTimer = setTimeout(flushStreaming, 60);
      }
    }

    const unsub = wsService.subscribe((event, payload) => {
      switch (event) {
        case "_connected":
          setWsConnected(true);
          break;

        case "_disconnected":
          setWsConnected(false);
          break;

        case "session_init": {
          const newSessionId = payload.sessionId as string;
          store.getState().setSessionId(newSessionId);
          // Clear pendingFork — fork has been realized with the new session ID
          if (store.getState().pendingFork) {
            store.getState().clearPendingFork();
          }
          // Infer context window max from model name (e.g. "claude-sonnet-4-6[1m]" → 1M)
          const modelName = (payload.model as string) || "";
          if (modelName.includes("[1m]")) {
            store.getState().updateContextMax(1_000_000);
          } else {
            store.getState().updateContextMax(200_000);
          }
          // Start streaming if not already started (InputBar may have called startStreaming early)
          if (!store.getState().isStreaming) {
            store.getState().startStreaming();
          }
          accumulatedText = "";
          accumulatedThinking = "";
          latestUsage = null;
          postCompactTokens = null;
          break;
        }

        // ── New turn within the same task ──
        // Backend detects a new API message ID (different assistant turn).
        // Commit current text to the current message, then create a new bubble.
        case "new_turn": {
          // Cancel pending throttled flush — we're committing now
          if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
          textDirty = false; thinkingDirty = false;
          // Mark any still-running tools as done (new turn = previous tools completed)
          store.getState().finishRunningTools();
          // Commit any accumulated text/thinking to the current assistant message
          if (accumulatedText) {
            store.getState().updateAssistantContent(accumulatedText);
            accumulatedText = "";
          }
          if (accumulatedThinking) {
            store.getState().updateAssistantThinking(accumulatedThinking);
            accumulatedThinking = "";
          }
          // Create a new assistant message bubble for the new turn
          store.getState().addAssistantTurn();
          store.getState().setStatusText("正在思考...");
          break;
        }

        case "assistant_thinking": {
          accumulatedThinking += payload.thinking as string;
          thinkingDirty = true;
          scheduleFlush();
          break;
        }

        case "assistant_text": {
          accumulatedText += payload.text as string;
          textDirty = true;
          scheduleFlush();
          break;
        }

        case "tool_use_start": {
          // Cancel pending throttled flush — we're committing now
          if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
          textDirty = false; thinkingDirty = false;
          // Mark previous running tools as done (new tool = previous one completed)
          store.getState().finishRunningTools();
          // Commit accumulated text to the current assistant message
          if (accumulatedText) {
            store.getState().updateAssistantContent(accumulatedText);
            accumulatedText = "";
          }
          if (accumulatedThinking) {
            store.getState().updateAssistantThinking(accumulatedThinking);
            accumulatedThinking = "";
          }
          const toolName = payload.toolName as string;
          const realId = payload.toolCallId as string;

          // Bidirectional dedup: check if a perm_ placeholder already exists
          // (permission_request can arrive before OR after tool_use_start)
          const state = store.getState();
          const currentMsg = state.messages.find((m) => m.id === state.currentAssistantId);
          const permPlaceholder = currentMsg?.toolCalls?.find(
            (tc) => tc.id.startsWith("perm_") && tc.toolName === toolName &&
              (tc.status === "awaiting_permission" || tc.status === "running" || tc.status === "done" || tc.status === "error")
          );
          if (permPlaceholder) {
            // Merge: replace placeholder ID with real SDK ID, preserve status/permissionRequestId
            store.getState().replaceToolCallId(permPlaceholder.id, realId);
          } else {
            // No placeholder — add as new tool call
            store.getState().addToolCallToCurrent({
              id: realId,
              toolName,
              toolInput: payload.toolInput as Record<string, unknown>,
            });
          }
          // Update status line with what Claude is doing
          const status = TOOL_STATUS[toolName] || `正在调用 ${toolName}...`;
          store.getState().setStatusText(status);

          // Track Agent/Task tool calls for Sub-Agent tree & background tasks
          if (toolName === "Agent" || toolName === "Task") {
            const input = (payload.toolInput as Record<string, unknown>) || {};
            const node: SubAgentNode = {
              id: realId,
              agentType: String(input.subagent_type || input.description || "unknown"),
              description: String(input.description || input.prompt || "").slice(0, 120),
              model: input.model as string | undefined,
              status: "started",
              startedAt: Date.now(),
              isBackground: !!input.run_in_background,
              worktree: input.isolation === "worktree" ? "(pending)" : undefined,
              children: [],
              toolCalls: [],
            };
            useAgentStore.getState().addSubAgent(node);
            // Also add to background tasks if it's a background agent
            if (input.run_in_background) {
              useAgentStore.getState().addBackgroundTask({
                id: realId,
                agentName: String(input.subagent_type || "Agent"),
                description: String(input.description || ""),
                status: "running",
                startedAt: Date.now(),
                worktree: input.isolation === "worktree" ? "(pending)" : undefined,
              });
            }
          }
          break;
        }

        case "tool_input_complete": {
          // Complete message arrived — backfill the full toolInput for the tool call
          const completeId = payload.toolCallId as string;
          const completeInput = payload.toolInput as Record<string, unknown>;
          store.getState().updateToolCall(completeId, {
            toolInput: completeInput,
          });

          // Update Sub-Agent tree with real data (tool_use_start arrives with empty input)
          const completeTc = store.getState().messages
            .flatMap((m) => m.toolCalls ?? [])
            .find((tc) => tc.id === completeId);
          if (completeTc && (completeTc.toolName === "Agent" || completeTc.toolName === "Task")) {
            const agentType = String(completeInput.subagent_type || completeInput.description || "unknown");
            useAgentStore.getState().updateSubAgent(completeId, {
              agentType,
              description: String(completeInput.description || completeInput.prompt || "").slice(0, 120),
              model: completeInput.model as string | undefined,
              isBackground: !!completeInput.run_in_background,
              worktree: completeInput.isolation === "worktree" ? "(pending)" : undefined,
            });
            // Update background task name too
            if (completeInput.run_in_background) {
              useAgentStore.getState().updateBackgroundTask(completeId, {
                agentName: agentType,
                description: String(completeInput.description || ""),
              });
            }
          }
          break;
        }

        case "tool_use_result": {
          // SDK user messages contain tool_result blocks.
          // Skip if the tool call was already resolved by HIL permission flow
          // (deny → status already "error", allow → status already "running"/"done")
          const toolCallId = payload.toolCallId as string;
          const existingTc = store.getState().messages
            .flatMap((m) => m.toolCalls ?? [])
            .find((tc) => tc.id === toolCallId);
          // Only update if the tool exists and is still in running state
          // (skip error results from permission denials — the placeholder already shows the error)
          if (existingTc && existingTc.status === "running") {
            store.getState().updateToolCall(toolCallId, {
              result: payload.result as string,
              isError: payload.isError as boolean,
              status: (payload.isError as boolean) ? "error" : "done",
            });
          }
          // Update Sub-Agent tree & background tasks on completion
          const isAgentTool = existingTc && (existingTc.toolName === "Agent" || existingTc.toolName === "Task");
          if (isAgentTool) {
            const isErr = payload.isError as boolean;
            const now = Date.now();
            const subNode = useAgentStore.getState().subAgentTree.find((n) => n.id === toolCallId);
            const duration = subNode ? now - subNode.startedAt : undefined;
            useAgentStore.getState().updateSubAgent(toolCallId, {
              status: isErr ? "error" : "completed",
              completedAt: now,
              durationMs: duration,
              result: String(payload.result || "").slice(0, 200),
            });
            useAgentStore.getState().updateBackgroundTask(toolCallId, {
              status: isErr ? "error" : "completed",
              completedAt: now,
              durationMs: duration,
              ...(isErr ? { error: String(payload.result || "") } : { result: String(payload.result || "").slice(0, 200) }),
            });
          }
          store.getState().setStatusText("正在继续...");
          break;
        }

        case "context_usage": {
          const u = payload.usage as Record<string, number> | undefined;
          if (u) {
            // Save the latest per-call usage for accurate TaskResult
            latestUsage = u;
            // Total context = input + cache_creation + cache_read
            const total = (u.input_tokens ?? 0) +
              (u.cache_creation_input_tokens ?? 0) +
              (u.cache_read_input_tokens ?? 0);
            if (pendingCompactAfterUpdate && total > 0) {
              // Post-compact: accept this as the real post-compact token count
              store.getState().updateContextTokens(total);
              store.getState().updateLatestCompactAfter(total);
              postCompactTokens = total;
              pendingCompactAfterUpdate = false;
            } else if (postCompactTokens !== null) {
              // Compact happened but task_complete hasn't fired yet —
              // don't let pre-compact usage overwrite the post-compact value
            } else {
              store.getState().updateContextTokens(total);
            }
          }
          break;
        }

        case "context_compact": {
          // Backend sends compact_metadata from SDK's compact_boundary event
          // SDK uses camelCase (preTokens), old CLI format uses context_before/context_after
          const meta = payload.compact_metadata as Record<string, unknown> | undefined;
          const before = Number(meta?.preTokens ?? meta?.pre_tokens ?? 0)
            || (payload.context_before as Record<string, number> | undefined)?.used_tokens
            || 0;
          const after = Number(meta?.postTokens ?? meta?.post_tokens ?? 0)
            || (payload.context_after as Record<string, number> | undefined)?.used_tokens
            || 0;
          // The summary text is the assistant's streamed content generated during compact
          const summary = accumulatedText.trim() || undefined;
          // 方案A: persist summary to localStorage so it survives page refresh
          // (JSONL compact_boundary doesn't store summary, but isCompactSummary does —
          //  this is a fallback in case JSONL parsing misses it)
          if (summary) {
            try {
              const sid = store.getState().currentSessionId;
              if (sid) {
                const key = `compact_summary_${sid}_${Date.now()}`;
                localStorage.setItem(key, summary);
              }
            } catch { /* ignore */ }
          }
          store.getState().addCompactEvent(before, after, summary);
          if (after > 0) {
            store.getState().updateContextTokens(after);
            postCompactTokens = after;
          } else {
            // SDK doesn't provide post_tokens — estimate as ~50% of pre-compact,
            // and protect this estimate from being overwritten by task_complete.
            // The next real context_usage event will set the accurate value.
            const estimated = before > 0 ? Math.round(before * 0.5) : 0;
            if (estimated > 0) {
              store.getState().updateContextTokens(estimated);
              postCompactTokens = estimated;
            }
            pendingCompactAfterUpdate = true;
          }
          break;
        }

        case "task_complete": {
          // Cancel pending throttled flush — final commit
          if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
          textDirty = false; thinkingDirty = false;
          // Commit any remaining text/thinking
          if (accumulatedText) {
            store.getState().updateAssistantContent(accumulatedText);
            accumulatedText = "";
          }
          if (accumulatedThinking) {
            store.getState().updateAssistantThinking(accumulatedThinking);
            accumulatedThinking = "";
          }

          // Use per-call usage from the LATEST context_usage event (matches JSONL behavior)
          // instead of the cumulative result.usage which sums ALL API calls.
          const resultUsage = payload.usage as Record<string, number> | undefined;
          const u = latestUsage || resultUsage;
          const totalInput = u
            ? (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0)
            : undefined;

          // Finalize: mark running tools done, attach taskResult, stop streaming
          store.getState().stopStreaming({
            costUsd:         payload.costUsd as number | undefined,
            durationMs:      payload.durationMs as number | undefined,
            numTurns:        payload.numTurns as number | undefined,
            inputTokens:     totalInput,
            outputTokens:    u?.output_tokens,
            cacheReadTokens: u?.cache_read_input_tokens,
          });
          // Update context window gauge
          if (u) {
            const total = (u.input_tokens ?? 0) +
              (u.cache_creation_input_tokens ?? 0) +
              (u.cache_read_input_tokens ?? 0);
            if (postCompactTokens !== null) {
              // Compact happened — use the post-compact value, don't let task_complete overwrite
              store.getState().updateContextTokens(postCompactTokens);
            } else if (total > 0) {
              store.getState().updateContextTokens(total);
            }
            // Note: if pendingCompactAfterUpdate is still true here, it means
            // the real post-compact usage hasn't arrived yet. Do NOT use the
            // compact task's own usage as post-compact value — it's pre-compact.
            // The next conversation's context_usage will provide the real value.
          }
          break;
        }

        case "process_close":
          // Cancel pending throttled flush — final commit
          if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
          textDirty = false; thinkingDirty = false;
          // Commit any remaining text
          if (accumulatedText) {
            store.getState().updateAssistantContent(accumulatedText);
            accumulatedText = "";
          }
          if (accumulatedThinking) {
            store.getState().updateAssistantThinking(accumulatedThinking);
            accumulatedThinking = "";
          }

          // Ensure streaming is stopped (in case task_complete was never received)
          if (store.getState().isStreaming) {
            store.getState().stopStreaming();
          }

          // After compact, restore the correct post-compact token count
          // (task_complete or process_close may have overwritten it with pre-compact values)
          if (postCompactTokens !== null) {
            store.getState().updateContextTokens(postCompactTokens);
          }
          // Reset postCompactTokens (value is committed to store),
          // but keep pendingCompactAfterUpdate so next context_usage provides real post-compact value
          postCompactTokens = null;
          break;

        case "error": {
          const msg = (payload.message as string) || "未知错误";
          // Show error in the current assistant message
          const errorText = `⚠️ **错误**: ${msg}`;
          if (accumulatedText) {
            store.getState().updateAssistantContent(accumulatedText + "\n\n" + errorText);
          } else {
            store.getState().updateAssistantContent(errorText);
          }
          accumulatedText = "";
          accumulatedThinking = "";
          store.getState().stopStreaming();
          break;
        }

        case "permission_request": {
          // HIL: SDK 要求用户确认工具使用权限
          const permReq = {
            requestId: payload.requestId as string,
            sessionId: payload.sessionId as string,
            toolName: payload.toolName as string,
            toolInput: payload.toolInput as Record<string, unknown>,
            decisionReason: payload.decisionReason as string | undefined,
            blockedPath: payload.blockedPath as string | undefined,
            hasSuggestions: Array.isArray(payload.suggestions) && payload.suggestions.length > 0,
          };
          store.getState().addPermissionRequest(permReq);

          // Flush accumulated text
          if (accumulatedText) {
            store.getState().updateAssistantContent(accumulatedText);
            accumulatedText = "";
          }
          if (accumulatedThinking) {
            store.getState().updateAssistantThinking(accumulatedThinking);
            accumulatedThinking = "";
          }

          // Bidirectional dedup: tool_use_start may have ALREADY created a card
          // with the real SDK ID (requestId = toolUseID). If so, just update it
          // instead of creating a duplicate perm_ placeholder.
          const permState = store.getState();
          const permMsg = permState.messages.find((m) => m.id === permState.currentAssistantId);
          const existingCard = permMsg?.toolCalls?.find((tc) => tc.id === permReq.requestId);

          if (existingCard) {
            // tool_use_start arrived first — update existing card to awaiting_permission
            store.getState().updateToolCall(permReq.requestId, {
              status: "awaiting_permission",
              permissionRequestId: permReq.requestId,
              toolInput: permReq.toolInput, // backfill input (may have been empty from stream)
            });
          } else {
            // permission_request arrived first (rare) — create perm_ placeholder
            store.getState().addToolCallToCurrent({
              id: `perm_${permReq.requestId}`,
              toolName: permReq.toolName,
              toolInput: permReq.toolInput,
            });
            store.getState().updateToolCall(`perm_${permReq.requestId}`, {
              status: "awaiting_permission",
              permissionRequestId: permReq.requestId,
            });
          }

          store.getState().setStatusText(`等待确认: ${permReq.toolName}...`);
          break;
        }

        case "permission_timeout": {
          const timedOutId = payload.requestId as string;
          store.getState().removePermissionRequest(timedOutId);
          store.getState().setStatusText("权限请求已超时（60s），已自动拒绝");
          break;
        }

        case "process_stderr": {
          const text = payload.text as string;
          if (text?.trim()) {
            console.debug("[claude stderr]", text.trim());
          }
          break;
        }
      }
    });

    return () => {
      if (flushTimer) clearTimeout(flushTimer);
      unsub();
      wsService.disconnect();
    };
  }, [projectPath]);
}
