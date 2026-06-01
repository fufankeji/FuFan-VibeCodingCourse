/**
 * 早盘简报 · 1:1 翻译自 a_ai_2/code.html L168-358（中文化）
 * 左 Archive (30 天) + 右 4 区块（市场总览 / AI 自选洞察 / 隔夜要闻 / 今日日程）
 */
import { useEffect, useState } from "react";
import { Mi } from "../components/shell/Mi";

interface BriefingRow {
  on_date: string;
  version: string;
  push_status: string;
  created_at: string;
}

interface BriefingDetail extends BriefingRow { content_json: string; }
interface BriefingContent {
  market_summary?: string;
  watchlist_summary?: string;
  news_summary?: string;
  calendar_summary?: string;
}

export function MorningReport() {
  const [list, setList] = useState<BriefingRow[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [detail, setDetail] = useState<BriefingDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/briefing/history");
        if (r.ok) {
          const data: BriefingRow[] = await r.json();
          setList(data);
          if (data.length > 0) setActive(data[0].on_date);
        }
      } catch {/* noop */}
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!active) return;
    void (async () => {
      try {
        const r = await fetch(`/briefing/${active}`);
        if (r.ok) setDetail(await r.json()); else setDetail(null);
      } catch { setDetail(null); }
    })();
  }, [active]);

  const labelFor = (iso: string): string => {
    const d = new Date(iso);
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const diff = Math.floor((t.getTime() - d.getTime()) / 86_400_000);
    if (diff === 0) return "今日";
    if (diff === 1) return "昨日";
    if (diff < 7) return ["周日","周一","周二","周三","周四","周五","周六"][d.getDay()];
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  };

  const content: BriefingContent = (() => {
    if (!detail) return {};
    try { return JSON.parse(detail.content_json); } catch { return {}; }
  })();

  return (
    <div className="h-[calc(100vh-3rem-2rem)] flex flex-col md:flex-row overflow-hidden -m-container-margin">
      {/* Left: Archive */}
      <section className="w-full md:w-80 flex-shrink-0 border-r border-surface-border bg-surface flex flex-col h-full overflow-hidden hidden md:flex">
        <div className="p-4 border-b border-surface-border bg-surface-card sticky top-0 z-10">
          <h2 className="font-headline-sm text-headline-sm text-on-surface mb-2">历史归档</h2>
          <div className="relative">
            <Mi name="search" size={18} className="absolute left-2 top-1/2 -translate-y-1/2 text-outline" />
            <input
              type="text"
              placeholder="搜索简报…"
              className="w-full bg-surface-container border border-surface-border rounded pl-8 pr-3 py-1.5 font-table-data text-table-data text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <p className="font-mono-label text-mono-label text-on-surface-variant px-3 py-2">加载中…</p>
          ) : list.length === 0 ? (
            <p className="font-mono-label text-mono-label text-on-surface-variant px-3 py-6">
              暂无简报。下一份工作日 09:15 自动生成。
            </p>
          ) : list.map((row) => {
            const isActive = active === row.on_date;
            const base = "p-3 rounded cursor-pointer border w-full text-left";
            const cls = isActive
              ? `${base} bg-surface-container-highest border-surface-border`
              : `${base} hover:bg-surface-container-high border-transparent hover:border-surface-border transition-colors`;
            return (
              <button key={row.on_date} type="button" onClick={() => setActive(row.on_date)} className={cls}>
                <div className="flex justify-between items-start mb-1">
                  <span className={`font-table-header text-table-header ${isActive ? "text-primary" : "text-on-surface"}`}>
                    {labelFor(row.on_date)}
                  </span>
                  <span className={`font-mono-label text-mono-label ${isActive ? "text-on-surface-variant" : "text-outline"}`}>
                    {row.on_date.slice(5)}
                  </span>
                </div>
                <div className={`font-caption text-caption truncate ${isActive ? "text-on-surface-variant" : "text-outline"}`}>
                  v{row.version} · {row.push_status === "delivered" ? "已送达" : row.push_status}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Right: Active report */}
      <section className="flex-1 h-full overflow-y-auto bg-surface-base p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {!detail ? (
            <div className="h-full grid place-items-center text-table-data text-on-surface-variant py-24">
              {list.length === 0 ? "暂无简报。明天 09:15 后回来看第一份。" : "选择左侧一条简报查看"}
            </div>
          ) : (
            <>
              <header className="mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-mono-label text-mono-label border border-primary/20">
                    实时简报
                  </span>
                  <span className="font-mono-label text-mono-label text-outline">
                    生成：{new Date(detail.created_at).toLocaleString("zh-CN")}
                  </span>
                </div>
                <h1 className="font-display-price text-display-price text-on-surface mb-2">
                  早盘简报 · {detail.on_date}
                </h1>
                <p className="font-ai-commentary text-ai-commentary text-on-surface-variant max-w-2xl">
                  AI 综合全球指数表现、自选股舆情、隔夜关键催化事件的盘前总览。
                </p>
              </header>

              <Card title="全球市场总览" icon="public" iconTone="primary">
                <p className="px-4 pb-4 font-ai-commentary text-ai-commentary text-on-surface-variant whitespace-pre-wrap">
                  {content.market_summary || "数据获取中…"}
                </p>
              </Card>

              <Card title="自选股 AI 洞察" icon="smart_toy" iconTone="breakthrough" aiTinted>
                <div className="p-4 font-ai-commentary text-ai-commentary text-on-surface-variant whitespace-pre-wrap">
                  {content.watchlist_summary || "暂无自选股，或自选清单为空。"}
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title="隔夜要闻" icon="newspaper" iconTone="secondary">
                  <p className="p-4 font-table-data text-table-data text-on-surface whitespace-pre-wrap">
                    {content.news_summary || "数据获取中…"}
                  </p>
                </Card>
                <Card title="今日日程" icon="calendar_month" iconTone="primary">
                  <p className="p-4 font-table-data text-table-data text-on-surface whitespace-pre-wrap">
                    {content.calendar_summary || "数据获取中…"}
                  </p>
                </Card>
              </div>

              <footer className="mt-8 pt-6 border-t border-surface-border text-center pb-8">
                <p className="font-caption text-caption text-outline max-w-3xl mx-auto">
                  以上为信息整理，不构成投资建议。简报由 AI 综合市场数据与新闻生成，请独立核验后再决策。
                </p>
              </footer>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function Card({ title, icon, iconTone, aiTinted, children }: {
  title: string; icon: string; iconTone: string; aiTinted?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-card border border-surface-border rounded-lg overflow-hidden relative">
      {aiTinted && <div className="absolute inset-0 border-l-2 border-breakthrough pointer-events-none" />}
      <div className="px-4 py-3 border-b border-surface-border bg-surface-container-low flex items-center gap-2">
        <Mi name={icon} size={20} className={`text-${iconTone}`} />
        <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
      </div>
      {children}
    </div>
  );
}
