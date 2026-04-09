import { useCallback, useRef, useState, useEffect } from "react";
import {
  FolderOpen, Search, History, Settings, ChevronLeft,
  ChevronRight, Zap, X, FileText, Check, Pencil,
} from "lucide-react";
import { useUIStore, type LeftNavPanel } from "../../stores/uiStore";
import { useFileStore } from "../../stores/fileStore";
import ContextBar from "../manage/ContextBar";
import FileTree from "../ide/FileTree";
import CheckpointTimeline from "../agent/CheckpointTimeline";

const NAV_ITEMS: { id: LeftNavPanel; icon: typeof FolderOpen; label: string; badge?: number }[] = [
  { id: "files",  icon: FolderOpen,  label: "Files" },
  { id: "search", icon: Search,      label: "Search" },
  { id: "checkpoints", icon: History, label: "Checkpoints" },
];

export default function Sidebar() {
  const {
    sidebarOpen, sidebarWidth, setSidebarWidth, toggleSidebar,
    leftNavPanel, setLeftNavPanel,
    projectPath, setProjectPath,
    setSettingsModalOpen, setSettingsPageOpen, setFileViewModalOpen,
    setFolderBrowserOpen,
  } = useUIStore();

  const { openFile } = useFileStore();
  const isDragging = useRef(false);
  const [editingPath, setEditingPath] = useState(false);
  const [pathDraft, setPathDraft] = useState("");

  const handlePickFolder = useCallback(() => {
    setFolderBrowserOpen(true);
  }, [setFolderBrowserOpen]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startX = e.clientX;
    const startW = sidebarWidth;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.min(480, Math.max(200, startW + delta));
      setSidebarWidth(newWidth);
    };
    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [sidebarWidth, setSidebarWidth]);

  const handleFileOpen = useCallback((filePath: string) => {
    openFile(filePath);
    setFileViewModalOpen(true);
  }, [openFile, setFileViewModalOpen]);

  if (!sidebarOpen) {
    return (
      <button
        onClick={toggleSidebar}
        className="w-7 flex-shrink-0 flex items-center justify-center border-r border-white/5
                   text-slate-500 hover:text-amber-glow transition-all z-10 group relative"
        style={{ background: "rgba(24, 22, 17, 0.40)" }}
        title="展开侧栏"
      >
        {/* 右边缘 amber 高亮线 */}
        <div className="absolute inset-y-[25%] right-0 w-0.5 rounded-l-full
                        bg-amber-glow/0 group-hover:bg-amber-glow/50 transition-all duration-200" />
        <ChevronRight size={13} />
      </button>
    );
  }

  return (
    <aside
      className="flex-shrink-0 relative overflow-hidden panel-transition z-10"
      style={{
        width: sidebarWidth, minWidth: 200, maxWidth: 480,
        background: "rgba(24, 22, 17, 0.40)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* ── Drag handle — absolute overlay on right edge (no layout gap) ── */}
      <div
        className="absolute inset-y-0 right-0 w-[5px] cursor-ew-resize z-20 hover:bg-white/5 transition-colors"
        onMouseDown={handleMouseDown}
      />

      {/* Main sidebar content with right border */}
      <div className="flex flex-col h-full border-r border-white/5">

        {/* ── Brand header ── */}
        <div className="h-16 flex items-center gap-3 px-4 border-b border-white/5 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-glow to-amber-glow flex items-center justify-center shadow-lg shadow-purple-glow/20 flex-shrink-0">
            <Zap size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <a
              href="https://fufan.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm font-display font-bold text-white truncate leading-tight hover:text-amber-glow transition-colors"
            >
              Fufan-CC Flow
            </a>
            <div className="text-[10px] text-slate-500 truncate leading-tight">
              赋范空间出品
            </div>
          </div>
          {/* Collapse toggle */}
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md hover:bg-amber-glow/10 text-slate-400 hover:text-amber-glow transition-all flex-shrink-0"
            title="收起侧栏"
          >
            <ChevronLeft size={15} />
          </button>
        </div>

        {/* ── Project path ── */}
        {editingPath ? (
          /* Manual text-entry fallback (accessible via pencil icon) */
          <div className="mx-3 mt-2.5 flex items-center gap-1">
            <input
              autoFocus
              value={pathDraft}
              onChange={(e) => setPathDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (pathDraft.trim()) setProjectPath(pathDraft.trim());
                  setEditingPath(false);
                } else if (e.key === "Escape") {
                  setEditingPath(false);
                }
              }}
              placeholder="输入项目绝对路径..."
              className="flex-1 min-w-0 px-2 py-1 rounded-md text-[11px] text-slate-200 bg-white/10 border border-purple-glow/50 focus:outline-none focus:border-purple-glow"
            />
            <button
              onClick={() => {
                if (pathDraft.trim()) setProjectPath(pathDraft.trim());
                setEditingPath(false);
              }}
              className="p-1 flex-shrink-0 rounded text-emerald-ok hover:bg-emerald-ok/10 transition-colors"
              title="确认"
            >
              <Check size={12} />
            </button>
            <button
              onClick={() => setEditingPath(false)}
              className="p-1 flex-shrink-0 rounded text-rose-err hover:bg-rose-err/10 transition-colors"
              title="取消"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          /* Primary: click to open folder browser modal */
          <div className="mx-3 mt-2.5 flex items-center gap-1">
            <button
              onClick={handlePickFolder}
              title="点击选择项目文件夹"
              className="flex-1 min-w-0 px-3 py-1.5 rounded-md bg-white/5 border border-white/5 flex items-center gap-2 text-[11px] text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
            >
              <FolderOpen size={11} className="flex-shrink-0 text-slate-500" />
              <span className="truncate flex-1 text-left">
                {projectPath || "点击选择项目文件夹..."}
              </span>
            </button>
            {/* Pencil: manual path edit fallback */}
            <button
              onClick={() => { setPathDraft(projectPath); setEditingPath(true); }}
              title="手动输入路径"
              className="p-1.5 flex-shrink-0 rounded text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors"
            >
              <Pencil size={10} />
            </button>
          </div>
        )}

        {/* ── Nav items ── */}
        <nav className="flex flex-col gap-0.5 px-2 mt-3">
          {NAV_ITEMS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setLeftNavPanel(id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                leftNavPanel === id
                  ? "nav-item-active"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={15} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* ── Nav panel content (flex-1) ── */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 mt-1">
          {leftNavPanel === "files"  && <FilesPanel onFileOpen={handleFileOpen} />}
          {leftNavPanel === "search" && <SearchPanel onFileOpen={handleFileOpen} />}
          {leftNavPanel === "checkpoints" && <CheckpointsPanel />}
        </div>

        {/* ── Bottom: Settings + ContextBar ── */}
        <div className="flex-shrink-0 border-t border-white/5">
          <button
            onClick={() => setSettingsPageOpen(true)}
            className="flex items-center gap-3 px-5 py-2.5 w-full text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Settings size={15} />
            <span>Settings</span>
          </button>
          <div className="mx-4 border-t border-white/5" />
          <ContextBar />
        </div>
      </div>
    </aside>
  );
}

/* ── Files sub-panel ── */
function FilesPanel({ onFileOpen }: { onFileOpen: (path: string) => void }) {
  // FileTree handles its own loading state and calls loadTree internally.
  // Do NOT conditionally mount/unmount FileTree based on treeLoading —
  // that would cause an infinite loop: unmount → remount → useEffect fires → loadTree → treeLoading=true → unmount...
  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <FileTree onFileClickOverride={onFileOpen} />
    </div>
  );
}

