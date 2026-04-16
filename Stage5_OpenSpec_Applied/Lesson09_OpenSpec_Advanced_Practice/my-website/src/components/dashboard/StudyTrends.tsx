import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { getMockTrends } from '../../mock/dashboard'
import { useTheme } from '../../contexts/ThemeContext'

type Period = 'week' | 'month'

export default function StudyTrends() {
  const [period, setPeriod] = useState<Period>('week')
  const { theme } = useTheme()
  const data = getMockTrends(period)

  const isDark = theme === 'dark'
  const gridColor = isDark ? '#374151' : '#e5e7eb'
  const textColor = isDark ? '#9ca3af' : '#6b7280'
  const lineColor = isDark ? '#818cf8' : '#6366f1'

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          学习趋势
        </h3>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
          <button
            type="button"
            onClick={() => setPeriod('week')}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              period === 'week'
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            周
          </button>
          <button
            type="button"
            onClick={() => setPeriod('month')}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              period === 'month'
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            月
          </button>
        </div>
      </div>

      <div className="mt-6 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="date"
              tick={{ fill: textColor, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: gridColor }}
            />
            <YAxis
              tick={{ fill: textColor, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: gridColor }}
              unit=" min"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#1f2937' : '#ffffff',
                border: `1px solid ${gridColor}`,
                borderRadius: '8px',
                color: isDark ? '#f3f4f6' : '#111827',
              }}
              formatter={(value) => [`${value} 分钟`, '学习时长']}
            />
            <Line
              type="monotone"
              dataKey="minutes"
              stroke={lineColor}
              strokeWidth={2}
              dot={{ fill: lineColor, r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
