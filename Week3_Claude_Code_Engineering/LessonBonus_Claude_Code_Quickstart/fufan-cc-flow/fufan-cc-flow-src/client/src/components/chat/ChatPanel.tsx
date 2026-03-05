import { Clock, Plus, Zap } from "lucide-react";
import MessageList from "./MessageList";
import InputBar from "./InputBar";
import { useChatStore } from "../../stores/chatStore";
import { useUIStore } from "../../stores/uiStore";
import { useSystemStore } from "../../stores/systemStore";
import { useClaudeStatus } from "../../hooks/useClaudeStatus";
import SettingsPage from "../../pages/SettingsPage";

export default function ChatPanel() {
  const { currentSessionId, isStreaming, clearMessages, messages } = useChatStore();
  const { setHistoryModalOpen, wsConnected, setSettingsPageOpen, settingsPageOpen, projectPath, setFolderBrowserOpen } = useUIStore();
  const { claudeInfo, authStatus } = useSystemStore();
  const claudeStatus = useClaudeStatus();

  // Use last user message as task title
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const taskTitle = lastUserMsg
    ? lastUserMsg.content.slice(0, 55) + (lastUserMsg.content.length > 55 ? "…" : "")
    : "新对话";

  const handleNewTask = () => {
    if (isStreaming) return;
    clearMessages();
    if (!projectPath) {
      setFolderBrowserOpen(true);
    }
  };

  const handleOpenSettings = () => setSettingsPageOpen(true);

  // Status dot: 3-state
  const dotColor =
    claudeStatus === "ready"         ? "bg-emerald-ok"
    : claudeStatus === "unauthorized" ? "bg-amber-glow"
    : "bg-rose-err";

  const version = authStatus?.version ?? claudeInfo?.version;

  return (
    <main className="flex-1 flex flex-col min-w-0 min-h-0 relative border-r border-white/5">

      {/* ── Task header ── */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 flex-shrink-0 glass-panel">
        {/* Left: title + status */}
        <div className="flex flex-col min-w-0 flex-1 mr-4">
          <h2 className="text-base font-display font-semibold text-white leading-tight truncate">
            {taskTitle}
          </h2>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
            {isStreaming ? (
              <>
                <span className="agent-pulse-ring w-2 h-2 rounded-full bg-emerald-ok flex-shrink-0" />
                <span>Agent Active</span>
              </>
            ) : !wsConnected ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-rose-err" />
                <Zap size={11} className="flex-shrink-0" />
                <span>未连接</span>
              </>
            ) : (
              <button
                onClick={handleOpenSettings}
                className={`flex items-center gap-2 transition-colors hover:opacity-80 ${
                  claudeStatus === "ready"         ? "text-slate-400"
                  : claudeStatus === "unauthorized" ? "text-amber-glow"
                  : "text-rose-err"
                }`}
                title="点击打开设置"
              >
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                <Zap size={11} className="flex-shrink-0" />
                <span>
                  {claudeStatus === "ready"
                    ? <>Claude Code{version && <span className="ml-1 font-mono text-slate-500">v{version}</span>}</>
                    : claudeStatus === "unauthorized"
                      ? "已安装，需授权 →"
                      : "未安装 Claude Code →"
                  }
                </span>
              </button>
            )}
            {currentSessionId && (
              <>
                <span className="text-slate-600">•</span>
                <span className="font-mono text-slate-500">
                  ID: #{currentSessionId.slice(0, 8)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: history + new task */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setHistoryModalOpen(true)}
            className="p-2 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white transition-colors"
            title="历史会话"
          >
            <Clock size={16} />
          </button>
          <button
            onClick={handleNewTask}
            disabled={isStreaming}
            className="flex items-center gap-2 bg-[#ca5d3d] hover:bg-amber-glow text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-lg shadow-[#703123]/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>New Task</span>
          </button>
        </div>
      </header>

      {/* ── Message list ── */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <MessageList />
      </div>

      {/* ── Input bar ── */}
      <InputBar />

      {/* ── Settings overlay — covers only this center panel ── */}
      {settingsPageOpen && <SettingsPage />}
    </main>
  );
}
