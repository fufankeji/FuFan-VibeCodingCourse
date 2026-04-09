import React from 'react';
import { useNavigate, useLocation } from 'react-router';
import { LayoutDashboard, FileText, Share2, MessageSquare, Search, Settings } from 'lucide-react';
import { useAppState } from '../../store';

const navItems = [
  { icon: LayoutDashboard, label: '仪表盘', path: '/dashboard', badge: null },
  { icon: FileText, label: '文档管理', path: '/documents', badgeKey: 'documents' as const },
  { icon: Share2, label: '知识图谱', path: '/graph', badge: null },
  { icon: MessageSquare, label: '智能问答', path: '/chat', badgeKey: 'queries' as const },
  { icon: Search, label: '搜索', path: '/search', badge: null },
];

export function Sidebar() {
  const { sidebarCollapsed, stats } = useAppState();
  const navigate = useNavigate();
  const location = useLocation();

  const width = sidebarCollapsed ? 72 : 220;

  return (
    <nav
      className="flex flex-col py-3 overflow-hidden"
      style={{
        gridArea: 'sidebar',
        width,
        background: 'var(--bg-s1)',
        borderRight: '1px solid var(--border-main)',
        transition: 'width 200ms ease',
      }}
    >
      <div className="flex flex-col gap-1 px-2">
        {navItems.map(item => {
          const active = location.pathname === item.path ||
            (item.path === '/dashboard' && location.pathname === '/');
          const Icon = item.icon;
          const badgeValue = item.badgeKey ? stats[item.badgeKey] : null;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex items-center gap-3 rounded-md cursor-pointer relative"
              style={{
                padding: sidebarCollapsed ? '10px 0' : '10px 12px',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                background: active ? 'rgba(88,166,255,0.1)' : 'transparent',
                color: active ? 'var(--blue)' : 'var(--text-3)',
                fontSize: 14,
                fontWeight: active ? 500 : 400,
                border: 'none',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-s2)';
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              {active && (
                <div
                  className="absolute left-0 top-2 bottom-2 rounded-r"
                  style={{ width: 2, background: 'var(--blue)' }}
                />
              )}
              <Icon size={18} />
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {badgeValue != null && (
                    <span
                      className="px-1.5 py-0.5 rounded-full"
                      style={{
                        fontSize: 11, fontWeight: 600,
                        background: 'var(--bg-s2)',
                        color: 'var(--text-3)',
                        minWidth: 20,
                        textAlign: 'center',
                      }}
                    >
                      {badgeValue}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-auto px-2">
        <button
          className="flex items-center gap-3 rounded-md w-full cursor-pointer"
          style={{
            padding: sidebarCollapsed ? '10px 0' : '10px 12px',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            background: 'transparent',
            color: 'var(--text-4)',
            fontSize: 14,
            border: 'none',
          }}
        >
          <Settings size={18} />
          {!sidebarCollapsed && <span>系统设置</span>}
        </button>
      </div>
    </nav>
  );
}