import React from 'react';
import { createBrowserRouter, Outlet } from 'react-router';
import { Header, Footer } from './components/layout';
import Landing from './pages/Landing';
import Pricing from './pages/Pricing';
import Gallery from './pages/Gallery';
import AgentDetail from './pages/AgentDetail';
import RunHistory from './pages/RunHistory';
import Settings from './pages/Settings';
import Pipeline from './pages/Pipeline';

function Root() {
  return (
    <div className="flex min-h-screen flex-col bg-bg-base font-sans text-fg-default antialiased">
      <Header />
      <Outlet />
      {/* Footer 只有在不需要全屏高度的页面才显示，用 CSS 逻辑或路由来控制，这里简单处理，给主要展示页保留，后台页隐藏 */}
    </div>
  );
}

function PageWithFooter({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Footer />
    </>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, element: <PageWithFooter><Landing /></PageWithFooter> },
      { path: "pricing", element: <PageWithFooter><Pricing /></PageWithFooter> },
      { path: "gallery", element: <PageWithFooter><Gallery /></PageWithFooter> },
      { path: "agent/:id", element: <PageWithFooter><AgentDetail /></PageWithFooter> },
      { path: "runs", element: <RunHistory /> },
      { path: "settings", element: <Settings /> },
      { path: "pipeline", element: <Pipeline /> },
      // [Prep-02] 修复 #5: 404 英文 → 中文
      { path: "*", element: <div className="flex flex-col items-center justify-center p-[48px] text-center"><h1 className="text-[30px] font-bold text-fg-default mb-[8px]">404</h1><p className="text-[14px] text-fg-secondary">页面不见了</p></div> },
    ],
  },
]);