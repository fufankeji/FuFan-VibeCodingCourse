import { useState } from "react";
import { Toaster } from "sonner";
import { AppShell } from "./components/shell/AppShell";
import type { PageKey } from "./components/shell/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { MorningReport } from "./pages/MorningReport";
import { AlertLogs } from "./pages/AlertLogs";
import { Settings } from "./pages/Settings";
import { Watchlist } from "./pages/Watchlist";

export function App() {
  const [page, setPage] = useState<PageKey>("dashboard");
  const [manageOpen, setManageOpen] = useState(false);

  return (
    <>
      <AppShell page={page} onNavigate={setPage}>
        {manageOpen ? (
          <div>
            <div className="mb-3">
              <button
                type="button"
                onClick={() => setManageOpen(false)}
                className="rounded border border-surface-border bg-surface-container hover:bg-surface-container-high px-3 py-1 font-mono-label text-mono-label text-on-surface inline-flex items-center gap-1"
              >
                ← 返回总览看板
              </button>
            </div>
            <Watchlist />
          </div>
        ) : page === "dashboard" ? (
          <Dashboard onOpenWatchlist={() => setManageOpen(true)} />
        ) : page === "morning" ? (
          <MorningReport />
        ) : page === "alerts" ? (
          <AlertLogs />
        ) : (
          <Settings />
        )}
      </AppShell>
      <Toaster theme="dark" position="bottom-right" />
    </>
  );
}
