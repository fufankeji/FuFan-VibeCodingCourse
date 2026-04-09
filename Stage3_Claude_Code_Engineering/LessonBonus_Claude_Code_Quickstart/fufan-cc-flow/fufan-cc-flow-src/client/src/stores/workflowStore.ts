import { create } from "zustand";
import type { Workflow } from "../types/workflow";
import { api } from "../services/api";

interface WorkflowState {
  workflows: Workflow[];
  loading: boolean;
  editing: Workflow | null;

  loadWorkflows: (project?: string) => Promise<void>;
  saveWorkflow: (workflow: Workflow, project?: string) => Promise<void>;
  deleteWorkflow: (id: string, project?: string) => Promise<void>;
  setEditing: (wf: Workflow | null) => void;
  createNew: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  workflows: [],
  loading: false,
  editing: null,

  loadWorkflows: async (project) => {
    set({ loading: true });
    try {
      const { workflows } = await api.getWorkflows(project);
      set({ workflows, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  saveWorkflow: async (workflow, project) => {
    await api.saveWorkflow(workflow, project);
    const { workflows } = await api.getWorkflows(project);
    set({ workflows, editing: null });
  },

  deleteWorkflow: async (id, project) => {
    await api.deleteWorkflow(id, project);
    const { workflows } = await api.getWorkflows(project);
    set({ workflows });
  },

  setEditing: (wf) => set({ editing: wf }),

  createNew: () =>
    set({
      editing: {
        id: "",
        name: "",
        steps: [{ agent: null, prompt: "" }],
        variables: [],
      },
    }),
}));
