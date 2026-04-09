import { useEffect, useState } from "react";
import {
  Plug,
  Plus,
  Trash2,
  RefreshCw,
  Upload,
  Terminal,
  Globe,
  Loader2,
  Radio,
  Lock,
  ChevronDown,
  ChevronRight,
  Wrench,
  FileCode,
  Save,
  X,
} from "lucide-react";
import { useMcpStore } from "../../stores/mcpStore";
import { useUIStore } from "../../stores/uiStore";
import { api } from "../../services/api";

const INPUT_CLS = "w-full text-xs bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-glow/30";
const SELECT_CLS = "text-xs bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-slate-200 focus:outline-none";
const SMALL_INPUT_CLS = "flex-1 text-xs bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-glow/30";

const SCOPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  user:    { bg: "bg-purple-500/10",  text: "text-purple-400", label: "用户级" },
  project: { bg: "bg-sky-500/10",     text: "text-sky-400",    label: "项目级" },
  local:   { bg: "bg-slate-500/10",   text: "text-slate-400",  label: "本地" },
};

function ScopeBadge({ scope }: { scope: string }) {
  const badge = SCOPE_BADGE[scope] || SCOPE_BADGE.local;
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}>
      {badge.label}
    </span>
  );
}

type FormMode = "form" | "json";
type Transport = "http" | "sse" | "stdio";
type Scope = "local" | "project" | "user";

interface KVPair { key: string; value: string }

const INITIAL_FORM = {
  mode: "form" as FormMode,
  name: "",
  transport: "http" as Transport,
  url: "",
  command: "",
  args: "",
  scope: "local" as Scope,
  envPairs: [] as KVPair[],
  headers: [] as KVPair[],
  clientId: "",
  clientSecret: "",
  callbackPort: "",
  jsonText: "",
};

const JSON_PLACEHOLDER = `{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-xxx"],
  "env": { "API_KEY": "your-key" }
}`;

