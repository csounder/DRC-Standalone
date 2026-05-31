import { useEffect, useState, type CSSProperties } from 'react'

interface Learned {
  favored: string[]
  disfavored: string[]
  favoredOpcodes: string[]
  totalFeedback: number
}

// Shows what the agent has LEARNED from your feedback — the techniques it now
// leans toward (and avoids). Not a label about you; a window into how your 👍/👎
// are steering future generations. Hidden until there's something learned.
export default function ProfileBadge() {
  const [learned, setLearned] = useState<Learned | null>(null)

  useEffect(() => {
    const load = () =>
      window.api?.memory
        ?.getProfile?.()
        .then((p: any) => setLearned(p))
        .catch(() => {})
    load()
    window.addEventListener('drc:profile-changed', load)
    return () => window.removeEventListener('drc:profile-changed', load)
  }, [])

  if (!learned || (learned.favored.length === 0 && learned.disfavored.length === 0)) return null

  const top = learned.favored.slice(0, 2)
  const tip =
    `Learned from your feedback (${learned.totalFeedback} signals). ` +
    (learned.favored.length ? `Leaning toward: ${learned.favored.join(', ')}. ` : '') +
    (learned.disfavored.length ? `Avoiding: ${learned.disfavored.join(', ')}. ` : '') +
    `Steers future generations — adjust it with 👍/👎.`

  return (
    <span style={styles.badge} title={tip}>
      <span style={styles.dot} />
      learned
      {top.length > 0 && <span style={styles.tech}> · {top.join(', ')}</span>}
    </span>
  )
}

const styles: Record<string, CSSProperties> = {
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    cursor: 'default',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--accent)',
    flexShrink: 0,
  },
  tech: { color: 'var(--accent)', fontStyle: 'normal' },
}
