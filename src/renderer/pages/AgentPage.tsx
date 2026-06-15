import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useSessionStore, type AgentMode, type Message } from '../stores/sessionStore'
import { useArtifactStore, primaryContent, type Artifact } from '../stores/artifactStore'
import ArtifactPanel from '../components/artifacts/ArtifactPanel'
import ArtifactCard from '../components/chat/ArtifactCard'
import MessageFeedback from '../components/chat/MessageFeedback'
import ProfileBadge from '../components/chat/ProfileBadge'
import SessionHistory from '../components/chat/SessionHistory'
import { audioFeedback } from '../styles/audio-feedback'
import { useAppStore } from '../stores/appStore'
import { detect, stripArtifact, deriveTitle } from '../lib/artifactDetect'
import { buildConvertPrompt, detectConvertIntent, type ConvertTarget } from '../prompts/convert'
import { playArtifact, stopPlayback, resetAutofix } from '../lib/playback'
import { usePlaybackStore } from '../stores/playbackStore'
import { wrapWithArtifactContext } from '../lib/artifactContext'
import { parseChannels, extractOrchestra, usesKeyboard } from '../lib/parseChannels'
import { buildWebApp } from '../lib/webHarness'
import { compileCheckCsd } from '../lib/playback'

// Strip a stray leading web-app wrapper so a fresh turn's CSD can be recovered.
const DOCTYPE_RE = /<!DOCTYPE\s+html\s*>/gi
const HTML_FENCE_RE = /```(?:html|HTML)\s*\n/g

const MODE_INFO: Record<AgentMode, { label: string; color: string }> = {
  csound: { label: 'Complex', color: '#7cb8a4' },
  'csound-sine': { label: 'Sine', color: '#f0b27a' },
}

// Strip emojis and the simplest markdown so the chat bubble reads as plain prose
// no matter what the model tried. Headings / lists collapse to their label text.
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{2300}-\u{23FF}]/gu
function cleanChatText(text: string): string {
  return text
    .replace(EMOJI_RE, '')
    .replace(/```[\s\S]*?```/g, '')               // fenced code blocks
    .replace(/`([^`]+)`/g, '$1')                   // inline code
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')           // atx headings
    .replace(/\*\*([^*]+)\*\*/g, '$1')             // bold
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,;:!?])/g, '$1$2') // italics
    .replace(/^[ \t]*[-*+][ \t]+/gm, '')          // bullet markers
    .replace(/^[ \t]*\d+\.[ \t]+/gm, '')          // ordered list markers
    .replace(/\s*[—–]\s*/g, ', ')                  // em/en dashes -> comma (backstop)
    .replace(/\n{3,}/g, '\n\n')                    // collapse big gaps
    .trim()
}

