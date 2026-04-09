import type { FileNode, FileContent } from "../types/file";
import type { McpServer } from "../types/mcp";
import type { SkillInfo, SkillDetail, SkillGenerateResult } from "../types/skill";
import type { PluginInfo } from "../types/plugin";

// Always use relative path — Vite dev server proxies /api → localhost:3001
// This avoids CORS, system proxy, and firewall issues in dev mode.
const BASE = "/api";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  // Only set Content-Type when there's a body.
  // GET requests with Content-Type trigger CORS preflight even for simple
  // cross-origin requests, adding unnecessary latency on Windows/proxy setups.
  const headers: Record<string, string> =
    options?.body != null ? { "Content-Type": "application/json" } : {};
  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }
  return res.json();
}

export const api = {
  // ── Config ──
  getConfig: () => request<Record<string, unknown>>("/config"),
  updateConfig: (data: Record<string, unknown>) =>
    request("/config", { method: "PATCH", body: JSON.stringify(data) }),

  // ── Sessions ──
  getSessions: (project?: string) =>
    request<{ sessions: unknown[] }>(
      `/sessions${project ? `?project=${encodeURIComponent(project)}` : ""}`
    ),
  getSessionMessages: (sessionId: string, opts?: { offset?: number; limit?: number }) =>
    request<{
      messages: {
        role: "user" | "assistant";
        content: string;
        thinking?: string;
        toolCalls?: { id: string; toolName: string; toolInput: Record<string, unknown>; result?: string; isError?: boolean; status: "done" | "error" }[];
        taskResult?: { costUsd?: number; durationMs?: number; numTurns?: number; inputTokens?: number; outputTokens?: number; cacheReadTokens?: number };
        timestamp?: number;
      }[];
      total: number;
    }>(`/sessions/${encodeURIComponent(sessionId)}/messages${opts ? `?offset=${opts.offset ?? 0}&limit=${opts.limit ?? 50}` : ""}`),
  renameSession: (id: string, name: string) =>
    request<{ success: boolean }>(`/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  deleteSession: (id: string) =>
    request(`/sessions/${id}`, { method: "DELETE" }),
  getSessionCheckpoints: (sessionId: string) =>
    request<{
      checkpoints: {
        messageId: string;
        userContent: string;
        timestamp: string;
        changedFiles: {
          path: string;
          backupFileName: string | null;
          isNewFile: boolean;
        }[];
        hasFileChanges: boolean;
      }[];
      projectCwd: string | null;
    }>(`/sessions/${encodeURIComponent(sessionId)}/checkpoints`),
  rollbackSession: (sessionId: string, messageId: string) =>
    request<{
      success: boolean;
      fileResults: {
        path: string;
        action: "restored" | "deleted" | "skipped" | "failed";
        error?: string;
      }[];
      error?: string;
    }>(
      `/sessions/${encodeURIComponent(sessionId)}/rollback`,
      { method: "POST", body: JSON.stringify({ messageId }) }
    ),

  rewindSession: (sessionId: string, messageUuid: string, dryRun = false) =>
    request<{
      canRewind: boolean;
      error?: string;
      filesChanged?: string[];
      insertions?: number;
      deletions?: number;
      method: "sdk" | "fallback";
    }>(
      `/sessions/${encodeURIComponent(sessionId)}/rewind`,
      { method: "POST", body: JSON.stringify({ messageUuid, dryRun }) }
    ),

  // ── Files ──
  getFileTree: (projectPath: string, depth = 3) =>
    request<FileNode>(
      `/files/tree?path=${encodeURIComponent(projectPath)}&depth=${depth}`
    ),
  getFileContent: (filePath: string) =>
    request<FileContent>(
      `/files/content?path=${encodeURIComponent(filePath)}`
    ),
  searchFiles: (projectPath: string, query: string) =>
    request<{ results: { path: string; type: string }[] }>(
      `/files/search?path=${encodeURIComponent(projectPath)}&query=${encodeURIComponent(query)}`
    ),
  browseFolder: (folderPath?: string) =>
    request<{
      path: string | null;
      parent: string | null;
      entries: { name: string; type: "dir" | "file"; path: string }[];
    }>(
      `/files/browse${folderPath ? `?path=${encodeURIComponent(folderPath)}` : ""}`
    ),
  createFolder: (folderPath: string, projectRoot?: string) =>
    request<{ path: string }>("/files/mkdir", {
      method: "POST",
      body: JSON.stringify({ path: folderPath, projectRoot }),
    }),
  createFile: (filePath: string, content = "", projectRoot?: string) =>
    request<{ path: string }>("/files/create", {
      method: "POST",
      body: JSON.stringify({ filePath, content, projectRoot }),
    }),
  renameFile: (oldPath: string, newPath: string, projectRoot?: string) =>
    request<{ oldPath: string; newPath: string }>("/files/rename", {
      method: "POST",
      body: JSON.stringify({ oldPath, newPath, projectRoot }),
    }),
  deleteFile: (filePath: string, projectRoot?: string) =>
    request<{ success: boolean }>("/files/delete", {
      method: "DELETE",
      body: JSON.stringify({ filePath, projectRoot }),
    }),

  // ── MCP ──
  getMcpServers: (project?: string) =>
    request<{ servers: McpServer[] }>(
      `/mcp/servers${project ? `?project=${encodeURIComponent(project)}` : ""}`
    ),
  addMcpServer: (opts: {
    name: string;
    transport: string;
    url?: string;
    command?: string;
    args?: string[];
    scope?: string;
    env?: Record<string, string>;
    headers?: Record<string, string>;
    clientId?: string;
    clientSecret?: string;
    callbackPort?: number;
  }) =>
    request("/mcp/servers", { method: "POST", body: JSON.stringify(opts) }),
  addMcpServerJson: (name: string, json: string, scope?: string) =>
    request("/mcp/servers/json", {
      method: "POST",
      body: JSON.stringify({ name, json, scope }),
    }),
  removeMcpServer: (name: string) =>
    request(`/mcp/servers/${encodeURIComponent(name)}`, { method: "DELETE" }),
  importMcpFromDesktop: () =>
    request<{ imported: string[]; count: number }>("/mcp/import-desktop", {
      method: "POST",
    }),
  getMcpServerConfig: (name: string, project?: string) =>
    request<{ config: Record<string, unknown>; scope: string }>(
      `/mcp/servers/${encodeURIComponent(name)}/config${project ? `?project=${encodeURIComponent(project)}` : ""}`
    ),
  updateMcpServerConfig: (name: string, config: Record<string, unknown>, scope: string, project?: string) =>
    request(`/mcp/servers/${encodeURIComponent(name)}/config${project ? `?project=${encodeURIComponent(project)}` : ""}`, {
      method: "PATCH",
      body: JSON.stringify({ config, scope }),
    }),

  // ── Skills ──
  getSkills: (project?: string) =>
    request<{ project: SkillInfo[]; user: SkillInfo[]; plugin?: SkillInfo[] }>(
      `/skills${project ? `?project=${encodeURIComponent(project)}` : ""}`
    ),
  getSkillDetail: (scope: string, name: string, project?: string) =>
    request<SkillDetail>(
      `/skills/${scope}/${encodeURIComponent(name)}${project ? `?project=${encodeURIComponent(project)}` : ""}`
    ),
  saveSkill: (
    scope: string,
    name: string,
    frontmatter: Record<string, unknown>,
    content: string,
    project?: string
  ) =>
    request(`/skills${project ? `?project=${encodeURIComponent(project)}` : ""}`, {
      method: "POST",
      body: JSON.stringify({ scope, name, frontmatter, content }),
    }),
  deleteSkill: (scope: string, name: string, project?: string) =>
    request(
      `/skills/${scope}/${encodeURIComponent(name)}${project ? `?project=${encodeURIComponent(project)}` : ""}`,
      { method: "DELETE" }
    ),
  generateSkill: async (description: string, model?: string, signal?: AbortSignal) => {
    const res = await fetch(`${BASE}/skills/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, model }),
      signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
      throw new Error(err.error?.message || res.statusText);
    }
    return res.json() as Promise<SkillGenerateResult>;
  },

  // ── Plugins ──
  getPlugins: () => request<{ plugins: PluginInfo[] }>("/plugins"),
  installPlugin: (name: string, scope?: string) =>
    request("/plugins/install", {
      method: "POST",
      body: JSON.stringify({ name, scope }),
    }),
  uninstallPlugin: (name: string) =>
    request(`/plugins/${encodeURIComponent(name)}`, { method: "DELETE" }),
  togglePlugin: (name: string, enabled: boolean) =>
    request(`/plugins/${encodeURIComponent(name)}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),

  // ── Marketplace ──
  getMarketplacePlugins: () =>
    request<{ plugins: import("../stores/marketplaceStore").MarketplacePlugin[] }>("/marketplace/plugins"),
  getMarketplaceSources: () =>
    request<{ sources: { name: string; source: string }[] }>("/marketplace/sources"),
  updateMarketplace: (name?: string) =>
    request("/marketplace/update", {
      method: "POST",
      body: JSON.stringify(name ? { name } : {}),
    }),
  installFromMarketplace: (name: string, scope?: string) =>
    request("/marketplace/install", {
      method: "POST",
      body: JSON.stringify({ name, scope }),
    }),

  // ── Memory ──
  getAutoMemory: (project?: string) =>
    request<{
      enabled: boolean;
      memoryDir: string;
      index: {
        path: string;
        content: string;
        lineCount: number;
        maxAutoLoadLines: number;
        size: number;
        modified: string;
      } | null;
      topicFiles: { name: string; preview: string; size: number; modified: string }[];
    }>(`/memory/auto${project ? `?project=${encodeURIComponent(project)}` : ""}`),
  getMemoryFile: (project: string, filename: string) =>
    request<{ name: string; content: string; lineCount: number; size: number }>(
      `/memory/auto/${encodeURIComponent(filename)}?project=${encodeURIComponent(project)}`
    ),
  saveMemoryFile: (project: string, filename: string, content: string) =>
    request(`/memory/auto/${encodeURIComponent(filename)}?project=${encodeURIComponent(project)}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),
  createMemoryFile: (project: string, filename: string) =>
    request(`/memory/auto?project=${encodeURIComponent(project)}`, {
      method: "POST",
      body: JSON.stringify({ filename, content: "" }),
    }),
  deleteMemoryFile: (project: string, filename: string) =>
    request(`/memory/auto/${encodeURIComponent(filename)}?project=${encodeURIComponent(project)}`, {
      method: "DELETE",
    }),
  clearAllMemory: (project: string) =>
    request(`/memory/auto?project=${encodeURIComponent(project)}`, {
      method: "DELETE",
    }),
  setAutoMemoryEnabled: (enabled: boolean) =>
    request("/memory/auto/settings", {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),
  getClaudeMdLevels: (project?: string) =>
    request<{
      levels: {
        scope: string;
        path: string;
        exists: boolean;
        content: string | null;
        lineCount: number;
        files?: { name: string; lineCount: number }[];
      }[];
    }>(`/memory/claudemd${project ? `?project=${encodeURIComponent(project)}` : ""}`),
  saveClaudeMd: (scope: string, content: string, project: string) =>
    request(`/memory/claudemd/${scope}?project=${encodeURIComponent(project)}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),

  // ── Rules ──
  getRules: (project?: string, scope: "project" | "user" = "project") => {
    const params = new URLSearchParams();
    if (project) params.set("project", project);
    if (scope !== "project") params.set("scope", scope);
    const qs = params.toString();
    return request<{ rules: { name: string; content: string; lineCount: number }[] }>(
      `/memory/claudemd/rules${qs ? `?${qs}` : ""}`
    );
  },
  saveRule: (name: string, content: string, project?: string, scope: "project" | "user" = "project") => {
    const params = new URLSearchParams();
    if (project) params.set("project", project);
    if (scope !== "project") params.set("scope", scope);
    const qs = params.toString();
    return request(`/memory/claudemd/rules${qs ? `?${qs}` : ""}`, {
      method: "POST",
      body: JSON.stringify({ name, content }),
    });
  },
  deleteRule: (name: string, project?: string, scope: "project" | "user" = "project") => {
    const params = new URLSearchParams();
    if (project) params.set("project", project);
    if (scope !== "project") params.set("scope", scope);
    const qs = params.toString();
    return request(
      `/memory/claudemd/rules/${encodeURIComponent(name)}${qs ? `?${qs}` : ""}`,
      { method: "DELETE" }
    );
  },

  // ── Hooks ──
  getHooks: (scope: "user" | "project" | "project-local" = "user", project?: string) => {
    const params = new URLSearchParams();
    if (scope !== "user") params.set("scope", scope);
    if (project) params.set("project", project);
    const qs = params.toString();
    return request<{ hooks: import("../stores/hooksStore").HooksConfig }>(
      `/hooks${qs ? `?${qs}` : ""}`
    );
  },
  saveHooks: (hooks: import("../stores/hooksStore").HooksConfig, scope: "user" | "project" | "project-local" = "user", project?: string) => {
    const params = new URLSearchParams();
    if (scope !== "user") params.set("scope", scope);
    if (project) params.set("project", project);
    const qs = params.toString();
    return request(`/hooks${qs ? `?${qs}` : ""}`, {
      method: "PUT",
      body: JSON.stringify({ hooks }),
    });
  },

  // ── Agents ──
  getAgents: (project?: string) =>
    request<{
      builtin: import("../types/agent").AgentInfo[];
      project: import("../types/agent").AgentInfo[];
      user: import("../types/agent").AgentInfo[];
    }>(`/agents${project ? `?project=${encodeURIComponent(project)}` : ""}`),
  getAgentDetail: (scope: string, name: string, project?: string) =>
    request<import("../types/agent").AgentDetail>(
      `/agents/${scope}/${encodeURIComponent(name)}${project ? `?project=${encodeURIComponent(project)}` : ""}`
    ),
  saveAgent: (
    scope: string,
    name: string,
    frontmatter: Record<string, unknown>,
    content: string,
    project?: string
  ) =>
    request(`/agents${project ? `?project=${encodeURIComponent(project)}` : ""}`, {
      method: "POST",
      body: JSON.stringify({ scope, name, frontmatter, content }),
    }),
  deleteAgent: (scope: string, name: string, project?: string) =>
    request(
      `/agents/${scope}/${encodeURIComponent(name)}${project ? `?project=${encodeURIComponent(project)}` : ""}`,
      { method: "DELETE" }
    ),

  // ── Workflows ──
  getWorkflows: (project?: string) =>
    request<{ workflows: import("../types/workflow").Workflow[] }>(
      `/workflows${project ? `?project=${encodeURIComponent(project)}` : ""}`
    ),
  saveWorkflow: (workflow: import("../types/workflow").Workflow, project?: string) =>
    request(`/workflows${project ? `?project=${encodeURIComponent(project)}` : ""}`, {
      method: "POST",
      body: JSON.stringify(workflow),
    }),
  deleteWorkflow: (id: string, project?: string) =>
    request(
      `/workflows/${encodeURIComponent(id)}${project ? `?project=${encodeURIComponent(project)}` : ""}`,
      { method: "DELETE" }
    ),

  // ── Teams ──
  getTeamsEnabled: () =>
    request<{ enabled: boolean }>("/teams/enabled"),
  getTeams: () =>
    request<{ teams: import("../types/team").TeamInfo[] }>("/teams"),
  getTeam: (name: string) =>
    request<import("../types/team").TeamInfo>(`/teams/${encodeURIComponent(name)}`),
  createTeam: (name: string) =>
    request<import("../types/team").TeamInfo>("/teams", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  deleteTeam: (name: string) =>
    request<{ success: boolean }>(`/teams/${encodeURIComponent(name)}`, { method: "DELETE" }),
  getTeamTasks: (name: string) =>
    request<{ tasks: import("../types/team").TeamTask[] }>(`/teams/${encodeURIComponent(name)}/tasks`),
  updateTeamTask: (name: string, taskId: string, updates: Record<string, unknown>) =>
    request(`/teams/${encodeURIComponent(name)}/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),
  getTeamMessages: (name: string, limit?: number) =>
    request<{ messages: import("../types/team").TeamMessage[] }>(
      `/teams/${encodeURIComponent(name)}/messages${limit ? `?limit=${limit}` : ""}`
    ),

  // ── Attachments ──
  uploadAttachment: async (file: File, projectPath: string) => {
    const form = new FormData();
    form.append("file", file);
    // Send original filename as separate UTF-8 field to avoid multer encoding issues with non-ASCII names
    form.append("originalName", file.name);
    const res = await fetch(
      `${BASE}/attachments/upload?project=${encodeURIComponent(projectPath)}`,
      { method: "POST", body: form }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || res.statusText);
    }
    return res.json() as Promise<{
      id: string;
      name: string;
      type: string;
      size: number;
      serverPath: string;
    }>;
  },
  deleteAttachment: async (id: string, projectPath: string) => {
    await request(`/attachments/${encodeURIComponent(id)}?project=${encodeURIComponent(projectPath)}`, {
      method: "DELETE",
    });
  },

  // ── Health ──
  health: () => request<{ status: string }>("/health"),

  // ── System ──
  systemApi: {
    getClaudeInfo: () =>
      request<import("../stores/systemStore").ClaudeInfo>("/system/claude-info"),
    runDoctor: () =>
      request<{ sections: import("../stores/systemStore").DoctorSection[] }>(
        "/system/claude-doctor",
        { method: "POST" }
      ),
    runUpdate: () =>
      request<{ success: boolean; output: string }>("/system/claude-update", {
        method: "POST",
      }),
    getProxy: () =>
      request<import("../stores/systemStore").ProxySettings>("/system/proxy"),
    saveProxy: (proxy: import("../stores/systemStore").ProxySettings) => {
      const params = new URLSearchParams({
        http:  proxy.httpProxy,
        https: proxy.httpsProxy,
        socks: proxy.socksProxy,
      });
      return request<{ success: boolean }>(`/system/proxy-save?${params.toString()}`);
    },
    getAuthStatus: () =>
      request<import("../stores/systemStore").AuthStatus>("/system/auth-status"),
    testProxy: (host: string, port: number) =>
      request<import("../stores/systemStore").ProxyTestResult>(
        `/system/proxy-test?host=${encodeURIComponent(host)}&port=${port}`
      ),
    testClaude: (opts: {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      httpProxy?: string;
      httpsProxy?: string;
    }) =>
      request<import("../stores/systemStore").ClaudeTestResult>("/system/claude-test", {
        method: "POST",
        body: JSON.stringify(opts),
      }),
    getClaudeSettings: () =>
      request<{ env: Record<string, string> }>("/system/claude-settings"),
    saveClaudeSettings: (env: Record<string, string | undefined>) =>
      request<{ success: boolean }>("/system/claude-settings", {
        method: "POST",
        body: JSON.stringify({ env }),
      }),
    pickFolder: () =>
      request<{ path: string | null }>("/system/pick-folder"),
    debugClaudeHome: () =>
      request<{
        claudeHome: string;
        projectsDir: string;
        projectsDirExists: boolean;
        projectDirs: string[];
        sessionCount: number;
      }>("/system/debug-claude-home"),
  },
};
