import { useState, useCallback, type CSSProperties } from 'react'
import { usePlayerStore } from '../stores/playerStore'
import { useEditorStore } from '../stores/editorStore'
import Knob from '../components/player/Knob'
import PianoKeyboard from '../components/player/PianoKeyboard'
import WaveformDisplay from '../components/player/WaveformDisplay'
import { audioFeedback } from '../styles/audio-feedback'
import { useAppStore } from '../stores/appStore'

// Default parameter set for demonstration
const DEFAULT_PARAMS = [
  { name: 'frequency', min: 20, max: 12000, value: 440, unit: 'Hz', step: 1 },
  { name: 'amplitude', min: 0, max: 1, value: 0.5, unit: '', step: 0.01 },
  { name: 'modIndex', min: 0, max: 20, value: 8, unit: '', step: 0.1 },
  { name: 'modRatio', min: 0.5, max: 10, value: 3.5, unit: '', step: 0.1 },
  { name: 'attack', min: 0.001, max: 2, value: 0.01, unit: 's', step: 0.001 },
  { name: 'decay', min: 0.01, max: 10, value: 2, unit: 's', step: 0.01 },
  { name: 'reverbMix', min: 0, max: 1, value: 0.3, unit: '', step: 0.01 },
  { name: 'reverbSize', min: 0, max: 1, value: 0.8, unit: '', step: 0.01 },
]

export default function PlayerPage() {
  const { isPlaying, isLiveMode, currentTime, duration, setPlaying, setLiveMode, channels, setChannel } = usePlayerStore()
  const { csdContent } = useEditorStore()
  const audioEnabled = useAppStore((s) => s.audioFeedbackEnabled)
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set())
  const [params, setParams] = useState(DEFAULT_PARAMS)

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleNoteOn = useCallback((midi: number) => {
    setActiveNotes((prev) => new Set(prev).add(midi))
    if (audioEnabled) audioFeedback.click()
    // TODO: Wire to live engine - send inputMessage to Csound
  }, [audioEnabled])

  const handleNoteOff = useCallback((midi: number) => {
    setActiveNotes((prev) => {
      const next = new Set(prev)
      next.delete(midi)
      return next
    })
  }, [])

  const handleParamChange = useCallback((index: number, value: number) => {
    setParams((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], value }
      return next
    })
    // TODO: Wire to live engine - chnset over UDP
    const param = params[index]
    setChannel(param.name, value)
  }, [params, setChannel])

  const handleToggleLive = () => {
    setLiveMode(!isLiveMode)
    if (audioEnabled) audioFeedback.toggle(!isLiveMode)
  }

  const hasCsd = csdContent.trim().length > 0
  const hasP4 = csdContent.includes('p4')

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Player</h1>
        <div style={styles.headerActions}>
          <button
            onClick={handleToggleLive}
            style={{
              ...styles.liveToggle,
              ...(isLiveMode ? styles.liveActive : {}),
            }}
          >
            <span style={{
              ...styles.liveDot,
              background: isLiveMode ? '#ff4444' : 'var(--text-muted)',
            }} />
            LIVE
          </button>
        </div>
      </div>

      {/* Waveform */}
      <div style={styles.waveformArea}>
        <WaveformDisplay currentTime={currentTime} duration={duration} height={140} />
      </div>

      {/* Transport */}
      <div style={styles.transport}>
        <button
          onClick={() => {
            setPlaying(!isPlaying)
            if (audioEnabled) audioFeedback.click()
          }}
          style={{
            ...styles.playButton,
            ...(isPlaying ? styles.playButtonActive : {}),
          }}
        >
          {isPlaying ? '■' : '▶'}
        </button>
        <span style={styles.time}>
          {formatTime(currentTime)} / {formatTime(duration || 0)}
        </span>
        {!hasCsd && (
          <span style={styles.hint}>Write or load a CSD in the Agent tab to play</span>
        )}
      </div>

      {/* Parameters */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Parameters</h3>
        <div style={styles.knobGrid}>
          {params.map((p, i) => (
            <Knob
              key={p.name}
              label={p.name}
              value={p.value}
              min={p.min}
              max={p.max}
              step={p.step}
              unit={p.unit}
              onChange={(val) => handleParamChange(i, val)}
            />
          ))}
        </div>
      </div>

      {/* Keyboard */}
      {hasP4 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Keyboard</h3>
          <div style={styles.keyboardWrapper}>
            <PianoKeyboard
              startOctave={3}
              octaves={3}
              activeNotes={activeNotes}
              onNoteOn={handleNoteOn}
              onNoteOff={handleNoteOff}
            />
          </div>
        </div>
      )}

      {/* Always show keyboard in demo mode */}
      {!hasP4 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            Keyboard
            <span style={styles.sectionHint}> — appears when CSD uses p4 (pitch)</span>
          </h3>
          <div style={styles.keyboardWrapper}>
            <PianoKeyboard
              startOctave={3}
              octaves={3}
              activeNotes={activeNotes}
              onNoteOn={handleNoteOn}
              onNoteOff={handleNoteOff}
            />
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  container: {
    height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column',
    alignItems: 'center', padding: '32px 48px', gap: 28, maxWidth: 900, margin: '0 auto',
  },
  header: {
    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { fontSize: 28, fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '0.04em' },
  headerActions: { display: 'flex', gap: 8 },
  liveToggle: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 14px', borderRadius: 8,
    border: 'var(--border-width) solid var(--border)', background: 'transparent',
    color: 'var(--text-muted)', fontSize: 11, fontWeight: 600,
    letterSpacing: '0.08em', cursor: 'pointer',
  },
  liveActive: { borderColor: '#ff4444', color: '#ff4444' },
  liveDot: { width: 6, height: 6, borderRadius: '50%' },
  waveformArea: {
    width: '100%', borderRadius: 16, overflow: 'hidden',
    border: 'var(--border-width) solid var(--border)', background: 'var(--bg-secondary)',
  },
  transport: {
    display: 'flex', alignItems: 'center', gap: 16,
  },
  playButton: {
    width: 52, height: 52, borderRadius: 16,
    border: 'var(--border-width) solid var(--border)', background: 'var(--bg-secondary)',
    color: 'var(--accent)', fontSize: 18,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    transition: 'all 150ms ease',
  },
  playButtonActive: { background: 'var(--accent)', color: 'var(--bg-primary)', borderColor: 'var(--accent)' },
  time: { fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--text-secondary)', letterSpacing: '0.04em' },
  hint: { fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' },
  section: { width: '100%' },
  sectionTitle: {
    fontSize: 12, fontWeight: 600, letterSpacing: '0.06em',
    color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 16,
  },
  sectionHint: { fontWeight: 400, textTransform: 'none', letterSpacing: 'normal', fontStyle: 'italic' },
  knobGrid: {
    display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center',
    padding: '20px 24px', borderRadius: 16,
    border: 'var(--border-width) solid var(--border)', background: 'var(--bg-secondary)',
  },
  keyboardWrapper: {
    padding: '16px 20px', borderRadius: 16,
    border: 'var(--border-width) solid var(--border)', background: 'var(--bg-secondary)',
    overflow: 'auto', display: 'flex', justifyContent: 'center',
  },
}
