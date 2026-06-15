import { readFileSync } from 'fs'
import { Log } from '../util/log'

export interface KnowledgeChunk {
  id: string
  source: string
  content: string
  priority: number
}

/** Curated markdown/txt from resources/knowledge — antipatterns, patterns, syntax rules. */
const SOURCE_FILES: { file: string; label: string; priority: number }[] = [
  { file: 'sources/antipatterns.md', label: 'Csound 7 Anti-Patterns', priority: 5 },
  { file: 'sources/patterns.md', label: 'Csound 7 Patterns', priority: 4 },
  { file: 'sources/syntax-rules.md', label: 'Csound 7 Syntax Rules', priority: 4 },
  { file: 'sources/opcodes.md', label: 'Opcode Reference Notes', priority: 3 },
  { file: 'csound7-reference.txt', label: 'Csound 7 LLM Reference', priority: 3 },
  { file: 'sources/csound7-llms-reference.md', label: 'Csound 7 LLMs Reference', priority: 3 },
  { file: 'sources/lazzarini-web.md', label: 'Lazzarini Web Notes', priority: 2 },
]

let chunks: KnowledgeChunk[] = []
let initialized = false

function chunkMarkdown(content: string, sourceId: string, label: string, priority: number): KnowledgeChunk[] {
  const sections = content.split(/\n(?=## )/)
  const out: KnowledgeChunk[] = []
  for (let i = 0; i < sections.length; i++) {
    const body = sections[i].trim()
    if (body.length < 50) continue
    out.push({
      id: `${sourceId}#${i}`,
      source: label,
      content: body.slice(0, 1400),
      priority,
    })
  }
  if (out.length === 0 && content.trim().length > 50) {
    out.push({
      id: sourceId,
      source: label,
      content: content.trim().slice(0, 1400),
      priority,
    })
  }
  return out
}

export function initKnowledgeSources(findResource: (filename: string) => string | null): void {
  if (initialized) return
  for (const { file, label, priority } of SOURCE_FILES) {
    const path = findResource(file)
    if (!path) {
      Log.warn(`Knowledge source not found: ${file}`)
      continue
    }
    try {
      const text = readFileSync(path, 'utf-8')
      const sourceId = file.replace(/[^\w]+/g, '-')
      const added = chunkMarkdown(text, sourceId, label, priority)
      chunks.push(...added)
      Log.info(`Knowledge: ${label} → ${added.length} chunks`)
    } catch (err: any) {
      Log.warn(`Knowledge source read failed ${file}: ${err?.message ?? err}`)
    }
  }
  initialized = true
  Log.info(`Knowledge sources ready: ${chunks.length} searchable chunks`)
}

export function searchKnowledgeSources(
  query: string,
  max = 3,
): { id: string; source: string; content: string; score: number }[] {
  if (chunks.length === 0) return []
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2)
  if (terms.length === 0) return []

  const scored: { id: string; source: string; content: string; score: number }[] = []
  for (const chunk of chunks) {
    const lower = chunk.content.toLowerCase()
    let score = chunk.priority
    for (const term of terms) {
      const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const count = (lower.match(new RegExp(esc, 'g')) || []).length
      if (count > 0) score += Math.log2(1 + count)
    }
    // Always surface anti-patterns when FM / envelope / expseg mentioned
    if (chunk.source.includes('Anti-Pattern') && /\b(fm|foscil|expseg|linsegr|envelope|vco2)\b/i.test(query)) {
      score += 2
    }
    if (score > chunk.priority) {
      scored.push({ id: chunk.id, source: chunk.source, content: chunk.content, score })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, max)
}

export function knowledgeChunkCount(): number {
  return chunks.length
}
