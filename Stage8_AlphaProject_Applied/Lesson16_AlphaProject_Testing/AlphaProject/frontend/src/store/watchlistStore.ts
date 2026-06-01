import { create } from "zustand";
import { sdk, SdkError } from "../services/sdk";
import type { WatchlistGroup, WatchlistItem } from "../services/sdk";

const MAX_WATCHLIST = 30;
const MAX_HOLDING = 5;

interface WatchlistStore {
  items: WatchlistItem[];
  groups: WatchlistGroup[];
  loading: boolean;
  error: string | null;
  isAtTotalCap: () => boolean;
  isAtHoldingCap: () => boolean;
  loadFromServer: () => Promise<void>;
}

export const useWatchlistStore = create<WatchlistStore>((set, get) => ({
  items: [],
  groups: [],
  loading: false,
  error: null,

  isAtTotalCap: () => get().items.length >= MAX_WATCHLIST,
  isAtHoldingCap: () => get().items.filter((i) => i.is_holding).length >= MAX_HOLDING,

  loadFromServer: async () => {
    set({ loading: true, error: null });
    try {
      const [items, groups] = await Promise.all([sdk.listItems(), sdk.listGroups()]);
      set({ items, groups, loading: false });
    } catch (e) {
      const message = e instanceof SdkError ? e.message : String(e);
      set({ loading: false, error: message });
    }
  },
}));

export { MAX_WATCHLIST, MAX_HOLDING };
