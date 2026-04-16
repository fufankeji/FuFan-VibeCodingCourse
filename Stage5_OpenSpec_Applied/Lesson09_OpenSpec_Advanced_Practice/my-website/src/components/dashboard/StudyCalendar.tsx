import { useEffect, useState } from 'react'
import { apiUrl } from '../../lib/api'

interface CalendarData {
  year: number
  data: Record<string, number>
}

function getColor(minutes: number): string {
  if (minutes === 0) return 'bg-gray-100 dark:bg-gray-800'
  if (minutes < 30) return 'bg-green-200 dark:bg-green-900'
  if (minutes < 60) return 'bg-green-300 dark:bg-green-700'
  if (minutes < 120) return 'bg-green-500 dark:bg-green-500'
  return 'bg-green-700 dark:bg-green-400'
}

function generateDays(year: number): string[] {
  const days: string[] = []
  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31)
  const d = new Date(start)
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return days
}

export default function StudyCalendar() {
  const [calData, setCalData] = useState<CalendarData | null>(null)
  const [tooltip, setTooltip] = useState<{ date: string; minutes: number; x: number; y: number } | null>(null)
  const year = new Date().getFullYear()

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    fetch(apiUrl(`/api/analytics/calendar?year=${year}`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setCalData)
      .catch(() => {})
  }, [year])

  const days = generateDays(year)
  const data = calData?.data || {}

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">学习日历</h3>
      <div className="overflow-x-auto">
        <div className="flex flex-wrap gap-[3px]" style={{ maxWidth: '720px' }}>
          {days.map((day) => {
            const mins = data[day] || 0
            return (
              <div
                key={day}
                className={`h-3 w-3 rounded-sm ${getColor(mins)} cursor-pointer`}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setTooltip({ date: day, minutes: mins, x: rect.left, y: rect.top - 30 })
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            )
          })}
        </div>
      </div>

      {/* Color legend */}
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>少</span>
        <div className="h-3 w-3 rounded-sm bg-gray-100 dark:bg-gray-800" />
        <div className="h-3 w-3 rounded-sm bg-green-200 dark:bg-green-900" />
        <div className="h-3 w-3 rounded-sm bg-green-300 dark:bg-green-700" />
        <div className="h-3 w-3 rounded-sm bg-green-500 dark:bg-green-500" />
        <div className="h-3 w-3 rounded-sm bg-green-700 dark:bg-green-400" />
        <span>多</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-md bg-gray-900 px-2 py-1 text-xs text-white dark:bg-gray-100 dark:text-gray-900"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.date}: {tooltip.minutes} 分钟
        </div>
      )}
    </div>
  )
}
