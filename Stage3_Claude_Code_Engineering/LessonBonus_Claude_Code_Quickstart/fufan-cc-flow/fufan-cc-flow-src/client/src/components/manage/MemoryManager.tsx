import { useEffect, useRef, useState } from "react";
import {
  Brain,
  FileText,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Loader2,
  ChevronDown,
  ChevronRight,
  BookOpen,
  ScrollText,
  AlertTriangle,
  User,
  FolderOpen,
} from "lucide-react";
import { useMemoryStore } from "../../stores/memoryStore";
import { useUIStore } from "../../stores/uiStore";
import { api } from "../../services/api";

const INPUT_CLS =
  "w-full text-xs bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-glow/30";

const SCOPE_LABELS: Record<string, { label: string; desc: string; editable: boolean }> = {
  project:        { label: "项目级",      desc: "CLAUDE.md (项目根目录)",         editable: true },
  "project-alt":  { label: "项目级 (alt)", desc: ".claude/CLAUDE.md",            editable: true },
  "project-rules":{ label: "Rules 目录",  desc: ".claude/rules/",                editable: false },
  user:           { label: "用户级",      desc: "~/.claude/CLAUDE.md",            editable: true },
  "project-local":{ label: "本地",        desc: "CLAUDE.local.md (不提交 git)",    editable: true },
};

