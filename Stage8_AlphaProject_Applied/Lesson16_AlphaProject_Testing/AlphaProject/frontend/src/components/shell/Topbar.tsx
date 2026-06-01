/**
 * Topbar · 1:1 翻译自 alpha_terminal_platform/code.html L116-143
 * 固定顶 12h 高，左 ALPHA MONITOR brand + Market Data/Strategy Builder，
 * 右 Search box + 通知 + avatar。
 */
import { Mi } from "./Mi";

export function Topbar() {
  return (
    <header className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-grid-gutter h-12 bg-surface dark:bg-surface border-b border-surface-border dark:border-surface-border shadow-none">
      <div className="flex items-center gap-4">
        {/* Mobile Menu Toggle */}
        <button
          type="button"
          aria-label="menu"
          className="md:hidden text-on-surface hover:text-primary transition-colors"
        >
          <Mi name="menu" />
        </button>
        <span className="font-headline-sm text-headline-sm font-bold text-primary dark:text-primary tracking-tight">
          ALPHA MONITOR
        </span>
        {/* Web Navigation (Hidden < md) */}
        <nav className="hidden md:flex gap-6 ml-8">
          <a
            className="font-headline-sm text-headline-sm text-on-surface-variant dark:text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-container-high transition-colors cursor-pointer active:opacity-80 py-2"
            href="#"
          >
            行情
          </a>
          <a
            className="font-headline-sm text-headline-sm text-on-surface-variant dark:text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-container-high transition-colors cursor-pointer active:opacity-80 py-2"
            href="#"
          >
            策略
          </a>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative hidden sm:block">
          <Mi
            name="search"
            className="absolute left-2 top-1/2 transform -translate-y-1/2 text-on-surface-variant"
            size={18}
          />
          <input
            aria-label="搜索代码或名称"
            placeholder="搜索代码 / 名称"
            type="text"
            className="bg-surface-container-low border border-surface-border rounded pl-8 pr-3 py-1 text-table-data font-table-data text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-48 transition-all"
          />
        </div>
        <button
          type="button"
          aria-label="notifications"
          className="text-on-surface-variant hover:text-primary transition-colors"
        >
          <Mi name="notifications" />
        </button>
        <button
          type="button"
          aria-label="account"
          className="text-on-surface-variant hover:text-primary transition-colors"
        >
          <Mi name="account_circle" />
        </button>
      </div>
    </header>
  );
}
