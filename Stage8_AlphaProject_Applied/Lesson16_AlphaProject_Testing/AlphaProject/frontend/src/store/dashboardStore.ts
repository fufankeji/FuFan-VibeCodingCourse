/**
 * F1 T007 — Dashboard store (zustand).
 *
 * Spec FR-001/003/005:
 *   - Merge F5 watchlist × QuoteService output (via /quotes/snapshot)
 *   - Pull indices + anomaly badges + push status in parallel
 *   - Sort: 持仓优先 → |change_pct| 降序 → 字母序
 *   - Track failure window for >5min red banner (FR-009)
 *
 * Refresh cadence is controlled by the Dashboard page via setInterval; this
 * store exposes load() so manual + auto refresh share the same path.
 */
import { create } from "zustand";

import {
  sdk,
  type MarketIndexDto,
  type PushStatusDto,
  type QuoteRow,
} from "../services/sdk";

interface DashboardState {
  rows: QuoteRow[];
  indices: MarketIndexDto[];
  badges: Record<string, string[]>;
  sparklines: Record<string, number[]>;
  sessionLabel: string;
  fetchedAt: string | null;
  loading: boolean;
  error: string | null;
  failureStartedAt: Date | null;
  pushStatus: PushStatusDto | null;
  load: () => Promise<void>;
}

function sortRows(rows: QuoteRow[]): QuoteRow[] {
  return [...rows].sort((a, b) => {
    // 1. holding first
    if (a.is_holding !== b.is_holding) return a.is_holding ? -1 : 1;
    // 2. |change_pct| desc (null treated as 0)
    const aChg = Math.abs(a.change_pct ?? 0);
    const bChg = Math.abs(b.change_pct ?? 0);
    if (aChg !== bChg) return bChg - aChg;
    // 3. code asc
    return a.code.localeCompare(b.code);
  });
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  rows: [],
  indices: [],
  badges: {},
  sparklines: {},
  sessionLabel: "未知",
  fetchedAt: null,
  loading: false,
  error: null,
  failureStartedAt: null,
  pushStatus: null,

  load: async () => {
    set({ loading: true });
    let snapshotFailed = false;
    let snapshot: Awaited<ReturnType<typeof sdk.quoteSnapshot>> | null = null;
    let indices: MarketIndexDto[] = [];
    let badges: Record<string, string[]> = {};

    try {
      snapshot = await sdk.quoteSnapshot();
    } catch (e) {
      snapshotFailed = true;
      const prev = get().failureStartedAt;
      set({
        loading: false,
        error: String(e instanceof Error ? e.message : e),
        failureStartedAt: prev ?? new Date(),
      });
      return;
    }
    try {
      indices = await sdk.indices();
    } catch {
      /* keep last */
      indices = get().indices;
    }
    try {
      badges = await sdk.anomalyBadges();
    } catch {
      /* F2 maybe not wired — keep empty */
    }
    let pushStatus: PushStatusDto | null = null;
    try {
      pushStatus = await sdk.pushStatus();
    } catch {
      /* F6 may be down — gracefully degrade */
    }
    let sparklines = get().sparklines;
    try {
      sparklines = await sdk.sparklines(30);
    } catch {
      /* keep last */
    }

    if (!snapshotFailed && snapshot) {
      set({
        rows: sortRows(snapshot.rows),
        indices,
        badges,
        sparklines,
        sessionLabel: snapshot.session_label,
        fetchedAt: snapshot.fetched_at,
        pushStatus,
        loading: false,
        error: null,
        failureStartedAt: null,
      });
    }
  },
}));
