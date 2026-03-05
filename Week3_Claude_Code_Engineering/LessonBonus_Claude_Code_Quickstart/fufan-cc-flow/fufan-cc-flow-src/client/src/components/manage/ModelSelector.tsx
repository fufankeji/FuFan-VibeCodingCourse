import { useState, useRef, useEffect } from "react";
import { ChevronDown, Brain, Gauge, Sparkles } from "lucide-react";
import { useConfigStore } from "../../stores/configStore";
import { MODEL_LABELS, type ModelId, type EffortLevel } from "../../types/claude";

const EFFORT_OPTIONS: { value: EffortLevel; label: string; icon: string }[] = [
  { value: "low", label: "低", icon: "L" },
  { value: "medium", label: "中", icon: "M" },
  { value: "high", label: "高", icon: "H" },
];

export default function ModelSelector() {
  const { model, effort, thinking, setModel, setEffort, setThinking } =
    useConfigStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-obsidian-700/30 hover:bg-obsidian-700/60 text-xs transition-colors"
      >
        <Brain size={13} className="text-violet-info" />
        <span className="text-obsidian-100 font-medium">
          {MODEL_LABELS[model] || model}
        </span>
        <ChevronDown
          size={12}
          className={`text-obsidian-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl bg-obsidian-800 border border-obsidian-600/50 shadow-2xl shadow-black/40 overflow-hidden z-50">
          {/* Ambient glow */}
          <div className="absolute -top-12 -right-12 w-24 h-24 bg-violet-info/5 rounded-full blur-2xl" />

          <div className="p-3 border-b border-obsidian-700/50">
            <div className="text-[11px] uppercase tracking-wider text-obsidian-300 font-medium mb-2">
              模型
            </div>
            <div className="space-y-1">
              {(Object.keys(MODEL_LABELS) as ModelId[]).map((id) => (
                <button
                  key={id}
                  onClick={() => {
                    setModel(id);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    model === id
                      ? "bg-amber-glow/10 text-amber-glow border border-amber-glow/20"
                      : "text-obsidian-100 hover:bg-obsidian-700/60"
                  }`}
                >
                  {MODEL_LABELS[id]}
                </button>
              ))}
            </div>
          </div>

          {/* Effort (Opus only) */}
          {model === "opus" && (
            <div className="p-3 border-b border-obsidian-700/50">
              <div className="text-[11px] uppercase tracking-wider text-obsidian-300 font-medium mb-2 flex items-center gap-1.5">
                <Gauge size={11} />
                推理力度
              </div>
              <div className="flex gap-1.5">
                {EFFORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEffort(opt.value)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      effort === opt.value
                        ? "bg-amber-glow/15 text-amber-glow border border-amber-glow/25"
                        : "bg-obsidian-700/40 text-obsidian-200 hover:bg-obsidian-700/70"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Extended Thinking */}
          <div className="p-3">
            <button
              onClick={() => setThinking(!thinking)}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm hover:bg-obsidian-700/40 transition-colors"
            >
              <span className="flex items-center gap-2 text-obsidian-100">
                <Sparkles size={14} className="text-amber-bright" />
                扩展思考
              </span>
              <div
                className={`w-8 h-4.5 rounded-full transition-colors relative ${
                  thinking ? "bg-amber-glow" : "bg-obsidian-500"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
                    thinking ? "translate-x-[14px]" : "translate-x-0.5"
                  }`}
                />
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
