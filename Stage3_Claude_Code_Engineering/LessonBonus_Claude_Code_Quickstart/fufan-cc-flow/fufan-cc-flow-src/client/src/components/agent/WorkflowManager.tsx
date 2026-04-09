import { useEffect, useState } from "react";
import {
  GitMerge,
  Plus,
  Play,
  Pencil,
  Trash2,
  X,
  Save,
  ArrowRight,
  Loader2,
  Bot,
} from "lucide-react";
import { useWorkflowStore } from "../../stores/workflowStore";
import { useAgentStore } from "../../stores/agentStore";
import { useUIStore } from "../../stores/uiStore";
import type { Workflow, WorkflowStep } from "../../types/workflow";

export default function WorkflowManager() {
  const {
    workflows, loading, editing,
    loadWorkflows, saveWorkflow, deleteWorkflow, setEditing, createNew,
  } = useWorkflowStore();
  const { projectAgents, userAgents } = useAgentStore();
  const { projectPath, setPrefillInput } = useUIStore();

  // Workflow execution: variable input
  const [execWorkflow, setExecWorkflow] = useState<Workflow | null>(null);
  const [varValues, setVarValues] = useState<Record<string, string>>({});

  useEffect(() => {
    loadWorkflows(projectPath);
  }, [projectPath, loadWorkflows]);

  const allAgents = [
    { name: "(主会话)", value: "" },
    ...projectAgents.map((a) => ({ name: a.name, value: a.name })),
    ...userAgents.map((a) => ({ name: a.name, value: a.name })),
  ];

  const handleExecute = (wf: Workflow) => {
    if (wf.variables.length > 0) {
      // Has variables — show inline form to fill them
      const initial: Record<string, string> = {};
      wf.variables.forEach((v) => { initial[v] = ""; });
      setVarValues(initial);
      setExecWorkflow(wf);
    } else {
      // No variables — execute directly
      composeAndSend(wf, {});
    }
  };

  const confirmExecute = () => {
    if (!execWorkflow) return;
    composeAndSend(execWorkflow, varValues);
    setExecWorkflow(null);
    setVarValues({});
  };

  const composeAndSend = (wf: Workflow, vars: Record<string, string>) => {
    // Build a structured prompt that describes the workflow steps
    const lines: string[] = [];
    lines.push(`请按照以下工作流「${wf.name}」的步骤顺序执行：\n`);

    wf.steps.forEach((step, i) => {
      let prompt = step.prompt;
      // Substitute variables
      for (const [k, v] of Object.entries(vars)) {
        prompt = prompt.replaceAll(`$${k}`, v);
      }
      const agentLabel = step.agent || "主会话（你自己）";
      lines.push(`**步骤 ${i + 1}**（${agentLabel}）：${prompt}`);
    });

    lines.push(`\n请严格按步骤顺序执行，每完成一步后再执行下一步。`);
    setPrefillInput(lines.join("\n"));
  };

  // ── Editor view ──
  if (editing) {
    return (
      <WorkflowEditor
        workflow={editing}
        agents={allAgents}
        onSave={async (wf) => {
          await saveWorkflow(wf, projectPath);
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  // ── Variable input form for execution ──
  if (execWorkflow) {
    return (
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Play size={13} className="text-emerald-ok" />
            <span className="text-xs font-medium text-slate-200">
              执行：{execWorkflow.name}
            </span>
          </div>
          <button onClick={() => setExecWorkflow(null)}
            className="p-1 rounded hover:bg-white/5 text-slate-400">
            <X size={13} />
          </button>
        </div>

        <p className="text-[10px] text-slate-400">
          请填写工作流变量，然后点击"开始执行"
        </p>

        <div className="space-y-2">
          {execWorkflow.variables.map((v) => (
            <div key={v}>
              <label className="text-[10px] text-slate-500 mb-1 block">
                ${v}
              </label>
              <input
                value={varValues[v] || ""}
                onChange={(e) => setVarValues({ ...varValues, [v]: e.target.value })}
                placeholder={`输入 $${v} 的值`}
                className="w-full text-xs bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-glow/30"
              />
            </div>
          ))}
        </div>

        {/* Step preview */}
        <div className="rounded-lg border border-white/8 bg-white/[0.02] p-2">
          <div className="text-[10px] text-slate-500 mb-1.5">执行步骤预览</div>
          {execWorkflow.steps.map((step, i) => {
            let prompt = step.prompt;
            for (const [k, val] of Object.entries(varValues)) {
              prompt = prompt.replaceAll(`$${k}`, val || `\${${k}}`);
            }
            return (
              <div key={i} className="flex items-start gap-2 mb-1.5 last:mb-0">
                <span className="text-[9px] text-amber-glow font-mono flex-shrink-0 mt-0.5">
                  {i + 1}.
                </span>
                <div className="text-[10px] text-slate-300 leading-relaxed">
                  <span className="text-violet-info">[{step.agent || "主会话"}]</span>{" "}
                  {prompt.length > 80 ? prompt.slice(0, 80) + "..." : prompt}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={() => setExecWorkflow(null)}
            className="text-xs px-3 py-1.5 text-slate-300 hover:text-white transition-colors">
            取消
          </button>
          <button onClick={confirmExecute}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-emerald-ok/15 text-emerald-ok hover:bg-emerald-ok/25 border border-emerald-ok/20 transition-colors">
            <Play size={12} /> 开始执行
          </button>
        </div>
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="p-3 space-y-3">
      <button onClick={createNew}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-amber-glow/10 text-amber-glow hover:bg-amber-glow/20 border border-amber-glow/20 transition-colors">
        <Plus size={12} /> 新建工作流
      </button>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={16} className="animate-spin text-slate-400" />
        </div>
      ) : workflows.length === 0 ? (
        <div className="text-center py-4">
          <GitMerge size={20} className="mx-auto text-slate-500 mb-2" />
          <p className="text-xs text-slate-400">暂无工作流</p>
          <p className="text-[10px] text-slate-500 mt-1">
            创建工作流来自动按步骤调用多个 Agent
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {workflows.map((wf) => (
            <div key={wf.id}
              className="p-2.5 rounded-lg border border-white/8 bg-white/[0.02]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <GitMerge size={13} className="text-violet-info" />
                  <span className="text-xs font-medium text-slate-200">{wf.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleExecute(wf)}
                    className="p-1 rounded hover:bg-emerald-ok/10 text-slate-400 hover:text-emerald-ok transition-colors" title="执行">
                    <Play size={11} />
                  </button>
                  <button onClick={() => setEditing(wf)}
                    className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors">
                    <Pencil size={11} />
                  </button>
                  <button onClick={() => deleteWorkflow(wf.id, projectPath)}
                    className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-rose-err transition-colors">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>

              {/* Step visualization */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {wf.steps.map((step, i) => (
                  <div key={i} className="flex items-center flex-shrink-0">
                    <div className="px-2 py-1 rounded bg-white/5 border border-white/10">
                      <div className="text-[9px] text-slate-200 font-medium">
                        {step.agent || "主会话"}
                      </div>
                    </div>
                    {i < wf.steps.length - 1 && (
                      <ArrowRight size={10} className="text-slate-500 mx-0.5" />
                    )}
                  </div>
                ))}
              </div>

              {wf.variables.length > 0 && (
                <div className="text-[9px] text-slate-400 mt-1">
                  变量: {wf.variables.map((v) => `$${v}`).join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowEditor({
  workflow, agents, onSave, onCancel,
}: {
  workflow: Workflow;
  agents: { name: string; value: string }[];
  onSave: (wf: Workflow) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(workflow.name);
  const [steps, setSteps] = useState<WorkflowStep[]>(workflow.steps);

  const updateStep = (index: number, updates: Partial<WorkflowStep>) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...updates } : s))
    );
  };

  const addStep = () => {
    setSteps([...steps, { agent: null, prompt: "" }]);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name) return;
    await onSave({ ...workflow, name, steps });
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-200">
          {workflow.id ? "编辑工作流" : "新建工作流"}
        </span>
        <button onClick={onCancel} className="p-1 rounded hover:bg-white/5 text-slate-400">
          <X size={13} />
        </button>
      </div>

      <input value={name} onChange={(e) => setName(e.target.value)}
        placeholder="工作流名称"
        className="w-full text-xs bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-glow/30" />

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="p-2.5 rounded-lg border border-white/8 bg-white/[0.02]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-slate-300 font-medium">
                步骤 {i + 1}
              </span>
              {steps.length > 1 && (
                <button onClick={() => removeStep(i)}
                  className="p-0.5 text-slate-400 hover:text-rose-err">
                  <X size={10} />
                </button>
              )}
            </div>
            <select
              value={step.agent || ""}
              onChange={(e) => updateStep(i, { agent: e.target.value || null })}
              className="w-full text-xs bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-slate-200 mb-1.5"
            >
              {agents.map((a) => (
                <option key={a.value} value={a.value}>{a.name}</option>
              ))}
            </select>
            <textarea
              value={step.prompt}
              onChange={(e) => updateStep(i, { prompt: e.target.value })}
              rows={2}
              placeholder="Prompt（支持 $VARIABLE 变量）"
              className="w-full text-xs font-mono bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-amber-glow/30"
            />
          </div>
        ))}
      </div>

      <button onClick={addStep}
        className="flex items-center gap-1.5 text-[11px] text-slate-300 hover:text-amber-glow transition-colors">
        <Plus size={11} /> 添加步骤
      </button>

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="text-xs px-3 py-1.5 text-slate-300">取消</button>
        <button onClick={handleSave}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-amber-glow/10 text-amber-glow hover:bg-amber-glow/20 border border-amber-glow/20 transition-colors">
          <Save size={12} /> 保存
        </button>
      </div>
    </div>
  );
}
