import { useEffect, useState } from "react";
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Loader2,
  ChevronDown,
  ChevronRight,
  Lock,
  Package,
  FolderOpen,
} from "lucide-react";
import { useSkillStore } from "../../stores/skillStore";
import { useUIStore } from "../../stores/uiStore";

const INPUT_CLS = "w-full text-xs bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-glow/30";
const SELECT_CLS = "text-xs bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-amber-glow/30";

export default function SkillsManager() {
  const {
    projectSkills, userSkills, pluginSkills, loading, editingSkill,
    loadSkills, openSkill, saveSkill, deleteSkill, closeEditor,
  } = useSkillStore();
  const projectPath = useUIStore((s) => s.projectPath);
  const setSkillBrowserOpen = useUIStore((s) => s.setSkillBrowserOpen);
  const setSkillBrowserInitialSelection = useUIStore((s) => s.setSkillBrowserInitialSelection);
  const setCreateSkillModalOpen = useUIStore((s) => s.setCreateSkillModalOpen);

  const handleBrowseSkill = (scope: "project" | "user" | "plugin", name: string) => {
    setSkillBrowserInitialSelection({ tab: scope, name });
    setSkillBrowserOpen(true);
  };

  const [editContent,      setEditContent]      = useState("");
  const [editDescription,  setEditDescription]  = useState("");
  const [editModel,        setEditModel]        = useState("inherit");

  useEffect(() => { loadSkills(projectPath); }, [projectPath, loadSkills]);

  useEffect(() => {
    if (editingSkill) {
      setEditContent(editingSkill.content);
      setEditDescription((editingSkill.frontmatter.description as string) || "");
      setEditModel((editingSkill.frontmatter.model as string) || "inherit");
    }
  }, [editingSkill]);

  const handleSave = async () => {
    if (!editingSkill) return;
    const scope = projectSkills.some((s) => s.name === editingSkill.name) ? "project" : "user";
    const fm: Record<string, unknown> = { ...editingSkill.frontmatter, description: editDescription };
    // Only include model when it's a specific model, not "inherit" (which means use session default)
    if (editModel && editModel !== "inherit") {
      fm.model = editModel;
    } else {
      delete fm.model;
    }
    await saveSkill(
      scope as "project" | "user",
      editingSkill.name,
      fm,
      editContent,
      projectPath
    );
  };

  /* ── Editor view ── */
  if (editingSkill) {
    return (
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200">
            编辑 Skill: {editingSkill.name}
          </span>
          <button onClick={closeEditor}
            className="p-1.5 rounded-md hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
            <X size={13} />
          </button>
        </div>

        <input
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          placeholder="描述（可选）"
          className={INPUT_CLS}
        />

        <select
          value={editModel}
          onChange={(e) => setEditModel(e.target.value)}
          className={SELECT_CLS}
        >
          <option value="inherit">继承 (inherit)</option>
          <option value="opus">Opus</option>
          <option value="sonnet">Sonnet</option>
          <option value="haiku">Haiku</option>
        </select>

        <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
          SKILL.md 内容
        </div>
        <p className="text-[10px] text-slate-500 -mt-1">
          使用 <code className="text-amber-glow/80 bg-amber-glow/5 px-1 rounded">$ARGUMENTS</code> 作为用户输入占位符
        </p>
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          rows={12}
          placeholder="在此编写 Skill 的 Prompt 内容..."
          className="w-full text-xs font-mono bg-white/5 border border-white/10 rounded-md
                     px-2.5 py-2 text-slate-200 placeholder-slate-500 focus:outline-none
                     focus:border-amber-glow/30 resize-none leading-relaxed"
        />

        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md
                     bg-amber-glow/10 text-amber-glow hover:bg-amber-glow/20
                     border border-amber-glow/20 transition-colors"
        >
          <Save size={12} /> 保存
        </button>
      </div>
    );
  }

  /* ── List view ── */
  return (
    <div className="p-3 space-y-3">
      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCreateSkillModalOpen(true)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md
                     bg-[#ca5d3d] hover:bg-amber-glow text-white font-medium
                     transition-colors shadow-sm shadow-[#703123]/30"
        >
          <Plus size={12} /> 新建 Skill
        </button>
        <button
          onClick={() => setSkillBrowserOpen(true)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md
                     bg-amber-glow/10 text-amber-glow hover:bg-amber-glow/20
                     border border-amber-glow/20 transition-colors"
        >
          <FolderOpen size={12} /> 浏览文件夹
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={16} className="animate-spin text-slate-500" />
        </div>
      ) : (
        <>
          <BundledSkills />
          <PluginSkillsSection skills={pluginSkills} onBrowse={(name) => handleBrowseSkill("plugin", name)} />
          <SkillSection
            title="项目级 Skills"
            skills={projectSkills}
            scope="project"
            projectPath={projectPath}
            onEdit={openSkill}
            onDelete={deleteSkill}
            onBrowse={(name) => handleBrowseSkill("project", name)}
          />
          <SkillSection
            title="用户级 Skills"
            skills={userSkills}
            scope="user"
            projectPath={projectPath}
            onEdit={openSkill}
            onDelete={deleteSkill}
            onBrowse={(name) => handleBrowseSkill("user", name)}
          />
        </>
      )}
    </div>
  );
}

const BUNDLED_SKILLS = [
  { name: "simplify", description: "简化并压缩上下文" },
  { name: "batch", description: "批量处理多个文件" },
  { name: "debug", description: "调试和修复代码问题" },
];

function BundledSkills() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full text-left mb-1.5"
      >
        {open ? <ChevronDown size={10} className="text-slate-500" /> : <ChevronRight size={10} className="text-slate-500" />}
        <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
          内置 Skills
        </span>
        <Lock size={9} className="text-slate-600 ml-0.5" />
      </button>
      {open && (
        <div className="space-y-1.5 mb-3">
          {BUNDLED_SKILLS.map((s) => (
            <div
              key={s.name}
              className="flex items-center p-2.5 rounded-xl
                         border border-white/5 bg-white/[0.01]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Zap size={11} className="text-slate-500 flex-shrink-0" />
                  <span className="text-xs text-slate-400">/{s.name}</span>
                  <span className="text-[9px] px-1 py-0 rounded bg-slate-500/10 text-slate-500">内置</span>
                </div>
                <p className="text-[10px] text-slate-600 mt-0.5 pl-4">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PluginSkillsSection({ skills, onBrowse }: { skills: { name: string; description: string; pluginName?: string }[]; onBrowse: (name: string) => void }) {
  const [open, setOpen] = useState(false);

  if (skills.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full text-left mb-1.5"
      >
        {open ? <ChevronDown size={10} className="text-slate-500" /> : <ChevronRight size={10} className="text-slate-500" />}
        <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
          插件 Skills
        </span>
        <Package size={9} className="text-slate-600 ml-0.5" />
        <span className="text-[9px] text-slate-600">({skills.length})</span>
      </button>
      {open && (
        <div className="space-y-1.5 mb-3">
          {skills.map((s) => (
            <div
              key={`${s.pluginName}-${s.name}`}
              className="flex items-center p-2.5 rounded-xl
                         border border-white/5 bg-white/[0.01] hover:border-white/12
                         hover:bg-white/[0.04] transition-colors"
            >
              <div
                className="min-w-0 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => onBrowse(s.name)}
              >
                <div className="flex items-center gap-1.5">
                  <Zap size={11} className="text-amber-glow/60 flex-shrink-0" />
                  <span className="text-xs text-slate-400 hover:text-amber-glow transition-colors">/{s.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-glow/10 text-amber-glow">
                    插件内置
                  </span>
                  {s.pluginName && (
                    <span className="text-[9px] text-slate-600">
                      from {s.pluginName}
                    </span>
                  )}
                </div>
                {s.description && (
                  <p className="text-[10px] text-slate-600 mt-0.5 pl-4">{s.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SkillSection({
  title, skills, scope, projectPath, onEdit, onDelete, onBrowse,
}: {
  title: string;
  skills: { name: string; description: string; model?: string; source?: "skills" | "commands" }[];
  scope: "project" | "user";
  projectPath: string;
  onEdit: (scope: "project" | "user", name: string, project?: string) => void;
  onDelete: (scope: "project" | "user", name: string, project?: string) => void;
  onBrowse: (name: string) => void;
}) {
  if (skills.length === 0) return null;

  return (
    <div>
      <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1.5">
        {title}
      </div>
      <div className="space-y-1.5">
        {skills.map((s) => (
          <div
            key={s.name}
            className="flex items-center justify-between p-2.5 rounded-xl
                       border border-white/8 bg-white/[0.02] hover:border-white/12
                       hover:bg-white/[0.04] transition-colors"
          >
            <div
              className="min-w-0 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => onBrowse(s.name)}
            >
              <div className="flex items-center gap-1.5">
                <Zap size={11} className="text-amber-glow flex-shrink-0" />
                <span className="text-xs font-medium text-slate-200 hover:text-amber-glow transition-colors">/{s.name}</span>
                {s.source === "commands" && (
                  <span className="text-[9px] px-1 py-0 rounded bg-slate-500/10 text-slate-500">旧格式</span>
                )}
                {s.model && s.model !== "inherit" && (
                  <span className="text-[9px] text-slate-500 font-mono">{s.model}</span>
                )}
              </div>
              {s.description && (
                <p className="text-[10px] text-slate-500 mt-0.5 truncate pl-4">
                  {s.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => onEdit(scope, s.name, projectPath)}
                className="p-1.5 rounded-md hover:bg-white/5 text-slate-400
                           hover:text-slate-200 transition-colors"
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={() => onDelete(scope, s.name, projectPath)}
                className="p-1.5 rounded-md hover:bg-rose-err/10 text-slate-400
                           hover:text-rose-err transition-colors"
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
