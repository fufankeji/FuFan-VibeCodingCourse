import type { SessionState } from '../types';

interface StateBadgeProps {
  state: SessionState;
  className?: string;
}

const STATE_CONFIG: Record<SessionState, { label: string; className: string }> = {
  parsing: { label: '解析中', className: 'bg-gray-100 text-gray-600 border border-gray-300' },
  scanning: { label: '扫描中', className: 'bg-blue-100 text-blue-700 border border-blue-300' },
  hitl_pending: { label: '待人工审核', className: 'bg-orange-100 text-orange-700 border border-orange-300' },
  completed: { label: '处理中', className: 'bg-indigo-100 text-indigo-700 border border-indigo-300' },
  report_ready: { label: '已完成', className: 'bg-green-100 text-green-700 border border-green-300' },
  aborted: { label: '已中止', className: 'bg-red-100 text-red-600 border border-red-300' },
};

/**
 * StateBadge - 状态标签
 * R11: 颜色映射严格基于后端返回的 ReviewSession.state 字段，前端不自行推断状态
 */
export function StateBadge({ state, className = '' }: StateBadgeProps) {
  const config = STATE_CONFIG[state] ?? STATE_CONFIG.parsing;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${config.className} ${className}`}>
      {config.label}
    </span>
  );
}
