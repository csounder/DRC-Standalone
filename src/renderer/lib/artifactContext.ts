import { useArtifactStore, type ArtifactType } from '../stores/artifactStore'

// One short line per type. The full artifact body is already in conversation
// history (it was the previous assistant message) — re-sending it would bloat
// tokens and bust implicit prompt caching. All we need is a 1-line hint so the
// model knows to preserve the current format.
const FORMAT_HINT: Record<ArtifactType, string> = {
  csd: 'active artifact: CSD — emit updated <CsoundSynthesizer>…</CsoundSynthesizer>',
  webapp: 'active artifact: Web App — emit updated <!DOCTYPE html>…</html>; do not revert to a plain CSD',
  vst: 'active artifact: Cabbage VST — keep the <Cabbage>…</Cabbage> section',
}

// Prepend a single-line hint about which format to keep, only for assistant
// follow-ups (i.e. when there's an active artifact AND a prior assistant turn
// in history that already carries the full artifact content).
export function wrapWithArtifactContext(userText: string): string {
  const active = useArtifactStore.getState().getActive()
  if (!active) return userText
  return `[${FORMAT_HINT[active.type]}]\n${userText}`
}
