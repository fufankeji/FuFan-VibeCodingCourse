import { useEffect, useState, useRef, useCallback } from "react";
import {
  Package,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Zap,
  Plug,
  Bot,
  Webhook,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Store,
  Search,
} from "lucide-react";
import { usePluginStore } from "../../stores/pluginStore";
import { useMarketplaceStore } from "../../stores/marketplaceStore";
import MarketplacePanel from "./MarketplacePanel";

const SCOPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  user:    { bg: "bg-purple-500/10",  text: "text-purple-400", label: "用户级" },
  project: { bg: "bg-sky-500/10",     text: "text-sky-400",    label: "项目级" },
  local:   { bg: "bg-slate-500/10",   text: "text-slate-400",  label: "本地" },
};

function ScopeBadge({ scope }: { scope?: string }) {
  if (!scope) return null;
  const badge = SCOPE_BADGE[scope] || SCOPE_BADGE.user;
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}>
      {badge.label}
    </span>
  );
}

export default function PluginManager() {
  const { plugins, loading, loadPlugins, installPlugin, uninstallPlugin, togglePlugin } =
    usePluginStore();
  const { availablePlugins, loadAvailable } = useMarketplaceStore();
  const [view, setView] = useState<"installed" | "marketplace">("installed");
  const [showInstall, setShowInstall] = useState(false);
  const [installName, setInstallName] = useState("");
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [expandedPlugin, setExpandedPlugin] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadPlugins(); }, [loadPlugins]);

  // Load marketplace data when install form opens (for autocomplete)
  useEffect(() => {
    if (showInstall && availablePlugins.length === 0) {
      loadAvailable();
    }
  }, [showInstall, availablePlugins.length, loadAvailable]);

  // Filter suggestions based on input
  const suggestions = useCallback(() => {
    if (!installName.trim()) return availablePlugins.filter((p) => !p.installed).slice(0, 8);
    const q = installName.toLowerCase();
    return availablePlugins
      .filter((p) => !p.installed && (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        `${p.name}@${p.marketplace}`.toLowerCase().includes(q)
      ))
      .slice(0, 8);
  }, [installName, availablePlugins])();

  const handleInstall = async () => {
    if (!installName) return;
    setInstalling(true);
    setInstallError(null);
    setShowSuggestions(false);
    try {
      await installPlugin(installName);
      setShowInstall(false);
      setInstallName("");
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : "安装失败");
    } finally {
      setInstalling(false);
    }
  };

  const selectSuggestion = (name: string, marketplace: string) => {
    setInstallName(`${name}@${marketplace}`);
    setShowSuggestions(false);
    setHighlightIdx(-1);
    inputRef.current?.focus();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === "Enter") handleInstall();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < suggestions.length) {
        const s = suggestions[highlightIdx];
        selectSuggestion(s.name, s.marketplace);
      } else {
        handleInstall();
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="p-3 space-y-3">
      {/* View toggle */}
      <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/5 w-fit">
        <button
          onClick={() => setView("installed")}
          className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
            view === "installed"
              ? "bg-white/10 text-slate-200"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          已安装
        </button>
        <button
          onClick={() => setView("marketplace")}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors ${
            view === "marketplace"
              ? "bg-white/10 text-slate-200"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Store size={11} /> 市场
        </button>
      </div>

      {view === "marketplace" ? (
        <MarketplacePanel onInstalled={loadPlugins} />
      ) : (
        <>
          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInstall(!showInstall)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md
                         bg-[#ca5d3d] hover:bg-amber-glow text-white font-medium
                         transition-colors shadow-sm shadow-[#703123]/30"
            >
              <Plus size={12} /> 安装 Plugin
            </button>
          </div>

          {/* Install form with autocomplete */}
          {showInstall && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    value={installName}
                    onChange={(e) => { setInstallName(e.target.value); setInstallError(null); setShowSuggestions(true); setHighlightIdx(-1); }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => { setTimeout(() => setShowSuggestions(false), 200); }}
                    placeholder="输入插件名搜索，或从下方选择..."
                    className="w-full text-xs bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5
                               text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-glow/30"
                    disabled={installing}
                    onKeyDown={handleInputKeyDown}
                  />
                  {/* Autocomplete dropdown */}
                  {showSuggestions && !installing && suggestions.length > 0 && (
                    <div
                      ref={suggestionsRef}
                      className="absolute z-20 left-0 right-0 top-full mt-1 rounded-lg border border-white/10 overflow-hidden shadow-xl shadow-black/40"
                      style={{ background: "rgba(30, 27, 46, 0.95)", backdropFilter: "blur(12px)" }}
                    >
                      <div className="px-2.5 py-1.5 border-b border-white/5 flex items-center gap-1.5">
                        <Search size={10} className="text-slate-500" />
                        <span className="text-[9px] text-slate-500">
                          {installName.trim() ? `匹配到 ${suggestions.length} 个插件` : "可用插件（输入关键词过滤）"}
                        </span>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto py-1">
                        {suggestions.map((s, i) => (
                          <button
                            key={`${s.name}@${s.marketplace}`}
                            onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s.name, s.marketplace); }}
                            onMouseEnter={() => setHighlightIdx(i)}
                            className={`w-full text-left px-3 py-2 transition-colors ${
                              i === highlightIdx ? "bg-amber-glow/10" : "hover:bg-white/5"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Package size={11} className="flex-shrink-0 text-violet-info" />
                              <span className="text-xs font-medium text-slate-200">{s.name}</span>
                              <span className="text-[9px] text-slate-500 font-mono">@{s.marketplace}</span>
                              {s.isExternal && (
                                <span className="text-[8px] px-1 py-0 rounded bg-amber-glow/10 text-amber-glow">外部</span>
                              )}
                              {s.installCount != null && s.installCount > 0 && (
                                <span className="text-[9px] text-slate-600 ml-auto">{s.installCount.toLocaleString()} 安装</span>
                              )}
                            </div>
                            {s.description && (
                              <p className="text-[10px] text-slate-500 mt-0.5 pl-5 truncate">{s.description}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Empty hint when no marketplace data */}
                  {showSuggestions && !installing && availablePlugins.length === 0 && (
                    <div
                      className="absolute z-20 left-0 right-0 top-full mt-1 rounded-lg border border-white/10 px-3 py-3 shadow-xl shadow-black/40"
                      style={{ background: "rgba(30, 27, 46, 0.95)", backdropFilter: "blur(12px)" }}
                    >
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        暂无 Marketplace 数据。格式：<code className="text-amber-glow/80 bg-amber-glow/5 px-1 rounded">name@marketplace</code>
                      </p>
                      <p className="text-[10px] text-slate-600 mt-1">
                        例：<code className="text-slate-400">github@official</code>　也可在终端执行 <code className="text-slate-400">claude plugin marketplace update</code> 后重试
                      </p>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleInstall}
                  disabled={installing || !installName.trim()}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-amber-glow/10 text-amber-glow
                             hover:bg-amber-glow/20 border border-amber-glow/20 transition-colors
                             disabled:opacity-50 flex-shrink-0"
                >
                  {installing ? <><Loader2 size={11} className="animate-spin" /> 安装中...</> : "安装"}
                </button>
              </div>
              {installError && (
                <div className="flex items-center gap-1.5 text-[10px] text-rose-err">
                  <AlertCircle size={10} />
                  <span>{installError}</span>
                </div>
              )}
            </div>
          )}

          {/* Plugin list */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={16} className="animate-spin text-slate-500" />
            </div>
          ) : plugins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
                <Package size={16} className="text-slate-500" />
              </div>
              <p className="text-xs text-slate-500">暂无已安装的 Plugin</p>
              <button
                onClick={() => setView("marketplace")}
                className="text-xs text-amber-glow hover:text-amber-glow/80 transition-colors"
              >
                浏览插件市场
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {plugins.map((p) => (
                <div
                  key={p.name}
                  className="p-2.5 rounded-xl border border-white/8 bg-white/[0.02]
                             hover:border-white/12 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Package size={13} className="text-violet-info" />
                      <span className="text-xs font-medium text-slate-200">{p.name}</span>
                      {p.version && (
                        <span className="text-[9px] font-mono text-slate-500">v{p.version}</span>
                      )}
                      <ScopeBadge scope={p.scope} />
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => togglePlugin(p.name, !p.enabled)}
                        className={`p-1 rounded-md transition-colors ${
                          p.enabled
                            ? "text-emerald-ok hover:bg-emerald-ok/10"
                            : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                        }`}
                        title={p.enabled ? "禁用" : "启用"}
                      >
                        {p.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </button>
                      <button
                        onClick={() => uninstallPlugin(p.name)}
                        className="p-1.5 rounded-md hover:bg-rose-err/10 text-slate-400
                                   hover:text-rose-err transition-colors"
                        title="卸载"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>

                  {p.description && (
                    <p className="text-[10px] text-slate-500 mb-1.5 leading-relaxed">
                      {p.description}
                    </p>
                  )}

                  {/* Component badges + expandable detail */}
                  <PluginComponents
                    plugin={p}
                    expanded={expandedPlugin === p.name}
                    onToggle={() => setExpandedPlugin(expandedPlugin === p.name ? null : p.name)}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Plugin components expandable detail ── */
function PluginComponents({
  plugin,
  expanded,
  onToggle,
}: {
  plugin: {
    installPath?: string;
    gitCommitSha?: string;
    installedAt?: string;
    components?: {
      skills?: string[];
      mcpServers?: string[];
      agents?: string[];
      hooks?: string[];
    };
  };
  expanded: boolean;
  onToggle: () => void;
}) {
  const components = plugin.components;
  const groups = [
    { key: "skills",     items: components?.skills,     icon: Zap,     label: "Skills",  cls: "amber-glow" },
    { key: "mcpServers", items: components?.mcpServers,  icon: Plug,    label: "MCP",     cls: "violet-info" },
    { key: "agents",     items: components?.agents,      icon: Bot,     label: "Agents",  cls: "sky-link" },
    { key: "hooks",      items: components?.hooks,       icon: Webhook, label: "Hooks",   cls: "emerald-ok" },
  ].filter((g) => g.items && g.items.length > 0);

  const hasDetails = plugin.installPath || plugin.gitCommitSha || plugin.installedAt;
  if (groups.length === 0 && !hasDetails) return null;

  return (
    <div className="mt-1">
      {/* Summary badges row — click to expand */}
      <button onClick={onToggle} className="flex flex-wrap gap-1.5 items-center">
        {groups.map((g) => (
          <span
            key={g.key}
            className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded
                       bg-${g.cls}/5 text-${g.cls} border border-${g.cls}/10`}
          >
            <g.icon size={8} />
            {g.label}: {g.items!.length}
          </span>
        ))}
        {expanded
          ? <ChevronDown size={9} className="text-slate-500" />
          : <ChevronRight size={9} className="text-slate-500" />}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-1.5 space-y-1.5 pl-1">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="flex items-center gap-1 mb-0.5">
                <g.icon size={9} className="text-slate-500" />
                <span className="text-[9px] text-slate-500 uppercase tracking-wider">{g.label}</span>
              </div>
              <div className="flex flex-wrap gap-1 pl-3">
                {g.items!.map((name) => (
                  <span
                    key={name}
                    className={`text-[9px] px-1.5 py-0.5 rounded bg-${g.cls}/5 text-${g.cls} border border-${g.cls}/10`}
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {/* Plugin install details */}
          {hasDetails && (
            <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
              <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">安装详情</div>
              {plugin.installPath && (
                <div className="text-[10px] text-slate-600 font-mono truncate" title={plugin.installPath}>
                  路径: {plugin.installPath}
                </div>
              )}
              {plugin.gitCommitSha && (
                <div className="text-[10px] text-slate-600 font-mono">
                  Commit: {plugin.gitCommitSha.slice(0, 12)}
                </div>
              )}
              {plugin.installedAt && (
                <div className="text-[10px] text-slate-600">
                  安装时间: {new Date(plugin.installedAt).toLocaleString("zh-CN")}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
