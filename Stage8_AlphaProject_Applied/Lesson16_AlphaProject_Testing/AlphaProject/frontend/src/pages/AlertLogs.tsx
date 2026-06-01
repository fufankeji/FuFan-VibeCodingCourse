/**
 * 异动日志 · 1:1 翻译自 ai_a_ai/code.html L187-313（中文化）
 * 主区: 标题 "系统异动历史" + 筛选条 + 垂直时间线卡片流 + "加载历史数据"
 * 每张卡: 时间戳 + 股票圆角徽章 + 异动类型徽章 + 触发说明 + 推送状态 + AI 解释 + 风险尾标
 */
import { useEffect, useState } from "react";
import { Mi } from "../components/shell/Mi";

interface PushLogRow {
  ts: string;
  status: string;
  retries: number;
  code: string | null;
  signal: string | null;
  error?: string | null;
}

export function AlertLogs() {
  const [rows, setRows] = useState<PushLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [symbolFilter, setSymbolFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("全部类型");
  const [timeFilter, setTimeFilter] = useState("近 24 小时");

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/push/history?limit=100");
      if (r.ok) setRows(await r.json());
    } catch { /* noop */ }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const filtered = rows.filter((r) => {
    if (symbolFilter && !(r.code ?? "").includes(symbolFilter.trim())) return false;
    return true;
  });

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <button type="button" className="inline-flex items-center gap-1 text-on-surface-variant hover:text-primary font-caption text-caption mb-2 transition-colors">
            <Mi name="arrow_back" size={14} />
            返回 总览看板
          </button>
          <h1 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
            <Mi name="history" className="text-primary" />
            系统异动历史
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 p-2 rounded border border-surface-border bg-surface-card/40">
          <div className="flex items-center bg-surface-container rounded px-2 border border-surface-border focus-within:border-primary">
            <Mi name="filter_alt" size={14} className="text-on-surface-variant" />
            <input
              type="text"
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
              placeholder="按代码筛选…"
              className="bg-transparent border-none focus:ring-0 text-on-surface font-mono-label text-mono-label w-32 py-1 px-2 h-7 focus:outline-none"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-surface-container text-on-surface font-mono-label text-mono-label border border-surface-border rounded h-7 py-0 px-2 focus:outline-none focus:border-primary"
          >
            <option>全部类型</option>
            <option>涨跌停</option>
            <option>突破/跌破</option>
            <option>量能异常</option>
            <option>振幅异常</option>
            <option>事件/公告</option>
          </select>
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="bg-surface-container text-on-surface font-mono-label text-mono-label border border-surface-border rounded h-7 py-0 px-2 focus:outline-none focus:border-primary"
          >
            <option>近 24 小时</option>
            <option>近 7 天</option>
            <option>近 30 天</option>
          </select>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {loading ? (
          <p className="font-mono-label text-mono-label text-on-surface-variant py-8 text-center">加载中…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 font-mono-label text-mono-label text-on-surface-variant">
            暂无异动记录。盘中 9:30-15:00 触发的异动会出现在这里。
          </div>
        ) : (
          <div className="relative border-l border-surface-border ml-2 md:ml-4 space-y-8 pb-12">
            {filtered.map((row, i) => (
              <AlertNode key={`${row.ts}-${i}`} row={row} />
            ))}
          </div>
        )}

        <div className="flex justify-center mt-6">
          <button
            type="button"
            onClick={load}
            className="bg-surface-container hover:bg-surface-container-high border border-surface-border text-on-surface-variant font-mono-label text-mono-label py-2 px-6 rounded transition-colors flex items-center gap-2"
          >
            <Mi name="refresh" size={16} />
            加载历史数据
          </button>
        </div>
      </div>
    </>
  );
}

const SIGNAL_LABELS: Record<string, { zh: string; tone: string; icon: string }> = {
  limit_up: { zh: "涨停", tone: "bull", icon: "trending_up" },
  limit_down: { zh: "跌停", tone: "bear", icon: "trending_down" },
  breakout: { zh: "突破", tone: "breakthrough", icon: "north_east" },
  breakdown: { zh: "跌破", tone: "breakthrough", icon: "south_east" },
  volume: { zh: "量能异常", tone: "anomaly", icon: "bolt" },
  amplitude: { zh: "振幅异常", tone: "anomaly", icon: "swap_vert" },
  event: { zh: "事件公告", tone: "primary", icon: "campaign" },
};

function AlertNode({ row }: { row: PushLogRow }) {
  const time = new Date(row.ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const code = row.code ?? "—";
  const sig = SIGNAL_LABELS[row.signal ?? ""] ?? { zh: row.signal ?? "系统", tone: "outline", icon: "circle" };
  const isHigh = sig.tone === "bull" || sig.tone === "anomaly" || sig.tone === "breakthrough";

  return (
    <div className="relative pl-6 md:pl-8 group">
      <div
        className={`absolute -left-[5px] top-4 w-2.5 h-2.5 rounded-full ${
          isHigh ? `bg-${sig.tone}` : "bg-surface-border border-2 border-surface-base"
        }`}
      />
      <div className="font-mono-label text-mono-label text-on-surface-variant mb-2 pl-1 flex items-center gap-2">
        {time}
        <span className="bg-surface-container-high px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider text-outline">
          {row.status === "delivered" ? "已送达" : row.status === "failed" ? "失败" : row.status}
        </span>
      </div>

      <div className="bg-surface-card border border-surface-border rounded-lg p-4 hover:border-surface-variant transition-colors shadow-sm">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-surface-container rounded flex items-center justify-center font-mono-label text-mono-label text-on-surface border border-surface-border">
              {code}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-mono-label text-mono-label text-primary">{code}</h3>
                <span className={`bg-${sig.tone}/20 text-${sig.tone} border border-${sig.tone}/30 px-1.5 py-0.5 rounded font-mono-label text-[10px] flex items-center gap-1`}>
                  <Mi name={sig.icon} size={10} />
                  {sig.zh}
                </span>
              </div>
              <div className="font-table-data text-table-data text-on-surface-variant mt-0.5">
                触发 · {row.error ? `失败原因 ${row.error}` : "实时盘中信号"}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono-label text-mono-label text-on-surface mb-0.5">推送状态</div>
            <div className={`font-headline-sm text-headline-sm text-${row.status === "delivered" ? "bull" : "bear"} flex items-center justify-end gap-1`}>
              {row.status === "delivered" ? "已送达" : "未送达"}
              <Mi name={row.status === "delivered" ? "check_circle" : "error"} size={16} className={`text-${row.status === "delivered" ? "bull" : "bear"}`} />
            </div>
          </div>
        </div>

        <div className="bg-surface-container-low rounded border border-breakthrough/20 p-3 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-breakthrough/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center gap-2 mb-2 text-breakthrough">
            <Mi name="auto_awesome" size={16} />
            <span className="font-table-header text-table-header text-on-surface">AI 解释</span>
          </div>
          <div className="font-ai-commentary text-ai-commentary text-on-surface-variant leading-relaxed">
            （AI 解释由飞书卡片同步推送。Web 端历史回查接口当前只回放 push_log；如需完整解释请到飞书 测试 群查看对应时段卡片。）
          </div>
          <div className="border-t border-surface-border/50 pt-2 mt-2">
            <p className="font-caption text-caption text-outline">以上为信息整理，不构成投资建议</p>
          </div>
        </div>
      </div>
    </div>
  );
}
