import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage, ToolCall, TokenUsage, TaskResult, Attachment, PermissionRequest } from "../types/claude";

interface ChatState {
  messages: ChatMessage[];
  currentSessionId: string | null;
  /** ID of the assistant message being built for the current task */
  currentAssistantId: string | null;
  isStreaming: boolean;
  streamingText: string;
  /** Status line text shown during streaming (e.g., "正在读取文件...") */
  statusText: string;
  totalUsage: TokenUsage;
  totalCost: number;
  hasMoreHistory: boolean;
  historyOffset: number;
  /** Unix ms timestamp of when streaming started (for elapsed timer) */
  streamingStartedAt: number | null;
  /** Latest context window usage from context_usage WS events */
  contextTokens: number;
  /** Dynamic context window max (updated from model info, default 200K) */
  contextMax: number;
  /** Pending HIL permission requests (keyed by requestId) */
  pendingPermissions: Map<string, PermissionRequest>;
  /** Pending session fork — next message will use forkSession: true */
  pendingFork: { sessionId: string } | null;

  addUserMessage: (text: string, attachments?: Attachment[]) => void;
  /** Start streaming: creates empty assistant message, sets isStreaming=true */
  startStreaming: () => void;
  /** Create a new assistant message for a new API turn (mid-task, keeps streaming) */
  addAssistantTurn: () => void;
  /** Update the text content of the current assistant message */
  updateAssistantContent: (text: string) => void;
  /** Update the thinking content of the current assistant message */
  updateAssistantThinking: (thinking: string) => void;
  /** Add a tool call to the current assistant message (dedup by ID) */
  addToolCallToCurrent: (tc: Omit<ToolCall, "status" | "result" | "isError">) => void;
  /** Update a tool call's result/status anywhere in messages */
  updateToolCall: (id: string, update: Partial<ToolCall>) => void;
  /** Replace a tool call's ID (used to merge permission placeholder with real SDK tool ID) */
  replaceToolCallId: (oldId: string, newId: string) => void;
  /** Mark all running tool calls in current assistant message as done */
  finishRunningTools: () => void;
  setSessionId: (id: string) => void;
  /** Finalize streaming: attach taskResult, mark running tools done, set isStreaming=false */
  stopStreaming: (taskResult?: TaskResult) => void;
  setStatusText: (text: string) => void;
  addCompactEvent: (tokensBefore: number, tokensAfter: number, summary?: string) => void;
  /** Update the tokensAfter on the most recent compact divider (for delayed post-compact stats) */
  updateLatestCompactAfter: (tokensAfter: number) => void;
  updateContextTokens: (tokens: number) => void;
  updateContextMax: (max: number) => void;
  /** Add a pending permission request */
  addPermissionRequest: (req: PermissionRequest) => void;
  /** Remove a pending permission request (after user responds) */
  removePermissionRequest: (requestId: string) => void;
  /** Set pending fork (next message will create a forked session) */
  setPendingFork: (fork: { sessionId: string }) => void;
  /** Clear pending fork */
  clearPendingFork: () => void;
  /** Mark all messages from a given message ID onward as rolled back */
  markMessagesRolledBack: (fromMessageId: string) => void;
  clearMessages: () => void;
  loadHistoryMessages: (
    msgs: { role: "user" | "assistant" | "system"; content: string; thinking?: string; toolCalls?: ToolCall[]; taskResult?: TaskResult; compactData?: { tokensBefore: number; tokensAfter: number; summary?: string }; rolledBack?: boolean; timestamp?: number }[],
    total: number,
    offset?: number
  ) => void;
}

