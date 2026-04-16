import { useState } from 'react'
import { Outlet, useMatch } from 'react-router-dom'
import Sidebar from '../../components/dashboard/Sidebar'
import StatsCards from '../../components/dashboard/StatsCards'
import StudyCalendar from '../../components/dashboard/StudyCalendar'
import Achievements from '../../components/dashboard/Achievements'
import DailyGoals from '../../components/dashboard/DailyGoals'
import AiSuggestions from '../../components/dashboard/AiSuggestions'
import StudyTrends from '../../components/dashboard/StudyTrends'

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isIndex = useMatch('/dashboard')

  return (
    <div className="grid min-h-dvh md:grid-cols-[256px_1fr] bg-gray-50 dark:bg-gray-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="flex h-16 shrink-0 items-center gap-4 border-b border-gray-200 px-6 dark:border-gray-800 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="打开菜单"
            className="flex h-10 w-10 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <line x1={3} y1={12} x2={21} y2={12} />
              <line x1={3} y1={6} x2={21} y2={6} />
              <line x1={3} y1={18} x2={21} y2={18} />
            </svg>
          </button>
          <span className="text-lg font-bold text-gray-900 dark:text-white">StudyPal</span>
        </div>

        {isIndex ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <section id="stats">
              <StatsCards />
            </section>
            <section id="calendar">
              <StudyCalendar />
            </section>
            <section id="achievements">
              <Achievements />
            </section>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <section id="goals">
                <DailyGoals />
              </section>
              <section id="suggestions">
                <AiSuggestions />
              </section>
            </div>
            <section id="trends">
              <StudyTrends />
            </section>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <Outlet />
          </div>
        )}
      </main>
    </div>
  )
}
