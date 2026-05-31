export type ConvertTarget = 'webapp' | 'vst' | 'csd' | 'player'

const WEBAPP_TEMPLATE = `Convert the Csound project below into a standalone, runnable web app using the canonical DrC pattern — matched against the reference apps that already ship with DrC (FM Bell, Drum Machine, Etude). This pattern is PROVEN to work; do not invent variations.

OUTPUT FORMAT (strict):
- Emit exactly ONE complete HTML document.
- First characters must be \`<!DOCTYPE html>\`. Last characters must be \`</html>\`.
- No code fences. No prose before or after. No markdown. No commentary.

REQUIRED CSOUND PATTERN (follow exactly):

\`\`\`
// Lazy ESM import — do NOT use a <script src="..."> tag
const { Csound } = await import(
  "https://cdn.jsdelivr.net/npm/@csound/browser@7.0.0-beta26/dist/csound.js"
);

// Create instance with these options — they matter
csound = await Csound({
  useWorker: false,
  useSPN: false,
  outputChannelCount: 2,
});

// Set options via JS, NOT in a <CsOptions> tag
await csound.setOption("-odac");
await csound.setOption("-m0");

// Compile the ORCHESTRA ONLY — not a full CSD, not compileCsd
await csound.compileOrc(ORC);  // ORC is a JS template literal
await csound.start();

// Always-on FX / bed instruments use negative duration
await csound.inputMessage("i 99 0 -1");

// k-rate params: setControlChannel driven by <input type=range>
slider.addEventListener("input", () =>
  csound.setControlChannel("cutoff", Number(slider.value))
);

// Note triggers: inputMessage with p-fields
csound.inputMessage(\`i 1 0 \${dur} \${freq} \${amp}\`);
\`\`\`

SOURCE CONVERSION RULES:

The source is a complete CSD with <CsoundSynthesizer>, <CsOptions>, <CsInstruments>, <CsScore> tags. Rewrite it into the web pattern above:

1. **ORC string (JS template literal)**: Extract the body of <CsInstruments> verbatim. Do NOT include the <CsoundSynthesizer>, <CsOptions>, <CsInstruments>, <CsScore> tags themselves. The orchestra must start with \`sr = 44100\` / \`ksmps = ...\` / \`nchnls = 2\` / \`0dbfs = 1\`.

2. **CsOptions**: discard. Use \`setOption("-odac")\` and \`setOption("-m0")\` in JS.

3. **CsScore**: discard. Replace with:
   - \`inputMessage("i N 0 -1")\` calls for any instruments that should run continuously (drones, reverb, master FX).
   - \`inputMessage("i 1 0 dur p4 p5 ...")\` calls triggered from UI (knob/key/mouse events).

4. **Control channels — CRITICAL**: \`chnget\` MUST live inside each instrument body, NOT at global scope. Global \`chnget\` runs once at init and returns 0 — slider moves will have no effect. Correct pattern, inside EVERY instrument that uses the parameter:

       instr 1
         kCutoff chnget "cutoff"
         kCutoff port kCutoff, 0.01    ; smoothing to avoid clicks
         kRes    chnget "resonance"
         kRes    port kRes, 0.01
         ; ... now use kCutoff, kRes in the signal path
         aFilt moogladder aIn, kCutoff, kRes
         ...
       endin

   Drop any \`gk<Name> init <value>\` globals from the source — they become channel reads inside instruments instead. If an instrument needs an i-rate snapshot of a channel at note start (rare), use \`iCutoff = i(kCutoff)\` AFTER reading kCutoff via chnget.

5. **Channel initialization**: after \`await csound.start()\`, call \`csound.setControlChannel(name, defaultValue)\` for EVERY channel used by the orchestra, matching the slider's default value. Without this the first k-period reads 0 from every channel.

       await csound.start();
       await csound.inputMessage("i 2 0 -1");  // always-on FX first if any

       // Initialize all control channels to their slider defaults
       csound.setControlChannel("cutoff", 2000);
       csound.setControlChannel("resonance", 0.3);
       csound.setControlChannel("volume", 0.7);

6. **Parameter → UI mapping**:
   - One \`<input type="range">\` per channel. Range heuristic: default ∈ [0,1] → [0, 1, 0.001]; default ∈ [0, 127] → [0, 127, 1]; default ∈ [20, 20000] → [20, 20000, 1] (prefer log-scaled slider if feasible); else [default*0.1, default*3, (max-min)/200].
   - Label = Name (split camelCase, e.g. "Cutoff Freq"). Channel name is the camelCase original lowercased on the first letter (gkCutoffFreq → "cutoffFreq").
   - Show the current value to 2 decimals next to the slider.
   - Event handler: \`csound.setControlChannel("<name>", Number(slider.value))\`.
   - The initial slider \`value\` attribute MUST match the setControlChannel init call from step 5.

6. **Note triggers**: if instr 1 uses p4 (pitch in Hz or MIDI), render a 2-octave keyboard of buttons for MIDI 48..72 where each click does:
       csound.inputMessage(\`i 1 0 \${DUR} \${MIDI_TO_HZ(note)} 0.5\`);
   Use \`440 * Math.pow(2, (midi - 69) / 12)\` for Hz. If the source comments suggest a different default duration, use that.

7. **AudioContext**: do NOT manually create one. \`Csound({ outputChannelCount: 2 })\` handles it. Do NOT pass \`audioContext\` in options.

UI & STYLE:
- Dark theme: background \`#111110\`, text \`#e0e0e0\`, accent \`#7cb8a4\`, muted \`#6b7670\`.
- System font stack + monospace for numeric readouts.
- Container max-width 720px, centered, padding 20px.
- Single big "Start Audio" button at the top. Disabled after successful start; label flips to "Audio Running".
- Status text below the button: "Loading Csound..." → "Starting engine..." → "Ready — drag knobs / click keys." → "Error: <msg>" on failure.
- Rounded corners 10–14px. Subtle border \`1px solid #2a2a28\`.

CONSTRAINTS:
- Self-contained HTML file. No build step. No external CSS or JS frameworks.
- Target ~300–400 lines. Simpler beats fancier.
- No \`<script type="text/csound">\` tag. The orchestra lives in a JS \`const ORC = \\\`…\\\`;\` template literal only.
- Do not wrap the output in code fences.
- NO emojis anywhere — not in headings, labels, buttons, tooltips, status text, or comments. Keep text plain (e.g. "Start Audio", not "▶ Start Audio" or "🔔 Start").

SOURCE CSD:
<<<SOURCE>>>

Emit the HTML document now.`

