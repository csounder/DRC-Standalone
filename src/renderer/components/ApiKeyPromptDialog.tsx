import { type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PROVIDER_OPTIONS } from '../lib/providerGuide'
import { readWorkshopStarter } from '../lib/workshopDemos'

interface Props {
  onClose: () => void
}

/** Shown when the user tries to generate before configuring an API key. */
export default function ApiKeyPromptDialog({ onClose }: Props) {
  const navigate = useNavigate()
  const groq = PROVIDER_OPTIONS.find((p) => p.id === 'groq')!

  const goSettings = () => {
    navigate('/settings')
    onClose()
  }

  return (
    <div style={styles.backdrop} role="dialog" aria-modal="true" aria-label="API key needed">
      <div style={styles.modal}>
        <h2 style={styles.title}>Add an API key first</h2>
        <p style={styles.body}>
          The Agent needs a personal or free LLM key before it can compose sound.
          Paste one in <strong>Settings</strong> — a free <strong>Groq</strong> key is recommended.
          Or skip keys: <strong>Web Apps</strong> and <strong>Player → Workshop demo</strong> need no key.
        </p>
        <div style={styles.links}>
          <a href={groq.signupUrl} target="_blank" rel="noopener noreferrer" style={styles.extLink}>
            Get free {groq.label} key →
          </a>
        </div>
        <div style={styles.footer}>
          <button style={styles.ghost} onClick={onClose}>Not now</button>
          <button
            style={styles.ghost}
            onClick={() => {
              onClose()
              navigate('/player')
            }}
          >
            Player demo
          </button>
          <Link to="/settings" style={styles.linkBtn} onClick={onClose}>
            Open Settings
          </Link>
          <button style={styles.primary} onClick={goSettings}>Add key in Settings</button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 850,
    background: 'rgba(0, 0, 0, 0.45)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    width: 'min(440px, 94vw)',
    padding: '28px 32px',
    borderRadius: 16,
    border: 'var(--border-width) solid var(--border)',
    background: 'var(--bg-primary)',
    boxShadow: 'var(--shadow-elevated)',
  },
  title: {
    margin: '0 0 10px',
    fontSize: 18,
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  body: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.55,
    color: 'var(--text-secondary)',
  },
  links: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginTop: 14,
  },
  extLink: {
    fontSize: 12,
    color: 'var(--accent)',
    textDecoration: 'none',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 22,
    flexWrap: 'wrap',
  },
  ghost: {
    padding: '9px 14px',
    borderRadius: 10,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'var(--font-primary)',
  },
  linkBtn: {
    padding: '9px 14px',
    borderRadius: 10,
    border: 'var(--border-width) solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 13,
    textDecoration: 'none',
    marginLeft: 'auto',
  },
  primary: {
    padding: '9px 18px',
    borderRadius: 10,
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--bg-primary)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'var(--font-primary)',
  },
}
