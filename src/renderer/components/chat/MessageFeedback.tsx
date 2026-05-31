import { useState, type CSSProperties } from 'react'
import { useSessionStore } from '../../stores/sessionStore'

// Line-art thumb icons (feather style, currentColor) to match the app's minimal
// glyph aesthetic — no emoji.
function ThumbUp({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  )
}

function ThumbDown({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7 0h2.67A2.31 2.31 0 0 0 22 13V4a2.31 2.31 0 0 0-2.33-2H17" />
    </svg>
  )
}

// Thumbs on a completed assistant turn. The single manual learning signal the
// user can give per message — it feeds the heuristic profile + technique
// preferences in main/memory. Once given it locks, so we don't double-count.
export default function MessageFeedback({
  messageId,
  content,
}: {
  messageId: string
  content: string
}) {
  const sendFeedback = useSessionStore((s) => s.sendFeedback)
  const [picked, setPicked] = useState<'up' | 'down' | null>(null)

  const send = (which: 'up' | 'down') => {
    if (picked) return
    setPicked(which)
    sendFeedback(which === 'up' ? 'thumbs_up' : 'thumbs_down', { messageId, content })
  }

  return (
    <div style={styles.row}>
      <button
        title="This was good"
        aria-label="Good response"
        onClick={() => send('up')}
        style={{ ...styles.btn, ...(picked === 'up' ? styles.activeUp : {}) }}
      >
        <ThumbUp filled={picked === 'up'} />
      </button>
      <button
        title="Not what I wanted"
        aria-label="Bad response"
        onClick={() => send('down')}
        style={{ ...styles.btn, ...(picked === 'down' ? styles.activeDown : {}) }}
      >
        <ThumbDown filled={picked === 'down'} />
      </button>
      {picked && <span style={styles.note}>noted — I'll remember</span>}
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  row: { display: 'flex', alignItems: 'center', gap: 2, marginTop: 6 },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    padding: 5,
    borderRadius: 7,
    color: 'var(--text-muted)',
    opacity: 0.7,
    transition: 'color 120ms ease, background 120ms ease, opacity 120ms ease',
  },
  activeUp: { color: 'var(--accent)', opacity: 1, background: 'var(--accent-muted)' },
  activeDown: { color: 'var(--text-secondary)', opacity: 1, background: 'var(--bg-tertiary)' },
  note: {
    fontSize: 11,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    marginLeft: 4,
  },
}
