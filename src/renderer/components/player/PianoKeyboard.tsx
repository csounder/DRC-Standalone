import { useCallback, type CSSProperties } from 'react'

interface Props {
  startOctave?: number
  octaves?: number
  activeNotes: Set<number>
  onNoteOn: (midi: number) => void
  onNoteOff: (midi: number) => void
}

const WHITE_KEYS = [0, 2, 4, 5, 7, 9, 11] // C D E F G A B
const BLACK_KEYS = [1, 3, -1, 6, 8, 10, -1] // C# D# _ F# G# A# _
const BLACK_OFFSETS = [0.65, 1.75, -1, 3.6, 4.7, 5.8, -1]

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export default function PianoKeyboard({
  startOctave = 3,
  octaves = 3,
  activeNotes,
  onNoteOn,
  onNoteOff,
}: Props) {
  const whiteKeyWidth = 32
  const blackKeyWidth = 20
  const whiteKeyHeight = 100
  const blackKeyHeight = 62
  const totalWhiteKeys = octaves * 7

  const handleDown = useCallback((midi: number) => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    onNoteOn(midi)
  }, [onNoteOn])

  const handleUp = useCallback((midi: number) => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    onNoteOff(midi)
  }, [onNoteOff])

  const keys: JSX.Element[] = []

  // White keys
  for (let oct = 0; oct < octaves; oct++) {
    for (let i = 0; i < 7; i++) {
      const midi = (startOctave + oct) * 12 + WHITE_KEYS[i]
      const x = (oct * 7 + i) * whiteKeyWidth
      const isActive = activeNotes.has(midi)
      keys.push(
        <rect
          key={`w-${midi}`}
          x={x}
          y={0}
          width={whiteKeyWidth - 1}
          height={whiteKeyHeight}
          rx={3}
          fill={isActive ? 'var(--accent)' : '#e8e6e1'}
          stroke="var(--border)"
          strokeWidth={0.5}
          style={{ cursor: 'pointer', transition: 'fill 60ms ease' }}
          onMouseDown={handleDown(midi)}
          onMouseUp={handleUp(midi)}
          onMouseLeave={handleUp(midi)}
          onTouchStart={handleDown(midi)}
          onTouchEnd={handleUp(midi)}
        />
      )
    }
  }

  // Black keys (on top)
  for (let oct = 0; oct < octaves; oct++) {
    for (let i = 0; i < 7; i++) {
      if (BLACK_KEYS[i] === -1) continue
      const midi = (startOctave + oct) * 12 + BLACK_KEYS[i]
      const x = oct * 7 * whiteKeyWidth + BLACK_OFFSETS[i] * whiteKeyWidth - blackKeyWidth / 2 + whiteKeyWidth
      const isActive = activeNotes.has(midi)
      keys.push(
        <rect
          key={`b-${midi}`}
          x={x}
          y={0}
          width={blackKeyWidth}
          height={blackKeyHeight}
          rx={2}
          fill={isActive ? 'var(--accent)' : '#1a1918'}
          style={{ cursor: 'pointer', transition: 'fill 60ms ease' }}
          onMouseDown={handleDown(midi)}
          onMouseUp={handleUp(midi)}
          onMouseLeave={handleUp(midi)}
          onTouchStart={handleDown(midi)}
          onTouchEnd={handleUp(midi)}
        />
      )
    }
  }

  return (
    <div style={styles.container}>
      <svg
        width={totalWhiteKeys * whiteKeyWidth}
        height={whiteKeyHeight}
        viewBox={`0 0 ${totalWhiteKeys * whiteKeyWidth} ${whiteKeyHeight}`}
        style={styles.svg}
      >
        {keys}
      </svg>
      <div style={styles.labels}>
        {Array.from({ length: octaves }, (_, i) => (
          <span key={i} style={{ ...styles.octaveLabel, left: i * 7 * whiteKeyWidth + 2 }}>
            C{startOctave + i}
          </span>
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  container: {
    position: 'relative',
    overflow: 'auto',
    borderRadius: 8,
  },
  svg: {
    display: 'block',
  },
  labels: {
    position: 'relative',
    height: 16,
  },
  octaveLabel: {
    position: 'absolute',
    fontSize: 10,
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    top: 2,
  },
}
