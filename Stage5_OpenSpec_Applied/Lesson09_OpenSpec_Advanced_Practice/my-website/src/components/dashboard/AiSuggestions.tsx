import { getMockSuggestions } from '../../mock/dashboard'

const TAG_COLORS: Record<string, string> = {
  '复习': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  '新课': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  '练习': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  '拓展': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}

export default function AiSuggestions() {
  const suggestions = getMockSuggestions()

  if (suggestions.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI 学习建议</h3>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">暂无学习建议</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI 学习建议</h3>

      <div className="mt-4 space-y-3">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className="rounded-lg border border-gray-100 p-4 dark:border-gray-800"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                {s.title}
              </h4>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  TAG_COLORS[s.tag] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                {s.tag}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
              {s.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
