import { useEffect, useState } from "react";
import {
  Bot,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Loader2,
  GitBranch,
  Clock,
  Wrench,
  Play,
} from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";
import { useUIStore } from "../../stores/uiStore";
import type { AgentInfo } from "../../types/agent";

const AVAILABLE_TOOLS = [
  "Read", "Edit", "Write", "Bash", "Glob", "Grep",
  "Agent", "WebFetch", "WebSearch", "NotebookEdit",
  "TodoRead", "TodoWrite", "TaskCreate", "TaskUpdate",
];

/* ── 公共输入样式 ── */
const INPUT_CLS = "w-full text-xs bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-glow/30";
const SELECT_CLS = "text-xs bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-slate-200 focus:outline-none focus:border-amber-glow/30 [&_option]:bg-[#1e1b2e] [&_option]:text-slate-200";

export default function AgentManager() {
  const {
    builtinAgents, projectAgents, userAgents,
    editingAgent, loading,
    loadAgents, openAgent, saveAgent, deleteAgent, closeEditor,
  } = useAgentStore();
  const projectPath = useUIStore((s) => s.projectPath);
  const setPrefillInput = useUIStore((s) => s.setPrefillInput);

  const [formName,       setFormName]       = useState("");
  const [formDesc,       setFormDesc]       = useState("");
  const [formModel,      setFormModel]      = useState("inherit");
  const [formMaxTurns,   setFormMaxTurns]   = useState("20");
  const [formTools,      setFormTools]      = useState<string[]>(["Read", "Grep", "Glob"]);
  const [formBackground, setFormBackground] = useState(false);
  const [formIsolation,  setFormIsolation]  = useState(false);
  const [formContent,    setFormContent]    = useState("");
  const [formScope,      setFormScope]      = useState<"project" | "user">("project");
  const [formPermMode,   setFormPermMode]   = useState("default");
  const [formDisallowedTools, setFormDisallowedTools] = useState<string[]>([]);
  const [formBashPattern, setFormBashPattern] = useState("");
  const [formSkills,     setFormSkills]     = useState<string[]>([]);
  const [formMcpServers, setFormMcpServers] = useState<string[]>([]);
  const [formMemory,     setFormMemory]     = useState("project");
  const [showCreate,     setShowCreate]     = useState(false);

  useEffect(() => { loadAgents(projectPath); }, [projectPath, loadAgents]);

  useEffect(() => {
    if (editingAgent) {
      const fm = editingAgent.frontmatter;
      setFormName(editingAgent.name);
      setFormDesc((fm.description as string) || "");
      setFormModel((fm.model as string) || "inherit");
      setFormMaxTurns(String(fm.maxTurns || 20));
      setFormTools((fm.tools as string[]) || ["Read", "Grep", "Glob"]);
      setFormBackground(!!(fm.background));
      setFormIsolation(fm.isolation === "worktree");
      setFormPermMode((fm.permissionMode as string) || "default");
      setFormDisallowedTools((fm.disallowedTools as string[]) || []);
      setFormBashPattern((fm.bashPattern as string) || "");
      setFormSkills((fm.skills as string[]) || []);
      setFormMcpServers((fm.mcpServers as string[]) || []);
      setFormMemory((fm.memory as string) || "project");
      setFormContent(editingAgent.content);
      setFormScope(
        projectAgents.some((a) => a.name === editingAgent.name) ? "project" : "user"
      );
      setShowCreate(true);
    }
  }, [editingAgent, projectAgents]);

  const handleSave = async () => {
    if (!formName) return;
    const frontmatter: Record<string, unknown> = {
      name: formName, description: formDesc, model: formModel,
      maxTurns: parseInt(formMaxTurns) || 20, tools: formTools,
      background: formBackground || undefined,
      isolation: formIsolation ? "worktree" : undefined,
      permissionMode: formPermMode !== "default" ? formPermMode : undefined,
      disallowedTools: formDisallowedTools.length > 0 ? formDisallowedTools : undefined,
      bashPattern: formBashPattern || undefined,
      skills: formSkills.length > 0 ? formSkills : undefined,
      mcpServers: formMcpServers.length > 0 ? formMcpServers : undefined,
      memory: formMemory !== "project" ? formMemory : undefined,
    };
    await saveAgent(formScope, formName, frontmatter, formContent, projectPath);
    resetForm();
  };

  const resetForm = () => {
    setShowCreate(false);
    setFormName(""); setFormDesc(""); setFormModel("inherit");
    setFormMaxTurns("20"); setFormTools(["Read", "Grep", "Glob"]);
    setFormBackground(false); setFormIsolation(false); setFormContent("");
    setFormPermMode("default"); setFormDisallowedTools([]);
    setFormBashPattern(""); setFormSkills([]); setFormMcpServers([]);
    setFormMemory("project");
    closeEditor();
  };

  const toggleTool = (tool: string) => {
    setFormTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  const handleLaunch = (agent: AgentInfo) => {
    const prefix = `@${agent.name}`;
    const desc = agent.description ? ` ${agent.description}: ` : ": ";
    setPrefillInput(`${prefix}${desc}`);
  };

  /* ── Editor view ── */
  if (showCreate) {
    return (
      <div className="p-3 space-y-3 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200">
            {editingAgent ? `编辑 Agent: ${editingAgent.name}` : "新建 Agent"}
          </span>
          <button onClick={resetForm}
            className="p-1.5 rounded-md hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
            <X size={13} />
          </button>
        </div>

        {/* Basic info */}
        <div className="space-y-2">
          <input value={formName} onChange={(e) => setFormName(e.target.value)}
            placeholder="Agent 名称" disabled={!!editingAgent}
            className={`${INPUT_CLS} disabled:opacity-50`} />
          <input value={formDesc} onChange={(e) => setFormDesc(e.target.value)}
            placeholder="描述（可选）" className={INPUT_CLS} />
        </div>

        {/* Model & config */}
        <div className="flex gap-2">
          <select value={formModel} onChange={(e) => setFormModel(e.target.value)}
            className={`flex-1 ${SELECT_CLS}`}>
            <option value="inherit">继承 (inherit)</option>
            <option value="opus">Opus</option>
            <option value="sonnet">Sonnet</option>
            <option value="haiku">Haiku</option>
          </select>
          <select value={formScope} onChange={(e) => setFormScope(e.target.value as "project" | "user")}
            className={`flex-1 ${SELECT_CLS}`}>
            <option value="project">项目级</option>
            <option value="user">用户级</option>
          </select>
          <input value={formMaxTurns} onChange={(e) => setFormMaxTurns(e.target.value)}
            placeholder="轮次" type="number"
            className="w-16 text-xs bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-slate-200 focus:outline-none" />
        </div>

        {/* Tools */}
        <div>
          <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1.5">
            允许工具
          </div>
          <div className="flex flex-wrap gap-1">
            {AVAILABLE_TOOLS.map((tool) => (
              <button key={tool} onClick={() => toggleTool(tool)}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                  formTools.includes(tool)
                    ? "bg-amber-glow/10 text-amber-glow border-amber-glow/20"
                    : "bg-white/[0.03] text-slate-500 border-white/8 hover:border-white/15"
                }`}>
                {tool}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced options */}
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
            <input type="checkbox" checked={formBackground}
              onChange={() => setFormBackground(!formBackground)}
              className="accent-amber-glow" />
            后台运行
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
            <input type="checkbox" checked={formIsolation}
              onChange={() => setFormIsolation(!formIsolation)}
              className="accent-amber-glow" />
            Worktree 隔离
          </label>
        </div>

        {/* Permission mode & memory */}
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">
              权限模式
            </div>
            <select value={formPermMode} onChange={(e) => setFormPermMode(e.target.value)}
              className={`w-full ${SELECT_CLS}`}>
              <option value="default">default</option>
              <option value="acceptEdits">acceptEdits</option>
              <option value="bypassPermissions">bypassPermissions</option>
              <option value="plan">plan</option>
            </select>
          </div>
          <div className="flex-1">
            <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">
              Memory
            </div>
            <select value={formMemory} onChange={(e) => setFormMemory(e.target.value)}
              className={`w-full ${SELECT_CLS}`}>
              <option value="project">project</option>
              <option value="user">user</option>
              <option value="none">none</option>
            </select>
          </div>
        </div>

        {/* Bash pattern */}
        <div>
          <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">
            Bash 限制模式
          </div>
          <input value={formBashPattern} onChange={(e) => setFormBashPattern(e.target.value)}
            placeholder="如: npm audit *, npm test *" className={INPUT_CLS} />
        </div>

        {/* Disallowed tools */}
        <div>
          <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1.5">
            禁用工具
          </div>
          <div className="flex flex-wrap gap-1">
            {AVAILABLE_TOOLS.map((tool) => (
              <button key={tool} onClick={() => {
                setFormDisallowedTools((prev) =>
                  prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
                );
              }}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                  formDisallowedTools.includes(tool)
                    ? "bg-rose-err/10 text-rose-err border-rose-err/20"
                    : "bg-white/[0.03] text-slate-500 border-white/8 hover:border-white/15"
                }`}>
                {tool}
              </button>
            ))}
          </div>
        </div>

        {/* Skills & MCP Servers tags */}
        <div className="grid grid-cols-2 gap-2">
          <TagInput label="Skills" value={formSkills} onChange={setFormSkills}
            placeholder="输入后回车" />
          <TagInput label="MCP Servers" value={formMcpServers} onChange={setFormMcpServers}
            placeholder="输入后回车" />
        </div>

        {/* Prompt content */}
        <div>
          <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1.5">
            Prompt 内容
          </div>
          <textarea value={formContent} onChange={(e) => setFormContent(e.target.value)}
            rows={10} placeholder="在此编写 Agent 的系统 Prompt..."
            className="w-full text-xs font-mono bg-white/5 border border-white/10 rounded-md
                       px-2.5 py-2 text-slate-200 placeholder-slate-500 focus:outline-none
                       focus:border-amber-glow/30 resize-none leading-relaxed" />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={resetForm}
            className="text-xs px-3 py-1.5 rounded-md text-slate-400 hover:text-slate-200 transition-colors">
            取消
          </button>
          <button onClick={handleSave}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md
                       bg-amber-glow/10 text-amber-glow hover:bg-amber-glow/20
                       border border-amber-glow/20 transition-colors">
            <Save size={12} /> 保存
          </button>
        </div>
      </div>
    );
  }

  /* ── List view ── */
  return (
    <div className="p-3 space-y-3 overflow-y-auto">
      <button onClick={() => setShowCreate(true)}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md
                   bg-[#ca5d3d] hover:bg-amber-glow text-white font-medium
                   transition-colors shadow-sm shadow-[#703123]/30">
        <Plus size={12} /> 新建 Agent
      </button>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={16} className="animate-spin text-slate-500" />
        </div>
      ) : (
        <>
          <AgentSection title="内置 Agent" agents={builtinAgents} isBuiltin />
          <AgentSection title="项目级 Agent" agents={projectAgents} scope="project"
            projectPath={projectPath} onEdit={openAgent} onDelete={deleteAgent} onLaunch={handleLaunch} />
          <AgentSection title="用户级 Agent" agents={userAgents} scope="user"
            projectPath={projectPath} onEdit={openAgent} onDelete={deleteAgent} onLaunch={handleLaunch} />
        </>
      )}
    </div>
  );
}

