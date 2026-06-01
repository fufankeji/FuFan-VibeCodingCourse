/**
 * F1 T008 — Market Overview bar.
 *
 * DESIGN.md ref:
 *   §Components — index cards (compact, dense)
 *   §Colors / Sentiment — A-share 红涨绿跌 (var(--color-bull) / --color-bear)
 *   §Typography — headline-sm / caption
 * Reference HTML: specs/design-reference/stitch-export/dashboard_a_ai/code.html
 *                 (Top Market Bar — 3 index cards).
 *
 * FR-004: 顶部三大指数概览栏（FR-004），60s 随 dashboardStore 刷新.
 * FR-011: 非交易时段 sessionLabel 显示在外部 Dashboard, 此组件只渲染指数.
 */
import type { MarketIndexDto } from "../../services/sdk";

interface Props {
  indices: MarketIndexDto[];
}

export function MarketOverview({ indices }: Props) {
  if (indices.length === 0) {
    return (
      <section
        aria-label="市场指数"
        className="flex gap-2 px-3 py-2 text-[length:var(--text-caption)] text-[color:var(--color-foreground-muted)]"
      >
        指数数据加载中…
      </section>
    );
  }
  return (
    <section
      aria-label="市场指数"
      className="flex gap-2 overflow-x-auto px-3 py-2 border-b border-[color:var(--color-surface-1-border)]"
    >
      {indices.map((idx) => (
        <IndexCard key={idx.code} idx={idx} />
      ))}
    </section>
  );
}

function IndexCard({ idx }: { idx: MarketIndexDto }) {
  const positive = (idx.change_pct ?? 0) >= 0;
  const sentimentVar = positive ? "--color-bull" : "--color-bear";
  return (
    <div
      role="group"
      aria-label={idx.name}
      className="flex min-w-[140px] flex-col gap-0.5 rounded-[var(--radius-md)] border border-[color:var(--color-surface-1-border)] bg-[color:var(--color-surface-1)] px-3 py-1.5"
    >
      <span className="text-[length:var(--text-caption)] text-[color:var(--color-foreground-muted)]">
        {idx.name}
      </span>
      <span className="font-mono text-[length:var(--text-headline-sm)] text-[color:var(--color-foreground)]">
        {idx.point !== null ? idx.point.toFixed(2) : "—"}
      </span>
      <span
        className="font-mono text-[length:var(--text-caption)]"
        style={{ color: `var(${sentimentVar})` }}
      >
        {idx.change_pct !== null
          ? `${positive ? "+" : ""}${idx.change_pct.toFixed(2)}%`
          : "—"}
      </span>
    </div>
  );
}
