/**
 * Backend REST client (F5 contract → T014 build_app routes).
 * Single-purpose fetch wrapper. Surfaces backend's WatchlistError detail verbatim.
 */

export interface WatchlistItem {
  code: string;
  name: string;
  group_id: number | null;
  is_holding: boolean;
  display_order: number;
  joined_at: string;
}

export interface WatchlistGroup {
  id: number;
  name: string;
  created_at: string;
}

export interface StockBasic {
  code: string;
  name: string;
}

export interface AddItemPayload {
  code: string;
  name: string;
  is_holding?: boolean;
  group_id?: number | null;
}

export interface UpdateItemPayload {
  is_holding?: boolean;
  group_id?: number | null;
  display_order?: number;
}

export class SdkError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "SdkError";
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const resp = await fetch(url, {
    headers: { "content-type": "application/json", ...init.headers },
    ...init,
  });
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try {
      const body = await resp.json();
      if (body && typeof body.detail === "string") detail = body.detail;
    } catch {
      /* not json */
    }
    throw new SdkError(resp.status, detail);
  }
  if (resp.status === 204) return undefined as T;
  return resp.json() as Promise<T>;
}

export const sdk = {
  // items
  listItems: () => request<WatchlistItem[]>("/watchlist", { method: "GET" }),
  addItem: (p: AddItemPayload) =>
    request<WatchlistItem>("/watchlist", { method: "POST", body: JSON.stringify(p) }),
  removeItem: (code: string) =>
    request<void>(`/watchlist/${encodeURIComponent(code)}`, { method: "DELETE" }),
  updateItem: (code: string, p: UpdateItemPayload) =>
    request<WatchlistItem>(`/watchlist/${encodeURIComponent(code)}`, {
      method: "PATCH",
      body: JSON.stringify(p),
    }),
  undoItem: (code: string) =>
    request<{ code: string; restored: boolean }>(
      `/watchlist/${encodeURIComponent(code)}:undo`,
      { method: "POST" },
    ),
  search: (q: string) =>
    request<StockBasic[]>(`/watchlist:search?q=${encodeURIComponent(q)}`, { method: "GET" }),
  // groups
  listGroups: () => request<WatchlistGroup[]>("/watchlist/groups", { method: "GET" }),
  createGroup: (name: string) =>
    request<WatchlistGroup>("/watchlist/groups", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  renameGroup: (id: number, name: string) =>
    request<WatchlistGroup>(`/watchlist/groups/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  deleteGroup: (id: number) =>
    request<void>(`/watchlist/groups/${id}`, { method: "DELETE" }),

  // ── F1 003 quotes / indices / kline / push-status ────────────────
  quoteSnapshot: () => request<QuoteSnapshotResponse>("/quotes/snapshot", { method: "GET" }),
  indices: () => request<MarketIndexDto[]>("/quotes/indices", { method: "GET" }),
  kline: (code: string) =>
    request<KlinePointDto[]>(`/quotes/kline/${encodeURIComponent(code)}`, { method: "GET" }),
  pushStatus: () => request<PushStatusDto>("/push/status", { method: "GET" }),
  anomalyBadges: () => request<Record<string, string[]>>("/anomaly/badges", { method: "GET" }),
  sparklines: (n = 30) =>
    request<Record<string, number[]>>(`/quotes/sparklines?n=${n}`, { method: "GET" }),
};

// ── F1 contracts (mirrors backend api/quotes.py) ──────────────────
export type DataStatus = "normal" | "suspended" | "no_data" | "stale";

export interface QuoteRow {
  code: string;
  name: string;
  is_holding: boolean;
  group_id: number | null;
  display_order: number;
  price: number | null;
  change_pct: number | null;
  volume_ratio: number | null;
  volume: number | null;
  updated_at: string | null;
  status: DataStatus;
}

export interface QuoteSnapshotResponse {
  rows: QuoteRow[];
  session_label: string;
  fetched_at: string;
}

export interface MarketIndexDto {
  code: string;
  name: string;
  point: number | null;
  change_pct: number | null;
  updated_at: string;
  status: DataStatus;
}

export interface KlinePointDto {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PushStatusDto {
  undelivered_count: number;
  webhook_ok: boolean;
  muted: boolean;
}
