import { useState } from "react";
import {
  Bot,
  Search,
  ClipboardList,
  Wrench,
  Clock,
  Check,
  X,
  Loader2,
  ChevronRight,
  ChevronDown,
  GitBranch,
  Trash2,
} from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";
import type { SubAgentNode } from "../../types/agent";

const AGENT_ICONS: Record<string, typeof Bot> = {
  Explore: Search,
  Plan: ClipboardList,
  "general-purpose": Wrench,
};

const STATUS_STYLES: Record<string, { icon: typeof Check; color: string; label: string }> = {
  completed: { icon: Check,   color: "text-emerald-ok", label: "完成" },
  error:     { icon: X,       color: "text-rose-err",   label: "失败" },
  running:   { icon: Loader2, color: "text-amber-glow", label: "运行中" },
  started:   { icon: Loader2, color: "text-amber-glow", label: "启动中" },
};

export default function SubAgentTree() {
  const { subAgentTree, clearSubAgentTree } = useAgentStore();

  if (subAgentTree.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6 py-10">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
          <Bot size={20} className="text-slate-500" />
        </div>
        <div>
          <div className="text-sm font-medium text-slate-300 mb-1">暂无 Sub Agent 执行记录</div>
          <div className="text-xs text-slate-500 leading-relaxed">
            当 Claude 创建 Sub Agent 时<br />执行树将在此实时显示
          </div>
        </div>
      </div>
    );
  }

  const running   = subAgentTree.filter((n) => n.status === "running" || n.status === "started").length;
  const completed = subAgentTree.filter((n) => n.status === "completed").length;
  const totalDuration = subAgentTree.reduce((sum, n) => sum + (n.durationMs || 0), 0);

  return (
    <div className="p-3 space-y-2">
      {/* Stats */}
      <div className="flex items-center gap-3 text-[10px] text-slate-500 pb-2 border-b border-white/5">
        <span>总 Agent: {subAgentTree.length}</span>
        <span className="text-emerald-ok">完成: {completed}</span>
        {running > 0 && <span className="text-amber-glow">运行中: {running}</span>}
        <span>耗时: {(totalDuration / 1000).toFixed(1)}s</span>
        <button onClick={clearSubAgentTree}
          className="ml-auto p-1 rounded hover:bg-white/5 text-slate-500 hover:text-rose-err transition-colors"
          title="清空执行树">
          <Trash2 size={10} />
        </button>
      </div>

      {/* Tree */}
      <div className="space-y-0.5">
        {subAgentTree.map((node) => (
          <AgentTreeNode key={node.id} node={node} depth={0} />
        ))}
      </div>
    </div>
  );
}

function AgentTreeNode({ node, depth }: { node: SubAgentNode; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const Icon       = AGENT_ICONS[node.agentType] || Bot;
  const status     = STATUS_STYLES[node.status] || STATUS_STYLES.running;
  const StatusIcon = status.icon;
  const hasChildren = node.children.length > 0 || node.toolCalls.length > 0;

  const duration = node.durationMs
    ? `${(node.durationMs / 1000).toFixed(1)}s`
    : node.startedAt
      ? `${((Date.now() - node.startedAt) / 1000).toFixed(0)}s`
      : "";

  return (
    <div style={{ paddingLeft: `${depth * 16}px` }}>
      {/* Node row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg
                   hover:bg-white/5 transition-colors group text-left"
      >
        {hasChildren ? (
          expanded
            ? <ChevronDown  size={11} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
            : <ChevronRight size={11} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
        ) : (
          <span className="w-[11px]" />
        )}

        <Icon size={13} className={node.isBackground ? "text-violet-info" : "text-amber-glow"} />

        <span className="text-xs text-slate-200 font-medium">
          {node.isBackground ? "后台: " : ""}
          {node.agentType}
          {node.model && (
            <span className="text-slate-500 font-normal"> ({node.model})</span>
          )}
        </span>

        <span className="flex-1 text-[10px] text-slate-400 truncate">
          {node.description}
        </span>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {duration && (
            <span className="text-[10px] font-mono text-slate-500">{duration}</span>
          )}
          <StatusIcon
            size={12}
            className={`${status.color} ${
              node.status === "running" || node.status === "started" ? "animate-spin" : ""
            }`}
          />
        </div>
      </button>

      {/* Worktree info */}
      {node.worktree && expanded && (
        <div className="flex items-center gap-1.5 ml-9 mb-1 text-[10px] text-slate-500">
          <GitBranch size={9} />
          <span className="font-mono">{node.worktree}</span>
        </div>
      )}

      {/* Children & Tool calls */}
      {expanded && (
        <>
          {node.toolCalls.map((tc) => (
            <div
              key={tc.id}
              className="flex items-center gap-2 py-0.5 px-2 ml-6 text-[10px]"
              style={{ paddingLeft: `${depth * 16 + 16}px` }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white/20 flex-shrink-0" />
              <span className="text-slate-400 font-medium">{tc.toolName}:</span>
              <span className="text-slate-500 truncate flex-1">{tc.summary}</span>
              {tc.status === "done"    && <Check  size={10} className="text-emerald-ok flex-shrink-0" />}
              {tc.status === "running" && <Loader2 size={10} className="text-amber-glow animate-spin flex-shrink-0" />}
              {tc.status === "error"   && <X      size={10} className="text-rose-err flex-shrink-0" />}
            </div>
          ))}

          {node.children.map((child) => (
            <AgentTreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </>
      )}

      {/* Result */}
      {expanded && node.result && node.status === "completed" && (
        <div
          className="ml-9 mb-1 px-2 py-1.5 rounded-lg bg-white/[0.03]
                     border border-white/5 text-[10px] text-slate-400 leading-relaxed"
          style={{ marginLeft: `${depth * 16 + 36}px` }}
        >
          {node.result}
        </div>
      )}
    </div>
  );
}
