import { useEffect, useState } from "react";
import {
  Webhook,
  Plus,
  Trash2,
  Pencil,
  X,
  Save,
  Loader2,
  ChevronDown,
  ChevronRight,
  Terminal,
  Globe,
  MessageSquare,
  Bot,
  Info,
} from "lucide-react";
import {
  useHooksStore,
  HOOK_EVENTS,
  HOOK_EVENT_CATEGORIES,
  type HookHandler,
  type FlatHookEntry,
  type HooksScope,
} from "../../stores/hooksStore";
import { useUIStore } from "../../stores/uiStore";

const INPUT_CLS =
  "w-full text-xs bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-glow/30";
const SELECT_CLS =
  "text-xs bg-[#1e1b2e] border border-white/10 rounded-md px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-amber-glow/30 [&_option]:bg-[#1e1b2e] [&_option]:text-slate-200 [&_optgroup]:bg-[#161322] [&_optgroup]:text-slate-400 [&_optgroup]:font-medium";

const SCOPE_LABELS: Record<HooksScope, string> = {
  user: "用户级",
  project: "项目级",
  "project-local": "项目本地",
};

const SCOPE_DESCS: Record<HooksScope, string> = {
  user: "~/.claude/settings.json",
  project: ".claude/settings.json",
  "project-local": ".claude/settings.local.json",
};

const TYPE_ICON: Record<string, typeof Terminal> = {
  command: Terminal,
  http: Globe,
  prompt: MessageSquare,
  agent: Bot,
};

const TYPE_LABELS: Record<string, string> = {
  command: "命令",
  http: "HTTP",
  prompt: "Prompt",
  agent: "Agent",
};

const TYPE_COLORS: Record<string, string> = {
  command: "bg-emerald-ok/10 text-emerald-ok",
  http: "bg-sky-link/10 text-sky-link",
  prompt: "bg-violet-info/10 text-violet-info",
  agent: "bg-amber-glow/10 text-amber-glow",
};

