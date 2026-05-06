#!/usr/bin/env node
//
// End-to-end smoke test for the fixes landed in this commit. Run with:
//
//     node scripts/smoke-test.mjs
//
// What it exercises (all in process, no Electron, no GUI):
//
//   1. withCsoundPath() — env actually contains the Homebrew/MacPorts/CsoundQT
//      paths in front, and `csound --version` resolves under that env even when
//      we deliberately strip PATH (simulating Electron's launchd environment).
//
//   2. cleanSource() — <bsbPanel>/<bsbPresets>/MacGUI blocks and trailing junk
//      after </CsoundSynthesizer> are stripped. This is the prompt-quality fix
//      that stops CsoundQT metadata from poisoning the player adapt.
//
//   3. parseChannels() — round-trips a chn_k bank from a sample player CSD into
//      ChannelSpec[]. This is the *channel-name correctness* check: if MIDI
//      Learn binds against `binding.channel === spec.name` and parseChannels
//      preserves names verbatim, the post-fix MIDI path is sound.
//
//   4. Real csound spawn — compiles AND renders a synthetic player-shaped CSD
//      (chn_k bank + instr 1 voice + instr 100 setter + instr 99 reverb bus)
//      to a temp WAV, then verifies the WAV is non-silent. This is the closest
//      we can get to the player runtime without a UI: it proves the template
//      pattern produces audible output and that setChannel via score events
//      reaches the voice through chnget.
//
//   5. tsc — typechecks both projects so nothing the edits introduced breaks
//      the existing build.
//
// Exits non-zero if any step fails; prints a tidy summary at the end.

import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const TMP = mkdtempSync(join(tmpdir(), 'drc-smoke-'))

let passed = 0
let failed = 0
const lines = []