export default function McpManager() {
  const { servers, loading, loadServers, addServer, addServerJson, removeServer, importFromDesktop } =
    useMcpStore();
  const projectPath = useUIStore((s) => s.projectPath);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [configEditor, setConfigEditor] = useState<string | null>(null);

  useEffect(() => { loadServers(); }, [loadServers]);

  // Clear import message after 5s
  useEffect(() => {
    if (!importMsg) return;
    const t = setTimeout(() => setImportMsg(null), 5000);
    return () => clearTimeout(t);
  }, [importMsg]);

  const isUrlTransport = form.transport === "http" || form.transport === "sse";

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setShowAdvanced(false);
    setAddError(null);
  };

  const handleAdd = async () => {
    setAddError(null);
    if (!form.name.trim()) {
      setAddError("请输入服务器名称");
      return;
    }

    setAdding(true);
    try {
      if (form.mode === "json") {
        // JSON mode
        if (!form.jsonText.trim()) {
          setAddError("请输入 JSON 配置");
          setAdding(false);
          return;
        }
        // Validate JSON
        try { JSON.parse(form.jsonText); } catch {
          setAddError("JSON 格式错误");
          setAdding(false);
          return;
        }
        await addServerJson(form.name.trim(), form.jsonText.trim(), form.scope);
      } else {
        // Form mode
        const env: Record<string, string> = {};
        for (const p of form.envPairs) {
          if (p.key.trim()) env[p.key.trim()] = p.value;
        }
        const headers: Record<string, string> = {};
        for (const p of form.headers) {
          if (p.key.trim()) headers[p.key.trim()] = p.value;
        }

        await addServer({
          name: form.name.trim(),
          transport: form.transport,
          url: isUrlTransport ? form.url : undefined,
          command: !isUrlTransport ? form.command : undefined,
          args: !isUrlTransport ? form.args.split(" ").filter(Boolean) : undefined,
          scope: form.scope,
          env: Object.keys(env).length > 0 ? env : undefined,
          headers: Object.keys(headers).length > 0 ? headers : undefined,
          clientId: form.clientId || undefined,
          clientSecret: form.clientSecret || undefined,
          callbackPort: form.callbackPort ? Number(form.callbackPort) : undefined,
        });
      }
      setShowAdd(false);
      resetForm();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "添加失败");
    } finally {
      setAdding(false);
    }
  };

  const handleImport = async () => {
    setImportMsg(null);
    try {
      const imported = await importFromDesktop();
      if (imported.length > 0) {
        setImportMsg({ type: "success", text: `已导入 ${imported.length} 个 MCP 服务器` });
      } else {
        setImportMsg({ type: "success", text: "未发现可导入的 MCP 服务器" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const lower = msg.toLowerCase();
      if (lower.includes("unsupported") || lower.includes("not supported") || lower.includes("only works on") || lower.includes("windows") || lower.includes("darwin") || lower.includes("wsl") || lower.includes("macos")) {
        setImportMsg({ type: "error", text: "仅支持 macOS / WSL 环境，Windows 原生不支持此功能" });
      } else {
        setImportMsg({ type: "error", text: `导入失败: ${msg}` });
      }
    }
  };

  const updateKV = (
    field: "envPairs" | "headers",
    index: number,
    key: "key" | "value",
    val: string
  ) => {
    const arr = [...form[field]];
    arr[index] = { ...arr[index], [key]: val };
    setForm({ ...form, [field]: arr });
  };

  const removeKV = (field: "envPairs" | "headers", index: number) => {
    const arr = form[field].filter((_, i) => i !== index);
    setForm({ ...form, [field]: arr });
  };

  const addKV = (field: "envPairs" | "headers") => {
    setForm({ ...form, [field]: [...form[field], { key: "", value: "" }] });
  };

  return (
    <div className="p-3 space-y-3">
      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setShowAdd(!showAdd); if (showAdd) resetForm(); }}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md
                     bg-[#ca5d3d] hover:bg-amber-glow text-white font-medium
                     transition-colors shadow-sm shadow-[#703123]/30"
        >
          <Plus size={12} /> 添加 MCP Server
        </button>
        <button
          onClick={handleImport}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md
                     bg-white/5 text-slate-300 hover:bg-white/8 border border-white/8
                     hover:border-white/15 transition-colors"
          title="从 Claude Desktop 导入（仅 macOS/WSL）"
        >
          <Upload size={12} /> Desktop 导入
        </button>
        <button
          onClick={loadServers}
          className="p-1.5 rounded-md hover:bg-white/5 text-slate-500
                     hover:text-slate-300 transition-colors"
          title="刷新"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Import feedback */}
      {importMsg && (
        <div className={`text-xs px-3 py-2 rounded-lg flex items-center justify-between ${
          importMsg.type === "success"
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
        }`}>
          <span>{importMsg.text}</span>
          <button onClick={() => setImportMsg(null)} className="ml-2 hover:opacity-70">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="p-3 rounded-xl border border-white/10 bg-white/[0.03] space-y-3">
          {/* Mode toggle */}
          <div className="flex gap-1 p-0.5 bg-white/5 rounded-lg w-fit">
            <button
              onClick={() => setForm({ ...form, mode: "form" })}
              className={`text-[10px] px-3 py-1 rounded-md transition-colors ${
                form.mode === "form"
                  ? "bg-amber-glow/15 text-amber-glow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              表单模式
            </button>
            <button
              onClick={() => setForm({ ...form, mode: "json" })}
              className={`text-[10px] px-3 py-1 rounded-md transition-colors ${
                form.mode === "json"
                  ? "bg-amber-glow/15 text-amber-glow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              JSON 模式
            </button>
          </div>

          {/* Common: name + scope */}
          <div className="flex gap-2">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="服务器名称"
              className={`${INPUT_CLS} flex-1`}
            />
            <select
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value as Scope })}
              className={SELECT_CLS}
            >
              <option value="local">本地</option>
              <option value="project">项目级</option>
              <option value="user">用户级</option>
            </select>
          </div>

          {form.mode === "form" ? (
            <>
              {/* Transport + URL/Command */}
              <div className="flex gap-2">
                <select
                  value={form.transport}
                  onChange={(e) => setForm({ ...form, transport: e.target.value as Transport })}
                  className={SELECT_CLS}
                >
                  <option value="http">HTTP</option>
                  <option value="sse">SSE</option>
                  <option value="stdio">Stdio</option>
                </select>
              </div>

              {isUrlTransport ? (
                <input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder={form.transport === "sse" ? "SSE URL (https://...)" : "URL (https://...)"}
                  className={INPUT_CLS}
                />
              ) : (
                <>
                  <input
                    value={form.command}
                    onChange={(e) => setForm({ ...form, command: e.target.value })}
                    placeholder="命令 (npx, node...)"
                    className={INPUT_CLS}
                  />
                  <input
                    value={form.args}
                    onChange={(e) => setForm({ ...form, args: e.target.value })}
                    placeholder="参数 (空格分隔)"
                    className={INPUT_CLS}
                  />
                </>
              )}

              {/* Environment Variables (stdio) */}
              {!isUrlTransport && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">环境变量</span>
                    <button
                      onClick={() => addKV("envPairs")}
                      className="text-[10px] text-amber-glow/70 hover:text-amber-glow transition-colors"
                    >
                      + 添加
                    </button>
                  </div>
                  {form.envPairs.map((p, i) => (
                    <div key={i} className="flex gap-1.5 items-center">
                      <input
                        value={p.key}
                        onChange={(e) => updateKV("envPairs", i, "key", e.target.value)}
                        placeholder="KEY"
                        className={SMALL_INPUT_CLS}
                      />
                      <span className="text-slate-600 text-xs">=</span>
                      <input
                        value={p.value}
                        onChange={(e) => updateKV("envPairs", i, "value", e.target.value)}
                        placeholder="value"
                        className={SMALL_INPUT_CLS}
                      />
                      <button
                        onClick={() => removeKV("envPairs", i)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Headers (http/sse) */}
              {isUrlTransport && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Headers</span>
                    <button
                      onClick={() => addKV("headers")}
                      className="text-[10px] text-amber-glow/70 hover:text-amber-glow transition-colors"
                    >
                      + 添加
                    </button>
                  </div>
                  {form.headers.map((p, i) => (
                    <div key={i} className="flex gap-1.5 items-center">
                      <input
                        value={p.key}
                        onChange={(e) => updateKV("headers", i, "key", e.target.value)}
                        placeholder="Header-Name"
                        className={SMALL_INPUT_CLS}
                      />
                      <span className="text-slate-600 text-xs">:</span>
                      <input
                        value={p.value}
                        onChange={(e) => updateKV("headers", i, "value", e.target.value)}
                        placeholder="value"
                        className={SMALL_INPUT_CLS}
                      />
                      <button
                        onClick={() => removeKV("headers", i)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Advanced: OAuth (http/sse only) */}
              {isUrlTransport && (
                <div>
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showAdvanced ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    高级选项（OAuth）
                  </button>
                  {showAdvanced && (
                    <div className="mt-2 space-y-2 pl-3 border-l border-white/5">
                      <input
                        value={form.clientId}
                        onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                        placeholder="OAuth Client ID"
                        className={INPUT_CLS}
                      />
                      <input
                        type="password"
                        value={form.clientSecret}
                        onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                        placeholder="OAuth Client Secret"
                        className={INPUT_CLS}
                      />
                      <input
                        type="number"
                        value={form.callbackPort}
                        onChange={(e) => setForm({ ...form, callbackPort: e.target.value })}
                        placeholder="Callback Port（可选）"
                        className={INPUT_CLS}
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* JSON mode */
            <div className="space-y-2">
              <textarea
                value={form.jsonText}
                onChange={(e) => setForm({ ...form, jsonText: e.target.value })}
                placeholder={JSON_PLACEHOLDER}
                rows={8}
                className="w-full text-[11px] font-mono bg-white/[0.03] border border-white/8
                           rounded-md px-2.5 py-2 text-slate-300 placeholder-slate-600
                           focus:outline-none focus:border-amber-glow/30 resize-none leading-relaxed"
              />
              <p className="text-[9px] text-slate-600">
                粘贴完整 MCP 服务器 JSON 配置（对应 <code className="text-slate-500">claude mcp add-json</code>）
              </p>
            </div>
          )}

          {/* Error */}
          {addError && (
            <p className="text-[10px] text-rose-400">{addError}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setShowAdd(false); resetForm(); }}
              className="text-xs px-3 py-1.5 rounded-md text-slate-400
                         hover:text-slate-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleAdd}
              disabled={adding}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-amber-glow/10 text-amber-glow
                         hover:bg-amber-glow/20 border border-amber-glow/20 transition-colors
                         disabled:opacity-40"
            >
              {adding && <Loader2 size={10} className="animate-spin" />}
              添加
            </button>
          </div>
        </div>
      )}

      {/* Server list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={16} className="animate-spin text-slate-500" />
        </div>
      ) : servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
            <Plug size={16} className="text-slate-500" />
          </div>
          <p className="text-xs text-slate-500">暂无 MCP Server</p>
        </div>
      ) : (
        <div className="space-y-2">
          {servers.map((s) => {
            const isExpanded = expandedServer === s.name;
            const sIsUrlTransport = s.transport === "http" || s.transport === "sse";
            const transportIcon = s.transport === "sse"
              ? <Radio size={10} />
              : s.transport === "http"
                ? <Globe size={10} />
                : <Terminal size={10} />;

            return (
              <div
                key={s.name}
                className="rounded-xl border border-white/8 bg-white/[0.02]
                           hover:border-white/12 transition-colors overflow-hidden"
              >
                <div className="p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Plug size={13} className="text-violet-info" />
                      <span className="text-xs font-medium text-slate-200">{s.name}</span>
                      <ScopeBadge scope={s.scope} />
                      {sIsUrlTransport && s.url?.includes("oauth") && (
                        <span title="需要 OAuth"><Lock size={10} className="text-amber-glow" /></span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setConfigEditor(configEditor === s.name ? null : s.name)}
                        className={`p-1.5 rounded-md transition-colors ${
                          configEditor === s.name
                            ? "bg-amber-glow/10 text-amber-glow"
                            : "hover:bg-white/5 text-slate-400 hover:text-slate-200"
                        }`}
                        title="查看/编辑配置"
                      >
                        <FileCode size={11} />
                      </button>
                      <button
                        onClick={() => removeServer(s.name)}
                        className="p-1.5 rounded-md hover:bg-rose-err/10 text-slate-400
                                   hover:text-rose-err transition-colors"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono pl-5">
                    {transportIcon}
                    <span>{s.transport} | {s.url || s.command}</span>
                    {s.toolCount !== undefined && s.toolCount > 0 && (
                      <button
                        onClick={() => setExpandedServer(isExpanded ? null : s.name)}
                        className="inline-flex items-center gap-0.5 hover:text-slate-300 transition-colors"
                      >
                        <Wrench size={9} />
                        <span>工具: {s.toolCount}</span>
                        {isExpanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
                      </button>
                    )}
                    {s.toolCount !== undefined && s.toolCount === 0 && (
                      <span>| 工具: 0</span>
                    )}
                  </div>
                </div>

                {/* Expanded tool list */}
                {isExpanded && s.toolCount !== undefined && s.toolCount > 0 && (
                  <div className="border-t border-white/5 px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Wrench size={10} className="text-slate-500" />
                      <span className="text-[10px] text-slate-500">已注册 {s.toolCount} 个工具</span>
                    </div>
                    <p className="text-[10px] text-slate-600 italic">
                      工具详情需从 MCP 服务器实时获取
                    </p>
                  </div>
                )}

                {/* Config editor */}
                {configEditor === s.name && (
                  <McpConfigEditor
                    serverName={s.name}
                    scope={s.scope}
                    projectPath={projectPath}
                    onClose={() => setConfigEditor(null)}
                    onSaved={loadServers}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function McpConfigEditor({
  serverName,
  scope,
  projectPath,
  onClose,
  onSaved,
}: {
  serverName: string;
  scope: string;
  projectPath: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [configText, setConfigText] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [configScope, setConfigScope] = useState(scope);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.getMcpServerConfig(serverName, projectPath);
        const text = JSON.stringify(result.config, null, 2);
        setConfigText(text);
        setOriginalText(text);
        setConfigScope(result.scope);
      } catch {
        setError("无法加载配置");
      } finally {
        setLoading(false);
      }
    })();
  }, [serverName, projectPath]);

  const handleSave = async () => {
    setError(null);
    try {
      const parsed = JSON.parse(configText);
      setSaving(true);
      await api.updateMcpServerConfig(serverName, parsed, configScope, projectPath);
      setOriginalText(configText);
      onSaved();
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError("JSON 格式错误");
      } else {
        setError(err instanceof Error ? err.message : "保存失败");
      }
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = configText !== originalText;

  return (
    <div className="border-t border-white/5 px-3 py-2 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FileCode size={10} className="text-slate-500" />
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">JSON 配置</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X size={10} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={14} className="animate-spin text-slate-500" />
        </div>
      ) : (
        <>
          <textarea
            value={configText}
            onChange={(e) => { setConfigText(e.target.value); setError(null); }}
            rows={8}
            className="w-full text-[11px] font-mono bg-white/[0.03] border border-white/8
                       rounded-md px-2.5 py-2 text-slate-300 placeholder-slate-600
                       focus:outline-none focus:border-amber-glow/30 resize-none leading-relaxed"
          />
          {error && (
            <p className="text-[10px] text-rose-err">{error}</p>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-md
                         bg-amber-glow/10 text-amber-glow hover:bg-amber-glow/20
                         border border-amber-glow/20 transition-colors disabled:opacity-40"
            >
              {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
              保存配置
            </button>
            {hasChanges && (
              <span className="text-[9px] text-amber-glow/60">未保存的更改</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
