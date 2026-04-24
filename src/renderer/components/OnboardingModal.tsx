import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { TAB_META } from '../lib/tabMeta'
import { audioFeedback } from '../styles/audio-feedback'
import { useAppStore } from '../stores/appStore'

interface Props {
  onClose: () => void
}

type Step = 'welcome' | 'tour' | 'key' | 'done'
const ORDER: Step[] = ['welcome', 'tour', 'key', 'done']

export default function OnboardingModal({ onClose }: Props) {
  const [step, setStep] = useState<Step>('welcome')
  const [googleKey, setGoogleKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [available, setAvailable] = useState<string[]>([])
  const [keyError, setKeyError] = useState('')
  const audioEnabled = useAppStore((s) => s.audioFeedbackEnabled)
  const navigate = useNavigate()

  useEffect(() => {
    window.api?.config?.getApiKeys().then((r: any) => {
      setAvailable(r?.available || [])
    }).catch(() => {})
  }, [])

  const idx = ORDER.indexOf(step)
  const next = () => {
    if (audioEnabled) audioFeedback.click()
    setStep(ORDER[Math.min(idx + 1, ORDER.length - 1)])
  }
  const back = () => {
    if (audioEnabled) audioFeedback.click()
    setStep(ORDER[Math.max(idx - 1, 0)])
  }
  const finish = () => {
    if (audioEnabled) audioFeedback.success()
    onClose()
  }

  const handleSaveKey = async () => {
    if (!googleKey.trim()) return
    setSaving(true)
    setKeyError('')
    try {
      const result = await window.api?.config?.setApiKey('google', googleKey.trim())
      if (result?.success) {
        setAvailable(result.available || [])
        setGoogleKey('')
        setStep('done')
      } else {
        setKeyError('Could not save that key. Check the format and try again.')
      }
    } catch (e) {
      setKeyError(e instanceof Error ? e.message : 'Could not save that key.')
    }
    setSaving(false)
  }

  return (
    <div style={styles.backdrop} role="dialog" aria-modal="true" aria-label="Welcome to DrC">
      <div style={styles.modal}>
        <div style={styles.progressRow}>
          {ORDER.map((s, i) => (
            <div
              key={s}
              style={{
                ...styles.progressDot,
                ...(i <= idx ? styles.progressDotActive : {}),
              }}
            />
          ))}
        </div>

        <div style={styles.body}>
          {step === 'welcome' && <Welcome />}
          {step === 'tour' && <Tour onJump={(path) => { navigate(path); }} />}
          {step === 'key' && (
            <KeyStep
              value={googleKey}
              setValue={setGoogleKey}
              onSave={handleSaveKey}
              saving={saving}
              error={keyError}
              alreadyHas={available.length > 0}
            />
          )}
          {step === 'done' && <Done />}
        </div>

        <div style={styles.footer}>
          <button
            style={{ ...styles.ghostButton, visibility: idx === 0 ? 'hidden' : 'visible' }}
            onClick={back}
          >
            Back
          </button>
          <button style={styles.skipButton} onClick={onClose}>
            Skip
          </button>
          {step === 'done' ? (
            <button style={styles.primaryButton} onClick={finish}>
              Get started
            </button>
          ) : step === 'key' ? (
            <button style={styles.ghostButton} onClick={next}>
              {available.length > 0 ? 'Next' : 'Add later'}
            </button>
          ) : (
            <button style={styles.primaryButton} onClick={next}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Welcome() {
  return (
    <div style={styles.stepBody}>
      <div style={styles.eyebrow}>Welcome</div>
      <h1 style={styles.h1}>
        <span style={{ color: 'var(--text-primary)' }}>Dr</span>
        <span style={{ color: 'var(--accent)' }}>C</span>
      </h1>
      <p style={styles.lede}>
        A studio for computer music. Chat with an agent, sculpt Csound patches, play
        them live, and explore the field&rsquo;s history — all in one place.
      </p>
      <p style={styles.body}>
        This tour takes about thirty seconds. You can skip it any time.
      </p>
    </div>
  )
}

function Tour({ onJump }: { onJump: (path: string) => void }) {
  return (
    <div style={styles.stepBody}>
      <div style={styles.eyebrow}>The five tabs</div>
      <h2 style={styles.h2}>Here is what lives where.</h2>
      <div style={styles.tourGrid}>
        {TAB_META.map((t) => (
          <button key={t.path} onClick={() => onJump(t.path)} style={styles.tabCard}>
            <div style={styles.tabCardIcon}>{t.icon}</div>
            <div style={styles.tabCardBody}>
              <div style={styles.tabCardLabel}>{t.label}</div>
              <div style={styles.tabCardDesc}>{t.long}</div>
            </div>
          </button>
        ))}
      </div>
      <p style={styles.hintLine}>Click any card to peek at that tab.</p>
    </div>
  )
}

function KeyStep({
  value, setValue, onSave, saving, error, alreadyHas,
}: {
  value: string
  setValue: (v: string) => void
  onSave: () => void
  saving: boolean
  error: string
  alreadyHas: boolean
}) {
  return (
    <div style={styles.stepBody}>
      <div style={styles.eyebrow}>One thing to set up</div>
      <h2 style={styles.h2}>Add a Google AI key.</h2>
      <p style={styles.body}>
        The agent uses <strong>Gemini 2.5 Flash</strong>, which is free. Grab a key at{' '}
        <span style={styles.codeInline}>aistudio.google.com/apikey</span> and paste it below.
        Anthropic and OpenAI keys are optional and can be added later in Settings.
      </p>

      {alreadyHas ? (
        <div style={{ ...styles.notice, borderColor: 'var(--success)' }}>
          ✓ You already have a key configured. You&rsquo;re ready to go.
        </div>
      ) : (
        <>
          <div style={styles.keyRow}>
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="AIza..."
              style={styles.input}
              onKeyDown={(e) => e.key === 'Enter' && onSave()}
              autoFocus
            />
            <button
              onClick={onSave}
              disabled={!value.trim() || saving}
              style={{ ...styles.primaryButton, opacity: !value.trim() ? 0.4 : 1 }}
            >
              {saving ? 'Saving...' : 'Save key'}
            </button>
          </div>
          {error && <div style={styles.errorLine}>{error}</div>}
          <p style={styles.hintLine}>
            Keys are stored locally on this machine only.
          </p>
        </>
      )}
    </div>
  )
}

function Done() {
  return (
    <div style={styles.stepBody}>
      <div style={styles.eyebrow}>You&rsquo;re set</div>
      <h2 style={styles.h2}>Make something.</h2>
      <p style={styles.lede}>
        Try asking the agent for a bell sound, or drop a CSD file on the Player.
        You can revisit this tour from Settings.
      </p>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 900,
    background: 'rgba(0, 0, 0, 0.55)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    animation: 'drc-fade-in 200ms ease',
  },
  modal: {
    width: 'min(720px, 96vw)',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-primary)',
    border: 'var(--border-width) solid var(--border)',
    borderRadius: 'var(--panel-radius)',
    boxShadow: 'var(--shadow-elevated)',
    overflow: 'hidden',
    animation: 'drc-splash-in 300ms ease',
  },
  progressRow: {
    display: 'flex',
    gap: 6,
    padding: '18px 28px 0',
  },
  progressDot: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    background: 'var(--border)',
    transition: 'background var(--transition-normal)',
  },
  progressDotActive: {
    background: 'var(--accent)',
  },
  body: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
  },
  stepBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: '28px 36px 8px',
    overflow: 'auto',
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  h1: {
    fontSize: 48,
    fontWeight: 300,
    letterSpacing: '0.04em',
    margin: 0,
  },
  h2: {
    fontSize: 22,
    fontWeight: 400,
    color: 'var(--text-primary)',
    letterSpacing: '0.01em',
    margin: 0,
  },
  lede: {
    fontSize: 15,
    color: 'var(--text-primary)',
    lineHeight: 1.6,
  },
  hintLine: {
    fontSize: 12,
    color: 'var(--text-muted)',
    marginTop: 4,
  },
  errorLine: {
    fontSize: 12,
    color: 'var(--warning)',
    marginTop: 4,
  },
  tourGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    marginTop: 8,
  },
  tabCard: {
    display: 'flex',
    gap: 12,
    padding: '14px 16px',
    borderRadius: 12,
    background: 'var(--bg-secondary)',
    border: 'var(--border-width) solid var(--border-subtle)',
    color: 'var(--text-primary)',
    textAlign: 'left',
    alignItems: 'flex-start',
    fontFamily: 'var(--font-primary)',
    transition: 'all var(--transition-fast)',
  },
  tabCardIcon: {
    fontSize: 20,
    color: 'var(--accent)',
    lineHeight: 1,
    marginTop: 2,
    flexShrink: 0,
    width: 24,
  },
  tabCardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  tabCardLabel: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  tabCardDesc: {
    fontSize: 12,
    color: 'var(--text-muted)',
    lineHeight: 1.5,
  },
  keyRow: {
    display: 'flex',
    gap: 8,
    marginTop: 4,
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: 10,
    border: 'var(--border-width) solid var(--border)',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    fontSize: 13,
    fontFamily: 'var(--font-mono)',
    outline: 'none',
  },
  codeInline: {
    fontFamily: 'var(--font-mono)',
    color: 'var(--accent)',
    fontSize: 13,
  },
  notice: {
    padding: '12px 16px',
    borderRadius: 10,
    border: '1.5px solid',
    background: 'var(--bg-secondary)',
    fontSize: 13,
    color: 'var(--text-primary)',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '18px 28px 22px',
    borderTop: 'var(--border-width) solid var(--border-subtle)',
    background: 'var(--bg-secondary)',
  },
  primaryButton: {
    padding: '10px 22px',
    borderRadius: 10,
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--bg-primary)',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'var(--font-primary)',
    marginLeft: 'auto',
  },
  ghostButton: {
    padding: '10px 18px',
    borderRadius: 10,
    border: 'var(--border-width) solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'var(--font-primary)',
    marginLeft: 'auto',
  },
  skipButton: {
    padding: '10px 14px',
    borderRadius: 10,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: 12,
    fontFamily: 'var(--font-primary)',
  },
}