export default function HooksManager() {
  const { entries, scope, loading, loadHooks, setScope, addEntry, removeEntry, updateEntry } = useHooksStore();
  const projectPath = useUIStore((s) => s.projectPath);

  const [showAdd, setShowAdd] = useState(false);
  const [addEvent, setAddEvent] = useState("PreToolUse");
  const [addMatcher, setAddMatcher] = useState("");
  const [addType, setAddType] = useState<HookHandler["type"]>("command");
  const [addCommand, setAddCommand] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [addPrompt, setAddPrompt] = useState("");
  const [addTimeout, setAddTimeout] = useState("");
  const [addAsync, setAddAsync] = useState(false);

  const [editing, setEditing] = useState<number | null>(null);
  const [editEntry, setEditEntry] = useState<FlatHookEntry | null>(null);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showMatcherHint, setShowMatcherHint] = useState(false);

  useEffect(() => { loadHooks(undefined, projectPath); }, [loadHooks, projectPath]);

  // Get matcher hint for selected event
  const selectedEventDef = HOOK_EVENTS.find((e) => e.id === addEvent);

  const resetAddForm = () => {
    setAddCommand(""); setAddUrl(""); setAddPrompt("");
    setAddMatcher(""); setAddTimeout(""); setAddAsync(false);
    setShowAdd(false);
  };

  const handleAdd = () => {
    const handler = buildHandler(addType, addCommand, addUrl, addPrompt, addTimeout, addAsync);
    if (!handler) return;
    addEntry({ event: addEvent, matcher: addMatcher.trim(), handler }, projectPath);
    resetAddForm();
  };

  const startEdit = (index: number) => {
    const entry = entries[index];
    setEditing(index);
    setEditEntry({ ...entry, handler: { ...entry.handler } });
  };

  const handleSaveEdit = () => {
    if (editing === null || !editEntry) return;
    updateEntry(editing, editEntry, projectPath);
    setEditing(null);
    setEditEntry(null);
  };

  const handleScopeChange = (s: HooksScope) => {
    setScope(s, projectPath);
  };

  // Group entries by event for display
  const eventGroups = new Map<string, { entries: FlatHookEntry[]; indices: number[] }>();
  entries.forEach((entry, idx) => {
    if (!eventGroups.has(entry.event)) eventGroups.set(entry.event, { entries: [], indices: [] });
    const g = eventGroups.get(entry.event)!;
    g.entries.push(entry);
    g.indices.push(idx);
  });

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={16} className="animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* ── Scope tabs ── */}
      <div className="flex gap-1 p-0.5 rounded-lg bg-white/[0.03] border border-white/5">
        {(["user", "project", "project-local"] as HooksScope[]).map((s) => (
          <button
            key={s}
            onClick={() => handleScopeChange(s)}
            className={`flex-1 text-[10px] py-1.5 rounded-md transition-colors ${
              scope === s
                ? "bg-white/10 text-slate-200 font-medium"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {SCOPE_LABELS[s]}
          </button>
        ))}
      </div>
      <p className="text-[9px] text-slate-500 font-mono">{SCOPE_DESCS[scope]}</p>

      {/* ── Add button ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md
                     bg-[#ca5d3d] hover:bg-amber-glow text-white font-medium
                     transition-colors shadow-sm shadow-[#703123]/30"
        >
          <Plus size={12} /> 添加 Hook
        </button>
      </div>

      {/* ── Add form ── */}
      {showAdd && (
        <div className="p-3 rounded-xl border border-white/10 bg-white/[0.03] space-y-2.5">
          {/* Event selector */}
          <div>
            <label className="text-[10px] text-slate-500 mb-1 block">事件</label>
            <select
              value={addEvent}
              onChange={(e) => setAddEvent(e.target.value)}
              className={SELECT_CLS + " w-full"}
            >
              {HOOK_EVENT_CATEGORIES.map((cat) => (
                <optgroup key={cat} label={cat}>
                  {HOOK_EVENTS.filter((ev) => ev.category === cat).map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.id} — {ev.desc}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Matcher */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="text-[10px] text-slate-500">Matcher 正则</label>
              <button
                onClick={() => setShowMatcherHint(!showMatcherHint)}
                className="text-slate-500 hover:text-slate-300"
              >
                <Info size={9} />
              </button>
            </div>
            {showMatcherHint && selectedEventDef && (
              <p className="text-[9px] text-violet-info/80 mb-1 font-mono">{selectedEventDef.matcherHint}</p>
            )}
            <input
              value={addMatcher}
              onChange={(e) => setAddMatcher(e.target.value)}
              placeholder="可选, 如 Edit|Write 或留空匹配全部"
              className={INPUT_CLS}
            />
          </div>

          {/* Hook type */}
          <div>
            <label className="text-[10px] text-slate-500 mb-1 block">类型</label>
            <div className="flex gap-1">
              {(["command", "http", "prompt", "agent"] as const).map((t) => {
                const Icon = TYPE_ICON[t];
                return (
                  <button
                    key={t}
                    onClick={() => setAddType(t)}
                    className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-colors ${
                      addType === t
                        ? "bg-white/10 border-white/20 text-slate-200"
                        : "border-white/5 text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    <Icon size={10} /> {TYPE_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Type-specific fields */}
          {addType === "command" && (
            <input
              value={addCommand}
              onChange={(e) => setAddCommand(e.target.value)}
              placeholder="命令 (如 npm run lint)"
              className={INPUT_CLS}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          )}
          {addType === "http" && (
            <input
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
              placeholder="URL (如 http://localhost:8080/hooks)"
              className={INPUT_CLS}
            />
          )}
          {(addType === "prompt" || addType === "agent") && (
            <textarea
              value={addPrompt}
              onChange={(e) => setAddPrompt(e.target.value)}
              placeholder={addType === "prompt" ? 'Prompt (返回 {"ok": true/false})' : "Agent 指令"}
              rows={3}
              className="w-full text-xs font-mono bg-white/5 border border-white/10 rounded-md
                         px-2.5 py-2 text-slate-200 placeholder-slate-500 focus:outline-none
                         focus:border-amber-glow/30 resize-none leading-relaxed"
            />
          )}

          {/* Optional: timeout & async */}
          <div className="flex gap-2 items-center">
            <input
              value={addTimeout}
              onChange={(e) => setAddTimeout(e.target.value)}
              placeholder="超时秒数 (可选)"
              className={INPUT_CLS + " w-28"}
              type="number"
            />
            <label className="flex items-center gap-1 text-[10px] text-slate-400">
              <input
                type="checkbox"
                checked={addAsync}
                onChange={(e) => setAddAsync(e.target.checked)}
                className="rounded border-white/20"
              />
              异步
            </label>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={resetAddForm}
              className="text-xs px-3 py-1.5 rounded-md text-slate-400 hover:text-slate-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleAdd}
              className="text-xs px-3 py-1.5 rounded-md bg-amber-glow/10 text-amber-glow
                         hover:bg-amber-glow/20 border border-amber-glow/20 transition-colors"
            >
              添加
            </button>
          </div>
        </div>
      )}

      {/* ── Hooks list grouped by event ── */}
      {eventGroups.size === 0 && !showAdd ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
            <Webhook size={16} className="text-slate-500" />
          </div>
          <p className="text-xs text-slate-500">当前 scope 暂无已配置的 Hook</p>
        </div>
      ) : (
        <div className="space-y-2">
          {Array.from(eventGroups.entries()).map(([event, group]) => {
            const isCollapsed = collapsed[event];
            const eventDef = HOOK_EVENTS.find((e) => e.id === event);

            return (
              <div
                key={event}
                className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden"
              >
                {/* Event header */}
                <button
                  onClick={() => setCollapsed((p) => ({ ...p, [event]: !p[event] }))}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-white/[0.03] transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRight size={12} className="text-slate-500" />
                  ) : (
                    <ChevronDown size={12} className="text-slate-500" />
                  )}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-ok/10 text-emerald-ok font-medium">
                    {event}
                  </span>
                  {eventDef && (
                    <span className="text-[10px] text-slate-500">{eventDef.desc}</span>
                  )}
                  <span className="text-[10px] text-slate-500 ml-auto">
                    {group.entries.length} 个
                  </span>
                </button>

                {/* Entries under this event */}
                {!isCollapsed && (
                  <div className="border-t border-white/5">
                    {group.entries.map((entry, localIdx) => {
                      const globalIdx = group.indices[localIdx];
                      const isEditing = editing === globalIdx;
                      const Icon = TYPE_ICON[entry.handler.type] || Terminal;

                      if (isEditing && editEntry) {
                        return (
                          <EditEntryForm
                            key={globalIdx}
                            entry={editEntry}
                            onChange={setEditEntry}
                            onSave={handleSaveEdit}
                            onCancel={() => { setEditing(null); setEditEntry(null); }}
                          />
                        );
                      }

                      return (
                        <div
                          key={globalIdx}
                          className="flex items-start gap-2 px-3 py-2 border-b border-white/5 last:border-0
                                     hover:bg-white/[0.02] transition-colors"
                        >
                          <Icon size={10} className="text-slate-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${TYPE_COLORS[entry.handler.type]}`}>
                                {TYPE_LABELS[entry.handler.type]}
                              </span>
                              {entry.matcher && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-info/10 text-violet-info
                                                 border border-violet-info/10 font-mono">
                                  {entry.matcher}
                                </span>
                              )}
                              {entry.handler.async && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-sky-link/10 text-sky-link">async</span>
                              )}
                              {entry.handler.timeout && (
                                <span className="text-[9px] text-slate-500">{entry.handler.timeout}s</span>
                              )}
                            </div>
                            <code className="text-xs font-mono text-slate-300 block mt-0.5 truncate">
                              {getHandlerSummary(entry.handler)}
                            </code>
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button
                              onClick={() => startEdit(globalIdx)}
                              className="p-1 rounded-md hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors"
                            >
                              <Pencil size={10} />
                            </button>
                            <button
                              onClick={() => removeEntry(globalIdx, projectPath)}
                              className="p-1 rounded-md hover:bg-rose-err/10 text-slate-400 hover:text-rose-err transition-colors"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Quick reference ── */}
      <details className="text-[10px] text-slate-500">
        <summary className="hover:text-slate-300 transition-colors">
          退出码与环境变量参考
        </summary>
        <div className="mt-1.5 p-2 rounded-lg bg-white/[0.02] border border-white/5 space-y-1 font-mono text-[9px] text-slate-400">
          <p>exit 0 = 放行 | exit 2 = 拦截（stderr 作为反馈）</p>
          <p>$CLAUDE_PROJECT_DIR · $CLAUDE_SESSION_ID · $CLAUDE_CWD</p>
          <p>$CLAUDE_BRANCH · $CLAUDE_TOOL_NAME · $CLAUDE_HOOK_EVENT_NAME</p>
        </div>
      </details>
    </div>
  );
}

