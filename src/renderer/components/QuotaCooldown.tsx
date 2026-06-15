import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { formatCountdown } from '../lib/providerGuide'

interface Props {
  until: number
  onExpired?: () => void
  compact?: boolean
}

/** Countdown after a free-tier rate limit; shows time left before retrying. */
export default function QuotaCooldown({ until, onExpired, compact }: Props) {
  const [remaining, setRemaining] = useState(() => Math.max(0, until - Date.now()))

  useEffect(() => {
    const tick = () => {
      const next = Math.max(0, until - Date.now())
      setRemaining(next)
      if (next === 0) onExpired?.()
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [until, onExpired])

  if (remaining <= 0) return null

  return (
    <div style={compact ? styles.compact : styles.box}>
      <span style={styles.timerLabel}>
        {compact ? 'Rate limit' : 'Free-tier rate limit reached'}
      </span>
      <span style={compact ? styles.timerCompact : styles.timer}>{formatCountdown(remaining)}</span>
      <span style={styles.hint}>
        {compact
          ? ' — wait, then send again'
          : ' Wait for the timer, then try your prompt again. Each generation uses one API call.'}
      </span>
      {!compact && (
        <Link to="/settings" style={styles.link}>
          Add a Groq or Gemini backup key in Settings →
        </Link>
      )}
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  box: {
    marginTop: 12,
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  compact: {
    display: 'inline-flex',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  timerLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--warning)',
  },
  timer: {
    fontSize: 22,
    fontWeight: 500,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-primary)',
    letterSpacing: '0.04em',
  },
  timerCompact: {
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'var(--font-mono)',
    color: 'var(--warning)',
  },
  hint: {
    fontSize: 12,
    lineHeight: 1.45,
    color: 'var(--text-muted)',
  },
  link: {
    fontSize: 12,
    color: 'var(--accent)',
    textDecoration: 'underline',
    marginTop: 2,
  },
}
