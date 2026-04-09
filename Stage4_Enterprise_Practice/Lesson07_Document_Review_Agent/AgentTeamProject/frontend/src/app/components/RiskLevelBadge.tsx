import type { RiskLevel } from '../types';

interface RiskLevelBadgeProps {
  level: RiskLevel;
  size?: 'sm' | 'md';
}

const LEVEL_CONFIG: Record<RiskLevel, { label: string; className: string }> = {
  HIGH: { label: '高风险', className: 'bg-red-100 text-red-700 border border-red-400' },
  MEDIUM: { label: '中风险', className: 'bg-amber-100 text-amber-700 border border-amber-400' },
  LOW: { label: '低风险', className: 'bg-green-100 text-green-700 border border-green-400' },
};

export function RiskLevelBadge({ level, size = 'sm' }: RiskLevelBadgeProps) {
  const config = LEVEL_CONFIG[level];
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';
  return (
    <span className={`inline-flex items-center rounded ${sizeClass} ${config.className}`}>
      {config.label}
    </span>
  );
}
