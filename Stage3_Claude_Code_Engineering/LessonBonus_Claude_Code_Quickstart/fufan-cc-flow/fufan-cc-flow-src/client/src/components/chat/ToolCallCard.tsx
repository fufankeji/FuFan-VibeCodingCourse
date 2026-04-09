import { useState, useCallback } from "react";
import {
  FileText,
  Pencil,
  FilePlus,
  Terminal,
  Search,
  ScanSearch,
  Bot,
  Globe,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ListTodo,
  ShieldAlert,
  PenTool,
  Camera,
  Plug,
} from "lucide-react";
import type { ToolCall } from "../../types/claude";
import { useChatStore } from "../../stores/chatStore";
import { wsService } from "../../services/websocket";

// ── Tool metadata ───────────────────────────────────────────

const TOOL_META: Record<string, {
  Icon: typeof FileText;
  label: string;
  color: string;
}> = {
  Read:      { Icon: FileText,   label: "Read",       color: "text-sky-link   border-sky-link/20   bg-sky-link/5" },
  Edit:      { Icon: Pencil,     label: "Edit",       color: "text-amber-glow border-amber-glow/20 bg-amber-glow/5" },
  Write:     { Icon: FilePlus,   label: "Write",      color: "text-emerald-ok border-emerald-ok/20 bg-emerald-ok/5" },
  Bash:      { Icon: Terminal,   label: "Bash",       color: "text-violet-info border-violet-info/20 bg-violet-info/5" },
  Glob:      { Icon: Search,     label: "Glob",       color: "text-sky-link   border-sky-link/20   bg-sky-link/5" },
  Grep:      { Icon: ScanSearch, label: "Grep",       color: "text-sky-link   border-sky-link/20   bg-sky-link/5" },
  Task:      { Icon: Bot,        label: "Task",       color: "text-amber-bright border-amber-bright/20 bg-amber-bright/5" },
  WebFetch:  { Icon: Globe,      label: "WebFetch",   color: "text-sky-link   border-sky-link/20   bg-sky-link/5" },
  WebSearch: { Icon: Search,     label: "WebSearch",  color: "text-sky-link   border-sky-link/20   bg-sky-link/5" },
  TodoWrite: { Icon: ListTodo,   label: "TodoWrite",  color: "text-amber-glow border-amber-glow/20 bg-amber-glow/5" },
};

const DEFAULT_META = { Icon: Terminal, label: "Tool", color: "text-slate-300 border-white/10 bg-white/5" };

// ── MCP tool metadata ────────────────────────────────────────

const PENCIL_TOOL_META: Record<string, { Icon: typeof FileText; label: string }> = {
  batch_design:    { Icon: PenTool, label: "Pencil Design" },
  batch_get:       { Icon: Search,  label: "Pencil Read" },
  get_screenshot:  { Icon: Camera,  label: "Pencil Screenshot" },
  get_editor_state: { Icon: PenTool, label: "Pencil Editor" },
  get_guidelines:  { Icon: PenTool, label: "Pencil Guidelines" },
  get_style_guide: { Icon: PenTool, label: "Pencil Style" },
  snapshot_layout: { Icon: PenTool, label: "Pencil Layout" },
  open_document:   { Icon: PenTool, label: "Pencil Open" },
  find_empty_space_on_canvas: { Icon: PenTool, label: "Pencil Space" },
};

function getMcpToolMeta(toolName: string): { Icon: typeof FileText; label: string; color: string } | null {
  if (!toolName.startsWith("mcp__")) return null;

  // mcp__pencil__xxx → namespace="pencil", method="xxx"
  const parts = toolName.split("__");
  const namespace = parts[1] || "";
  const method = parts.slice(2).join("__");

  if (namespace === "pencil") {
    const meta = PENCIL_TOOL_META[method];
    if (meta) return { ...meta, color: "text-pink-400 border-pink-400/20 bg-pink-400/5" };
    // Fallback for unknown pencil methods
    const label = "Pencil: " + method.replace(/_/g, " ");
    return { Icon: PenTool, label, color: "text-pink-400 border-pink-400/20 bg-pink-400/5" };
  }

  // Generic MCP tool
  const label = "MCP: " + namespace;
  return { Icon: Plug, label, color: "text-slate-300 border-white/10 bg-white/5" };
}

// ── Parameter summary ───────────────────────────────────────

