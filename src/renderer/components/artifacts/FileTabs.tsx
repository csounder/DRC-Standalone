import type { CSSProperties } from 'react'
import type { ArtifactFile } from '../../stores/artifactStore'

interface Props {
  files: ArtifactFile[]
  activeIndex: number
  onSelect: (index: number) => void
}

export default function FileTabs({ files, activeIndex, onSelect }: Props) {
  return (
    <div style={styles.bar}>
      {files.map((f, i) => {
        const active = i === activeIndex
        return (
          <button
            key={f.name}
            onClick={() => onSelect(i)}
            title={f.derived ? `${f.name} (derived view)` : f.name}
            style={{
              ...styles.tab,
              ...(active ? styles.tabActive : null),
            }}
          >
            <span style={styles.tabName}>{f.name}</span>
            {f.derived && <span style={styles.derivedDot} />}
          </button>
        )
      })}
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  bar: {
    display: 'flex',
    gap: 2,
    padding: '0 12px',
    borderBottom: '1px solid var(--border-subtle)',
    background: 'var(--bg-primary)',
    overflowX: 'auto',
    flexShrink: 0,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    border: 'none',
    borderBottom: '2px solid transparent',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    marginBottom: -1,
    transition: 'color 120ms, border-color 120ms',
  },
  tabActive: {
    color: 'var(--text-primary)',
    borderBottomColor: 'var(--accent)',
  },
  tabName: {
    letterSpacing: '0.01em',
  },
  derivedDot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: 'var(--text-muted)',
    opacity: 0.5,
  },
}
