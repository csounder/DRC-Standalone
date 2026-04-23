#!/usr/bin/env node
/**
 * Offline knowledge extractor for the DrC Csound book corpus.
 *
 * Pipeline:
 *   1. For each PDF in Dr.C/knowledge/books, run `pdftotext` once and cache.
 *   2. Chunk the text at ~10k char boundaries on paragraph breaks.
 *   3. Call Claude Haiku with a strict JSON-schema extraction prompt per chunk.
 *   4. Merge entities / edges / passages across all books, dedupe by id.
 *   5. Write expanded graph + passage index to resources/.
 *
 * Runs incrementally with a checkpoint — can resume if interrupted.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... node scripts/extract-knowledge.mjs
 *   node scripts/extract-knowledge.mjs --book csound-book          # one book
 *   node scripts/extract-knowledge.mjs --dry-run                    # no LLM calls
 *   node scripts/extract-knowledge.mjs --max-chunks 3               # smoke test
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const BOOKS_DIR = '/Users/mateolarreaferro/Desktop/repos/Dr.C/knowledge/books'
const CACHE_DIR = join(__dirname, '.cache', 'books')
const CHECKPOINT_DIR = join(__dirname, '.cache', 'checkpoints')
const OUT_GRAPH = join(REPO_ROOT, 'resources', 'graph', 'computer-music-history.json')
const OUT_PASSAGES = join(REPO_ROOT, 'resources', 'knowledge', 'book-passages.json')
const OUT_BACKUP = join(REPO_ROOT, 'resources', 'graph', 'computer-music-history.hand-curated.backup.json')

const CHUNK_CHARS = 10_000     // ~2,500 tokens
const MAX_PARALLEL = 3          // concurrent Claude calls
const MODEL = 'claude-haiku-4-5'

const args = process.argv.slice(2)
const FLAGS = {
  dryRun: args.includes('--dry-run'),
  singleBook: args.includes('--book') ? args[args.indexOf('--book') + 1] : null,
  maxChunks: args.includes('--max-chunks') ? parseInt(args[args.indexOf('--max-chunks') + 1], 10) : null,
}

// ─── Books inventory ──────────────────────────────────────────────────────────

// Six text-extractable books with narrative content. Excluded:
//   • "Cooking with Csound" — scanned images only (needs OCR)
//   • "Csound Canonical Manual 6.18" — 621 chunks of opcode reference, redundant
//     with the FLOSS manual for historical context and already covered by the
//     existing opcode card index.
const BOOKS = [
  { id: 'lazzarini-instruments', title: 'Computer Music Instruments (Lazzarini)', pdf: '_BOOK-Computer Music Instruments I - Lazzarini/Victor Lazzarini - Computer Music Instruments.pdf' },
  { id: 'lazzarini-csound',      title: 'Csound (Lazzarini)', pdf: '_BOOK-Csound - Lazzarini/Victor Lazzarini - Csound.pdf' },
  { id: 'floss-manual',          title: 'Csound FLOSS Manual 8.1.1', pdf: '_BOOK-MANUAL-Csound FLOSS Manual 8.1.1-PDF/csound-flossmanual-8.1.1.pdf' },
  { id: 'zucco-synthesis',       title: 'Sound Synthesis with Csound (Zucco)', pdf: '_BOOK-Sound Synthesis with Csound - Zucco/SoundSynthesiswithCsound.pdf' },
  { id: 'boulanger-csound-book', title: 'The Csound Book (Boulanger)', pdf: '_BOOK-The Csound Book - Boulanger/The Csound Book - Perspectives in Software Synthesis, Sound Design, Signal Processing, and Programming.pdf' },
  { id: 'virtual-sound',         title: 'Virtual Sound (Bianchini & Cipriani)', pdf: '_BOOK-Virtual Sound - Bianchini & Cipriani/VirtualSound.pdf' },
]

// ─── API key resolution ───────────────────────────────────────────────────────

function resolveAnthropicKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY
  // Fallback: read from DrC userData config.json
  const cfg = join(homedir(), 'Library', 'Application Support', 'drc', 'drc', 'config.json')
  if (existsSync(cfg)) {
    try {
      const data = JSON.parse(readFileSync(cfg, 'utf-8'))
      if (data.anthropicKey) return data.anthropicKey
    } catch {}
  }
  return null
}

// ─── PDF → text ───────────────────────────────────────────────────────────────

function extractBookText(book) {
  mkdirSync(CACHE_DIR, { recursive: true })
  const cachePath = join(CACHE_DIR, `${book.id}.txt`)
  if (existsSync(cachePath)) {
    const stat = statSync(cachePath)
    if (stat.size > 1024) {
      console.log(`  [cache] ${book.id} (${fmt(stat.size)})`)
      return readFileSync(cachePath, 'utf-8')
    }
  }
  const pdfPath = join(BOOKS_DIR, book.pdf)
  if (!existsSync(pdfPath)) {
    console.warn(`  [missing] ${pdfPath}`)
    return ''
  }
  console.log(`  [extract] ${book.id} (${fmt(statSync(pdfPath).size)} pdf)`)
  try {
    execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', pdfPath, cachePath], { stdio: 'inherit' })
    const out = readFileSync(cachePath, 'utf-8')
    console.log(`  [extracted] ${book.id} → ${fmt(out.length)} chars`)
    return out
  } catch (err) {
    console.error(`  [pdftotext failed] ${book.id}:`, err.message)
    return ''
  }
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

function chunkText(text, maxLen = CHUNK_CHARS) {
  // Collapse excessive whitespace to save tokens, keep paragraph structure.
  const cleaned = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  const chunks = []
  let cursor = 0
  while (cursor < cleaned.length) {
    let end = Math.min(cleaned.length, cursor + maxLen)
    if (end < cleaned.length) {
      // Try to break at a paragraph boundary within the last 2000 chars
      const slice = cleaned.slice(cursor, end)
      const breakIdx = slice.lastIndexOf('\n\n', maxLen)
      if (breakIdx > maxLen - 2000) {
        end = cursor + breakIdx
      }
    }
    const chunk = cleaned.slice(cursor, end).trim()
    if (chunk.length > 500) chunks.push(chunk)
    cursor = end
  }
  return chunks
}

// ─── Extraction prompt ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You extract structured knowledge about computer music from book passages.

Emit exactly ONE JSON object. No prose, no markdown fence, no commentary.

Schema:
{
  "entities": [
    {
      "id": "lowercase-kebab-case-id",
      "type": "person" | "organization" | "place" | "concept" | "technology" | "work" | "event",
      "label": "Human-readable name",
      "description": "1-2 sentence factual summary from the passage",
      "year": 1967 | null,
      "aliases": ["Optional alternate names"]
    }
  ],
  "edges": [
    {
      "source": "entity-id",
      "target": "entity-id",
      "type": "invented" | "studied_at" | "founded" | "collaborated_with" | "influenced" | "developed" | "published" | "worked_at" | "taught" | "used" | "created" | "located_in",
      "weight": 0.5,
      "description": "One sentence context for this relationship"
    }
  ],
  "passages": [
    {
      "topic_tags": ["fm synthesis", "chowning"],
      "content": "A verbatim or lightly-edited quote of 2-5 sentences. Prefer spans with named people, places, dates, or concrete technique descriptions.",
      "source_page": null
    }
  ]
}

RULES:
- Only extract what is FACTUALLY stated — do not invent years, affiliations, or relations.
- ids: lowercase-kebab-case, globally stable ("John Chowning" → "john-chowning", "CCRMA" → "ccrma", "FM synthesis" → "fm-synthesis").
- Entity types:
  • person: named individuals (composers, researchers, theorists).
  • organization: labs, studios, universities, groups (CCRMA, IRCAM, Bell Labs, GRM).
  • place: cities / regions only when meaningful (Stanford, Paris).
  • concept: techniques, theories, musical genres (granular synthesis, spectralism).
  • technology: languages, tools, systems (Csound, MUSIC V, DX7, SuperCollider, opcodes).
  • work: specific pieces / books / compositions (Silver Apples of the Moon, Kontakte).
  • event: notable happenings (first DX7 release, Gesang der Jünglinge premiere).
- Every edge's source and target must reference an entity id you included in this response OR a well-known canonical id (john-chowning, ccrma, bell-labs, ircam, stanford, mit, csound-lang, music-v, fm-synthesis, granular-synthesis, physical-modeling, subtractive-synthesis, additive-synthesis, max-mathews, barry-vercoe, jean-claude-risset, iannis-xenakis, karlheinz-stockhausen, curtis-roads, victor-lazzarini, richard-boulanger).
- Prefer these canonical ids when the entity matches.
- edge weight: 0.3 for mentions, 0.6 for clear relationships, 0.9 for defining/founding relationships.
- Passages: 2-5 sentences each. Must contain concrete information worth quoting — named people, techniques, dates, or places. Skip boilerplate, indexes, and TOCs.
- topic_tags: 1-4 lowercase tags naming the musical/technical subject (e.g. "granular synthesis", "moog ladder filter", "csound score", "opcode reference").
- If the chunk has no extractable knowledge (index, table of contents, code listings only), return {"entities":[],"edges":[],"passages":[]}.
- Limit output: max 20 entities, 20 edges, 5 passages per chunk. Pick the best.`

function buildUserPrompt(bookTitle, chunkIdx, totalChunks, chunkText) {
  return `Book: ${bookTitle}\nChunk: ${chunkIdx + 1} of ${totalChunks}\n\n=== PASSAGE START ===\n${chunkText}\n=== PASSAGE END ===`
}

// ─── Claude call ──────────────────────────────────────────────────────────────

async function extractChunk(model, bookTitle, chunkIdx, totalChunks, chunk) {
  if (FLAGS.dryRun) {
    return { entities: [], edges: [], passages: [] }
  }
  const userPrompt = buildUserPrompt(bookTitle, chunkIdx, totalChunks, chunk)
  try {
    const { text } = await generateText({
      model,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.1,
      maxTokens: 4000,
    })
    return parseResponse(text)
  } catch (err) {
    console.error(`  [chunk ${chunkIdx + 1}] error:`, err.message)
    return { entities: [], edges: [], passages: [], error: err.message }
  }
}

function parseResponse(raw) {
  const stripped = raw.trim()
    .replace(/^```(?:json)?\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
  try {
    const obj = JSON.parse(stripped)
    return {
      entities: Array.isArray(obj.entities) ? obj.entities : [],
      edges: Array.isArray(obj.edges) ? obj.edges : [],
      passages: Array.isArray(obj.passages) ? obj.passages : [],
    }
  } catch (err) {
    // Try to salvage the first { ... } block
    const m = stripped.match(/\{[\s\S]*\}/)
    if (m) {
      try {
        const obj = JSON.parse(m[0])
        return {
          entities: Array.isArray(obj.entities) ? obj.entities : [],
          edges: Array.isArray(obj.edges) ? obj.edges : [],
          passages: Array.isArray(obj.passages) ? obj.passages : [],
        }
      } catch {}
    }
    return { entities: [], edges: [], passages: [], parseError: err.message }
  }
}

// ─── Parallel dispatch ────────────────────────────────────────────────────────

async function processBook(model, book) {
  console.log(`\n┌─ ${book.title}`)
  const text = extractBookText(book)
  if (!text) return { entities: [], edges: [], passages: [] }

  let chunks = chunkText(text)
  if (FLAGS.maxChunks) chunks = chunks.slice(0, FLAGS.maxChunks)
  console.log(`│  ${chunks.length} chunks`)

  // Resume from checkpoint if present
  mkdirSync(CHECKPOINT_DIR, { recursive: true })
  const checkpointPath = join(CHECKPOINT_DIR, `${book.id}.json`)
  let processed = []
  if (existsSync(checkpointPath)) {
    try {
      const data = JSON.parse(readFileSync(checkpointPath, 'utf-8'))
      if (data.count === chunks.length && Array.isArray(data.results)) {
        console.log(`│  [checkpoint] resuming ${data.results.length}/${data.count} chunks`)
        processed = data.results
      }
    } catch {}
  }

  const all = { entities: [], edges: [], passages: [] }
  for (const r of processed) {
    if (r && !r.error) {
      all.entities.push(...(r.entities || []))
      all.edges.push(...(r.edges || []))
      all.passages.push(...(r.passages || []).map((p) => ({ ...p, source_book: book.id })))
    }
  }

  for (let i = processed.length; i < chunks.length; i += MAX_PARALLEL) {
    const batchStart = Date.now()
    const batch = chunks.slice(i, i + MAX_PARALLEL)
    const results = await Promise.all(
      batch.map((c, k) => extractChunk(model, book.title, i + k, chunks.length, c))
    )
    for (let k = 0; k < results.length; k++) {
      const r = results[k]
      if (!r || r.error) continue
      all.entities.push(...(r.entities || []))
      all.edges.push(...(r.edges || []))
      all.passages.push(...(r.passages || []).map((p) => ({ ...p, source_book: book.id })))
    }
    processed = processed.concat(results)
    // Checkpoint after each batch (skip in dry-run so we don't poison real runs)
    if (!FLAGS.dryRun) {
      writeFileSync(checkpointPath, JSON.stringify({ count: chunks.length, results: processed }, null, 2))
    }

    const elapsed = ((Date.now() - batchStart) / 1000).toFixed(1)
    const doneTotal = Math.min(i + batch.length, chunks.length)
    const ent = results.reduce((a, r) => a + (r?.entities?.length || 0), 0)
    const edg = results.reduce((a, r) => a + (r?.edges?.length || 0), 0)
    const pas = results.reduce((a, r) => a + (r?.passages?.length || 0), 0)
    console.log(`│  [${doneTotal}/${chunks.length}] +${ent}e/+${edg}ed/+${pas}p (${elapsed}s)`)
  }

  console.log(`└─ done: ${all.entities.length} ent, ${all.edges.length} edg, ${all.passages.length} pas`)
  return all
}

// ─── Merge & dedupe ───────────────────────────────────────────────────────────

function slugify(s) {
  return String(s || '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function mergeKnowledge(sources) {
  const entities = new Map() // id → {id, type, label, description, year, aliases}
  const edgeKeys = new Map() // "src|type|tgt" → {source, target, type, weight, description}
  const passages = []
  let passageSeq = 0

  for (const src of sources) {
    for (const e of src.entities || []) {
      const id = slugify(e.id)
      if (!id) continue
      const existing = entities.get(id)
      if (!existing) {
        entities.set(id, {
          id,
          type: e.type || 'concept',
          label: e.label || id,
          description: e.description || '',
          year: typeof e.year === 'number' ? e.year : null,
          aliases: Array.isArray(e.aliases) ? e.aliases.slice(0, 5) : [],
        })
      } else {
        // Merge: prefer longer description; union aliases; first non-null year
        if (!existing.description || (e.description && e.description.length > existing.description.length)) {
          existing.description = e.description
        }
        if (existing.year == null && typeof e.year === 'number') existing.year = e.year
        const seen = new Set(existing.aliases.map((a) => a.toLowerCase()))
        for (const a of e.aliases || []) {
          if (a && !seen.has(a.toLowerCase())) existing.aliases.push(a)
        }
        existing.aliases = existing.aliases.slice(0, 8)
      }
    }
    for (const ed of src.edges || []) {
      const s = slugify(ed.source)
      const t = slugify(ed.target)
      const tp = ed.type || 'influenced'
      if (!s || !t || s === t) continue
      const key = `${s}|${tp}|${t}`
      const existing = edgeKeys.get(key)
      if (!existing) {
        edgeKeys.set(key, {
          source: s,
          target: t,
          type: tp,
          weight: typeof ed.weight === 'number' ? Math.min(1, Math.max(0.1, ed.weight)) : 0.5,
          description: ed.description || undefined,
        })
      } else {
        existing.weight = Math.min(1.0, existing.weight + 0.1)
      }
    }
    for (const p of src.passages || []) {
      if (!p?.content || p.content.length < 30) continue
      passages.push({
        id: `p_${passageSeq++}`,
        topic_tags: Array.isArray(p.topic_tags) ? p.topic_tags : [],
        content: p.content.trim(),
        source_book: p.source_book || 'unknown',
        source_page: p.source_page ?? null,
      })
    }
  }

  // Filter edges that reference missing entities (keep if target is a canonical id)
  const validIds = new Set(entities.keys())
  const edges = Array.from(edgeKeys.values()).filter((e) => validIds.has(e.source) && validIds.has(e.target))

  return {
    nodes: Array.from(entities.values()),
    edges,
    passages,
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n > 1_000_000) return (n / 1_000_000).toFixed(1) + 'MB'
  if (n > 1_000) return (n / 1_000).toFixed(1) + 'KB'
  return n + 'B'
}

async function main() {
  console.log('DrC — Knowledge Extractor')
  console.log('=========================')

  if (!FLAGS.dryRun) {
    const key = resolveAnthropicKey()
    if (!key) {
      console.error('\nNo ANTHROPIC_API_KEY set and no key found in DrC config.')
      console.error('Run with: ANTHROPIC_API_KEY=sk-ant-... node scripts/extract-knowledge.mjs')
      process.exit(1)
    }
    process.env.ANTHROPIC_API_KEY = key
  }

  const anthropic = createAnthropic()
  const model = anthropic(MODEL)

  const booksToProcess = FLAGS.singleBook
    ? BOOKS.filter((b) => b.id === FLAGS.singleBook)
    : BOOKS

  if (!booksToProcess.length) {
    console.error(`No book matches --book "${FLAGS.singleBook}"`)
    console.error('Known ids:', BOOKS.map((b) => b.id).join(', '))
    process.exit(1)
  }

  const overallStart = Date.now()
  const results = []
  for (const book of booksToProcess) {
    const r = await processBook(model, book)
    results.push(r)
  }

  console.log('\n─── Merging ───')
  const merged = mergeKnowledge(results)
  console.log(`Merged: ${merged.nodes.length} entities, ${merged.edges.length} edges, ${merged.passages.length} passages`)

  // Back up existing hand-curated graph once
  if (!existsSync(OUT_BACKUP) && existsSync(OUT_GRAPH)) {
    writeFileSync(OUT_BACKUP, readFileSync(OUT_GRAPH, 'utf-8'))
    console.log(`[backup] wrote ${OUT_BACKUP}`)
  }

  // If running on a single book, merge with existing graph instead of replacing
  let finalGraph = { nodes: merged.nodes, edges: merged.edges }
  if (FLAGS.singleBook && existsSync(OUT_GRAPH)) {
    const existing = JSON.parse(readFileSync(OUT_GRAPH, 'utf-8'))
    const merged2 = mergeKnowledge([
      { entities: existing.nodes || [], edges: existing.edges || [], passages: [] },
      { entities: merged.nodes, edges: merged.edges, passages: [] },
    ])
    finalGraph = { nodes: merged2.nodes, edges: merged2.edges }
    console.log(`[merge-into-existing] final: ${finalGraph.nodes.length} nodes, ${finalGraph.edges.length} edges`)
  }

  mkdirSync(dirname(OUT_GRAPH), { recursive: true })
  writeFileSync(OUT_GRAPH, JSON.stringify(finalGraph, null, 2))
  console.log(`[write] ${OUT_GRAPH}`)

  mkdirSync(dirname(OUT_PASSAGES), { recursive: true })
  // Merge with existing passages if present (append-style for single-book runs)
  let finalPassages = merged.passages
  if (FLAGS.singleBook && existsSync(OUT_PASSAGES)) {
    try {
      const existing = JSON.parse(readFileSync(OUT_PASSAGES, 'utf-8'))
      const keep = (existing.passages || []).filter((p) => p.source_book !== FLAGS.singleBook)
      finalPassages = keep.concat(merged.passages)
      // Reindex ids
      finalPassages.forEach((p, i) => { p.id = `p_${i}` })
    } catch {}
  }
  writeFileSync(OUT_PASSAGES, JSON.stringify({ passages: finalPassages }, null, 2))
  console.log(`[write] ${OUT_PASSAGES}`)

  const elapsed = ((Date.now() - overallStart) / 1000 / 60).toFixed(1)
  console.log(`\nDone in ${elapsed} min`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
