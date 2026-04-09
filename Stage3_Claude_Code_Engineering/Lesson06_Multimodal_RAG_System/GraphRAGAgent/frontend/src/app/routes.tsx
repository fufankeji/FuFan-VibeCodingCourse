import { createBrowserRouter, Navigate } from 'react-router';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './components/pages/Dashboard';
import { Documents } from './components/pages/Documents';
import { KGExplorer } from './components/pages/KGExplorer';
import { QAChat } from './components/pages/QAChat';
import { SearchPage } from './components/pages/SearchPage';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: AppLayout,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', Component: Dashboard },
      { path: 'documents', Component: Documents },
      { path: 'graph', Component: KGExplorer },
      { path: 'chat', Component: QAChat },
      { path: 'search', Component: SearchPage },
    ],
  },
]);
