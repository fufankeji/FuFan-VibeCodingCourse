import { useEffect, useState, useCallback } from "react";
import {
  Folder, FolderOpen, File, ChevronRight, ArrowLeft,
  Check, X, Loader2, Home, RefreshCw, FolderPlus,
} from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { api } from "../../services/api";

interface BrowseEntry {
  name: string;
  type: "dir" | "file";
  path: string;
}

interface BrowseResult {
  path: string | null;
  parent: string | null;
  entries: BrowseEntry[];
}

export default function FolderBrowserModal() {
  const { folderBrowserOpen, setFolderBrowserOpen, projectPath, setProjectPath } = useUIStore();

  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [result, setResult] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Navigate to a new path
  const navigate = useCallback(async (path: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.browseFolder(path ?? undefined);
      setResult(data);
      setCurrentPath(data.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Load root when modal opens
  useEffect(() => {
    if (folderBrowserOpen) {
      // Start from existing projectPath if available, else load logical root
      navigate(projectPath || null);
    }
  }, [folderBrowserOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = () => {
    if (currentPath) {
      setProjectPath(currentPath);
    }
    setFolderBrowserOpen(false);
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name || !currentPath) return;
    const sep = currentPath.includes("\\") ? "\\" : "/";
    const newPath = currentPath + sep + name;
    try {
      await api.createFolder(newPath);
      setCreatingFolder(false);
      setNewFolderName("");
      navigate(newPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleClose = () => {
    setCreatingFolder(false);
    setNewFolderName("");
    setFolderBrowserOpen(false);
  };

  if (!folderBrowserOpen) return null;

  // Build breadcrumb segments from currentPath
  const breadcrumbs = buildBreadcrumbs(currentPath);

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="modal-content glass-panel rounded-2xl w-full max-w-[600px] max-h-[70vh] flex flex-col shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-amber-glow/15 flex items-center justify-center">
            <FolderOpen size={14} className="text-amber-glow" />
          </div>
          <h2 className="text-sm font-semibold text-white flex-1">选择项目文件夹</h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Breadcrumb + Back ── */}
        <div className="px-4 py-2.5 flex items-center gap-2 border-b border-white/5 flex-shrink-0 overflow-x-auto">
          <button
            onClick={() => navigate(null)}
            title="返回根目录"
            className="p-1 rounded text-slate-400 hover:text-amber-glow hover:bg-white/5 transition-colors flex-shrink-0"
          >
            <Home size={13} />
          </button>

          {result?.parent !== undefined && currentPath && (
            <button
              onClick={() => navigate(result?.parent ?? null)}
              title="返回上级"
              className="p-1 rounded text-slate-400 hover:text-amber-glow hover:bg-white/5 transition-colors flex-shrink-0"
            >
              <ArrowLeft size={13} />
            </button>
          )}

          {/* Breadcrumb segments */}
          <div className="flex items-center gap-1 text-[11px] min-w-0">
            {breadcrumbs.length === 0 ? (
              <span className="text-slate-400">根目录</span>
            ) : (
              breadcrumbs.map((crumb, i) => (
                <span key={crumb.path} className="flex items-center gap-1 min-w-0">
                  {i > 0 && <ChevronRight size={11} className="text-slate-600 flex-shrink-0" />}
                  <button
                    onClick={() => navigate(crumb.path)}
                    className={`truncate max-w-[120px] hover:text-amber-glow transition-colors ${
                      i === breadcrumbs.length - 1
                        ? "text-white font-medium"
                        : "text-slate-400"
                    }`}
                    title={crumb.path}
                  >
                    {crumb.label}
                  </button>
                </span>
              ))
            )}
          </div>

          {loading && <Loader2 size={12} className="animate-spin text-purple-glow ml-auto flex-shrink-0" />}
          {!loading && (
            <button
              onClick={() => navigate(currentPath)}
              title="刷新"
              className="ml-auto p-1 rounded text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors flex-shrink-0"
            >
              <RefreshCw size={11} />
            </button>
          )}
        </div>

        {/* ── Entry list ── */}
        <div className="flex-1 overflow-y-auto min-h-0 py-1">
          {/* Inline new folder input */}
          {creatingFolder && currentPath && (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
              <FolderPlus size={14} className="flex-shrink-0 text-amber-glow" />
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") { setCreatingFolder(false); setNewFolderName(""); }
                }}
                placeholder="输入文件夹名称..."
                className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-glow/40"
              />
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="p-1 rounded text-amber-glow hover:bg-amber-glow/10 transition-colors disabled:opacity-40"
                title="确认创建"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => { setCreatingFolder(false); setNewFolderName(""); }}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                title="取消"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {error && (
            <div className="mx-4 my-3 px-3 py-2.5 rounded-lg bg-rose-err/10 border border-rose-err/20 text-xs text-rose-err">
              {error}
            </div>
          )}

          {!error && result && result.entries.length === 0 && (
            <div className="py-10 text-center text-xs text-slate-500">
              （此目录为空）
            </div>
          )}

          {!error && result?.entries.map((entry) => (
            <button
              key={entry.path}
              onClick={() => entry.type === "dir" ? navigate(entry.path) : undefined}
              disabled={entry.type === "file"}
              className={`
                w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left
                ${entry.type === "dir"
                  ? "text-slate-200 hover:bg-white/5 hover:text-white"
                  : "text-slate-600 cursor-default"
                }
              `}
            >
              {entry.type === "dir"
                ? <Folder size={14} className="flex-shrink-0 text-amber-glow/70" />
                : <File size={14} className="flex-shrink-0 text-slate-600" />
              }
              <span className="truncate flex-1">{entry.name}</span>
              {entry.type === "dir" && (
                <ChevronRight size={12} className="flex-shrink-0 text-slate-600" />
              )}
            </button>
          ))}
        </div>

        {/* ── Footer: current selection + actions ── */}
        <div className="px-4 py-3 border-t border-white/5 flex-shrink-0">
          {/* Current selection indicator */}
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-white/5 border border-white/5">
            <Folder size={12} className="flex-shrink-0 text-amber-glow/60" />
            <span className="text-[11px] text-slate-300 truncate flex-1" title={currentPath ?? ""}>
              {currentPath ?? "（根目录）"}
            </span>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setCreatingFolder(true); setNewFolderName(""); }}
              disabled={!currentPath}
              className="px-3 py-1.5 text-sm rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 mr-auto"
            >
              <FolderPlus size={13} />
              新建文件夹
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-1.5 text-sm rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors border border-white/5"
            >
              取消
            </button>
            <button
              onClick={handleSelect}
              disabled={!currentPath}
              className="px-4 py-1.5 text-sm rounded-lg bg-[#ca5d3d] hover:bg-amber-glow text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Check size={13} />
              选择此文件夹
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Split a path into breadcrumb segments with label + navigable path */
function buildBreadcrumbs(fullPath: string | null): { label: string; path: string }[] {
  if (!fullPath) return [];

  const sep = fullPath.includes("\\") ? "\\" : "/";
  const rawParts = fullPath.split(sep).filter(Boolean);
  const crumbs: { label: string; path: string }[] = [];

  if (sep === "\\") {
    // Windows: "C:\Users\foo" → drive "C:\" then each subfolder
    rawParts.reduce((acc, part) => {
      const newPath = acc ? `${acc}\\${part}` : `${part}\\`;
      crumbs.push({ label: part, path: newPath });
      return newPath;
    }, "");
  } else {
    // Unix: "/home/user/foo" → each part prefixed with /
    rawParts.reduce((acc, part) => {
      const newPath = `${acc}/${part}`;
      crumbs.push({ label: part, path: newPath });
      return newPath;
    }, "");
  }

  return crumbs;
}
