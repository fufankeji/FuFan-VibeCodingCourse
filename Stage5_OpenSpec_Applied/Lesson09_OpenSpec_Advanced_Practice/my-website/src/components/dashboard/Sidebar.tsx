import { Link, useNavigate } from 'react-router-dom'
import ThemeToggle from '../ThemeToggle'
import { useAuth } from '../../contexts/AuthContext'

// Sidebar navigation is defined inline below — no longer uses NAV_ITEMS array

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleNavClick = () => {
    onClose()
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      {/* 移动端遮罩层 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 flex h-dvh w-64 flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-transform duration-200 md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo / Brand */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800">
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            StudyPal
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭侧边栏"
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <line x1={18} y1={6} x2={6} y2={18} />
              <line x1={6} y1={6} x2={18} y2={18} />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          <Link
            to="/dashboard"
            onClick={handleNavClick}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <span className="text-base">📊</span>
            学习数据
          </Link>
          <Link
            to="/dashboard/chat"
            onClick={handleNavClick}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <span className="text-base">🤖</span>
            AI 对话建议
          </Link>
          <a
            href="#goals"
            onClick={handleNavClick}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <span className="text-base">🎯</span>
            学习目标
          </a>
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-800 px-3 py-4 space-y-2">
          {/* User info */}
          {user && (
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  user.email.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{user.email}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Lv.{user.level}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-3">
            <span className="text-xs text-gray-500 dark:text-gray-400">主题</span>
            <ThemeToggle />
          </div>
          <Link
            to="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <span className="text-base">←</span>
            返回首页
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <span className="text-base">↩</span>
            登出
          </button>
        </div>
      </aside>
    </>
  )
}
