import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Sidebar from './components/layout/Sidebar'
import PlaybackBar from './components/PlaybackBar'
import SplashScreen from './components/SplashScreen'
import OnboardingModal from './components/OnboardingModal'
import AgentPage from './pages/AgentPage'
import WebAppsPage from './pages/WebAppsPage'
import PlayerPage from './pages/PlayerPage'
import GraphPage from './pages/GraphPage'
import SettingsPage from './pages/SettingsPage'
import { applyTheme, getInitialTheme } from './styles/theme'
import { useAppStore } from './stores/appStore'
import { useStream } from './hooks/useStream'

const ONBOARDING_KEY = 'drc-onboarding-completed'

export default function App() {
  const theme = useAppStore((s) => s.theme)
  const [showSplash, setShowSplash] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Connect streaming IPC
  useStream()

  useEffect(() => {
    applyTheme(getInitialTheme())
  }, [])

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem('drc-theme', theme)
  }, [theme])

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY) === '1'
    if (!done) {
      const t = setTimeout(() => setShowOnboarding(true), 600)
      return () => clearTimeout(t)
    }
    const onReplay = () => setShowOnboarding(true)
    window.addEventListener('drc:replay-onboarding', onReplay)
    return () => window.removeEventListener('drc:replay-onboarding', onReplay)
  }, [])

  const closeOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    setShowOnboarding(false)
  }

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
      <PlaybackBar />
      {showOnboarding && <OnboardingModal onClose={closeOnboarding} />}
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
    </div>
  )
}
