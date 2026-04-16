import { useEffect, useState } from 'react'
import { apiUrl } from '../../lib/api'

interface Stats {
  total_minutes: number
  streak_days: number
  sessions_count: number
  today_minutes: number
}

const STAT_CONFIG = [
  { key: 'today_minutes' as const, label: '今日学习', unit: '分钟', icon: '⏱️' },
  { key: 'sessions_count' as const, label: '学习次数', unit: '次', icon: '✅' },
  { key: 'streak_days' as const, label: '连续打卡', unit: '天', icon: '🔥' },
  { key: 'total_minutes' as const, label: '累计学习', unit: '分钟', icon: '⚡' },
]

export default function StatsCards() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    fetch(apiUrl('/api/analytics/stats'), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then(setStats)
      .catch(() => setError(true))
  }, [])

  if (error) {
    return (
      <div className="rounded-xl bg-white p-5 text-center text-sm text-red-500 shadow-sm dark:bg-gray-900 dark:text-red-400">
        加载失败，请刷新重试
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {STAT_CONFIG.map((cfg) => {
        const value = stats ? stats[cfg.key] : '—'
        return (
          <div key={cfg.key} className="rounded-xl bg-white p-5 shadow-sm dark:bg-gray-900">
            <span className="text-2xl">{cfg.icon}</span>
            <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
              {value}
              <span className="ml-1 text-sm font-normal text-gray-500 dark:text-gray-400">
                {cfg.unit}
              </span>
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{cfg.label}</p>
          </div>
        )
      })}
    </div>
  )
}
