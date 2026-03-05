import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { X, MessageSquare, Plus, Clock, Trash2, Loader2, AlertCircle, RefreshCw, FolderOpen, GitBranch, PenLine, Search, ListChecks } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useChatStore } from "../../stores/chatStore";
import { useSessionStore } from "../../stores/sessionStore";
import { api } from "../../services/api";
import type { Session } from "../../types/session";

/** Extract the last segment of a path (works for both / and \ separators) */
function basename(p: string): string {
  return p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || p;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  return `${Math.floor(hrs / 24)} 天前`;
}

/** Group sessions by date category */
function groupByDate(sessions: Session[]): { label: string; sessions: Session[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: Record<string, Session[]> = {
    "今天": [],
    "昨天": [],
    "最近一周": [],
    "更早": [],
  };

  for (const s of sessions) {
    const d = new Date(s.updatedAt);
    if (d >= today) groups["今天"].push(s);
    else if (d >= yesterday) groups["昨天"].push(s);
    else if (d >= weekAgo) groups["最近一周"].push(s);
    else groups["更早"].push(s);
  }

  return Object.entries(groups)
    .filter(([, list]) => list.length > 0)
    .map(([label, sessions]) => ({ label, sessions }));
}

export default function HistoryModal() {
  const { historyModalOpen, setHistoryModalOpen, projectPath, setProjectPath, setFolderBrowserOpen } = useUIStore();
  const { sessions, loading, setSessions, setLoading, removeSession, updateSessionName } = useSessionStore();
  const { currentSessionId, clearMessages, setSessionId, loadHistoryMessages } = useChatStore();
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchSessions = useCallback(() => {
    setLoading(true);
    setFetchError(null);
    api
      .getSessions(undefined) // Always fetch all sessions (not filtered by project)
      .then((res) => {
        // Filter out empty/unnamed fork sessions (rewind artifacts)
        const sessions = (res.sessions as Session[]).filter((s) => {
          // Keep sessions that have a name, summary, or meaningful message count
          if (s.name || s.summary) return true;
          if (s.messageCount > 0) return true;
          return false;
        });
        setSessions(sessions);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setFetchError(msg);
        setSessions([]);
        setLoading(false);
      });
  }, [setSessions, setLoading]);

  // Fetch sessions every time the modal opens
  useEffect(() => {
    if (!historyModalOpen) return;
    fetchSessions();
  }, [historyModalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectSession = async (session: Session) => {
    // Block switching to a session whose project folder has been deleted
    if (session.projectPath && !session.projectPathValid && session.projectPath !== projectPath) {
      return; // UI already shows the warning — do nothing
    }

    // Auto-switch project folder if the session belongs to a different project
    if (session.projectPath && session.projectPath !== projectPath) {
      setProjectPath(session.projectPath);
      // → triggers: WS reconnect + FileTree refresh + spawn cwd update
    }

    // Clear current messages and set session ID immediately
    clearMessages();
    setSessionId(session.id);
    setHistoryModalOpen(false);

    // Load historical messages from the JSONL file (first page: last 50 messages)
    try {
      const res = await api.getSessionMessages(session.id, { offset: 0, limit: 50 });
      if (res.messages.length > 0) {
        loadHistoryMessages(
          res.messages as Parameters<typeof loadHistoryMessages>[0],
          res.total,
          0
        );
      }
    } catch {
      // Silently ignore — user can still chat in the resumed session
    }
  };

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await api.deleteSession(sessionId);
      removeSession(sessionId);
    } catch {
      /* ignore */
    }
  };

  const startRename = (e: React.MouseEvent, s: Session) => {
    e.stopPropagation();
    setEditingId(s.id);
    setEditValue(s.name || s.summary || "");
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const commitRename = async () => {
    if (!editingId || !editValue.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await api.renameSession(editingId, editValue.trim());
      updateSessionName(editingId, editValue.trim());
    } catch { /* ignore */ }
    setEditingId(null);
  };

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) =>
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.summary && s.summary.toLowerCase().includes(q)) ||
      (s.gitBranch && s.gitBranch.toLowerCase().includes(q)) ||
      (s.model && s.model.toLowerCase().includes(q)) ||
      (s.projectPath && basename(s.projectPath).toLowerCase().includes(q))
    );
  }, [sessions, searchQuery]);

  const isSearching = searchQuery.trim().length > 0;
  const dateGroups = useMemo(() => groupByDate(filteredSessions), [filteredSessions]);

  if (!historyModalOpen) return null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) setHistoryModalOpen(false); }}
    >
      <div className="modal-content glass-panel rounded-2xl w-full max-w-lg flex flex-col shadow-2xl shadow-black/50 max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-glow" />
            <h2 className="text-sm font-semibold text-slate-200 font-display">历史会话</h2>
            {sessions.length > 0 && (
              <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded-full">
                {isSearching ? `${filteredSessions.length}/${sessions.length}` : sessions.length}
              </span>
            )}
          </div>
          <button
            onClick={() => setHistoryModalOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* New session button + Search */}
        <div className="px-4 py-3 border-b border-white/5 flex-shrink-0 space-y-2">
          <button
            onClick={() => { clearMessages(); setSessionId(""); setHistoryModalOpen(false); if (!projectPath) setFolderBrowserOpen(true); }}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-[#ca5d3d] hover:bg-amber-glow text-white font-medium transition-colors shadow-sm shadow-[#703123]/30 text-sm"
          >
            <Plus size={14} />
            新建会话
          </button>
          {sessions.length > 3 && (
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索会话名称、摘要、分支..."
                className="w-full text-xs bg-white/5 border border-white/8 rounded-lg pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-glow/30 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={22} className="text-purple-glow animate-spin mb-3" />
              <p className="text-xs text-slate-500">加载历史会话...</p>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-5">
              <AlertCircle size={26} className="text-rose-err mb-3" />
              <p className="text-sm text-slate-300 mb-1.5">加载失败</p>
              <p className="text-[11px] text-slate-500 mb-4 font-mono break-all">{fetchError}</p>
              <button
                onClick={fetchSessions}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs text-amber-glow border border-amber-glow/25 hover:bg-amber-glow/10 transition-colors"
              >
                <RefreshCw size={12} />
                重新加载
              </button>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <MessageSquare size={28} className="text-slate-500 mb-3" />
              <p className="text-sm text-slate-400 mb-1">暂无历史会话</p>
              <p className="text-xs text-slate-500">
                {projectPath ? "当前项目下还没有会话记录" : "请先在侧栏选择项目文件夹"}
              </p>
            </div>
          ) : filteredSessions.length === 0 && isSearching ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <Search size={24} className="text-slate-500 mb-3" />
              <p className="text-sm text-slate-400 mb-1">未找到匹配的会话</p>
              <p className="text-xs text-slate-500">
                尝试其他关键词，或<button onClick={() => setSearchQuery("")} className="text-amber-glow hover:underline">清除搜索</button>
              </p>
            </div>
          ) : (
            dateGroups.map((group) => (
              <div key={group.label}>
                {/* Date group header */}
                <div className="px-5 pt-3 pb-1.5">
                  <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                    {group.label}
                  </span>
                </div>
                {group.sessions.map((s) => {
                  const folderDeleted = !!(s.projectPath && !s.projectPathValid && s.projectPath !== projectPath);
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectSession(s)}
                      className={`group flex items-start gap-3 mx-2 px-3 py-3 rounded-xl transition-colors ${
                        folderDeleted
                          ? "opacity-50 cursor-not-allowed"
                          : s.id === currentSessionId
                            ? "bg-amber-glow/8 border border-amber-glow/15"
                            : "hover:bg-white/5"
                      }`}
                      title={folderDeleted ? `项目文件夹已不存在: ${s.projectPath}` : undefined}
                    >
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          s.id === currentSessionId ? "bg-amber-glow" : "bg-slate-600"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        {editingId === s.id ? (
                          <input
                            ref={editInputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename();
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-sm font-medium text-slate-200 bg-white/5 border border-amber-glow/30 rounded px-1.5 py-0.5 outline-none focus:border-amber-glow/50"
                          />
                        ) : (
                          <div className="text-sm font-medium text-slate-200 truncate flex items-center gap-1.5">
                            {s.isPlanExecution && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 flex-shrink-0">
                                <ListChecks size={9} />
                                Plan
                              </span>
                            )}
                            {s.name || <span className="text-slate-500 font-mono text-xs">{s.id.slice(0, 20)}…</span>}
                          </div>
                        )}
                        {/* Summary line (from sessions-index.json) */}
                        {s.summary && editingId !== s.id && (
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {s.summary}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[11px] text-slate-500">
                            {timeAgo(s.updatedAt)}
                          </span>
                          {s.model && (
                            <span className="text-[10px] font-mono text-slate-500 bg-white/3 px-1.5 py-0.5 rounded">
                              {s.model}
                            </span>
                          )}
                          {s.gitBranch && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-purple-glow/70 bg-purple-glow/8 px-1.5 py-0.5 rounded">
                              <GitBranch size={9} />
                              {s.gitBranch}
                            </span>
                          )}
                          {s.messageCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500">
                              <MessageSquare size={9} />
                              {s.messageCount}
                            </span>
                          )}
                        </div>
                        {s.projectPath && (
                          <div className="flex items-center gap-1 mt-1">
                            <FolderOpen size={10} className={`flex-shrink-0 ${s.projectPathValid ? "text-slate-500" : "text-rose-err/60"}`} />
                            <span className={`text-[10px] font-mono truncate ${s.projectPathValid ? "text-slate-500" : "text-rose-err/60 line-through"}`}>
                              {basename(s.projectPath)}
                            </span>
                            {!s.projectPathValid ? (
                              <span className="text-[9px] text-rose-err/70 ml-1 flex-shrink-0">
                                文件夹已删除
                              </span>
                            ) : s.projectPath !== projectPath && (
                              <span className="text-[9px] text-amber-glow/70 ml-1 flex-shrink-0">
                                ↗ 将切换到此项目
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => startRename(e, s)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-all flex-shrink-0"
                        title="重命名"
                      >
                        <PenLine size={12} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, s.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-err/10 text-slate-400 hover:text-rose-err transition-all flex-shrink-0"
                        title="删除会话"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
