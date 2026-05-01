import { useRef, useState, useCallback, type CSSProperties } from 'react'

interface Props {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
  // MIDI Learn — when supplied, the knob shows a tiny binding pill that
  // toggles "waiting for CC..." mode and surfaces the bound CC# once mapped.
  ccLabel?: string | null
  isLearning?: boolean
  onToggleLearn?: () => void
}

export default function Knob({
  label, value, min, max, step = 0.01, unit = '', onChange,
  ccLabel = null, isLearning = false, onToggleLearn,
}: Props) {
  const knobRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const startY = useRef(0)
  const startValue = useRef(0)

  const normalized = (value - min) / (max - min)
  const angle = -135 + normalized * 270 // -135 to +135 degrees

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    startY.current = e.clientY
    startValue.current = value

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = (startY.current - ev.clientY) / 150
      const range = max - min
      let newValue = startValue.current + delta * range
      newValue = Math.round(newValue / step) * step
      newValue = Math.max(min, Math.min(max, newValue))
      onChange(newValue)
    }

    const handleMouseUp = () => {
      setDragging(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [value, min, max, step, onChange])

  const displayValue = step >= 1
    ? Math.round(value).toString()
    : value.toFixed(step < 0.1 ? 2 : 1)

  return (
    <div style={styles.container}>
      <div
        ref={knobRef}
        style={{
          ...styles.knob,
          ...(dragging ? styles.knobActive : {}),
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Track arc */}
        <svg width="56" height="56" viewBox="0 0 56 56" style={styles.svg}>
          {/* Background arc */}
          <circle
            cx="28" cy="28" r="22"
            fill="none"
            stroke="var(--border)"
            strokeWidth="3"
            strokeDasharray={`${Math.PI * 44 * 0.75} ${Math.PI * 44 * 0.25}`}
            strokeDashoffset={Math.PI * 44 * 0.375}
            strokeLinecap="round"
            transform="rotate(135 28 28)"
          />
          {/* Value arc */}
          <circle
            cx="28" cy="28" r="22"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeDasharray={`${Math.PI * 44 * 0.75 * normalized} ${Math.PI * 44}`}
            strokeDashoffset={Math.PI * 44 * 0.375}
            strokeLinecap="round"
            transform="rotate(135 28 28)"
            style={{ transition: dragging ? 'none' : 'stroke-dasharray 100ms ease' }}
          />
        </svg>
        {/* Indicator dot */}
        <div
          style={{
            ...styles.indicator,
            transform: `rotate(${angle}deg)`,
          }}
        >
          <div style={styles.dot} />
        </div>
      </div>
      <span style={styles.value}>{displayValue}{unit}</span>
      <span style={styles.label}>{label}</span>
      {onToggleLearn && (
        <button
          type="button"
          onClick={onToggleLearn}
          title={isLearning ? 'Cancel MIDI learn' : ccLabel ? `Bound to ${ccLabel} — click to relearn` : 'Click then move a MIDI controller to bind'}
          style={{
            ...styles.learnPill,
            ...(isLearning ? styles.learnPillActive : ccLabel ? styles.learnPillBound : {}),
          }}
        >
          {isLearning ? 'learning…' : ccLabel ?? 'learn'}
        </button>
      )}
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    userSelect: 'none',
  },
  knob: {
    width: 56,
    height: 56,
    position: 'relative',
    cursor: 'grab',
    borderRadius: '50%',
  },
  knobActive: {
    cursor: 'grabbing',
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: '50%',
    width: 0,
    height: '50%',
    transformOrigin: 'bottom center',
    pointerEvents: 'none',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--accent)',
    marginLeft: -3,
    marginTop: 4,
  },
  value: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-primary)',
    fontWeight: 500,
  },
  label: {
    fontSize: 10,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontWeight: 500,
    maxWidth: 80,
    textAlign: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  learnPill: {
    marginTop: 2,
    padding: '2px 6px',
    fontSize: 9,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    background: 'transparent',
    border: 'var(--border-width) solid var(--border)',
    borderRadius: 6,
    cursor: 'pointer',
    letterSpacing: '0.04em',
    minWidth: 48,
    textAlign: 'center',
  },
  learnPillActive: {
    color: '#ff4444',
    borderColor: '#ff4444',
    animation: 'pulse 1.2s ease-in-out infinite',
  },
  learnPillBound: {
    color: 'var(--accent)',
    borderColor: 'var(--accent)',
  },
}
