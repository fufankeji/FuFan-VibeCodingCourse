import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import { lazy, Suspense } from 'react'
import Home from './pages/Home'
import ProtectedRoute from './components/ProtectedRoute'

const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'))
const ChatPage = lazy(() => import('./pages/dashboard/ChatPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))

const SuspenseFallback = (
  <div className="flex h-dvh items-center justify-center dark:bg-gray-950 dark:text-white">
    Loading...
  </div>
)

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/login"
              element={<Suspense fallback={SuspenseFallback}><LoginPage /></Suspense>}
            />
            <Route
              path="/register"
              element={<Suspense fallback={SuspenseFallback}><RegisterPage /></Suspense>}
            />
            <Route
              path="/dashboard"
              element={
                <Suspense fallback={SuspenseFallback}>
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                </Suspense>
              }
            >
              <Route
                path="chat"
                element={
                  <Suspense fallback={SuspenseFallback}>
                    <ChatPage />
                  </Suspense>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
