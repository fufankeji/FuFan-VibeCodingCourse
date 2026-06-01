/**
 * Watchlist page · F5 管理抽屉入口 (US-05).
 *
 * DESIGN.md ref:
 *   §Brand & Style — information density first, terminal-influenced
 *   §Layout — 12-col grid; this page is the Drawer entry while F1 Dashboard
 *             owns the main grid (003-watchlist-dashboard).
 * Reference HTML: dashboard_a_ai/code.html — Manage Stock drawer composition.
 *
 * Behaviour:
 *  - Loads {items, groups} on mount via store.loadFromServer()
 *  - Manage button opens ManageDrawer
 *  - Drawer body: StockSearchInput (sdk.search) + list of StockCard
 *  - Adding/removing/holding-toggling uses sdk + reloads
 *  - Soft-delete + 30s undo via toast (sonner)
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { sdk, SdkError } from "../services/sdk";
import { useWatchlistStore } from "../store/watchlistStore";
import { ManageDrawer } from "../components/watchlist/ManageDrawer";
import { StockCard } from "../components/watchlist/StockCard";
import { StockSearchInput } from "../components/watchlist/StockSearchInput";

export function Watchlist() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { items, groups, loading, error, isAtTotalCap, loadFromServer } = useWatchlistStore();

  useEffect(() => {
    void loadFromServer();
  }, [loadFromServer]);

  async function handleAdd(code: string, name: string) {
    try {
      await sdk.addItem({ code, name });
      await loadFromServer();
      toast.success(`已加入自选 · ${name}`);
    } catch (e) {
      const msg = e instanceof SdkError ? e.message : String(e);
      toast.error(msg);
    }
  }

  async function handleRemove(code: string, name: string) {
    try {
      await sdk.removeItem(code);
      await loadFromServer();
      toast(`已移除 · ${name}`, {
        action: {
          label: "撤销",
          onClick: async () => {
            try {
              await sdk.undoItem(code);
              await loadFromServer();
              toast.success(`已恢复 · ${name}`);
            } catch (e) {
              toast.error(e instanceof SdkError ? e.message : String(e));
            }
          },
        },
        duration: 30000, // 30s window — matches backend UNDO_WINDOW
      });
    } catch (e) {
      toast.error(e instanceof SdkError ? e.message : String(e));
    }
  }

  async function handleToggleHolding(code: string, currentHolding: boolean) {
    try {
      await sdk.updateItem(code, { is_holding: !currentHolding });
      await loadFromServer();
    } catch (e) {
      toast.error(e instanceof SdkError ? e.message : String(e));
    }
  }

  return (
    <main className="min-h-screen bg-[color:var(--color-surface-base)] p-6 text-[color:var(--color-foreground)]">
      <header className="flex items-baseline justify-between gap-4 border-b border-[color:var(--color-surface-1-border)] pb-3">
        <h1 className="text-[length:var(--text-headline-sm)] font-semibold">自选股管理</h1>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[length:var(--text-mono-label)] text-[color:var(--color-foreground-muted)]">
            {items.length}/30
          </span>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-md border border-[color:var(--color-surface-1-border)] bg-[color:var(--color-surface-1)] px-3 py-1 text-[length:var(--text-table-data)] hover:bg-[color:var(--color-surface-2)]"
          >
            管理自选股
          </button>
        </div>
      </header>

      {error && (
        <div className="mt-4 rounded-md border border-[color:var(--color-bear)]/50 bg-[color:var(--color-bear)]/10 px-3 py-2 text-[length:var(--text-table-data)] text-[color:var(--color-bear)]">
          数据加载失败：{error}
        </div>
      )}

      {loading && items.length === 0 && (
        <p className="mt-6 text-[length:var(--text-mono-label)] text-[color:var(--color-foreground-subtle)]">加载中…</p>
      )}

      <ManageDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={`管理自选股 · ${items.length}/30`}
      >
        <section className="space-y-3 p-4">
          <div>
            <label className="mb-1 block text-[length:var(--text-mono-label)] text-[color:var(--color-foreground-muted)]">
              添加自选股
            </label>
            <StockSearchInput
              disabled={isAtTotalCap()}
              placeholderHint={isAtTotalCap() ? "已达 30 只上限，请先移除" : undefined}
              onPick={(s) => void handleAdd(s.code, s.name)}
            />
          </div>
          {items.length === 0 ? (
            <p className="rounded-md border border-dashed border-[color:var(--color-surface-1-border)] p-6 text-center text-[length:var(--text-mono-label)] text-[color:var(--color-foreground-subtle)]">
              先添加你的第一只自选股
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--color-surface-1-border)]">
              {items.map((it) => (
                <li key={it.code}>
                  <StockCard
                    item={it}
                    groups={groups}
                    onToggleHolding={() => void handleToggleHolding(it.code, it.is_holding)}
                    onRemove={() => void handleRemove(it.code, it.name)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </ManageDrawer>
    </main>
  );
}
