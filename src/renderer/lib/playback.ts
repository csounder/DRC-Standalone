import { primaryContent, type Artifact } from '../stores/artifactStore'
import { usePlaybackStore } from '../stores/playbackStore'
import { useSessionStore } from '../stores/sessionStore'

// Consecutive autofix attempts per session. Reset by resetAutofix() whenever the
// user sends a fresh non-autofix prompt. Without this cap a persistently-broken
// CSD would loop forever: autofix → auto-play → fail → autofix → ...
const autofixAttempts = new Map<string, number>()
const AUTOFIX_LIMIT = 2

export function resetAutofix(sessionID: string | null): void {
  if (sessionID) autofixAttempts.delete(sessionID)
}

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
      void requestAutofix(artifact, errMsg, 'compile')
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
      const errMsg = String(res.error ?? '').slice(0, 300)
      usePlaybackStore.getState().set({
        status: 'error',
        message: `Error: ${errMsg.slice(0, 160)}`,
      })
      // INIT ERROR / PERF ERROR / silent output all surface here, not from the
      // syntax-check compile step. Close the loop so these get autofixed too.
      void requestAutofix(artifact, errMsg, 'runtime')
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

// Ask the model to fix a CSD that failed. The fix streams back as a normal
// assistant message; artifact detection picks up the corrected CSD and replaces
// the current artifact version via the live-update flow.
//
// Kind tells the model whether the failure was parse-time (compile) or
// init/perf-time (runtime) — different root causes, different hints.
async function requestAutofix(
  artifact: Artifact,
  errMsg: string,
  kind: 'compile' | 'runtime' = 'compile',
): Promise<void> {
  if (!window.api?.session) return
  const session = useSessionStore.getState()
  if (session.isStreaming) return  // Something else is already generating

  const sid = session.sessionID
  const attempts = sid ? (autofixAttempts.get(sid) ?? 0) : 0
  if (attempts >= AUTOFIX_LIMIT) {
    // Give up — the user can see the error and iterate manually.
    return
  }
  if (sid) autofixAttempts.set(sid, attempts + 1)

  // Flip the playback pill so the user sees we're already on it. Without this
  // the pill keeps showing the raw compile error while a new stream is landing,
  // which reads as "broken and ignored" rather than "broken but being fixed".
  usePlaybackStore.getState().set({
    artifactId: artifact.id,
    status: 'compiling',
    message: kind === 'runtime' ? 'Auto-fixing runtime error…' : 'Auto-fixing compile error…',
  })

  const hint = kind === 'runtime'
    ? `Hint: INIT/PERF errors usually come from rate mismatches at init time. Common traps: \`i(kVar)\` on a k-var that's only written inside the instrument body (reads 0 at init); passing a k-rate ftable index to \`table\` instead of \`tablekt\`; expseg endpoints of 0; unknown opcodes; or silent output from unscheduled instruments / missing \`out\`.`
    : `Hint: rate-mismatch assignments (e.g. "ifreq = ifreqs[kIdx]") are the most common cause — use a "k" prefix or wrap in i() to snapshot.`

  const prompt =
    `The CSD you just wrote failed to ${kind === 'runtime' ? 'run' : 'compile'}. Fix it and emit the full corrected <CsoundSynthesizer>…</CsoundSynthesizer> block (one short sentence, then the CSD).\n\n` +
    `${kind === 'runtime' ? 'Runtime' : 'Compiler'} error: ${errMsg}\n\n` +
    hint

  session.addMessage({
    id: `msg_${Date.now()}`,
    role: 'user',
    content: kind === 'runtime' ? 'Fix the runtime error' : 'Fix the compile error',
    timestamp: Date.now(),
  })
  session.setStreaming(true)

  try {
    let activeSid = sid
    if (!activeSid) {
      const created = await window.api.session.create(session.agentMode)
      activeSid = created.id
      session.setSessionID(activeSid)
    }
    await window.api.session.send(activeSid, prompt)
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
