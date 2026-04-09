import {
  Clock,
  Check,
  X,
  Square,
  RotateCcw,
  FileText,
  GitBranch,
  Loader2,
  Bot,
} from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}秒前`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}分钟前`;
  return `${Math.floor(mins / 60)}小时前`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function BackgroundTasks() {
  const { backgroundTasks } = useAgentStore();

  const running = backgroundTasks.filter((t) => t.status === "running");
  const finished = backgroundTasks.filter((t) => t.status !== "running");

  if (backgroundTasks.length === 0) {
    return (
      <div className="p-4 text-center">
        <Clock size={20} className="mx-auto text-slate-500 mb-2" />
        <p className="text-xs text-slate-400">暂无后台任务</p>
        <p className="text-[10px] text-slate-500 mt-1">
          使用带有 background: true 的 Agent 时，任务将在此显示
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* Running */}
      {running.length > 0 && (
        <div>
          <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-1.5">
            运行中 ({running.length})
          </div>
          <div className="space-y-1.5">
            {running.map((task) => (
              <div
                key={task.id}
                className="p-2.5 rounded-lg border border-amber-glow/15 bg-amber-glow/5"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Loader2 size={12} className="text-amber-glow animate-spin" />
                    <span className="text-xs font-medium text-slate-200">
                      {task.agentName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-amber-glow">
                      {formatDuration(Date.now() - task.startedAt)}
                    </span>
                    <button
                      className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-rose-err transition-colors"
                      title="终止"
                    >
                      <Square size={10} />
                    </button>
                  </div>
                </div>
                {task.description && (
                  <p className="text-[10px] text-slate-400 pl-5">{task.description}</p>
                )}
                {task.worktree && (
                  <div className="flex items-center gap-1.5 mt-1 pl-5 text-[10px] text-slate-400">
                    <GitBranch size={9} />
                    <span className="font-mono">{task.worktree}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Finished */}
      {finished.length > 0 && (
        <div>
          <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-1.5">
            已完成
          </div>
          <div className="space-y-1.5">
            {finished.map((task) => (
              <div
                key={task.id}
                className={`p-2.5 rounded-lg border ${
                  task.status === "completed"
                    ? "border-emerald-ok/15 bg-emerald-ok/5"
                    : "border-rose-err/15 bg-rose-err/5"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {task.status === "completed" ? (
                      <Check size={12} className="text-emerald-ok" />
                    ) : (
                      <X size={12} className="text-rose-err" />
                    )}
                    <span className="text-xs font-medium text-slate-200">
                      {task.agentName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">
                      {task.completedAt ? timeAgo(task.completedAt) : ""}
                    </span>
                    {task.durationMs && (
                      <span className="text-[10px] font-mono text-slate-400">
                        {formatDuration(task.durationMs)}
                      </span>
                    )}
                    <button className="p-1 rounded hover:bg-white/5 text-slate-400 transition-colors" title="重新运行">
                      <RotateCcw size={10} />
                    </button>
                  </div>
                </div>
                {task.result && (
                  <p className="text-[10px] text-slate-400 pl-5">{task.result}</p>
                )}
                {task.error && (
                  <p className="text-[10px] text-rose-err pl-5">{task.error}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
