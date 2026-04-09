import { create } from "zustand";
import type { McpServer } from "../types/mcp";
import { api } from "../services/api";

interface McpState {
  servers: McpServer[];
  loading: boolean;

  loadServers: () => Promise<void>;
  addServer: (opts: {
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
  }) => Promise<void>;
  addServerJson: (name: string, json: string, scope?: string) => Promise<void>;
  removeServer: (name: string) => Promise<void>;
  importFromDesktop: () => Promise<string[]>;
}

export const useMcpStore = create<McpState>((set) => ({
  servers: [],
  loading: false,

  loadServers: async () => {
    set({ loading: true });
    try {
      const { servers } = await api.getMcpServers();
      set({ servers, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addServer: async (opts) => {
    await api.addMcpServer(opts);
    const { servers } = await api.getMcpServers();
    set({ servers });
  },

  addServerJson: async (name, json, scope) => {
    await api.addMcpServerJson(name, json, scope);
    const { servers } = await api.getMcpServers();
    set({ servers });
  },

  removeServer: async (name) => {
    await api.removeMcpServer(name);
    const { servers } = await api.getMcpServers();
    set({ servers });
  },

  importFromDesktop: async () => {
    const result = await api.importMcpFromDesktop();
    const { servers } = await api.getMcpServers();
    set({ servers });
    return result.imported;
  },
}));
