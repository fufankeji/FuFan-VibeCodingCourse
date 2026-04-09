import { Minimize2, Loader2 } from "lucide-react";
import { useChatStore } from "../../stores/chatStore";
import { useConfigStore } from "../../stores/configStore";
import { useUIStore } from "../../stores/uiStore";
import { formatTokens } from "../../utils/costCalculator";
import { wsService } from "../../services/websocket";
import { useState } from "react";

export default function ContextBar() {
  const { currentSessionId, contextTokens, contextMax, isStreaming } = useChatStore();
  const [showCompact, setShowCompact] = useState(false);
  const [compactHint, setCompactHint] = useState("");

  // Use contextTokens from real-time task_complete events or history estimation
  const displayTokens = contextTokens;
  const pct = contextMax > 0 ? Math.min((displayTokens / contextMax) * 100, 100) : 0;

  const barColor =
    pct > 90
      ? "bg-rose-err"
      : pct > 70
        ? "bg-amber-glow"
        : "bg-emerald-ok";

  const handleCompact = () => {
    // Build the /compact prompt (same as typing it in InputBar)
    const prompt = compactHint.trim()
      ? `/compact ${compactHint.trim()}`
      : "/compact";

    // Add as a user message in chat (so user sees it)
    useChatStore.getState().addUserMessage(prompt);

    // Send via normal send_message flow (same path as InputBar.handleSend)
    const { model, effort, apiKey } = useConfigStore.getState();
    const { runMode } = useUIStore.getState();
    wsService.send("send_message", {
      prompt,
      model,
      effort,
      runMode,
      apiKey: apiKey || undefined,
      sessionId: currentSessionId || undefined,
    });

    // Instant feedback: start streaming lifecycle immediately
    useChatStore.getState().startStreaming();
    useChatStore.getState().setStatusText("正在压缩上下文...");

    setShowCompact(false);
    setCompactHint("");
  };

  return (
    <div className="px-3 py-3 border-t border-white/5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
          上下文
        </span>
        <span className="text-[11px] font-mono text-slate-500">
          {displayTokens > 0 ? formatTokens(displayTokens) : "—"} / {formatTokens(contextMax)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Compact button */}
      {isStreaming ? (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-glow">
          <Loader2 size={11} className="animate-spin" />
          任务进行中...
        </div>
      ) : (
        <button
          onClick={() => setShowCompact(!showCompact)}
          disabled={!currentSessionId}
          className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-amber-glow transition-colors disabled:opacity-40 disabled:hover:text-slate-500"
        >
          <Minimize2 size={11} />
          压缩上下文
        </button>
      )}

      {showCompact && !isStreaming && (
        <div className="mt-2 space-y-2">
          <input
            value={compactHint}
            onChange={(e) => setCompactHint(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCompact(); }}
            placeholder="侧重于...（可选）"
            className="w-full text-xs bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-glow/40"
          />
          <button
            onClick={handleCompact}
            className="w-full text-xs py-1.5 rounded-md bg-[#ca5d3d] hover:bg-amber-glow text-white font-medium transition-colors shadow-sm shadow-[#703123]/30"
          >
            立即压缩
          </button>
        </div>
      )}
    </div>
  );
}
