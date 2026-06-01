/**
 * G-F3 a11y gate · Dashboard / QuoteTable / MarketOverview / PushStatusBar.
 *
 * Extends F5 axe pattern to F1 components. Empty (no rows) + populated + push
 * status banner each scanned for WCAG violations (jsdom subset of axe rules —
 * full canvas color-contrast scan is reserved for a future Playwright run).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";

import { Dashboard } from "../pages/Dashboard";
import { QuoteTable } from "../components/quote-table/QuoteTable";
import { MarketOverview } from "../components/market-overview/MarketOverview";
import { PushStatusBar } from "../components/push-status-bar/PushStatusBar";
import { useDashboardStore } from "../store/dashboardStore";

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(ok({ rows: [], session_label: "交易中", fetched_at: "x" }));
  vi.stubGlobal("fetch", fetchMock);
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
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a11y · F1 Dashboard", () => {
  it("Dashboard empty state has no axe violations", async () => {
    const { container } = render(<Dashboard onOpenWatchlist={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("QuoteTable populated has no axe violations", async () => {
    const rows = [
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
        status: "normal" as const,
      },
    ];
    const { container } = render(<QuoteTable rows={rows} badges={{ "600519": ["limit_up"] }} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("MarketOverview populated has no axe violations", async () => {
    const indices = [
      {
        code: "sh000001",
        name: "上证指数",
        point: 3200,
        change_pct: -0.8,
        updated_at: "x",
        status: "normal" as const,
      },
    ];
    const { container } = render(<MarketOverview indices={indices} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("PushStatusBar visible state has no axe violations", async () => {
    const { container } = render(
      <PushStatusBar status={{ undelivered_count: 2, webhook_ok: true, muted: false }} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
