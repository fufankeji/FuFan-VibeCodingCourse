import { create } from "zustand";
import type { SkillInfo, SkillDetail } from "../types/skill";
import { api } from "../services/api";

interface SkillState {
  projectSkills: SkillInfo[];
  userSkills: SkillInfo[];
  pluginSkills: SkillInfo[];
  loading: boolean;
  editingSkill: SkillDetail | null;

  loadSkills: (project?: string) => Promise<void>;
  openSkill: (scope: "project" | "user", name: string, project?: string) => Promise<void>;
  saveSkill: (
    scope: "project" | "user",
    name: string,
    frontmatter: Record<string, unknown>,
    content: string,
    project?: string
  ) => Promise<void>;
  deleteSkill: (scope: "project" | "user", name: string, project?: string) => Promise<void>;
  closeEditor: () => void;
}

export const useSkillStore = create<SkillState>((set) => ({
  projectSkills: [],
  userSkills: [],
  pluginSkills: [],
  loading: false,
  editingSkill: null,

  loadSkills: async (project) => {
    set({ loading: true });
    try {
      const data = await api.getSkills(project);
      set({
        projectSkills: data.project,
        userSkills: data.user,
        pluginSkills: data.plugin || [],
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  openSkill: async (scope, name, project) => {
    const detail = await api.getSkillDetail(scope, name, project);
    set({ editingSkill: detail });
  },

  saveSkill: async (scope, name, frontmatter, content, project) => {
    await api.saveSkill(scope, name, frontmatter, content, project);
    const data = await api.getSkills(project);
    set({
      projectSkills: data.project,
      userSkills: data.user,
      pluginSkills: data.plugin || [],
      editingSkill: null,
    });
  },

  deleteSkill: async (scope, name, project) => {
    await api.deleteSkill(scope, name, project);
    const data = await api.getSkills(project);
    set({
      projectSkills: data.project,
      userSkills: data.user,
      pluginSkills: data.plugin || [],
    });
  },

  closeEditor: () => set({ editingSkill: null }),
}));
