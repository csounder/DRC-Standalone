import { useNavigate, useLocation } from 'react-router-dom'
import { useAppStore } from '../../stores/appStore'
import { audioFeedback } from '../../styles/audio-feedback'
import type { CSSProperties } from 'react'

interface NavItem {
  path: string
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { path: '/agent', label: 'Agent', icon: '⬡' },
  { path: '/apps', label: 'Web Apps', icon: '◫' },
  { path: '/player', label: 'Player', icon: '▶' },
  { path: '/graph', label: 'Graph', icon: '◉' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme, audioFeedbackEnabled } = useAppStore()

  const handleNav = (path: string, index: number) => {
    if (audioFeedbackEnabled) audioFeedback.navigate(index)
    navigate(path)
  }

  const handleThemeToggle = () => {
    if (audioFeedbackEnabled) audioFeedback.toggle(theme === 'dark')
    toggleTheme()
  }

  return (
    <div style={styles.sidebar}>
      {/* Logo */}
      <div style={styles.logoArea} className="drag-region">
        <span style={styles.logo}>Dr</span>
        <span style={styles.logoAccent}>C</span>
      </div>

      {/* Navigation */}
      <div style={styles.nav}>
        {NAV_ITEMS.map((item, i) => {
          const active = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => handleNav(item.path, i)}
              style={{
                ...styles.navButton,
                ...(active ? styles.navButtonActive : {}),
              }}
              title={item.label}
              className="no-drag"
            >
              <span style={styles.navIcon}>{item.icon}</span>
            </button>
          )
        })}
      </div>

      {/* Bottom controls */}
      <div style={styles.bottom}>
        <button
          onClick={handleThemeToggle}
          style={styles.navButton}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="no-drag"
        >
          <span style={styles.navIcon}>{theme === 'dark' ? '○' : '●'}</span>
        </button>
        <button
          onClick={() => {
            if (audioFeedbackEnabled) audioFeedback.click()
            navigate('/settings')
          }}
          style={{
            ...styles.navButton,
            ...(location.pathname === '/settings' ? styles.navButtonActive : {}),
          }}
          title="Settings"
          className="no-drag"
        >
          <span style={styles.navIcon}>⚙</span>
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  sidebar: {
    width: 72,
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'var(--bg-secondary)',
    borderRight: 'var(--border-width) solid var(--border)',
    paddingTop: 48,
    paddingBottom: 16,
    flexShrink: 0,
  },
  logoArea: {
    marginBottom: 32,
    textAlign: 'center',
  },
  logo: {
    fontFamily: 'var(--font-primary)',
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--text-primary)',
    letterSpacing: '0.04em',
  },
  logoAccent: {
    fontFamily: 'var(--font-primary)',
    fontSize: 18,
    fontWeight: 300,
    color: 'var(--accent)',
    letterSpacing: '0.04em',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  navButton: {
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    borderRadius: 12,
    color: 'var(--text-muted)',
    transition: 'all var(--transition-fast)',
  },
  navButtonActive: {
    background: 'var(--accent-muted)',
    color: 'var(--accent)',
  },
  navIcon: {
    fontSize: 20,
  },
  bottom: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
}
