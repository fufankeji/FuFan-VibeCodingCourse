// Types — aligned with future API response shapes (see design.md)

export interface Stats {
  studyMinutes: number
  tasksCompleted: number
  streakDays: number
  efficiency: number
  // change vs yesterday: positive = up, negative = down, 0 = flat
  studyMinutesDelta: number
  tasksCompletedDelta: number
  streakDaysDelta: number
  efficiencyDelta: number
}

export interface Goal {
  id: string
  title: string
  completed: boolean
}

export interface Suggestion {
  id: string
  title: string
  description: string
  tag: '复习' | '新课' | '练习' | '拓展'
}

export interface TrendPoint {
  date: string
  minutes: number
}

// Mock data functions

export function getMockStats(): Stats {
  return {
    studyMinutes: 127,
    tasksCompleted: 8,
    streakDays: 14,
    efficiency: 85,
    studyMinutesDelta: 23,
    tasksCompletedDelta: 2,
    streakDaysDelta: 1,
    efficiencyDelta: -3,
  }
}

export function getMockGoals(): Goal[] {
  return [
    { id: '1', title: '完成 React Hooks 章节练习', completed: true },
    { id: '2', title: '阅读 TypeScript 泛型文档', completed: false },
    { id: '3', title: '复习算法：二叉树遍历', completed: false },
    { id: '4', title: '完成 Tailwind CSS 布局实战', completed: true },
    { id: '5', title: '整理学习笔记并提交', completed: false },
  ]
}

export function getMockSuggestions(): Suggestion[] {
  return [
    {
      id: '1',
      title: '复习 React useEffect 清理机制',
      description: '你上周在这个知识点的练习中出现了 2 次错误，建议重新巩固。',
      tag: '复习',
    },
    {
      id: '2',
      title: '开始学习 Next.js App Router',
      description: '基于你当前的 React 掌握程度，推荐进入框架层学习。',
      tag: '新课',
    },
    {
      id: '3',
      title: '完成 3 道 LeetCode 中等难度题',
      description: '保持算法手感，建议每日至少完成 2-3 道练习题。',
      tag: '练习',
    },
    {
      id: '4',
      title: '了解 WebSocket 实时通信原理',
      description: '作为全栈开发的延伸知识，有助于理解实时协作应用的架构。',
      tag: '拓展',
    },
  ]
}

export function getMockTrends(period: 'week' | 'month'): TrendPoint[] {
  if (period === 'week') {
    return [
      { date: '周一', minutes: 90 },
      { date: '周二', minutes: 120 },
      { date: '周三', minutes: 45 },
      { date: '周四', minutes: 0 },
      { date: '周五', minutes: 150 },
      { date: '周六', minutes: 200 },
      { date: '周日', minutes: 80 },
    ]
  }

  // month: 30 days of data, some days with 0
  return Array.from({ length: 30 }, (_, i) => ({
    date: `${i + 1}日`,
    minutes: i === 3 || i === 10 || i === 22 ? 0 : Math.floor(Math.random() * 150 + 30),
  }))
}
