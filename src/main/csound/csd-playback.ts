/** True when <CsOptions> already requests realtime audio — same path CsoundQt uses. */
export function csdHasRealtimeOutputOptions(csd: string): boolean {
  const m = csd.match(/<CsOptions>([\s\S]*?)<\/CsOptions>/i)
  if (!m) return false
  return /(?:^|\s)-odac\d*(?:\s|$)/m.test(m[1])
}