// ── Helpers ──

function getHandlerSummary(h: HookHandler): string {
  switch (h.type) {
    case "command": return h.command;
    case "http": return `${h.method || "POST"} ${h.url}`;
    case "prompt": return h.prompt.slice(0, 80) + (h.prompt.length > 80 ? "..." : "");
    case "agent": return h.prompt.slice(0, 80) + (h.prompt.length > 80 ? "..." : "");
  }
}

function buildHandler(
  type: HookHandler["type"],
  command: string, url: string, prompt: string,
  timeoutStr: string, isAsync: boolean,
): HookHandler | null {
  const timeout = timeoutStr ? parseInt(timeoutStr, 10) : undefined;
  const base = { timeout: timeout || undefined, async: isAsync || undefined };

  switch (type) {
    case "command":
      if (!command.trim()) return null;
      return { type: "command", command: command.trim(), ...base };
    case "http":
      if (!url.trim()) return null;
      return { type: "http", url: url.trim(), ...base };
    case "prompt":
      if (!prompt.trim()) return null;
      return { type: "prompt", prompt: prompt.trim(), ...base };
    case "agent":
      if (!prompt.trim()) return null;
      return { type: "agent", prompt: prompt.trim(), allowToolUse: true, ...base };
  }
}

// ── Inline edit form ──

