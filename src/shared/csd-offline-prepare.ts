/**
 * Agent preview: offline WAV render must have timed i-statements.
 * Player hold scores (f 0 36000) compile-check OK but render silence.
 */

export function csdHasScheduledDemoScore(csd: string): boolean {
  const m = csd.match(/<CsScore>([\s\S]*?)<\/CsScore>/i)
  if (!m) return false
  return /\bi\s+(?!99\b|100\b)\d+\s+\S+\s+\S+/i.test(m[1])
}

export function needsHoldScoreShortening(csd: string): boolean {
  return /\bf\s+0\s+\d{3,}\b/i.test(csd) || /\bi\s+\d+\s+0\s+\d{3,}\b/i.test(csd)
}

export function shortenHoldScoreForCompile(csd: string): string {
  return csd.replace(/<CsScore>([\s\S]*?)<\/CsScore>/i, (_, score: string) => {
    let s = score
    s = s.replace(/\bf\s+0\s+(\d{3,})\b/gi, 'f 0 1')
    s = s.replace(/\bi\s+(\d+)\s+0\s+(\d{3,})\b/gi, 'i $1 0 1')
    return `<CsScore>${s}</CsScore>`
  })
}

/** ~10 s bass riff + echo bus — matches pluck_bass_starter pattern. */
export const BASS_OFFLINE_DEMO_SCORE = `<CsScore>
i 99 0 10
i 1 0   1.5 36 0.6
i 1 1   1.5 43 0.55
i 1 2   1.5 48 0.5
i 1 3   2.0 36 0.55
</CsScore>`

export const GENERIC_OFFLINE_DEMO_SCORE = `<CsScore>
i 1 0.00 0.45 60 0.22
i 1 0.45 0.45 64 0.22
i 1 0.90 0.45 67 0.22
i 1 1.35 0.45 72 0.24
i 1 2.50 0.35 60 0.24
i 1 2.85 0.35 64 0.24
i 1 3.20 0.35 67 0.24
i 1 3.55 0.35 71 0.24
i 1 4.50 0.20 67 0.20
i 1 4.70 0.20 64 0.20
i 1 4.90 0.20 67 0.20
i 1 5.10 0.20 72 0.20
i 1 6.00 2.00 60 0.18
i 1 6.00 2.00 64 0.16
i 1 6.00 2.00 67 0.14
i 1 6.00 2.00 72 0.12
</CsScore>`

function stripRealtimeCsOptions(csd: string): string {
  let s = csd
  if (!/<CsOptions>/i.test(s)) return s
  s = s.replace(/<CsOptions>([\s\S]*?)<\/CsOptions>/i, (_, body: string) => {
    const lines = body
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !/^-n\b/.test(l))
      .filter((l) => !/^-o\s+\S+/.test(l))
      .filter((l) => !/^-odac/.test(l))
      .filter((l) => !/^-iadc/.test(l))
      .filter((l) => !/^-\+\s*rtmidi/.test(l))
    if (lines.length === 0) return ''
    return `<CsOptions>\n${lines.join('\n')}\n</CsOptions>`
  })
  return s.replace(/<CsOptions>\s*<\/CsOptions>\s*/gi, '')
}

function orchestraNeedsEchoBus(csd: string): boolean {
  const orch = csd.match(/<CsInstruments>([\s\S]*?)<\/CsInstruments>/i)?.[1] ?? ''
  return /\binstr\s+99\b/.test(orch) && /\b(gaEcho|vdelay3)\b/.test(orch)
}

/** Prepare Agent CSD for offline WAV preview (afplay / file render). */
export function prepareCsdForOfflineRender(csd: string): string {
  let s = stripRealtimeCsOptions(csd.trim())
  const hasVoice = /\binstr\s+1\b/.test(s)
  const hasDemo = csdHasScheduledDemoScore(s)

  if (hasVoice && !hasDemo) {
    const score = orchestraNeedsEchoBus(s) ? BASS_OFFLINE_DEMO_SCORE : GENERIC_OFFLINE_DEMO_SCORE
    if (/<CsScore>[\s\S]*?<\/CsScore>/i.test(s)) {
      s = s.replace(/<CsScore>[\s\S]*?<\/CsScore>/i, score)
    } else {
      s = s.replace(/<\/CsoundSynthesizer>/i, `${score}\n</CsoundSynthesizer>`)
    }
  } else if (needsHoldScoreShortening(s)) {
    s = shortenHoldScoreForCompile(s)
  }

  return s
}

export function renderOutputWasSilent(combinedOutput: string): boolean {
  return /overall amps:\s+0\.0+\s+0\.0+/i.test(combinedOutput)
}
