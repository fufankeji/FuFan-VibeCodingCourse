import { useEffect, useState } from "react";
import {
  Search,
  Loader2,
  Check,
  Download,
  RefreshCw,
  ArrowUpDown,
  Package,
  ExternalLink,
} from "lucide-react";
import { useMarketplaceStore, type MarketplacePlugin } from "../../stores/marketplaceStore";

function formatInstallCount(count?: number): string {
  if (!count) return "";
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
  return String(count);
}

export default function MarketplacePanel({ onInstalled }: { onInstalled?: () => void }) {
  const {
    availablePlugins, loading, searchQuery, sortBy, installing,
    loadAvailable, installFromMarketplace, setSearchQuery, setSortBy,
  } = useMarketplaceStore();
  const [installScope, setInstallScope] = useState<Record<string, string>>({});

  useEffect(() => { loadAvailable(); }, [loadAvailable]);

  const filtered = availablePlugins.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.author.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    return (b.installCount || 0) - (a.installCount || 0);
  });

  const handleInstall = async (name: string) => {
    const scope = installScope[name] || "user";
    try {
      await installFromMarketplace(name, scope);
      onInstalled?.();
    } catch {
      // error handled in store
    }
  };

  return (
    <div className="space-y-3">
      {/* Search and controls */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索插件..."
            className="w-full text-xs bg-white/5 border border-white/10 rounded-md pl-7 pr-2.5 py-1.5
                       text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-glow/30"
          />
        </div>
        <button
          onClick={() => setSortBy(sortBy === "popular" ? "name" : "popular")}
          className="flex items-center gap-1 text-[10px] px-2 py-1.5 rounded-md
                     bg-white/5 text-slate-400 hover:text-slate-200 border border-white/8
                     hover:border-white/15 transition-colors"
          title={sortBy === "popular" ? "按热度排序" : "按名称排序"}
        >
          <ArrowUpDown size={10} />
          {sortBy === "popular" ? "热度" : "名称"}
        </button>
        <button
          onClick={loadAvailable}
          className="p-1.5 rounded-md hover:bg-white/5 text-slate-500
                     hover:text-slate-300 transition-colors"
          title="刷新市场数据"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Plugin list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={16} className="animate-spin text-slate-500" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
            <Package size={16} className="text-slate-500" />
          </div>
          <p className="text-xs text-slate-500">
            {searchQuery ? "无匹配插件" : "市场暂无可用插件"}
          </p>
          {!searchQuery && (
            <p className="text-[10px] text-slate-600 text-center max-w-[200px]">
              请确保已配置 marketplace 源并运行过 marketplace update
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-[10px] text-slate-600">
            共 {sorted.length} 个可用插件
          </div>
          {sorted.map((p) => (
            <MarketplaceCard
              key={`${p.marketplace}-${p.name}`}
              plugin={p}
              installing={installing === p.name}
              scope={installScope[p.name] || "user"}
              onScopeChange={(scope) => setInstallScope({ ...installScope, [p.name]: scope })}
              onInstall={() => handleInstall(p.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MarketplaceCard({
  plugin,
  installing,
  scope,
  onScopeChange,
  onInstall,
}: {
  plugin: MarketplacePlugin;
  installing: boolean;
  scope: string;
  onScopeChange: (scope: string) => void;
  onInstall: () => void;
}) {
  const countStr = formatInstallCount(plugin.installCount);

  return (
    <div className="p-2.5 rounded-xl border border-white/8 bg-white/[0.02]
                    hover:border-white/12 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <Package size={12} className="text-violet-info flex-shrink-0" />
            <span className="text-xs font-medium text-slate-200">{plugin.name}</span>
            {plugin.isExternal && (
              <span title="外部插件"><ExternalLink size={9} className="text-slate-600" /></span>
            )}
            {countStr && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500">
                {countStr} 安装
              </span>
            )}
          </div>
          {plugin.description && (
            <p className="text-[10px] text-slate-500 leading-relaxed mb-1">
              {plugin.description}
            </p>
          )}
          {plugin.author && (
            <p className="text-[10px] text-slate-600">
              {plugin.author}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {plugin.installed ? (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 px-2 py-1 rounded-md bg-emerald-500/10">
              <Check size={10} /> 已安装
            </span>
          ) : (
            <>
              <select
                value={scope}
                onChange={(e) => onScopeChange(e.target.value)}
                className="text-[10px] bg-white/5 border border-white/10 rounded-md px-1.5 py-1
                           text-slate-400 focus:outline-none"
                disabled={installing}
              >
                <option value="user">user</option>
                <option value="project">project</option>
              </select>
              <button
                onClick={onInstall}
                disabled={installing}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md
                           bg-[#ca5d3d] hover:bg-amber-glow text-white font-medium
                           transition-colors disabled:opacity-50"
              >
                {installing ? (
                  <><Loader2 size={10} className="animate-spin" /> 安装中</>
                ) : (
                  <><Download size={10} /> 安装</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
