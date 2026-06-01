import { MemoryStore } from './store'
import { Learning } from './learning'
import type { ErrorFixRow } from './schema'

// Turns stored memory into token-bounded prompt blocks. Ranking deliberately
// mirrors the RAG engine's log-weighted token overlap (retrieval/passages.ts)
// rather than introducing embeddings — it's fast over the small error_fixes
// table and adds no dependencies.

function scoreFix(queryTokens: Set<string>, row: ErrorFixRow, queryKind?: string): number {
  let overlap = 0
  for (const t of row.tokens) if (queryTokens.has(t)) overlap += 1
  if (overlap === 0) return 0
  const relevance = Math.log2(1 + overlap) + overlap * 0.25
  const ageDays = (Date.now() - row.createdAt) / 86_400_000
  const recency = Math.exp(-ageDays / 30)
  const kindBoost = queryKind && row.kind === queryKind ? 1.5 : 1
  return relevance * (0.7 + 0.3 * recency) * kindBoost
}

export namespace MemoryRetrieval {
  export function relevantErrorFixes(
    errorRaw: string,
    k = 2,
    kind?: string,
  ): ErrorFixRow[] {
    const all = MemoryStore.allErrorFixes()
    if (all.length === 0) return []
    const { tokens } = MemoryStore.signatureOf(errorRaw)
    const queryTokens = new Set(tokens)
    return all
      .map((row) => ({ row, score: scoreFix(queryTokens, row, kind) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((x) => x.row)
  }

  // Lessons whose wording overlaps the current request — these are the ones to
  // surface inline with the user's message so the model can't skip them.
  export function matchedLessons(userText: string, max = 3): string[] {
    const lessons = MemoryStore.allLessons()
    if (lessons.length === 0) return []
    const userTokens = new Set(
      userText.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/)
        .filter((t) => t.length >= 4)
        .map((t) => t.replace(/s$/, '')), // crude singularize so "textures"~"texture"
    )
    if (userTokens.size === 0) return []
    const hits: string[] = []
    for (const l of lessons) {
      const lt = l.text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).map((t) => t.replace(/s$/, ''))
      if (lt.some((t) => t.length >= 4 && userTokens.has(t))) hits.push(l.text)
      if (hits.length >= max) break
    }
    return hits
  }

  // Durable instructions the user has stated. ALWAYS injected (across sessions)
  // and given strong framing — these are explicit user rules, not soft hints.
  export function lessonsBlock(maxChars = 1500): string {
    const lessons = MemoryStore.allLessons()
    if (lessons.length === 0) return ''
    const lines = [
      `<remembered-instructions>`,
      `Standing rules this user has explicitly given you. They are BINDING and OVERRIDE your default approach. Realize each rule concretely in the generated code, not just in prose. When a rule and your usual habit conflict, the rule wins. Only ignore a rule if the current request explicitly overrides it:`,
    ]
    let budget = maxChars
    for (const l of lessons) {
      const entry = `- ${l.text}`
      if (entry.length > budget) break
      lines.push(entry)
      budget -= entry.length
    }
    lines.push(`</remembered-instructions>`)
    return lines.join('\n')
  }

  // Feedback-learned guidance — what to lean toward and what to avoid, derived
  // from this user's 👍/👎 and accepted fixes. Soft preference, not a rule.
  // Empty until the user has actually given feedback.
  export function learningBlock(maxChars = 400): string {
    const p = Learning.get()
    const favored = p.favored.slice(0, 5)
    const disfavored = p.disfavored.slice(0, 4)
    const favoredOpcodes = p.favoredOpcodes.slice(0, 6)
    if (favored.length === 0 && disfavored.length === 0 && favoredOpcodes.length === 0) return ''
    const lines: string[] = [`<learned-guidance>`]
    if (favored.length)
      lines.push(`The user has responded well to: ${favored.join(', ')}.`)
    if (favoredOpcodes.length)
      lines.push(`Opcodes that landed well: ${favoredOpcodes.join(', ')}.`)
    if (disfavored.length)
      lines.push(`The user reacted poorly to: ${disfavored.join(', ')} — avoid unless asked.`)
    lines.push(`Treat as soft preference learned from feedback, not a hard requirement.`)
    lines.push(`</learned-guidance>`)
    return lines.join('\n').slice(0, maxChars)
  }

  // Only injected on autofix turns: prior fixes for similar errors.
  export function errorFixBlock(errorRaw: string, kind?: string, maxChars = 1800): string {
    const hits = relevantErrorFixes(errorRaw, 2, kind)
    if (hits.length === 0) return ''
    const parts: string[] = [
      `<error-fix-memory>`,
      `You have fixed similar errors before. Reuse what worked:`,
    ]
    let budget = maxChars
    for (const h of hits) {
      MemoryStore.bumpErrorFixUse(h.id)
      const broken = (h.brokenCsd ?? '').slice(0, 800)
      const fixed = h.fixedCsd.slice(0, 800)
      const entry = [
        `--- past ${h.kind} error: ${h.errorRaw.slice(0, 200)}`,
        h.diffSummary ? `fix summary: ${h.diffSummary}` : '',
        broken ? `before:\n${broken}` : '',
        `after (worked):\n${fixed}`,
      ]
        .filter(Boolean)
        .join('\n')
      if (entry.length > budget) break
      parts.push(entry)
      budget -= entry.length
    }
    parts.push(`</error-fix-memory>`)
    return parts.join('\n')
  }
}
