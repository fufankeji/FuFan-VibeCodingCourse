import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sdk, SdkError } from "./sdk";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function ok(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("sdk.listItems", () => {
  it("GET /watchlist returns items", async () => {
    fetchMock.mockResolvedValue(ok([{ code: "600519", name: "贵州茅台", is_holding: false }]));
    const items = await sdk.listItems();
    expect(items).toHaveLength(1);
    expect(items[0].code).toBe("600519");
    expect(fetchMock).toHaveBeenCalledWith("/watchlist", expect.objectContaining({ method: "GET" }));
  });
});

describe("sdk.addItem", () => {
  it("POST /watchlist with payload", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: "600519", name: "贵州茅台", is_holding: true }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    const item = await sdk.addItem({ code: "600519", name: "贵州茅台", is_holding: true });
    expect(item.is_holding).toBe(true);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({ code: "600519", is_holding: true });
  });

  it("propagates 400 as SdkError with backend detail", async () => {
    fetchMock.mockImplementation(
      () => new Response(JSON.stringify({ detail: "自选股上限 30，请先移除" }), { status: 400 }),
    );
    await expect(sdk.addItem({ code: "999999", name: "超额" })).rejects.toThrow(SdkError);
    await expect(sdk.addItem({ code: "999999", name: "超额" })).rejects.toThrow("上限 30");
  });
});

describe("sdk.removeItem", () => {
  it("DELETE /watchlist/{code}", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await sdk.removeItem("600519");
    expect(fetchMock).toHaveBeenCalledWith(
      "/watchlist/600519",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("sdk.updateItem", () => {
  it("PATCH /watchlist/{code}", async () => {
    fetchMock.mockResolvedValue(ok({ code: "600519", name: "贵州茅台", is_holding: true }));
    await sdk.updateItem("600519", { is_holding: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/watchlist/600519");
    expect(init.method).toBe("PATCH");
  });
});

describe("sdk.undoItem", () => {
  it("POST /watchlist/{code}:undo", async () => {
    fetchMock.mockResolvedValue(ok({ code: "600519", restored: true }));
    await sdk.undoItem("600519");
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/watchlist/600519:undo");
  });
});

describe("sdk.search", () => {
  it("GET /watchlist:search?q=...", async () => {
    fetchMock.mockResolvedValue(ok([{ code: "600519", name: "贵州茅台" }]));
    const results = await sdk.search("茅台");
    expect(results).toHaveLength(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/watchlist:search?q=%E8%8C%85%E5%8F%B0");
  });
});

describe("sdk F1 003 endpoints", () => {
  it("GET /quotes/snapshot returns rows + session_label", async () => {
    fetchMock.mockResolvedValue(
      ok({
        rows: [
          { code: "600519", name: "贵州茅台", is_holding: true, group_id: null, display_order: 0, price: 1700, change_pct: 2.5, volume_ratio: 1.2, volume: 10000, updated_at: "2026-05-28T10:00:00", status: "normal" },
        ],
        session_label: "交易中",
        fetched_at: "2026-05-28T10:00:00",
      }),
    );
    const r = await sdk.quoteSnapshot();
    expect(r.rows).toHaveLength(1);
    expect(r.session_label).toBe("交易中");
    expect(fetchMock).toHaveBeenCalledWith("/quotes/snapshot", expect.objectContaining({ method: "GET" }));
  });

  it("GET /quotes/indices returns array", async () => {
    fetchMock.mockResolvedValue(ok([{ code: "sh000001", name: "上证指数", point: 3200, change_pct: -0.8, updated_at: "x", status: "normal" }]));
    const r = await sdk.indices();
    expect(r[0].name).toBe("上证指数");
  });

  it("GET /quotes/kline/{code} returns klines", async () => {
    fetchMock.mockResolvedValue(ok([{ ts: "x", open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 }]));
    const r = await sdk.kline("600519");
    expect(r).toHaveLength(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/quotes/kline/600519");
  });

  it("GET /push/status", async () => {
    fetchMock.mockResolvedValue(ok({ undelivered_count: 2, webhook_ok: true, muted: false }));
    const r = await sdk.pushStatus();
    expect(r.undelivered_count).toBe(2);
  });

  it("GET /anomaly/badges", async () => {
    fetchMock.mockResolvedValue(ok({ "600519": ["limit_up"] }));
    const r = await sdk.anomalyBadges();
    expect(r["600519"]).toEqual(["limit_up"]);
  });
});

describe("sdk groups", () => {
  it("list/create/rename/delete groups", async () => {
    fetchMock.mockResolvedValueOnce(ok([]));
    expect(await sdk.listGroups()).toEqual([]);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 1, name: "持仓" }), { status: 201 }),
    );
    expect((await sdk.createGroup("持仓")).id).toBe(1);
    fetchMock.mockResolvedValueOnce(ok({ id: 1, name: "新名" }));
    expect((await sdk.renameGroup(1, "新名")).name).toBe("新名");
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await sdk.deleteGroup(1);
  });
});
