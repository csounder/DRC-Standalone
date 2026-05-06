import { useState, useCallback, useRef, useMemo, useEffect, type CSSProperties, type DragEvent } from 'react'
import { usePlayerStore } from '../stores/playerStore'
import { useEditorStore } from '../stores/editorStore'
import Knob from '../components/player/Knob'
import PianoKeyboard from '../components/player/PianoKeyboard'
import WaveformDisplay from '../components/player/WaveformDisplay'
import { audioFeedback } from '../styles/audio-feedback'
import { useAppStore } from '../stores/appStore'
import { buildConvertPrompt, needsPlayerAdapt } from '../prompts/convert'
import { parseChannels, LEGACY_CHANNELS, type ChannelSpec } from '../lib/parseChannels'
import { useMidi } from '../lib/useMidi'
import { useMidiStore } from '../stores/midiStore'

type AdaptStatus =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'adapting' }
  | { kind: 'compiling' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string }

export default function PlayerPage() {
  const { isPlaying, currentTime, duration, setPlaying, channels, setChannel } = usePlayerStore()
  const { csdContent, setCsdContent } = useEditorStore()
  const audioEnabled = useAppStore((s) => s.audioFeedbackEnabled)
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set())
  // Source-of-truth set used by note handlers — synchronous dedupe avoids
  // double-trigger on browser keydown autorepeat or simultaneous touch+mouse.
  const activeNotesRef = useRef<Set<number>>(new Set())
  // The CSD declares its own knobs via `chn_k`; we re-parse on every CSD change
  // and merge with prior values so live tweaks survive an identical reload.
  const channelSpecs = useMemo<ChannelSpec[]>(() => {
    const parsed = parseChannels(csdContent)
    return parsed.length > 0 ? parsed : LEGACY_CHANNELS
  }, [csdContent])
  const [paramValues, setParamValues] = useState<Record<string, number>>(() => {
    const seed: Record<string, number> = {}
    for (const c of channelSpecs) seed[c.name] = c.default
    return seed
  })
  // When the spec changes (new CSD adapted), seed any new channels to their
  // declared default and drop bindings for channels that no longer exist.
  useEffect(() => {
    setParamValues((prev) => {
      const next: Record<string, number> = {}
      for (const c of channelSpecs) {
        next[c.name] = prev[c.name] ?? c.default
      }
      return next
    })
  }, [channelSpecs])
  const [adaptStatus, setAdaptStatus] = useState<AdaptStatus>({ kind: 'idle' })
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Build the fractional p1 the score event uses for a held note. Three-digit
  // padded MIDI ensures we get unique tags (1.069 ≠ 1.070), and `i -1.069 0 0`
  // hits exactly the instance to release. The voice's linsegr handles the tail.
  const tagFor = (midi: number) => `1.${midi.toString().padStart(3, '0')}`

  const handleNoteOn = useCallback((midi: number, velocity = 0.8) => {
    if (activeNotesRef.current.has(midi)) return
    activeNotesRef.current.add(midi)
    setActiveNotes((prev) => new Set(prev).add(midi))
    if (audioEnabled) audioFeedback.click()
    const hz = 440 * Math.pow(2, (midi - 69) / 12)
    const tag = tagFor(midi)
    // p3 = -1: indefinite duration. The matching i -1.NNN call below ends it.
    void window.api?.csound?.event(`i ${tag} 0 -1 ${hz.toFixed(3)} ${velocity.toFixed(3)}`)
  }, [audioEnabled])

  const handleNoteOff = useCallback((midi: number) => {
    if (!activeNotesRef.current.has(midi)) return
    activeNotesRef.current.delete(midi)
    setActiveNotes((prev) => {
      const next = new Set(prev)
      next.delete(midi)
      return next
    })
    const tag = tagFor(midi)
    // Negative p1 of the same fractional tag fires linsegr's release segment
    // and turns off that specific instance once the tail completes.
    void window.api?.csound?.event(`i -${tag} 0 0`)
  }, [])

  const handleParamChange = useCallback((spec: ChannelSpec, value: number) => {
    setParamValues((prev) => ({ ...prev, [spec.name]: value }))
    setChannel(spec.name, value)
    void window.api?.csound?.setChannel(spec.name, value)
  }, [setChannel])

  // Wire Web MIDI: noteOn/Off reuse the on-screen keyboard handlers, and CCs
  // are routed through MIDI Learn — when a knob is armed (`learnTarget` set),
  // the next CC binds to it; otherwise CC values scale across the bound spec's
  // [min, max] and get pushed via setChannel like any other knob move.
  const midiEnabled    = useMidiStore((s) => s.enabled)
  const midiStatus     = useMidiStore((s) => s.status)
  const midiInputs     = useMidiStore((s) => s.inputs)
  const midiBindings   = useMidiStore((s) => s.bindings)
  const learnTarget    = useMidiStore((s) => s.learnTarget)
  const startLearn     = useMidiStore((s) => s.startLearn)
  const cancelLearn    = useMidiStore((s) => s.cancelLearn)
  const setMidiEnabled = useMidiStore((s) => s.setEnabled)

  const handleCCBinding = useCallback((channelName: string, normalized01: number) => {
    // Bindings persist in localStorage but channelSpecs is per-CSD. After a
    // re-adapt or load, an old binding can reference a channel name that no
    // longer exists (or differs only in case). Try exact, then case-insensitive,
    // then surface the miss so the user sees *why* the bound knob did nothing
    // rather than silently swallowing every CC.
    let spec = channelSpecs.find((c) => c.name === channelName)
    if (!spec) {
      const lc = channelName.toLowerCase()
      spec = channelSpecs.find((c) => c.name.toLowerCase() === lc)
    }
    if (!spec) {
      // eslint-disable-next-line no-console
      console.warn(
        `[midi] CC for "${channelName}" arrived but no chn_k channel matches — current patch declares: ${channelSpecs.map((c) => c.name).join(', ') || '(none)'}`,
      )
      return
    }
    // Map 0..1 across the spec's range. Exponential curves map log-spaced so a
    // mid-position knob lands musically (e.g. 632 Hz on a 20..20000 cutoff).
    let value: number
    if (spec.curve === 'exp' && spec.min > 0) {
      value = spec.min * Math.pow(spec.max / spec.min, normalized01)
    } else if (spec.curve === 'int') {
      value = Math.round(spec.min + (spec.max - spec.min) * normalized01)
    } else {
      value = spec.min + (spec.max - spec.min) * normalized01
    }
    handleParamChange(spec, value)
  }, [channelSpecs, handleParamChange])

  useMidi({ onNoteOn: handleNoteOn, onNoteOff: handleNoteOff }, handleCCBinding)

  const ccLabelFor = (channel: string): string | null => {
    for (const k of Object.keys(midiBindings)) {
      const b = midiBindings[k]
      if (b.channel === channel) return `CC ${b.cc}`
    }
    return null
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
            onClick={() => setMidiEnabled(!midiEnabled)}
            title={
              !midiEnabled       ? 'Enable physical MIDI input'        :
              midiStatus === 'denied'      ? 'MIDI access denied — check OS permissions' :
              midiStatus === 'unsupported' ? 'Web MIDI unavailable in this build'        :
              midiInputs.length === 0      ? 'MIDI on (no input devices)'                :
              `MIDI on — ${midiInputs.map((i) => i.name).join(', ')}`
            }
            style={{
              ...styles.loadButton,
              ...(midiEnabled ? styles.midiActive : {}),
            }}
          >
            MIDI {midiEnabled
              ? (midiStatus === 'ready' ? `(${midiInputs.length})` : midiStatus === 'requesting' ? '…' : '!')
              : 'off'}
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

      {/* Parameters — built from chn_k declarations in the CSD */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          Parameters
          {channelSpecs.length > 0 && channelSpecs !== LEGACY_CHANNELS ? null : (
            <span style={styles.sectionHint}> — defaults (CSD has no chn_k declarations)</span>
          )}
        </h3>
        <div style={styles.knobGrid}>
          {channelSpecs.map((spec) => (
            <Knob
              key={spec.name}
              label={spec.label}
              value={paramValues[spec.name] ?? spec.default}
              min={spec.min}
              max={spec.max}
              step={spec.step}
              unit={spec.unit}
              onChange={(val) => handleParamChange(spec, val)}
              ccLabel={midiEnabled ? ccLabelFor(spec.name) : null}
              isLearning={midiEnabled && learnTarget === spec.name}
              onToggleLearn={
                midiEnabled
                  ? () => (learnTarget === spec.name ? cancelLearn() : startLearn(spec.name))
                  : undefined
              }
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
  midiActive: { borderColor: 'var(--accent)', color: 'var(--accent)' },
  header: {
    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { fontSize: 28, fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '0.04em' },
  headerActions: { display: 'flex', gap: 8 },
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