function getToolSummary(tc: ToolCall): string {
  const inp = tc.toolInput;
  switch (tc.toolName) {
    case "Read": {
      const p = String(inp.file_path || "");
      const offset = inp.offset ? ` :${inp.offset}` : "";
      const limit  = inp.limit  ? `–${Number(inp.offset || 0) + Number(inp.limit)}` : "";
      return p + offset + limit;
    }
    case "Edit":
    case "Write":
      return String(inp.file_path || "");
    case "Bash":
      return String(inp.description || inp.command || "").slice(0, 80);
    case "Glob":
      return String(inp.pattern || "");
    case "Grep":
      return inp.path
        ? `"${inp.pattern}" in ${inp.path}`
        : `"${inp.pattern}"`;
    case "Task":
      return String(inp.description || inp.prompt || "").slice(0, 60);
    case "WebFetch":
      return String(inp.url || "").replace(/^https?:\/\//, "");
    case "WebSearch":
      return String(inp.query || "");
    case "TodoWrite":
      return `更新任务清单 (${Array.isArray(inp.todos) ? inp.todos.length : "?"} 项)`;
    default: {
      // MCP Pencil tool summaries
      if (tc.toolName === "mcp__pencil__batch_design") {
        const ops = String(inp.operations || "");
        const counts: Record<string, number> = {};
        for (const line of ops.split("\n")) {
          const m = line.match(/^\s*\w+=?\s*([IUCRDMG])\s*\(/);
          if (m) counts[m[1]] = (counts[m[1]] || 0) + 1;
        }
        const labels: Record<string, string> = { I: "插入", C: "复制", U: "更新", R: "替换", D: "删除", M: "移动", G: "图片" };
        const parts = Object.entries(counts).map(([k, v]) => `${labels[k] || k} ${v}`);
        return parts.length ? parts.join(" · ") : "设计操作";
      }
      if (tc.toolName === "mcp__pencil__batch_get") {
        const pats = Array.isArray(inp.patterns) ? inp.patterns.length : 0;
        const ids = Array.isArray(inp.nodeIds) ? inp.nodeIds.length : 0;
        const parts = [];
        if (pats) parts.push(`${pats} 个搜索`);
        if (ids) parts.push(`${ids} 个节点`);
        return parts.length ? parts.join(" + ") : "读取节点";
      }
      if (tc.toolName === "mcp__pencil__get_screenshot") {
        return `截图 ${String(inp.nodeId || "")}`;
      }
      if (tc.toolName === "mcp__pencil__get_editor_state") {
        return "获取编辑器状态";
      }
      if (tc.toolName.startsWith("mcp__pencil__")) {
        return tc.toolName.split("__").slice(2).join("__").replace(/_/g, " ");
      }
      if (tc.toolName.startsWith("mcp__")) {
        const parts = tc.toolName.split("__");
        return `${parts[1]}:${parts.slice(2).join("__")}`;
      }
      return tc.toolName;
    }
  }
}

// ── Diff renderer (Edit tool) ───────────────────────────────

function DiffView({ oldStr, newStr }: { oldStr: string; newStr: string }) {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");
  return (
    <div className="font-mono text-[11px] leading-5 overflow-x-auto">
      {oldLines.map((line, i) => (
        <div key={`rm-${i}`} className="flex gap-2 bg-rose-err/10 px-2 rounded-sm">
          <span className="text-rose-err/60 select-none w-3 flex-shrink-0">−</span>
          <span className="text-rose-err/80 whitespace-pre">{line}</span>
        </div>
      ))}
      {newLines.map((line, i) => (
        <div key={`add-${i}`} className="flex gap-2 bg-emerald-ok/10 px-2 rounded-sm">
          <span className="text-emerald-ok/60 select-none w-3 flex-shrink-0">+</span>
          <span className="text-emerald-ok/80 whitespace-pre">{line}</span>
        </div>
      ))}
    </div>
  );
}

// ── Image lightbox ───────────────────────────────────────────

function ImagePreview({ src }: { src: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <div
        className="rounded-lg overflow-hidden border border-white/10 bg-black/20 cursor-zoom-in"
        onClick={() => setOpen(true)}
      >
        <img
          src={src}
          alt="Preview"
          className="max-w-full max-h-[480px] object-contain"
        />
      </div>

      {/* Lightbox overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="relative flex items-center justify-center"
            style={{ width: "80vw", height: "80vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={src}
              alt="Full size"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
            <button
              onClick={close}
              className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-lg transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Image detection helpers ──────────────────────────────────
// 注意：Pencil 截图可能返回 MB 级 base64，不能对整个字符串跑正则

function looksLikeImage(s: string): boolean {
  if (!s || s.length < 20) return false;
  // 只检测开头特征，避免全文正则扫描
  const head = s.slice(0, 200);
  return head.includes("data:image/")
    || head.startsWith("iVBOR")
    || head.startsWith("/9j/")
    || head.startsWith("R0lGOD")
    || head.includes('"type":"image"')
    || head.includes('"type": "image"');
}

function extractImageSrc(s: string): string | null {
  if (!s || s.length < 20) return null;
  try {
    const head = s.slice(0, 200);

    // data URL — 找到前缀位置后直接截取到末尾（避免全文正则）
    const dataIdx = head.indexOf("data:image/");
    if (dataIdx !== -1) {
      // 找到 data URL 的结束位置（空格、引号或字符串末尾）
      const start = dataIdx;
      const end = s.indexOf('"', start + 11);
      return end > start ? s.slice(start, end) : s.slice(start);
    }

    // Raw base64 PNG
    if (s.startsWith("iVBOR")) return `data:image/png;base64,${s.trim()}`;
    // Raw base64 JPEG
    if (s.startsWith("/9j/")) return `data:image/jpeg;base64,${s.trim()}`;

    // JSON content block with base64
    if (head.includes('"type"')) {
      const parsed = JSON.parse(s);
      const blocks = Array.isArray(parsed) ? parsed : parsed?.content;
      if (Array.isArray(blocks)) {
        for (const b of blocks) {
          if (b.type === "image" && b.source?.data) {
            return `data:${b.source.media_type || "image/png"};base64,${b.source.data}`;
          }
        }
      }
    }
  } catch { /* parse error — not an image */ }
  return null;
}

// ── Result renderer ─────────────────────────────────────────

function ResultView({ tc }: { tc: ToolCall }) {
  if (!tc.result) return null;

  // Pencil screenshot or generic base64 image
  if (tc.toolName === "mcp__pencil__get_screenshot" || looksLikeImage(tc.result)) {
    const src = extractImageSrc(tc.result);
    if (src) {
      return <ImagePreview src={src} />;
    }
    // 截图工具但无法提取图片 — 显示调试信息帮助诊断
    if (tc.toolName === "mcp__pencil__get_screenshot") {
      return (
        <div className="space-y-1">
          <p className="text-xs text-amber-glow">截图数据已返回但无法解析为图片</p>
          <pre className="text-[10px] font-mono text-slate-500 whitespace-pre-wrap max-h-24 overflow-y-auto">
            {tc.result.slice(0, 300)}{tc.result.length > 300 ? "…" : ""}
          </pre>
        </div>
      );
    }
  }

  // Edit tool: show diff
  if (tc.toolName === "Edit") {
    const oldStr = String(tc.toolInput.old_string || "");
    const newStr = String(tc.toolInput.new_string || "");
    if (oldStr || newStr) {
      return (
        <div className="max-h-48 overflow-y-auto rounded border border-white/5 p-2">
          <DiffView oldStr={oldStr} newStr={newStr} />
        </div>
      );
    }
  }

  // Write tool: success message
  if (tc.toolName === "Write") {
    const lines = String(tc.toolInput.content || "").split("\n").length;
    return (
      <p className="text-xs text-emerald-ok/80">
        文件已创建（{lines} 行）
      </p>
    );
  }

  // TodoWrite: render task list
  if (tc.toolName === "TodoWrite" && Array.isArray(tc.toolInput.todos)) {
    const todos = tc.toolInput.todos as { content: string; status: string; priority: string }[];
    return (
      <div className="space-y-1">
        {todos.slice(0, 8).map((t, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <span className={
              t.status === "completed" ? "text-emerald-ok" :
              t.status === "in_progress" ? "text-amber-glow" : "text-slate-500"
            }>
              {t.status === "completed" ? "✓" : t.status === "in_progress" ? "▶" : "○"}
            </span>
            <span className={`${t.status === "completed" ? "line-through text-slate-500" : "text-slate-300"}`}>
              {t.content}
            </span>
          </div>
        ))}
        {todos.length > 8 && (
          <p className="text-[10px] text-slate-500">+{todos.length - 8} 更多</p>
        )}
      </div>
    );
  }

  // Default: pre-formatted code block, truncated
  const MAX = 2000;
  const text = tc.result.length > MAX
    ? tc.result.slice(0, MAX) + "\n… (已截断)"
    : tc.result;

  return (
    <pre className="text-[11px] font-mono whitespace-pre-wrap text-slate-300 leading-relaxed max-h-60 overflow-y-auto">
      {text}
    </pre>
  );
}

// ── Input view (when result not yet available) ──────────────

const OP_COLORS: Record<string, { label: string; color: string }> = {
  I: { label: "INSERT", color: "text-emerald-ok" },
  C: { label: "COPY",   color: "text-cyan-400" },
  U: { label: "UPDATE", color: "text-blue-400" },
  R: { label: "REPLACE", color: "text-amber-glow" },
  D: { label: "DELETE", color: "text-rose-err" },
  M: { label: "MOVE",   color: "text-violet-info" },
  G: { label: "IMAGE",  color: "text-pink-400" },
};

function InputView({ tc }: { tc: ToolCall }) {
  // batch_design: show operation list
  if (tc.toolName === "mcp__pencil__batch_design" && tc.toolInput.operations) {
    const lines = String(tc.toolInput.operations).split("\n").filter((l: string) => l.trim());
    return (
      <div className="font-mono text-[11px] leading-5 space-y-0.5 max-h-48 overflow-y-auto">
        {lines.map((line: string, i: number) => {
          const m = line.match(/^\s*(\w+)\s*=?\s*([IUCRDMG])\s*\(/);
          const op = m?.[2] || "";
          const meta = OP_COLORS[op];
          return (
            <div key={i} className="flex gap-2 px-1 rounded-sm hover:bg-white/5">
              {meta ? (
                <span className={`${meta.color} w-14 flex-shrink-0 text-[10px] font-bold`}>{meta.label}</span>
              ) : (
                <span className="text-slate-500 w-14 flex-shrink-0 text-[10px]">OP</span>
              )}
              <span className="text-slate-400 whitespace-pre truncate">{line.trim()}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // Edit: show diff from input
  if (tc.toolName === "Edit") {
    const oldStr = String(tc.toolInput.old_string || "");
    const newStr = String(tc.toolInput.new_string || "");
    if (oldStr || newStr) {
      return (
        <div className="max-h-48 overflow-y-auto rounded border border-white/5 p-2">
          <DiffView oldStr={oldStr} newStr={newStr} />
        </div>
      );
    }
  }

  // Write: show file path and line count
  if (tc.toolName === "Write") {
    const lines = String(tc.toolInput.content || "").split("\n").length;
    return (
      <p className="text-xs text-slate-400">
        写入 {lines} 行到 <span className="font-mono text-slate-300">{String(tc.toolInput.file_path || "")}</span>
      </p>
    );
  }

  // TodoWrite: render task list from input
  if (tc.toolName === "TodoWrite" && Array.isArray(tc.toolInput.todos)) {
    const todos = tc.toolInput.todos as { content: string; status: string }[];
    return (
      <div className="space-y-1">
        {todos.slice(0, 8).map((t, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <span className={
              t.status === "completed" ? "text-emerald-ok" :
              t.status === "in_progress" ? "text-amber-glow" : "text-slate-500"
            }>
              {t.status === "completed" ? "✓" : t.status === "in_progress" ? "▶" : "○"}
            </span>
            <span className={t.status === "completed" ? "line-through text-slate-500" : "text-slate-300"}>
              {t.content}
            </span>
          </div>
        ))}
        {todos.length > 8 && (
          <p className="text-[10px] text-slate-500">+{todos.length - 8} 更多</p>
        )}
      </div>
    );
  }

  // Bash: show command
  if (tc.toolName === "Bash" && tc.toolInput.command) {
    return (
      <pre className="text-[11px] font-mono whitespace-pre-wrap text-slate-300 leading-relaxed max-h-32 overflow-y-auto">
        $ {String(tc.toolInput.command)}
      </pre>
    );
  }

  // Default: show input params as formatted JSON
  const keys = Object.keys(tc.toolInput);
  if (keys.length === 0) return <p className="text-xs text-slate-500">无参数</p>;

  return (
    <pre className="text-[11px] font-mono whitespace-pre-wrap text-slate-400 leading-relaxed max-h-48 overflow-y-auto">
      {JSON.stringify(tc.toolInput, null, 2)}
    </pre>
  );
}

// ── Status icon ─────────────────────────────────────────────

function StatusIcon({ status }: { status: ToolCall["status"] }) {
  switch (status) {
    case "awaiting_permission":
      return <ShieldAlert size={13} className="text-amber-glow animate-pulse flex-shrink-0" />;
    case "running":
      return <Loader2 size={13} className="animate-spin text-amber-glow flex-shrink-0" />;
    case "done":
      return <CheckCircle2 size={13} className="text-emerald-ok flex-shrink-0" />;
    case "error":
      return <XCircle size={13} className="text-rose-err flex-shrink-0" />;
    default:
      return <Clock size={13} className="text-slate-500 flex-shrink-0 opacity-50" />;
  }
}

// ── Main component ───────────────────────────────────────────

interface Props {
  toolCall: ToolCall;
}

export default function ToolCallCard({ toolCall: tc }: Props) {
  // 截图工具有结果时自动展开
  const isScreenshot = tc.toolName === "mcp__pencil__get_screenshot";
  const [expanded, setExpanded] = useState(false);
  const autoExpanded = isScreenshot && Boolean(tc.result) && !tc.isError;
  const meta = TOOL_META[tc.toolName] ?? getMcpToolMeta(tc.toolName) ?? DEFAULT_META;
  const { Icon, color } = meta;
  const summary = getToolSummary(tc);
  const hasResult = Boolean(tc.result);
  const isRunning = tc.status === "running";
  const isAwaitingPermission = tc.status === "awaiting_permission";

  // Get the full permission request data (may include decisionReason, hasSuggestions)
  const permData = tc.permissionRequestId
    ? useChatStore.getState().pendingPermissions.get(tc.permissionRequestId)
    : undefined;

  const handlePermission = (decision: "allow" | "deny", alwaysAllow = false) => {
    if (!tc.permissionRequestId) return;
    wsService.send("permission_response", {
      requestId: tc.permissionRequestId,
      decision,
      ...(alwaysAllow ? { alwaysAllow: true } : {}),
    });
    useChatStore.getState().removePermissionRequest(tc.permissionRequestId);
    useChatStore.getState().updateToolCall(tc.id, {
      status: decision === "allow" ? "running" : "error",
      permissionRequestId: undefined,
      ...(decision === "deny" ? { result: "用户拒绝了此操作", isError: true } : {}),
    });
  };

  return (
    <div className={`tool-card-enter border rounded-lg my-1.5 overflow-hidden ${
      isAwaitingPermission
        ? "border-amber-glow/40 bg-amber-glow/5"
        : color
    }`}>
      {/* Running progress bar */}
      {isRunning && (
        <div className="h-[2px] w-full overflow-hidden">
          <div className="h-full bg-current/40 animate-pulse rounded-full" />
        </div>
      )}

      {/* Permission awaiting indicator */}
      {isAwaitingPermission && (
        <div className="h-[2px] w-full bg-amber-glow/40" />
      )}

      {/* Header row — always expandable (show input when result unavailable) */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-current/5"
      >
        <Icon size={13} className="flex-shrink-0 opacity-80" />

        <span className="text-[11px] font-semibold uppercase tracking-wider opacity-70 flex-shrink-0">
          {meta.label}
        </span>

        <span className="flex-1 text-[11px] font-mono truncate opacity-60">
          {summary}
        </span>

        <StatusIcon status={tc.status} />

        {expanded
          ? <ChevronDown size={12} className="opacity-40 flex-shrink-0" />
          : <ChevronRight size={12} className="opacity-40 flex-shrink-0" />
        }
      </button>

      {/* Permission action bar */}
      {isAwaitingPermission && (
        <div className="border-t border-amber-glow/20 px-3 py-2 space-y-1.5">
          {/* Reason line (if SDK provided one) */}
          {permData?.decisionReason && (
            <div className="text-[10px] text-slate-400 leading-relaxed">
              {permData.decisionReason}
              {permData.blockedPath && (
                <span className="font-mono text-amber-glow/70 ml-1">{permData.blockedPath}</span>
              )}
            </div>
          )}
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} className="text-amber-glow flex-shrink-0" />
            <span className="text-xs text-amber-glow flex-1">需要确认此操作</span>
            <button
              onClick={() => handlePermission("deny")}
              className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-rose-err/30 text-rose-err hover:bg-rose-err/10 transition-colors"
            >
              拒绝
            </button>
            <button
              onClick={() => handlePermission("allow")}
              className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-emerald-ok/30 text-emerald-ok hover:bg-emerald-ok/10 transition-colors"
            >
              允许
            </button>
            {permData?.hasSuggestions && (
              <button
                onClick={() => handlePermission("allow", true)}
                className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-violet-info/30 text-violet-info hover:bg-violet-info/10 transition-colors"
              >
                总是允许
              </button>
            )}
          </div>
        </div>
      )}

      {/* Expanded content: result if available, otherwise input details */}
      {/* 截图工具有结果时自动展开显示图片 */}
      {(expanded || autoExpanded) && (
        <div className="border-t border-current/10 px-3 py-2.5">
          {tc.isError ? (
            <div className="flex items-start gap-2">
              <XCircle size={12} className="text-rose-err mt-0.5 flex-shrink-0" />
              <pre className="text-[11px] font-mono text-rose-err/80 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {tc.result}
              </pre>
            </div>
          ) : hasResult ? (
            <ResultView tc={tc} />
          ) : (
            <InputView tc={tc} />
          )}
        </div>
      )}
    </div>
  );
}
