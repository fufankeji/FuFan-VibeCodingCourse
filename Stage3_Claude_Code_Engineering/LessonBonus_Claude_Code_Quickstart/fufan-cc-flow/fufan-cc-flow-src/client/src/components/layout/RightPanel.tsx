import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, Activity, Puzzle, Bot,
  TerminalSquare, Plus, X, Maximize2, Minimize2, ChevronDown, ChevronUp,
  CheckCircle2, Loader2, Clock, BarChart2, Coins, RotateCcw, ListChecks, Wrench,
  Plug, Zap, Package, Brain, Webhook,
} from "lucide-react";
import { useUIStore, type RightSidebarTab } from "../../stores/uiStore";
import McpManager from "../manage/McpManager";
import SkillsManager from "../manage/SkillsManager";
import PluginManager from "../manage/PluginManager";
import MemoryManager from "../manage/MemoryManager";
import HooksManager from "../manage/HooksManager";
import AgentManager from "../agent/AgentManager";
import SubAgentTree from "../agent/SubAgentTree";
import BackgroundTasks from "../agent/BackgroundTasks";
import WorkflowManager from "../agent/WorkflowManager";
import TeamPanel from "../agent/TeamPanel";
import { useAgentStore } from "../../stores/agentStore";
import { useChatStore } from "../../stores/chatStore";
import type { ToolCall, TaskResult } from "../../types/claude";
import XTerminal from "../shared/XTerminal";

/* ── Tab config ── */
const TABS: { id: RightSidebarTab; label: string; icon: typeof Activity }[] = [
  { id: "monitor",    label: "Live Monitor", icon: Activity },
  { id: "extensions", label: "拓展",          icon: Puzzle },
  { id: "agent",      label: "Agent",         icon: Bot },
];

/* ── Terminal tab type ── */
interface TerminalTab {
  id: string;
  label: string;
}

