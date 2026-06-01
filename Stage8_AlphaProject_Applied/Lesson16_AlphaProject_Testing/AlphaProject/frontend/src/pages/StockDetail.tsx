/**
 * 单股详情 · 1:1 翻译自 a_ai_1/code.html L165-289（中文化）
 * 顶部 action header (返回 + display-price + 持仓/操作)
 * 左 lg:col-span-8 (大字价 + K 线 + 4 stat cards)
 * 右 lg:col-span-4 (AI 解释卡 + 相关新闻列表)
 */
import { useEffect, useState } from "react";
import { KlineChart } from "../components/charts/KlineChart";
import { Mi } from "../components/shell/Mi";
import { sdk, type KlinePointDto, type QuoteRow } from "../services/sdk";

interface Props {
  code: string;
  row?: QuoteRow | null;
  onBack?: () => void;
}

interface ExplainResp {
  text: string;
  source: string;
  partial: boolean;
  generated_at: string;
}

const RANGES = ["1日", "1周", "1月", "年初至今"];

export function StockDetail({ code, row, onBack }: Props) {
  const [klines, setKlines] = useState<KlinePointDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<string>("1日");
  const [explain, setExplain] = useState<ExplainResp | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    sdk.kline(code)
      .then((d) => { if (!cancelled) setKlines(d); })
      .catch(() => { if (!cancelled) setKlines([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [code]);

  const positive = (row?.change_pct ?? 0) >= 0;
  const toneVar = positive ? "bull" : "bear";

  async function fetchExplain() {
    setExplainLoading(true);
    try {
      const r = await fetch("/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code, name: row?.name ?? code,
          anomaly_type: positive ? "limit_up" : "limit_down",
          price: row?.price ?? 0, change_pct: row?.change_pct ?? 0,
        }),
      });
      if (r.ok) setExplain(await r.json());
    } catch { setExplain(null); }
    finally { setExplainLoading(false); }
  }

  return (
    <div className="-m-container-margin flex flex-col bg-surface-base">
      {/* Action Header */}
      <header className="px-container-margin py-4 border-b border-surface-border flex items-center justify-between sticky top-0 bg-surface-base/90 backdrop-blur z-30">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              type="button"
              aria-label="返回"
              onClick={onBack}
              className="text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <Mi name="arrow_back" />
            </button>
          )}
          <div>
            <h1 className="font-display-price text-display-price text-on-surface leading-none">{code}</h1>
            <span className="font-mono-label text-mono-label text-on-surface-variant">{row?.name ?? "—"}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={`flex items-center gap-2 px-3 py-1.5 rounded bg-surface-container hover:bg-surface-container-high border border-surface-border transition-colors`}
          >
            <Mi name="star" size={14} filled={!!row?.is_holding} className="text-primary" />
            <span className="font-mono-label text-mono-label text-on-surface">
              {row?.is_holding ? "已持仓" : "观察中"}
            </span>
          </button>
          <button
            type="button"
            disabled
            title="MVP 不下单（合规）"
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-primary/40 text-on-primary cursor-not-allowed"
          >
            <span className="font-mono-label text-mono-label font-bold">交易</span>
          </button>
        </div>
      </header>

      {/* Content Grid */}
      <div className="p-container-margin grid grid-cols-1 lg:grid-cols-12 gap-grid-gutter max-w-[1600px] mx-auto w-full">
        {/* Left: Chart + Stats */}
        <div className="lg:col-span-8 flex flex-col gap-grid-gutter">
          {/* Price & Chart */}
          <section className="bg-surface-card border border-surface-border rounded-lg p-4 flex flex-col gap-4">
            <div className="flex items-end justify-between">
              <div>
                <div className={`font-display-price text-display-price text-${toneVar}`}>
                  {row?.price !== null && row?.price !== undefined ? `¥${row.price.toFixed(2)}` : "—"}
                </div>
                <div className={`font-mono-label text-mono-label text-${toneVar} flex items-center gap-1 mt-1`}>
                  <Mi name={positive ? "arrow_upward" : "arrow_downward"} size={14} />
                  {row?.change_pct !== null && row?.change_pct !== undefined
                    ? `${positive ? "+" : ""}${row.change_pct.toFixed(2)}%`
                    : "—"}
                </div>
              </div>
              <div className="flex gap-1">
                {RANGES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={`px-2 py-1 font-mono-label text-mono-label rounded transition-colors ${
                      range === r
                        ? "bg-surface-container-high text-on-surface"
                        : "hover:bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full h-[400px] bg-surface-container-lowest border border-surface-border rounded relative overflow-hidden">
              {loading ? (
                <div className="absolute inset-0 grid place-items-center text-on-surface-variant font-mono-label text-mono-label">
                  <span className="flex items-center gap-2">
                    <Mi name="show_chart" className="animate-pulse" />
                    K 线加载中…
                  </span>
                </div>
              ) : klines.length === 0 ? (
                <div className="absolute inset-0 grid place-items-center text-on-surface-variant font-mono-label text-mono-label">
                  K 线数据加载失败
                </div>
              ) : (
                <KlineChart data={klines} />
              )}
            </div>
          </section>

          {/* Stat Cards */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="量比" value={row?.volume_ratio?.toFixed(2) ?? "—"} />
            <StatCard label="成交量" value={row?.volume?.toLocaleString() ?? "—"} />
            <StatCard label="状态" value={row?.is_holding ? "持仓" : "观察"} />
            <StatCard label="分组" value={row?.group_id ? `#${row.group_id}` : "默认"} />
          </section>
        </div>

        {/* Right: AI + News */}
        <div className="lg:col-span-4 flex flex-col gap-grid-gutter">
          {/* AI Insight Card */}
          <section className="bg-surface-card border border-surface-border rounded-lg p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-breakthrough to-primary" />
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Mi name="auto_awesome" filled className="text-breakthrough" />
                <h3 className="font-headline-sm text-headline-sm text-on-surface">AI 解释</h3>
              </div>
              <button
                type="button"
                onClick={fetchExplain}
                disabled={explainLoading}
                className="rounded border border-surface-border bg-surface-container hover:bg-surface-container-high px-2 py-0.5 font-mono-label text-mono-label text-on-surface disabled:opacity-50"
              >
                {explainLoading ? "生成中…" : explain ? "重新生成" : "为什么"}
              </button>
            </div>
            {explain ? (
              <>
                <pre className="font-ai-commentary text-ai-commentary text-on-surface-variant mb-4 whitespace-pre-wrap font-sans">{explain.text}</pre>
                <div className="p-3 bg-surface-container rounded border border-surface-border flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-anomaly mt-1.5 flex-shrink-0" />
                  <div>
                    <div className="font-mono-label text-mono-label text-on-surface mb-1">解释来源</div>
                    <div className="font-caption text-caption text-on-surface-variant">{explain.source}</div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-surface-border flex justify-between items-center">
                  <span className="font-caption text-caption text-outline">AI 生成，需独立核验</span>
                </div>
              </>
            ) : (
              <p className="font-ai-commentary text-ai-commentary text-on-surface-variant">
                点击「为什么」让 DeepSeek 生成 ≤200 字的 AI 解释（自动附"以上为信息整理，不构成投资建议"风险尾标）。
              </p>
            )}
          </section>

          {/* Related News */}
          <section className="bg-surface-card border border-surface-border rounded-lg flex flex-col h-[400px]">
            <div className="p-4 border-b border-surface-border flex items-center justify-between">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">相关新闻</h3>
              <Mi name="article" className="text-on-surface-variant" />
            </div>
            <div className="flex-1 overflow-y-auto p-2 grid place-items-center">
              <p className="font-mono-label text-mono-label text-on-surface-variant text-center px-4">
                财联社新闻按代码反查待盘中 F2 异动命中后填充。MVP 阶段空。
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-card border border-surface-border rounded p-3">
      <div className="font-caption text-caption text-on-surface-variant mb-1">{label}</div>
      <div className="font-table-data text-table-data text-on-surface">{value}</div>
    </div>
  );
}
