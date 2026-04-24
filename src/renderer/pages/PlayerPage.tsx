import { useState, useCallback, useRef, type CSSProperties, type DragEvent } from 'react'
import { usePlayerStore } from '../stores/playerStore'
import { useEditorStore } from '../stores/editorStore'
import Knob from '../components/player/Knob'
import PianoKeyboard from '../components/player/PianoKeyboard'
import WaveformDisplay from '../components/player/WaveformDisplay'
import { audioFeedback } from '../styles/audio-feedback'
import { useAppStore } from '../stores/appStore'
import { buildConvertPrompt, needsPlayerAdapt } from '../prompts/convert'

type AdaptStatus =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'adapting' }
  | { kind: 'compiling' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string }

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
  const { csdContent, setCsdContent } = useEditorStore()
  const audioEnabled = useAppStore((s) => s.audioFeedbackEnabled)
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set())
  const [params, setParams] = useState(DEFAULT_PARAMS)
  const [adaptStatus, setAdaptStatus] = useState<AdaptStatus>({ kind: 'idle' })
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleNoteOn = useCallback((midi: number) => {
    setActiveNotes((prev) => new Set(prev).add(midi))
    if (audioEnabled) audioFeedback.click()
    // midi → Hz, standard equal temperament centered on A4 = 440
    const hz = 440 * Math.pow(2, (midi - 69) / 12)
    // Use the current decay knob as the note length so the envelope has room
    // to breathe; clamp to sensible bounds.
    const decayParam = params.find((p) => p.name === 'decay')
    const dur = Math.max(0.5, Math.min(8, (decayParam?.value ?? 2) + 0.5))
    void window.api?.csound?.event(`i 1 0 ${dur.toFixed(3)} ${hz.toFixed(3)} 0.8`)
  }, [audioEnabled, params])

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
    const param = params[index]
    setChannel(param.name, value)
    void window.api?.csound?.setChannel(param.name, value)
  }, [params, setChannel])

  const handleToggleLive = () => {
    setLiveMode(!isLiveMode)
    if (audioEnabled) audioFeedback.toggle(!isLiveMode)
  }

  // Load a raw CSD string: adapt via the LLM if it doesn't already follow the
  // Player convention, then compile + play. Returns once playback has kicked off
  // (or an error is surfaced in adaptStatus).
  const loadAndPlayCsd = useCallback(async (raw: string) => {
    if (!window.api?.csound) {
      setAdaptStatus({ kind: 'error', message: 'Csound bridge unavailable' })
      return
    }

    let csd = raw.trim()
    if (needsPlayerAdapt(csd)) {
      setAdaptStatus({ kind: 'adapting' })
      const prompt = buildConvertPrompt('player', csd)
      const resp = await window.api.llm.adaptCsd(prompt).catch((err: any) => ({ ok: false, error: err?.message ?? 'adapt failed' }))
      if (!resp?.ok || !resp.csd) {
        setAdaptStatus({ kind: 'error', message: `Adapt failed: ${resp?.error ?? 'unknown'}` })
        return
      }
      csd = resp.csd
    }

    // Publish to the editor store so hasCsd / hasP4 / keyboard visibility update.
    setCsdContent(csd)

    setAdaptStatus({ kind: 'compiling' })
    try {
      const { path } = await window.api.csound.writeCsd(csd)
      const compile = await window.api.csound.compile(path)
      if (!compile.success) {
        setAdaptStatus({ kind: 'error', message: `Compile error: ${String(compile.error ?? '').slice(0, 240)}` })
        return
      }
      setAdaptStatus({ kind: 'ready' })
      setPlaying(true)
      const res = await window.api.csound.play(path)
      if (!res.success) {
        setAdaptStatus({ kind: 'error', message: `Playback error: ${String(res.error ?? '').slice(0, 240)}` })
      }
    } catch (err: any) {
      setAdaptStatus({ kind: 'error', message: err?.message ?? 'Unexpected error' })
    }
  }, [setCsdContent, setPlaying])

  const handleFile = useCallback(async (file: File) => {
    setAdaptStatus({ kind: 'reading' })
    try {
      const text = await file.text()
      if (!text.trim()) {
        setAdaptStatus({ kind: 'error', message: 'File is empty' })
        return
      }
      await loadAndPlayCsd(text)
    } catch (err: any) {
      setAdaptStatus({ kind: 'error', message: err?.message ?? 'Failed to read file' })
    }
  }, [loadAndPlayCsd])

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }, [handleFile])

  const onPickFile = useCallback(() => fileInputRef.current?.click(), [])

  const hasCsd = csdContent.trim().length > 0
  const hasP4 = csdContent.includes('p4')

  const adaptLabel =
    adaptStatus.kind === 'reading'   ? 'Reading CSD…' :
    adaptStatus.kind === 'adapting'  ? 'Adapting for Player…' :
    adaptStatus.kind === 'compiling' ? 'Compiling…' :
    adaptStatus.kind === 'ready'     ? 'Playing' :
    adaptStatus.kind === 'error'     ? adaptStatus.message :
    null

  return (
    <div
      style={{ ...styles.container, ...(dragging ? styles.containerDrag : {}) }}
      onDragOver={(e) => { e.preventDefault(); if (!dragging) setDragging(true) }}
      onDragLeave={(e) => {
        // Only clear when the drag leaves the whole container, not child elements.
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csd,text/plain"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
          e.target.value = ''
        }}
      />

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Player</h1>
        <div style={styles.headerActions}>
          <button
            onClick={onPickFile}
            style={styles.loadButton}
            disabled={adaptStatus.kind === 'reading' || adaptStatus.kind === 'adapting' || adaptStatus.kind === 'compiling'}
          >
            Load CSD
          </button>
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
        {adaptLabel ? (
          <span style={{
            ...styles.hint,
            ...(adaptStatus.kind === 'error' ? { color: '#e28a8a', fontStyle: 'normal' } : {}),
          }}>
            {adaptLabel}
          </span>
        ) : !hasCsd ? (
          <span style={styles.hint}>Drop a .csd here, or click Load CSD — the AI will adapt it</span>
        ) : null}
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
    transition: 'background 150ms ease, box-shadow 150ms ease',
  },
  containerDrag: {
    background: 'var(--accent-muted)',
    boxShadow: 'inset 0 0 0 2px var(--accent)',
  },
  loadButton: {
    padding: '6px 14px', borderRadius: 8,
    border: 'var(--border-width) solid var(--border)', background: 'transparent',
    color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600,
    letterSpacing: '0.08em', cursor: 'pointer', textTransform: 'uppercase' as const,
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
