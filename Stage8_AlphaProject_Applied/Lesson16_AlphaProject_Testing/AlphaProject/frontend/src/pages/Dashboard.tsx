/**
 * Dashboard · Stitch 1:1 骨架 + 信息密度增强
 *
 * 分层（自上而下）：
 *   1. 指数 Hero Bar — 上证/深证/创业板，含点位、点差、涨跌幅、SVG 趋势
 *   2. KPI Strip     — 持仓 / 自选 / 异动 / 上涨 / 下跌 / 平均涨幅（来自 rows 本地计算）
 *   3. Top Movers    — 今日最强 + 今日最弱 双卡
 *   4. Watchlist     — 表格，量比可视化条 + 状态点 + 持仓行高亮渐变
 *
 * 测试契约保留：role="alert" 失败横幅 / aria-label="刷新" / sessionLabel / 表头中文。
 */
import { useEffect, useMemo, useState } from "react";

import { useDashboardStore } from "../store/dashboardStore";
import { Mi } from "../components/shell/Mi";
import { StockDetail } from "./StockDetail";
import type { MarketIndexDto, QuoteRow } from "../services/sdk";

const REFRESH_INTERVAL_MS = 60_000;
const FAILURE_BANNER_THRESHOLD_MS = 5 * 60_000;

interface Props {
  onOpenWatchlist?: () => void;
}

