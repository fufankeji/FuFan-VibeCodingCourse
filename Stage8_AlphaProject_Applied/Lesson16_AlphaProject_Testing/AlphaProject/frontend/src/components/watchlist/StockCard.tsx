/**
 * DESIGN.md ref:
 *   §Components / Stock Cards — held positions get a 2px primary-tinted left border
 *   §Layout — compact 0.25rem vertical padding
 *   §Typography — JetBrains Mono for stock codes (mono-label),
 *                 Inter for name (table-data 13px)
 *
 * Reference HTML (look not copy): design-reference/stitch-export/dashboard_a_ai/code.html
 *   "Drawer / Manage Stock" — 600519 row with Untag/Remove actions.
 */
import { StatusBadge } from "./StatusBadge";
import type { WatchlistItem, WatchlistGroup } from "../../services/sdk";

interface Props {
  item: WatchlistItem;
  groups: WatchlistGroup[];
  onToggleHolding: () => void;
  onRemove: () => void;
}

export function StockCard({ item, groups, onToggleHolding, onRemove }: Props) {
  const group = groups.find((g) => g.id === item.group_id);
  const holding = item.is_holding;
  return (
    <div
      className={`flex items-center justify-between gap-3 border-y border-[color:var(--color-surface-1-border)] bg-[color:var(--color-surface-1)] px-3 py-1.5 hover:bg-[color:var(--color-surface-2)] ${
        holding ? "border-l-2 border-l-[color:var(--color-primary)]" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="font-mono text-[length:var(--text-mono-label)] text-[color:var(--color-foreground-muted)]">
          {item.code}
        </span>
        <span className="truncate text-[length:var(--text-table-data)] text-[color:var(--color-foreground)]">
          {item.name}
        </span>
        <div className="flex gap-1">
          {holding && <StatusBadge tone="holding">持仓</StatusBadge>}
          {group && <StatusBadge tone="group">{group.name}</StatusBadge>}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={onToggleHolding}
          className="rounded-md border border-[color:var(--color-surface-1-border)] px-2 py-0.5 text-[length:var(--text-mono-label)] text-[color:var(--color-foreground-muted)] hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-foreground)]"
        >
          {holding ? "取消持仓" : "标记持仓"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md border border-[color:var(--color-surface-1-border)] px-2 py-0.5 text-[length:var(--text-mono-label)] text-[color:var(--color-bear)] hover:bg-[color:var(--color-surface-2)]"
        >
          移除
        </button>
      </div>
    </div>
  );
}
