import type { CSSProperties } from 'react'
import { useSessionStore } from '../../stores/sessionStore'
import { formatCostUSD, formatTokenCount, shortModelName } from '../../lib/usageFormat'

/** Footer strip: last turn + session totals (matches Dr.C Terminal session footer). */
export default function UsageBar() {
  const lastTurn = useSessionStore((s) => s.lastTurnUsage)
  const sessionTotal = useSessionStore((s) => s.sessionUsage)

  if (!lastTurn && sessionTotal.turnCount === 0) return null

  const sessionLabel = formatCostUSD(sessionTotal.totalCostUSD, sessionTotal.totalCostUSD === 0)

  return (
    <div style={styles.bar} title="Estimated API usage for this chat session">
      {lastTurn && (
        <span style={styles.last}>
          {shortModelName(lastTurn.modelID)}
          {' · '}
          {formatTokenCount(lastTurn.totalTokens)} tokens
          {' · '}
          <span style={lastTurn.freeTier ? styles.free : styles.paid}>
            {formatCostUSD(lastTurn.costUSD, lastTurn.freeTier)}
            {lastTurn.freeTier ? ' (free tier)' : ''}
          </span>
        </span>
      )}
      {sessionTotal.turnCount > 0 && (
        <span style={styles.session}>
          Session: {formatTokenCount(sessionTotal.totalTokens)} tok · {sessionLabel}
        </span>
      )}
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  bar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '6px 16px',
    padding: '6px 28px 2px',
    fontSize: 11,
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    borderTop: '1px solid var(--border-subtle)',
  },
  last: { flex: '1 1 auto', minWidth: 0 },
  session: { flexShrink: 0, opacity: 0.85 },
  free: { color: 'var(--accent)' },
  paid: { color: 'var(--text-secondary)' },
}
