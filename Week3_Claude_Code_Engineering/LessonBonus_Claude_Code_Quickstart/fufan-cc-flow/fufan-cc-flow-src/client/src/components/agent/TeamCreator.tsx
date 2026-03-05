import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { useTeamStore } from "../../stores/teamStore";

const INPUT_CLS =
  "w-full px-3 py-2 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 border border-white/10 focus:border-amber-glow/40 focus:outline-none transition-colors";

export default function TeamCreator({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const createTeam = useTeamStore((s) => s.createTeam);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Validate: only alphanumeric, dash, underscore
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      setError("名称仅允许字母、数字、下划线和连字符");
      return;
    }
    setCreating(true);
    setError("");
    try {
      await createTeam(trimmed);
      onDone();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-4 space-y-3">
      <div className="text-sm font-medium text-slate-200">创建 Agent Team</div>

      <input
        type="text"
        value={name}
        onChange={(e) => { setName(e.target.value); setError(""); }}
        placeholder="Team 名称 (例: code-review-team)"
        className={INPUT_CLS}
        style={{ background: "rgba(255,255,255,0.03)" }}
        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        autoFocus
      />

      {error && (
        <p className="text-xs text-rose-400">{error}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handleCreate}
          disabled={!name.trim() || creating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                     bg-[#ca5d3d] hover:bg-amber-glow text-white transition-colors
                     disabled:opacity-40 disabled:hover:bg-[#ca5d3d]"
        >
          {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          创建
        </button>
        <button
          onClick={onDone}
          className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  );
}