export function Dashboard({ onOpenWatchlist }: Props) {
  const { rows, indices, badges, sparklines, sessionLabel, error, failureStartedAt, fetchedAt, load } =
    useDashboardStore();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (selectedCode) {
    const row = rows.find((r) => r.code === selectedCode);
    return (
      <StockDetail
        code={selectedCode}
        row={row ?? null}
        onBack={() => setSelectedCode(null)}
      />
    );
  }

  const failureMs = failureStartedAt ? Date.now() - failureStartedAt.getTime() : 0;
  const showFailureBanner = failureMs > FAILURE_BANNER_THRESHOLD_MS;

  return (
    <>
      <IndexHeroBar indices={indices} fetchedAt={fetchedAt} />

      {showFailureBanner && (
        <div
          role="alert"
          aria-label="行情持续失败"
          className="mb-3 rounded border border-bull/40 bg-bull/10 px-3 py-2 text-table-data text-bull"
        >
          行情持续失败 &gt; 5 分钟：{error ?? "原因待定"}
        </div>
      )}

      <KpiStrip rows={rows} badges={badges} />

      <TopMovers rows={rows} />

      {/* Main Grid Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <div>
          <h1 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
            <Mi name="view_list" size={20} className="text-primary" filled />
            自选股总览
          </h1>
          <div className="mt-1 font-mono-label text-mono-label text-on-surface-variant">
            共 {rows.length} 只 · {sessionLabel || "状态加载中…"}
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            type="button"
            className="bg-surface-container-highest hover:bg-surface-bright text-on-surface font-mono-label text-mono-label px-3 py-1.5 rounded border border-surface-border transition-colors flex items-center gap-1"
          >
            <Mi name="filter_list" size={14} />
            筛选
          </button>
          <button
            type="button"
            className="bg-surface-container-highest hover:bg-surface-bright text-on-surface font-mono-label text-mono-label px-3 py-1.5 rounded border border-surface-border transition-colors flex items-center gap-1"
          >
            <Mi name="sort" size={14} />
            排序
          </button>
          <button
            type="button"
            aria-label="刷新"
            onClick={() => void load()}
            className="bg-surface-container-highest hover:bg-surface-bright text-on-surface font-mono-label text-mono-label px-3 py-1.5 rounded border border-surface-border transition-colors flex items-center gap-1"
          >
            <Mi name="refresh" size={14} />
            刷新
          </button>
          <button
            type="button"
            onClick={onOpenWatchlist}
            className="bg-primary/10 hover:bg-primary/20 text-primary font-mono-label text-mono-label px-3 py-1.5 rounded border border-primary/30 transition-colors flex items-center gap-1 ml-auto sm:ml-0"
          >
            <Mi name="add" size={14} />
            管理
          </button>
        </div>
      </div>

      <WatchlistTable
        rows={rows}
        badges={badges}
        sparklines={sparklines}
        onSelect={setSelectedCode}
        onOpenWatchlist={onOpenWatchlist}
      />
    </>
  );
}

/* ───────────────────────── Index Hero Bar ───────────────────────── */

const INDEX_TICKER: Record<string, string> = {
  上证指数: "SSEC · 000001",
  深证成指: "SZSE · 399001",
  创业板指: "ChiNext · 399006",
};

function IndexHeroBar({ indices, fetchedAt }: { indices: MarketIndexDto[]; fetchedAt: string | null }) {
  if (indices.length === 0) {
    return (
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-surface-card border border-surface-border rounded-lg p-5 h-28 flex items-center justify-center font-mono-label text-mono-label text-on-surface-variant"
          >
            指数数据加载中…
          </div>
        ))}
      </section>
    );
  }
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      {indices.map((idx) => {
        const chg = idx.change_pct ?? 0;
        const positive = chg >= 0;
        const tone = positive ? "bull" : "bear";
        const ticker = INDEX_TICKER[idx.name] ?? idx.code;
        const prevClose = idx.point && chg !== -100 ? idx.point / (1 + chg / 100) : null;
        const pointDelta = idx.point !== null && prevClose !== null ? idx.point - prevClose : null;
        const updated = fetchedAt
          ? new Date(fetchedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
          : "—";
        return (
          <div
            key={idx.code}
            className={`relative overflow-hidden rounded-lg border border-surface-border bg-surface-card p-5 group hover:border-${tone}/40 transition-colors`}
          >
            <div
              className={`pointer-events-none absolute inset-0 bg-gradient-to-br from-${tone}/12 via-transparent to-transparent`}
            />
            <div className="pointer-events-none absolute -right-8 -top-8 w-32 h-32 rounded-full blur-3xl opacity-40 bg-gradient-to-br from-bull/30 to-transparent" style={{ background: positive ? undefined : "" }} />
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-headline-sm text-headline-sm text-on-surface">{idx.name}</div>
                  <div className="font-mono-label text-mono-label text-outline tracking-wider">{ticker}</div>
                </div>
                <div className={`w-9 h-9 rounded-full bg-${tone}/15 flex items-center justify-center border border-${tone}/30`}>
                  <Mi name={positive ? "trending_up" : "trending_down"} size={20} filled className={`text-${tone}`} />
                </div>
              </div>
              <div className="flex items-baseline gap-3 mb-2">
                <span className={`font-display-price text-display-price text-${tone}`}>
                  {idx.point?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? "—"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`bg-${tone}/15 text-${tone} border border-${tone}/30 rounded px-2 py-0.5 font-mono-label text-mono-label`}>
                  {pointDelta !== null ? `${positive ? "+" : ""}${pointDelta.toFixed(2)}` : "—"}
                </span>
                <span className={`font-mono-label text-mono-label text-${tone}`}>
                  {idx.change_pct !== null && idx.change_pct !== undefined
                    ? `${positive ? "+" : ""}${idx.change_pct.toFixed(2)}%`
                    : "—"}
                </span>
                <span className="ml-auto font-caption text-caption text-outline">{updated}</span>
              </div>
              <Sparkline tone={tone} positive={positive} className="mt-3" />
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** 走势示意 SVG — 由于没有日内分钟数据，画一条贴合大势走向的折线（视觉指示）。 */
function Sparkline({ tone, positive, className }: { tone: string; positive: boolean; className?: string }) {
  const pts = positive ? [38, 32, 35, 28, 30, 22, 25, 18, 14, 12] : [12, 16, 14, 22, 18, 24, 22, 28, 32, 34];
  const w = 280;
  const h = 36;
  const stepX = w / (pts.length - 1);
  const path = pts.map((y, i) => `${i === 0 ? "M" : "L"} ${i * stepX} ${y}`).join(" ");
  const fill = `${path} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={`w-full h-9 ${className ?? ""}`}>
      <defs>
        <linearGradient id={`grad-${tone}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#grad-${tone})`} className={`text-${tone}`} />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" className={`text-${tone}`} />
    </svg>
  );
}

/* ───────────────────────── KPI Strip ───────────────────────── */

function KpiStrip({ rows, badges }: { rows: QuoteRow[]; badges: Record<string, string[]> }) {
  const stats = useMemo(() => {
    const holding = rows.filter((r) => r.is_holding).length;
    const ups = rows.filter((r) => (r.change_pct ?? 0) > 0).length;
    const downs = rows.filter((r) => (r.change_pct ?? 0) < 0).length;
    const flats = rows.length - ups - downs;
    const chgs = rows.map((r) => r.change_pct ?? 0);
    const avg = chgs.length ? chgs.reduce((a, b) => a + b, 0) / chgs.length : 0;
    const anomalyCount = Object.values(badges).reduce((acc, b) => acc + (b?.length ? 1 : 0), 0);
    return { holding, ups, downs, flats, avg, anomalyCount };
  }, [rows, badges]);

  const items = [
    { label: "自选数", value: rows.length, sub: `持仓 ${stats.holding}`, icon: "format_list_bulleted", tone: "primary" },
    { label: "异动股", value: stats.anomalyCount, sub: "命中规则", icon: "bolt", tone: "anomaly" },
    { label: "上涨", value: stats.ups, sub: "只", icon: "trending_up", tone: "bull" },
    { label: "下跌", value: stats.downs, sub: "只", icon: "trending_down", tone: "bear" },
    { label: "平盘", value: stats.flats, sub: "只", icon: "remove", tone: "on-surface-variant" },
    {
      label: "平均涨幅",
      value: `${stats.avg >= 0 ? "+" : ""}${stats.avg.toFixed(2)}%`,
      sub: "今日",
      icon: "show_chart",
      tone: stats.avg >= 0 ? "bull" : "bear",
    },
  ];

  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="bg-surface-card border border-surface-border rounded-lg p-3 hover:border-surface-variant transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            <Mi name={it.icon} size={14} className={`text-${it.tone}`} />
            <span className="font-mono-label text-mono-label text-on-surface-variant uppercase tracking-wider">
              {it.label}
            </span>
          </div>
          <div className={`font-headline-sm text-headline-sm text-${it.tone === "on-surface-variant" ? "on-surface" : it.tone}`}>
            {it.value}
          </div>
          <div className="font-caption text-caption text-outline mt-0.5">{it.sub}</div>
        </div>
      ))}
    </section>
  );
}

/* ───────────────────────── Top Movers ───────────────────────── */

function TopMovers({ rows }: { rows: QuoteRow[] }) {
  const { strongest, weakest } = useMemo(() => {
    const withChg = rows.filter((r) => r.change_pct !== null && r.change_pct !== undefined);
    if (withChg.length === 0) return { strongest: null, weakest: null };
    const sorted = [...withChg].sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0));
    return { strongest: sorted[0], weakest: sorted[sorted.length - 1] };
  }, [rows]);

  if (!strongest || !weakest || strongest.code === weakest.code) return null;

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <MoverCard label="今日最强" row={strongest} tone="bull" icon="rocket_launch" />
      <MoverCard label="今日最弱" row={weakest} tone="bear" icon="south_east" />
    </section>
  );
}

