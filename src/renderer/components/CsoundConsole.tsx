import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { useCsoundConsoleStore } from '../stores/csoundConsoleStore'

const PANEL_HEIGHT = 200

function isErrorLine(text: string): boolean {
  return /error|cannot|unexpected|failed|syntax|undefined|INIT ERROR|PERF ERROR|too many arguments/i.test(text)
}

export default function CsoundConsole() {
  const enabled = useCsoundConsoleStore((s) => s.enabled)
  const expanded = useCsoundConsoleStore((s) => s.expanded)
  const lines = useCsoundConsoleStore((s) => s.lines)
  const append = useCsoundConsoleStore((s) => s.append)
  const clear = useCsoundConsoleStore((s) => s.clear)
  const setExpanded = useCsoundConsoleStore((s) => s.setExpanded)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsub = window.api?.csound?.onOutput?.((chunk) => {
      append(chunk)
    })
    return () => unsub?.()
  }, [append])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [lines])

  if (!enabled) return null

  return (
    <div style={{ ...styles.shell, ...(expanded ? {} : styles.shellCollapsed) }}>
      <div style={styles.header}>
        <span style={styles.title}>Csound output</span>
        <span style={styles.hint}>
          {lines.length === 0 ? 'Compile and play messages appear here' : `${lines.length} lines`}
        </span>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={clear} style={styles.headerBtn} title="Clear console">
          Clear
        </button>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={styles.headerBtn}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '▼' : '▲'}
        </button>
      </div>
      {expanded && (
        <div ref={scrollRef} style={styles.body}>
          {lines.length === 0 ? (
            <div style={styles.placeholder}>
              Turn this on before playing. If sound works in CsoundQt but not in Dr.C, look for
              &quot;Audio: using &lt;CsOptions&gt; from CSD&quot; vs a Settings device override.
            </div>
          ) : (
            lines.map((line, i) => (
              <div
                key={`${line.ts}-${i}`}
                style={{
                  ...styles.line,
                  ...(line.stream === 'info' ? styles.lineInfo : {}),
                  ...(isErrorLine(line.text) ? styles.lineError : {}),
                }}
              >
                {line.text}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export const CSOUND_CONSOLE_HEIGHT = PANEL_HEIGHT

const styles: Record<string, CSSProperties> = {
  shell: {
    flexShrink: 0,
    height: PANEL_HEIGHT,
    display: 'flex',
    flexDirection: 'column',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
  },
  shellCollapsed: {
    height: 'auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 12px',
    borderBottom: '1px solid var(--border-subtle)',
    flexShrink: 0,
  },
  title: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  hint: {
    fontSize: 11,
    color: 'var(--text-muted)',
  },
  headerBtn: {
    padding: '3px 10px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-primary)',
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontFamily: 'var(--font-primary)',
    cursor: 'pointer',
  },
  body: {
    flex: 1,
    overflow: 'auto',
    padding: '8px 12px',
    fontFamily: 'var(--font-mono), SF Mono, Menlo, monospace',
    fontSize: 11,
    lineHeight: 1.45,
  },
  placeholder: {
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  line: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: 'var(--text-secondary)',
  },
  lineInfo: {
    color: 'var(--accent)',
    fontWeight: 500,
  },
  lineError: {
    color: 'var(--warning, #f0b27a)',
    fontWeight: 600,
  },
}
