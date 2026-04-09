import { create } from "zustand";
import type { AgentInfo, AgentDetail, SubAgentNode, BackgroundTask } from "../types/agent";
import { api } from "../services/api";

interface AgentState {
  // Agent management
  builtinAgents: AgentInfo[];
  projectAgents: AgentInfo[];
  userAgents: AgentInfo[];
  editingAgent: AgentDetail | null;
  loading: boolean;

  // Sub Agent tree (live execution)
  subAgentTree: SubAgentNode[];

  // Background tasks
  backgroundTasks: BackgroundTask[];

  // Actions
  loadAgents: (project?: string) => Promise<void>;
  openAgent: (scope: "project" | "user", name: string, project?: string) => Promise<void>;
  saveAgent: (
    scope: "project" | "user",
    name: string,
    frontmatter: Record<string, unknown>,
    content: string,
    project?: string
  ) => Promise<void>;
  deleteAgent: (scope: "project" | "user", name: string, project?: string) => Promise<void>;
  closeEditor: () => void;

  // Sub Agent actions
  addSubAgent: (node: SubAgentNode) => void;
  updateSubAgent: (id: string, updates: Partial<SubAgentNode>) => void;
  clearSubAgentTree: () => void;

  // Background task actions
  addBackgroundTask: (task: BackgroundTask) => void;
  updateBackgroundTask: (id: string, updates: Partial<BackgroundTask>) => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  builtinAgents: [],
  projectAgents: [],
  userAgents: [],
  editingAgent: null,
  loading: false,
  subAgentTree: [],
  backgroundTasks: [],

  loadAgents: async (project) => {
    set({ loading: true });
    try {
      const data = await api.getAgents(project);
      set({
        builtinAgents: data.builtin,
        projectAgents: data.project,
        userAgents: data.user,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  openAgent: async (scope, name, project) => {
    const detail = await api.getAgentDetail(scope, name, project);
    set({ editingAgent: detail });
  },

  saveAgent: async (scope, name, frontmatter, content, project) => {
    await api.saveAgent(scope, name, frontmatter, content, project);
    const data = await api.getAgents(project);
    set({
      builtinAgents: data.builtin,
      projectAgents: data.project,
      userAgents: data.user,
      editingAgent: null,
    });
  },

  deleteAgent: async (scope, name, project) => {
    await api.deleteAgent(scope, name, project);
    const data = await api.getAgents(project);
    set({
      builtinAgents: data.builtin,
      projectAgents: data.project,
      userAgents: data.user,
    });
  },

  closeEditor: () => set({ editingAgent: null }),

  addSubAgent: (node) => {
    set({ subAgentTree: [...get().subAgentTree, node] });
  },

  updateSubAgent: (id, updates) => {
    const updateNode = (nodes: SubAgentNode[]): SubAgentNode[] =>
      nodes.map((n) =>
        n.id === id
          ? { ...n, ...updates }
          : { ...n, children: updateNode(n.children) }
      );
    set({ subAgentTree: updateNode(get().subAgentTree) });
  },

  clearSubAgentTree: () => set({ subAgentTree: [] }),

  addBackgroundTask: (task) => {
    set({ backgroundTasks: [...get().backgroundTasks, task] });
  },

  updateBackgroundTask: (id, updates) => {
    set({
      backgroundTasks: get().backgroundTasks.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    });
  },
}));
