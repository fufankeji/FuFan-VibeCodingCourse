/**
 * Sidebar · 1:1 翻译自 alpha_terminal_platform/code.html L145-180
 * 固定左 64w 全高（top-12 起算），含 brand block + 4 nav + Support/Sign Out。
 * Active 项: bg-surface-container-highest + text-primary + border-l-4 border-primary
 * Inactive: hover:bg-surface-container-high + border-l-4 border-transparent
 */
import { Mi } from "./Mi";

export type PageKey = "dashboard" | "morning" | "alerts" | "settings";

interface Props {
  active: PageKey;
  onNavigate: (k: PageKey) => void;
}

interface Item {
  key: PageKey;
  icon: string;
  label: string;
}

const ITEMS: Item[] = [
  { key: "dashboard", icon: "dashboard", label: "总览看板" },
  { key: "morning", icon: "description", label: "早盘简报" },
  { key: "alerts", icon: "notifications_active", label: "异动日志" },
  { key: "settings", icon: "settings", label: "设置" },
];

export function Sidebar({ active, onNavigate }: Props) {
  return (
    <aside className="hidden md:flex fixed left-0 top-12 h-[calc(100vh-3rem)] w-64 flex-col z-40 bg-surface-container-low dark:bg-surface-container-low border-r border-surface-border dark:border-surface-border shadow-none transition-all duration-150 ease-in-out">
      <div className="p-4 border-b border-surface-border">
        <h2 className="font-headline-sm text-headline-sm text-on-surface dark:text-on-surface">
          Alpha Terminal
        </h2>
        <p className="font-mono-label text-mono-label text-on-surface-variant mt-1">
          Market Engine v2.4
        </p>
      </div>
      <nav className="flex-1 py-4 flex flex-col gap-1 px-2">
        {ITEMS.map((it) => {
          const isActive = active === it.key;
          const base =
            "flex items-center gap-3 px-3 py-2 rounded-r transition-all duration-150 ease-in-out cursor-pointer";
          const cls = isActive
            ? `${base} bg-surface-container-highest dark:bg-surface-container-highest text-primary dark:text-primary border-l-4 border-primary`
            : `${base} text-on-surface-variant dark:text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-container-high rounded border-l-4 border-transparent`;
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => onNavigate(it.key)}
              className={cls + " text-left w-full"}
            >
              <Mi name={it.icon} size={20} filled={isActive} />
              <span className="font-mono-label text-mono-label">{it.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="p-2 border-t border-surface-border">
        <a
          href="#"
          className="flex items-center gap-3 px-3 py-2 text-on-surface-variant dark:text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-container-high rounded transition-all duration-150 ease-in-out"
        >
          <Mi name="help" size={20} />
          <span className="font-mono-label text-mono-label">帮助</span>
        </a>
        <a
          href="#"
          className="flex items-center gap-3 px-3 py-2 text-on-surface-variant dark:text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-container-high rounded transition-all duration-150 ease-in-out"
        >
          <Mi name="logout" size={20} />
          <span className="font-mono-label text-mono-label">退出</span>
        </a>
      </div>
    </aside>
  );
}
