import { useState, useEffect, useCallback } from "react";
import {
  GitCommitHorizontal,
  Pencil,
  FilePlus,
  Terminal,
  FileText,
  RotateCcw,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { useChatStore } from "../../stores/chatStore";
import { api } from "../../services/api";

/* ── Types (matching backend CheckpointData) ── */
interface ChangedFile {
  path: string;
  backupFileName: string | null;
  isNewFile: boolean;
}

interface CheckpointData {
  messageId: string;
  userContent: string;
  timestamp: string;
  changedFiles: ChangedFile[];
  hasFileChanges: boolean;
}

interface FileResult {
  path: string;
  action: "restored" | "deleted" | "skipped" | "failed";
  error?: string;
}

/* ── Helpers ── */
function basename(p: string) {
  return p.replace(/\\/g, "/").split("/").pop() ?? p;
}

function fileOpType(toolName: string): "edit" | "create" | "bash" | "read" {
  if (toolName === "Edit") return "edit";
  if (toolName === "Write") return "create";
  if (toolName === "Bash") return "bash";
  return "read";
}

function formatTs(ts: string | number | undefined) {
  if (!ts) return "";
  const d = typeof ts === "number" ? new Date(ts) : new Date(ts);
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

type RollbackMode = "code-only" | "code-and-chat";

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */
export default function CheckpointTimeline() {
  const { messages } = useChatStore();
  const currentSessionId = useChatStore((s) => s.currentSessionId);

  const [checkpoints, setCheckpoints] = useState<CheckpointData[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [rollbackState, setRollbackState] = useState<
    "idle" | "confirm" | "loading" | "done" | "error"
  >("idle");
  const [rollbackMode, setRollbackMode] = useState<RollbackMode>("code-only");
  const [rollbackMsg, setRollbackMsg] = useState("");
  const [fileResults, setFileResults] = useState<FileResult[]>([]);

  // Load checkpoints from backend when session changes
  useEffect(() => {
    if (!currentSessionId) {
      setCheckpoints([]);
      return;
    }
    setLoading(true);
    setSelectedIdx(null);
    setRollbackState("idle");
    api
      .getSessionCheckpoints(currentSessionId)
      .then((r) => {
        let cps = r.checkpoints;
        // Filter out checkpoints beyond the persisted rollback point
        try {
          const rollbackMsgId = localStorage.getItem(`rollback_msgid_${currentSessionId}`);
          if (rollbackMsgId) {
            const cutIdx = cps.findIndex((cp) => cp.messageId === rollbackMsgId);
            if (cutIdx >= 0) {
              cps = cps.slice(0, cutIdx + 1); // keep up to and including the rollback target
            }
          }
        } catch { /* ignore */ }
        setCheckpoints(cps);
      })
      .catch(() => setCheckpoints([]))
      .finally(() => setLoading(false));
  }, [currentSessionId]);

  // Build operations from chatStore messages for the selected checkpoint
  const getOperationsForCheckpoint = useCallback(
    (cp: CheckpointData) => {
      // Find user messages in chatStore and match by index order
      const userMsgs = messages.filter((m) => m.role === "user");
      // Find checkpoint index in the sorted checkpoint list
      const cpIdx = checkpoints.indexOf(cp);
      const userMsg = userMsgs[cpIdx];
      if (!userMsg) return [];

      const myIdx = messages.indexOf(userMsg);
      const nextUserIdx = messages.findIndex(
        (msg, j) => j > myIdx && msg.role === "user"
      );
      const assistantMsgs = messages
        .slice(myIdx + 1, nextUserIdx === -1 ? undefined : nextUserIdx)
        .filter((msg) => msg.role === "assistant");

      return assistantMsgs.flatMap((am) =>
        (am.toolCalls ?? []).map((tc) => ({
          type: fileOpType(tc.toolName),
          target: String(
            tc.toolInput.file_path ??
              tc.toolInput.command ??
              tc.toolInput.query ??
              ""
          ),
        }))
      );
    },
    [messages, checkpoints]
  );

  // Find chatStore user message ID that corresponds to a checkpoint index
  const findChatStoreMessageId = useCallback(
    (cpIndex: number): string | null => {
      const userMsgs = messages.filter((m) => m.role === "user");
      return userMsgs[cpIndex]?.id ?? null;
    },
    [messages]
  );

  // Handle rollback (code only or code+chat)
  const handleRollback = useCallback(
    async (cp: CheckpointData, cpIndex: number, mode: RollbackMode) => {
      if (!currentSessionId) return;

      // code-only or code-and-chat: use SDK rewind API (auto-fallback to manual rollback)
      setRollbackState("loading");
      try {
        const rewindResult = await api.rewindSession(
          currentSessionId,
          cp.messageId
        );

        if (!rewindResult.canRewind && rewindResult.error) {
          setRollbackState("error");
          setRollbackMsg(rewindResult.error);
          setFileResults([]);
        } else {
          // Convert rewind result to file results for display
          const changedFiles = rewindResult.filesChanged || [];
          setFileResults(
            changedFiles.map((path) => ({
              path,
              action: "restored" as const,
            }))
          );

          // Mark chat messages AFTER this checkpoint as rolled back
          // cpIndex+1 = the next user message (first one to roll back)
          // The selected checkpoint and its assistant response stay untouched
          if (mode === "code-and-chat") {
            const nextMsgId = findChatStoreMessageId(cpIndex + 1);
            if (nextMsgId) {
              useChatStore.getState().markMessagesRolledBack(nextMsgId);
            }
          }

          let msg = `已恢复 ${changedFiles.length} 个文件`;
          if (rewindResult.insertions || rewindResult.deletions) {
            msg += ` (+${rewindResult.insertions ?? 0}/-${rewindResult.deletions ?? 0} 行)`;
          }
          if (rewindResult.method === "sdk") {
            msg += " (SDK)";
          }
          if (mode === "code-and-chat") msg += "，后续对话已标记为回滚";
          setRollbackState("done");
          setRollbackMsg(msg);

          // Remove checkpoints after the selected one from the UI
          // Backend JSONL is append-only so the checkpoints still exist on disk,
          // but they're no longer relevant after rollback
          setCheckpoints((prev) => prev.slice(0, cpIndex + 1));
          // Persist the rollback point so checkpoint filtering survives page refresh
          try {
            localStorage.setItem(`rollback_msgid_${currentSessionId}`, cp.messageId);
          } catch { /* ignore */ }
          setSelectedIdx(null);
        }
      } catch (err) {
        setRollbackState("error");
        setRollbackMsg(String(err));
        setFileResults([]);
      }
    },
    [currentSessionId, findChatStoreMessageId]
  );

  // ── Empty state ──
  if (checkpoints.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6 py-10">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
          <GitCommitHorizontal size={20} className="text-slate-500" />
        </div>
        <div>
          <div className="text-sm font-medium text-slate-300 mb-1">
            暂无 Checkpoint
          </div>
          <div className="text-xs text-slate-500 leading-relaxed">
            当 Claude 修改文件时，会自动创建 Checkpoint
            <br />
            可用于回滚代码到任意时间点
          </div>
        </div>
        {loading && (
          <Loader2 size={14} className="text-slate-500 animate-spin mt-2" />
        )}
      </div>
    );
  }

  const selected =
    selectedIdx !== null ? checkpoints[selectedIdx] : null;
  const selectedOps = selected ? getOperationsForCheckpoint(selected) : [];

  return (
    <div className="p-3 space-y-2 overflow-y-auto">
      {/* ── Header with count + refresh ── */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
          Checkpoints ({checkpoints.length})
        </span>
        <button
          onClick={() => {
            if (!currentSessionId) return;
            setLoading(true);
            api.getSessionCheckpoints(currentSessionId)
              .then((r) => { setCheckpoints(r.checkpoints); setSelectedIdx(null); setRollbackState("idle"); })
              .catch(() => {})
              .finally(() => setLoading(false));
          }}
          disabled={loading}
          className="p-1 rounded-md hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        </button>
      </div>

      {/* ── Vertical checkpoint card list (accordion) ── */}
      {checkpoints.map((cp, i) => {
        const isSelected = i === selectedIdx;
        return (
          <div key={cp.messageId}>
            <button
              onClick={() => {
                setSelectedIdx(i === selectedIdx ? null : i);
                setRollbackState("idle");
                setFileResults([]);
              }}
              className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                isSelected
                  ? "border-amber-glow/40 bg-amber-glow/5"
                  : "border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center gap-2">
                {/* Index badge */}
                <span
                  className={`flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    isSelected
                      ? "bg-amber-glow text-white"
                      : "bg-white/10 text-slate-400"
                  }`}
                >
                  {i + 1}
                </span>
                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-slate-200 font-mono truncate">
                    {cp.userContent ? `"${cp.userContent}"` : <span className="text-slate-500 italic">(无文本)</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-slate-500">
                      {formatTs(cp.timestamp)}
                    </span>
                    {cp.hasFileChanges && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-glow/10 text-amber-glow border border-amber-glow/20">
                        {cp.changedFiles.length} 文件
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>

            {/* ── Accordion detail panel (inline under selected card) ── */}
            {isSelected && selected && (
              <div className="mt-1.5 p-3 rounded-xl border border-white/8 bg-white/[0.02] space-y-2.5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">
                    Checkpoint #{i + 1}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {formatTs(cp.timestamp)}
                  </span>
                </div>

                {/* Message preview */}
                <p className="text-xs text-slate-300 bg-white/5 px-2.5 py-1.5 rounded-lg font-mono leading-relaxed">
                  {cp.userContent ? `"${cp.userContent}"` : <span className="text-slate-500 italic">(此检查点无关联的用户消息)</span>}
                </p>

                {/* Changed files from snapshot */}
                {cp.hasFileChanges && (
                  <ChangedFilesBlock files={cp.changedFiles} />
                )}

                {/* Operations (from tool calls in chatStore) */}
                {selectedOps.length > 0 && (
                  <OperationsBlock operations={selectedOps} />
                )}

                {/* ── Rollback section ── */}
                <div>
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1.5">
                    回滚选项
                  </div>

                  {rollbackState === "idle" && (
                    <div className="space-y-1">
                      {/* Hint when no file changes recorded */}
                      {!cp.hasFileChanges && (
                        <div className="text-[10px] text-slate-500 bg-white/3 border border-white/5 rounded-lg px-2.5 py-1.5 mb-1.5">
                          此检查点无文件变更记录，回滚将尝试通过 SDK 恢复
                        </div>
                      )}
                      <RollbackOption
                        icon={<RotateCcw size={11} />}
                        label="仅回滚代码（推荐）"
                        desc={
                          cp.hasFileChanges
                            ? `恢复 ${cp.changedFiles.length} 个文件到此 Checkpoint 之前`
                            : "尝试通过 SDK 恢复到此 Checkpoint 之前"
                        }
                        color="text-amber-glow"
                        onClick={() => {
                          setRollbackMode("code-only");
                          setRollbackState("confirm");
                        }}
                      />
                      <RollbackOption
                        icon={<FileText size={11} />}
                        label="回滚代码 + 对话"
                        desc="恢复文件并标记后续对话为已回滚"
                        color="text-sky-link"
                        onClick={() => {
                          setRollbackMode("code-and-chat");
                          setRollbackState("confirm");
                        }}
                      />
                    </div>
                  )}

                  {rollbackState === "confirm" && (
                    <ConfirmBlock
                      mode={rollbackMode}
                      checkpoint={selected}
                      operations={selectedOps}
                      onConfirm={() =>
                        handleRollback(selected, i, rollbackMode)
                      }
                      onCancel={() => setRollbackState("idle")}
                    />
                  )}

                  {rollbackState === "loading" && (
                    <div className="flex items-center gap-2 p-3 rounded-xl border border-white/8 bg-white/3">
                      <Loader2 size={14} className="text-amber-glow animate-spin" />
                      <span className="text-xs text-slate-400">正在回滚文件...</span>
                    </div>
                  )}

                  {rollbackState === "done" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 p-3 rounded-xl border border-emerald-ok/20 bg-emerald-ok/5">
                        <CheckCircle2 size={14} className="text-emerald-ok" />
                        <span className="text-xs text-emerald-ok flex-1">
                          {rollbackMsg}
                        </span>
                        <button
                          onClick={() => {
                            setRollbackState("idle");
                            setFileResults([]);
                          }}
                          className="ml-auto text-[10px] text-slate-500 hover:text-slate-300"
                        >
                          关闭
                        </button>
                      </div>
                      {fileResults.length > 0 && (
                        <FileResultsBlock results={fileResults} />
                      )}
                    </div>
                  )}

                  {rollbackState === "error" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 p-3 rounded-xl border border-rose-err/20 bg-rose-err/5">
                        <XCircle size={14} className="text-rose-err" />
                        <span className="text-xs text-rose-err flex-1">
                          {rollbackMsg}
                        </span>
                        <button
                          onClick={() => {
                            setRollbackState("idle");
                            setFileResults([]);
                          }}
                          className="ml-auto text-[10px] text-slate-500 hover:text-slate-300"
                        >
                          关闭
                        </button>
                      </div>
                      {fileResults.length > 0 && (
                        <FileResultsBlock results={fileResults} />
                      )}
                    </div>
                  )}
                </div>

                {/* Warning */}
                <div className="flex items-start gap-1.5 p-2 rounded-lg bg-amber-glow/5 border border-amber-glow/10">
                  <AlertTriangle
                    size={11}
                    className="text-amber-glow flex-shrink-0 mt-0.5"
                  />
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    回滚不可逆，且无法撤销 Bash 命令的副作用（如已安装的包、已执行的脚本等）
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Confirm Block ── */
function ConfirmBlock({
  mode,
  checkpoint,
  operations,
  onConfirm,
  onCancel,
}: {
  mode: RollbackMode;
  checkpoint: CheckpointData;
  operations: { type: string }[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const hasBashOps = operations.some((op) => op.type === "bash");

  const modeLabels: Record<RollbackMode, string> = {
    "code-only": "仅回滚代码",
    "code-and-chat": "回滚代码 + 对话",
  };

  const hasFiles = checkpoint.changedFiles.length > 0;

  return (
    <div className="p-3 rounded-xl border border-amber-glow/20 bg-amber-glow/5 space-y-2.5">
      <p className="text-xs text-slate-300 font-medium">
        {modeLabels[mode]}
      </p>

      {hasFiles ? (
        <>
          <p className="text-xs text-slate-400">
            将恢复{" "}
            <span className="font-medium text-amber-glow">
              {checkpoint.changedFiles.length}
            </span>{" "}
            个文件到此 Checkpoint 之前的状态，当前修改将被覆盖。
          </p>
          <div className="space-y-1 text-[10px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-ok">✓</span>
              <span>代码文件：将恢复到回滚点之前的版本</span>
            </div>
            {checkpoint.changedFiles.some((f) => f.isNewFile) && (
              <div className="flex items-center gap-1.5">
                <span className="text-rose-err">✗</span>
                <span>
                  新建文件：将被删除（
                  {checkpoint.changedFiles.filter((f) => f.isNewFile).length}{" "}
                  个）
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className={mode === "code-and-chat" ? "text-emerald-ok" : "text-slate-500"}>
                {mode === "code-and-chat" ? "✓" : "—"}
              </span>
              <span>
                聊天记录：
                {mode === "code-and-chat"
                  ? "后续消息标记为已回滚"
                  : "不受影响"}
              </span>
            </div>
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-400">
          此检查点无文件变更记录，将尝试通过 SDK 恢复到此 Checkpoint 之前的状态。
          {mode === "code-and-chat" && " 同时标记后续对话为已回滚。"}
        </p>
      )}

      {hasBashOps && (
        <div className="flex items-start gap-1.5 p-2 rounded-lg bg-rose-err/5 border border-rose-err/15">
          <AlertTriangle
            size={11}
            className="text-rose-err flex-shrink-0 mt-0.5"
          />
          <p className="text-[10px] text-rose-err/80 leading-relaxed">
            此 Checkpoint 包含 Bash 命令操作。回滚
            <b>无法</b>
            撤销已执行命令的副作用。
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="flex-1 py-1.5 rounded-lg bg-amber-glow/15 hover:bg-amber-glow/25 text-amber-glow text-xs font-medium border border-amber-glow/20 transition-colors"
        >
          确认{modeLabels[mode]}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-medium border border-white/8 transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  );
}

/* ── Changed Files Block (with new/modified distinction) ── */
function ChangedFilesBlock({ files }: { files: ChangedFile[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? files : files.slice(0, 3);
  const extra = files.length - 3;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1.5 hover:text-slate-300 transition-colors"
      >
        {expanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
        变更文件 ({files.length})
      </button>
      <div className="space-y-1">
        {shown.map((f, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 text-[10px] text-slate-400"
          >
            {f.isNewFile ? (
              <FilePlus
                size={9}
                className="text-emerald-ok flex-shrink-0"
              />
            ) : (
              <Pencil
                size={9}
                className="text-amber-glow flex-shrink-0"
              />
            )}
            <span className="font-mono truncate" title={f.path}>
              {basename(f.path)}
            </span>
            {f.isNewFile && (
              <span className="text-[8px] text-emerald-ok/70">(新建)</span>
            )}
          </div>
        ))}
        {!expanded && extra > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="text-[10px] text-slate-500 hover:text-slate-300 pl-3.5 transition-colors"
          >
            + {extra} 个更多文件
          </button>
        )}
      </div>
    </div>
  );
}

/* ── File Results Block (rollback outcome) ── */
function FileResultsBlock({ results }: { results: FileResult[] }) {
  const [expanded, setExpanded] = useState(results.length <= 5);

  const actionIcons: Record<string, React.ReactNode> = {
    restored: <CheckCircle2 size={9} className="text-emerald-ok" />,
    deleted: <Trash2 size={9} className="text-rose-err" />,
    skipped: <span className="text-[9px] text-slate-500">—</span>,
    failed: <XCircle size={9} className="text-rose-err" />,
  };
  const actionLabels: Record<string, string> = {
    restored: "已恢复",
    deleted: "已删除",
    skipped: "已跳过",
    failed: "失败",
  };

  const shown = expanded ? results : results.slice(0, 3);

  return (
    <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium uppercase tracking-wider hover:text-slate-300 transition-colors"
      >
        {expanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
        回滚详情 ({results.length})
      </button>
      {shown.map((r, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 text-[10px] text-slate-400"
        >
          {actionIcons[r.action]}
          <span className="font-mono truncate flex-1" title={r.path}>
            {basename(r.path)}
          </span>
          <span
            className={`text-[9px] ${
              r.action === "failed" ? "text-rose-err" : "text-slate-500"
            }`}
          >
            {actionLabels[r.action]}
          </span>
          {r.error && (
            <span className="text-[9px] text-rose-err/70 truncate max-w-[120px]" title={r.error}>
              {r.error}
            </span>
          )}
        </div>
      ))}
      {!expanded && results.length > 3 && (
        <button
          onClick={() => setExpanded(true)}
          className="text-[10px] text-slate-500 hover:text-slate-300 pl-3.5 transition-colors"
        >
          + {results.length - 3} 条更多
        </button>
      )}
    </div>
  );
}

/* ── Operations Block ── */
function OperationsBlock({
  operations,
}: {
  operations: { type: "edit" | "create" | "bash" | "read"; target: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? operations : operations.slice(0, 5);
  const extra = operations.length - 5;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1.5 hover:text-slate-300 transition-colors"
      >
        {expanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
        Claude 操作 ({operations.length})
      </button>
      <div className="space-y-1">
        {shown.map((op, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 text-[10px] text-slate-400"
          >
            {op.type === "edit" && (
              <Pencil size={9} className="text-amber-glow flex-shrink-0" />
            )}
            {op.type === "create" && (
              <FilePlus size={9} className="text-emerald-ok flex-shrink-0" />
            )}
            {op.type === "bash" && (
              <Terminal size={9} className="text-violet-info flex-shrink-0" />
            )}
            {op.type === "read" && (
              <FileText size={9} className="text-sky-link flex-shrink-0" />
            )}
            <span className="font-mono truncate" title={op.target}>
              {op.target
                ? basename(op.target) || op.target.slice(0, 40)
                : "—"}
            </span>
          </div>
        ))}
        {!expanded && extra > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="text-[10px] text-slate-500 hover:text-slate-300 pl-3.5 transition-colors"
          >
            + {extra} 条更多操作
          </button>
        )}
      </div>
    </div>
  );
}

/* ── RollbackOption ── */
function RollbackOption({
  icon,
  label,
  desc,
  color,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  color: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 p-2 rounded-lg border border-white/8
                  hover:border-white/15 hover:bg-white/5 transition-colors text-left group
                  disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-white/8 disabled:hover:bg-transparent`}
    >
      <span className={`flex-shrink-0 ${color}`}>{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] text-slate-200 font-medium group-hover:text-white transition-colors">
          {label}
        </div>
        <div className="text-[9px] text-slate-500 leading-relaxed">{desc}</div>
      </div>
    </button>
  );
}