export default function RightPanel() {
  const {
    rightPanelOpen, setRightPanelOpen,
    rightPanelWidth, setRightPanelWidth,
    rightSidebarTab, setRightSidebarTab,
    terminalOpen, terminalHeight, toggleTerminal, setTerminalHeight,
    projectPath,
  } = useUIStore();

  const isDragging     = useRef(false);
  const [termMaximized, setTermMaximized] = useState(false);

  /* ── Drag resize (left edge) ── */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      const startX = e.clientX;
      const startW = rightPanelWidth;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = startX - ev.clientX; // drag left → wider
        setRightPanelWidth(Math.min(800, Math.max(300, startW + delta)));
      };
      const onMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [rightPanelWidth, setRightPanelWidth]
  );

  /* ── Collapsed state ── */
  if (!rightPanelOpen) {
    return (
      <button
        onClick={() => setRightPanelOpen(true)}
        className="w-7 flex-shrink-0 flex items-center justify-center border-l border-white/5
                   text-slate-500 hover:text-amber-glow transition-all z-10 group relative"
        style={{ background: "rgba(30, 27, 46, 0.5)" }}
        title="展开右侧栏"
      >
        {/* 左边缘 amber 高亮线 */}
        <div className="absolute inset-y-[25%] left-0 w-0.5 rounded-r-full
                        bg-amber-glow/0 group-hover:bg-amber-glow/50 transition-all duration-200" />
        <ChevronLeft size={13} />
      </button>
    );
  }

  return (
    <aside
      className="flex-shrink-0 relative overflow-hidden panel-transition z-10"
      style={{
        width: rightPanelWidth, minWidth: 300, maxWidth: 800,
        background: "rgba(30, 27, 46, 0.5)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* ── Drag handle — absolute overlay on left edge (no layout gap) ── */}
      <div
        className="absolute inset-y-0 left-0 w-[5px] cursor-ew-resize z-20 hover:bg-white/5 transition-colors"
        onMouseDown={handleMouseDown}
      />

      {/* ── Main content with left border ── */}
      <div className="flex flex-col h-full border-l border-white/5">

        {/* ── Tab bar (hidden when terminal is maximized) ── */}
        {!termMaximized && (
          <div className="flex items-center gap-0 px-3 border-b border-white/5 flex-shrink-0 pt-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setRightSidebarTab(id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                  rightSidebarTab === id
                    ? "tab-active"
                    : "tab-inactive"
                }`}
              >
                <Icon size={13} />
                <span>{label}</span>
              </button>
            ))}

            {/* Collapse button */}
            <button
              onClick={() => setRightPanelOpen(false)}
              className="ml-auto p-1.5 rounded-md hover:bg-amber-glow/10 text-slate-400 hover:text-amber-glow transition-all"
              title="收起右侧栏"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* ── Tab content (hidden when terminal is maximized) ── */}
        {!termMaximized && (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {rightSidebarTab === "monitor"    && <LiveMonitorPanel />}
            {rightSidebarTab === "extensions" && <ExtensionsPanel />}
            {rightSidebarTab === "agent"      && <AgentPanel />}
          </div>
        )}

        {/* ── Embedded terminal (always rendered; manages its own collapsed/open state) ── */}
        <EmbeddedTerminal
          projectPath={projectPath}
          terminalHeight={terminalHeight}
          setTerminalHeight={setTerminalHeight}
          toggleTerminal={toggleTerminal}
          terminalOpen={terminalOpen}
          maximized={termMaximized}
          setMaximized={setTermMaximized}
        />
      </div>
    </aside>
  );
}

/* ════════════════════════════════════════════
   Live Monitor Panel  (D13 + D14)
   ════════════════════════════════════════════ */

// Context max is now dynamic from chatStore (model-dependent)

function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function fmtNum(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n);
}

/** Extract a concise detail string from tool input for LiveMonitor display */
function getTaskDetail(name: string, input?: Record<string, unknown>): string {
  if (!input) return "";
  switch (name) {
    case "Read": return String(input.file_path || "");
    case "Edit":
    case "Write": return String(input.file_path || "");
    case "Bash": return String(input.description || input.command || "").slice(0, 80);
    case "Glob": return String(input.pattern || "");
    case "Grep": return input.path ? `"${input.pattern}" in ${input.path}` : `"${input.pattern}"`;
    case "Task":
    case "Agent": return String(input.description || input.prompt || "").slice(0, 60);
    case "WebFetch": return String(input.url || "").replace(/^https?:\/\//, "");
    case "WebSearch": return String(input.query || "");
    case "TodoWrite": return `${Array.isArray(input.todos) ? input.todos.length : "?"} 项任务`;
    case "TaskCreate": return String(input.subject || "");
    case "TaskUpdate": return `#${input.taskId} → ${input.status}`;
    default: {
      const v = Object.values(input).find((val) => typeof val === "string") as string | undefined;
      return v?.slice(0, 60) || "";
    }
  }
}

/* ── Plan task types & extraction ── */

interface PlanTask {
  id: string;
  subject: string;
  activeForm?: string;
  status: "pending" | "in_progress" | "completed" | "deleted";
}

interface PlanState {
  tasks: PlanTask[];
  hasPlan: boolean;
  completedCount: number;
  totalCount: number;
  progressPct: number;
}

function extractPlanState(toolCalls: ToolCall[]): PlanState {
  const tasks: PlanTask[] = [];
  for (const tc of toolCalls) {
    if (tc.toolName === "TaskCreate" && tc.status === "done") {
      const idMatch = tc.result?.match(/Task #(\d+)/);
      const taskId = idMatch ? idMatch[1] : `auto_${tasks.length + 1}`;
      const input = tc.toolInput || {};
      tasks.push({
        id: taskId,
        subject: String(input.subject || "未命名任务"),
        activeForm: input.activeForm ? String(input.activeForm) : undefined,
        status: "pending",
      });
    } else if (tc.toolName === "TaskUpdate" && tc.status === "done") {
      const input = tc.toolInput || {};
      const targetId = String(input.taskId || "");
      const newStatus = input.status as PlanTask["status"] | undefined;
      const task = tasks.find((t) => t.id === targetId);
      if (task && newStatus) task.status = newStatus;
    }
  }
  const visible = tasks.filter((t) => t.status !== "deleted");
  const completedCount = visible.filter((t) => t.status === "completed").length;
  const totalCount = visible.length;
  return {
    tasks: visible,
    hasPlan: visible.length > 0,
    completedCount,
    totalCount,
    progressPct: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
  };
}

interface TaskSegment {
  goal: string;
  toolCalls: ToolCall[];
  planState: PlanState;
  taskResult?: TaskResult;
}

function getTaskSegments(activeMessages: { role: string; content: string; toolCalls?: ToolCall[]; taskResult?: TaskResult }[]): TaskSegment[] {
  const segments: TaskSegment[] = [];
  let currentGoal = "";
  let currentToolCalls: ToolCall[] = [];
  let currentTaskResult: TaskResult | undefined;

  for (const msg of activeMessages) {
    if (msg.role === "user") {
      // Save previous segment if it has content
      if (currentGoal && (currentToolCalls.length > 0 || currentTaskResult)) {
        segments.push({
          goal: currentGoal,
          toolCalls: currentToolCalls,
          planState: extractPlanState(currentToolCalls),
          taskResult: currentTaskResult,
        });
      }
      currentGoal = msg.content?.slice(0, 120) || "";
      currentToolCalls = [];
      currentTaskResult = undefined;
    } else if (msg.role === "assistant") {
      if (msg.toolCalls) currentToolCalls.push(...msg.toolCalls);
      if (msg.taskResult) currentTaskResult = msg.taskResult;
    }
  }
  // Push final segment
  if (currentGoal && (currentToolCalls.length > 0 || currentTaskResult)) {
    segments.push({
      goal: currentGoal,
      toolCalls: currentToolCalls,
      planState: extractPlanState(currentToolCalls),
      taskResult: currentTaskResult,
    });
  }
  return segments;
}

function LiveMonitorPanel() {
  const { messages, isStreaming, streamingStartedAt, contextTokens, contextMax, totalCost, totalUsage } = useChatStore();

  // Elapsed timer — tick every second while streaming
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isStreaming || !streamingStartedAt) { setElapsed(0); return; }
    const tick = () => setElapsed(Date.now() - streamingStartedAt);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isStreaming, streamingStartedAt]);

  // Filter out rolled-back messages so Live Monitor doesn't show stale data
  const activeMessages = messages.filter((m) => !m.rolledBack);

  // All tool calls
  const allToolCalls = activeMessages.flatMap((m) => m.toolCalls ?? []);
  const lastUserMsg = [...activeMessages].reverse().find((m) => m.role === "user");
  const currentGoal = lastUserMsg?.content?.slice(0, 120) ?? null;

  // Current task tool calls: only from messages after the last user message
  const lastUserIdx = activeMessages.reduce((acc, m, i) => (m.role === "user" ? i : acc), -1);
  const currentTaskMessages = lastUserIdx >= 0 ? activeMessages.slice(lastUserIdx + 1) : [];
  const currentToolCalls = currentTaskMessages.flatMap((m) => m.toolCalls ?? []);

  const total = currentToolCalls.length;

  // Plan state for current task (Active mode)
  const currentPlanState = extractPlanState(currentToolCalls);

  // Check if TaskCreate is currently running (planning shimmer)
  const isPlanning = currentToolCalls.some((tc) => tc.toolName === "TaskCreate" && tc.status === "running");

  // Task segments for Idle carousel
  const taskSegments = getTaskSegments(activeMessages);

  // Last task result for empty-state check
  const lastTaskResult = activeMessages.reduce<TaskResult | undefined>(
    (acc, m) => (m.role === "assistant" && m.taskResult ? m.taskResult : acc), undefined
  );

  // Context gauge color
  const ctxPct = contextTokens > 0 ? Math.min(100, Math.round(contextTokens / contextMax * 100)) : 0;
  const ctxColor = ctxPct >= 85 ? "#f43f5e" : ctxPct >= 60 ? "#d97757" : "#10b981";

  // ── Idle / empty state (no tool calls AND no task result) ──
  if (!isStreaming && allToolCalls.length === 0 && !lastTaskResult) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
          <Activity size={20} className="text-slate-500" />
        </div>
        <div>
          <div className="text-sm font-medium text-slate-300 mb-1">无活跃任务</div>
          <div className="text-xs text-slate-500 leading-relaxed">
            执行任务后，当前目标<br />和工具调用详情将在此显示
          </div>
        </div>
      </div>
    );
  }

  // ── Idle with session summary (D14) — has tool calls OR task result ──
  if (!isStreaming && (allToolCalls.length > 0 || lastTaskResult)) {
    return <IdleSummaryPanel
      taskSegments={taskSegments}
      totalCost={totalCost}
      totalUsage={totalUsage}
    />;
  }

  // ── Active / streaming state (D13) ──
  return (
    <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
      {/* Header card: Goal + metrics + plan/tool progress */}
      {currentGoal && (
        <div className="p-4 border-b border-white/5 flex-shrink-0" style={{ background: "rgba(30,27,46,0.7)" }}>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Goal</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20">
              IN PROGRESS
            </span>
          </div>
          <p className="text-sm font-medium text-white leading-snug line-clamp-2">{currentGoal}</p>

          {/* Elapsed + progress indicator */}
          <div className="flex items-center justify-between mt-2.5 mb-1">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <Clock size={9} />
              <span>{fmtElapsed(elapsed)}</span>
            </div>
            {currentPlanState.hasPlan ? (
              <span className="text-[10px] text-slate-500">
                计划进度 {currentPlanState.completedCount}/{currentPlanState.totalCount}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                <Wrench size={9} />
                {total} 工具调用
              </span>
            )}
          </div>

          {/* Plan progress bar (only when plan exists) */}
          {currentPlanState.hasPlan && (
            <div className="h-1 w-full rounded-full overflow-hidden mb-3" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(currentPlanState.progressPct, 5)}%`,
                  background: "linear-gradient(90deg, #d97757 0%, #7c3aed 100%)",
                }}
              />
            </div>
          )}

          {/* Context usage gauge */}
          {contextTokens > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500">Context 用量</span>
                <span className="text-[10px] font-mono" style={{ color: ctxColor }}>
                  {fmtNum(contextTokens)} / {fmtNum(contextMax)} ({ctxPct}%)
                </span>
              </div>
              <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${ctxPct}%`, background: ctxColor }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Plan checklist section */}
      {(currentPlanState.hasPlan || isPlanning) && (
        <div className="p-3 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-1.5 mb-2">
            <ListChecks size={12} className="text-purple-glow" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">执行计划</span>
          </div>
          {isPlanning && !currentPlanState.hasPlan ? (
            <div className="flex items-center gap-2 py-2">
              <div className="h-2 flex-1 rounded-full overflow-hidden bg-white/5">
                <div className="h-full w-1/3 rounded-full bg-purple-glow/40 animate-pulse" />
              </div>
              <span className="text-[10px] text-slate-500">正在规划...</span>
            </div>
          ) : (
            <PlanChecklist tasks={currentPlanState.tasks} />
          )}
        </div>
      )}

      {/* Active tool list (focused) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <ActiveToolList toolCalls={currentToolCalls} />
      </div>
    </div>
  );
}

/* ── Idle Summary with Task Segment Carousel ── */
function IdleSummaryPanel({
  taskSegments,
  totalCost,
  totalUsage,
}: {
  taskSegments: TaskSegment[];
  totalCost: number;
  totalUsage: { inputTokens: number; outputTokens: number };
}) {
  const count = taskSegments.length;
  const [viewIndex, setViewIndex] = useState(Math.max(0, count - 1));
  useEffect(() => { setViewIndex(Math.max(0, count - 1)); }, [count]);

  const hasPrev = viewIndex > 0;
  const hasNext = viewIndex < count - 1;
  const seg = taskSegments[viewIndex];

  // Fallback: if no segments (edge case), show minimal
  if (!seg) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-slate-500">无任务记录</div>
    );
  }

  const segToolCount = seg.toolCalls.length;
  const segRecentTools = [...seg.toolCalls].reverse().slice(0, 20);

  return (
    <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
      {/* Summary card with carousel */}
      <div className="p-4 border-b border-white/5 flex-shrink-0" style={{ background: "rgba(30,27,46,0.7)" }}>
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 size={13} className="text-emerald-ok" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex-1">
            任务摘要
          </span>
          {/* Carousel controls */}
          {count > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => hasPrev && setViewIndex(viewIndex - 1)}
                disabled={!hasPrev}
                className="p-0.5 rounded hover:bg-white/10 text-slate-400 disabled:opacity-20 transition-colors"
              >
                <ChevronLeft size={12} />
              </button>
              <span className="text-[10px] font-mono text-slate-500 min-w-[3ch] text-center">
                {viewIndex + 1}/{count}
              </span>
              <button
                onClick={() => hasNext && setViewIndex(viewIndex + 1)}
                disabled={!hasNext}
                className="p-0.5 rounded hover:bg-white/10 text-slate-400 disabled:opacity-20 transition-colors"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Goal */}
        {seg.goal && (
          <p className="text-xs text-slate-300 mb-3 leading-snug line-clamp-2">{seg.goal}</p>
        )}

        {/* Plan checklist (compact, if present) */}
        {seg.planState.hasPlan && (
          <div className="mb-3 p-2 rounded-lg border border-white/5" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <ListChecks size={10} className="text-purple-glow" />
              <span className="text-[10px] text-slate-500">
                计划 {seg.planState.completedCount}/{seg.planState.totalCount}
              </span>
            </div>
            <PlanChecklist tasks={seg.planState.tasks} compact />
          </div>
        )}

        {/* Stats grid (scoped to this segment) */}
        <div className="grid grid-cols-2 gap-2">
          <SummaryItem icon={<RotateCcw size={10} />} label="工具调用" value={`${segToolCount} 次`} />
          {seg.taskResult?.durationMs && (
            <SummaryItem icon={<Clock size={10} />} label="耗时" value={fmtElapsed(seg.taskResult.durationMs)} />
          )}
          {(totalCost > 0) && (
            <SummaryItem icon={<Coins size={10} />} label="累计花费" value={`$${totalCost.toFixed(4)}`} />
          )}
          {totalUsage.inputTokens > 0 && (
            <SummaryItem icon={<BarChart2 size={10} />} label="Token" value={`${fmtNum(totalUsage.inputTokens + totalUsage.outputTokens)}`} />
          )}
        </div>
      </div>

      {/* Tool calls scoped to this segment */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {segRecentTools.map((tc, i) => (
          <TaskItem key={tc.id ?? i} name={tc.toolName} status={tc.status} input={tc.toolInput} />
        ))}
      </div>
    </div>
  );
}

function SummaryItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white/3 border border-white/5">
      <span className="text-slate-500">{icon}</span>
      <span className="text-[10px] text-slate-500">{label}</span>
      <span className="text-[10px] font-mono text-slate-200 ml-auto">{value}</span>
    </div>
  );
}

