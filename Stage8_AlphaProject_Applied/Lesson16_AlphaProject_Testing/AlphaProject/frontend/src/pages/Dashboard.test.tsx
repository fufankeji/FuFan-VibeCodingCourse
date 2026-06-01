/**
 * F1 T010 — Dashboard page tests.
 *
 * Covers FR-001/003/006/010 + degradation banner (FR-009).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Dashboard } from "./Dashboard";
import { useDashboardStore } from "../store/dashboardStore";

let fetchMock: ReturnType<typeof vi.fn>;

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function resetStore() {
  useDashboardStore.setState({
    rows: [],
    indices: [],
    badges: {},
    sessionLabel: "未知",
    fetchedAt: null,
    loading: false,
    error: null,
    failureStartedAt: null,
    pushStatus: null,
  });
}

beforeEach(() => {
  resetStore();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const sampleSnapshot = {
  rows: [
    {
      code: "600519",
      name: "贵州茅台",
      is_holding: true,
      group_id: null,
      display_order: 0,
      price: 1700,
      change_pct: 2.5,
      volume_ratio: 1.2,
      volume: 10000,
      updated_at: "2026-05-28T10:00:00",
      status: "normal",
    },
  ],
  session_label: "交易中",
  fetched_at: "2026-05-28T10:00:00",
};

describe("Dashboard", () => {
  it("loads + renders rows on mount (US1)", async () => {
    fetchMock
      .mockResolvedValueOnce(ok(sampleSnapshot))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({ undelivered_count: 0, webhook_ok: true, muted: false }));

    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText("贵州茅台")).toBeInTheDocument();
    });
    expect(screen.getByText("1700.00")).toBeInTheDocument();
  });

  it("renders empty state with manage button (FR-010)", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ rows: [], session_label: "交易中", fetched_at: "x" }))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({ undelivered_count: 0, webhook_ok: true, muted: false }));

    const onOpen = vi.fn();
    render(<Dashboard onOpenWatchlist={onOpen} />);
    await waitFor(() =>
      expect(screen.getByText(/先添加你的第一只自选股/)).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: /打开自选管理/ }));
    expect(onOpen).toHaveBeenCalled();
  });

  it("manual refresh triggers another load (FR-003)", async () => {
    fetchMock
      .mockResolvedValueOnce(ok(sampleSnapshot))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({ undelivered_count: 0, webhook_ok: true, muted: false }))
      // second load
      .mockResolvedValueOnce(ok(sampleSnapshot))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({ undelivered_count: 0, webhook_ok: true, muted: false }));

    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText("贵州茅台")).toBeInTheDocument());
    const callsBefore = fetchMock.mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: "刷新" }));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("shows failure banner when failureStartedAt > 5min ago", async () => {
    useDashboardStore.setState({
      failureStartedAt: new Date(Date.now() - 10 * 60_000),
    });
    fetchMock
      .mockResolvedValueOnce(ok(sampleSnapshot))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({ undelivered_count: 0, webhook_ok: true, muted: false }));
    render(<Dashboard />);
    expect(screen.getByRole("alert", { name: /行情持续失败/ })).toBeInTheDocument();
  });

  it("session label displayed", async () => {
    fetchMock
      .mockResolvedValueOnce(ok(sampleSnapshot))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({ undelivered_count: 0, webhook_ok: true, muted: false }));
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText(/交易中/)).toBeInTheDocument());
  });

  it("navigates to detail page on row click (US3)", async () => {
    fetchMock
      .mockResolvedValueOnce(ok(sampleSnapshot))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({ undelivered_count: 0, webhook_ok: true, muted: false }))
      // kline fetch
      .mockResolvedValueOnce(ok([
        { ts: "2026-05-27T00:00:00", open: 100, high: 110, low: 99, close: 108, volume: 1000 },
      ]));

    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText("贵州茅台")).toBeInTheDocument());
    await userEvent.click(screen.getByText("贵州茅台"));
    await waitFor(() => expect(screen.getByRole("button", { name: "返回" })).toBeInTheDocument());
  });
});
