import { create } from "zustand";
import { api } from "../services/api";

export interface MarketplacePlugin {
  name: string;
  description: string;
  author: string;
  marketplace: string;
  installed: boolean;
  installCount?: number;
  isExternal: boolean;
}

interface MarketplaceState {
  availablePlugins: MarketplacePlugin[];
  loading: boolean;
  searchQuery: string;
  sortBy: "popular" | "name";
  installing: string | null;

  loadAvailable: () => Promise<void>;
  installFromMarketplace: (name: string, scope?: string) => Promise<void>;
  setSearchQuery: (q: string) => void;
  setSortBy: (s: "popular" | "name") => void;
}

export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
  availablePlugins: [],
  loading: false,
  searchQuery: "",
  sortBy: "popular",
  installing: null,

  loadAvailable: async () => {
    set({ loading: true });
    try {
      const { plugins } = await api.getMarketplacePlugins();
      set({ availablePlugins: plugins, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  installFromMarketplace: async (name, scope) => {
    set({ installing: name });
    try {
      await api.installFromMarketplace(name, scope);
      // Refresh list to update installed status
      const { plugins } = await api.getMarketplacePlugins();
      set({ availablePlugins: plugins, installing: null });
    } catch {
      set({ installing: null });
      throw new Error("安装失败");
    }
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
  setSortBy: (s) => set({ sortBy: s }),
}));
