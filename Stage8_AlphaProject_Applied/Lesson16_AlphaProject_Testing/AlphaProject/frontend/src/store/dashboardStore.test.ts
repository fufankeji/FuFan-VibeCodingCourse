/**
 * F1 T007 — dashboardStore tests.
 *
 * Spec FR-001/003/005:
 *   - load() fetches snapshot+indices+badges via sdk
 *   - rows sorted: 持仓优先 → 异动优先 → |change_pct| 降序 → 字母序(code)
 *   - badges merged from /anomaly/badges
 *   - refreshInterval triggers refresh
 */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useDashboardStore } from "./dashboardStore";

let fetchMock: ReturnType<typeof vi.fn>;

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock = vi.fn();
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

describe("dashboardStore.load", () => {
  it("loads rows + indices + badges, sorts holding-first", async () => {
    // Order: snapshot, indices, badges, pushStatus
    fetchMock
      .mockResolvedValueOnce(ok({
        rows: [
          { code: "000001", name: "平安", is_holding: false, group_id: null, display_order: 0, price: 12, change_pct: -1, volume_ratio: null, volume: null, updated_at: null, status: "normal" },
          { code: "600519", name: "茅台", is_holding: true, group_id: null, display_order: 1, price: 1700, change_pct: 2.5, volume_ratio: null, volume: null, updated_at: null, status: "normal" },
        ],
        session_label: "交易中",
        fetched_at: "2026-05-28T10:00:00",
      }))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({ undelivered_count: 0, webhook_ok: true, muted: false }));

    await useDashboardStore.getState().load();
    const rows = useDashboardStore.getState().rows;
    // holding row 600519 must be first
    expect(rows[0].code).toBe("600519");
    expect(rows[1].code).toBe("000001");
    expect(useDashboardStore.getState().sessionLabel).toBe("交易中");
  });

  it("sorts by |change_pct| descending within same holding tier", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({
        rows: [
          { code: "A", name: "A", is_holding: false, group_id: null, display_order: 0, price: 10, change_pct: 1.0, volume_ratio: null, volume: null, updated_at: null, status: "normal" },
          { code: "B", name: "B", is_holding: false, group_id: null, display_order: 1, price: 10, change_pct: -5.0, volume_ratio: null, volume: null, updated_at: null, status: "normal" },
          { code: "C", name: "C", is_holding: false, group_id: null, display_order: 2, price: 10, change_pct: 3.0, volume_ratio: null, volume: null, updated_at: null, status: "normal" },
        ],
        session_label: "交易中",
        fetched_at: "x",
      }))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({ undelivered_count: 0, webhook_ok: true, muted: false }));

    await useDashboardStore.getState().load();
    const rows = useDashboardStore.getState().rows;
    expect(rows.map((r) => r.code)).toEqual(["B", "C", "A"]);
  });

  it("anomaly badges merged into rows", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({
        rows: [
          { code: "600519", name: "茅台", is_holding: false, group_id: null, display_order: 0, price: 1700, change_pct: 2.5, volume_ratio: null, volume: null, updated_at: null, status: "normal" },
        ],
        session_label: "交易中",
        fetched_at: "x",
      }))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok({ "600519": ["limit_up", "volume"] }))
      .mockResolvedValueOnce(ok({ undelivered_count: 0, webhook_ok: true, muted: false }));

    await useDashboardStore.getState().load();
    const badges = useDashboardStore.getState().badges;
    expect(badges["600519"]).toEqual(["limit_up", "volume"]);
  });

  it("stale-quote / push-status degrades to null on failure, NO crash", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({
        rows: [],
        session_label: "交易中",
        fetched_at: "x",
      }))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok({}))
      .mockRejectedValueOnce(new Error("404 push not wired"));

    await useDashboardStore.getState().load();
    expect(useDashboardStore.getState().pushStatus).toBeNull();
    expect(useDashboardStore.getState().error).toBeNull();
  });

  it("sets failureStartedAt when load fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    await useDashboardStore.getState().load();
    expect(useDashboardStore.getState().failureStartedAt).not.toBeNull();
    expect(useDashboardStore.getState().error).toBeTruthy();
  });

  it("clears failureStartedAt on successful load", async () => {
    useDashboardStore.setState({ failureStartedAt: new Date("2026-01-01T00:00:00") });
    fetchMock
      .mockResolvedValueOnce(ok({ rows: [], session_label: "交易中", fetched_at: "x" }))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({ undelivered_count: 0, webhook_ok: true, muted: false }));

    await useDashboardStore.getState().load();
    expect(useDashboardStore.getState().failureStartedAt).toBeNull();
  });
});
