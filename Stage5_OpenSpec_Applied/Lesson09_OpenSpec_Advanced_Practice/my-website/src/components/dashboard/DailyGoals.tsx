import { useState } from 'react'
import { getMockGoals } from '../../mock/dashboard'
import type { Goal } from '../../mock/dashboard'

export default function DailyGoals() {
  const [goals, setGoals] = useState<Goal[]>(getMockGoals)

  const completedCount = goals.filter((g) => g.completed).length

  const toggleGoal = (id: string) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, completed: !g.completed } : g)),
    )
  }

  if (goals.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">每日目标</h3>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">今天还没有学习目标</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">每日目标</h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {completedCount}/{goals.length} 已完成
        </span>
      </div>

      <ul className="mt-4 space-y-2">
        {goals.map((goal) => (
          <li key={goal.id}>
            <button
              type="button"
              onClick={() => toggleGoal(goal.id)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  goal.completed
                    ? 'border-indigo-500 bg-indigo-500 text-white'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                {goal.completed && (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
              <span
                className={`text-sm ${
                  goal.completed
                    ? 'text-gray-400 line-through dark:text-gray-500'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {goal.title}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
