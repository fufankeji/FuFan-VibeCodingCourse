import { useState, useRef, useCallback } from "react";
import {
  X, Upload, Sparkles, PenLine, Save, Loader2, XCircle,
} from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useSkillStore } from "../../stores/skillStore";
import { api } from "../../services/api";
import { parseFrontmatter } from "../../utils/frontmatterParser";

type CreateMode = "upload" | "ai" | "manual";

const NAME_RE = /^[a-zA-Z0-9_-]+$/;

const INPUT_CLS =
  "w-full text-xs bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-glow/30";
const SELECT_CLS =
  "text-xs bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-amber-glow/30";

export default function CreateSkillModal() {
  const { createSkillModalOpen, setCreateSkillModalOpen, projectPath } = useUIStore();
  const { loadSkills } = useSkillStore();

  const [mode, setMode] = useState<CreateMode>("manual");

  // Shared editable fields
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"project" | "user">("project");
  const [description, setDescription] = useState("");
  const [model, setModel] = useState("inherit");
  const [argumentHint, setArgumentHint] = useState("");
  const [promptContent, setPromptContent] = useState("");

  // AI mode state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiModel, setAiModel] = useState("sonnet");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Upload mode state
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // General
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setMode("manual");
    setName("");
    setScope("project");
    setDescription("");
    setModel("inherit");
    setArgumentHint("");
    setPromptContent("");
    setAiPrompt("");
    setAiModel("sonnet");
    setGenerating(false);
    setGenError(null);
    setSaving(false);
    setError(null);
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const handleClose = () => {
    resetForm();
    setCreateSkillModalOpen(false);
  };

  // ── Upload handlers ──
  const handleFileContent = (text: string) => {
    const { frontmatter, content } = parseFrontmatter(text);
    setDescription((frontmatter.description as string) || "");
    setModel((frontmatter.model as string) || "inherit");
    setArgumentHint((frontmatter["argument-hint"] as string) || "");
    setPromptContent(content);
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith(".md")) {
      setError("请上传 .md 文件");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      handleFileContent(text);
      // Auto-fill name from filename if empty
      if (!name) {
        const base = file.name.replace(/\.md$/, "");
        if (NAME_RE.test(base)) setName(base);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  };

  // ── AI generate ──
  const handleGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    setGenError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await api.generateSkill(aiPrompt.trim(), aiModel, controller.signal);
      // Fill form from generated content
      const fm = result.frontmatter;
      setDescription((fm.description as string) || "");
      setModel((fm.model as string) || "inherit");
      setArgumentHint((fm["argument-hint"] as string) || "");
      // Use the raw content which includes frontmatter — parse just the body
      const { content } = parseFrontmatter(result.content);
      setPromptContent(content);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setGenError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  };

  const handleCancelGenerate = () => {
    abortRef.current?.abort();
    setGenerating(false);
  };

  // ── Save ──
  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("请输入 Skill 名称");
      return;
    }
    if (!NAME_RE.test(trimmedName)) {
      setError("名称只能包含字母、数字、下划线和连字符");
      return;
    }
    if (!promptContent.trim()) {
      setError("Prompt 内容不能为空");
      return;
    }

    setError(null);
    setSaving(true);

    const frontmatter: Record<string, unknown> = {};
    frontmatter.name = trimmedName;
    if (description.trim()) frontmatter.description = description.trim();
    if (model && model !== "inherit") frontmatter.model = model;
    if (argumentHint.trim()) frontmatter["argument-hint"] = argumentHint.trim();

    try {
      await api.saveSkill(scope, trimmedName, frontmatter, promptContent.trim(), projectPath);
      await loadSkills(projectPath);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  if (!createSkillModalOpen) return null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="modal-content glass-panel rounded-2xl w-full max-w-[620px] max-h-[85vh] flex flex-col shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-amber-glow/15 flex items-center justify-center">
            <PenLine size={14} className="text-amber-glow" />
          </div>
          <h2 className="text-sm font-semibold text-white flex-1">新建 Skill</h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 px-5 py-2.5 border-b border-white/5 flex-shrink-0">
          {([
            { key: "upload" as CreateMode, label: "上传文件", icon: Upload },
            { key: "ai" as CreateMode, label: "AI 生成", icon: Sparkles },
            { key: "manual" as CreateMode, label: "手动编写", icon: PenLine },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
                mode === key
                  ? "bg-amber-glow/15 text-amber-glow font-medium"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-4">
          {/* Mode-specific section */}
          {mode === "upload" && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed transition-colors
                  ${dragOver
                    ? "border-amber-glow/50 bg-amber-glow/5"
                    : "border-white/10 hover:border-white/20 bg-white/[0.02]"
                  }
                `}
              >
                <Upload size={24} className={dragOver ? "text-amber-glow" : "text-slate-500"} />
                <span className="text-xs text-slate-400">
                  拖放 <code className="text-amber-glow/80 bg-amber-glow/5 px-1 rounded">.md</code> 文件到此处，或点击选择
                </span>
              </div>
            </div>
          )}

          {mode === "ai" && (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1 block">
                  描述你想要的 Skill
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={3}
                  placeholder="例如：创建一个代码审查 Skill，要求检查安全漏洞、性能问题和代码规范..."
                  className="w-full text-xs bg-white/5 border border-white/10 rounded-md px-2.5 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-glow/30 resize-none"
                />
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className={SELECT_CLS}
                >
                  <option value="sonnet">Sonnet</option>
                  <option value="haiku">Haiku</option>
                  <option value="opus">Opus</option>
                </select>
                {generating ? (
                  <button
                    onClick={handleCancelGenerate}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-rose-err/10 text-rose-err border border-rose-err/20 transition-colors"
                  >
                    <XCircle size={12} /> 取消生成
                  </button>
                ) : (
                  <button
                    onClick={handleGenerate}
                    disabled={!aiPrompt.trim()}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-[#ca5d3d] hover:bg-amber-glow text-white font-medium transition-colors disabled:opacity-40"
                  >
                    <Sparkles size={12} /> 生成
                  </button>
                )}
                {generating && <Loader2 size={14} className="animate-spin text-amber-glow" />}
              </div>
              {genError && (
                <div className="px-3 py-2 rounded-lg bg-rose-err/10 border border-rose-err/20 text-xs text-rose-err">
                  {genError}
                </div>
              )}
            </div>
          )}

          {/* Shared preview/edit area */}
          <div className="space-y-3">
            <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
              {mode === "manual" ? "Skill 内容" : "预览 / 编辑"}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">描述</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="简要描述 Skill 功能"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">模型</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className={`w-full ${SELECT_CLS}`}
                >
                  <option value="inherit">继承 (inherit)</option>
                  <option value="opus">Opus</option>
                  <option value="sonnet">Sonnet</option>
                  <option value="haiku">Haiku</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 mb-1 block">参数提示</label>
              <input
                value={argumentHint}
                onChange={(e) => setArgumentHint(e.target.value)}
                placeholder='例如 "[file] [options]"（可选）'
                className={INPUT_CLS}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-slate-500">Prompt 内容</label>
                <span className="text-[9px] text-slate-600">
                  用 <code className="text-amber-glow/70 bg-amber-glow/5 px-0.5 rounded">$ARGUMENTS</code> 作为输入占位符
                </span>
              </div>
              <textarea
                value={promptContent}
                onChange={(e) => setPromptContent(e.target.value)}
                rows={8}
                placeholder="在此编写 Skill 的 Prompt 指令内容..."
                className="w-full text-xs font-mono bg-white/5 border border-white/10 rounded-md px-2.5 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-glow/30 resize-none leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Footer: name, scope, save */}
        <div className="px-5 py-3 border-t border-white/5 flex-shrink-0 space-y-3">
          {error && (
            <div className="px-3 py-2 rounded-lg bg-rose-err/10 border border-rose-err/20 text-xs text-rose-err">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Skill 名称（字母/数字/下划线/连字符）"
                className={INPUT_CLS}
              />
            </div>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as "project" | "user")}
              className={SELECT_CLS}
            >
              <option value="project">项目级</option>
              <option value="user">用户级</option>
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-1.5 text-sm rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors border border-white/5"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving || generating}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg bg-[#ca5d3d] hover:bg-amber-glow text-white font-medium transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              保存 Skill
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
