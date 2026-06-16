#!/usr/bin/env node
/**
 * Generate resources/workshop/LAC-2026-one-slide.pdf — one landscape handout for LAC.
 * Run: npm run generate:workshop-handout
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT_DIR = join(REPO, 'resources/workshop')
const OUT_FILE = join(OUT_DIR, 'LAC-2026-one-slide.pdf')

const LINKS = [
  ['Repos', [
    ['Standalone', 'github.com/mateolarreaferro/DRC-Standalone'],
    ['Releases', 'github.com/mateolarreaferro/DRC-Standalone/releases'],
    ['Terminal', 'github.com/mateolarreaferro/Dr.C'],
  ]],
  ['Csound', [
    ['CS7 releases', 'github.com/csound/csound/releases'],
    ['Manual', 'flossmanual.csound.com'],
    ['Opcodes', 'csound.com/manual/opcodesIndex'],
    ['CsoundQt 7', 'github.com/CsoundQt/CsoundQt/releases'],
  ]],
  ['Agent keys', [
    ['OpenRouter (one key)', 'openrouter.ai/keys'],
    ['Anthropic direct', 'console.anthropic.com/settings/keys'],
    ['OpenAI direct', 'platform.openai.com/api-keys'],
    ['Groq free', 'console.groq.com/keys'],
    ['Gemini free', 'aistudio.google.com/apikey'],
  ]],
  ['Local LLM', [
    ['Ollama', 'ollama.com/download'],
    ['Model', 'ollama pull qwen2.5-coder:7b'],
  ]],
]

function drawPage(doc) {
  const W = doc.page.width
  const margin = 36
  let y = margin

  doc.fillColor('#1a1a2e')
  doc.font('Helvetica-Bold').fontSize(28).text('Dr.C @ LAC 2026', margin, y, { width: W - margin * 2 })
  y += 36
  doc.font('Helvetica').fontSize(13).fillColor('#444')
  doc.text('macOS & Linux only  ·  Csound 7  ·  Standalone v1.3.1', margin, y)
  y += 28

  doc.moveTo(margin, y).lineTo(W - margin, y).strokeColor('#ccc').stroke()
  y += 16

  const colW = (W - margin * 2 - 24) / 2
  const leftX = margin
  const rightX = margin + colW + 24
  let leftY = y
  let rightY = y

  doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a2e')
  doc.text('Get started', leftX, leftY, { width: colW })
  leftY += 18
  doc.font('Helvetica').fontSize(10).fillColor('#222')
  const steps = [
    '1. Install Csound 7 → csound --version shows 7.x',
    '2. Get Dr.C — Releases (DMG/AppImage) or git clone lac-2026-csound7',
    '3. Launch — Dr.C-Workshop-Attendee (free) or Dr.C-Standalone (instructor)',
    '4. Agent model — Ollama (free, local) OR your Anthropic/OpenAI key',
    '5. No key? Agent → Load workshop FM bell · Player → Workshop demo · Web Apps',
  ]
  for (const s of steps) {
    doc.text(s, leftX, leftY, { width: colW, lineGap: 2 })
    leftY += doc.heightOfString(s, { width: colW, lineGap: 2 }) + 6
  }

  leftY += 8
  doc.font('Helvetica-Bold').fontSize(11).text('Try this prompt', leftX, leftY, { width: colW })
  leftY += 14
  doc.font('Courier').fontSize(8).fillColor('#333')
  const prompt =
    'make a plain Csound CSD only — no Cabbage. Shimmering FM bell: two inharmonic oscili modulators into a carrier, expsegr decay, global reverb bus (instr 99). Score: descending bell melody (~15 s).'
  doc.text(prompt, leftX, leftY, { width: colW, lineGap: 1 })

  doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a2e')
  doc.text('Links', rightX, rightY, { width: colW })
  rightY += 18

  for (const [section, items] of LINKS) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#2d4a7a').text(section, rightX, rightY, { width: colW })
    rightY += 13
    doc.font('Helvetica').fontSize(9).fillColor('#222')
    for (const [label, url] of items) {
      doc.text(`${label}: ${url}`, rightX, rightY, { width: colW, lineGap: 1 })
      rightY += doc.heightOfString(`${label}: ${url}`, { width: colW }) + 2
    }
    rightY += 6
  }

  const footY = doc.page.height - margin - 14
  doc.font('Helvetica').fontSize(9).fillColor('#666')
  doc.text(
    'Settings → Copy workshop links  ·  Full guide: PARTICIPANTS.md & LOCAL-LLM.md in repo',
    margin,
    footY,
    { width: W - margin * 2, align: 'center' },
  )
}

mkdirSync(OUT_DIR, { recursive: true })

const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape', margin: 36 })
const chunks = []
doc.on('data', (c) => chunks.push(c))
doc.on('end', () => {
  writeFileSync(OUT_FILE, Buffer.concat(chunks))
  console.log(`Wrote ${OUT_FILE}`)
})

drawPage(doc)
doc.end()
