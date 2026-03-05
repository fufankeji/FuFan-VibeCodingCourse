import { useEffect, useState } from "react";
import {
  Users, Plus, ArrowLeft, Trash2, Loader2,
  ListChecks, MessageSquare, UserCircle, Terminal,
} from "lucide-react";
import { useTeamStore } from "../../stores/teamStore";
import TeamCreator from "./TeamCreator";
import TeammateCard from "./TeammateCard";
import TaskBoard from "./TaskBoard";
import TeamMessages from "./TeamMessages";

type DetailTab = "tasks" | "messages" | "members";

export default function TeamPanel() {
  const {
    enabled, teams, activeTeam, tasks, messages, loading,
    checkEnabled, loadTeams, loadTeamDetail, loadTasks, loadMessages,
    setActiveTeam, deleteTeam,
  } = useTeamStore();

  const [showCreator, setShowCreator] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("tasks");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Check feature enabled on mount
  useEffect(() => {
    checkEnabled();
  }, [checkEnabled]);

  // Load teams when enabled
  useEffect(() => {
    if (enabled) loadTeams();
  }, [enabled, loadTeams]);

  // Poll tasks + messages when an active team is selected
  useEffect(() => {
    if (!activeTeam) return;
    loadTasks(activeTeam);
    loadMessages(activeTeam, 100);
    loadTeamDetail(activeTeam);

    const interval = setInterval(() => {
      loadTasks(activeTeam);
      loadMessages(activeTeam, 100);
    }, 3000);
    return () => clearInterval(interval);
  }, [activeTeam, loadTasks, loadMessages, loadTeamDetail]);

  // ── Feature not enabled ──
  if (!enabled) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
          <Users size={20} className="text-slate-500" />
        </div>
        <div>
          <div className="text-sm font-medium text-slate-300 mb-1">Agent Teams 未启用</div>
          <div className="text-xs text-slate-500 leading-relaxed mb-3">
            Agent Teams 是实验性功能，需要设置环境变量后重启服务。
          </div>
        </div>
        <div
          className="w-full rounded-lg p-3 text-left border border-white/10"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Terminal size={12} className="text-amber-glow" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">设置步骤</span>
          </div>
          <div className="space-y-1.5 text-xs text-slate-400 font-mono">
            <p className="text-slate-500"># 设置环境变量</p>
            <p className="text-amber-glow select-all">
              export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
            </p>
            <p className="text-slate-500 mt-2"># 或在 Settings 页面中添加到 Claude 环境变量</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Active team detail view ──
  if (activeTeam) {
    const team = teams.find((t) => t.name === activeTeam);

    const DETAIL_TABS: { id: DetailTab; label: string; icon: typeof ListChecks }[] = [
      { id: "tasks",    label: "任务",   icon: ListChecks },
      { id: "messages", label: "消息",   icon: MessageSquare },
      { id: "members",  label: "成员",   icon: UserCircle },
    ];

    const handleDelete = async () => {
      if (!confirmDelete) {
        setConfirmDelete(true);
        return;
      }
      await deleteTeam(activeTeam);
      setConfirmDelete(false);
    };

    return (
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5 flex-shrink-0">
          <button
            onClick={() => { setActiveTeam(null); setConfirmDelete(false); }}
            className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft size={14} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-200 truncate">{activeTeam}</div>
            <div className="text-[10px] text-slate-500">
              {team?.members.length ?? 0} 成员 · {tasks.length} 任务
            </div>
          </div>
          {/* Active indicator */}
          {team?.isActive && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          )}
          <button
            onClick={handleDelete}
            className={`p-1.5 rounded text-xs transition-colors flex-shrink-0 ${
              confirmDelete
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                : "hover:bg-white/5 text-slate-500 hover:text-rose-400"
            }`}
            title={confirmDelete ? "确认删除" : "删除 Team"}
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* Detail sub-tabs */}
        <div className="flex gap-0 border-b border-white/5 flex-shrink-0 px-2">
          {DETAIL_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setDetailTab(id)}
              className={`flex items-center gap-1 px-2.5 py-2 text-xs font-medium transition-all border-b-2 -mb-px ${
                detailTab === id ? "tab-active" : "tab-inactive"
              }`}
            >
              <Icon size={11} />
              {label}
              {id === "tasks" && tasks.length > 0 && (
                <span className="ml-0.5 text-[9px] text-slate-500">({tasks.length})</span>
              )}
              {id === "messages" && messages.length > 0 && (
                <span className="ml-0.5 text-[9px] text-slate-500">({messages.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Detail content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {detailTab === "tasks" && (
            <div className="p-2">
              <TaskBoard tasks={tasks} teamName={activeTeam} />
            </div>
          )}
          {detailTab === "messages" && (
            <TeamMessages messages={messages} />
          )}
          {detailTab === "members" && (
            <div className="p-3 space-y-2">
              {(team?.members ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                  <UserCircle size={20} className="text-slate-600" />
                  <span className="text-sm text-slate-500">暂无成员</span>
                  <span className="text-xs text-slate-600">成员将在 Agent 加入 Team 后自动显示</span>
                </div>
              ) : (
                (team?.members ?? []).map((m) => (
                  <TeammateCard key={m.name} member={m} />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Creator form ──
  if (showCreator) {
    return <TeamCreator onDone={() => setShowCreator(false)} />;
  }

  // ── Team list (or empty state) ──
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header with create button */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5 flex-shrink-0">
        <span className="text-xs font-medium text-slate-400">Agent Teams</span>
        <button
          onClick={() => setShowCreator(true)}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs
                     bg-amber-glow/10 text-amber-glow border border-amber-glow/20
                     hover:bg-amber-glow/20 transition-colors"
        >
          <Plus size={11} />
          创建 Team
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={18} className="text-slate-500 animate-spin" />
          </div>
        ) : teams.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
              <Users size={20} className="text-slate-500" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-300 mb-1">尚未创建 Team</div>
              <div className="text-xs text-slate-500 leading-relaxed">
                Agent Teams 允许多个 Agent 通过共享任务列表<br />和邮箱系统自主协作完成复杂任务。
              </div>
            </div>
            <button
              onClick={() => setShowCreator(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                         bg-[#ca5d3d] hover:bg-amber-glow text-white transition-colors"
            >
              <Plus size={14} />
              创建第一个 Team
            </button>
          </div>
        ) : (
          /* Team list */
          <div className="p-3 space-y-2">
            {teams.map((team) => (
              <button
                key={team.name}
                onClick={() => setActiveTeam(team.name)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-white/5
                           hover:border-white/10 transition-colors text-left"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  team.isActive ? "bg-emerald-400/15 text-emerald-400" : "bg-white/5 text-slate-500"
                }`}>
                  <Users size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200 truncate">{team.name}</div>
                  <div className="text-[10px] text-slate-500">
                    {team.members.length} 成员 · {team.tasks.length} 任务
                  </div>
                </div>
                {team.isActive && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
