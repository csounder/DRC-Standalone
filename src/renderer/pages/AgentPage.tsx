import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useSessionStore, type AgentMode, type Message } from '../stores/sessionStore'
import { useArtifactStore, primaryContent, type Artifact } from '../stores/artifactStore'
import ArtifactPanel from '../components/artifacts/ArtifactPanel'
import ArtifactCard from '../components/chat/ArtifactCard'
import { audioFeedback } from '../styles/audio-feedback'
import { useAppStore } from '../stores/appStore'

const MODE_INFO: Record<AgentMode, { label: string; color: string }> = {
  csound: { label: 'Complex', color: '#7cb8a4' },
  'csound-sine': { label: 'Sine', color: '#f0b27a' },
  sketch: { label: 'Sketch', color: '#c5a3d9' },
}

import type { ArtifactType } from '../stores/artifactStore'

// Detect artifact type and extract content from LLM response
function detectArtifact(content: string): { type: ArtifactType; code: string } | null {
  // Web App: full HTML document
  const htmlMatch = content.match(/<!DOCTYPE html>[\s\S]*?<\/html>/i)
    || content.match(/```html\s*\n(<!DOCTYPE html>[\s\S]*?<\/html>)\s*\n```/i)
  if (htmlMatch) return { type: 'webapp', code: htmlMatch[1] || htmlMatch[0] }

  // VST: CSD with Cabbage section
  const cabMatch = content.match(/<Cabbage>[\s\S]*?<\/Cabbage>[\s\S]*?<CsoundSynthesizer>[\s\S]*?<\/CsoundSynthesizer>/i)
    || content.match(/<CsoundSynthesizer>[\s\S]*?<Cabbage>[\s\S]*?<\/Cabbage>[\s\S]*?<\/CsoundSynthesizer>/i)
  if (cabMatch) return { type: 'vst', code: cabMatch[0] }

  // CSD: plain Csound
  const csdMatch = content.match(/<CsoundSynthesizer>[\s\S]*?<\/CsoundSynthesizer>/i)
  if (csdMatch) return { type: 'csd', code: csdMatch[0] }

  return null
}

function stripArtifactCode(content: string): string {
  return content
    .replace(/```(?:html|csound|csd)?\s*\n?<!DOCTYPE html>[\s\S]*?<\/html>\s*\n?```/gi, '')
    .replace(/```(?:csound|csd)?\s*\n?<CsoundSynthesizer>[\s\S]*?<\/CsoundSynthesizer>\s*\n?```/gi, '')
    .replace(/<!DOCTYPE html>[\s\S]*?<\/html>/gi, '')
    .replace(/<Cabbage>[\s\S]*?<\/Cabbage>[\s\S]*?<CsoundSynthesizer>[\s\S]*?<\/CsoundSynthesizer>/gi, '')
    .replace(/<CsoundSynthesizer>[\s\S]*?<\/CsoundSynthesizer>/gi, '')
    .trim()
}

function deriveTitle(code: string, type: ArtifactType, userPrompt: string): string {
  if (type === 'webapp') {
    const titleMatch = code.match(/<title>(.*?)<\/title>/i)
    if (titleMatch) return titleMatch[1].replace(/\s*[—\-|].*/,'').trim()
  }
  const commentMatch = code.match(/;\s*(.{3,40})\n/)
  if (commentMatch) return commentMatch[1].trim()
  return userPrompt.split(/\s+/).slice(0, 4).join(' ') || 'Untitled'
}