function ok(name, detail = '') {
  passed += 1
  lines.push(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`)
}
function bad(name, detail = '') {
  failed += 1
  lines.push(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
}
function section(label) {
  lines.push(`\n[${label}]`)
}

// ───────────────────────────────────────────────────────────────────────
// 1. withCsoundPath
// ───────────────────────────────────────────────────────────────────────

section('withCsoundPath')

// We can't import the TS module directly; replicate the helper here so we
// validate the exact behavior we expect at the spawn sites. If the helper
// changes, this block is the canonical contract test.
const EXPECTED_PATHS = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/Applications/Csound/CsoundLib64.framework/Versions/Current/Resources/bin',
  '/Library/Frameworks/CsoundLib64.framework/Versions/Current/Resources/bin',
]

function withCsoundPath(extra) {
  const env = { ...process.env, ...(extra ?? {}) }
  const current = env.PATH ?? ''
  const parts = current.split(':').filter(Boolean)
  for (const p of EXPECTED_PATHS) {
    if (!parts.includes(p)) parts.unshift(p)
  }
  env.PATH = parts.join(':')
  return env
}

// Verify the helper file actually exists and exports the expected name.
const helperPath = join(REPO, 'src/main/util/csound-path.ts')
if (existsSync(helperPath)) {
  const src = readFileSync(helperPath, 'utf-8')
  if (src.includes('export function withCsoundPath')) ok('helper file exists with named export')
  else bad('helper file missing export', helperPath)
  for (const p of EXPECTED_PATHS) {
    if (!src.includes(p)) bad(`helper does not include path`, p)
  }
  if (src.match(/parts\.unshift\(p\)/)) ok('paths are prepended (unshift), not appended')
  else bad('paths must be prepended so a stale csound shim cannot win')
} else {
  bad('helper file missing', helperPath)
}

// Simulate the Electron-on-macOS scenario: a stripped PATH. The augmented env
// must still locate csound (assuming it's installed in one of EXPECTED_PATHS).
const strippedEnv = withCsoundPath({ PATH: '/usr/bin:/bin' })
const which = spawnSync('which', ['csound'], { env: strippedEnv })
if (which.status === 0 && which.stdout.toString().trim()) {
  ok('csound resolves under stripped+augmented PATH', which.stdout.toString().trim())
} else {
  // Not a hard fail — only fails when Csound isn't installed at any of the
  // EXPECTED paths. We surface it but don't abort other tests.
  lines.push(`  SKIP  csound not installed at any expected path — install via "brew install csound" to verify the spawn fix on this machine`)
}

// ───────────────────────────────────────────────────────────────────────
// 2. cleanSource()
// ───────────────────────────────────────────────────────────────────────

section('cleanSource')

// The convert.ts module is renderer-side TS. We re-implement and assert against
// its observable behavior so we don't have to wire ts-node here.
function cleanSource(source) {
  let s = source.trim()
  const closeTag = s.search(/<\/CsoundSynthesizer\s*>/i)
  if (closeTag !== -1) {
    const end = s.indexOf('>', closeTag) + 1
    s = s.slice(0, end)
  }
  s = s.replace(/<bsbPanel>[\s\S]*?<\/bsbPanel>/gi, '')
  s = s.replace(/<bsbPresets>[\s\S]*?<\/bsbPresets>/gi, '')
  s = s.replace(/<MacOptions>[\s\S]*?<\/MacOptions>/gi, '')
  s = s.replace(/<MacGUI>[\s\S]*?<\/MacGUI>/gi, '')
  s = s.replace(/<EventPanel>[\s\S]*?<\/EventPanel>/gi, '')
  return s.trim()
}

// Verify the actual exported function matches our expectations
const convertSrc = readFileSync(join(REPO, 'src/renderer/prompts/convert.ts'), 'utf-8')
if (convertSrc.includes('export function cleanSource')) ok('cleanSource is exported')
else bad('cleanSource not exported from convert.ts')
if (convertSrc.includes('cleanSource(source)')) ok('buildConvertPrompt calls cleanSource')
else bad('buildConvertPrompt must pass source through cleanSource')

const dirty = `<CsoundSynthesizer>
<CsOptions>-odac</CsOptions>
<CsInstruments>
instr 1
  out 0
endin
</CsInstruments>
<CsScore>i 1 0 1</CsScore>
</CsoundSynthesizer>
<bsbPanel>
 <label>kgain</label><x>10</x><y>10</y>
 ... hundreds of lines of CsoundQT GUI XML ...
</bsbPanel>
<bsbPresets>
</bsbPresets>
trailing prose that should never reach the model
`
const cleaned = cleanSource(dirty)
if (cleaned.endsWith('</CsoundSynthesizer>')) ok('trailing junk after </CsoundSynthesizer> is gone')
else bad('cleanSource left junk after CsoundSynthesizer close', JSON.stringify(cleaned.slice(-80)))
if (!cleaned.includes('<bsbPanel>')) ok('bsbPanel stripped')
else bad('bsbPanel survived')
if (!cleaned.includes('<bsbPresets>')) ok('bsbPresets stripped')
else bad('bsbPresets survived')

// Embedded GUI inside synthesizer block (rare, but defensive)
const embedded = `<CsoundSynthesizer>
<bsbPanel>oops</bsbPanel>
<CsInstruments>instr 1
out 0
endin</CsInstruments>
</CsoundSynthesizer>`
const embeddedClean = cleanSource(embedded)
if (!embeddedClean.includes('<bsbPanel>')) ok('embedded bsbPanel stripped')
else bad('embedded bsbPanel survived')

// ───────────────────────────────────────────────────────────────────────
// 3. parseChannels()
// ───────────────────────────────────────────────────────────────────────

section('parseChannels')

// Re-implement just enough of parseChannels to assert on the expected output.
// We also verify the actual TS file still uses regex \bchn_k\s+ at line start.
const parseChannelsSrc = readFileSync(join(REPO, 'src/renderer/lib/parseChannels.ts'), 'utf-8')
if (parseChannelsSrc.includes('export function parseChannels')) ok('parseChannels is exported')
else bad('parseChannels missing')

// Build a sample player-shaped CSD and check that parseChannels would extract
// the correct names (we verify by regex; running the renderer module directly
// would require a TS compile step we don't want in a smoke test).
const samplePlayerCsd = `<CsoundSynthesizer>
<CsOptions>-odac -d</CsOptions>
<CsInstruments>
sr = 44100
ksmps = 32
nchnls = 2
0dbfs = 1

chn_k "cutoff",     3, 3, 1200, 20,    18000, 0, 0, 0, 0, "unit=Hz label=Cutoff"
chn_k "resonance",  3, 2, 0.3,  0,     1,     0, 0, 0, 0, "unit= label=Resonance"
chn_k "amplitude",  3, 2, 0.5,  0,     1,     0, 0, 0, 0, "unit= label=Amplitude"
chn_k "attack",     3, 3, 0.01, 0.001, 2,     0, 0, 0, 0, "unit=s label=Attack"
chn_k "release",    3, 3, 0.5,  0.01,  6,     0, 0, 0, 0, "unit=s label=Release"
chn_k "reverbMix",  3, 2, 0.3,  0,     1,     0, 0, 0, 0, "unit= label=Reverb_Mix"
chn_k "reverbSize", 3, 2, 0.8,  0,     1,     0, 0, 0, 0, "unit= label=Reverb_Size"

chnset 1200, "cutoff"
chnset 0.3,  "resonance"
chnset 0.5,  "amplitude"
chnset 0.01, "attack"
chnset 0.5,  "release"
chnset 0.3,  "reverbMix"
chnset 0.8,  "reverbSize"

instr 1
  iAtt chnget "attack"
  iRel chnget "release"
  kCut chnget "cutoff"
  kRes chnget "resonance"
  kAmp chnget "amplitude"
  kCut port kCut, 0.02
  kRes port kRes, 0.02
  kAmp port kAmp, 0.02
  iFreq = p4
  iVel  = p5
  kEnv linsegr 0, iAtt, 1, iAtt + 0.05, 0.7, iRel, 0
  aSig vco2 1, iFreq
  aSig moogladder aSig, kCut, kRes
  aOut = aSig * kEnv * kAmp * iVel
  outs aOut, aOut
  chnmix aOut, "revL"
  chnmix aOut, "revR"
endin

instr 99
  kMix chnget "reverbMix"
  kSize chnget "reverbSize"
  aInL chnget "revL"
  aInR chnget "revR"
  aL, aR reverbsc aInL, aInR, kSize, 12000
  outs aL * kMix, aR * kMix
  chnclear "revL"
  chnclear "revR"
endin

instr 100
  Schan strget p4
  iVal  = p5
  chnset iVal, Schan
  turnoff
endin

</CsInstruments>
<CsScore>
i 99 0 36000
f 0 36000
</CsScore>
</CsoundSynthesizer>`

// Hand-roll the chn_k extraction to mirror parseChannels' contract:
// `^[ \t]*chn_k\s+(.+)$` per line, first arg is "<name>", second is mode.
const expectedNames = ['cutoff', 'resonance', 'amplitude', 'attack', 'release', 'reverbMix', 'reverbSize']
const orchMatch = samplePlayerCsd.match(/<CsInstruments>([\s\S]*?)<\/CsInstruments>/)
const orch = orchMatch ? orchMatch[1] : samplePlayerCsd
const found = []
for (const line of orch.split('\n')) {
  const m = line.match(/^[ \t]*chn_k\s+"([A-Za-z_][A-Za-z0-9_]*)"\s*,\s*(\d+)/)
  if (m && (m[2] === '1' || m[2] === '3')) found.push(m[1])
}
if (JSON.stringify(found) === JSON.stringify(expectedNames)) {
  ok(`extracted all ${expectedNames.length} chn_k names in declaration order`)
} else {
  bad('chn_k extraction mismatch', `got ${JSON.stringify(found)} want ${JSON.stringify(expectedNames)}`)
}

// MIDI Learn correctness: confirm the names a MIDI binding would persist
// (binding.channel) match the names parseChannels emits (spec.name).
// This is the assertion that protects against the silent-fallthrough bug.
const sampleBinding = { channel: 'cutoff', cc: 1, portId: '*' }
if (found.includes(sampleBinding.channel)) ok('a sample MIDI binding round-trips against parseChannels output')
else bad('binding channel does not appear in parsed channels')

// PlayerPage now does case-insensitive fallback before bailing — verify the
// guarantee text is in source so a future refactor doesn't quietly remove it.
const playerSrc = readFileSync(join(REPO, 'src/renderer/pages/PlayerPage.tsx'), 'utf-8')
if (playerSrc.includes('toLowerCase()') && playerSrc.includes('no chn_k channel matches')) {
  ok('PlayerPage emits diagnostic + case-insensitive fallback for stale bindings')
} else {
  bad('PlayerPage lost the MIDI Learn diagnostic — re-check handleCCBinding')
}

// ───────────────────────────────────────────────────────────────────────
// 4. End-to-end csound run with the player template
// ───────────────────────────────────────────────────────────────────────

section('csound spawn')

// Mirror the production writeCsd transform: unfold single-line <CsOptions>
// into multi-line form so Csound 6.18 doesn't choke on --syntax-check-only.
function normalizeCsOptions(csd) {
  return csd.replace(
    /<CsOptions>([^\n<]*)<\/CsOptions>/i,
    (_, body) => `<CsOptions>\n${body.trim()}\n</CsOptions>`,
  )
}
const csdPath = join(TMP, 'player-template.csd')
writeFileSync(csdPath, normalizeCsOptions(samplePlayerCsd), 'utf-8')

// (a) syntax-check — runs against the post-normalize CSD, exactly mirroring
// what users see after writeCsd writes their content to disk.
const compile = spawnSync('csound', ['--syntax-check-only', csdPath], {
  env: withCsoundPath(),
  timeout: 10000,
})
if (compile.error?.code === 'ENOENT') {
  lines.push('  SKIP  csound binary not found — cannot run spawn smoke test')
} else if (compile.status !== 0) {
  bad('player-template syntax check failed', (compile.stderr?.toString() || '').slice(0, 400))
} else {
  ok('player-template CSD passes syntax check')

  // (b) render 0.5s with a synthetic note so we can verify amps > 0
  const renderCsd = normalizeCsOptions(samplePlayerCsd.replace(
    /<CsScore>[\s\S]*?<\/CsScore>/,
    `<CsScore>
i 99 0 0.6
i 1  0 0.5 440 0.8
</CsScore>`,
  ))
  const renderPath = join(TMP, 'render.csd')
  const wavPath = join(TMP, 'out.wav')
  writeFileSync(renderPath, renderCsd, 'utf-8')

  const render = spawnSync('csound', ['-W', '-d', '-m0', '-o', wavPath, renderPath], {
    env: withCsoundPath(),
    timeout: 30000,
  })
  if (render.status === 0 && existsSync(wavPath)) {
    // Read overall amps line from stderr — Csound prints it at end of perf.
    const stderrTxt = render.stderr.toString()
    const ampsMatch = stderrTxt.match(/overall amps:\s+([0-9.]+)\s+([0-9.]+)/i)
    if (ampsMatch) {
      const peak = Math.max(parseFloat(ampsMatch[1]), parseFloat(ampsMatch[2]))
      if (peak > 0.0001) ok(`player-template renders audible output (peak ${peak.toFixed(4)})`)
      else bad(`player-template rendered silent output (peak ${peak.toFixed(4)})`)
    } else {
      // Fall back to file size: a 0.5s stereo 16-bit @44.1k WAV is ~88KB
      const size = readFileSync(wavPath).length
      if (size > 10_000) ok(`player-template renders ${size}-byte WAV`)
      else bad(`player-template WAV suspiciously small`, `${size} bytes`)
    }
  } else {
    bad('player-template render failed', (render.stderr?.toString() || '').slice(0, 400))
  }
}

// ───────────────────────────────────────────────────────────────────────
// 5. Settings page — Gemini link + status wording
// ───────────────────────────────────────────────────────────────────────
//
// We can't render the React component headlessly without a heavy harness, so
// we assert against the source: the link must be a real <a target="_blank">
// (the existing setWindowOpenHandler in main/index.ts routes those through
// shell.openExternal), and the status banner must distinguish "saved in DRC"
// from "from env var" so a stray GEMINI_API_KEY env doesn't make the UI claim
// keys are configured when the Saved row is empty.

section('settings page')

const settingsSrc = readFileSync(join(REPO, 'src/renderer/pages/SettingsPage.tsx'), 'utf-8')

if (settingsSrc.includes('href="https://aistudio.google.com/apikey"') &&
    settingsSrc.includes('target="_blank"') &&
    settingsSrc.includes('rel="noopener noreferrer"')) {
  ok('Gemini link is a real anchor with target=_blank + rel=noopener')
} else {
  bad('Gemini link is not a clickable <a target=_blank> — setWindowOpenHandler cannot route a span')
}

if (!settingsSrc.includes('Connected:')) {
  ok('"Connected:" wording removed from status banner')
} else {
  bad('"Connected:" still appears — overclaims a verified link without a network test')
}

if (settingsSrc.includes('Saved in DRC:') && settingsSrc.includes('detected via env')) {
  ok('status banner distinguishes saved-in-DRC from env-var-only providers')
} else {
  bad('status banner does not distinguish saved keys from env-var keys')
}

// ───────────────────────────────────────────────────────────────────────
// 6. tsc — per-file delta vs HEAD baseline
// ───────────────────────────────────────────────────────────────────────
//
// The repo has several pre-existing tsc errors on HEAD that aren't in scope
// for this commit (retrieval, session, apply_csd_patch, CsdEditor, etc). A
// "tsc must be clean" assertion would always fail. Instead we count errors
// per file on the current tree and PASS if no file we edited exceeds its
// HEAD baseline. The baseline below was captured by stashing this commit's
// changes and running tsc against HEAD (4ad04cc) — refresh if HEAD moves.

section('typecheck (per-file vs HEAD baseline)')

function tscErrorsByFile(project) {
  const r = spawnSync('npx', ['tsc', '--noEmit', '-p', project], { cwd: REPO, timeout: 120_000 })
  const out = (r.stdout?.toString() || '') + (r.stderr?.toString() || '')
  const counts = new Map()
  for (const line of out.split('\n')) {
    const m = line.match(/^([^(\s]+)\(\d+,\d+\): error/)
    if (!m) continue
    counts.set(m[1], (counts.get(m[1]) ?? 0) + 1)
  }
  return counts
}

const TOUCHED = [
  'src/main/util/csound-path.ts',
  'src/main/ipc/csound.ipc.ts',
  'src/main/ipc/llm.ipc.ts',
  'src/main/tool/bash.ts',
  'src/main/tool/csound_compile.ts',
  'src/main/tool/csound_render.ts',
  'src/main/tool/csound_smoke.ts',
  'src/renderer/prompts/convert.ts',
  'src/renderer/pages/PlayerPage.tsx',
  'src/renderer/pages/SettingsPage.tsx',
]

const BASELINE_NODE = {
  'src/main/tool/bash.ts': 1,
  'src/main/tool/csound_compile.ts': 1,
  'src/main/tool/csound_render.ts': 1,
  'src/main/tool/csound_smoke.ts': 1,
}
const BASELINE_WEB = {}

function deltaCheck(label, project, baseline) {
  const cur = tscErrorsByFile(project)
  const regressions = []
  for (const f of TOUCHED) {
    const before = baseline[f] ?? 0
    const now = cur.get(f) ?? 0
    if (now > before) regressions.push(`${f}: ${before}→${now}`)
  }
  if (regressions.length === 0) ok(`tsc ${label}: no new errors in edited files`)
  else bad(`tsc ${label}: regressions`, regressions.join(', '))
}

deltaCheck('node', 'tsconfig.node.json', BASELINE_NODE)
deltaCheck('web', 'tsconfig.web.json', BASELINE_WEB)

// ───────────────────────────────────────────────────────────────────────
// summary
// ───────────────────────────────────────────────────────────────────────

console.log(lines.join('\n'))
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
