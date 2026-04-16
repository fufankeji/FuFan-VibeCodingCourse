import { useEffect, useState } from 'react'
import { apiUrl } from '../../lib/api'

interface Achievement {
  type: string
  name: string
  description: string
  unlocked: boolean
  unlocked_at: string | null
}

const BADGE_ICONS: Record<string, string> = {
  'first-session': '🎓',
  'streak-7': '🔥',
  'streak-30': '🏆',
  'hours-10': '⭐',
  'hours-100': '💎',
}

export default function Achievements() {
  const [achievements, setAchievements] = useState<Achievement[]>([])

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    // Check for new achievements first, then load list
    fetch(apiUrl('/api/analytics/achievements/check'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(() =>
        fetch(apiUrl('/api/analytics/achievements'), {
          headers: { Authorization: `Bearer ${token}` },
        }),
      )
      .then((res) => res.json())
      .then(setAchievements)
      .catch(() => {})
  }, [])

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">成就</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {achievements.map((a) => (
          <div
            key={a.type}
            className={`flex flex-col items-center rounded-lg p-3 text-center ${
              a.unlocked
                ? 'bg-amber-50 dark:bg-amber-900/20'
                : 'bg-gray-50 opacity-40 dark:bg-gray-800'
            }`}
          >
            <span className="text-3xl">{BADGE_ICONS[a.type] || '🏅'}</span>
            <p className="mt-2 text-xs font-medium text-gray-900 dark:text-white">{a.name}</p>
            <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">{a.description}</p>
            {a.unlocked && a.unlocked_at && (
              <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                {new Date(a.unlocked_at).toLocaleDateString()}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