export default function AgentPage() {
  const [input, setInput] = useState('')
  const [lastUserPrompt, setLastUserPrompt] = useState('')
  const [playingArtifactId, setPlayingArtifactId] = useState<string | null>(null)
  const [providersAvailable, setProvidersAvailable] = useState<string[] | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { messages, agentMode, setAgentMode, isStreaming, addMessage, setStreaming, setSessionID, sessionID } = useSessionStore()
  const { artifacts, panelOpen, addArtifact, setActive } = useArtifactStore()
  const audioEnabled = useAppStore((s) => s.audioFeedbackEnabled)

  useEffect(() => {
    window.api?.config?.getApiKeys().then((r: any) => {
      setProvidersAvailable(r?.available ?? [])
    }).catch(() => setProvidersAvailable([]))
  }, [messages.length])

  // Map message IDs to artifact IDs for rendering
  const [msgArtifactMap, setMsgArtifactMap] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-detect artifacts in new assistant messages
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'assistant' || isStreaming) return
    if (msgArtifactMap.has(last.id)) return

    const detected = detectArtifact(last.content)
    if (!detected) return

    const title = deriveTitle(detected.code, detected.type, lastUserPrompt)
    const artifact = addArtifact({ type: detected.type, title, content: detected.code })

    setMsgArtifactMap((prev) => new Map(prev).set(last.id, artifact.id))

    // Auto-play CSD artifacts
    if (detected.type === 'csd') {
      autoPlay(detected.code)
    }
  }, [messages, isStreaming])

  // Send a conversion prompt to the LLM
  const requestConversion = useCallback(async (targetType: 'webapp' | 'vst' | 'csd') => {
    const active = useArtifactStore.getState().getActive()
    if (!active) return
    const sourceCode = primaryContent(active)

    const prompt =
      targetType === 'webapp'
        ? `Convert this into a complete web app. Output a full <!DOCTYPE html> document with dark theme (#111110 bg), interactive knobs for all k-rate parameters, a play/stop button, and waveform visualization. Use @csound/browser from CDN. Embed this source:\n\n${sourceCode}`
        : targetType === 'vst'
        ? `Convert this into a Cabbage VST/AU plugin. Add a <Cabbage> section before <CsoundSynthesizer> with auto-generated rslider widgets for all k-rate parameters, a keyboard widget if it uses p4, and appropriate groupbox layout. Here's the source:\n\n${sourceCode}`
        : `Extract just the <CsoundSynthesizer>…</CsoundSynthesizer> from this project as a standalone CSD instrument — no Cabbage section, no HTML shell. Here's the source:\n\n${sourceCode}`

    setInput('')
    addMessage({ id: `msg_${Date.now()}`, role: 'user', content: prompt, timestamp: Date.now() })
    setLastUserPrompt(prompt)
    setStreaming(true)

    try {
      if (window.api?.session) {
        let sid = sessionID
        if (!sid) {
          const session = await window.api.session.create(agentMode)
          sid = session.id
          setSessionID(sid)
        }
        await window.api.session.send(sid, prompt)
      }
    } catch (err: any) {
      addMessage({ id: `msg_${Date.now()}`, role: 'assistant', content: `Error: ${err.message}`, timestamp: Date.now() })
      setStreaming(false)
    }
  }, [sessionID, agentMode])

  const autoPlay = useCallback(async (csd: string) => {
    if (!window.api?.csound) return
    try {
      const { path } = await window.api.csound.writeCsd(csd)
      const compile = await window.api.csound.compile(path)
      if (compile.success) {
        window.api.csound.play(path)
      }
    } catch {}
  }, [])

  const handlePlay = useCallback(async (artifact: Artifact) => {
    if (!window.api?.csound) return
    setPlayingArtifactId(artifact.id)
    try {
      const { path } = await window.api.csound.writeCsd(primaryContent(artifact))
      await window.api.csound.play(path)
    } catch {}
    setPlayingArtifactId(null)
  }, [])

  const handleStop = useCallback(async () => {
    await window.api?.csound?.stop()
    setPlayingArtifactId(null)
  }, [])

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return
    if (audioEnabled) audioFeedback.click()

    const text = input.trim()
    setLastUserPrompt(text)
    addMessage({ id: `msg_${Date.now()}`, role: 'user', content: text, timestamp: Date.now() })
    setInput('')
    setStreaming(true)

    try {
      if (window.api?.session) {
        let sid = sessionID
        if (!sid) {
          const session = await window.api.session.create(agentMode)
          sid = session.id
          setSessionID(sid)
        }
        await window.api.session.send(sid, text)
      } else {
        addMessage({ id: `msg_${Date.now()}`, role: 'assistant', content: 'Not connected — restart app.', timestamp: Date.now() })
        setStreaming(false)
      }
    } catch (err: any) {
      addMessage({ id: `msg_${Date.now()}`, role: 'assistant', content: `Error: ${err.message}`, timestamp: Date.now() })
      setStreaming(false)
    }
  }

  const renderMessage = (msg: Message) => {
    const detected = msg.role === 'assistant' ? detectArtifact(msg.content) : null
    const text = detected ? stripArtifactCode(msg.content) : msg.content
    const artifactId = msgArtifactMap.get(msg.id)
    const artifact = artifactId ? artifacts.find((a) => a.id === artifactId) : null

    if (msg.role === 'user') {
      return (
        <div key={msg.id} style={styles.userRow}>
          <div style={styles.userBubble}>
            <p style={styles.msgText}>{msg.content}</p>
          </div>
        </div>
      )
    }

    return (
      <div key={msg.id} style={styles.assistantRow}>
        <div style={styles.assistantBubble}>
          {text && <p style={styles.msgText}>{text}</p>}
          {artifact && (
            <ArtifactCard
              artifact={artifact}
              isPlaying={playingArtifactId === artifact.id}
              onClick={() => setActive(artifact.id)}
              onPlay={() => handlePlay(artifact)}
              onStop={handleStop}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      {/* Chat side */}
      <div style={styles.chatSide}>
        {messages.length === 0 ? (
          /* Landing — centered hero + input (Claude-style) */
          <div style={styles.landing}>
            {providersAvailable !== null && providersAvailable.length === 0 && (
              <div style={styles.noKeyBanner}>
                <span>No API key configured. </span>
                <Link to="/settings" style={styles.noKeyLink}>Add a free Gemini key →</Link>
              </div>
            )}
            <div style={styles.landingInner}>
              <div style={styles.logo}>
                <span style={styles.logoDr}>Dr</span><span style={styles.logoC}>C</span>
              </div>
              <p style={styles.emptyTitle}>What do you want to hear?</p>
              <p style={styles.emptyDesc}>
                Describe a sound. I'll generate a Csound instrument, play it, and open it as an artifact you can edit, export as a web app, or build into a VST plugin.
              </p>
              {inputBar(true)}
              <div style={styles.pills}>
                {[
                  'FM bell with shimmering decay',
                  'Thick analog bass with filter sweep',
                  'Granular cloud texture',
                  'Ambient generative pad',
                ].map((s) => (
                  <button key={s} onClick={() => setInput(s)} style={styles.pill}>{s}</button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Conversation — messages fill, input docked at bottom */
          <>
            <div style={styles.messages}>
              {messages.map(renderMessage)}
              {isStreaming && (
                <div style={styles.assistantRow}>
                  <div style={styles.streamingBubble}>
                    <div style={styles.dots}>
                      <span style={styles.dot} /><span style={{ ...styles.dot, animationDelay: '0.15s' }} /><span style={{ ...styles.dot, animationDelay: '0.3s' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div style={styles.inputArea}>
              {inputBar(false)}
            </div>
          </>
        )}
      </div>

      {/* Artifact panel (co-work) */}
      {panelOpen && <ArtifactPanel onConvert={requestConversion} />}
    </div>
  )

  function inputBar(centered: boolean) {
    return (
      <div style={centered ? styles.inputBlockCentered : styles.inputBlock}>
        <div style={styles.inputInner}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Describe a sound..."
            style={styles.textarea}
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            style={{ ...styles.sendBtn, opacity: !input.trim() || isStreaming ? 0.3 : 1 }}
          >↑</button>
        </div>
        <div style={styles.inputFooter}>
          <div style={styles.modeSwitch}>
            {(Object.keys(MODE_INFO) as AgentMode[]).map((m) => (
              <button key={m} onClick={() => setAgentMode(m)}
                style={{ ...styles.modeBtn, ...(agentMode === m ? { background: 'var(--bg-secondary)', color: MODE_INFO[m].color } : {}) }}>
                {MODE_INFO[m].label}
              </button>
            ))}
          </div>
          <span style={styles.hint}>Artifacts: CSD · Web App · VST</span>
        </div>
      </div>
    )
  }
}

const styles: Record<string, CSSProperties> = {
  page: { height: '100%', display: 'flex', background: 'var(--bg-primary)' },

  chatSide: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },

  messages: { flex: 1, overflow: 'auto', padding: '24px 0' },

  userRow: { display: 'flex', justifyContent: 'flex-end', padding: '3px 28px' },
  userBubble: {
    maxWidth: 560, background: 'var(--accent-muted)', borderRadius: '16px 16px 4px 16px', padding: '10px 16px',
  },

  assistantRow: { display: 'flex', padding: '3px 28px' },
  assistantBubble: { maxWidth: 640 },

  msgText: { fontSize: 14, lineHeight: 1.65, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', margin: 0 },

  streamingBubble: { padding: '12px 0' },
  dots: { display: 'flex', gap: 4 },
  dot: {
    width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', opacity: 0.5,
    animation: 'pulse 1.2s ease-in-out infinite',
  },

  landing: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', overflow: 'auto', padding: 40,
  },
  landingInner: {
    width: '100%', maxWidth: 640,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
  },
  logo: { display: 'flex', alignItems: 'baseline' },
  logoDr: { fontSize: 44, fontWeight: 600, color: 'var(--text-primary)' },
  logoC: { fontSize: 44, fontWeight: 300, color: 'var(--accent)' },
  emptyTitle: { fontSize: 18, fontWeight: 500, color: 'var(--text-primary)' },
  emptyDesc: { fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 460, lineHeight: 1.5 },
  pills: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4, maxWidth: 520 },
  pill: {
    padding: '8px 16px', borderRadius: 20, border: '1.5px solid var(--border)',
    background: 'transparent', color: 'var(--text-secondary)', fontSize: 13,
    cursor: 'pointer', fontFamily: 'var(--font-primary)', transition: 'all 150ms ease',
  },

  inputArea: {
    padding: '10px 28px 18px', borderTop: '1px solid var(--border-subtle)',
    display: 'flex', justifyContent: 'center',
  },
  inputBlock: { width: '100%', maxWidth: 720 },
  inputBlockCentered: { width: '100%', marginTop: 12 },
  inputInner: { display: 'flex', gap: 8, alignItems: 'flex-end', width: '100%' },
  textarea: {
    flex: 1, resize: 'none', border: '1.5px solid var(--border)', borderRadius: 14,
    padding: '11px 16px', fontSize: 14, fontFamily: 'var(--font-primary)',
    background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none',
    minHeight: 44, maxHeight: 160, lineHeight: 1.5,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 12, border: 'none', background: 'var(--accent)',
    color: 'var(--bg-primary)', fontSize: 18, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
  },
  inputFooter: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 6, width: '100%',
  },
  modeSwitch: {
    display: 'flex', gap: 2, background: 'var(--bg-tertiary)', borderRadius: 8, padding: 2,
  },
  modeBtn: {
    padding: '3px 10px', fontSize: 11, fontWeight: 500, letterSpacing: '0.04em',
    border: 'none', background: 'transparent', color: 'var(--text-muted)',
    borderRadius: 6, cursor: 'pointer', textTransform: 'uppercase' as const,
    fontFamily: 'var(--font-primary)',
  },
  hint: { fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' },

  noKeyBanner: {
    position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
    padding: '8px 14px',
    borderRadius: 10, border: '1.5px solid var(--warning, #f0b27a)',
    background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
    fontSize: 12, display: 'flex', gap: 8, alignItems: 'center',
  },
  noKeyLink: {
    color: 'var(--accent)', textDecoration: 'none', fontWeight: 500,
  },
}
