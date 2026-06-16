import { stripCabbageJunk } from './mechanicalPlayerAdapt'
import { REALTIME_CSOPTIONS } from '../../shared/csd-realtime-options'

const PLAYER_INSTR_100 = `
instr 100
  Schan strget p4
  iVal  = p5
  chnset iVal, Schan
  turnoff
endin`

interface CcDef {
  macro: string
  num: number
  defaultVal: number
}

function parseCcDefs(instrBlock: string): CcDef[] {
  const defs: CcDef[] = []
  const defineRe = /#define\s+(C\d+)\s+#(\d+)#/gi
  let m: RegExpExecArray | null
  while ((m = defineRe.exec(instrBlock)) !== null) {
    defs.push({ macro: m[1], num: parseInt(m[2], 10), defaultVal: 0.5 })
  }
  for (const d of defs) {
    const ctrlinit = new RegExp(`ctrlinit\\s+\\d+,\\s*\\$${d.macro},\\s*([\\d.]+)`, 'i').exec(instrBlock)
    if (ctrlinit) d.defaultVal = parseFloat(ctrlinit[1]) / 127
    const initc7 = new RegExp(`initc7\\s+\\d+,\\s*\\$${d.macro},\\s*([\\d.]+)`, 'i').exec(instrBlock)
    if (initc7) d.defaultVal = parseFloat(initc7[1])
  }
  return defs
}

function labelFromMidiVar(name: string): string {
  const n = name.toLowerCase()
  if (/vol|gain|level|amp/.test(n)) return 'Volume'
  if ((/filt|cut|frq|freq/.test(n) || n.includes('cf')) && !/res/.test(n)) return 'Filter Cutoff'
  if (/res|rez|q\b/.test(n)) return 'Resonance'
  if (/pan/.test(n)) return 'Pan'
  if (/mod|index|fm|depth/.test(n)) return 'Modulation'
  if (/pw|width|pulse/.test(n)) return 'Pulse Width'
  if (/verb|rev|echo/.test(n)) return 'Reverb Send'
  const trimmed = name.replace(/^k/i, '').replace(/_/g, ' ')
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : 'Control'
}

function inferCcLabels(voiceBody: string, defs: CcDef[]): Map<number, string> {
  const macroNum = new Map(defs.map((d) => [d.macro, d.num]))
  const labels = new Map<number, string>()
  const re = /^\s*(\w+)\s+midic7\s+\$(C\d+)\s*,/gim
  let m: RegExpExecArray | null
  while ((m = re.exec(voiceBody)) !== null) {
    const num = macroNum.get(m[2])
    if (num !== undefined) labels.set(num, labelFromMidiVar(m[1]))
  }
  return labels
}

function buildCcChannels(defs: CcDef[], labels: Map<number, string>): string {
  if (!defs.length) return ''
  const decls = defs
    .map((d) => {
      const id = `cc${d.num}`
      const def = d.defaultVal
      const max = def <= 1 ? 1 : 127
      const norm = def <= 1 ? def : def / 127
      const label = (labels.get(d.num) ?? `CC ${d.num}`).replace(/ /g, '_')
      return `chn_k "${id}", 3, 2, ${norm}, 0, ${max <= 1 ? 1 : max}, 0, 0, 0, 0, "unit= label=${label}"`
    })
    .join('\n')
  const inits = defs
    .map((d) => {
      const id = `cc${d.num}`
      const def = d.defaultVal
      const norm = def <= 1 ? def : def / 127
      return `chnset ${norm}, "${id}"`
    })
    .join('\n')
  return `${decls}\n${inits}\n`
}

