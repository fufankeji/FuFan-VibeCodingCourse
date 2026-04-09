import { Crown, Bot } from "lucide-react";
import type { TeamMember } from "../../types/team";

const STATUS_STYLES: Record<TeamMember["status"], { dot: string; label: string }> = {
  idle:      { dot: "bg-slate-500",    label: "空闲" },
  active:    { dot: "bg-emerald-400 animate-pulse", label: "运行中" },
  completed: { dot: "bg-emerald-400",  label: "已完成" },
  error:     { dot: "bg-rose-400",     label: "出错" },
};

export default function TeammateCard({ member }: { member: TeamMember }) {
  const style = STATUS_STYLES[member.status];
  const isLead = member.role === "lead";

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg border border-white/5 transition-colors hover:border-white/10"
      style={{ background: "rgba(255,255,255,0.02)" }}
    >
      {/* Role icon */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isLead ? "bg-amber-glow/15 text-amber-glow" : "bg-purple-glow/15 text-purple-glow"
      }`}>
        {isLead ? <Crown size={14} /> : <Bot size={14} />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-200 truncate">{member.name}</span>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
          <span className="text-[10px] text-slate-500 flex-shrink-0">{style.label}</span>
        </div>
        {member.description && (
          <p className="text-xs text-slate-500 truncate mt-0.5">{member.description}</p>
        )}
      </div>

      {/* Role badge */}
      <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
        isLead
          ? "bg-amber-glow/10 text-amber-glow border border-amber-glow/20"
          : "bg-white/5 text-slate-400 border border-white/5"
      }`}>
        {isLead ? "Lead" : "Teammate"}
      </span>
    </div>
  );
}
