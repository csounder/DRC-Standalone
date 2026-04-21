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

  // Load saved keys on mount
  useEffect(() => {
    window.api?.config?.getApiKeys().then((result: any) => {
      setSavedKeys(result.keys || {})
      setAvailable(result.available || [])
    }).catch(() => {})
  }, [])

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

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Settings</h1>

      {/* Status banner */}
      <div style={{
        ...styles.statusBanner,
        borderColor: available.length > 0 ? 'var(--success)' : 'var(--warning)',
      }}>
        <span style={{ fontSize: 14 }}>
          {available.length > 0
            ? `✓ Connected: ${available.join(', ')}`
            : '⚠ No API key configured — add a key below to start using the agent'}
        </span>
      </div>

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
      </section>

      {/* API Keys */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>API Keys</h2>

        {/* Google / Gemini */}
        <div style={styles.keyRow}>
          <div style={styles.keyInfo}>
            <span style={styles.label}>Google AI (Gemini)</span>
            <span style={styles.hint}>
              Default — Gemini 2.5 Flash is <strong>free</strong>. Get a key at{' '}
              <span style={{ color: 'var(--accent)' }}>aistudio.google.com/apikey</span>
            </span>
            {savedKeys.google && (
              <span style={styles.savedKey}>Saved: {savedKeys.google}</span>
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
              <span style={styles.savedKey}>Saved: {savedKeys.anthropic}</span>
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
              <span style={styles.savedKey}>Saved: {savedKeys.openai}</span>
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

      {/* Csound */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Csound</h2>
        <div style={styles.row}>
          <div>
            <span style={styles.label}>Csound Path</span>
            <span style={styles.hint}>Auto-detected if on PATH</span>
          </div>
          <input type="text" placeholder="/usr/local/bin/csound" style={styles.input} />
        </div>
      </section>

      {/* Profile */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Profile</h2>
        <div style={styles.row}>
          <div>
            <span style={styles.label}>Expertise Level</span>
            <span style={styles.hint}>Adjusts agent explanations and complexity</span>
          </div>
          <select style={styles.select}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div style={styles.row}>
          <div>
            <span style={styles.label}>Narration</span>
            <span style={styles.hint}>Computer music history context during sessions</span>
          </div>
          <select style={styles.select}>
            <option value="off">Off</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
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
    marginTop: 4,
  },
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
  select: {
    padding: '6px 12px', borderRadius: 8, border: 'var(--border-width) solid var(--border)',
    background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13,
    fontFamily: 'var(--font-primary)', outline: 'none', minWidth: 140,
  },
}