export default function AgentPage() {
  const [input, setInput] = useState('')
  const [lastUserPrompt, setLastUserPrompt] = useState('')
  const [providersAvailable, setProvidersAvailable] = useState<string[] | null>(null)
  const playingArtifactId = usePlaybackStore((s) => s.artifactId)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { messages, agentMode, setAgentMode, isStreaming, addMessage, setStreaming, setSessionID, sessionID, startNewSession, clearMessages } = useSessionStore()
  const [historyOpen, setHistoryOpen] = useState(false)
  const { artifacts, panelOpen, addArtifact, updatePrimary, updateInPlace, setActive } = useArtifactStore()
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

  // Live artifact detection — runs on every content change (including during streaming).
  // First detection creates the artifact; subsequent updates mutate it in place.
  // When streaming completes and the artifact is a fresh CSD, autoplay it once.
  const autoPlayedRef = useRef<Set<string>>(new Set())
  // The artifact version a follow-up edit should branch from — the one loaded in
  // the panel at send time, not necessarily the newest. Set in handleSend.
  const editBaseRef = useRef<string | null>(null)
  // When a "Convert to Web App" is in flight, the model streams back an adapted
  // orchestra CSD (not HTML). We suppress the normal CSD-artifact path for that
  // ONE turn and, on completion, deterministically wrap the orchestra into a web
  // app via buildWebApp. The flag is consumed (cleared) the moment that turn is
  // handled, so it can never leak into a later, unrelated generation.
  // `editBaseId` is set when this turn is a FOLLOW-UP edit of an existing web app
  // (vs a first-time conversion): the rebuilt web app becomes a new VERSION of that
  // artifact rather than a brand-new one.
  const pendingWebappConvertRef = useRef<{ title: string; editBaseId?: string } | null>(null)
  // True only on a turn that explicitly requested a format conversion. A fresh
  // generation leaves it false, so a stray DOCTYPE is never made a webapp/vst.
  const convertTurnRef = useRef<boolean>(false)
  useEffect(() => {
    // Look for the most recent non-narration assistant message. Narration messages
    // are ambient context and never contain artifacts.
    let last: Message | null = null
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.role === 'assistant' && m.type !== 'narration') { last = m; break }
    }
    if (!last) return

    const detected = detect(last.content)
    if (!detected) return

    // Convert-to-Web-App: the model emits an adapted orchestra CSD, not HTML. We
    // own the UI, so suppress the CSD artifact while it streams; on completion
    // wrap the orchestra into a web app deterministically. Consumed in this one
    // turn — the flag is cleared here so it never affects a later generation.
    const pendingConvert = pendingWebappConvertRef.current
    if (pendingConvert && detected.type === 'csd') {
      if (isStreaming) return            // wait for the full orchestra
      const csd = detected.code
      const title = pendingConvert.title || deriveTitle(csd, 'csd', lastUserPrompt)
      const editBaseId = pendingConvert.editBaseId
      pendingWebappConvertRef.current = null
      void (async () => {
        const compileCheck = await compileCheckCsd(csd)
        if (!compileCheck.ok) return
        const orc = extractOrchestra(csd)
        const html = buildWebApp({
          orc,
          channels: parseChannels(csd),
          title,
          hasKeyboard: usesKeyboard(orc),
          hasReverbBus: /\binstr\s+99\b/.test(orc),
        })
        const artifact = editBaseId
          ? updatePrimary(editBaseId, html, last!.id)
          : addArtifact({ type: 'webapp', title, content: html, sourceMessageId: last!.id })
        setMsgArtifactMap((prev) => new Map(prev).set(last!.id, artifact.id))
        setActive(artifact.id)
      })()
      return
    }

    let existingId = msgArtifactMap.get(last.id)
    if (!existingId) {
      // Re-adopt an artifact already built for this message in a previous mount.
      // The store survives navigation but our local map doesn't, so without this
      // a remount would re-derive a brand-new artifact from the message text —
      // and for converted web apps that text is an orchestra CSD, not the HTML,
      // so it would clobber the web app with a spurious CSD version.
      const adopted = useArtifactStore.getState().artifacts.find((a) => a.sourceMessageId === last.id)
      if (adopted) {
        setMsgArtifactMap((prev) => new Map(prev).set(last.id, adopted.id))
        return
      }
      // Fresh-turn guard: a non-conversion generation must be a CSD. A stray
      // DOCTYPE/HTML outranks the CSD in findStart, so without this a model that
      // wrongly emits a web app on a first turn would render as a webapp. Refuse
      // it; recover an embedded CSD if the message has one, else ignore the turn.
      if (!convertTurnRef.current && detected.type !== 'csd') {
        if (!isStreaming) {
          const stripped = last.content.replace(DOCTYPE_RE, '').replace(HTML_FENCE_RE, '')
          const csdFallback = detect(stripped)
          if (csdFallback && csdFallback.type === 'csd') {
            const t = deriveTitle(csdFallback.code, 'csd', lastUserPrompt)
            const a = addArtifact({ type: 'csd', title: t, content: csdFallback.code, sourceMessageId: last.id })
            setMsgArtifactMap((prev) => new Map(prev).set(last.id, a.id))
          }
        }
        return
      }
      // If this turn was an edit of the artifact loaded in the panel, branch the
      // new version from THAT version (same title/lineage), not the newest one.
      const base = editBaseRef.current
        ? useArtifactStore.getState().artifacts.find((a) => a.id === editBaseRef.current)
        : null
      if (base && base.type === detected.type) {
        const artifact = updatePrimary(base.id, detected.code, last.id)
        setMsgArtifactMap((prev) => new Map(prev).set(last.id, artifact.id))
        editBaseRef.current = null
        return
      }
      const title = deriveTitle(detected.code, detected.type, lastUserPrompt)
      const artifact = addArtifact({ type: detected.type, title, content: detected.code, sourceMessageId: last.id })
      setMsgArtifactMap((prev) => new Map(prev).set(last.id, artifact.id))
      return
    }

    // Never overwrite an artifact whose type no longer matches the message text
    // (e.g. a converted web app derived from an orchestra-CSD message). The
    // message isn't the source of truth for those, so re-deriving would corrupt it.
    const existing = useArtifactStore.getState().artifacts.find((a) => a.id === existingId)
    if (existing && existing.type !== detected.type) return

    updateInPlace(existingId, detected.code)

    if (!isStreaming && detected.complete && detected.type === 'csd' && !autoPlayedRef.current.has(last.id)) {
      autoPlayedRef.current.add(last.id)
      const artifact = useArtifactStore.getState().artifacts.find((a) => a.id === existingId)
      if (artifact) void playArtifact(artifact)
    }
  }, [messages, isStreaming])

  // Send a conversion prompt to the LLM
  const requestConversion = useCallback(async (targetType: ConvertTarget) => {
    const active = useArtifactStore.getState().getActive()
    if (!active) return

    const prompt = buildConvertPrompt(targetType, primaryContent(active))
    const shortLabel =
      targetType === 'webapp' ? 'Convert to Web App' :
      targetType === 'vst' ? 'Convert to Cabbage' :
      'Extract standalone CSD'

    // The webapp conversion now returns an orchestra CSD that we wrap ourselves
    // (see the detection effect). Mark the turn so it's intercepted.
    pendingWebappConvertRef.current = targetType === 'webapp' ? { title: active.title } : null
    // Explicit conversion — the fresh-turn guard must NOT suppress the artifact.
    convertTurnRef.current = true

    setInput('')
    // Show a compact user-visible message, not the full template
    addMessage({ id: `msg_${Date.now()}`, role: 'user', content: shortLabel, timestamp: Date.now() })
    setLastUserPrompt(shortLabel)
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

  const newChat = useCallback(() => {
    void stopPlayback()
    resetAutofix(sessionID)
    startNewSession()
    // Clear ALL artifact state too — otherwise the previous session's artifact
    // stays loaded in the panel and becomes the edit base for the new session's
    // first message, so "nothing works" in what should be a clean session.
    useArtifactStore.getState().reset()
    editBaseRef.current = null
    setMsgArtifactMap(new Map())
    autoPlayedRef.current = new Set()
    pendingWebappConvertRef.current = null
    convertTurnRef.current = false
  }, [sessionID, startNewSession])

  // Reopen a persisted chat. We pre-seed autoPlayedRef with the loaded message
  // ids so restoring a session that ends in a CSD doesn't blast audio on open.
  const loadSession = useCallback(async (id: string) => {
    if (!window.api?.session) return
    const data: any = await window.api.session.get(id)
    if (!data) return
    void stopPlayback()
    resetAutofix(sessionID)
    clearMessages()
    // Drop the prior session's artifact state before loading this one, so it can't
    // leak across sessions. The artifact-detection effect rebuilds this session's
    // final artifact from its loaded messages.
    useArtifactStore.getState().reset()
    editBaseRef.current = null
    setMsgArtifactMap(new Map())
    pendingWebappConvertRef.current = null
    convertTurnRef.current = false
    setSessionID(data.id)
    if (['csound', 'csound-sine'].includes(data.agent)) setAgentMode(data.agent)
    const loaded = new Set<string>()
    for (const m of data.messages ?? []) {
      if (m.role !== 'user' && m.role !== 'assistant') continue
      addMessage({ id: m.id, role: m.role, content: m.content, timestamp: m.timestamp })
      if (m.role === 'assistant') loaded.add(m.id)
    }
    autoPlayedRef.current = loaded // suppress autoplay for restored turns
  }, [sessionID, clearMessages, setSessionID, setAgentMode, addMessage])

  const handlePlay = useCallback((artifact: Artifact) => {
    void playArtifact(artifact)
  }, [])

  const handleStop = useCallback(() => {
    void stopPlayback()
  }, [])

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || isStreaming) return
    if (audioEnabled) audioFeedback.click()

    setLastUserPrompt(text)
    resetAutofix(sessionID)  // Fresh user prompt — clear any accumulated autofix attempts.
    convertTurnRef.current = false  // default: a fresh turn is a CSD; convert branches re-set this below.
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
        // If the message is really a request to switch the open artifact to a
        // different format ("make it a web app"), route it through the same
        // proven convert template the "Convert to" button uses — otherwise the
        // preserve-format hint below would fight the switch and keep emitting
        // the current type. Plain follow-ups keep the format-preserving hint.
        const active = useArtifactStore.getState().getActive()
        const convertTo = active ? detectConvertIntent(text, active.type) : null

        let payload: string
        if (active && active.type === 'webapp' && !convertTo) {
          // CRITICAL: a follow-up on a web app must edit the underlying web-ready
          // CSD and rebuild deterministically via buildWebApp — NEVER hand the
          // generated HTML to the model. The model rewriting HTML drops the Csound
          // engine (Csound()/compileOrc/start/inputMessage) and the app becomes
          // unplayable. Recover the source CSD from the message this web app was
          // built from, re-run the webapp template with the user's note, and let
          // the detection effect re-wrap it as a new version.
          const msgs = useSessionStore.getState().messages
          const srcMsg = active.sourceMessageId
            ? msgs.find((m) => m.id === active.sourceMessageId)
            : null
          // Only usable if the source message is actually a CSD (a web app built
          // by the deterministic path). Legacy web apps whose source is HTML fall
          // back so we don't feed HTML into the orchestra template.
          const srcDet = srcMsg ? detect(srcMsg.content) : null
          const srcCsd = srcDet && srcDet.type === 'csd' ? srcDet.code : null
          if (srcCsd) {
            editBaseRef.current = null
            pendingWebappConvertRef.current = { title: active.title, editBaseId: active.id }
            convertTurnRef.current = true
            payload = `${buildConvertPrompt('webapp', srcCsd)}\n\n<user-note>${text}</user-note>`
          } else {
            // Source CSD unrecoverable (rare) — fall back to in-place edit.
            editBaseRef.current = active.id
            pendingWebappConvertRef.current = null
            payload = wrapWithArtifactContext(text)
          }
        } else {
          // A plain follow-up edits the loaded version in place (branch from it).
          // A format conversion changes type, so it starts a fresh artifact chain.
          editBaseRef.current = active && !convertTo ? active.id : null
          // A "make it a web app" intent returns an orchestra CSD we wrap ourselves.
          pendingWebappConvertRef.current =
            convertTo === 'webapp' && active ? { title: active.title } : null
          convertTurnRef.current = Boolean(convertTo && active)
          payload = convertTo && active
            ? `${buildConvertPrompt(convertTo, primaryContent(active))}\n\n<user-note>${text}</user-note>`
            : wrapWithArtifactContext(text)
        }
        await window.api.session.send(sid, payload)
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
    if (msg.role === 'user') {
      return (
        <div key={msg.id} style={styles.userRow}>
          <div style={styles.userBubble}>
            <p style={styles.msgText}>{msg.content}</p>
          </div>
        </div>
      )
    }

    if (msg.type === 'error') {
      return (
        <div key={msg.id} style={styles.assistantRow}>
          <div style={styles.errorBubble}>
            <span style={styles.errorLabel}>Could not generate</span>
            <p style={styles.errorText}>{msg.content}</p>
          </div>
        </div>
      )
    }

    if (msg.type === 'narration') {
      // Strip the narrator's trailing "Keywords: ..." line so it reads as prose,
      // and convert any em/en dashes to commas (backstop for the no-dash rule).
      const body = msg.content
        .replace(/\n?Keywords:[^\n]*$/i, '')
        .replace(/\s*[—–]\s*/g, ', ')
        .trim()
      if (!body) return null
      return (
        <div key={msg.id} style={styles.assistantRow}>
          <div style={styles.narrationBubble}>
            <span style={styles.narrationLabel}>CONTEXT</span>
            <p style={styles.narrationText}>{body}</p>
            {msg.suggestions && msg.suggestions.length > 0 && (
              <div style={styles.suggestionRow}>
                {msg.suggestions.map((s) => (
                  <button
                    key={s}
                    style={styles.suggestionChip}
                    disabled={isStreaming}
                    onClick={() => handleSend(s)}
                    title={`Generate: ${s}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )
    }

    const text = stripArtifact(msg.content)
    const artifactId = msgArtifactMap.get(msg.id)
    const artifact = artifactId ? artifacts.find((a) => a.id === artifactId) : null
    // Don't offer feedback on the turn that's still streaming in.
    const streamingThis = isStreaming && messages[messages.length - 1]?.id === msg.id
    const showFeedback = !streamingThis && (Boolean(text) || Boolean(artifact))

    return (
      <div key={msg.id} style={styles.assistantRow}>
        <div style={styles.assistantBubble}>
          {text && <p style={styles.msgText}>{cleanChatText(text)}</p>}
          {artifact && (
            <ArtifactCard
              artifact={artifact}
              isPlaying={playingArtifactId === artifact.id}
              onClick={() => setActive(artifact.id)}
              onPlay={() => handlePlay(artifact)}
              onStop={handleStop}
            />
          )}
          {showFeedback && <MessageFeedback messageId={msg.id} content={msg.content} />}
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <SessionHistory
        open={historyOpen}
        currentSessionID={sessionID}
        onClose={() => setHistoryOpen(false)}
        onLoad={(id) => void loadSession(id)}
      />

      {/* Chat side */}
      <div style={styles.chatSide}>
        <div style={styles.topBar}>
          <button style={styles.topBtn} onClick={() => setHistoryOpen(true)} title="Session history">
            ☰ History
          </button>
          <button
            style={styles.topBtn}
            onClick={newChat}
            disabled={messages.length === 0 && !sessionID}
            title="Start a new chat"
          >
            ＋ New
          </button>
        </div>
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
                Describe a sound in your own words. Curated web demos live under the Web Apps tab.
              </p>
              {inputBar(true)}
            </div>
          </div>
        ) : (
          /* Conversation — messages fill, input docked at bottom */
          <>
            <div style={styles.messages}>
              {messages.map(renderMessage)}
              {isStreaming && (() => {
                const last = messages[messages.length - 1]
                const awaitingFirstChunk = !last || last.role === 'user'
                return (
                  <div style={styles.assistantRow}>
                    <div style={styles.streamingBubble}>
                      <div style={styles.thinkingWrap}>
                        <div style={styles.dots}>
                          <span style={styles.dot} />
                          <span style={{ ...styles.dot, animationDelay: '0.18s' }} />
                          <span style={{ ...styles.dot, animationDelay: '0.36s' }} />
                        </div>
                        <span style={styles.thinkingLabel}>
                          {awaitingFirstChunk ? 'Thinking…' : 'Composing…'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })()}
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
            onClick={() => handleSend()}
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
          <div style={styles.footerRight}>
            <ProfileBadge />
            <span style={styles.hint}>CSD · Web App · Cabbage</span>
          </div>
        </div>
      </div>
    )
  }
}

const styles: Record<string, CSSProperties> = {
  page: { height: '100%', display: 'flex', background: 'var(--bg-primary)' },

  chatSide: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' },

  topBar: {
    display: 'flex',
    gap: 6,
    padding: '8px 16px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  topBtn: {
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontFamily: 'var(--font-primary)',
    padding: '4px 10px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  footerRight: { display: 'flex', alignItems: 'center', gap: 10 },

  messages: { flex: 1, overflow: 'auto', padding: '24px 0' },

  userRow: { display: 'flex', justifyContent: 'flex-end', padding: '3px 28px' },
  userBubble: {
    maxWidth: 560, background: 'var(--accent-muted)', borderRadius: '16px 16px 4px 16px', padding: '10px 16px',
  },

  assistantRow: { display: 'flex', padding: '3px 28px' },
  assistantBubble: { maxWidth: 640 },

  narrationBubble: {
    maxWidth: 640,
    padding: '12px 16px',
    borderLeft: '2px solid var(--accent)',
    background: 'var(--accent-muted)',
    borderRadius: '2px 10px 10px 2px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  narrationLabel: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.14em',
    color: 'var(--accent)',
    fontFamily: 'var(--font-primary)',
  },
  narrationText: {
    fontSize: 13,
    lineHeight: 1.55,
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
    margin: 0,
  },
  errorBubble: {
    maxWidth: 520,
    padding: '14px 18px',
    borderRadius: 12,
    border: '1.5px solid #c45c5c',
    background: 'rgba(196, 92, 92, 0.08)',
  },
  errorLabel: {
    display: 'block',
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#c45c5c',
    marginBottom: 6,
  },
  errorText: {
    fontSize: 13.5,
    lineHeight: 1.55,
    color: 'var(--text-primary)',
    margin: 0,
  },
  suggestionRow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  suggestionChip: {
    width: '100%',
    maxWidth: 340,
    textAlign: 'center',
    padding: '8px 14px',
    borderRadius: 10,
    border: '1px solid var(--accent)',
    background: 'transparent',
    color: 'var(--accent)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'var(--font-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transition: 'background 150ms ease, opacity 150ms ease',
  },

  msgText: { fontSize: 14, lineHeight: 1.65, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', margin: 0 },

  streamingBubble: { padding: '8px 0' },
  thinkingWrap: {
    display: 'inline-flex', alignItems: 'center', gap: 10,
    padding: '8px 14px', borderRadius: 14,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-subtle)',
  },
  dots: { display: 'flex', gap: 5 },
  dot: {
    width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)',
    animation: 'pulse 1.2s ease-in-out infinite',
  },
  thinkingLabel: {
    fontSize: 12, color: 'var(--text-secondary)',
    fontFamily: 'var(--font-primary)', fontStyle: 'italic',
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
