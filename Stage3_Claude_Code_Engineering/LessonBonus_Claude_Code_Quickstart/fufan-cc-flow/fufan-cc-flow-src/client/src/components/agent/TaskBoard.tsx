import { useState } from "react";
import {
  Circle, Loader2, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronRight,
} from "lucide-react";
import type { TeamTask } from "../../types/team";
import { useTeamStore } from "../../stores/teamStore";

const STATUS_CONFIG: Record<TeamTask["status"], {
  icon: typeof Circle;
  className: string;
  label: string;
  order: number;
}> = {
  in_progress: { icon: Loader2,       className: "text-amber-glow animate-spin", label: "进行中", order: 0 },
  pending:     { icon: Circle,         className: "text-slate-500",              label: "待处理", order: 1 },
  blocked:     { icon: AlertTriangle,  className: "text-rose-400",              label: "已阻塞", order: 2 },
  completed:   { icon: CheckCircle2,   className: "text-emerald-400",           label: "已完成", order: 3 },
};

const PRIORITY_STYLES: Record<string, string> = {
  high:   "bg-rose-500/10 text-rose-400 border-rose-500/20",
  medium: "bg-amber-glow/10 text-amber-glow border-amber-glow/20",
  low:    "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

export default function TaskBoard({
  tasks,
  teamName,
}: {
  tasks: TeamTask[];
  teamName: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const updateTask = useTeamStore((s) => s.updateTask);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
        <Circle size={20} className="text-slate-600" />
        <span className="text-sm text-slate-500">暂无共享任务</span>
        <span className="text-xs text-slate-600">Team Lead 创建的任务将在此显示</span>
      </div>
    );
  }

  // Sort: in_progress → pending → blocked → completed
  const sorted = [...tasks].sort(
    (a, b) => STATUS_CONFIG[a.status].order - STATUS_CONFIG[b.status].order
  );
  const active = sorted.filter((t) => t.status !== "completed");
  const completed = sorted.filter((t) => t.status === "completed");

  const handleStatusChange = async (task: TeamTask, newStatus: TeamTask["status"]) => {
    await updateTask(teamName, task.id, { status: newStatus });
  };

  return (
    <div className="space-y-1">
      {/* Active tasks */}
      {active.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          expanded={expandedId === task.id}
          onToggle={() => setExpandedId(expandedId === task.id ? null : task.id)}
          onStatusChange={handleStatusChange}
        />
      ))}

      {/* Completed section (collapsible) */}
      {completed.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors w-full"
          >
            {showCompleted ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span>已完成 ({completed.length})</span>
          </button>
          {showCompleted && completed.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              expanded={expandedId === task.id}
              onToggle={() => setExpandedId(expandedId === task.id ? null : task.id)}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  expanded,
  onToggle,
  onStatusChange,
}: {
  task: TeamTask;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (task: TeamTask, status: TeamTask["status"]) => void;
}) {
  const config = STATUS_CONFIG[task.status];
  const Icon = config.icon;
  const isCompleted = task.status === "completed";

  return (
    <div
      className={`rounded-lg border transition-colors ${
        expanded ? "border-white/10" : "border-transparent hover:border-white/5"
      }`}
      style={expanded ? { background: "rgba(255,255,255,0.02)" } : {}}
    >
      {/* Main row */}
      <div
        className="flex items-center gap-2.5 px-3 py-2 cursor-pointer"
        onClick={onToggle}
      >
        <Icon
          size={14}
          className={config.className}
          style={task.status === "in_progress" ? { animationDuration: "1.5s" } : {}}
        />
        <span className={`text-sm flex-1 min-w-0 truncate ${
          isCompleted ? "text-slate-500 line-through decoration-slate-600" : "text-slate-200"
        }`}>
          {task.title}
        </span>
        {task.assignee && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-glow/10 text-purple-glow border border-purple-glow/20 flex-shrink-0">
            {task.assignee}
          </span>
        )}
        {task.priority && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${
            PRIORITY_STYLES[task.priority] ?? ""
          }`}>
            {task.priority}
          </span>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 pt-0 space-y-2">
          {task.description && (
            <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">
              {task.description}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-slate-600">状态切换:</span>
            {(["pending", "in_progress", "completed", "blocked"] as const).map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange(task, s)}
                disabled={task.status === s}
                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                  task.status === s
                    ? "bg-white/10 text-slate-200 border-white/10"
                    : "border-white/5 text-slate-500 hover:text-slate-300 hover:border-white/10"
                }`}
              >
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-600">
            <span>创建: {new Date(task.createdAt).toLocaleString()}</span>
            <span>更新: {new Date(task.updatedAt).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
