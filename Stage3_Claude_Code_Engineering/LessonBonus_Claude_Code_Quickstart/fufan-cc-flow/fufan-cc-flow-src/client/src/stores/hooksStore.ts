import { create } from "zustand";
import { api } from "../services/api";

// ── Types matching Claude Code CLI settings.json format ──

export interface CommandHook {
  type: "command";
  command: string;
  timeout?: number;
  async?: boolean;
}

export interface HttpHook {
  type: "http";
  url: string;
  method?: string;
  headers?: Record<string, string>;
  allowedEnvVars?: string[];
  timeout?: number;
  async?: boolean;
}

export interface PromptHook {
  type: "prompt";
  prompt: string;
  model?: string;
  timeout?: number;
  async?: boolean;
}

export interface AgentHook {
  type: "agent";
  prompt: string;
  model?: string;
  allowToolUse?: boolean;
  timeout?: number;
  async?: boolean;
}

export type HookHandler = CommandHook | HttpHook | PromptHook | AgentHook;

export interface HookRule {
  matcher: string;
  hooks: HookHandler[];
}

/** event name → array of rules (each rule = matcher + handlers) */
export type HooksConfig = Record<string, HookRule[]>;

export type HooksScope = "user" | "project" | "project-local";

// ── All 17 hook events grouped by category ──

export interface HookEventDef {
  id: string;
  desc: string;
  matcherHint: string; // what the matcher field matches on
  category: string;
}

export const HOOK_EVENT_CATEGORIES = [
  "会话生命周期",
  "用户交互",
  "工具事件",
  "Agent 事件",
  "配置与环境",
] as const;

export const HOOK_EVENTS: HookEventDef[] = [
  // 会话生命周期
  { id: "SessionStart",   desc: "会话开始/恢复",       matcherHint: "startup|resume|clear|compact",                  category: "会话生命周期" },
  { id: "SessionEnd",     desc: "会话结束",            matcherHint: "clear|logout|prompt_input_exit|other",           category: "会话生命周期" },
  { id: "Stop",           desc: "Claude 回复结束",      matcherHint: "无 matcher（始终触发）",                          category: "会话生命周期" },
  { id: "PreCompact",     desc: "上下文压缩前",         matcherHint: "manual|auto",                                    category: "会话生命周期" },
  // 用户交互
  { id: "UserPromptSubmit", desc: "用户提交 Prompt",   matcherHint: "无 matcher（始终触发）",                          category: "用户交互" },
  { id: "Notification",   desc: "通知事件",             matcherHint: "permission_prompt|idle_prompt|auth_success",      category: "用户交互" },
  // 工具事件
  { id: "PreToolUse",     desc: "工具调用前",           matcherHint: "工具名: Bash|Edit|Write|Read|Grep|mcp__*",        category: "工具事件" },
  { id: "PostToolUse",    desc: "工具调用后（成功）",    matcherHint: "工具名: Bash|Edit|Write|Read|Grep|mcp__*",        category: "工具事件" },
  { id: "PostToolUseFailure", desc: "工具调用后（失败）", matcherHint: "工具名: Bash|Edit|Write|Read|Grep|mcp__*",      category: "工具事件" },
  { id: "PermissionRequest", desc: "权限请求弹窗",      matcherHint: "工具名: Bash|Edit|Write|Read|mcp__*",             category: "工具事件" },
  // Agent 事件
  { id: "SubagentStart",  desc: "子 Agent 启动",        matcherHint: "Agent 类型: Bash|Explore|Plan|自定义",            category: "Agent 事件" },
  { id: "SubagentStop",   desc: "子 Agent 结束",        matcherHint: "Agent 类型: Bash|Explore|Plan|自定义",            category: "Agent 事件" },
  { id: "TeammateIdle",   desc: "Agent 团队成员空闲",    matcherHint: "无 matcher（始终触发）",                          category: "Agent 事件" },
  { id: "TaskCompleted",  desc: "任务标记完成",          matcherHint: "无 matcher（始终触发）",                          category: "Agent 事件" },
  // 配置与环境
  { id: "ConfigChange",   desc: "配置文件变更",          matcherHint: "user_settings|project_settings|skills",          category: "配置与环境" },
  { id: "WorktreeCreate", desc: "Worktree 创建",        matcherHint: "无 matcher（始终触发）",                          category: "配置与环境" },
  { id: "WorktreeRemove", desc: "Worktree 移除",        matcherHint: "无 matcher（始终触发）",                          category: "配置与环境" },
];

// ── Flat entry for UI convenience ──
// Internally we work with flat entries and convert to/from nested CLI format

export interface FlatHookEntry {
  event: string;
  matcher: string;
  handler: HookHandler;
}

function flattenConfig(config: HooksConfig): FlatHookEntry[] {
  const entries: FlatHookEntry[] = [];
  for (const [event, rules] of Object.entries(config)) {
    for (const rule of rules) {
      for (const handler of rule.hooks) {
        entries.push({ event, matcher: rule.matcher, handler });
      }
    }
  }
  return entries;
}

function unflattenEntries(entries: FlatHookEntry[]): HooksConfig {
  const config: HooksConfig = {};
  for (const entry of entries) {
    if (!config[entry.event]) config[entry.event] = [];
    // Find existing rule with same matcher
    let rule = config[entry.event].find((r) => r.matcher === entry.matcher);
    if (!rule) {
      rule = { matcher: entry.matcher, hooks: [] };
      config[entry.event].push(rule);
    }
    rule.hooks.push(entry.handler);
  }
  return config;
}

// ── Store ──

interface HooksState {
  entries: FlatHookEntry[];
  scope: HooksScope;
  loading: boolean;

  loadHooks: (scope?: HooksScope, project?: string) => Promise<void>;
  setScope: (scope: HooksScope, project?: string) => Promise<void>;
  addEntry: (entry: FlatHookEntry, project?: string) => Promise<void>;
  removeEntry: (index: number, project?: string) => Promise<void>;
  updateEntry: (index: number, entry: FlatHookEntry, project?: string) => Promise<void>;
}

export const useHooksStore = create<HooksState>((set, get) => ({
  entries: [],
  scope: "user",
  loading: false,

  loadHooks: async (scope, project) => {
    const s = scope || get().scope;
    set({ loading: true, scope: s });
    try {
      const { hooks } = await api.getHooks(s, project);
      set({ entries: flattenConfig(hooks), loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setScope: async (scope, project) => {
    await get().loadHooks(scope, project);
  },

  addEntry: async (entry, project) => {
    const entries = [...get().entries, entry];
    set({ entries });
    await api.saveHooks(unflattenEntries(entries), get().scope, project);
  },

  removeEntry: async (index, project) => {
    const entries = get().entries.filter((_, i) => i !== index);
    set({ entries });
    await api.saveHooks(unflattenEntries(entries), get().scope, project);
  },

  updateEntry: async (index, entry, project) => {
    const entries = [...get().entries];
    entries[index] = entry;
    set({ entries });
    await api.saveHooks(unflattenEntries(entries), get().scope, project);
  },
}));
