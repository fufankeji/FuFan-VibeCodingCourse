/**
 * G-F3 · a11y · 自动 axe 扫管理抽屉关键状态
 *
 * 翻译：把 WCAG/aria 通用规则翻成 *本项目* 的 a11y 断言——具体路由到 Watchlist
 * 页面 + 抽屉打开态 + 空态/有项态/上限态 4 个关键 fixture。
 *
 * 不引 Playwright，全在 jsdom + axe-core 跑（vitest-axe）；CI 友好、无浏览器下载。
 *
 * 风险级：P1（合规 + 残障可访问性，告警） · CI 关 issue
 * 可追溯：F5 / 001 / FD-（无显式 a11y FD，按 WCAG 2.1 AA）
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import { Watchlist } from "../pages/Watchlist";
import { useWatchlistStore } from "../store/watchlistStore";

let fetchMock: ReturnType<typeof vi.fn>;

const itemSample = {
  code: "600519",
  name: "贵州茅台",
  group_id: null,
  is_holding: false,
  display_order: 0,
  joined_at: "2026-05-28T00:00:00",
};

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

function withMockedList(items: unknown[]) {
  fetchMock.mockImplementation((url: string) => {
    if (url === "/watchlist") return jsonResp(items);
    if (url === "/watchlist/groups") return jsonResp([]);
    return jsonResp(null, 404);
  });
}

async function openDrawer() {
  await userEvent.click(await screen.findByRole("button", { name: /管理自选股/ }));
  return await screen.findByRole("dialog");
}

describe("G-F3 a11y · Watchlist page", () => {
  it("page initial state has no a11y violations", async () => {
    withMockedList([]);
    const { container } = render(<Watchlist />);
    await waitFor(() => expect(screen.getByText("0/30")).toBeInTheDocument());
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("drawer empty-state has no a11y violations", async () => {
    withMockedList([]);
    const { container } = render(<Watchlist />);
    await waitFor(() => expect(screen.getByText("0/30")).toBeInTheDocument());
    await openDrawer();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("drawer with items has no a11y violations (labels/roles/contrast)", async () => {
    withMockedList([itemSample]);
    const { container } = render(<Watchlist />);
    await waitFor(() => expect(screen.getByText("1/30")).toBeInTheDocument());
    await openDrawer();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("drawer at cap (30/30) has no a11y violations on disabled search", async () => {
    const thirty = Array.from({ length: 30 }, (_, i) => ({
      ...itemSample,
      code: `60${String(i).padStart(4, "0")}`,
      name: `股${i}`,
    }));
    withMockedList(thirty);
    const { container } = render(<Watchlist />);
    await waitFor(() => expect(screen.getByText("30/30")).toBeInTheDocument());
    await openDrawer();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("G-F3 a11y · dialog semantics (FD-explicit aria contract)", () => {
  it("drawer has role=dialog + aria-modal + accessible name", async () => {
    withMockedList([]);
    render(<Watchlist />);
    await waitFor(() => expect(screen.getByText("0/30")).toBeInTheDocument());
    const dialog = await openDrawer();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName(/管理自选股/);
  });

  it("close button has accessible name (keyboard/screen-reader operable)", async () => {
    withMockedList([]);
    render(<Watchlist />);
    await waitFor(() => expect(screen.getByText("0/30")).toBeInTheDocument());
    await openDrawer();
    expect(screen.getByRole("button", { name: /关闭/ })).toBeInTheDocument();
  });

  it("Escape key closes drawer", async () => {
    withMockedList([]);
    render(<Watchlist />);
    await waitFor(() => expect(screen.getByText("0/30")).toBeInTheDocument());
    await openDrawer();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
