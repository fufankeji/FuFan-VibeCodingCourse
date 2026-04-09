import { useState, useEffect, useCallback, useRef } from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  FileCode2,
  FileJson,
  FileImage,
  File,
  ChevronRight,
  ChevronDown,
  Search,
  RefreshCw,
  Star,
  Loader2,
  Globe,
  Settings,
  Terminal,
  Braces,
  Plus,
  FilePlus,
  FolderPlus,
  Pencil,
  PenTool,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useFileStore } from "../../stores/fileStore";
import { useUIStore } from "../../stores/uiStore";
import { api } from "../../services/api";
import type { FileNode } from "../../types/file";

/* ── File-type icon + color mapping ── */
interface FileIconInfo {
  icon: LucideIcon;
  color: string;
}

function getFileIcon(name: string): FileIconInfo {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "ts":
    case "tsx":
      return { icon: FileCode2, color: "text-blue-400" };
    case "js":
    case "jsx":
      return { icon: FileCode2, color: "text-yellow-400" };
    case "css":
    case "scss":
    case "less":
      return { icon: Braces, color: "text-sky-300" };
    case "html":
      return { icon: Globe, color: "text-orange-400" };
    case "json":
      return { icon: FileJson, color: "text-yellow-600" };
    case "md":
    case "mdx":
      return { icon: FileText, color: "text-slate-400" };
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "ico":
    case "webp":
      return { icon: FileImage, color: "text-emerald-ok" };
    case "yml":
    case "yaml":
    case "toml":
      return { icon: Settings, color: "text-slate-400" };
    case "sh":
    case "bash":
    case "zsh":
    case "bat":
    case "ps1":
      return { icon: Terminal, color: "text-emerald-ok" };
    case "py":
      return { icon: FileCode2, color: "text-yellow-500" };
    case "go":
      return { icon: FileCode2, color: "text-cyan-400" };
    case "rs":
      return { icon: FileCode2, color: "text-orange-400" };
    case "pen":
      return { icon: PenTool, color: "text-pink-400" };
    default:
      return { icon: File, color: "text-slate-500" };
  }
}

/* ── Context menu state ── */
interface ContextMenuState {
  x: number;
  y: number;
  nodePath: string;
  nodeName: string;
  isDir: boolean;
}

/* ── Inline input state ── */
interface InlineInputState {
  parentPath: string;
  type: "file" | "folder";
  mode: "create" | "rename";
  oldName?: string;
  depth: number;
}

