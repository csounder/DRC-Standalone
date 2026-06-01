import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { ArtifactType } from '../../stores/artifactStore'

const TARGETS: Record<ArtifactType, { key: 'csd' | 'webapp' | 'vst'; label: string; icon: string }[]> = {
  csd: [
    { key: 'webapp', label: 'Web App', icon: '◫' },
    { key: 'vst', label: 'Cabbage Plugin', icon: '⬡' },
  ],
  webapp: [
    { key: 'csd', label: 'CSD Instrument', icon: '♪' },
    { key: 'vst', label: 'Cabbage Plugin', icon: '⬡' },
  ],
  vst: [
    { key: 'csd', label: 'CSD Instrument', icon: '♪' },
    { key: 'webapp', label: 'Web App', icon: '◫' },
  ],
}

interface Props {
  currentType: ArtifactType
  onConvert: (target: 'webapp' | 'vst' | 'csd') => void
}

export default function ConvertMenu({ currentType, onConvert }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={rootRef} style={styles.root}>
      <button onClick={() => setOpen((v) => !v)} style={styles.trigger}>
        Convert to <span style={styles.chev}>▾</span>
      </button>
      {open && (
        <div style={styles.menu}>
          {TARGETS[currentType].map((t) => (
            <button
              key={t.key}
              style={styles.item}
              onClick={() => {
                setOpen(false)
                onConvert(t.key)
              }}
            >
              <span style={styles.itemIcon}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  root: { position: 'relative' },
  trigger: {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontFamily: 'var(--font-primary)',
    cursor: 'pointer',
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  chev: { fontSize: 10, opacity: 0.7 },
  menu: {
    position: 'absolute',
    right: 0,
    bottom: 'calc(100% + 6px)',
    minWidth: 180,
    padding: 4,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    zIndex: 10,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: 13,
    fontFamily: 'var(--font-primary)',
    textAlign: 'left',
    cursor: 'pointer',
  },
  itemIcon: { color: 'var(--accent)', width: 16, textAlign: 'center' },
}
