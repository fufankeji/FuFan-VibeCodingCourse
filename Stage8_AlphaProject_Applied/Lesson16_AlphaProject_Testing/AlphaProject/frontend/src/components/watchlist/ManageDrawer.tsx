/**
 * DESIGN.md ref:
 *   §Elevation & Depth / Level 3 (Overlays) — side drawer slight elevation
 *   §Layout — Section divider, compact rhythm
 *   §Colors — Level 1 surface for content, 1px border outline
 *
 * Reference HTML: dashboard_a_ai/code.html "Manage Stock" drawer
 *   — right-side panel with Search-to-Add + existing watchlist + per-row actions.
 *
 * Hand-built primitive (no shadcn install). Visual semantics from DESIGN.md.
 */
import { useEffect } from "react";
import type { ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function ManageDrawer({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="relative ml-auto flex h-full w-full max-w-md flex-col border-l border-[color:var(--color-surface-1-border)] bg-[color:var(--color-surface-1)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[color:var(--color-surface-1-border)] px-4 py-3">
          <h2 className="text-[length:var(--text-headline-sm)] font-semibold text-[color:var(--color-foreground)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-md p-1 text-[color:var(--color-foreground-muted)] hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-foreground)]"
          >
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}