function replaceCcReads(body: string, defs: CcDef[]): string {
  let out = body
  for (const d of defs) {
    const id = `cc${d.num}`
    const macro = d.macro.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const replMidic7 = (varName: string, lo: string, hi: string) => {
      const hiClean = hi.replace(/;.*$/, '').trim()
      return `${varName} = (${lo.trim()}) + chnget("${id}") * ((${hiClean}) - (${lo.trim()}))`
    }
    out = out.replace(
      new RegExp(`^(\\s*\\w+)\\s+midic7\\s+\\$${macro}\\s*,\\s*([^,]+)\\s*,\\s*([^\\n]+)`, 'gim'),
      (_, varName, lo, hi) => replMidic7(varName.trim(), lo, hi),
    )
    out = out.replace(
      new RegExp(`^(\\s*\\w+)\\s+ctrl7\\s+\\d+\\s*,\\s*\\$${macro}\\s*,\\s*([^,]+)\\s*,\\s*([^\\n]+)`, 'gim'),
      (_, varName, lo, hi) => replMidic7(varName.trim(), lo, hi),
    )
  }
  return out
}

function injectPitchAmp(body: string): string {
  let b = body
  b = b.replace(/^\s*ipitch\s+cpsmidi\b[^\n]*/gim, 'iFreq = p4')
  b = b.replace(/^\s*ifqc\s+cpsmidi\b[^\n]*/gim, 'iFreq = p4')
  b = b.replace(/^\s*icps\s+cpsmidi\b[^\n]*/gim, 'iFreq = p4')
  b = b.replace(/^\s*knote\s+cpsmidib\b[^\n]*/gim, 'knote = p4')
  b = b.replace(/^\s*kcps\s+cpsmidib\s+\d+\b[^\n]*/gim, 'kcps = p4')
  // Player stdin events send p5 as normalized velocity 0..1 (not MIDI 0..127).
  b = b.replace(/^\s*iamp\s+ampmidi\s+([^\n;]+)/gim, 'iAmp = p5 * ($1)')
  b = b.replace(/^\s*ilevl\s+ampmidi\s+([^\n;]+)/gim, 'iAmp = p5 * ($1)')
  b = b.replace(/^\s*iveloc\s+ampmidi\s+([^\n;]+)/gim, 'iveloc = p5 * ($1)')
  b = b.replace(/\bifqc\b/g, 'iFreq')
  b = b.replace(/\bicps\b/g, 'iFreq')
  b = b.replace(/\bipitch\b/g, 'iFreq')
  b = b.replace(/\biamp\b/g, 'iAmp')
  if (!/\biAmp\b/.test(b) && /\bilevl\b/.test(b)) b = b.replace(/\bilevl\b/g, 'iAmp')
  if (!/\biAmp\b/.test(b) && /\biveloc\b/.test(b)) b = b.replace(/\biveloc\b/g, 'iAmp')
  b = b.replace(/^\s*out\s+(.+)$/gim, 'outs $1, $1')
  return b
}

function normalizeScore(score: string): string {
  let s = score.trim()
  s = s.replace(/^\s*f0\s+z\s*$/gim, 'f 0 36000')
  s = s.replace(/^\s*f0\s+\d+\s*$/gim, 'f 0 36000')
  s = s.replace(/\bi\s+99\s+0\s+-1/gi, 'i 99 0 36000')
  s = s.replace(/\bi198\s+0\s+\d+/gi, 'i 198 0 36000')
  s = s.replace(/\bi\s+98\s+0\s+\d+/gi, 'i 98 0 36000')
  s = s.replace(/^e\s*$/gim, '')
  if (!/\bf\s+0\b/i.test(s)) s += '\nf 0 36000'
  return s.trim()
}

function findInstrBlocks(instrBlock: string): { num: string; body: string; index: number }[] {
  const headers: { num: string; index: number }[] = []
  let offset = 0
  for (const line of instrBlock.split('\n')) {
    const code = line.includes(';') ? line.slice(0, line.indexOf(';')) : line
    const m = /^\s*instr\s+([A-Za-z_]\w*|\d+)\s*$/i.exec(code)
    if (m) headers.push({ num: m[1], index: offset })
    offset += line.length + 1
  }

  const instruments: { num: string; body: string; index: number }[] = []
  for (let h = 0; h < headers.length; h++) {
    const { num, index } = headers[h]
    const afterHeader = instrBlock.indexOf('\n', index) + 1
    const endMatch = /\n\s*endin\s*(?:\n|$)/gi
    endMatch.lastIndex = afterHeader
    const end = endMatch.exec(instrBlock)
    if (!end) continue
    const body = instrBlock.slice(afterHeader, end.index)
    instruments.push({ num, body, index })
  }
  return instruments
}

