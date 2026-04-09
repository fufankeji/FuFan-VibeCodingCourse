import { useState } from "react";
import { Package, ChevronDown, ChevronRight, Info } from "lucide-react";

interface Props {
  tokensBefore: number;
  tokensAfter: number;
  summary?: string;
}

export default function CompactDivider({ tokensBefore, tokensAfter, summary }: Props) {
  const [showTip, setShowTip] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const ratio = tokensBefore > 0 ? Math.round((1 - tokensAfter / tokensBefore) * 100) : 0;

  function fmt(n: number) {
    return n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n);
  }

  return (
    <div className="my-4 flex flex-col items-center gap-1.5 select-none">
      {/* Divider line with icon */}
      <div className="w-full flex items-center gap-3">
        <div className="flex-1 h-px bg-amber-glow/15" />
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-glow/20 bg-amber-glow/5">
          <Package size={11} className="text-amber-glow/70" />
          <span className="text-[11px] text-amber-glow/80 font-medium">上下文已压缩</span>
        </div>
        <div className="flex-1 h-px bg-amber-glow/15" />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-2">
        {tokensBefore > 0 && (
          <span className="text-[10px] font-mono text-slate-500">
            {tokensAfter > 0
              ? `${fmt(tokensBefore)} → ${fmt(tokensAfter)} tokens`
              : `${fmt(tokensBefore)} tokens 已压缩`}
          </span>
        )}
        {ratio > 0 && tokensAfter > 0 && (
          <span className="text-[10px] font-mono text-amber-glow/60">
            (节省 {ratio}%)
          </span>
        )}
        <button
          onClick={() => setShowTip(!showTip)}
          className="text-slate-600 hover:text-slate-400 transition-colors"
        >
          {showTip
            ? <ChevronDown size={11} />
            : <Info size={11} />
          }
        </button>
      </div>

      {/* Explanation tooltip */}
      {showTip && (
        <div className="max-w-xs text-center text-[10px] text-slate-500 leading-relaxed px-4 py-2 rounded-lg bg-white/3 border border-white/5">
          对话历史已被压缩为摘要，早期消息不再包含在上下文中。
          压缩前的完整记录仍可在历史会话中查看。
        </div>
      )}

      {/* Expandable compression summary */}
      {summary && (
        <div className="w-full max-w-md">
          <button
            onClick={() => setShowSummary(!showSummary)}
            className="flex items-center gap-1 mx-auto text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showSummary ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
            <span>查看压缩摘要</span>
          </button>
          {showSummary && (
            <div className="mt-1.5 text-[11px] text-slate-400 leading-relaxed px-4 py-2.5 rounded-lg bg-white/3 border border-white/5 whitespace-pre-wrap">
              {summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
