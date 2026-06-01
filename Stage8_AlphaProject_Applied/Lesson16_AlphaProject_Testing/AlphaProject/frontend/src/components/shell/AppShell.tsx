/**
 * AppShell · 1:1 翻译自 alpha_terminal_platform/code.html body 容器 L114 + L182
 * - flex md:flex-row, overflow-hidden
 * - main: flex-1 mt-12 md:ml-64 p-container-margin h-[calc(100vh-3rem)] overflow-y-auto
 */
import type { ReactNode } from "react";
import { Sidebar, type PageKey } from "./Sidebar";
import { Topbar } from "./Topbar";

interface Props {
  page: PageKey;
  onNavigate: (k: PageKey) => void;
  children: ReactNode;
}

export function AppShell({ page, onNavigate, children }: Props) {
  return (
    <div className="antialiased min-h-screen flex flex-col md:flex-row overflow-hidden bg-surface-base">
      <Topbar />
      <Sidebar active={page} onNavigate={onNavigate} />
      <main className="flex-1 mt-12 md:ml-64 p-container-margin h-[calc(100vh-3rem)] overflow-y-auto overflow-x-hidden relative">
        {children}
      </main>
    </div>
  );
}