const VST_TEMPLATE = `Convert the Csound project below into a Cabbage VST/AU plugin.

OUTPUT FORMAT (strict):
- Emit exactly ONE CSD file with a <Cabbage>...</Cabbage> section directly BEFORE <CsoundSynthesizer>...</CsoundSynthesizer>.
- No code fences. No prose before or after.

CABBAGE LAYOUT:
- form caption("<Title>") size(620, 360) guiMode("queue") colour(17,17,16)
- groupbox bounds(10, 10, 600, 90) text("Controls") colour(30,30,28) fontColour(224,224,224)
- For every \`gk<Name> init <value>\` in the source, add an rslider inside the groupbox with:
    channel("<Name>") text("<Name>") trackerColour(124,184,164)
    range(<min>, <max>, <init>, 1, 0.001)
  Same range heuristics as a web UI: 0..1 if init is in [0,1]; 0..127 if init is in [0,127]; else [init*0.1, init*3].
  Lay out sliders left-to-right with 70px width and 10px gap.
- If the source uses p4 as a MIDI note, add: keyboard bounds(10, 110, 600, 160).

CSD CHANGES:
- Add <CsOptions> flags: -n -d -+rtmidi=NULL -M0
- For each gk<Name>: add "gk<Name> chnget \\"<Name>\\"" right after its \`init\` so the Cabbage slider controls it (keep the init line as the default).
- Everything else in the CsInstruments and CsScore sections stays verbatim.

SOURCE CSD:
<<<SOURCE>>>

Emit the Cabbage CSD now.`

const CSD_TEMPLATE = `Extract the <CsoundSynthesizer>...</CsoundSynthesizer> from the project below as a standalone CSD.

OUTPUT FORMAT (strict):
- Emit ONLY the <CsoundSynthesizer>...</CsoundSynthesizer> block. No <Cabbage>. No HTML. No code fences. No prose.
- Keep <CsOptions> as \`-odac\` only (remove MIDI or renderer flags).
- Keep all instruments and score events unchanged.

SOURCE:
<<<SOURCE>>>

Emit the CSD now.`