export default function MemoryManager() {
  const {
    autoMemoryEnabled, memoryIndex, topicFiles,
    claudeMdLevels, rules, userRules,
    loading, editingFile,
    loadAll, openFile, saveFile, deleteFile,
    createMemoryTopic, createRule, closeEditor, setAutoMemoryEnabled,
  } = useMemoryStore();
  const projectPath = useUIStore((s) => s.projectPath);

  const [autoMemoryOpen, setAutoMemoryOpen] = useState(true);
  const [claudeMdOpen, setClaudeMdOpen] = useState(true);
  const [rulesOpen, setRulesOpen] = useState(true);

  const [showNewTopic, setShowNewTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [showNewRule, setShowNewRule] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleContent, setNewRuleContent] = useState("");
  const [newRuleScope, setNewRuleScope] = useState<"project" | "user">("project");

  const [editContent, setEditContent] = useState("");

  // Clear memory confirmation state
  const [clearConfirming, setClearConfirming] = useState(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadAll(projectPath); }, [projectPath, loadAll]);

  useEffect(() => {
    if (editingFile) setEditContent(editingFile.content);
  }, [editingFile]);

  // Cleanup clear confirmation timer
  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  const handleCreateTopic = async () => {
    if (!newTopicName) return;
    await createMemoryTopic(newTopicName, projectPath);
    setShowNewTopic(false);
    setNewTopicName("");
  };

  const handleCreateRule = async () => {
    if (!newRuleName) return;
    await createRule(newRuleName, newRuleContent, projectPath, newRuleScope);
    setShowNewRule(false);
    setNewRuleName("");
    setNewRuleContent("");
  };

  const handleSave = async () => {
    if (!editingFile) return;
    await saveFile(editingFile.type, editingFile.name, editContent, projectPath, editingFile.scope);
  };

  const handleClearMemory = async () => {
    if (!clearConfirming) {
      setClearConfirming(true);
      clearTimerRef.current = setTimeout(() => setClearConfirming(false), 3000);
      return;
    }
    // Second click — execute
    setClearConfirming(false);
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    await api.clearAllMemory(projectPath);
    await loadAll(projectPath);
  };

  const handleCreateClaudeMd = (scope: string) => {
    // Open editor with empty content for a new CLAUDE.md
    const meta = SCOPE_LABELS[scope];
    useMemoryStore.setState({
      editingFile: { type: "claudemd", name: meta?.label || scope, content: "", scope },
    });
  };

  /* ── Editor view ── */
  if (editingFile) {
    const isMemoryMd = editingFile.type === "memory" && editingFile.name === "MEMORY.md";
    const isLarge = editingFile.type === "claudemd" || isMemoryMd;
    const rows = editingFile.type === "rule" ? 6 : isLarge ? 16 : 12;
    const typeLabel = editingFile.type === "memory" ? "Memory" : editingFile.type === "claudemd" ? "CLAUDE.md" : "Rule";

    const editLineCount = editContent.split("\n").length;
    const overLimit = isMemoryMd && editLineCount > 200;

    return (
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-glow/10 text-purple-glow">
              {typeLabel}
            </span>
            <span className="text-xs font-semibold text-slate-200">{editingFile.name}</span>
          </div>
          <button
            onClick={closeEditor}
            className="p-1.5 rounded-md hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <X size={13} />
          </button>
        </div>

        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          rows={rows}
          className="w-full text-xs font-mono bg-obsidian-900/50 border border-white/10 rounded-md
                     px-2.5 py-2 text-slate-200 placeholder-slate-500 focus:outline-none
                     focus:border-amber-glow/30 resize-none leading-relaxed"
          placeholder={editingFile.type === "rule" ? "输入规则内容..." : "输入内容..."}
        />

        {/* Line counter for MEMORY.md */}
        {isMemoryMd && (
          <div className="space-y-0.5">
            <div className={`text-[10px] font-mono ${overLimit ? "text-amber-glow" : "text-slate-500"}`}>
              当前 {editLineCount}/200 行
            </div>
            {overLimit && (
              <div className="flex items-start gap-1 text-[10px] text-amber-glow/80">
                <AlertTriangle size={10} className="mt-0.5 flex-shrink-0" />
                <span>超出 200 行的内容不会自动加载，建议拆分到 Topic 文件</span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={closeEditor}
            className="text-xs px-3 py-1.5 rounded-md text-slate-400 hover:text-slate-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md
                       bg-amber-glow/10 text-amber-glow hover:bg-amber-glow/20
                       border border-amber-glow/20 transition-colors"
          >
            <Save size={12} /> 保存
          </button>
        </div>
      </div>
    );
  }

  /* ── List view ── */
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={16} className="animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">

      {/* ════════ Section 1: Auto Memory ════════ */}
      <div>
        <button
          onClick={() => setAutoMemoryOpen(!autoMemoryOpen)}
          className="flex items-center gap-1.5 w-full text-left group"
        >
          {autoMemoryOpen ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-500" />}
          <Brain size={12} className="text-purple-glow" />
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider flex-1">
            Auto Memory
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              autoMemoryEnabled
                ? "bg-emerald-ok/10 text-emerald-ok"
                : "bg-slate-500/10 text-slate-500"
            }`}
            onClick={(e) => { e.stopPropagation(); setAutoMemoryEnabled(!autoMemoryEnabled); }}
          >
            {autoMemoryEnabled ? "已启用" : "已禁用"}
          </span>
        </button>

        {autoMemoryOpen && (
          <div className="mt-2 space-y-1.5 pl-1">
            {/* MEMORY.md index */}
            {memoryIndex ? (
              <FileCard
                icon={<Brain size={11} className="text-purple-glow" />}
                name="MEMORY.md"
                detail={`${memoryIndex.lineCount} 行 · 主索引`}
                onEdit={() => openFile("memory", "MEMORY.md", projectPath)}
              />
            ) : (
              <div className="text-[10px] text-slate-500 py-2 pl-5">暂无 MEMORY.md</div>
            )}

            {/* Topic files */}
            {topicFiles.map((f) => (
              <FileCard
                key={f.name}
                icon={<FileText size={11} className="text-slate-400" />}
                name={f.name}
                detail={f.preview.slice(0, 40)}
                onEdit={() => openFile("memory", f.name, projectPath)}
                onDelete={() => deleteFile("memory", f.name, projectPath)}
              />
            ))}

            {/* New topic */}
            {showNewTopic ? (
              <div className="flex gap-2 mt-1">
                <input
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  placeholder="文件名 (如 patterns.md)"
                  className={INPUT_CLS + " flex-1"}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateTopic()}
                />
                <button
                  onClick={handleCreateTopic}
                  className="text-xs px-2.5 py-1.5 rounded-md bg-amber-glow/10 text-amber-glow
                             hover:bg-amber-glow/20 border border-amber-glow/20 transition-colors"
                >
                  创建
                </button>
                <button onClick={() => setShowNewTopic(false)} className="text-xs text-slate-400 hover:text-slate-200">
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewTopic(true)}
                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 mt-1 pl-5 transition-colors"
              >
                <Plus size={10} /> 新建 Topic 文件
              </button>
            )}

            {/* Clear all memory */}
            {(memoryIndex || topicFiles.length > 0) && (
              <button
                onClick={handleClearMemory}
                className={`flex items-center gap-1 text-[10px] mt-1 pl-5 transition-colors ${
                  clearConfirming
                    ? "text-rose-err font-medium"
                    : "text-slate-500 hover:text-rose-err"
                }`}
              >
                <Trash2 size={10} />
                {clearConfirming ? "确认清空？再次点击" : "清空所有 Memory"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ════════ Section 2: CLAUDE.md ════════ */}
      <div>
        <button
          onClick={() => setClaudeMdOpen(!claudeMdOpen)}
          className="flex items-center gap-1.5 w-full text-left"
        >
          {claudeMdOpen ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-500" />}
          <BookOpen size={12} className="text-amber-glow" />
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
            CLAUDE.md
          </span>
        </button>

        {claudeMdOpen && (
          <div className="mt-2 space-y-1.5 pl-1">
            {claudeMdLevels
              .filter((l) => l.scope !== "project-rules") // rules shown separately
              .map((level) => {
                const meta = SCOPE_LABELS[level.scope] || { label: level.scope, desc: level.path, editable: false };
                return (
                  <div
                    key={level.scope}
                    className="flex items-center justify-between p-2 rounded-lg border border-white/8
                               bg-white/[0.02] hover:border-white/12 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <BookOpen size={11} className="text-amber-glow flex-shrink-0" />
                        <span className="text-xs font-medium text-slate-200">{meta.label}</span>
                        {level.exists ? (
                          <span className="text-[9px] text-slate-500 font-mono">{level.lineCount} 行</span>
                        ) : (
                          <span className="text-[9px] text-slate-500">不存在</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 truncate pl-4 font-mono">
                        {meta.desc}
                      </p>
                    </div>
                    {meta.editable && level.exists && (
                      <button
                        onClick={() => openFile("claudemd", meta.label, projectPath, level.scope)}
                        className="p-1.5 rounded-md hover:bg-white/5 text-slate-400
                                   hover:text-slate-200 transition-colors flex-shrink-0"
                      >
                        <Pencil size={11} />
                      </button>
                    )}
                    {meta.editable && !level.exists && (
                      <button
                        onClick={() => handleCreateClaudeMd(level.scope)}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md
                                   bg-amber-glow/10 text-amber-glow hover:bg-amber-glow/20
                                   border border-amber-glow/20 transition-colors flex-shrink-0"
                      >
                        <Plus size={9} /> 创建
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* ════════ Section 3: Rules ════════ */}
      <div>
        <button
          onClick={() => setRulesOpen(!rulesOpen)}
          className="flex items-center gap-1.5 w-full text-left"
        >
          {rulesOpen ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-500" />}
          <ScrollText size={12} className="text-sky-link" />
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider flex-1">
            Rules
          </span>
        </button>

        {rulesOpen && (
          <div className="mt-2 space-y-2.5 pl-1">
            {/* Project rules */}
            <div>
              <div className="flex items-center gap-1 mb-1">
                <FolderOpen size={10} className="text-slate-500" />
                <span className="text-[10px] text-slate-500 font-mono">.claude/rules/</span>
              </div>
              {rules.length === 0 ? (
                <div className="text-[10px] text-slate-500 py-1 pl-5">暂无项目级规则</div>
              ) : (
                rules.map((r) => (
                  <FileCard
                    key={`project-${r.name}`}
                    icon={<ScrollText size={11} className="text-sky-link" />}
                    name={r.name}
                    detail={`${r.lineCount} 行`}
                    onEdit={() => openFile("rule", r.name, projectPath, "project")}
                    onDelete={() => deleteFile("rule", r.name, projectPath, "project")}
                  />
                ))
              )}
            </div>

            {/* User rules */}
            <div>
              <div className="flex items-center gap-1 mb-1">
                <User size={10} className="text-slate-500" />
                <span className="text-[10px] text-slate-500 font-mono">~/.claude/rules/</span>
              </div>
              {userRules.length === 0 ? (
                <div className="text-[10px] text-slate-500 py-1 pl-5">暂无用户级规则</div>
              ) : (
                userRules.map((r) => (
                  <FileCard
                    key={`user-${r.name}`}
                    icon={<ScrollText size={11} className="text-purple-glow" />}
                    name={r.name}
                    detail={`${r.lineCount} 行`}
                    onEdit={() => openFile("rule", r.name, projectPath, "user")}
                    onDelete={() => deleteFile("rule", r.name, projectPath, "user")}
                  />
                ))
              )}
            </div>

            {/* New rule form */}
            {showNewRule ? (
              <div className="space-y-2 mt-1 p-2.5 rounded-lg border border-white/10 bg-white/[0.03]">
                <div className="flex gap-2">
                  <input
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    placeholder="规则文件名 (如 code-style.md)"
                    className={INPUT_CLS + " flex-1"}
                  />
                  <select
                    value={newRuleScope}
                    onChange={(e) => setNewRuleScope(e.target.value as "project" | "user")}
                    className="text-[10px] bg-[#1e1b2e] border border-white/10 rounded-md px-1.5 text-slate-300
                               focus:outline-none focus:border-amber-glow/30
                               [&_option]:bg-[#1e1b2e] [&_option]:text-slate-200"
                  >
                    <option value="project">项目级</option>
                    <option value="user">用户级</option>
                  </select>
                </div>
                <textarea
                  value={newRuleContent}
                  onChange={(e) => setNewRuleContent(e.target.value)}
                  rows={4}
                  placeholder="规则内容..."
                  className="w-full text-xs font-mono bg-obsidian-900/50 border border-white/10 rounded-md
                             px-2.5 py-2 text-slate-200 placeholder-slate-500 focus:outline-none
                             focus:border-amber-glow/30 resize-none leading-relaxed"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowNewRule(false); setNewRuleName(""); setNewRuleContent(""); }}
                    className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleCreateRule}
                    className="text-xs px-2.5 py-1.5 rounded-md bg-amber-glow/10 text-amber-glow
                               hover:bg-amber-glow/20 border border-amber-glow/20 transition-colors"
                  >
                    创建
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNewRule(true)}
                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 mt-1 pl-5 transition-colors"
              >
                <Plus size={10} /> 新建规则
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Shared file card ── */
function FileCard({
  icon,
  name,
  detail,
  onEdit,
  onDelete,
}: {
  icon: React.ReactNode;
  name: string;
  detail?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg border border-white/8
                    bg-white/[0.02] hover:border-white/12 transition-colors">
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {icon}
        <span className="text-xs font-medium text-slate-200 truncate">{name}</span>
        {detail && (
          <span className="text-[10px] text-slate-500 truncate ml-1">{detail}</span>
        )}
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {onEdit && (
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Pencil size={11} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md hover:bg-rose-err/10 text-slate-400 hover:text-rose-err transition-colors"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
