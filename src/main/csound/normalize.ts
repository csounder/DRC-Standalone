// Local Csound 6.18 (homebrew) does NOT resolve named-instrument score events
// like `i "Bell" 0 8 ...` — they fail with "instr 0(200) undefined" and produce
// zero amplitude. This module rewrites named instruments to numbered ones before
// the CSD is written to disk so playback works regardless of how the model wrote it.
//
// Rewrites:
//   instr Bell, Reverb        → instr 1, 2
//   i "Bell" 0 8 0.4 72       → i1 0 8 0.4 72
//   schedule "Bell", 0, 1, …  → schedule 1, 0, 1, …
//   schedkwhen k, 0, 0, "X",… → schedkwhen k, 0, 0, N,…
//   event_i "i", "X", …       → event_i "i", N, …
//
// Numeric instrument ids already present are preserved.

export function normalizeNamedInstruments(csd: string): { csd: string; renamed: Record<string, number> } {
  const instrumentsMatch = csd.match(/<CsInstruments>([\s\S]*?)<\/CsInstruments>/i)
  if (!instrumentsMatch) return { csd, renamed: {} }
  const instrumentsBody = instrumentsMatch[1]

  const nameToNum = new Map<string, number>()
  const numsUsed = new Set<number>()

  // Pass 1: collect already-used numeric ids so we don't collide.
  const instrRe = /^[ \t]*instr\s+([^\n]+)$/gm
  let m: RegExpExecArray | null
  while ((m = instrRe.exec(instrumentsBody))) {
    for (const entry of m[1].split(',').map((s) => s.trim())) {
      const num = entry.match(/^(\d+)/)
      if (num) numsUsed.add(parseInt(num[1], 10))
    }
  }

  let nextCandidate = 1
  const allocNum = (): number => {
    while (numsUsed.has(nextCandidate)) nextCandidate++
    const n = nextCandidate++
    numsUsed.add(n)
    return n
  }

  // Pass 2: assign numbers to named instruments in declaration order.
  instrRe.lastIndex = 0
  while ((m = instrRe.exec(instrumentsBody))) {
    for (const entry of m[1].split(',').map((s) => s.trim())) {
      // Skip pure numeric ids (instr 1) and fractional ids (instr 1.001)
      if (/^\d+(\.\d+)?$/.test(entry)) continue
      // Strip any trailing comment
      const name = entry.split(';')[0].trim()
      if (!name) continue
      if (!isValidCsoundName(name)) continue
      if (!nameToNum.has(name)) nameToNum.set(name, allocNum())
    }
  }

  if (!nameToNum.size) return { csd, renamed: {} }

  const nameOr = Array.from(nameToNum.keys())
    .sort((a, b) => b.length - a.length)  // match longer names first (Reverb before Rev)
    .map(escapeRe)
    .join('|')

  let out = csd

  // Rewrite `instr Name[, Name2, 3]` — applies everywhere (including prose comments
  // in CsInstruments would be rare). We constrain to start-of-line to be safe.
  out = out.replace(/^([ \t]*)instr\s+([^\n]+)$/gm, (_full, indent, body) => {
    const rewritten = body.split(',').map((s: string) => {
      const trimmed = s.trim()
      const commentIdx = trimmed.indexOf(';')
      const head = commentIdx >= 0 ? trimmed.slice(0, commentIdx).trim() : trimmed
      const tail = commentIdx >= 0 ? ` ${trimmed.slice(commentIdx)}` : ''
      if (/^\d+(\.\d+)?$/.test(head)) return trimmed
      const num = nameToNum.get(head)
      return num !== undefined ? `${num}${tail}` : trimmed
    }).join(', ')
    return `${indent}instr ${rewritten}`
  })

  // Rewrite score events: only inside <CsScore>…</CsScore>.
  out = out.replace(/<CsScore>([\s\S]*?)<\/CsScore>/gi, (_full, score) => {
    const newScore = score.replace(
      new RegExp(`\\bi\\s*"(${nameOr})"`, 'g'),
      (_m2: string, name: string) => `i${nameToNum.get(name)}`,
    )
    return `<CsScore>${newScore}</CsScore>`
  })

  // Rewrite `schedule "Name", …` anywhere.
  out = out.replace(
    new RegExp(`\\bschedule\\s+"(${nameOr})"`, 'g'),
    (_m2, name) => `schedule ${nameToNum.get(name)}`,
  )

  // Rewrite `schedkwhen …, "Name", …` and `schedwhen …, "Name", …`.
  // The named instr sits anywhere in the argument list; replace any quoted name
  // on those lines that matches a known instrument.
  out = out.replace(
    new RegExp(`\\b(schedkwhen|schedwhen)\\b([^\\n]*?)"(${nameOr})"`, 'g'),
    (_m2, op, before, name) => `${op}${before}${nameToNum.get(name)}`,
  )

  // Rewrite `event_i "i", "Name", …` and `event "i", "Name", …`.
  out = out.replace(
    new RegExp(`\\b(event_i|event)\\s*"i"\\s*,\\s*"(${nameOr})"`, 'g'),
    (_m2, op, name) => `${op} "i", ${nameToNum.get(name)}`,
  )
  out = out.replace(
    new RegExp(`\\b(event_i|event)\\s*\\(\\s*"i"\\s*,\\s*"(${nameOr})"`, 'g'),
    (_m2, op, name) => `${op}("i", ${nameToNum.get(name)}`,
  )

  const renamed: Record<string, number> = {}
  for (const [name, num] of nameToNum) renamed[name] = num
  return { csd: out, renamed }
}

function isValidCsoundName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z_0-9]*$/.test(name)
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