// The Player UI now reads its knob list from `chn_k` declarations in the
// adapted CSD instead of forcing a hardcoded 8-channel template. PLAYER_CHANNELS
// is kept around as a small set of *suggested* well-known names the model can
// reuse when the source patch maps cleanly onto them — but the model is free
// to add or omit any channel as long as each is declared with chn_k.
export const PLAYER_CHANNELS = [
  { name: 'amplitude',  default: 0.5,  range: '0..1',          role: 'output gain for the voice' },
  { name: 'attack',     default: 0.01, range: '0.001..2 s',    role: 'envelope attack time' },
  { name: 'release',    default: 0.5,  range: '0.01..6 s',     role: 'envelope release tail (linsegr)' },
  { name: 'reverbMix',  default: 0.3,  range: '0..1',          role: 'wet reverb level on the master bus' },
  { name: 'reverbSize', default: 0.8,  range: '0..1',          role: 'reverb feedback / room size' },
] as const

const PLAYER_TEMPLATE = `Adapt the Csound project below so it runs in the DrC Player.

The Player renders a piano keyboard (MIDI 48..72 / C3..C5) and a knob grid that is built dynamically from your \`chn_k\` declarations. The keyboard sustains notes for as long as a key is held: noteOn dispatches \`i 1.NNN 0 -1 <freq> <vel>\` and noteOff dispatches \`i -1.NNN 0 0\` (turnoff for that tagged instance). Your voice MUST use a release-aware envelope (\`linsegr\`) so the tail completes after turnoff.

The host writes knob values via score events: \`i 100 0 0 "<channelName>" <value>\`.

OUTPUT FORMAT (strict):
- Emit exactly ONE complete CSD: \`<CsoundSynthesizer>…</CsoundSynthesizer>\`.
- No <Cabbage>, no HTML, no code fences, no prose.
- <CsOptions> is exactly: -odac -d

ADAPTATION RULES — follow precisely:

1. **Preserve the source's character.** If the source is an FM voice, keep FM; a filter synth, keep the filter; a granular texture, keep the grains. Your job is re-wiring, not re-composing.

2. **Declare every knob with \`chn_k\` at orchestra scope (top of <CsInstruments>, before any \`instr\`).** Pick 4–10 knobs that meaningfully shape THIS patch. Each declaration MUST follow:

       chn_k "<channelName>", 3, <itype>, <dflt>, <min>, <max>, 0, 0, 0, 0, "unit=<unit> label=<Label>"

   Where:
   - \`channelName\` is camelCase and unique (e.g. \`cutoff\`, \`fmIndex\`, \`grainDensity\`)
   - \`3\` = both input + output (host writes, orchestra reads)
   - \`itype\`: 1 = integer, 2 = linear, 3 = exponential (use 3 for frequency / time / decibel-ish ranges; 2 for mix/depth/ratio; 1 for discrete counts)
   - \`dflt\`, \`min\`, \`max\` = the default and bounds the knob will use
   - The trailing string is metadata. The label and unit are SINGLE tokens — the host auto-prettifies camelCase, and converts underscores to spaces. **DO NOT escape quotes inside the string** (Csound string literals do not support \`\\"\`); if the label needs a space, use an underscore.

   Examples (note: NO escaped quotes anywhere):

       chn_k "cutoff",      3, 3, 1200, 20,    18000,  0, 0, 0, 0, "unit=Hz label=Cutoff"
       chn_k "resonance",   3, 2, 0.3,  0,     1,      0, 0, 0, 0, "unit= label=Resonance"
       chn_k "fmIndex",     3, 2, 6,    0,     30,     0, 0, 0, 0, "unit= label=FM_Index"
       chn_k "attack",      3, 3, 0.01, 0.001, 2,      0, 0, 0, 0, "unit=s label=Attack"
       chn_k "release",     3, 3, 0.5,  0.01,  6,      0, 0, 0, 0, "unit=s label=Release"
       chn_k "reverbMix",   3, 2, 0.3,  0,     1,      0, 0, 0, 0, "unit= label=Reverb_Mix"
       chn_k "reverbSize",  3, 2, 0.8,  0,     1,      0, 0, 0, 0, "unit= label=Reverb_Size"

   Any source parameter that doesn't map cleanly to a well-known name should still be exposed under whatever name fits the patch — invent a name, don't drop the knob.

3. **Initialize each channel.** Right after the chn_k block, emit \`chnset <dflt>, "<name>"\` for every channel using the same defaults you declared. This guarantees the first k-cycle reads sensible values.

4. **Read channels INSIDE each instrument body**, never at global scope (global chnget runs once at init and returns 0). Pattern:

       instr 1
         kCut  chnget "cutoff"
         kRes  chnget "resonance"
         kCut  port  kCut, 0.02      ; smoothing for slow-moving knobs
         kRes  port  kRes, 0.02
         ; ... use kCut, kRes in signal path

5. **Voice instrument contract — \`instr 1\`.**
   - \`p4\` is pitch in Hz delivered by the keyboard. If the source originally used MIDI note numbers or cpspch, convert at the boundary so the body still operates on Hz.
   - \`p5\` is normalized velocity (0..1).
   - \`p3 = -1\` for keyboard-triggered notes (the host turns them off via \`i -1.NNN\`). DO NOT reach for p3 arithmetic for envelope timing — the envelope is release-aware.
   - **Envelope rates — CRITICAL.** \`linsegr\` only accepts **i-rate** time/value arguments. You MUST read envelope parameters at i-rate via the i-rate form of chnget (output variable starts with \`i\`):

         instr 1
           ; i-rate snapshots — these are what linsegr can use
           iAtt   chnget  "attack"
           iRel   chnget  "release"
           ; k-rate reads — for parameters you want to modulate while the note holds
           kAmp   chnget  "amplitude"
           kIdx   chnget  "fmIndex"
           kAmp   port    kAmp, 0.02
           kIdx   port    kIdx, 0.02

           iFreq = p4
           iVel  = p5

           kEnv linsegr 0, iAtt, 1, iAtt + 0.05, 0.7, iRel, 0
           ; ...signal path uses kEnv * kAmp * iVel

     Passing k-rate variables (\`kAtt\`, \`kRel\`) to \`linsegr\` produces **"Unable to find opcode entry for 'linsegr' with matching argument types"** — that is the most common adapter failure. Use \`i\`-prefixed reads for any envelope time/value you put into \`linsegr\`.
   - \`linsegr\`'s last segment is the release — it triggers automatically on turnoff. Do not invent your own release logic.
   - Multiply your audio path by \`kEnv * kAmp * iVel\` (or the equivalent of your amplitude knob × velocity).

6. **Channel-writer helper (\`instr 100\`) — MANDATORY, verbatim:**

       instr 100
         Schan strget p4
         iVal  = p5
         chnset iVal, Schan
         turnoff
       endin

   Do not switch to \`kVal\` / k-rate \`chnset\` — with p3=0 no k-cycles fire and the write is silently dropped. Do not rename the instrument or change the p-field layout.

7. **Always-on reverb bus (\`instr 99\`).** Voices send to \`"revL"\` / \`"revR"\` via \`chnmix\`; the bus reads them, applies reverbsc, and outputs the wet signal:

       instr 99
         kMix  chnget "reverbMix"
         kSize chnget "reverbSize"
         aInL  chnget "revL"
         aInR  chnget "revR"
         aL, aR reverbsc aInL, aInR, kSize, 12000
         outs  aL * kMix, aR * kMix
         chnclear "revL"
         chnclear "revR"
       endin

   Voices still \`outs\` their dry signal; reverb is additive. If the source already had its own reverb, REPLACE it with this bus — do not double up. If you don't expose \`reverbMix\`/\`reverbSize\` as knobs, hardcode reasonable defaults but keep the bus.

8. **Score.** Replace <CsScore> with exactly:

       i 99 0 36000       ; reverb bus runs the whole session
       f 0 36000          ; keep the engine alive for keyboard triggering

   No pre-scheduled notes for instr 1 — the keyboard triggers them live.

9. **Drop anything the Player can't drive**: MIDI opcodes, OSC listeners, \`gk<Name> init …\` knob globals (those become \`chn_k\` + \`chnget\` instead), hard-coded score melodies. Keep ftables, wavetables, and init-time setup.

10. **Quality bar**: the output must compile with stock Csound 6/7, render stereo to \`-odac\`, and produce audible output when the user holds a keyboard key with default knob values. The note must sustain while held and release cleanly when released.

SUGGESTED WELL-KNOWN CHANNEL NAMES (use these names when they fit so users get familiar bindings):

<<<CHANNELS>>>

SOURCE CSD:
<<<SOURCE>>>

Emit the adapted CSD now.`