export default function FileTree({ onFileClickOverride }: { onFileClickOverride?: (path: string) => void } = {}) {
  const {
    tree,
    treeLoading,
    modifiedFiles,
    searchQuery,
    searchResults,
    loadTree,
    openFile,
    setSearchQuery,
    searchFiles,
  } = useFileStore();
  const projectPath = useUIStore((s) => s.projectPath);
  const setRightPanelOpen = useUIStore((s) => s.setRightPanelOpen);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [inlineInput, setInlineInput] = useState<InlineInputState | null>(null);

  useEffect(() => {
    if (projectPath) {
      loadTree(projectPath);
    }
  }, [projectPath, loadTree]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenu]);

  const refreshTree = useCallback(() => {
    if (projectPath) loadTree(projectPath);
  }, [projectPath, loadTree]);

  const handleFileClick = useCallback(
    (filePath: string) => {
      if (onFileClickOverride) {
        openFile(filePath);
        onFileClickOverride(filePath);
      } else {
        openFile(filePath);
        setRightPanelOpen(true);
      }
    },
    [onFileClickOverride, openFile, setRightPanelOpen]
  );

  const handleSearch = useCallback(
    (q: string) => {
      setSearchQuery(q);
      if (projectPath && q.trim()) {
        searchFiles(projectPath, q);
      }
    },
    [projectPath, searchFiles, setSearchQuery]
  );

  /* ── Context menu actions ── */
  const handleContextMenu = useCallback((e: React.MouseEvent, nodePath: string, nodeName: string, isDir: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, nodePath, nodeName, isDir });
  }, []);

  const handleNewFile = useCallback((parentPath: string, depth: number) => {
    setContextMenu(null);
    setInlineInput({ parentPath, type: "file", mode: "create", depth });
  }, []);

  const handleNewFolder = useCallback((parentPath: string, depth: number) => {
    setContextMenu(null);
    setInlineInput({ parentPath, type: "folder", mode: "create", depth });
  }, []);

  const handleRename = useCallback((parentPath: string, oldName: string, depth: number) => {
    setContextMenu(null);
    setInlineInput({ parentPath, type: "file", mode: "rename", oldName, depth });
  }, []);

  const handleDelete = useCallback(async (filePath: string, name: string) => {
    setContextMenu(null);
    if (!window.confirm(`确定删除 "${name}" 吗？此操作不可撤销。`)) return;
    try {
      await api.deleteFile(filePath, projectPath);
      refreshTree();
    } catch (err) {
      alert(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [refreshTree]);

  const handleInlineConfirm = useCallback(async (value: string) => {
    if (!inlineInput || !value.trim()) {
      setInlineInput(null);
      return;
    }
    const { parentPath, type, mode, oldName } = inlineInput;
    try {
      if (mode === "create") {
        const fullPath = `${parentPath}/${value.trim()}`;
        if (type === "folder") {
          await api.createFolder(fullPath, projectPath);
        } else {
          await api.createFile(fullPath, "", projectPath);
        }
      } else if (mode === "rename" && oldName) {
        const dir = parentPath;
        const oldFullPath = `${dir}/${oldName}`;
        const newFullPath = `${dir}/${value.trim()}`;
        await api.renameFile(oldFullPath, newFullPath, projectPath);
      }
      refreshTree();
    } catch (err) {
      alert(`操作失败: ${err instanceof Error ? err.message : String(err)}`);
    }
    setInlineInput(null);
  }, [inlineInput, refreshTree]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-white/5">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Project Explorer
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (projectPath) {
                handleNewFile(projectPath, 0);
              }
            }}
            className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors"
            title="新建文件"
          >
            <Plus size={12} />
          </button>
          <button
            onClick={() => projectPath && loadTree(projectPath)}
            className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors"
            title="刷新"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-1.5">
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="搜索文件..."
            className="w-full text-xs bg-white/[0.03] border border-white/8 rounded-md pl-7 pr-2 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-glow/30"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-1">
        {treeLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-slate-500" />
          </div>
        ) : !projectPath ? (
          <div className="px-3 py-6 text-center">
            <Folder size={20} className="mx-auto text-slate-500 mb-2" />
            <p className="text-xs text-slate-500">请先选择项目目录</p>
          </div>
        ) : searchQuery && searchResults.length > 0 ? (
          <div className="py-1">
            {searchResults.map((r) => {
              const fi = getFileIcon(r.path);
              const Icon = fi.icon;
              return (
                <button
                  key={r.path}
                  onClick={() =>
                    r.type === "file" &&
                    handleFileClick(`${projectPath}/${r.path}`)
                  }
                  className="w-full flex items-center gap-2 px-2 py-1 text-sm text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded transition-colors"
                >
                  <Icon size={16} className={`${fi.color} flex-shrink-0`} />
                  <span className="truncate font-mono text-xs">{r.path}</span>
                </button>
              );
            })}
          </div>
        ) : tree ? (
          <div className="py-1 flex flex-col gap-0.5">
            {/* Root-level inline input */}
            {inlineInput && inlineInput.parentPath === projectPath && inlineInput.mode === "create" && (
              <InlineInputRow
                type={inlineInput.type}
                mode="create"
                depth={0}
                onConfirm={handleInlineConfirm}
                onCancel={() => setInlineInput(null)}
              />
            )}
            {tree.children?.map((node) => (
              <TreeNode
                key={node.path}
                node={node}
                depth={0}
                onFileClick={handleFileClick}
                modifiedFiles={modifiedFiles}
                onContextMenu={handleContextMenu}
                inlineInput={inlineInput}
                onInlineConfirm={handleInlineConfirm}
                onInlineCancel={() => setInlineInput(null)}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Modified files legend */}
      {modifiedFiles.size > 0 && (
        <div className="px-3 py-1.5 border-t border-white/5 flex items-center gap-1.5">
          <Star size={10} className="text-amber-glow" />
          <span className="text-[10px] text-slate-500">
            = Claude 修改过的文件
          </span>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isDir={contextMenu.isDir}
          onNewFile={() => {
            const parentPath = contextMenu.isDir ? contextMenu.nodePath : contextMenu.nodePath.substring(0, contextMenu.nodePath.lastIndexOf("/"));
            handleNewFile(parentPath, 0);
          }}
          onNewFolder={() => {
            const parentPath = contextMenu.isDir ? contextMenu.nodePath : contextMenu.nodePath.substring(0, contextMenu.nodePath.lastIndexOf("/"));
            handleNewFolder(parentPath, 0);
          }}
          onRename={() => {
            const parentPath = contextMenu.nodePath.substring(0, contextMenu.nodePath.lastIndexOf("/"));
            handleRename(parentPath, contextMenu.nodeName, 0);
          }}
          onDelete={() => handleDelete(contextMenu.nodePath, contextMenu.nodeName)}
        />
      )}
    </div>
  );
}

/* ── Context Menu Component ── */
function ContextMenu({
  x,
  y,
  isDir,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
}: {
  x: number;
  y: number;
  isDir: boolean;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Adjust position if menu would overflow viewport
  const [pos, setPos] = useState({ x, y });
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let nx = x, ny = y;
    if (rect.right > window.innerWidth) nx = window.innerWidth - rect.width - 4;
    if (rect.bottom > window.innerHeight) ny = window.innerHeight - rect.height - 4;
    setPos({ x: nx, y: ny });
  }, [x, y]);

  const itemCls = "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/8 transition-colors text-left";

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] py-1 rounded-lg border border-white/10 shadow-xl"
      style={{ left: pos.x, top: pos.y, background: "rgba(24,22,34,0.95)", backdropFilter: "blur(12px)" }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button className={itemCls} onClick={onNewFile}>
        <FilePlus size={12} className="text-slate-400" /> 新建文件
      </button>
      <button className={itemCls} onClick={onNewFolder}>
        <FolderPlus size={12} className="text-slate-400" /> 新建文件夹
      </button>
      <div className="my-1 border-t border-white/5" />
      <button className={itemCls} onClick={onRename}>
        <Pencil size={12} className="text-slate-400" /> 重命名
      </button>
      <button className={`${itemCls} hover:!bg-rose-500/10`} onClick={onDelete}>
        <Trash2 size={12} className="text-rose-400" /> <span className="text-rose-400">删除</span>
      </button>
    </div>
  );
}

/* ── Inline Input Row ── */
function InlineInputRow({
  type,
  mode,
  depth,
  defaultValue,
  onConfirm,
  onCancel,
}: {
  type: "file" | "folder";
  mode: "create" | "rename";
  depth: number;
  defaultValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus and select text for rename
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    if (mode === "rename" && defaultValue) {
      // Select name without extension for files
      const dotIdx = defaultValue.lastIndexOf(".");
      if (dotIdx > 0 && type === "file") {
        el.setSelectionRange(0, dotIdx);
      } else {
        el.select();
      }
    }
  }, [mode, defaultValue, type]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onConfirm(value);
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  const Icon = type === "folder" ? Folder : File;
  const iconColor = type === "folder" ? "text-blue-400" : "text-slate-500";

  return (
    <div
      className="flex items-center gap-2 px-2 py-0.5"
      style={{ paddingLeft: `${depth * 16 + 8 + 18}px` }}
    >
      <Icon size={16} className={`${iconColor} flex-shrink-0`} />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onCancel()}
        placeholder={mode === "create" ? (type === "folder" ? "文件夹名称" : "文件名称") : "新名称"}
        className="flex-1 text-xs bg-white/[0.06] border border-amber-glow/30 rounded px-1.5 py-0.5 text-slate-200 placeholder-slate-500 focus:outline-none"
      />
    </div>
  );
}

