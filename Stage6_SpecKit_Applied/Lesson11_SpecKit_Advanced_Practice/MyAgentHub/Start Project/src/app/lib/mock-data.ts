export const AGENTS = Array.from({ length: 24 }).map((_, i) => ({
  id: `agent-${i + 1}`,
  name: [
    '代码审查助手',
    '数据分析师',
    '会议纪要整理器',
    'SEO 优化专家',
    '社交媒体文案生成器',
    '产品经理模拟器',
    '架构图生成器',
    '前端组件生成器',
  ][i % 8],
  description: [
    '自动审查你的 Pull Request，检查代码风格、潜在 bug 和性能问题。',
    '输入 CSV 即可输出完整的分析报告和可视化图表代码。',
    '将会议录音或文字转录自动总结为结构化的 Action Items。',
    '分析网页内容并生成符合 SEO 最佳实践的优化建议。',
    '根据产品描述生成适合小红书、微博、推特的文案。',
    '模拟挑剔的产品经理，帮你在开发前找出需求漏洞。',
    '根据自然语言描述自动生成 Mermaid 架构图代码。',
    '输入 UI 截图或描述，生成 React + Tailwind 组件代码。',
  ][i % 8],
  author: ['AI Lab', 'DevTools Inc.', 'NextGen Corp.', 'OpenSource Co.'][i % 4],
  category: ['开发工具', '生产力', '营销', '设计'][i % 4],
  provider: ['OpenAI', 'Anthropic', 'Meta', 'Google'][i % 4],
  capabilities: ['代码生成', '数据分析', '视觉分析', '文本总结'].slice(0, (i % 3) + 1),
  price: i % 3 === 0 ? '免费' : i % 5 === 0 ? '$5/月' : '按需付费',
  runs: Math.floor(Math.random() * 100000) + 1000,
  rating: (Math.random() * 1.5 + 3.5).toFixed(1),
}));

export const CATEGORIES = [
  '开发工具',
  '生产力',
  '营销',
  '设计',
  '人力资源',
  '销售',
  '客户支持',
  '财务',
  '教育',
  '游戏',
];

export const PROVIDERS = ['OpenAI', 'Anthropic', 'Meta', 'Google', 'Mistral'];

export const RUN_HISTORY = Array.from({ length: 15 }).map((_, i) => ({
  id: `run-00${i + 1}`,
  timestamp: new Date(Date.now() - i * 3600000 * Math.random()).toISOString(),
  agent: AGENTS[i % 8].name,
  status: i % 10 === 0 ? 'error' : 'success',
  duration: (Math.random() * 5 + 0.5).toFixed(2) + 's',
  cost: '$' + (Math.random() * 0.05).toFixed(4),
  input: '帮我用 React 写一个带加载态的按钮组件。',
  output: '好的，这是为你生成的 React 按钮组件代码...',
  trace: [
    { name: 'Input Parser', duration: '0.1s', type: 'tool' },
    { name: 'Retrieve Context', duration: '0.5s', type: 'retriever' },
    { name: 'LLM Generation', duration: '2.3s', type: 'llm' },
    { name: 'Output Formatter', duration: '0.1s', type: 'tool' },
  ],
}));
