import type { CSSProperties } from 'react'

export interface CsdVersion {
  id: string
  version: number
  timestamp: number
  description: string
  csd: string
}

interface Props {
  versions: CsdVersion[]
  activeVersion: number
  onSelectVersion: (version: number) => void
}

export default function VersionTimeline({ versions, activeVersion, onSelectVersion }: Props) {
  if (versions.length === 0) return null

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={styles.container}>
      <div style={styles.track}>
        {versions.map((v, i) => (
          <button
            key={v.id}
            onClick={() => onSelectVersion(v.version)}
            style={{
              ...styles.node,
              ...(v.version === activeVersion ? styles.nodeActive : {}),
            }}
            title={v.description}
          >
            <div style={{
              ...styles.dot,
              ...(v.version === activeVersion ? styles.dotActive : {}),
            }} />
            <span style={styles.label}>v{v.version}</span>
            <span style={styles.time}>{formatTime(v.timestamp)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  container: {
    padding: '8px 24px',
    borderBottom: '1px solid var(--border-subtle)',
    overflow: 'auto',
    flexShrink: 0,
  },
  track: {
    display: 'flex',
    gap: 4,
    alignItems: 'center',
    minWidth: 'min-content',
  },
  node: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 8,
    border: '1px solid transparent',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    flexShrink: 0,
    fontFamily: 'var(--font-primary)',
  },
  nodeActive: {
    background: 'var(--accent-muted)',
    borderColor: 'var(--accent)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--border)',
    flexShrink: 0,
    transition: 'background 150ms ease',
  },
  dotActive: {
    background: 'var(--accent)',
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)',
  },
  time: {
    fontSize: 10,
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  },
}
