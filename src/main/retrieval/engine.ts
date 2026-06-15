import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { Log } from '../util/log'
import { isProPlus } from '../util/tier'
import { searchPassages } from './passages'
import { initKnowledgeSources, searchKnowledgeSources } from './knowledge-sources'
import { initCsoundQtExamples, searchCsoundQtExamples } from './csoundqt-examples'

export interface RetrievalChunk {
  id: string
  content: string
  source: string
  score: number
}

export interface OpcodeCard {
  name: string
  category: string
  syntax: string
  description: string
  parameters: string[]
  seeAlso: string[]
  domain: string
  tags: string[]
  exampleIDs: string[]
}

// CSD examples: id -> full CSD content
let csdExamples: Map<string, string> = new Map()
let opcodeCards: OpcodeCard[] = []
let opcodeMap: Map<string, OpcodeCard> = new Map()
let knowledgeGraph: { nodes: any[]; edges: any[] } = { nodes: [], edges: [] }
let bookLines: string[] = []
let initialized = false

function findResource(filename: string): string | null {
  const candidates = [
    join(__dirname, '../../resources/knowledge', filename),
    join(__dirname, '../../../resources/knowledge', filename),
    join(process.cwd(), 'resources/knowledge', filename),
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

function findGoldenStarter(filename: string): string | null {
  const candidates = [
    join(__dirname, '../../resources/workshop-starters', filename),
    join(__dirname, '../../../resources/workshop-starters', filename),
    join(process.cwd(), 'resources/workshop-starters', filename),
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

function loadJSON<T>(filename: string): T | null {
  const path = findResource(filename)
  if (!path) { Log.warn(`Not found: ${filename}`); return null }
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch (err: any) {
    Log.error(`Parse error ${filename}: ${err.message}`)
    return null
  }
}

export namespace Retrieval {
  export function init(): void {
    if (initialized) return
    Log.info('Initializing RAG engine...')

    // Load core bundle: opcode cards + knowledge graph
    const core = loadJSON<{ opcodeCards: OpcodeCard[]; graph: { nodes: any[]; edges: any[] } }>('bundle-core.json')
    if (core) {
      opcodeCards = core.opcodeCards || []
      opcodeMap = new Map(opcodeCards.map((c) => [c.name.toLowerCase(), c]))
      knowledgeGraph = core.graph || { nodes: [], edges: [] }
      Log.info(`Core: ${opcodeCards.length} opcodes, ${knowledgeGraph.nodes.length} graph nodes, ${knowledgeGraph.edges.length} edges`)
    }

    // Load CSD examples bundle
    const csd = loadJSON<{ contents: Record<string, string> }>('bundle-csd.json')
    if (csd?.contents) {
      csdExamples = new Map(Object.entries(csd.contents))
      Log.info(`CSD examples: ${csdExamples.size} files`)
    }

    // Load csound_book.txt for full-text search
    const bookPath = findResource('csound_book.txt')
    if (bookPath) {
      bookLines = readFileSync(bookPath, 'utf-8').split('\n')
      Log.info(`Book: ${bookLines.length} lines`)
    }

    initKnowledgeSources(findResource)
    try {
      initCsoundQtExamples()
    } catch (err: any) {
      Log.warn(`CsoundQt init failed: ${err?.message ?? err}`)
    }

    initialized = true
    Log.info('RAG engine ready')
  }

  export function lookupOpcode(name: string): OpcodeCard | undefined {
    return opcodeMap.get(name.toLowerCase())
  }

  export function searchOpcodes(query: string): OpcodeCard[] {
    const q = query.toLowerCase()
    return opcodeCards
      .filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      )
      .slice(0, 10)
  }

  // Get CSD example by ID (used by opcode cards)
  export function getCsdExample(id: string): string | undefined {
    return csdExamples.get(id)
  }

  // Find relevant CSD examples by keyword search
  export function searchExamples(query: string, max = 3): { id: string; content: string; score: number }[] {
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2)
    if (terms.length === 0) return []

    const scored: { id: string; content: string; score: number }[] = []
    for (const [id, content] of csdExamples) {
      const lower = content.toLowerCase()
      let score = 0
      for (const term of terms) {
        const count = (lower.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
        if (count > 0) score += Math.log2(1 + count)
      }
      // Boost catalog examples from authoritative sources (Dr. B standing rule)
      if (id.startsWith('flossmanual')) score *= 4
      else if (id.startsWith('lazzarinispectral') || id.startsWith('lazzarinicsound')) score *= 3.5
      else if (id.startsWith('lazzarini')) score *= 3
      else if (id.startsWith('hornerbook')) score *= 2.5
      if (terms.some((t) => id.toLowerCase().includes(t))) score *= 2
      if (score > 0) scored.push({ id, content: content.slice(0, 2000), score })
    }

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, max)
  }

  // Search the csound book text
  export function searchBook(query: string, max = 4): RetrievalChunk[] {
    if (bookLines.length === 0) return []
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2)
    if (terms.length === 0) return []

    const results: RetrievalChunk[] = []
    const windowSize = 20

    for (let i = 0; i < bookLines.length - windowSize; i += windowSize / 2) {
      const window = bookLines.slice(i, i + windowSize).join('\n')
      const lower = window.toLowerCase()
      let score = 0
      for (const term of terms) {
        const count = (lower.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
        if (count > 0) score += Math.log2(1 + count)
      }
      if (score > 1) {
        results.push({ id: `book_${i}`, content: window, source: 'csound_book', score })
      }
    }

    results.sort((a, b) => b.score - a.score)
    return results.slice(0, max)
  }

  // Full RAG search: opcodes + examples + book
  export function search(query: string, maxResults = 8): RetrievalChunk[] {
    init()
    const all: RetrievalChunk[] = []

    // CSD examples
    const examples = searchExamples(query, 3)
    for (const ex of examples) {
      all.push({ id: ex.id, content: ex.content, source: 'csd_example', score: ex.score })
    }

    // Book text
    const bookChunks = searchBook(query, 4)
    all.push(...bookChunks)

    all.sort((a, b) => b.score - a.score)
    return all.slice(0, maxResults)
  }

  // Build RAG context for prompt injection
  export function formatForPrompt(query: string): string {
    init()
    const parts: string[] = []
    const q = query.toLowerCase()
    const cap = isProPlus() ? 6000 : 3000

    // Book-verified golden patterns (Boulanger workshop starters)
    if (/\b(fm|bell|chime|foscil)\b/.test(q)) {
      const golden = findGoldenStarter('fm_bell_starter.csd')
      if (golden) {
        parts.push(
          `<golden-pattern source="Dr.B FM bell starter (verified Csound 7)">\n` +
          `${readFileSync(golden, 'utf-8').slice(0, 2200)}\n</golden-pattern>`,
        )
      }
    }

    // Curated knowledge docs (antipatterns, patterns, syntax rules)
    const docHits = searchKnowledgeSources(query, isProPlus() ? 3 : 2)
    for (const doc of docHits) {
      parts.push(
        `<knowledge-doc source="${doc.source}">\n${doc.content.slice(0, 900)}\n</knowledge-doc>`,
      )
    }

    // Extracted book passages (The Csound Book) — richer than raw line windows
    const bookHits = searchPassages(query, isProPlus() ? 4 : 2)
    for (const p of bookHits) {
      parts.push(
        `<book-passage source="${p.source_book}" page="${p.source_page ?? ''}">\n${p.content.slice(0, 600)}\n</book-passage>`,
      )
    }

    // Always pin foscili when FM is mentioned
    if (/\b(fm|bell|chime|foscil|modulat)\b/.test(q)) {
      const card = opcodeMap.get('foscili')
      if (card) {
        parts.push(
          `<opcode name="foscili" critical="true">` +
          `Syntax: ares foscili xamp, kcps, xcar, xmod, kndx, ifn — ONE FM opcode (Chowning). ` +
          `NOT two separate foscili lines. ${card.description}</opcode>`,
        )
      }
    }

    // Opcode lookups from query tokens
    const opcodeRe = /\b([a-z][a-z0-9_]{2,})\b/gi
    const matches = query.match(opcodeRe) || []
    const seen = new Set<string>(['foscili'])
    for (const m of matches) {
      const name = m.toLowerCase()
      if (seen.has(name)) continue
      seen.add(name)
      const card = opcodeMap.get(name)
      if (card) {
        parts.push(`<opcode name="${card.name}" category="${card.category}">${card.description}${card.seeAlso.length ? ` | See also: ${card.seeAlso.join(', ')}` : ''}</opcode>`)
        if (card.exampleIDs.length > 0) {
          const ex = csdExamples.get(card.exampleIDs[0])
          if (ex) {
            parts.push(`<example id="${card.exampleIDs[0]}">\n${ex.slice(0, 1200)}\n</example>`)
          }
        }
      }
    }

    // CsoundQt local examples (McCurdy Collection, FLOSS Manual Examples)
    const qtHits = searchCsoundQtExamples(query, isProPlus() ? 3 : 2)
    for (const ex of qtHits) {
      parts.push(
        `<catalog-example id="${ex.id}" source="CsoundQt ${ex.collection}">\n${ex.content.slice(0, 1500)}\n</catalog-example>`,
      )
    }

    // Catalog CSDs (FLOSS Manual, Lazzarini, Horner / Boulanger) — adapt before inventing
    const catalogExamples = searchExamples(query, isProPlus() ? 4 : 2)
    for (const ex of catalogExamples) {
      const src = ex.id.startsWith('flossmanual') ? 'FLOSS Manual'
        : ex.id.startsWith('lazzarini') ? 'Lazzarini'
        : ex.id.startsWith('hornerbook') ? 'Csound Book (Horner)'
        : 'Csound Catalog'
      parts.push(
        `<catalog-example id="${ex.id}" source="${src}">\n${ex.content.slice(0, 1500)}\n</catalog-example>`,
      )
    }

    const chunks = search(query, isProPlus() ? 6 : 4)
    for (const chunk of chunks) {
      parts.push(`<reference source="${chunk.source}">\n${chunk.content.slice(0, isProPlus() ? 1000 : 800)}\n</reference>`)
    }

    let total = ''
    for (const p of parts) {
      if (total.length + p.length > cap) break
      total += p + '\n'
    }

    return total
  }
}
