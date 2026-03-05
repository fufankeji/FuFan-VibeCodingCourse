import { useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import type { TeamMessage } from "../../types/team";

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}秒前`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

export default function TeamMessages({ messages }: { messages: TeamMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
        <MessageSquare size={20} className="text-slate-600" />
        <span className="text-sm text-slate-500">暂无团队消息</span>
        <span className="text-xs text-slate-600">Teammates 之间的消息将在此显示</span>
      </div>
    );
  }

  // Sort by timestamp ascending (oldest first)
  const sorted = [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div className="space-y-2 p-3">
      {sorted.map((msg, i) => (
        <div
          key={`${msg.from}-${msg.timestamp}-${i}`}
          className="rounded-lg p-2.5 border border-white/5"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          {/* Header: sender → receiver + time */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-medium text-purple-glow">{msg.from}</span>
            <span className="text-[10px] text-slate-600">→</span>
            <span className="text-xs text-slate-400">{msg.to}</span>
            <span className="text-[10px] text-slate-600 ml-auto flex-shrink-0">
              {timeAgo(msg.timestamp)}
            </span>
          </div>
          {/* Content */}
          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
            {msg.content}
          </p>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
