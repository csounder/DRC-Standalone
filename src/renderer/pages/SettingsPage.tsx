import { useState, useEffect, type CSSProperties } from 'react'
import { useAppStore } from '../stores/appStore'

export default function SettingsPage() {
  const { theme, toggleTheme, audioFeedbackEnabled, setAudioFeedback } = useAppStore()
  const [googleKey, setGoogleKey] = useState('')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [savedKeys, setSavedKeys] = useState<Record<string, string>>({})
  const [available, setAvailable] = useState<string[]>([])
  const [saving, setSaving] = useState('')
  const [testing, setTesting] = useState('')
  const [removing, setRemoving] = useState('')
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({})
  const [cabbagePath, setCabbagePath] = useState('')
  const [cabbageExists, setCabbageExists] = useState<boolean | null>(null)
  const [cabbageDetected, setCabbageDetected] = useState('')
  const [cabbageSaving, setCabbageSaving] = useState(false)

  // Load saved keys + Cabbage path on mount
  useEffect(() => {
    window.api?.config?.getApiKeys().then((result: any) => {
      setSavedKeys(result.keys || {})
      setAvailable(result.available || [])
    }).catch(() => {})
    window.api?.config?.getCabbagePath?.().then((result: any) => {
      setCabbagePath(result?.path || '')
      setCabbageExists(result?.path ? !!result?.exists : null)
      setCabbageDetected(result?.detected || '')
    }).catch(() => {})
  }, [])

  const handleSaveCabbagePath = async () => {
    setCabbageSaving(true)
    try {
      const result = await window.api?.config?.setCabbagePath?.(cabbagePath.trim())
      setCabbageExists(result?.path ? !!result?.exists : null)
    } catch {}
    setCabbageSaving(false)
  }

  const handleChooseCabbage = async () => {
    try {
      const result = await window.api?.config?.chooseCabbagePath?.()
      if (result && !result.canceled) {
        setCabbagePath(result.path || '')
        setCabbageExists(result.path ? !!result.exists : null)
      }
    } catch {}
  }

  const handleDetectCabbage = async () => {
    try {
      const result = await window.api?.config?.detectCabbage?.()
      setCabbageDetected(result?.detected || '')
    } catch {}
  }

  const handleSaveKey = async (provider: string, key: string) => {
    if (!key.trim()) return
    setSaving(provider)
    try {
      const result = await window.api?.config?.setApiKey(provider, key.trim())
      if (result?.success) {
        setAvailable(result.available || [])
        // Reload saved keys display
        const updated = await window.api?.config?.getApiKeys()
        setSavedKeys(updated?.keys || {})
        // Clear the input
        if (provider === 'google') setGoogleKey('')
        if (provider === 'anthropic') setAnthropicKey('')
        if (provider === 'openai') setOpenaiKey('')
      }
    } catch {}
    setSaving('')
  }

  const handleRemoveKey = async (provider: string) => {
    const label = provider === 'google' ? 'Google AI (Gemini)' : provider === 'anthropic' ? 'Anthropic' : 'OpenAI'
    if (!window.confirm(`Remove the saved ${label} key? You can paste a new one any time.`)) return
    setRemoving(provider)
    try {
      const result = await window.api?.config?.deleteApiKey?.(provider)
      if (result?.success) {
        setAvailable(result.available || [])
        const updated = await window.api?.config?.getApiKeys()
        setSavedKeys(updated?.keys || {})
        // Drop any stale test result for the now-removed key.
        setTestResults((prev) => {
          const nextResults = { ...prev }
          delete nextResults[provider]
          return nextResults
        })
      }
    } catch {}
    setRemoving('')
  }

  const handleTestKey = async (provider: string) => {
    setTesting(provider)
    setTestResults((prev) => {
      const next = { ...prev }
      delete next[provider]
      return next
    })
    try {
      const result = await window.api?.config?.testApiKey(provider)
      if (result) setTestResults((prev) => ({ ...prev, [provider]: result }))
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [provider]: { ok: false, message: err instanceof Error ? err.message : 'Test failed.' },
      }))
    }
    setTesting('')
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Settings</h1>

      {/* Status banner — distinguishes "saved in DRC" from "from env var" so a
          shell-exported GEMINI_API_KEY doesn't make us claim a key is set when
          the Saved row below is empty. We say "Saved", not "Connected", because
          we haven't actually verified the key with a network call — that's
          what the per-key Test button is for. */}
      {(() => {
        const savedNames = Object.keys(savedKeys)
        const envOnly = available.filter((p) => !savedNames.includes(p))
        const ok = savedNames.length > 0
        const borderColor = ok ? 'var(--success)' : (envOnly.length > 0 ? 'var(--warning)' : 'var(--warning)')
        const label = savedNames.length > 0
          ? `✓ Saved in DRC: ${savedNames.join(', ')}${envOnly.length > 0 ? ` (also detected via env: ${envOnly.join(', ')})` : ''} — click Test next to a key to verify it works`
          : envOnly.length > 0
            ? `Using API key from environment (${envOnly.join(', ')}). Save one below to override or to keep working without the env var.`
            : '⚠ No API key set — add one below to start using the agent'
        return (
          <div style={{ ...styles.statusBanner, borderColor }}>
            <span style={{ fontSize: 14 }}>{label}</span>
          </div>
        )
      })()}

      {/* Appearance */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Appearance</h2>
        <div style={styles.row}>
          <div>
            <span style={styles.label}>Theme</span>
            <span style={styles.hint}>Switch between light and dark mode</span>
          </div>
          <button onClick={toggleTheme} style={styles.toggle}>
            {theme === 'dark' ? '● Dark' : '○ Light'}
          </button>
        </div>
        <div style={styles.row}>
          <div>
            <span style={styles.label}>Audio Feedback</span>
            <span style={styles.hint}>Subtle sounds on UI interactions</span>
          </div>
          <button onClick={() => setAudioFeedback(!audioFeedbackEnabled)} style={styles.toggle}>
            {audioFeedbackEnabled ? 'On' : 'Off'}
          </button>
        </div>
        <div style={styles.row}>
          <div>
            <span style={styles.label}>Welcome Tour</span>
            <span style={styles.hint}>Replay the first-run tour</span>
          </div>
          <button
            onClick={() => window.dispatchEvent(new Event('drc:replay-onboarding'))}
            style={styles.toggle}
          >
            Replay
          </button>
        </div>
      </section>

      {/* API Keys */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>API Keys</h2>

        {/* Google / Gemini */}
        <div style={styles.keyRow}>
          <div style={styles.keyInfo}>
            <span style={styles.label}>Google AI (Gemini)</span>
            <span style={styles.hint}>
              Default — Gemini 2.5 Flash is <strong>free</strong>. Use an AI Studio key (Gemini Developer API,
              not Vertex AI) from{' '}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                style={styles.extLink}
              >
                aistudio.google.com/apikey
              </a>
            </span>
            {savedKeys.google && (
              <div style={styles.savedRow}>
                <span style={styles.savedKey}>Saved: {savedKeys.google}</span>
                <button
                  onClick={() => handleTestKey('google')}
                  disabled={testing === 'google'}
                  style={styles.testButton}
                >
                  {testing === 'google' ? 'Testing…' : 'Test'}
                </button>
                <button
                  onClick={() => handleRemoveKey('google')}
                  disabled={removing === 'google'}
                  style={styles.removeButton}
                >
                  {removing === 'google' ? 'Removing…' : 'Remove'}
                </button>
                {testResults.google && (
                  <span style={testResults.google.ok ? styles.testOk : styles.testErr}>
                    {testResults.google.ok ? '✓ ' : '✗ '}{testResults.google.message}
                  </span>
                )}
              </div>
            )}
          </div>
          <div style={styles.keyInput}>
            <input
              type="password"
              value={googleKey}
              onChange={(e) => setGoogleKey(e.target.value)}
              placeholder="AIza..."
              style={styles.input}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveKey('google', googleKey)}
            />
            <button
              onClick={() => handleSaveKey('google', googleKey)}
              disabled={!googleKey.trim() || saving === 'google'}
              style={{
                ...styles.saveButton,
                opacity: !googleKey.trim() ? 0.3 : 1,
              }}
            >
              {saving === 'google' ? '...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Anthropic */}
        <div style={styles.keyRow}>
          <div style={styles.keyInfo}>
            <span style={styles.label}>Anthropic (Claude)</span>
            <span style={styles.hint}>Optional — upgrades Complex mode to Claude Sonnet</span>
            {savedKeys.anthropic && (
              <div style={styles.savedRow}>
                <span style={styles.savedKey}>Saved: {savedKeys.anthropic}</span>
                <button
                  onClick={() => handleTestKey('anthropic')}
                  disabled={testing === 'anthropic'}
                  style={styles.testButton}
                >
                  {testing === 'anthropic' ? 'Testing…' : 'Test'}
                </button>
                <button
                  onClick={() => handleRemoveKey('anthropic')}
                  disabled={removing === 'anthropic'}
                  style={styles.removeButton}
                >
                  {removing === 'anthropic' ? 'Removing…' : 'Remove'}
                </button>
                {testResults.anthropic && (
                  <span style={testResults.anthropic.ok ? styles.testOk : styles.testErr}>
                    {testResults.anthropic.ok ? '✓ ' : '✗ '}{testResults.anthropic.message}
                  </span>
                )}
              </div>
            )}
          </div>
          <div style={styles.keyInput}>
            <input
              type="password"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder="sk-ant-..."
              style={styles.input}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveKey('anthropic', anthropicKey)}
            />
            <button
              onClick={() => handleSaveKey('anthropic', anthropicKey)}
              disabled={!anthropicKey.trim() || saving === 'anthropic'}
              style={{ ...styles.saveButton, opacity: !anthropicKey.trim() ? 0.3 : 1 }}
            >
              {saving === 'anthropic' ? '...' : 'Save'}
            </button>
          </div>
        </div>

        {/* OpenAI */}
        <div style={styles.keyRow}>
          <div style={styles.keyInfo}>
            <span style={styles.label}>OpenAI</span>
            <span style={styles.hint}>Optional — for embeddings and GPT models</span>
            {savedKeys.openai && (
              <div style={styles.savedRow}>
                <span style={styles.savedKey}>Saved: {savedKeys.openai}</span>
                <button
                  onClick={() => handleTestKey('openai')}
                  disabled={testing === 'openai'}
                  style={styles.testButton}
                >
                  {testing === 'openai' ? 'Testing…' : 'Test'}
                </button>
                <button
                  onClick={() => handleRemoveKey('openai')}
                  disabled={removing === 'openai'}
                  style={styles.removeButton}
                >
                  {removing === 'openai' ? 'Removing…' : 'Remove'}
                </button>
                {testResults.openai && (
                  <span style={testResults.openai.ok ? styles.testOk : styles.testErr}>
                    {testResults.openai.ok ? '✓ ' : '✗ '}{testResults.openai.message}
                  </span>
                )}
              </div>
            )}
          </div>
          <div style={styles.keyInput}>
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
              style={styles.input}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveKey('openai', openaiKey)}
            />
            <button
              onClick={() => handleSaveKey('openai', openaiKey)}
              disabled={!openaiKey.trim() || saving === 'openai'}
              style={{ ...styles.saveButton, opacity: !openaiKey.trim() ? 0.3 : 1 }}
            >
              {saving === 'openai' ? '...' : 'Save'}
            </button>
          </div>
        </div>
      </section>

      {/* Cabbage */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Cabbage</h2>
        <div style={styles.keyRow}>
          <div style={styles.keyInfo}>
            <span style={styles.label}>Cabbage App</span>
            <span style={styles.hint}>
              Where "Open in Cabbage" launches your plugin. We try to find it automatically;
              set it here if that misses.
            </span>
            {/* What we'll actually use, in priority order: explicit choice → auto-detected → nothing. */}
            {cabbagePath ? (
              <span style={cabbageExists === false ? styles.testErr : styles.testOk}>
                {cabbageExists === false ? `✗ Not found: ${cabbagePath}` : `✓ Using: ${cabbagePath}`}
              </span>
            ) : cabbageDetected ? (
              <span style={styles.testOk}>✓ Auto-detected: {cabbageDetected}</span>
            ) : (
              <span style={styles.testErr}>
                No Cabbage found automatically — choose it below, or install Cabbage and re-scan.
              </span>
            )}
          </div>
          <div style={styles.keyInput}>
            <button onClick={handleChooseCabbage} style={styles.saveButton}>
              Choose Cabbage…
            </button>
            {!cabbagePath && (
              <button onClick={handleDetectCabbage} style={styles.testButton}>
                Re-scan
              </button>
            )}
          </div>
        </div>

        {/* Power-user fallback: type/paste an exact path. */}
        <div style={styles.keyInput}>
          <input
            type="text"
            value={cabbagePath}
            onChange={(e) => setCabbagePath(e.target.value)}
            placeholder="/Applications/CabbagePro.app (or leave blank to auto-detect)"
            style={styles.input}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveCabbagePath()}
          />
          <button onClick={handleSaveCabbagePath} disabled={cabbageSaving} style={styles.saveButton}>
            {cabbageSaving ? '...' : 'Save'}
          </button>
        </div>
      </section>

    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  container: { height: '100%', overflow: 'auto', padding: '40px 60px', maxWidth: 720 },
  title: { fontSize: 28, fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '0.04em', marginBottom: 24 },
  statusBanner: {
    padding: '12px 18px', borderRadius: 12, border: '1.5px solid',
    background: 'var(--bg-secondary)', marginBottom: 32,
  },
  section: { marginBottom: 36 },
  sectionTitle: {
    fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-muted)',
    textTransform: 'uppercase', marginBottom: 16, paddingBottom: 8,
    borderBottom: 'var(--border-width) solid var(--border-subtle)',
  },
  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 0', gap: 24,
  },
  keyRow: {
    padding: '16px 0', borderBottom: '1px solid var(--border-subtle)',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  keyInfo: { display: 'flex', flexDirection: 'column', gap: 2 },
  keyInput: { display: 'flex', gap: 8 },
  label: { display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 },
  hint: { display: 'block', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 },
  savedKey: {
    display: 'block', fontSize: 11, color: 'var(--success)', fontFamily: 'var(--font-mono)',
  },
  savedRow: {
    display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap',
  },
  testButton: {
    padding: '3px 10px', borderRadius: 6, border: 'var(--border-width) solid var(--border)',
    background: 'transparent', color: 'var(--text-secondary)', fontSize: 11,
    fontFamily: 'var(--font-primary)', cursor: 'pointer',
  },
  removeButton: {
    padding: '3px 10px', borderRadius: 6, border: 'var(--border-width) solid var(--border)',
    background: 'transparent', color: 'var(--warning)', fontSize: 11,
    fontFamily: 'var(--font-primary)', cursor: 'pointer',
  },
  extLink: {
    color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer',
  },
  testOk: { fontSize: 11, color: 'var(--success)' },
  testErr: { fontSize: 11, color: 'var(--warning)', lineHeight: 1.4 },
  toggle: {
    padding: '6px 16px', borderRadius: 8, border: 'var(--border-width) solid var(--border)',
    background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: 13,
    fontWeight: 500, fontFamily: 'var(--font-primary)', minWidth: 80, cursor: 'pointer',
  },
  input: {
    flex: 1, padding: '8px 12px', borderRadius: 8,
    border: 'var(--border-width) solid var(--border)', background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none',
  },
  saveButton: {
    padding: '8px 18px', borderRadius: 8, border: 'none',
    background: 'var(--accent)', color: 'var(--bg-primary)', fontSize: 13,
    fontWeight: 500, fontFamily: 'var(--font-primary)', cursor: 'pointer',
    flexShrink: 0,
  },
}
