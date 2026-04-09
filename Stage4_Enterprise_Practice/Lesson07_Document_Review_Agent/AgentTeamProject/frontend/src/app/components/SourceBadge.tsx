import type { SourceType } from '../types';

interface SourceBadgeProps {
  sourceType: SourceType;
}

/**
 * SourceBadge - 判断来源标签
 * R02: 来源标签必须颜色 + 边框双维度区分（色盲友好）
 *   - rule_engine: 蓝色背景 + 实线边框
 *   - ai_inference: 紫色背景 + 虚线边框
 *   - hybrid: 蓝紫双色 + 双线（「未开发」视觉规范待 PM 确认）
 */
const SOURCE_CONFIG: Record<SourceType, { label: string; className: string; title: string }> = {
  rule_engine: {
    label: '规则触发',
    className: 'bg-blue-100 text-blue-700 border border-solid border-blue-500',
    title: '来源：规则引擎触发',
  },
  ai_inference: {
    label: 'AI 推理',
    className: 'bg-purple-100 text-purple-700 border border-dashed border-purple-500',
    title: '来源：AI 推理分析',
  },
  hybrid: {
    label: '混合来源',
    // 未开发：hybrid 来源视觉规范待 PM 确认，当前以蓝紫色双色标签兜底展示
    className: 'bg-indigo-100 text-indigo-700 border border-dotted border-indigo-500',
    title: '来源：规则引擎 + AI 推理（⚠️ 未开发：hybrid 视觉规范待确认）',
  },
};

export function SourceBadge({ sourceType }: SourceBadgeProps) {
  const config = SOURCE_CONFIG[sourceType] ?? SOURCE_CONFIG.ai_inference;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${config.className}`}
      title={config.title}
    >
      {config.label}
    </span>
  );
}
