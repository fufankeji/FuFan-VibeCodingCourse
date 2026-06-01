/**
 * F1 T009 — Quote Table.
 *
 * DESIGN.md ref:
 *   §Components — Data Tables (zebra subtle, 1px bottom border, instant hover);
 *                 Stock Cards / Status Badges
 *   §Layout & Spacing — compact rhythm (0.25rem cell padding)
 *   §Typography — table-data 13px, mono-label 11px, table-header 11px
 *   §Colors / Sentiment — bull/bear A股惯例
 *   §Elevation — Level 2 hover row; held positions get 2px primary-tinted left border
 * Reference HTML: dashboard_a_ai/code.html — Data Grid + holding row border-l-2 +
 *                 breakthrough/volume badges.
 *
 * Coverage:
 *   FR-005 持仓优先（store-side sort）
 *   FR-012 停牌/退市灰显 + 不阻塞
 *   FR-015 异动徽章位 (F2 badge enum) — empty list => no badge rendered
 *   FD-3 持仓视觉强化 (2px left border, primary tint)
 *   FD-8 移动端隐藏次要列（volume_ratio / volume）— see md: breakpoints
 */
import type { QuoteRow } from "../../services/sdk";
import { AnomalyBadge } from "../anomaly-badge/AnomalyBadge";

interface Props {
  rows: QuoteRow[];
  badges: Record<string, string[]>;
  onSelect?: (code: string) => void;
}

export function QuoteTable({ rows, badges, onSelect }: Props) {
  if (rows.length === 0) {
    return (
      <div
        role="status"
        className="px-4 py-8 text-center text-[length:var(--text-table-data)] text-[color:var(--color-foreground-muted)]"
      >
        先添加你的第一只自选股
      </div>
    );
  }
  return (
    <table
      role="table"
      aria-label="自选股报价表"
      className="w-full border-collapse text-[length:var(--text-table-data)]"
    >
      <thead className="sticky top-0 bg-[color:var(--color-surface-1)] text-[length:var(--text-table-header)] uppercase text-[color:var(--color-foreground-muted)]">
        <tr>
          <th scope="col" className="px-2 py-1 text-left">代码</th>
          <th scope="col" className="px-2 py-1 text-left">名称</th>
          <th scope="col" className="px-2 py-1 text-right">最新价</th>
          <th scope="col" className="px-2 py-1 text-right">涨跌幅</th>
          <th scope="col" className="hidden px-2 py-1 text-right md:table-cell">量比</th>
          <th scope="col" className="hidden px-2 py-1 text-right md:table-cell">成交量</th>
          <th scope="col" className="px-2 py-1 text-left">徽章</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <QuoteRowView
            key={r.code}
            row={r}
            badge={badges[r.code] ?? []}
            onClick={onSelect ? () => onSelect(r.code) : undefined}
          />
        ))}
      </tbody>
    </table>
  );
}

function QuoteRowView({
  row,
  badge,
  onClick,
}: {
  row: QuoteRow;
  badge: string[];
  onClick?: () => void;
}) {
  const isSuspended = row.status === "suspended" || row.status === "no_data";
  const isStale = row.status === "stale";
  const positive = (row.change_pct ?? 0) >= 0;
  const sentimentVar = positive ? "--color-bull" : "--color-bear";

  const rowCls = [
    "border-b border-[color:var(--color-surface-1-border)]",
    "hover:bg-[color:var(--color-surface-2)]",
    row.is_holding
      ? "border-l-2 border-l-[color:var(--color-primary)]"
      : "border-l-2 border-l-transparent",
    isSuspended ? "opacity-50" : "",
    onClick ? "cursor-pointer" : "",
  ].join(" ");

  return (
    <tr
      className={rowCls}
      onClick={onClick}
      aria-label={`${row.name} 报价行${row.is_holding ? "（持仓）" : ""}`}
    >
      <td className="px-2 py-1 font-mono text-[length:var(--text-mono-label)] text-[color:var(--color-foreground-muted)]">
        {row.code}
      </td>
      <td className="px-2 py-1 text-[color:var(--color-foreground)]">{row.name}</td>
      <td className="px-2 py-1 text-right font-mono">
        {row.price !== null ? row.price.toFixed(2) : isSuspended ? "停牌" : "—"}
      </td>
      <td
        className="px-2 py-1 text-right font-mono"
        style={{ color: row.change_pct !== null ? `var(${sentimentVar})` : undefined }}
      >
        {row.change_pct !== null
          ? `${positive ? "+" : ""}${row.change_pct.toFixed(2)}%`
          : "—"}
      </td>
      <td className="hidden px-2 py-1 text-right font-mono md:table-cell">
        {row.volume_ratio !== null ? row.volume_ratio.toFixed(2) : "—"}
      </td>
      <td className="hidden px-2 py-1 text-right font-mono md:table-cell">
        {row.volume !== null ? row.volume.toLocaleString() : "—"}
      </td>
      <td className="px-2 py-1">
        <div className="flex flex-wrap gap-1">
          {badge.map((b) => (
            <AnomalyBadge key={b} kind={b} />
          ))}
          {isStale ? (
            <span
              className="rounded-[var(--radius-sm)] bg-[color:var(--color-warning)] px-1 py-0.5 text-[length:var(--text-caption)] text-[color:var(--color-surface-base)]"
              aria-label="数据陈旧"
            >
              陈旧
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
