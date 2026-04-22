import { primaryContent, type Artifact } from '../stores/artifactStore'
import { usePlaybackStore } from '../stores/playbackStore'

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
      usePlaybackStore.getState().set({
        status: 'error',
        message: `Compile error: ${String(compile.error ?? '').slice(0, 160)}`,
      })
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
