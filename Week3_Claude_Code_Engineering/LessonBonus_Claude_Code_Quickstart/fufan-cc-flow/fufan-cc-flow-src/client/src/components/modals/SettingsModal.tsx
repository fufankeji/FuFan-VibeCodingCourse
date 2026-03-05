import { X, Settings, Brain, Zap, BarChart2, Cpu, KeyRound, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useUIStore } from "../../stores/uiStore";
import { useConfigStore } from "../../stores/configStore";
import ClaudeEnvPanel from "../settings/ClaudeEnvPanel";
import type { ModelId, EffortLevel } from "../../types/claude";

const MODELS: { id: ModelId; label: string; desc: string }[] = [
  { id: "opus",    label: "Claude Opus",    desc: "最强大，适合复杂任务" },
  { id: "sonnet",  label: "Claude Sonnet",  desc: "速度与能力的平衡" },
  { id: "haiku",   label: "Claude Haiku",   desc: "轻量快速，适合简单任务" },
];

const EFFORT_LEVELS: { id: EffortLevel; label: string }[] = [
  { id: "high",   label: "高" },
  { id: "medium", label: "中" },
  { id: "low",    label: "低" },
];

export default function SettingsModal() {
  const {
    settingsModalOpen,
    setSettingsModalOpen,
    settingsActiveTab,
    setSettingsActiveTab,
  } = useUIStore();
  const {
    model, setModel,
    effort, setEffort,
    thinking, setThinking,
    autoCompactThreshold, setAutoCompactThreshold,
    apiKey, setApiKey,
  } = useConfigStore();
  const [showKey, setShowKey] = useState(false);

  if (!settingsModalOpen) return null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) setSettingsModalOpen(false); }}
    >
      <div className="modal-content glass-panel rounded-2xl w-full max-w-md flex flex-col shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-amber-glow" />
            <h2 className="text-sm font-semibold text-slate-200 font-display">设置</h2>
          </div>
          <button
            onClick={() => setSettingsModalOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-white/5 px-5 pt-3 gap-1">
          <button
            onClick={() => setSettingsActiveTab("model")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-all ${
              settingsActiveTab === "model"
                ? "border-amber-glow text-amber-glow"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            <Brain size={12} />
            模型与对话
          </button>
          <button
            onClick={() => setSettingsActiveTab("environment")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-all ${
              settingsActiveTab === "environment"
                ? "border-amber-glow text-amber-glow"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            <Cpu size={12} />
            环境配置
          </button>
        </div>

        <div className="p-5 space-y-6 overflow-y-auto max-h-[65vh]">

          {settingsActiveTab === "model" ? (
            <>
              {/* Model selection */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Brain size={14} className="text-purple-bright" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">模型</span>
                </div>
                <div className="space-y-2">
                  {MODELS.map((m) => (
                    <label
                      key={m.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        model === m.id
                          ? "border-purple-bright/30 bg-purple-glow/8"
                          : "border-white/5 hover:border-white/10 hover:bg-white/5"
                      }`}
                    >
                      <input
                        type="radio"
                        name="model"
                        value={m.id}
                        checked={model === m.id}
                        onChange={() => setModel(m.id)}
                        className="accent-purple-bright"
                      />
                      <div>
                        <div className={`text-sm font-medium ${model === m.id ? "text-white" : "text-slate-200"}`}>
                          {m.label}
                        </div>
                        <div className="text-[11px] text-slate-500">{m.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </section>

              {/* Effort level */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={14} className="text-amber-glow" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">思考强度</span>
                </div>
                <div className="flex gap-2">
                  {EFFORT_LEVELS.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setEffort(e.id)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                        effort === e.id
                          ? "border-amber-glow/30 bg-amber-glow/10 text-amber-glow"
                          : "border-white/5 text-slate-400 hover:bg-white/5"
                      }`}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Extended thinking */}
              <section>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain size={14} className="text-violet-info" />
                    <span className="text-sm text-slate-300">扩展思考 (Extended Thinking)</span>
                  </div>
                  <button
                    onClick={() => setThinking(!thinking)}
                    className={`relative w-10 h-5 rounded-full transition-colors toggle-track ${
                      thinking ? "bg-purple-glow" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
                        thinking ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1 pl-6">
                  启用后 Claude 将花更多时间思考复杂问题
                </p>
              </section>

              {/* Auto-compact threshold */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart2 size={14} className="text-sky-link" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    自动压缩阈值
                  </span>
                  <span className="ml-auto text-xs font-mono text-slate-400">{autoCompactThreshold}%</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={100}
                  step={5}
                  value={autoCompactThreshold}
                  onChange={(e) => setAutoCompactThreshold(Number(e.target.value))}
                  className="w-full accent-sky-link"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </section>

              {/* API Key */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <KeyRound size={14} className="text-emerald-ok" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    API Key
                  </span>
                  <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] text-slate-500 border border-white/5">
                    可选
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-ant-api03-..."
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 pr-10 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-ok/40 transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                  留空则使用已登录的 Claude Code OAuth 凭证（推荐）。
                  仅存内存，刷新页面后需重新填写，不写入任何文件。
                </p>
              </section>
            </>
          ) : (
            <ClaudeEnvPanel />
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/5 flex justify-end">
          <button
            onClick={() => setSettingsModalOpen(false)}
            className="px-4 py-2 rounded-lg bg-amber-glow/10 text-amber-glow border border-amber-glow/20 hover:bg-amber-glow/20 transition-colors text-sm font-medium"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
