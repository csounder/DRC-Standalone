import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useAppStore } from '../stores/appStore'

// C major seventh voicing — same palette as the audio-feedback module,
// but a longer, held chord for the intro. Plays once on first paint, fades
// with the visual. Fully synthesized, no audio assets.
const CHORD = [130.81, 196.0, 261.63, 329.63, 392.0] // C3, G3, C4, E4, G4

function playSplashChord(): void {
  try {
    const ctx = new AudioContext()
    const master = ctx.createGain()
    master.gain.setValueAtTime(0, ctx.currentTime)
    master.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.4)
    master.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.2)
    master.connect(ctx.destination)

    CHORD.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const voice = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      voice.gain.value = 0.25 / Math.max(1, i * 0.6)
      osc.connect(voice)
      voice.connect(master)
      osc.start(ctx.currentTime + i * 0.04)
      osc.stop(ctx.currentTime + 2.4)
    })

    setTimeout(() => ctx.close().catch(() => {}), 2600)
  } catch {}
}

interface Props {
  onDone: () => void
}

export default function SplashScreen({ onDone }: Props) {
  const audioEnabled = useAppStore((s) => s.audioFeedbackEnabled)
  const [fading, setFading] = useState(false)
  const doneRef = useRef(false)

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    setFading(true)
    setTimeout(onDone, 400)
  }

  useEffect(() => {
    if (audioEnabled) playSplashChord()
    const t = setTimeout(finish, 2000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = () => finish()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      style={{ ...styles.overlay, opacity: fading ? 0 : 1 }}
      onClick={finish}
      role="presentation"
    >
      <div style={styles.center}>
        <div style={styles.markRow}>
          <span style={styles.mark}>Dr</span>
          <span style={styles.markAccent}>C</span>
        </div>
        <div style={styles.subtitle}>A studio for computer music.</div>
        <div style={styles.pulse} aria-hidden />
      </div>
      <div style={styles.skipHint}>click or press any key to skip</div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-primary)',
    transition: 'opacity 400ms ease',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
    animation: 'drc-splash-in 900ms ease forwards',
  },
  markRow: { display: 'flex', alignItems: 'baseline' },
  mark: {
    fontFamily: 'var(--font-primary)',
    fontSize: 72,
    fontWeight: 300,
    color: 'var(--text-primary)',
    letterSpacing: '0.04em',
  },
  markAccent: {
    fontFamily: 'var(--font-primary)',
    fontSize: 72,
    fontWeight: 300,
    color: 'var(--accent)',
    letterSpacing: '0.04em',
  },
  subtitle: {
    fontSize: 13,
    color: 'var(--text-muted)',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  pulse: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--accent)',
    animation: 'drc-pulse 1.6s ease-in-out infinite',
    marginTop: 8,
  },
  skipHint: {
    position: 'absolute',
    bottom: 32,
    fontSize: 11,
    color: 'var(--text-muted)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    opacity: 0.6,
  },
}