/* ── Tag input helper ── */
function TagInput({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      const tag = input.trim();
      if (!value.includes(tag)) onChange([...value, tag]);
      setInput("");
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };
  return (
    <div>
      <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="flex flex-wrap gap-1 mb-1">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5
            bg-purple-glow/10 text-purple-glow border border-purple-glow/20 rounded">
            {tag}
            <X size={8} className="cursor-pointer hover:text-white" onClick={() => onChange(value.filter((t) => t !== tag))} />
          </span>
        ))}
      </div>
      <input value={input} onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown} placeholder={placeholder}
        className={INPUT_CLS} />
    </div>
  );
}

function AgentSection({
  title, agents, isBuiltin, scope, projectPath, onEdit, onDelete, onLaunch,
}: {
  title: string;
  agents: AgentInfo[];
  isBuiltin?: boolean;
  scope?: "project" | "user";
  projectPath?: string;
  onEdit?: (scope: "project" | "user", name: string, project?: string) => void;
  onDelete?: (scope: "project" | "user", name: string, project?: string) => void;
  onLaunch?: (agent: AgentInfo) => void;
}) {
  if (agents.length === 0 && !isBuiltin) return null;

  return (
    <div>
      <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1.5">
        {title}
      </div>
      <div className="space-y-1.5">
        {agents.length === 0 && isBuiltin && (
          <div className="text-xs text-slate-500 px-1">暂无内置 Agent</div>
        )}
        {agents.map((a) => (
          <div key={a.name}
            className="p-2.5 rounded-xl border border-white/8 bg-white/[0.02]
                       hover:border-white/12 hover:bg-white/[0.04] transition-colors">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Bot size={13} className={isBuiltin ? "text-slate-400" : "text-amber-glow"} />
                <span className="text-xs font-medium text-slate-200">{a.name}</span>
                {a.model && a.model !== "inherit" && (
                  <span className="text-[9px] font-mono text-slate-500">{a.model}</span>
                )}
                {isBuiltin && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500 border border-white/8">
                    系统
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5">
                {!isBuiltin && onLaunch && (
                  <button onClick={() => onLaunch(a)}
                    className="p-1.5 rounded-md hover:bg-emerald-ok/10 text-slate-400
                               hover:text-emerald-ok transition-colors"
                    title="启动 Agent">
                    <Play size={11} />
                  </button>
                )}
                {!isBuiltin && scope && (
                  <>
                    <button onClick={() => onEdit?.(scope, a.name, projectPath)}
                      className="p-1.5 rounded-md hover:bg-white/5 text-slate-400
                                 hover:text-slate-200 transition-colors">
                      <Pencil size={11} />
                    </button>
                    <button onClick={() => onDelete?.(scope, a.name, projectPath)}
                      className="p-1.5 rounded-md hover:bg-rose-err/10 text-slate-400
                                 hover:text-rose-err transition-colors">
                      <Trash2 size={11} />
                    </button>
                  </>
                )}
              </div>
            </div>
            {a.description && (
              <p className="text-[10px] text-slate-400 mb-1 pl-5 leading-relaxed">
                {a.description}
              </p>
            )}
            <div className="flex items-center gap-3 pl-5 flex-wrap">
              {a.background && (
                <span className="inline-flex items-center gap-0.5 text-[9px] text-violet-info">
                  <Clock size={8} /> 后台
                </span>
              )}
              {a.isolation && (
                <span className="inline-flex items-center gap-0.5 text-[9px] text-sky-link">
                  <GitBranch size={8} /> {a.isolation}
                </span>
              )}
              {a.tools && (
                <span className="inline-flex items-center gap-0.5 text-[9px] text-slate-500">
                  <Wrench size={8} /> {a.tools.length} 工具
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
