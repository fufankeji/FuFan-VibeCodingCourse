import { CheckCircle2, Clock, RotateCcw, Coins, BarChart2 } from "lucide-react";
import type { TaskResult } from "../../types/claude";

function fmt(n: number) {
  return n.toLocaleString("zh-CN");
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

interface Props {
  result: TaskResult;
}

export default function TaskResultCard({ result }: Props) {
  const hasCost = result.costUsd !== undefined && result.costUsd > 0;
  const hasDuration = result.durationMs !== undefined;
  const hasTurns = result.numTurns !== undefined;
  const hasTokens = result.inputTokens !== undefined;
  const hasCacheRead = result.cacheReadTokens !== undefined && (result.cacheReadTokens ?? 0) > 0;

  // Rough savings calculation: cache reads cost ~1/10 of input tokens
  const savings = hasCacheRead && result.costUsd
    ? result.costUsd * ((result.cacheReadTokens ?? 0) / ((result.inputTokens ?? 1) + (result.cacheReadTokens ?? 0))) * 0.9
    : 0;

  return (
    <div className="my-3 rounded-xl border border-emerald-ok/20 bg-emerald-ok/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-emerald-ok/10">
        <CheckCircle2 size={14} className="text-emerald-ok flex-shrink-0" />
        <span className="text-xs font-semibold text-emerald-ok">任务完成</span>
      </div>

      {/* Stats grid */}
      <div className="px-4 py-3 flex flex-wrap gap-x-6 gap-y-2">
        {hasDuration && (
          <StatItem
            icon={<Clock size={11} />}
            label="耗时"
            value={fmtDuration(result.durationMs!)}
          />
        )}
        {hasTurns && (
          <StatItem
            icon={<RotateCcw size={11} />}
            label="轮次"
            value={`${result.numTurns}`}
          />
        )}
        {hasCost && (
          <StatItem
            icon={<Coins size={11} />}
            label="花费"
            value={`$${result.costUsd!.toFixed(4)}`}
          />
        )}
        {hasTokens && (
          <StatItem
            icon={<BarChart2 size={11} />}
            label="Token"
            value={`↑${fmt(result.inputTokens!)} ↓${fmt(result.outputTokens ?? 0)}`}
          />
        )}
        {hasCacheRead && (
          <StatItem
            icon={<span className="text-[9px] font-bold">⚡</span>}
            label="缓存命中"
            value={`${fmt(result.cacheReadTokens!)} tokens${savings > 0.0001 ? ` (~节省 $${savings.toFixed(4)})` : ""}`}
            muted
          />
        )}
      </div>
    </div>
  );
}

function StatItem({
  icon,
  label,
  value,
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${muted ? "opacity-60" : ""}`}>
      <span className="text-emerald-ok/60">{icon}</span>
      <span className="text-[11px] text-slate-500">{label}:</span>
      <span className="text-[11px] font-mono text-emerald-ok/90">{value}</span>
    </div>
  );
}