/* ── Plan Checklist (renders PlanTask list with status indicators) ── */
function PlanChecklist({ tasks, compact }: { tasks: PlanTask[]; compact?: boolean }) {
  if (tasks.length === 0) return null;
  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      {tasks.map((t) => (
        <div key={t.id} className={`flex items-start gap-2 ${compact ? "py-0.5" : "py-1"} ${
          t.status === "in_progress" ? "pl-2 border-l-2 border-amber-glow/60" : ""
        }`}>
          {/* Status icon */}
          <div className="flex-shrink-0 mt-0.5">
            {t.status === "completed" ? (
              <CheckCircle2 size={compact ? 11 : 13} className="text-emerald-ok" />
            ) : t.status === "in_progress" ? (
              <Loader2 size={compact ? 11 : 13} className="text-amber-glow animate-spin" style={{ animationDuration: "1.5s" }} />
            ) : (
              <div className={`${compact ? "w-[11px] h-[11px]" : "w-[13px] h-[13px]"} rounded-full border border-slate-600`} />
            )}
          </div>
          {/* Text */}
          <div className="flex-1 min-w-0">
            <span className={`${compact ? "text-[10px]" : "text-xs"} leading-snug ${
              t.status === "completed" ? "text-slate-500 line-through decoration-slate-600" :
              t.status === "in_progress" ? "text-white" :
              "text-slate-400"
            }`}>
              {t.subject}
            </span>
            {!compact && t.status === "in_progress" && t.activeForm && (
              <div className="text-[10px] text-amber-glow/70 mt-0.5 truncate">{t.activeForm}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Active Tool List (all current-task tools as a growing list, newest at top) ── */
function ActiveToolList({ toolCalls }: { toolCalls: ToolCall[] }) {
  if (toolCalls.length === 0) return null;
  // Show all tools in reverse order (newest first) — running/awaiting at top, done below
  const display = [...toolCalls].reverse();
  return (
    <div className="space-y-2">
      {display.map((tc, i) => (
        <TaskItem key={tc.id ?? i} name={tc.toolName} status={tc.status} input={tc.toolInput} />
      ))}
    </div>
  );
}

function TaskItem({
  name, status, input,
}: {
  name: string;
  status: "pending" | "running" | "done" | "error" | "awaiting_permission";
  input?: Record<string, unknown>;
}) {
  const isDone    = status === "done";
  const isRunning = status === "running";
  const isError   = status === "error";

  // Extract a concise detail from input using tool-aware logic
  const detail = getTaskDetail(name, input) || undefined;

  return (
    <div className={`flex gap-3 items-start relative ${!isDone && !isRunning && !isError ? "opacity-50" : ""}`}>
      {/* State indicator */}
      <div className="flex-shrink-0 mt-0.5">
        {isDone ? (
          <div className="w-5 h-5 rounded-full bg-emerald-ok/20 border border-emerald-ok/30 flex items-center justify-center">
            <CheckCircle2 size={11} className="text-emerald-ok" />
          </div>
        ) : isError ? (
          <div className="w-5 h-5 rounded-full bg-rose-err/20 border border-rose-err/30 flex items-center justify-center">
            <X size={11} className="text-rose-err" />
          </div>
        ) : (
          <div className="w-5 h-5 flex items-center justify-center">
            <Loader2 size={14} className="text-amber-glow animate-spin" style={{ animationDuration: "1.5s" }} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`flex flex-col gap-0.5 flex-1 min-w-0 ${
        isRunning
          ? "p-2.5 rounded-lg border border-white/5 relative overflow-hidden"
          : ""
      }`} style={isRunning ? { background: "rgba(255,255,255,0.03)" } : {}}>
        {/* Running: left accent line */}
        {isRunning && (
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-glow rounded-l" />
        )}
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-mono truncate ${
            isDone ? "text-slate-400 line-through decoration-slate-600" :
            isError ? "text-rose-err" :
            "text-white font-medium"
          }`}>
            {name}
          </span>
          {isRunning && (
            <span className="text-[10px] text-amber-glow bg-amber-glow/10 px-1.5 py-0.5 rounded flex-shrink-0">
              Running
            </span>
          )}
        </div>
        {detail && (
          <span className="text-[10px] text-slate-500 font-mono truncate">
            {detail.slice(0, 60)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Extensions Panel (5 sub-tabs)
   ════════════════════════════════════════════ */
type ExtTab = "mcp" | "skills" | "plugins" | "memory" | "hooks";
const EXT_TABS: { id: ExtTab; label: string; icon: typeof Plug }[] = [
  { id: "mcp",     label: "MCP",    icon: Plug },
  { id: "skills",  label: "Skills", icon: Zap },
  { id: "plugins", label: "插件",    icon: Package },
  { id: "memory",  label: "Memory", icon: Brain },
  { id: "hooks",   label: "Hooks",  icon: Webhook },
];

function ExtensionsPanel() {
  const { extensionsSubTab: tab, setExtensionsSubTab: setTab } = useUIStore();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Sub-tab bar — compact with icons */}
      <div className="flex gap-0 border-b border-white/5 flex-shrink-0 px-2">
        {EXT_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1 px-2 py-2 text-xs font-medium transition-all border-b-2 -mb-px ${
              tab === id ? "tab-active" : "tab-inactive"
            }`}
          >
            <Icon size={11} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === "mcp"     && <McpManager />}
        {tab === "skills"  && <SkillsManager />}
        {tab === "plugins" && <PluginManager />}
        {tab === "memory"  && <MemoryManager />}
        {tab === "hooks"   && <HooksManager />}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Agent Panel
   ════════════════════════════════════════════ */
type AgentTab = "manager" | "tree" | "tasks" | "workflows" | "teams";
const AGENT_TABS: { id: AgentTab; label: string }[] = [
  { id: "manager",   label: "Agent 管理" },
  { id: "tree",      label: "执行树" },
  { id: "tasks",     label: "后台任务" },
  { id: "workflows", label: "工作流" },
  { id: "teams",     label: "Teams" },
];

function AgentPanel() {
  const [tab, setTab] = useState<AgentTab>("manager");
  const runningTaskCount = useAgentStore((s) => s.backgroundTasks.filter((t) => t.status === "running").length);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Sub-tab bar */}
      <div className="flex gap-0 border-b border-white/5 flex-shrink-0 px-3">
        {AGENT_TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3 py-2 text-xs font-medium transition-all border-b-2 -mb-px flex items-center gap-1 ${
              tab === id ? "tab-active" : "tab-inactive"
            }`}
          >
            {label}
            {id === "tasks" && runningTaskCount > 0 && (
              <span className="ml-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-amber-glow/20 text-amber-glow text-[9px] font-bold px-1">
                {runningTaskCount}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === "manager"   && <AgentManager />}
        {tab === "tree"      && <SubAgentTree />}
        {tab === "tasks"     && <BackgroundTasks />}
        {tab === "workflows" && <WorkflowManager />}
        {tab === "teams"     && <TeamPanel />}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Embedded Terminal  (xterm.js + node-pty, unified header)
   ════════════════════════════════════════════ */
function EmbeddedTerminal({
  projectPath,
  terminalHeight,
  setTerminalHeight,
  toggleTerminal,
  terminalOpen,
  maximized,
  setMaximized,
}: {
  projectPath: string;
  terminalHeight: number;
  setTerminalHeight: (h: number) => void;
  toggleTerminal: () => void;
  terminalOpen: boolean;
  maximized: boolean;
  setMaximized: (v: boolean) => void;
}) {
  // Stable initial tab ID — never changes across re-renders
  const initId = useRef(`term_${Date.now()}`);
  const tabCountRef = useRef(1);
  const [tabs, setTabs] = useState<TerminalTab[]>([{ id: initId.current, label: "终端 1" }]);
  const [activeTab, setActiveTab] = useState<string | null>(initId.current);

  const createTab = () => {
    if (tabs.length >= 5) return;
    tabCountRef.current += 1;
    const id = `term_${Date.now()}`;
    setTabs((prev) => [...prev, { id, label: `终端 ${tabCountRef.current}` }]);
    setActiveTab(id);
  };

  const closeTab = (id: string) => {
    const remaining = tabs.filter((t) => t.id !== id);
    setTabs(remaining);
    if (remaining.length === 0) {
      setActiveTab(null);
      if (maximized) setMaximized(false);
      toggleTerminal();
    } else if (activeTab === id) {
      setActiveTab(remaining[remaining.length - 1]?.id ?? null);
    }
  };

  /* Vertical drag resize (only available when not maximized) */
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = terminalHeight;
    const onMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      setTerminalHeight(Math.max(120, Math.min(600, startH + delta)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  /* ── Collapsed state: single minimal row ── */
  if (!terminalOpen) {
    return (
      <div
        className="flex-shrink-0 border-t border-white/5 flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-white/5 transition-colors select-none"
        onClick={toggleTerminal}
        title="展开终端"
      >
        <TerminalSquare size={13} className="text-slate-400 flex-shrink-0" />
        <span className="text-xs text-slate-400 flex-1">终端</span>
        <ChevronUp size={13} className="text-slate-400" />
      </div>
    );
  }

  /*
   * Open state.
   * When maximized: flex-1 fills all available vertical space in RightPanel
   *   (the top tab bar + content area are hidden by RightPanel when maximized=true).
   * When not maximized: fixed pixel height with drag-resize handle.
   * No absolute positioning — the drag handle for panel-width resize remains accessible.
   */
  return (
    <div
      className={`flex flex-col border-t border-white/5 ${
        maximized ? "flex-1 min-h-0" : "flex-shrink-0"
      }`}
      style={{ height: maximized ? undefined : terminalHeight, background: "#0f0e13" }}
    >
      {/* Drag-resize handle (top edge, only when not maximized) */}
      {!maximized && (
        <div
          onMouseDown={handleResizeMouseDown}
          className="h-1 cursor-ns-resize hover:bg-amber-glow/20 transition-colors flex-shrink-0"
        />
      )}

      {/* ── Unified single-row header: icon + tabs + controls ── */}
      <div
        className="flex items-center border-b border-white/5 flex-shrink-0 px-2 py-1 gap-1"
        style={{ background: "rgba(255,255,255,0.03)" }}
      >
        {/* Terminal icon — click to collapse */}
        <button
          onClick={toggleTerminal}
          className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
          title="收起终端"
        >
          <TerminalSquare size={12} />
        </button>

        {/* Tab list */}
        <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group flex items-center gap-1.5 px-2 py-1 text-xs rounded whitespace-nowrap transition-colors ${
                tab.id === activeTab
                  ? "text-amber-glow bg-black/40"
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
              }`}
            >
              {tab.label}
              <X
                size={9}
                className="opacity-0 group-hover:opacity-100 hover:text-rose-err flex-shrink-0"
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              />
            </button>
          ))}
        </div>

        {/* Right controls: new tab · maximize/restore · collapse */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={createTab}
            disabled={tabs.length >= 5}
            className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
            title="新建终端"
          >
            <Plus size={12} />
          </button>
          <button
            onClick={() => setMaximized(!maximized)}
            className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors"
            title={maximized ? "还原" : "最大化"}
          >
            {maximized ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>
          <button
            onClick={() => { if (maximized) setMaximized(false); toggleTerminal(); }}
            className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors"
            title="收起终端"
          >
            <ChevronDown size={12} />
          </button>
        </div>
      </div>

      {/*
       * Terminal render area.
       * position:relative → containing block for the absolute inner wrapper.
       * Only ONE XTerminal renders at a time (key=activeTab).
       */}
      <div className="flex-1 min-h-0 overflow-hidden" style={{ position: "relative" }}>
        {activeTab ? (
          <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            <XTerminal key={activeTab} termId={activeTab} cwd={projectPath} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-slate-600">
            无活跃终端
          </div>
        )}
      </div>
    </div>
  );
}
