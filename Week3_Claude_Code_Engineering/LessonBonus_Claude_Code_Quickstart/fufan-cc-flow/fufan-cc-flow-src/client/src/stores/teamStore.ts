import { create } from "zustand";
import type { TeamInfo, TeamTask, TeamMessage } from "../types/team";
import { api } from "../services/api";

interface TeamState {
  enabled: boolean;
  teams: TeamInfo[];
  activeTeam: string | null;
  tasks: TeamTask[];
  messages: TeamMessage[];
  loading: boolean;

  checkEnabled: () => Promise<void>;
  loadTeams: () => Promise<void>;
  loadTeamDetail: (name: string) => Promise<void>;
  createTeam: (name: string) => Promise<void>;
  deleteTeam: (name: string) => Promise<void>;
  loadTasks: (teamName: string) => Promise<void>;
  updateTask: (teamName: string, taskId: string, updates: Partial<TeamTask>) => Promise<void>;
  loadMessages: (teamName: string, limit?: number) => Promise<void>;
  setActiveTeam: (name: string | null) => void;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  enabled: false,
  teams: [],
  activeTeam: null,
  tasks: [],
  messages: [],
  loading: false,

  checkEnabled: async () => {
    try {
      const { enabled } = await api.getTeamsEnabled();
      set({ enabled });
    } catch {
      set({ enabled: false });
    }
  },

  loadTeams: async () => {
    set({ loading: true });
    try {
      const { teams } = await api.getTeams();
      set({ teams, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  loadTeamDetail: async (name) => {
    try {
      const team = await api.getTeam(name);
      // Update team in list
      set((s) => ({
        teams: s.teams.map((t) => (t.name === name ? team : t)),
        tasks: team.tasks,
      }));
    } catch {
      // ignore
    }
  },

  createTeam: async (name) => {
    try {
      const team = await api.createTeam(name);
      set((s) => ({
        teams: [...s.teams, team],
        activeTeam: team.name,
        tasks: team.tasks,
        messages: [],
      }));
    } catch (err) {
      throw err;
    }
  },

  deleteTeam: async (name) => {
    await api.deleteTeam(name);
    set((s) => ({
      teams: s.teams.filter((t) => t.name !== name),
      activeTeam: s.activeTeam === name ? null : s.activeTeam,
      tasks: s.activeTeam === name ? [] : s.tasks,
      messages: s.activeTeam === name ? [] : s.messages,
    }));
  },

  loadTasks: async (teamName) => {
    try {
      const { tasks } = await api.getTeamTasks(teamName);
      set({ tasks });
    } catch {
      // ignore
    }
  },

  updateTask: async (teamName, taskId, updates) => {
    await api.updateTeamTask(teamName, taskId, updates);
    // Reload tasks
    await get().loadTasks(teamName);
  },

  loadMessages: async (teamName, limit) => {
    try {
      const { messages } = await api.getTeamMessages(teamName, limit);
      set({ messages });
    } catch {
      // ignore
    }
  },

  setActiveTeam: (name) => {
    set({ activeTeam: name, tasks: [], messages: [] });
  },
}));
