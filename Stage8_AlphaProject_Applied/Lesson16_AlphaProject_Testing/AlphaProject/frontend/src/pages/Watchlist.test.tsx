import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Watchlist } from "./Watchlist";
import { useWatchlistStore } from "../store/watchlistStore";

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

const itemMaotai = {
  code: "600519",
  name: "贵州茅台",
  group_id: null,
  is_holding: false,
  display_order: 0,
  joined_at: "2026-05-28T00:00:00",
};

describe("Watchlist page", () => {
  it("renders title + 0/30 counter when empty", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/watchlist") return jsonResp([]);
      if (url === "/watchlist/groups") return jsonResp([]);
      return jsonResp(null, 404);
    });
    render(<Watchlist />);
    expect(screen.getByText(/自选股管理/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("0/30")).toBeInTheDocument());
  });

  it("clicking 管理 button opens drawer with empty-state hint", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/watchlist") return jsonResp([]);
      if (url === "/watchlist/groups") return jsonResp([]);
      return jsonResp(null, 404);
    });
    render(<Watchlist />);
    await waitFor(() => expect(screen.getByText("0/30")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /管理自选股/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/先添加你的第一只自选股/)).toBeInTheDocument();
  });

  it("shows existing item in drawer with toggle + remove buttons", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/watchlist") return jsonResp([itemMaotai]);
      if (url === "/watchlist/groups") return jsonResp([]);
      return jsonResp(null, 404);
    });
    render(<Watchlist />);
    await waitFor(() => expect(screen.getByText("1/30")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /管理自选股/i }));
    expect(await screen.findByText("贵州茅台")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /标记持仓/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /移除/ })).toBeInTheDocument();
  });

  it("disables search input when at 30 cap", async () => {
    const thirty = Array.from({ length: 30 }, (_, i) => ({
      ...itemMaotai,
      code: `60${String(i).padStart(4, "0")}`,
      name: `股${i}`,
    }));
    fetchMock.mockImplementation((url: string) => {
      if (url === "/watchlist") return jsonResp(thirty);
      if (url === "/watchlist/groups") return jsonResp([]);
      return jsonResp(null, 404);
    });
    render(<Watchlist />);
    await waitFor(() => expect(screen.getByText("30/30")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /管理自选股/i }));
    const input = await screen.findByLabelText(/搜索股票/);
    expect(input).toBeDisabled();
  });

  it("displays error banner when load fails", async () => {
    fetchMock.mockResolvedValue(jsonResp({ detail: "boom" }, 500));
    render(<Watchlist />);
    await waitFor(() => expect(screen.getByText(/数据加载失败/)).toBeInTheDocument());
  });
});
