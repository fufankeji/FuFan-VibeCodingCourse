import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWatchlistStore } from "./watchlistStore";
import type { WatchlistItem, WatchlistGroup } from "../services/sdk";

const item = (over: Partial<WatchlistItem> = {}): WatchlistItem => ({
  code: "600519",
  name: "贵州茅台",
  group_id: null,
  is_holding: false,
  display_order: 0,
  joined_at: "2026-05-28T00:00:00",
  ...over,
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  useWatchlistStore.setState({ items: [], groups: [], loading: false, error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("watchlistStore", () => {
  it("starts empty", () => {
    const s = useWatchlistStore.getState();
    expect(s.items).toEqual([]);
    expect(s.groups).toEqual([]);
    expect(s.loading).toBe(false);
  });

  it("isAtTotalCap reflects 30-item ceiling", () => {
    useWatchlistStore.setState({
      items: Array.from({ length: 30 }, (_, i) => item({ code: `c${i}` })),
    });
    expect(useWatchlistStore.getState().isAtTotalCap()).toBe(true);
    useWatchlistStore.setState({ items: Array.from({ length: 29 }, (_, i) => item({ code: `c${i}` })) });
    expect(useWatchlistStore.getState().isAtTotalCap()).toBe(false);
  });

  it("isAtHoldingCap reflects 5-holding ceiling", () => {
    useWatchlistStore.setState({
      items: Array.from({ length: 5 }, (_, i) => item({ code: `h${i}`, is_holding: true })),
    });
    expect(useWatchlistStore.getState().isAtHoldingCap()).toBe(true);
    useWatchlistStore.setState({
      items: Array.from({ length: 4 }, (_, i) => item({ code: `h${i}`, is_holding: true })),
    });
    expect(useWatchlistStore.getState().isAtHoldingCap()).toBe(false);
  });

  it("loadFromServer fetches items + groups in parallel", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/watchlist") return jsonResp([item()]);
      if (url === "/watchlist/groups") {
        return jsonResp([{ id: 1, name: "持仓", created_at: "2026-05-28T00:00:00" } satisfies WatchlistGroup]);
      }
      return jsonResp(null, 404);
    });
    await useWatchlistStore.getState().loadFromServer();
    const s = useWatchlistStore.getState();
    expect(s.items).toHaveLength(1);
    expect(s.groups).toHaveLength(1);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it("loadFromServer captures error", async () => {
    fetchMock.mockResolvedValue(jsonResp({ detail: "boom" }, 500));
    await useWatchlistStore.getState().loadFromServer();
    expect(useWatchlistStore.getState().error).toMatch(/boom|HTTP 500/);
  });
});
