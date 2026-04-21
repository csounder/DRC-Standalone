import { useState, useRef, useEffect, type CSSProperties } from 'react'
import { audioFeedback } from '../../styles/audio-feedback'
import { useAppStore } from '../../stores/appStore'

interface Props {
  csd: string
  version: number
  timestamp: number
  isLatest: boolean
  isPlaying: boolean
  onPlay: () => void
  onStop: () => void
  onSave: () => void
  onEdit: (newCsd: string) => void
}

export default function CsdBlock({ csd, version, timestamp, isLatest, isPlaying, onPlay, onStop, onSave, onEdit }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(csd)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const audioEnabled = useAppStore((s) => s.audioFeedbackEnabled)

  const lines = csd.split('\n')
  const previewLines = lines.slice(0, 4).join('\n')
  const instrCount = (csd.match(/\binstr\b/g) || []).length
  const hasScore = csd.includes('<CsScore>')

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [editing])

  const handlePlayToggle = () => {
    if (audioEnabled) audioFeedback.click()
    if (isPlaying) {
      onStop()
    } else {
      onPlay()
    }
  }

  const handleSaveEdit = () => {
    onEdit(editContent)
    setEditing(false)
  }

  return (
    <div style={styles.container}>
      {/* Header bar */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.fileIcon}>◇</span>
          <span style={styles.fileName}>v{version}.csd</span>
          <span style={styles.meta}>{instrCount} instr · {lines.length} lines</span>
          {isLatest && <span style={styles.latestBadge}>latest</span>}
        </div>
        <div style={styles.headerRight}>
          <span style={styles.time}>{formatTime(timestamp)}</span>
        </div>
      </div>

      {/* Preview / Expanded code */}
      {!editing ? (
        <button
          onClick={() => {
            setExpanded(!expanded)
            if (audioEnabled) audioFeedback.click()
          }}
          style={styles.codeButton}
        >
          <pre style={styles.code}>
            {expanded ? csd : previewLines + (lines.length > 4 ? '\n...' : '')}
          </pre>
          {!expanded && lines.length > 4 && (
            <div style={styles.fadeOverlay} />
          )}
        </button>
      ) : (
        <div style={styles.editArea}>
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            style={styles.editTextarea}
            spellCheck={false}
          />
          <div style={styles.editActions}>
            <button onClick={() => setEditing(false)} style={styles.editCancel}>Cancel</button>
            <button onClick={handleSaveEdit} style={styles.editSave}>Apply Changes</button>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div style={styles.actions}>
        <button onClick={handlePlayToggle} style={{ ...styles.actionBtn, ...styles.playBtn, ...(isPlaying ? styles.playBtnActive : {}) }}>
          {isPlaying ? '■ Stop' : '▶ Play'}
        </button>
        <button onClick={onSave} style={styles.actionBtn}>
          ↓ Save .csd
        </button>
        {!editing && (
          <button onClick={() => { setEditing(true); setEditContent(csd) }} style={styles.actionBtn}>
            ✎ Edit
          </button>
        )}
        <button onClick={() => setExpanded(!expanded)} style={styles.actionBtn}>
          {expanded ? '↑ Collapse' : '↓ Expand'}
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  container: {
    borderRadius: 14,
    border: '1.5px solid var(--border)',
    background: 'var(--bg-secondary)',
    overflow: 'hidden',
    margin: '4px 0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    background: 'var(--bg-tertiary)',
    borderBottom: '1px solid var(--border-subtle)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  fileIcon: {
    fontSize: 14,
    color: 'var(--accent)',
  },
  fileName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
  },
  meta: {
    fontSize: 11,
    color: 'var(--text-muted)',
  },
  latestBadge: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--accent)',
    background: 'var(--accent-muted)',
    padding: '1px 7px',
    borderRadius: 4,
    letterSpacing: '0.04em',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  time: {
    fontSize: 11,
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  },
  codeButton: {
    display: 'block',
    width: '100%',
    border: 'none',
    background: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
    position: 'relative',
    padding: 0,
    maxHeight: 300,
    overflow: 'auto',
  },
  code: {
    margin: 0,
    padding: '12px 16px',
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
    whiteSpace: 'pre',
    overflow: 'hidden',
    tabSize: 2,
  },
  fadeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    background: 'linear-gradient(transparent, var(--bg-secondary))',
    pointerEvents: 'none',
  },
  editArea: {
    display: 'flex',
    flexDirection: 'column',
  },
  editTextarea: {
    width: '100%',
    minHeight: 200,
    maxHeight: 400,
    border: 'none',
    padding: '12px 16px',
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
    lineHeight: 1.5,
    color: 'var(--text-primary)',
    background: 'var(--bg-primary)',
    outline: 'none',
    resize: 'vertical',
    tabSize: 2,
  },
  editActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '8px 12px',
    borderTop: '1px solid var(--border-subtle)',
    background: 'var(--bg-tertiary)',
  },
  editCancel: {
    padding: '5px 14px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: 12,
    fontFamily: 'var(--font-primary)',
    cursor: 'pointer',
  },
  editSave: {
    padding: '5px 14px',
    borderRadius: 6,
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--bg-primary)',
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'var(--font-primary)',
    cursor: 'pointer',
  },
  actions: {
    display: 'flex',
    gap: 6,
    padding: '8px 12px',
    borderTop: '1px solid var(--border-subtle)',
  },
  actionBtn: {
    padding: '5px 12px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontFamily: 'var(--font-primary)',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    letterSpacing: '0.02em',
  },
  playBtn: {
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
  },
  playBtnActive: {
    background: 'var(--accent)',
    color: 'var(--bg-primary)',
  },
}