function MoverCard({ label, row, tone, icon }: { label: string; row: QuoteRow; tone: string; icon: string }) {
  const chg = row.change_pct ?? 0;
  const sign = chg >= 0 ? "+" : "";
  return (
    <div
      className={`relative overflow-hidden bg-surface-card border border-surface-border hover:border-${tone}/40 rounded-lg p-4 transition-colors`}
    >
      <div className={`absolute inset-0 bg-gradient-to-r from-${tone}/8 to-transparent pointer-events-none`} />
      <div className="relative flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg bg-${tone}/15 border border-${tone}/30 flex items-center justify-center`}>
          <Mi name={icon} size={24} filled className={`text-${tone}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono-label text-mono-label text-on-surface-variant uppercase tracking-wider">{label}</div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline-sm text-headline-sm text-on-surface truncate">{row.name}</span>
            <span className="font-mono-label text-mono-label text-outline">{row.code}</span>
          </div>
        </div>
        <div className="text-right">
          <div className={`font-display-price text-display-price text-${tone}`}>
            {sign}{chg.toFixed(2)}%
          </div>
          <div className="font-mono-label text-mono-label text-on-surface-variant">
            ¥{row.price?.toFixed(2) ?? "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Watchlist Table ───────────────────────── */

function WatchlistTable({
  rows,
  badges,
  sparklines,
  onSelect,
  onOpenWatchlist,
}: {
  rows: QuoteRow[];
  badges: Record<string, string[]>;
  sparklines: Record<string, number[]>;
  onSelect: (code: string) => void;
  onOpenWatchlist?: () => void;
}) {
  return (
    <div className="bg-surface-card border border-surface-border rounded-lg overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[900px]">
        <thead>
          <tr className="border-b border-surface-border bg-surface-container-low">
            <th className="font-table-header text-table-header text-on-surface-variant px-table-cell-px py-table-cell-py font-medium tracking-wider w-12 text-center">状态</th>
            <th className="font-table-header text-table-header text-on-surface-variant px-table-cell-px py-table-cell-py font-medium tracking-wider w-28">代码</th>
            <th className="font-table-header text-table-header text-on-surface-variant px-table-cell-px py-table-cell-py font-medium tracking-wider">名称</th>
            <th className="font-table-header text-table-header text-on-surface-variant px-table-cell-px py-table-cell-py font-medium tracking-wider text-right">最新价</th>
            <th className="font-table-header text-table-header text-on-surface-variant px-table-cell-px py-table-cell-py font-medium tracking-wider text-right">涨跌幅</th>
            <th className="font-table-header text-table-header text-on-surface-variant px-table-cell-px py-table-cell-py font-medium tracking-wider w-32">30 日趋势</th>
            <th className="font-table-header text-table-header text-on-surface-variant px-table-cell-px py-table-cell-py font-medium tracking-wider w-40">量比</th>
            <th className="font-table-header text-table-header text-on-surface-variant px-table-cell-px py-table-cell-py font-medium tracking-wider">异动</th>
          </tr>
        </thead>
        <tbody className="font-table-data text-table-data text-on-surface">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-12 text-center text-on-surface-variant">
                <div className="flex flex-col items-center gap-3">
                  <Mi name="bookmark_add" size={32} className="text-outline" />
                  <span>先添加你的第一只自选股</span>
                  {onOpenWatchlist && (
                    <button
                      type="button"
                      onClick={onOpenWatchlist}
                      className="rounded border border-primary/30 px-3 py-1 text-primary hover:bg-primary/10 font-mono-label text-mono-label"
                    >
                      打开自选管理
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <Row
                key={r.code}
                row={r}
                alerts={badges[r.code] ?? []}
                spark={sparklines[r.code] ?? []}
                onSelect={onSelect}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  row,
  alerts,
  spark,
  onSelect,
}: {
  row: QuoteRow;
  alerts: string[];
  spark: number[];
  onSelect: (code: string) => void;
}) {
  const chg = row.change_pct;
  const positive = (chg ?? 0) >= 0;
  const tone = chg === null || chg === undefined ? "on-surface" : positive ? "bull" : "bear";
  const vr = row.volume_ratio ?? 0;
  const vrPct = Math.min(100, (vr / 5) * 100);
  const vrTone = vr > 3 ? "anomaly" : vr > 1.5 ? "primary" : "on-surface-variant";

  const rowCls = row.is_holding
    ? "border-b border-surface-border bg-gradient-to-r from-primary/8 to-transparent border-l-2 border-l-primary hover:bg-primary/12 cursor-pointer transition-colors"
    : "border-b border-surface-border hover:bg-surface-container/40 cursor-pointer transition-colors";

  const statusDot = row.status === "normal"
    ? "bg-bull"
    : row.status === "suspended"
    ? "bg-outline"
    : row.status === "stale"
    ? "bg-anomaly"
    : "bg-bear";

  return (
    <tr className={rowCls} onClick={() => onSelect(row.code)}>
      <td className="px-table-cell-px py-table-cell-py text-center">
        <div className="flex items-center justify-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} title={row.status} />
          {row.is_holding && <Mi name="work" size={14} filled className="text-primary" title="持仓" />}
        </div>
      </td>
      <td className="px-table-cell-px py-table-cell-py font-mono-label text-mono-label">
        <span className={row.is_holding ? "text-primary" : "text-on-surface"}>{row.code}</span>
      </td>
      <td className="px-table-cell-px py-table-cell-py font-medium">{row.name}</td>
      <td className={`px-table-cell-px py-table-cell-py text-right text-${tone} font-mono-label text-mono-label`}>
        {row.price !== null && row.price !== undefined ? row.price.toFixed(2) : "—"}
      </td>
      <td className={`px-table-cell-px py-table-cell-py text-right text-${tone} font-mono-label text-mono-label`}>
        {chg !== null && chg !== undefined ? `${positive ? "+" : ""}${chg.toFixed(2)}%` : "—"}
      </td>
      <td className="px-table-cell-px py-table-cell-py">
        <RowSparkline data={spark} />
      </td>
      <td className="px-table-cell-px py-table-cell-py">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
            <div className={`h-full bg-${vrTone} transition-all`} style={{ width: `${vrPct}%` }} />
          </div>
          <span className={`font-mono-label text-mono-label text-${vrTone} w-10 text-right`}>
            {vr ? vr.toFixed(2) : "—"}
          </span>
        </div>
      </td>
      <td className="px-table-cell-px py-table-cell-py">
        {alerts.length === 0 ? (
          <span className="font-caption text-caption text-outline">—</span>
        ) : (
          alerts.map((b) => <AlertBadge key={b} kind={b} />)
        )}
      </td>
    </tr>
  );
}

function RowSparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) {
    return <span className="font-caption text-caption text-outline">—</span>;
  }
  const first = data[0];
  const last = data[data.length - 1];
  const positive = last >= first;
  const tone = positive ? "bull" : "bear";
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 110;
  const h = 28;
  const stepX = w / (data.length - 1);
  const pts = data.map((v, i) => [i * stepX, h - ((v - min) / range) * h] as const);
  const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const fillPath = `${path} L ${w} ${h} L 0 ${h} Z`;
  const lastY = pts[pts.length - 1][1];
  const gid = `sg-${tone}-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={`w-full h-7 text-${tone}`}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={w} cy={lastY} r="2" fill="currentColor" />
    </svg>
  );
}

function AlertBadge({ kind }: { kind: string }) {
  const palette: Record<string, { tone: string; label: string; icon: string; pulse?: boolean }> = {
    limit_up: { tone: "bull", label: "涨停", icon: "north" },
    limit_down: { tone: "bear", label: "跌停", icon: "south" },
    breakout: { tone: "breakthrough", label: "突破", icon: "north_east" },
    breakdown: { tone: "breakthrough", label: "跌破", icon: "south_east" },
    volume: { tone: "anomaly", label: "量能", icon: "bolt", pulse: true },
    amplitude: { tone: "anomaly", label: "振幅", icon: "swap_vert" },
    event: { tone: "primary", label: "事件", icon: "campaign" },
  };
  const p = palette[kind] ?? { tone: "on-surface-variant", label: kind, icon: "circle" };
  return (
    <span
      className={`inline-flex items-center gap-1 bg-${p.tone}/20 text-${p.tone} px-1.5 py-0.5 rounded text-[10px] font-mono-label text-mono-label border border-${p.tone}/30 mr-1 ${p.pulse ? "animate-pulse" : ""}`}
    >
      <Mi name={p.icon} size={10} />
      {p.label}
    </span>
  );
}
