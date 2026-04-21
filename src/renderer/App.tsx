import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Sidebar from './components/layout/Sidebar'
import AgentPage from './pages/AgentPage'
import WebAppsPage from './pages/WebAppsPage'
import PlayerPage from './pages/PlayerPage'
import GraphPage from './pages/GraphPage'
import SettingsPage from './pages/SettingsPage'
import { applyTheme, getInitialTheme } from './styles/theme'
import { useAppStore } from './stores/appStore'
import { useStream } from './hooks/useStream'

export default function App() {
  const theme = useAppStore((s) => s.theme)

  // Connect streaming IPC
  useStream()

  useEffect(() => {
    applyTheme(getInitialTheme())
  }, [])

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem('drc-theme', theme)
  }, [theme])

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/agent" replace />} />
          <Route path="/agent" element={<AgentPage />} />
          <Route path="/apps" element={<WebAppsPage />} />
          <Route path="/player" element={<PlayerPage />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}
