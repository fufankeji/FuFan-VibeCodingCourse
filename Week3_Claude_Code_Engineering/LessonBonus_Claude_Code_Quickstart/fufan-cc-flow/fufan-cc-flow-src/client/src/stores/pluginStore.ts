import { create } from "zustand";
import type { PluginInfo } from "../types/plugin";
import { api } from "../services/api";

interface PluginState {
  plugins: PluginInfo[];
  loading: boolean;

  loadPlugins: () => Promise<void>;
  installPlugin: (name: string, scope?: string) => Promise<void>;
  uninstallPlugin: (name: string) => Promise<void>;
  togglePlugin: (name: string, enabled: boolean) => Promise<void>;
}

export const usePluginStore = create<PluginState>((set) => ({
  plugins: [],
  loading: false,

  loadPlugins: async () => {
    set({ loading: true });
    try {
      const { plugins } = await api.getPlugins();
      set({ plugins, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  installPlugin: async (name, scope) => {
    await api.installPlugin(name, scope);
    const { plugins } = await api.getPlugins();
    set({ plugins });
  },

  uninstallPlugin: async (name) => {
    await api.uninstallPlugin(name);
    const { plugins } = await api.getPlugins();
    set({ plugins });
  },

  togglePlugin: async (name, enabled) => {
    await api.togglePlugin(name, enabled);
    const { plugins } = await api.getPlugins();
    set({ plugins });
  },
}));
