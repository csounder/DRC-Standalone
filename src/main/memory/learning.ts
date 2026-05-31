import { Log } from '../util/log'
import { Bus } from '../util/bus'
import { MemoryDB } from './db'
import { SINGLETON_ID, type LearningRow, type FeedbackKind } from './schema'

// What the agent has learned from this user's feedback — used to make its
// GENERATIONS better, not to model the user. 👍/👎 (and accepted fixes) move
// signed preference weights for the techniques/opcodes present in a response:
// positive = lean toward, negative = steer away. There is no notion of user
// "expertise" or "level" here — that's the Complex/Sine mode toggle, which the
// user controls directly.

export interface LearnedPreferences {
  favored: string[] // techniques the user responded well to
  disfavored: string[] // techniques the user reacted poorly to
  favoredOpcodes: string[]
  totalFeedback: number
}

export interface FeedbackEvent {
  kind: FeedbackKind
  rating?: number | null
  signals?: {
    techniques?: string[]
    opcodes?: string[]
    content?: string
    [k: string]: unknown
  } | null
}

// Technique vocabulary scanned out of a response's content. Small on purpose —
// these are the categories the prompt cares about (mirrors the synthesis /
// effects / modulation split).
const TECHNIQUE_KEYWORDS: Record<string, RegExp> = {
  fm: /\bfm\b|frequency modulation|foscil/i,
  additive: /additive|gbuzz|\bbuzz\b/i,
  subtractive: /subtractive|moogladder|moogvcf|\bzdf|reson\b|butterlp|butterhp/i,
  granular: /granular|grain|partikkel|fog\b|sndwarp/i,
  reverb: /reverb|reverbsc|freeverb|\bnreverb\b/i,
  delay: /\bdelay\b|delayr|deltap|vdelay/i,
  filter: /\bfilter\b|\blowpass|highpass|bandpass|tone\b|atone\b/i,
  lfo: /\blfo\b|lfo\b/i,
  envelope: /envelope|\badsr\b|madsr|linseg|expseg|linen/i,
  physical: /physical model|pluck|wgbow|wgbrass|wgflute|wgclar/i,
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

// +1 for signals that a generation was good, -1 for bad. accepted_fix is
// positive (the fix worked). user_edit is neutral here — editing tells us
// nothing reliable about which technique to favor.
function directionFor(ev: FeedbackEvent): number {
  switch (ev.kind) {
    case 'thumbs_up':
    case 'accepted_fix':
      return 1
    case 'thumbs_down':
      return -1
    case 'rating':
      return (ev.rating ?? 3) >= 4 ? 1 : (ev.rating ?? 3) <= 2 ? -1 : 0
    default:
      return 0
  }
}

function tagsFromEvent(ev: FeedbackEvent): { techniques: string[]; opcodes: string[] } {
  const techniques = new Set(ev.signals?.techniques ?? [])
  const opcodes = new Set(ev.signals?.opcodes ?? [])
  const text = ev.signals?.content
  if (text) {
    for (const [name, re] of Object.entries(TECHNIQUE_KEYWORDS)) {
      if (re.test(text)) techniques.add(name)
    }
  }
  return { techniques: Array.from(techniques), opcodes: Array.from(opcodes) }
}

// Signed weights: nudge by direction, decay all slightly so stale signals fade.
function bumpWeights(
  map: Record<string, number>,
  keys: string[],
  direction: number,
): Record<string, number> {
  const next: Record<string, number> = {}
  for (const [k, v] of Object.entries(map)) {
    const decayed = v * 0.98
    if (Math.abs(decayed) > 0.05) next[k] = decayed
  }
  for (const k of keys) {
    next[k] = clamp((next[k] ?? 0) + 0.3 * direction, -10, 10)
    if (Math.abs(next[k]) <= 0.05) delete next[k]
  }
  return next
}

export namespace Learning {
  export function get(): LearnedPreferences {
    const row = readRow()
    const techEntries = Object.entries(row.techniques)
    return {
      favored: techEntries
        .filter(([, w]) => w > 0.1)
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => k),
      disfavored: techEntries
        .filter(([, w]) => w < -0.1)
        .sort((a, b) => a[1] - b[1])
        .map(([k]) => k),
      favoredOpcodes: Object.entries(row.opcodes)
        .filter(([, w]) => w > 0.1)
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => k),
      totalFeedback: row.totalFeedback,
    }
  }

  export function applyFeedback(ev: FeedbackEvent): void {
    if (!MemoryDB.isReady()) return
    try {
      const dir = directionFor(ev)
      const row = readRow()
      const { techniques, opcodes } = tagsFromEvent(ev)
      const next: LearningRow = {
        techniques: dir === 0 ? row.techniques : bumpWeights(row.techniques, techniques, dir),
        opcodes: dir === 0 ? row.opcodes : bumpWeights(row.opcodes, opcodes, dir),
        totalFeedback: row.totalFeedback + 1,
        updatedAt: Date.now(),
      }
      writeRow(next)
      Bus.emit('memory:learning-updated', get())
    } catch (err: any) {
      Log.warn(`memory applyFeedback failed: ${err?.message}`)
    }
  }
}

function readRow(): LearningRow {
  const fallback: LearningRow = {
    techniques: {},
    opcodes: {},
    totalFeedback: 0,
    updatedAt: Date.now(),
  }
  if (!MemoryDB.isReady()) return fallback
  try {
    const r = MemoryDB.raw().prepare(`SELECT * FROM learning WHERE id = ?`).get(SINGLETON_ID) as any
    if (!r) return fallback
    return {
      techniques: safeJson(r.techniques) ?? {},
      opcodes: safeJson(r.opcodes) ?? {},
      totalFeedback: r.total_feedback,
      updatedAt: r.updated_at,
    }
  } catch {
    return fallback
  }
}

function writeRow(p: LearningRow): void {
  if (!MemoryDB.isReady()) return
  MemoryDB.raw()
    .prepare(
      `UPDATE learning SET
         techniques = @techniques,
         opcodes = @opcodes,
         total_feedback = @totalFeedback,
         updated_at = @updatedAt
       WHERE id = @id`,
    )
    .run({
      id: SINGLETON_ID,
      techniques: JSON.stringify(p.techniques),
      opcodes: JSON.stringify(p.opcodes),
      totalFeedback: p.totalFeedback,
      updatedAt: p.updatedAt,
    })
}

function safeJson(s: string): any {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
