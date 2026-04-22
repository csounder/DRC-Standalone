import { primaryContent, type Artifact } from '../stores/artifactStore'
import { usePlaybackStore } from '../stores/playbackStore'
import { useSessionStore } from '../stores/sessionStore'

// Single owner of the csound play/stop flow. Both the chat artifact card and
// the artifact panel call these helpers so their playing-state stays in sync —
// and a global Stop pill can observe the same store.
export async function playArtifact(artifact: Artifact): Promise<void> {
  if (!window.api?.csound) return
  const store = usePlaybackStore.getState()
  store.set({ artifactId: artifact.id, status: 'compiling', message: 'Compiling…' })

  try {
    const { path } = await window.api.csound.writeCsd(primaryContent(artifact))
    const compile = await window.api.csound.compile(path)
    if (!compile.success) {
      const errMsg = String(compile.error ?? '').slice(0, 300)
      usePlaybackStore.getState().set({
        status: 'error',
        message: `Compile error: ${errMsg}`,
      })
      // Fire-and-forget: ask the model to patch the CSD based on the error.
      void requestAutofix(artifact, errMsg)
      return
    }

    usePlaybackStore.getState().set({ status: 'playing', message: 'Playing' })

    const res = await window.api.csound.play(path)

    // Only clear if this flow's artifact is still the one in the store —
    // a newer play may have superseded us.
    const current = usePlaybackStore.getState()
    if (current.artifactId !== artifact.id) return

    if (res.success) {
      usePlaybackStore.getState().clear()
    } else {
      usePlaybackStore.getState().set({
        status: 'error',
        message: `Error: ${String(res.error ?? '').slice(0, 160)}`,
      })
    }
  } catch (err: any) {
    const current = usePlaybackStore.getState()
    if (current.artifactId !== artifact.id) return
    usePlaybackStore.getState().set({
      status: 'error',
      message: `Error: ${err.message}`,
    })
  }
}

export async function stopPlayback(): Promise<void> {
  await window.api?.csound?.stop()
  usePlaybackStore.getState().clear()
}

// Ask the model to fix a CSD that failed to compile. The fix streams back as
// a normal assistant message; artifact detection picks up the corrected CSD
// and replaces the current artifact version via the live-update flow.
async function requestAutofix(artifact: Artifact, errMsg: string): Promise<void> {
  if (!window.api?.session) return
  const session = useSessionStore.getState()
  if (session.isStreaming) return  // Something else is already generating

  // The CSD is already in conversation history (last assistant message), so we
  // don't re-send it — just the error + a targeted hint for the most common
  // failure mode. Keeps tokens cheap and preserves prompt-cache hits.
  const prompt =
    `The CSD you just wrote failed to compile. Fix it and emit the full corrected <CsoundSynthesizer>…</CsoundSynthesizer> block (one short sentence, then the CSD).\n\n` +
    `Compiler error: ${errMsg}\n\n` +
    `Hint: rate-mismatch assignments (e.g. "ifreq = ifreqs[kIdx]") are the most common cause — use a "k" prefix or wrap in i() to snapshot.`

  session.addMessage({
    id: `msg_${Date.now()}`,
    role: 'user',
    content: 'Fix the compile error',
    timestamp: Date.now(),
  })
  session.setStreaming(true)

  try {
    let sid = session.sessionID
    if (!sid) {
      const created = await window.api.session.create(session.agentMode)
      sid = created.id
      session.setSessionID(sid)
    }
    await window.api.session.send(sid, prompt)
  } catch (err: any) {
    session.addMessage({
      id: `msg_${Date.now()}_e`,
      role: 'assistant',
      content: `Auto-fix failed: ${err.message}`,
      timestamp: Date.now(),
    })
    session.setStreaming(false)
  }
}
