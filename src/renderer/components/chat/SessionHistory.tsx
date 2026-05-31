import { useEffect, useState, type CSSProperties } from 'react'

interface SessionSummary {
  id: string
  agent: string
  title: string | null
  messageCount: number
  createdAt: number
}

interface Lesson {
  id: string
  text: string
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d < 7 ? `${d}d ago` : new Date(ts).toLocaleDateString()
}

// Slide-over list of persisted chats. Restart-survival is only useful if the
// user can find and reopen past work — this is that surface.
export default function SessionHistory({
  open,
  currentSessionID,
  onClose,
  onLoad,
}: {
  open: boolean
  currentSessionID: string | null
  onClose: () => void
  onLoad: (id: string) => void
}) {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])

  const loadLessons = () =>
    window.api?.memory
      ?.lessons?.()
      .then((rows: any) => setLessons(Array.isArray(rows) ? rows : []))
      .catch(() => setLessons([]))

  useEffect(() => {
    if (!open) return
    window.api?.session
      ?.list?.()
      .then((rows: any) => setSessions(Array.isArray(rows) ? rows : []))
      .catch(() => setSessions([]))
    loadLessons()
  }, [open])

  const forget = async (id: string) => {
    await window.api?.memory?.deleteLesson?.(id)
    setLessons((ls) => ls.filter((l) => l.id !== id))
    window.dispatchEvent(new CustomEvent('drc:profile-changed'))
  }

  if (!open) return null

  return (
    <>
      <div style={styles.scrim} onClick={onClose} />
      <div style={styles.drawer}>
        <div style={styles.head}>
          <span style={styles.title}>History</span>
          <button style={styles.close} onClick={onClose} title="Close">
            ✕
          </button>
        </div>
        {lessons.length > 0 && (
          <div style={styles.lessonsWrap}>
            <span style={styles.sectionLabel}>Remembered instructions</span>
            {lessons.map((l) => (
              <div key={l.id} style={styles.lessonItem}>
                <span style={styles.lessonText}>{l.text}</span>
                <button
                  style={styles.forget}
                  title="Forget this instruction"
                  onClick={() => void forget(l.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={styles.list}>
          {sessions.length > 0 && <span style={styles.sectionLabel}>Sessions</span>}
          {sessions.length === 0 && <p style={styles.empty}>No past sessions yet.</p>}
          {sessions.map((s) => (
            <button
              key={s.id}
              style={{
                ...styles.item,
                ...(s.id === currentSessionID ? styles.itemActive : {}),
              }}
              onClick={() => {
                onLoad(s.id)
                onClose()
              }}
            >
              <span style={styles.itemTitle}>{s.title || 'Untitled session'}</span>
              <span style={styles.itemMeta}>
                {s.agent} · {s.messageCount} msg · {relativeTime(s.createdAt)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

const styles: Record<string, CSSProperties> = {
  scrim: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    zIndex: 40,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 300,
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border)',
    zIndex: 41,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '2px 0 16px rgba(0,0,0,0.3)',
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  title: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'var(--text-secondary)',
  },
  close: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: 13,
  },
  lessonsWrap: {
    padding: '10px 12px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    maxHeight: '40%',
    overflow: 'auto',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--text-muted)',
    marginBottom: 2,
  },
  lessonItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '7px 9px',
    borderRadius: 8,
    background: 'var(--accent-muted)',
    border: '1px solid var(--border-subtle)',
  },
  lessonText: { flex: 1, fontSize: 12, lineHeight: 1.4, color: 'var(--text-primary)' },
  forget: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: 11,
    flexShrink: 0,
    padding: 0,
    lineHeight: 1.4,
  },
  list: { flex: 1, overflow: 'auto', padding: 8 },
  empty: { fontSize: 12, color: 'var(--text-muted)', padding: 12, fontStyle: 'italic' },
  item: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    width: '100%',
    textAlign: 'left' as const,
    padding: '10px 12px',
    marginBottom: 4,
    borderRadius: 10,
    border: '1px solid transparent',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--text-primary)',
  },
  itemActive: { background: 'var(--accent-muted)', border: '1px solid var(--accent)' },
  itemTitle: {
    fontSize: 13,
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemMeta: { fontSize: 11, color: 'var(--text-muted)' },
}