function extractInstruments(instrBlock: string): { globals: string; instruments: { num: string; body: string; index: number }[] } {
  const instruments = findInstrBlocks(instrBlock)
  const globals = instruments.length ? instrBlock.slice(0, instruments[0].index) : instrBlock
  return { globals, instruments }
}

function cleanMidiGlobals(globals: string): string {
  return globals
    .replace(/^\s*#define\b[^\n]*\n/gim, '')
    .replace(/^\s*massign[^\n]*\n/gim, '')
    .replace(/^\s*ctrlinit[^\n]*\n/gim, '')
    .replace(/^\s*initc7[^\n]*\n/gim, '')
    .replace(/^\s*maxalloc[^\n]*\n/gim, '')
    .replace(/^\s*nchnls\s*=.*\n/gim, '')
    .replace(/^\s*0dbfs\s*=.*\n/gim, '')
    .replace(/^\s*;\s*[^\n]*\n/gm, '')
    .trim()
}

function isVoiceInstr(body: string): boolean {
  return /\b(cpsmidi|ampmidi|cpsmidib)\b/i.test(body)
}

/** Offline wrap for bundled MIDI synth models — keyboard p4/p5, chn_k for former MIDI CC. */
export function wrapMidiModelForPlayer(source: string): string | null {
  const raw = stripCabbageJunk(source.trim())
  if (!/\b(cpsmidi|ampmidi|cpsmidib)\b/i.test(raw)) return null

  const synth = raw.match(/<CsoundSynthesizer[\s\S]*?<\/CsoundSynthesizer>/i)?.[0]
  if (!synth) return null

  const instrBlock = synth.match(/<CsInstruments>([\s\S]*?)<\/CsInstruments>/i)?.[1]
  const scoreBlock = synth.match(/<CsScore>([\s\S]*?)<\/CsScore>/i)?.[1]
  if (!instrBlock) return null

  const ccDefs = parseCcDefs(instrBlock)
  const { globals, instruments } = extractInstruments(instrBlock)
  if (!instruments.length) return null

  const voiceIdx = instruments.findIndex((i) => isVoiceInstr(i.body))
  if (voiceIdx < 0) return null

  let cleanGlobals = cleanMidiGlobals(globals)
  if (!/\bgi\w+\s+ftgen\b/i.test(cleanGlobals) && !/\bftgen\b/i.test(cleanGlobals)) {
    cleanGlobals = `giSine ftgen 0, 0, 16384, 10, 1\n\n${cleanGlobals}`.trim()
  }
  if (!/\bsr\s*=/i.test(cleanGlobals)) {
    cleanGlobals = `sr = 44100\nksmps = 64\nnchnls = 2\n0dbfs = 1\n\n${cleanGlobals}`
  }

  const voiceBody = instruments[voiceIdx].body
  const ccLabels = inferCcLabels(voiceBody, ccDefs)
  const chn = buildCcChannels(ccDefs, ccLabels)
  const rendered: string[] = []

  for (let i = 0; i < instruments.length; i++) {
    const { num, body } = instruments[i]
    if (i === voiceIdx) {
      let b = injectPitchAmp(body)
      b = replaceCcReads(b, ccDefs)
      rendered.push(`instr 1\n${b.trim()}\nendin`)
    } else if (num === '100' || num === '99') {
      continue
    } else {
      const b = replaceCcReads(body, ccDefs)
      rendered.push(`instr ${num}\n${b.trim()}\nendin`)
    }
  }

  const score = normalizeScore(scoreBlock ?? 'f 0 36000')

  return `<CsoundSynthesizer>
${REALTIME_CSOPTIONS}
<CsInstruments>
${cleanGlobals}

${chn}${rendered.join('\n\n')}
${PLAYER_INSTR_100}
</CsInstruments>
<CsScore>
${score}
</CsScore>
</CsoundSynthesizer>`
}