function EditEntryForm({
  entry,
  onChange,
  onSave,
  onCancel,
}: {
  entry: FlatHookEntry;
  onChange: (e: FlatHookEntry) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const h = entry.handler;

  const updateHandler = (patch: Partial<HookHandler>) => {
    onChange({ ...entry, handler: { ...h, ...patch } as HookHandler });
  };

  return (
    <div className="p-2.5 border-b border-white/5 space-y-2 bg-white/[0.02]">
      <input
        value={entry.matcher}
        onChange={(e) => onChange({ ...entry, matcher: e.target.value })}
        placeholder="Matcher (可选)"
        className={INPUT_CLS}
      />
      {h.type === "command" && (
        <input
          value={(h as { command: string }).command}
          onChange={(e) => updateHandler({ command: e.target.value } as Partial<HookHandler>)}
          placeholder="命令"
          className={INPUT_CLS}
        />
      )}
      {h.type === "http" && (
        <input
          value={(h as { url: string }).url}
          onChange={(e) => updateHandler({ url: e.target.value } as Partial<HookHandler>)}
          placeholder="URL"
          className={INPUT_CLS}
        />
      )}
      {(h.type === "prompt" || h.type === "agent") && (
        <textarea
          value={(h as { prompt: string }).prompt}
          onChange={(e) => updateHandler({ prompt: e.target.value } as Partial<HookHandler>)}
          placeholder="Prompt"
          rows={3}
          className="w-full text-xs font-mono bg-white/5 border border-white/10 rounded-md
                     px-2.5 py-2 text-slate-200 placeholder-slate-500 focus:outline-none
                     focus:border-amber-glow/30 resize-none leading-relaxed"
        />
      )}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          取消
        </button>
        <button
          onClick={onSave}
          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md
                     bg-amber-glow/10 text-amber-glow hover:bg-amber-glow/20
                     border border-amber-glow/20 transition-colors"
        >
          <Save size={10} /> 保存
        </button>
      </div>
    </div>
  );
}