let msgCounter = 0;

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
  messages: [],
  currentSessionId: null,
  currentAssistantId: null,
  isStreaming: false,
  streamingText: "",
  statusText: "",
  totalUsage: { inputTokens: 0, outputTokens: 0 },
  totalCost: 0,
  hasMoreHistory: false,
  historyOffset: 0,
  streamingStartedAt: null,
  contextTokens: 0,
  contextMax: 200_000,
  pendingPermissions: new Map(),
  pendingFork: null,

  addUserMessage: (text, attachments) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: `user_${++msgCounter}`,
          role: "user",
          content: text,
          timestamp: Date.now(),
          attachments,
        },
      ],
    })),

  startStreaming: () => {
    const id = `asst_${++msgCounter}`;
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id,
          role: "assistant" as const,
          content: "",
          timestamp: Date.now(),
        },
      ],
      currentAssistantId: id,
      isStreaming: true,
      streamingText: "",
      streamingStartedAt: Date.now(),
      statusText: "正在思考...",
    }));
  },

  addAssistantTurn: () => {
    const id = `asst_${++msgCounter}`;
    set((s) => ({
      messages: [
        // New turn means all previous tools have completed — mark them done
        ...s.messages.map((m) => {
          if (!m.toolCalls) return m;
          const hasRunning = m.toolCalls.some((tc) => tc.status === "running");
          if (!hasRunning) return m;
          return {
            ...m,
            toolCalls: m.toolCalls.map((tc) =>
              tc.status === "running" ? { ...tc, status: "done" as const } : tc
            ),
          };
        }),
        {
          id,
          role: "assistant" as const,
          content: "",
          timestamp: Date.now(),
        },
      ],
      currentAssistantId: id,
      // Keep isStreaming=true, streamingStartedAt, etc. — task is still active
      streamingText: "",
    }));
  },

  updateAssistantContent: (text) =>
    set((s) => {
      if (!s.currentAssistantId) return s;
      return {
        messages: s.messages.map((m) =>
          m.id === s.currentAssistantId ? { ...m, content: text } : m
        ),
        streamingText: "",
      };
    }),

  updateAssistantThinking: (thinking) =>
    set((s) => {
      if (!s.currentAssistantId) return s;
      return {
        messages: s.messages.map((m) =>
          m.id === s.currentAssistantId ? { ...m, thinking } : m
        ),
      };
    }),

  addToolCallToCurrent: (tc) =>
    set((s) => {
      if (!s.currentAssistantId) return s;
      // Dedup: skip if already exists
      const exists = s.messages.some((m) =>
        m.toolCalls?.some((existing) => existing.id === tc.id)
      );
      if (exists) return s;

      const toolCall: ToolCall = { ...tc, status: "running", result: undefined, isError: undefined };
      return {
        messages: s.messages.map((m) =>
          m.id === s.currentAssistantId
            ? { ...m, toolCalls: [...(m.toolCalls || []), toolCall] }
            : m
        ),
      };
    }),

  updateToolCall: (id, update) =>
    set((s) => ({
      messages: s.messages.map((m) => {
        if (!m.toolCalls) return m;
        const tcs = m.toolCalls.map((tc) =>
          tc.id === id ? { ...tc, ...update } : tc
        );
        return { ...m, toolCalls: tcs };
      }),
    })),

  replaceToolCallId: (oldId, newId) =>
    set((s) => ({
      messages: s.messages.map((m) => {
        if (!m.toolCalls) return m;
        const hasMatch = m.toolCalls.some((tc) => tc.id === oldId);
        if (!hasMatch) return m;
        return {
          ...m,
          toolCalls: m.toolCalls.map((tc) =>
            tc.id === oldId ? { ...tc, id: newId } : tc
          ),
        };
      }),
    })),

  finishRunningTools: () =>
    set((s) => {
      if (!s.currentAssistantId) return s;
      return {
        messages: s.messages.map((m) => {
          if (m.id !== s.currentAssistantId || !m.toolCalls) return m;
          const hasRunning = m.toolCalls.some((tc) => tc.status === "running");
          if (!hasRunning) return m;
          return {
            ...m,
            toolCalls: m.toolCalls.map((tc) =>
              tc.status === "running" ? { ...tc, status: "done" as const } : tc
            ),
          };
        }),
      };
    }),

  setSessionId: (id) => set({ currentSessionId: id || null }),

  stopStreaming: (taskResult) =>
    set((s) => {
      // Mark ALL "running" tool calls as "done" — stream-json never sends
      // tool_result events (they're in user messages which aren't streamed),
      // so tools would stay "running" forever without this.
      let msgs = s.messages.map((m) => {
        if (!m.toolCalls) return m;
        const hasRunning = m.toolCalls.some((tc) => tc.status === "running");
        if (!hasRunning) return m;
        return {
          ...m,
          toolCalls: m.toolCalls.map((tc) =>
            tc.status === "running" ? { ...tc, status: "done" as const } : tc
          ),
        };
      });

      // Attach taskResult to the current or last assistant message
      if (taskResult && s.currentAssistantId) {
        msgs = msgs.map((m) =>
          m.id === s.currentAssistantId ? { ...m, taskResult } : m
        );
      } else if (taskResult) {
        // Fallback: attach to last assistant
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === "assistant") {
            msgs[i] = { ...msgs[i], taskResult };
            break;
          }
        }
      }
      const cost = taskResult?.costUsd ?? 0;
      const inputTokens = taskResult?.inputTokens ?? 0;
      const outputTokens = taskResult?.outputTokens ?? 0;
      return {
        messages: msgs,
        currentAssistantId: null,
        isStreaming: false,
        streamingText: "",
        streamingStartedAt: null,
        statusText: "",
        totalCost: s.totalCost + cost,
        totalUsage: {
          inputTokens: s.totalUsage.inputTokens + inputTokens,
          outputTokens: s.totalUsage.outputTokens + outputTokens,
        },
      };
    }),

  setStatusText: (text) => set({ statusText: text }),

  addCompactEvent: (tokensBefore, tokensAfter, summary) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: `compact_${++msgCounter}`,
          role: "system" as const,
          content: "",
          timestamp: Date.now(),
          compactData: { tokensBefore, tokensAfter, summary },
        },
      ],
    })),

  updateLatestCompactAfter: (tokensAfter) =>
    set((s) => {
      // Find the last compact message and update its tokensAfter
      const idx = [...s.messages].reverse().findIndex(
        (m) => m.role === "system" && m.compactData && m.compactData.tokensAfter === 0
      );
      if (idx < 0) return s;
      const realIdx = s.messages.length - 1 - idx;
      const msgs = [...s.messages];
      const msg = msgs[realIdx];
      msgs[realIdx] = {
        ...msg,
        compactData: { ...msg.compactData!, tokensAfter },
      };
      return { messages: msgs };
    }),

  updateContextTokens: (tokens) => set({ contextTokens: tokens }),

  updateContextMax: (max) => set({ contextMax: max }),

  addPermissionRequest: (req) =>
    set((s) => {
      const next = new Map(s.pendingPermissions);
      next.set(req.requestId, req);
      return { pendingPermissions: next };
    }),

  removePermissionRequest: (requestId) =>
    set((s) => {
      const next = new Map(s.pendingPermissions);
      next.delete(requestId);
      return { pendingPermissions: next };
    }),

  setPendingFork: (fork) => set({ pendingFork: fork }),
  clearPendingFork: () => set({ pendingFork: null }),

  markMessagesRolledBack: (fromMessageId) =>
    set((s) => {
      const idx = s.messages.findIndex((m) => m.id === fromMessageId);
      if (idx < 0) return s;
      // Persist the rollback timestamp so it survives page refresh
      const rollbackTs = s.messages[idx]?.timestamp;
      if (rollbackTs && s.currentSessionId) {
        try {
          const key = `rollback_${s.currentSessionId}`;
          localStorage.setItem(key, String(rollbackTs));
        } catch { /* localStorage might be unavailable */ }
      }
      // Mark this message and everything after it as rolled back
      return {
        messages: s.messages.map((m, i) =>
          i >= idx ? { ...m, rolledBack: true } : m
        ),
      };
    }),

  clearMessages: () =>
    set({
      messages: [],
      currentSessionId: null,
      currentAssistantId: null,
      isStreaming: false,
      streamingText: "",
      statusText: "",
      hasMoreHistory: false,
      historyOffset: 0,
      totalCost: 0,
      totalUsage: { inputTokens: 0, outputTokens: 0 },
      contextTokens: 0,
      pendingPermissions: new Map(),
      pendingFork: null,
    }),

  loadHistoryMessages: (msgs, total, offset = 0) =>
    set((s) => {
      const mapped: ChatMessage[] = msgs.map((m) => ({
        id: `hist_${++msgCounter}`,
        role: m.role as ChatMessage["role"],
        content: m.content,
        thinking: m.thinking,
        toolCalls: m.toolCalls as ToolCall[] | undefined,
        taskResult: m.taskResult,
        compactData: m.compactData,
        // Use server-provided rolledBack flag (from parentUuid chain analysis)
        rolledBack: m.rolledBack || undefined,
        timestamp: m.timestamp ?? Date.now(),
      }));
      const loadedSoFar = offset + msgs.length;

      // Compute cumulative cost/usage from ALL messages (existing + new)
      const allMsgs = offset > 0 ? [...mapped, ...s.messages] : mapped;
      let histCost = 0;
      let histInput = 0;
      let histOutput = 0;
      let lastInputTokens = 0;
      for (const m of allMsgs) {
        if (m.taskResult) {
          histCost += m.taskResult.costUsd ?? 0;
          histInput += m.taskResult.inputTokens ?? 0;
          histOutput += m.taskResult.outputTokens ?? 0;
          if (m.taskResult.inputTokens) {
            lastInputTokens = m.taskResult.inputTokens;
          }
        }
      }

      return {
        messages: allMsgs,
        currentAssistantId: null,
        isStreaming: false,
        streamingText: "",
        hasMoreHistory: total > loadedSoFar,
        historyOffset: loadedSoFar,
        totalCost: histCost,
        totalUsage: { inputTokens: histInput, outputTokens: histOutput },
        contextTokens: lastInputTokens,
      };
    }),
    }),
    {
      name: "fufan-cc-chat",
      // Only persist currentSessionId — messages are loaded from JSONL on demand
      partialize: (state) => ({ currentSessionId: state.currentSessionId }),
    }
  )
);
