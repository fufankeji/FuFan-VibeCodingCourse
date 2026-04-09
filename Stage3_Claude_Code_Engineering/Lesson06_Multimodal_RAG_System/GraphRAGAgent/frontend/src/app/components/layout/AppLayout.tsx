import React from 'react';
import { Outlet } from 'react-router';
import { Toaster } from 'sonner';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { useAppState, AppProvider } from '../../store';

function AppLayoutInner() {
  const { sidebarCollapsed } = useAppState();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateAreas: '"header header" "sidebar main" "footer footer"',
        gridTemplateColumns: `${sidebarCollapsed ? 72 : 220}px 1fr`,
        gridTemplateRows: '56px 1fr 32px',
        height: '100vh',
        overflow: 'hidden',
        transition: 'grid-template-columns 200ms ease',
      }}
    >
      <Header />
      <Sidebar />
      <main
        style={{
          gridArea: 'main',
          overflowY: 'auto',
          background: 'var(--bg-base)',
        }}
      >
        <Outlet />
      </main>
      <StatusBar />
    </div>
  );
}

export function AppLayout() {
  return (
    <AppProvider>
      <AppLayoutInner />
      <Toaster position="top-right" theme="dark" richColors />
    </AppProvider>
  );
}