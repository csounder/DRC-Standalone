/** CsOptions block for realtime dac — CsoundQt and Player convention. */
export const REALTIME_CSOPTIONS = `<CsOptions>
-o dac
-d
</CsOptions>`

/** True when <CsOptions> already targets realtime dac output. */
export function csdHasRealtimeDacOptions(csd: string): boolean {
  const m = csd.match(/<CsOptions>([\s\S]*?)<\/CsOptions>/i)
  if (!m) return false
  const opts = m[1]
  return (
    /(?:^|\s)-odac\d*(?:\s|$)/m.test(opts) ||
    /(?:^|\s)-o\s+dac\d*(?:\s|$)/m.test(opts)
  )
}

/**
 * Rewrite CsOptions for CsoundQt: `-o dac` so Run plays through speakers,
 * not `-o /tmp/drc.wav` from Agent offline preview.
 */
export function prepareCsdForCsoundQt(csd: string): string {
  let s = csd.trim()
  if (/<CsOptions>/i.test(s)) {
    s = s.replace(/<CsOptions>[\s\S]*?<\/CsOptions>/i, REALTIME_CSOPTIONS)
  } else {
    s = s.replace(/<CsInstruments>/i, `${REALTIME_CSOPTIONS}\n<CsInstruments>`)
  }
  return s
}