function renderChannelList(): string {
  return PLAYER_CHANNELS
    .map((c) => `- "${c.name}" (default ${c.default}, ${c.range}) — ${c.role}`)
    .join('\n')
}

// Strip CsoundQT-specific blocks that often trail real-world CSDs. <bsbPanel>
// and <bsbPresets> are CsoundQT's GUI metadata — they're hundreds of lines of
// XML that aren't part of the orchestra and just waste prompt budget while
// confusing the adapter ("the source defines a 'gain' widget so I should keep
// it" — no, you shouldn't, the Player has its own knobs).
//
// <MacOptions>, <MacGUI>, <EventPanel> are MacCsound holdovers in the same
// spirit. Anything after the closing </CsoundSynthesizer> tag is, by definition,
// not Csound — drop it.
export function cleanSource(source: string): string {
  let s = source.trim()
  const closeTag = s.search(/<\/CsoundSynthesizer\s*>/i)
  if (closeTag !== -1) {
    const end = s.indexOf('>', closeTag) + 1
    s = s.slice(0, end)
  }
  // Belt-and-suspenders for the rare CSD that puts the GUI block *inside*
  // <CsoundSynthesizer> (shouldn't be valid, but CsoundQT has been known to).
  s = s.replace(/<bsbPanel>[\s\S]*?<\/bsbPanel>/gi, '')
  s = s.replace(/<bsbPresets>[\s\S]*?<\/bsbPresets>/gi, '')
  s = s.replace(/<MacOptions>[\s\S]*?<\/MacOptions>/gi, '')
  s = s.replace(/<MacGUI>[\s\S]*?<\/MacGUI>/gi, '')
  s = s.replace(/<EventPanel>[\s\S]*?<\/EventPanel>/gi, '')
  return s.trim()
}

