import { useChatStore } from "../../stores/chatStore";
import { formatTokens, formatCost } from "../../utils/costCalculator";
import { useConfigStore } from "../../stores/configStore";
import { BarChart3, Clock, MessageSquare, Coins } from "lucide-react";

export default function UsageDashboard() {
  const { totalUsage, totalCost, messages } = useChatStore();
  const model = useConfigStore((s) => s.model);

  const totalTokens = totalUsage.inputTokens + totalUsage.outputTokens;
  const messageCount = messages.length;
  const userMsgCount = messages.filter((m) => m.role === "user").length;
  const assistantMsgCount = messages.filter((m) => m.role === "assistant").length;

  return (
    <div className="p-3 space-y-3">
      <div className="text-[11px] uppercase tracking-wider text-obsidian-300 font-medium">
        当前会话用量
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon={<BarChart3 size={13} className="text-sky-link" />}
          label="Input Tokens"
          value={formatTokens(totalUsage.inputTokens)}
        />
        <StatCard
          icon={<BarChart3 size={13} className="text-violet-info" />}
          label="Output Tokens"
          value={formatTokens(totalUsage.outputTokens)}
        />
        <StatCard
          icon={<Coins size={13} className="text-amber-glow" />}
          label="预估费用"
          value={formatCost(totalCost)}
        />
        <StatCard
          icon={<MessageSquare size={13} className="text-emerald-ok" />}
          label="消息数"
          value={String(messageCount)}
        />
      </div>

      {/* Token breakdown */}
      <div className="p-2.5 rounded-lg border border-obsidian-700/40 bg-obsidian-800/30">
        <div className="text-[10px] text-obsidian-400 font-medium mb-2">
          Token 分布
        </div>
        <div className="space-y-1.5">
          <TokenBar
            label="Input"
            value={totalUsage.inputTokens}
            total={totalTokens}
            color="bg-sky-link"
          />
          <TokenBar
            label="Output"
            value={totalUsage.outputTokens}
            total={totalTokens}
            color="bg-violet-info"
          />
          {(totalUsage.cacheReadTokens ?? 0) > 0 && (
            <TokenBar
              label="Cache Read"
              value={totalUsage.cacheReadTokens ?? 0}
              total={totalTokens}
              color="bg-emerald-ok"
            />
          )}
        </div>
      </div>

      {/* Session info */}
      <div className="p-2.5 rounded-lg border border-obsidian-700/40 bg-obsidian-800/30 space-y-1.5">
        <div className="text-[10px] text-obsidian-400 font-medium mb-1">
          会话信息
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-obsidian-400">模型</span>
          <span className="text-obsidian-100 font-mono">{model}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-obsidian-400">用户消息</span>
          <span className="text-obsidian-100">{userMsgCount}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-obsidian-400">Claude 回复</span>
          <span className="text-obsidian-100">{assistantMsgCount}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-obsidian-400">总 Token</span>
          <span className="text-obsidian-100 font-mono">
            {formatTokens(totalTokens)}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="p-2.5 rounded-lg border border-obsidian-700/40 bg-obsidian-800/30">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] text-obsidian-400">{label}</span>
      </div>
      <div className="text-sm font-medium font-mono text-obsidian-100">
        {value}
      </div>
    </div>
  );
}

function TokenBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;

  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-obsidian-400">{label}</span>
        <span className="text-obsidian-300 font-mono">
          {formatTokens(value)} ({pct.toFixed(0)}%)
        </span>
      </div>
      <div className="h-1 bg-obsidian-700/50 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