/* ── Tree Node ── */
function TreeNode({
  node,
  depth,
  onFileClick,
  modifiedFiles,
  onContextMenu,
  inlineInput,
  onInlineConfirm,
  onInlineCancel,
}: {
  node: FileNode;
  depth: number;
  onFileClick: (path: string) => void;
  modifiedFiles: Set<string>;
  onContextMenu: (e: React.MouseEvent, nodePath: string, nodeName: string, isDir: boolean) => void;
  inlineInput: InlineInputState | null;
  onInlineConfirm: (value: string) => void;
  onInlineCancel: () => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isDir = node.type === "directory";
  const isModified = modifiedFiles.has(node.path);

  // Check if this node is being renamed
  const isBeingRenamed = inlineInput?.mode === "rename"
    && inlineInput.oldName === node.name
    && node.path.substring(0, node.path.lastIndexOf("/")) === inlineInput.parentPath;

  // Check if inline input should show inside this directory
  const showInlineChild = isDir && expanded && inlineInput?.mode === "create" && inlineInput.parentPath === node.path;

  // File icon
  const fi = !isDir ? getFileIcon(node.name) : null;
  const FileIcon = fi?.icon ?? File;

  if (isBeingRenamed) {
    return (
      <InlineInputRow
        type={isDir ? "folder" : "file"}
        mode="rename"
        depth={depth}
        defaultValue={node.name}
        onConfirm={onInlineConfirm}
        onCancel={onInlineCancel}
      />
    );
  }

  return (
    <div>
      <button
        onClick={() => {
          if (isDir) {
            setExpanded(!expanded);
          } else {
            onFileClick(node.path);
          }
        }}
        onContextMenu={(e) => onContextMenu(e, node.path, node.name, isDir)}
        className={`w-full flex items-center gap-2 px-2 py-1 text-sm rounded transition-colors ${
          isDir
            ? "text-slate-300 hover:bg-white/5"
            : isModified
              ? "text-amber-glow hover:bg-white/5"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand/collapse arrow (dirs only) */}
        {isDir ? (
          expanded ? (
            <ChevronDown size={14} className="text-slate-500 flex-shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-slate-500 flex-shrink-0" />
          )
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}

        {/* Icon */}
        {isDir ? (
          expanded ? (
            <FolderOpen size={16} className="text-blue-400 flex-shrink-0" />
          ) : (
            <Folder size={16} className="text-blue-400 flex-shrink-0" />
          )
        ) : (
          <FileIcon size={16} className={`${fi?.color ?? "text-slate-500"} flex-shrink-0`} />
        )}

        {/* Name */}
        <span className="truncate">{node.name}</span>

        {/* Modified star */}
        {isModified && (
          <Star size={9} className="text-amber-glow flex-shrink-0 ml-auto" />
        )}
      </button>

      {isDir && expanded && (
        <div className="border-l border-white/10 ml-5 pl-1 flex flex-col gap-0.5">
          {/* Inline input for new file/folder inside this directory */}
          {showInlineChild && (
            <InlineInputRow
              type={inlineInput.type}
              mode="create"
              depth={depth + 1}
              onConfirm={onInlineConfirm}
              onCancel={onInlineCancel}
            />
          )}
          {node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onFileClick={onFileClick}
              modifiedFiles={modifiedFiles}
              onContextMenu={onContextMenu}
              inlineInput={inlineInput}
              onInlineConfirm={onInlineConfirm}
              onInlineCancel={onInlineCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