/* ── Search sub-panel ── */
function SearchPanel({ onFileOpen }: { onFileOpen: (path: string) => void }) {
  const { projectPath } = useUIStore();
  const { searchQuery, setSearchQuery, searchFiles, searchResults } = useFileStore();
  const [inputVal, setInputVal] = useState(searchQuery);

  const doSearch = (q: string) => {
    setSearchQuery(q);
    if (projectPath && q.trim()) searchFiles(projectPath, q.trim());
  };

  return (
    <div className="flex flex-col gap-2 p-3 flex-1 overflow-hidden">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
        <input
          value={inputVal}
          onChange={(e) => { setInputVal(e.target.value); doSearch(e.target.value); }}
          placeholder="搜索文件..."
          className="w-full pl-8 pr-3 py-2 text-xs bg-white/5 border border-white/5 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-glow/40"
        />
        {inputVal && (
          <button
            onClick={() => { setInputVal(""); doSearch(""); }}
            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
          >
            <X size={12} />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto space-y-0.5">
        {searchResults.map((r) => (
          <button
            key={r.path}
            onClick={() => onFileOpen(r.path)}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-slate-300 hover:bg-white/5 hover:text-white transition-colors text-left"
          >
            <FileText size={12} className="flex-shrink-0 text-slate-500" />
            <span className="truncate">{r.path}</span>
          </button>
        ))}
        {inputVal && searchResults.length === 0 && (
          <div className="text-center py-6 text-xs text-slate-500">无匹配结果</div>
        )}
        {!inputVal && (
          <div className="text-center py-6 text-xs text-slate-500">输入关键词搜索文件</div>
        )}
      </div>
    </div>
  );
}

/* ── Checkpoints sub-panel ── */
function CheckpointsPanel() {
  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <CheckpointTimeline />
    </div>
  );
}
