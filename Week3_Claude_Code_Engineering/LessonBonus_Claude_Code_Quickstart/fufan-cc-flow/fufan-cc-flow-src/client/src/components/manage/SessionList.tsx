import { MessageSquare, Plus, Trash2, Clock } from "lucide-react";
import { useChatStore } from "../../stores/chatStore";
import { useSessionStore } from "../../stores/sessionStore";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小时前`;
  const days = Math.floor(hrs / 24);
  return `${days}天前`;
}

export default function SessionList() {
  const { sessions } = useSessionStore();
  const { currentSessionId, clearMessages } = useChatStore();

  return (
    <div className="flex-1 overflow-y-auto">
      {/* New session */}
      <button
        onClick={() => clearMessages()}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-obsidian-200 hover:bg-obsidian-700/40 transition-colors border-b border-obsidian-700/30"
      >
        <Plus size={14} className="text-amber-glow" />
        <span className="font-medium">新建会话</span>
      </button>

      {/* Session items */}
      {sessions.length === 0 ? (
        <div className="px-3 py-8 text-center">
          <MessageSquare
            size={24}
            className="mx-auto text-obsidian-500 mb-2"
          />
          <p className="text-xs text-obsidian-400">暂无会话</p>
          <p className="text-xs text-obsidian-500 mt-1">
            在下方开始你的第一次对话
          </p>
        </div>
      ) : (
        <div className="py-1">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`group flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-colors ${
                s.id === currentSessionId
                  ? "bg-amber-glow/5 border-l-2 border-amber-glow"
                  : "hover:bg-obsidian-700/30 border-l-2 border-transparent"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  s.id === currentSessionId
                    ? "bg-amber-glow shadow-[0_0_6px] shadow-amber-glow/50"
                    : "bg-obsidian-500"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-obsidian-100 truncate font-medium">
                  {s.name || s.id.slice(0, 12)}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1 text-[11px] text-obsidian-400">
                    <Clock size={10} />
                    {timeAgo(s.updatedAt)}
                  </span>
                  {s.model && (
                    <span className="text-[10px] text-obsidian-500 font-mono">
                      {s.model}
                    </span>
                  )}
                </div>
              </div>
              <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-obsidian-600/50 text-obsidian-400 hover:text-rose-err transition-all">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
