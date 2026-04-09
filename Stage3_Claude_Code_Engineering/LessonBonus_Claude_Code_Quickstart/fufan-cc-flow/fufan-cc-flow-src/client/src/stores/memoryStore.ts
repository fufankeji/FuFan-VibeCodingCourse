import { create } from "zustand";
import { api } from "../services/api";

interface MemoryFileInfo {
  name: string;
  preview: string;
  size: number;
  modified: string;
}

interface MemoryIndex {
  path: string;
  content: string;
  lineCount: number;
  maxAutoLoadLines: number;
  size: number;
  modified: string;
}

interface ClaudeMdLevel {
  scope: string;
  path: string;
  exists: boolean;
  content: string | null;
  lineCount: number;
  files?: { name: string; lineCount: number }[];
}

interface RuleFile {
  name: string;
  content: string;
  lineCount: number;
}

interface EditingFile {
  type: "memory" | "claudemd" | "rule";
  name: string;
  content: string;
  scope?: string; // for claudemd
}

interface MemoryState {
  // Auto Memory
  autoMemoryEnabled: boolean;
  memoryDir: string;
  memoryIndex: MemoryIndex | null;
  topicFiles: MemoryFileInfo[];

  // CLAUDE.md
  claudeMdLevels: ClaudeMdLevel[];

  // Rules
  rules: RuleFile[];
  userRules: RuleFile[];

  // UI
  loading: boolean;
  editingFile: EditingFile | null;

  // Actions
  loadAll: (project?: string) => Promise<void>;
  loadAutoMemory: (project?: string) => Promise<void>;
  loadClaudeMd: (project?: string) => Promise<void>;
  openFile: (type: EditingFile["type"], name: string, project?: string, scope?: string) => Promise<void>;
  saveFile: (type: EditingFile["type"], name: string, content: string, project?: string, scope?: string) => Promise<void>;
  deleteFile: (type: EditingFile["type"], name: string, project?: string, scope?: string) => Promise<void>;
  createMemoryTopic: (filename: string, project?: string) => Promise<void>;
  createRule: (name: string, content: string, project?: string, scope?: "project" | "user") => Promise<void>;
  closeEditor: () => void;
  setAutoMemoryEnabled: (enabled: boolean) => Promise<void>;
  saveClaudeMd: (scope: string, content: string, project: string) => Promise<void>;
}

export const useMemoryStore = create<MemoryState>((set, get) => ({
  autoMemoryEnabled: true,
  memoryDir: "",
  memoryIndex: null,
  topicFiles: [],
  claudeMdLevels: [],
  rules: [],
  userRules: [],
  loading: false,
  editingFile: null,

  loadAll: async (project) => {
    set({ loading: true });
    try {
      const [autoData, claudeData, rulesData, userRulesData] = await Promise.all([
        api.getAutoMemory(project),
        api.getClaudeMdLevels(project),
        api.getRules(project, "project"),
        api.getRules(project, "user"),
      ]);
      set({
        autoMemoryEnabled: autoData.enabled,
        memoryDir: autoData.memoryDir,
        memoryIndex: autoData.index,
        topicFiles: autoData.topicFiles,
        claudeMdLevels: claudeData.levels,
        rules: rulesData.rules,
        userRules: userRulesData.rules,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  loadAutoMemory: async (project) => {
    set({ loading: true });
    try {
      const data = await api.getAutoMemory(project);
      set({
        autoMemoryEnabled: data.enabled,
        memoryDir: data.memoryDir,
        memoryIndex: data.index,
        topicFiles: data.topicFiles,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  loadClaudeMd: async (project) => {
    set({ loading: true });
    try {
      const { levels } = await api.getClaudeMdLevels(project);
      set({ claudeMdLevels: levels, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  openFile: async (type, name, project, scope) => {
    if (type === "memory") {
      if (name === "MEMORY.md") {
        const { memoryIndex } = get();
        set({ editingFile: { type, name, content: memoryIndex?.content || "" } });
      } else {
        const file = await api.getMemoryFile(project || "", name);
        set({ editingFile: { type, name, content: file?.content || "" } });
      }
    } else if (type === "claudemd") {
      const level = get().claudeMdLevels.find((l) => l.scope === scope);
      set({ editingFile: { type, name, content: level?.content || "", scope } });
    } else if (type === "rule") {
      const ruleScope = scope as "project" | "user" | undefined;
      const ruleList = ruleScope === "user" ? get().userRules : get().rules;
      const rule = ruleList.find((r) => r.name === name);
      set({ editingFile: { type, name, content: rule?.content || "", scope } });
    }
  },

  saveFile: async (type, name, content, project, scope) => {
    if (type === "memory") {
      await api.saveMemoryFile(project || "", name, content);
    } else if (type === "claudemd" && scope) {
      await api.saveClaudeMd(scope, content, project || "");
    } else if (type === "rule") {
      const ruleScope = (scope as "project" | "user") || "project";
      await api.saveRule(name, content, project, ruleScope);
    }
    set({ editingFile: null });
    await get().loadAll(project);
  },

  deleteFile: async (type, name, project, scope) => {
    if (type === "memory") {
      await api.deleteMemoryFile(project || "", name);
    } else if (type === "rule") {
      const ruleScope = (scope as "project" | "user") || "project";
      await api.deleteRule(name, project, ruleScope);
    }
    await get().loadAll(project);
  },

  createMemoryTopic: async (filename, project) => {
    const fname = filename.endsWith(".md") ? filename : `${filename}.md`;
    await api.createMemoryFile(project || "", fname);
    await get().loadAll(project);
  },

  createRule: async (name, content, project, scope = "project") => {
    const fname = name.endsWith(".md") ? name : `${name}.md`;
    await api.saveRule(fname, content, project, scope);
    await get().loadAll(project);
  },

  closeEditor: () => set({ editingFile: null }),

  setAutoMemoryEnabled: async (enabled) => {
    await api.setAutoMemoryEnabled(enabled);
    set({ autoMemoryEnabled: enabled });
  },

  saveClaudeMd: async (scope, content, project) => {
    await api.saveClaudeMd(scope, content, project);
  },
}));
