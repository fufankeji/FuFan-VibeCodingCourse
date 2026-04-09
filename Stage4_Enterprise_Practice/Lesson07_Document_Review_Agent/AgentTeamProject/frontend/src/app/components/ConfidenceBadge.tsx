/**
 * ConfidenceBadge - 置信度标签
 * R08: 置信度颜色来自后端 confidence_score 字段，前端按阈值映射：
 *   ≥85 → 绿色 | 60~84 → 黄色 | <60 → 橙红色
 */
interface ConfidenceBadgeProps {
  score: number;
  needsVerification?: boolean;
}

export function ConfidenceBadge({ score, needsVerification }: ConfidenceBadgeProps) {
  let colorClass = 'text-green-600';
  if (score < 60) colorClass = 'text-orange-600';
  else if (score < 85) colorClass = 'text-yellow-600';

  return (
    <span className={`text-xs ${colorClass} flex items-center gap-1`}>
      置信度 {score}%
      {needsVerification && (
        <span className="text-orange-500" title="需人工核对">⚠</span>
      )}
    </span>
  );
}