export function buildConvertPrompt(target: ConvertTarget, source: string): string {
  const template =
    target === 'webapp' ? WEBAPP_TEMPLATE :
    target === 'vst' ? VST_TEMPLATE :
    target === 'player' ? PLAYER_TEMPLATE :
    CSD_TEMPLATE
  return template
    .replace('<<<CHANNELS>>>', renderChannelList())
    .replace('<<<SOURCE>>>', cleanSource(source))
}

// Quick heuristic: does this CSD already look Player-ready? If not, the caller
// should route through buildConvertPrompt('player', ...).
//
// The new contract relies on Player infrastructure being present, not on a
// fixed channel set — the knobs themselves are now declared by the CSD via
// chn_k. Required infrastructure:
//   - <CsoundSynthesizer> wrapper
//   - At least one chn_k declaration (otherwise the knob grid is empty)
//   - p4 referenced somewhere in the orchestra (keyboard pitch arrives there)
//   - instr 100 channel-writer helper (so live knob updates land)
//   - linsegr in the orchestra (so sustain-release with i -1.NNN works)
export function needsPlayerAdapt(source: string): boolean {
  if (!/<CsoundSynthesizer/i.test(source)) return true
  if (!/\bchn_k\s+/i.test(source)) return true
  if (!/\bp4\b/.test(source)) return true
  if (!/\binstr\s+100\b/.test(source)) return true
  if (!/\blinsegr\b/i.test(source)) return true
  return false
}

// Detect when a free-text chat message is really a request to convert the
// active artifact into a *different* format ("make it a web app", "export as
// a VST", "give me the plain CSD"). When it is, the caller should route the
// message through buildConvertPrompt() — the same proven path the "Convert
// to" button uses — instead of a normal follow-up, which would otherwise be
// told to preserve the current format and ignore the switch.
//
// Conservative by design: only fires on phrasings that name a target format,
// and only returns a target that differs from the artifact already open.
const CONVERT_INTENT: { type: ConvertTarget; re: RegExp }[] = [
  {
    type: 'webapp',
    re: /\b(web\s?app|web\s?site|web version|html (?:page|app|document|version)|in the browser|as html|browser app)\b/i,
  },
  {
    type: 'vst',
    re: /\b(vst|au plugin|audio unit|cabbage|plugin|daw)\b/i,
  },
  {
    type: 'csd',
    re: /\b(plain csd|raw csd|back to (?:a )?csd|just (?:the )?csd|csd instrument|extract (?:the )?csd)\b/i,
  },
]

export function detectConvertIntent(
  text: string,
  activeType: 'csd' | 'webapp' | 'vst',
): 'csd' | 'webapp' | 'vst' | null {
  for (const { type, re } of CONVERT_INTENT) {
    if (type !== activeType && re.test(text)) return type
  }
  return null
}
