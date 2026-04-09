import { useEffect, useState, useCallback } from "react";
import {
  FolderOpen, X, Loader2, Zap, FileText, FolderCode, Package, Info,
  File, Folder, ChevronRight, ChevronDown,
} from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { api } from "../../services/api";
import MarkdownRenderer from "../shared/MarkdownRenderer";
import type { SkillInfo, SkillDetail } from "../../types/skill";
import type { FileNode } from "../../types/file";

type ScopeTab = "project" | "user" | "plugin";

/** 去掉 Markdown 文件开头的 YAML frontmatter（--- 包裹的部分） */
function stripFrontmatter(raw: string): string {
  const m = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return m ? raw.slice(m[0].length) : raw;
}

/* ── Inline recursive file tree item ── */
function FileTreeItem({
  node,
  selectedFile,
  onSelect,
  depth = 0,
}: {
  node: FileNode;
  selectedFile: string | null;
  onSelect: (path: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const isDir = node.type === "directory";
  const isSelected = selectedFile === node.path;
  const isSkillMd = node.name === "SKILL.md";

  const sizeStr =
    node.size != null
      ? node.size >= 1024
        ? `${(node.size / 1024).toFixed(1)} KB`
        : `${node.size} B`
      : "";

  return (
    <div>
      <button
        onClick={() => (isDir ? setExpanded(!expanded) : onSelect(node.path))}
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-left text-[11px] transition-colors ${
          isSelected
            ? "bg-amber-glow/10 text-amber-glow"
            : "text-slate-300 hover:bg-white/5"
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {isDir ? (
          expanded ? (
            <ChevronDown size={10} className="flex-shrink-0 text-slate-500" />
          ) : (
            <ChevronRight size={10} className="flex-shrink-0 text-slate-500" />
          )
        ) : (
          <span className="w-[10px]" />
        )}

        {isDir ? (
          expanded ? (
            <FolderOpen size={12} className="flex-shrink-0 text-amber-glow/60" />
          ) : (
            <Folder size={12} className="flex-shrink-0 text-amber-glow/60" />
          )
        ) : (
          <File size={12} className="flex-shrink-0 text-slate-500" />
        )}

        <span className={`truncate flex-1 ${isSkillMd ? "font-medium text-amber-glow/80" : ""}`}>
          {node.name}
        </span>

        {!isDir && sizeStr && (
          <span className="text-[9px] text-slate-600 flex-shrink-0">{sizeStr}</span>
        )}
      </button>

      {isDir && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              selectedFile={selectedFile}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main modal ── */
export default function SkillBrowserModal() {
  const {
    skillBrowserOpen, setSkillBrowserOpen, projectPath,
    skillBrowserInitialSelection, setSkillBrowserInitialSelection,
  } = useUIStore();

  const [tab, setTab] = useState<ScopeTab>("project");
  const [projectSkills, setProjectSkills] = useState<SkillInfo[]>([]);
  const [userSkills, setUserSkills] = useState<SkillInfo[]>([]);
  const [pluginSkills, setPluginSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // File tree + content viewer states
  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<{ content: string; language: string } | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  // Get current skill info object for the selected skill
  const getSelectedSkillInfo = useCallback((): SkillInfo | undefined => {
    const skills = tab === "project" ? projectSkills : tab === "user" ? userSkills : pluginSkills;
    return skills.find((s) => s.name === selected);
  }, [tab, projectSkills, userSkills, pluginSkills, selected]);

  // Load skills list when modal opens
  useEffect(() => {
    if (!skillBrowserOpen) return;
    setLoading(true);
    setSelected(null);
    setDetail(null);
    setFileTree(null);
    setSelectedFile(null);
    setFileContent(null);
    api.getSkills(projectPath).then((data) => {
      setProjectSkills(data.project);
      setUserSkills(data.user);
      setPluginSkills(data.plugin || []);
    }).finally(() => setLoading(false));
  }, [skillBrowserOpen, projectPath]);

  // Consume initial selection after skills are loaded
  useEffect(() => {
    if (!skillBrowserInitialSelection || loading) return;
    const { tab: selTab, name } = skillBrowserInitialSelection;
    setTab(selTab);
    setSelected(name);
    setSkillBrowserInitialSelection(null);
  }, [skillBrowserInitialSelection, loading, setSkillBrowserInitialSelection]);

  // Load detail when a skill is selected
  useEffect(() => {
    if (!selected) {
      setDetail(null);
      setFileTree(null);
      setSelectedFile(null);
      setFileContent(null);
      return;
    }
    // Plugin skills: build frontmatter from SkillInfo, then try file tree
    if (tab === "plugin") {
      const skill = pluginSkills.find((s) => s.name === selected);
      if (skill) {
        setDetail({
          name: skill.name,
          frontmatter: {
            description: skill.description || "",
            ...(skill.model ? { model: skill.model } : {}),
            ...(skill.argumentHint ? { "argument-hint": skill.argumentHint } : {}),
          },
          content: "",
        });
        // Try loading file tree from plugin skill path
        if (skill.path) {
          const dirPath = skill.path.replace(/[/\\]SKILL\.md$/i, "");
          setDetailLoading(true);
          api.getFileTree(dirPath, 3)
            .then((tree) => {
              setFileTree(tree);
              const skillMdPath = findSkillMdPath(tree);
              if (skillMdPath) {
                setSelectedFile(skillMdPath);
              }
            })
            .catch(() => {
              setFileTree(null);
              // Fallback: try loading SKILL.md content directly
              api.getFileContent(skill.path)
                .then((data) => setFileContent({ content: data.content, language: data.language }))
                .catch(() => setDetail((prev) => prev ? {
                  ...prev,
                  content: `(插件内置 Skill，来自 ${skill.pluginName || "未知插件"})\n\n文件路径: ${skill.path}`,
                } : null));
            })
            .finally(() => setDetailLoading(false));
        }
      }
      return;
    }
    setDetailLoading(true);
    api.getSkillDetail(tab, selected, projectPath)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));

    // Load file tree for new-format skills
    const skills = tab === "project" ? projectSkills : userSkills;
    const skillInfo = skills.find((s) => s.name === selected);
    if (skillInfo && skillInfo.source === "skills" && skillInfo.path) {
      // Compute directory from SKILL.md path
      const dirPath = skillInfo.path.replace(/[/\\]SKILL\.md$/i, "");
      api.getFileTree(dirPath, 3)
        .then((tree) => {
          setFileTree(tree);
          // Auto-select SKILL.md
          const skillMdPath = findSkillMdPath(tree);
          if (skillMdPath) {
            setSelectedFile(skillMdPath);
          }
        })
        .catch(() => setFileTree(null));
    } else {
      setFileTree(null);
      setSelectedFile(null);
      setFileContent(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, tab, projectPath, pluginSkills]);

  // Load file content when a file is selected in tree
  useEffect(() => {
    if (!selectedFile) { setFileContent(null); return; }
    setFileLoading(true);
    api.getFileContent(selectedFile)
      .then((data) => setFileContent({ content: data.content, language: data.language }))
      .catch(() => setFileContent(null))
      .finally(() => setFileLoading(false));
  }, [selectedFile]);

  const handleClose = () => {
    setSkillBrowserOpen(false);
    setSkillBrowserInitialSelection(null);
  };

  if (!skillBrowserOpen) return null;

  const skills = tab === "project" ? projectSkills : tab === "user" ? userSkills : pluginSkills;
  const skillInfo = getSelectedSkillInfo();
  const isNewFormat = skillInfo?.source === "skills";
  const isOldFormat = skillInfo?.source === "commands";
  const isPlugin = tab === "plugin";
  // Skills that can have a file tree (new format or plugin with path)
  const canBrowseFiles = isNewFormat || isPlugin;

  // Only show file tree when directory has extra files beyond SKILL.md
  const hasExtraFiles = fileTree?.children
    ? fileTree.children.length > 1 || fileTree.children.some((c) => c.type === "directory")
    : false;

  // Compute display paths for empty state
  const projectPathNorm = projectPath || "(未设置项目路径)";
  const pathInfo = tab === "project"
    ? [
        `${projectPathNorm}/.claude/skills/{name}/SKILL.md`,
        `${projectPathNorm}/.claude/commands/{name}.md`,
      ]
    : tab === "user"
    ? [
        `~/.claude/skills/{name}/SKILL.md`,
        `~/.claude/commands/{name}.md`,
      ]
    : [];

  const tabs: { key: ScopeTab; label: string; count: number }[] = [
    { key: "project", label: "项目级", count: projectSkills.length },
    { key: "user", label: "用户级", count: userSkills.length },
    { key: "plugin", label: "插件", count: pluginSkills.length },
  ];

  // Determine the file viewer label
  const viewerFileName = selectedFile
    ? selectedFile.split(/[/\\]/).pop() || "文件"
    : "SKILL.md";
  const viewerLanguage = fileContent?.language || "markdown";
  const isMarkdownFile = viewerLanguage === "markdown" || /\.md$/i.test(viewerFileName);

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="modal-content glass-panel rounded-2xl w-full max-w-[850px] h-[600px] flex flex-col shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-amber-glow/15 flex items-center justify-center">
            <FolderOpen size={14} className="text-amber-glow" />
          </div>
          <h2 className="text-sm font-semibold text-white flex-1">浏览 Skills 文件夹</h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 py-2.5 border-b border-white/5 flex-shrink-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelected(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
                tab === t.key
                  ? "bg-amber-glow/15 text-amber-glow font-medium"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              {t.key === "plugin" && <Package size={10} />}
              {t.label}
              {!loading && (
                <span className={`text-[9px] ${tab === t.key ? "text-amber-glow/60" : "text-slate-600"}`}>
                  ({t.count})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body: left list + right preview */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: skill list */}
          <div className="w-[220px] border-r border-white/5 overflow-y-auto flex-shrink-0">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 size={16} className="animate-spin text-slate-500" />
              </div>
            ) : skills.length === 0 ? (
              <div className="py-6 px-4 space-y-3">
                <div className="text-xs text-slate-500 text-center">暂无自定义 Skills</div>
                {pathInfo.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <Info size={10} className="flex-shrink-0" />
                      <span>扫描路径：</span>
                    </div>
                    {pathInfo.map((p) => (
                      <div key={p} className="text-[9px] font-mono text-slate-600 bg-white/[0.02] rounded px-2 py-1.5 break-all leading-relaxed">
                        {p}
                      </div>
                    ))}
                    <div className="text-[10px] text-slate-600 leading-relaxed">
                      内置 Skills 和插件 Skills 不以文件形式存储在此路径。点击「新建 Skill」可创建自定义 Skill。
                    </div>
                  </div>
                )}
                {tab === "plugin" && (
                  <div className="text-[10px] text-slate-600 text-center">
                    尚未安装任何含 Skills 的插件
                  </div>
                )}
              </div>
            ) : (
              skills.map((s) => (
                <button
                  key={s.name}
                  onClick={() => setSelected(s.name)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${
                    selected === s.name
                      ? "bg-amber-glow/10 text-white"
                      : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  {tab === "plugin" ? (
                    <Package size={13} className="flex-shrink-0 text-amber-glow/60" />
                  ) : s.source === "commands" ? (
                    <FileText size={13} className="flex-shrink-0 text-slate-500" />
                  ) : (
                    <FolderCode size={13} className="flex-shrink-0 text-amber-glow/70" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium truncate">/{s.name}</span>
                    </div>
                    {s.source === "commands" && (
                      <span className="text-[9px] text-slate-600">旧格式 (commands/)</span>
                    )}
                    {tab === "plugin" && s.pluginName && (
                      <span className="text-[9px] text-slate-600">from {s.pluginName}</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Right: preview */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {!selected ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                <Zap size={20} className="text-slate-600" />
                <span className="text-xs">选择左侧 Skill 预览内容</span>
              </div>
            ) : detailLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 size={16} className="animate-spin text-slate-500" />
              </div>
            ) : detail ? (
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                {/* Frontmatter info (compact) */}
                {Object.keys(detail.frontmatter).length > 0 && (
                  <div className="px-4 pt-3 pb-2 flex-shrink-0">
                    <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 space-y-1">
                      {!!detail.frontmatter.description && (
                        <div className="text-[11px] text-slate-300">
                          <span className="text-slate-500">描述：</span>
                          {String(detail.frontmatter.description)}
                        </div>
                      )}
                      <div className="flex items-center gap-4">
                        {!!detail.frontmatter.model && (
                          <div className="text-[11px] text-slate-300">
                            <span className="text-slate-500">模型：</span>
                            {String(detail.frontmatter.model)}
                          </div>
                        )}
                        {!!detail.frontmatter["argument-hint"] && (
                          <div className="text-[11px] text-slate-300">
                            <span className="text-slate-500">参数：</span>
                            <code className="text-amber-glow/80 bg-amber-glow/5 px-1 rounded text-[10px]">
                              {String(detail.frontmatter["argument-hint"])}
                            </code>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* File tree (new format / plugin, only when extra files exist) */}
                {canBrowseFiles && fileTree && hasExtraFiles && (
                  <div className="px-4 pb-2 flex-shrink-0">
                    <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">
                      文件目录
                    </div>
                    <div className="rounded-lg bg-white/[0.02] border border-white/5 py-1 max-h-[140px] overflow-y-auto">
                      {fileTree.children && fileTree.children.length > 0 ? (
                        fileTree.children.map((child) => (
                          <FileTreeItem
                            key={child.path}
                            node={child}
                            selectedFile={selectedFile}
                            onSelect={setSelectedFile}
                          />
                        ))
                      ) : (
                        /* If tree itself is the skill dir with no children, show it */
                        <FileTreeItem
                          node={fileTree}
                          selectedFile={selectedFile}
                          onSelect={setSelectedFile}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Old format hint */}
                {isOldFormat && (
                  <div className="px-4 pb-2 flex-shrink-0">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-white/[0.02] border border-white/5 rounded-lg px-3 py-1.5">
                      <FileText size={10} className="flex-shrink-0" />
                      <span>旧格式单文件 Skill (commands/)，建议迁移到 skills/ 目录格式</span>
                    </div>
                  </div>
                )}

                {/* Content viewer */}
                <div className="flex-1 min-h-0 px-4 pb-3 flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                      {viewerFileName}
                    </span>
                    <span className="text-[9px] text-slate-600 font-mono">{viewerLanguage}</span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto rounded-lg bg-white/[0.02] border border-white/5">
                    {fileLoading ? (
                      <div className="flex justify-center py-6">
                        <Loader2 size={14} className="animate-spin text-slate-500" />
                      </div>
                    ) : canBrowseFiles && fileContent ? (
                      isMarkdownFile ? (
                        <div className="p-3 text-[12px] [&_.prose-obsidian]:text-[12px] [&_.prose-obsidian_h1]:text-[15px] [&_.prose-obsidian_h2]:text-[13px] [&_.prose-obsidian_h3]:text-[12px] [&_.prose-obsidian_pre]:text-[11px]">
                          <MarkdownRenderer content={stripFrontmatter(fileContent.content || "(空文件)")} />
                        </div>
                      ) : (
                        <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed p-3">
                          {fileContent.content || "(空文件)"}
                        </pre>
                      )
                    ) : isMarkdownFile ? (
                      <div className="p-3 text-[12px] [&_.prose-obsidian]:text-[12px] [&_.prose-obsidian_h1]:text-[15px] [&_.prose-obsidian_h2]:text-[13px] [&_.prose-obsidian_h3]:text-[12px] [&_.prose-obsidian_pre]:text-[11px]">
                        <MarkdownRenderer content={stripFrontmatter(detail.content || "(无内容)")} />
                      </div>
                    ) : (
                      <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed p-3">
                        {detail.content || "(无内容)"}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 text-center py-10">
                无法加载 Skill 内容
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/5 flex justify-end flex-shrink-0">
          <button
            onClick={handleClose}
            className="px-4 py-1.5 text-sm rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors border border-white/5"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

/* Helper: find SKILL.md path in tree */
function findSkillMdPath(node: FileNode): string | null {
  if (node.type === "file" && node.name === "SKILL.md") return node.path;
  if (node.children) {
    for (const child of node.children) {
      const found = findSkillMdPath(child);
      if (found) return found;
    }
  }
  return null;
}
