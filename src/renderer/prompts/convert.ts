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

// Channel names the Player UI binds to (see PlayerPage.tsx DEFAULT_PARAMS).
// Keep this in lockstep with the knob grid — adding a knob means adding here too.
export const PLAYER_CHANNELS = [
  { name: 'frequency',  default: 440,  range: '20..12000 Hz',  role: 'carrier pitch fallback (used when p4 is absent or 0)' },
  { name: 'amplitude',  default: 0.5,  range: '0..1',          role: 'output gain for the voice' },
  { name: 'modIndex',   default: 8,    range: '0..20',         role: 'FM modulation index / depth' },
  { name: 'modRatio',   default: 3.5,  range: '0.5..10',       role: 'FM modulator:carrier ratio' },
  { name: 'attack',     default: 0.01, range: '0.001..2 s',    role: 'envelope attack time' },
  { name: 'decay',      default: 2.0,  range: '0.01..10 s',    role: 'envelope decay/release time' },
  { name: 'reverbMix',  default: 0.3,  range: '0..1',          role: 'wet reverb level on the master bus' },
  { name: 'reverbSize', default: 0.8,  range: '0..1',          role: 'reverb feedback / room size' },
] as const

const PLAYER_TEMPLATE = `Adapt the Csound project below so it runs in the DrC Player.

The Player renders a fixed UI: 8 knobs + a piano keyboard (MIDI 48..72 / C3..C5). The keyboard emits note triggers with \`p4\` set to pitch in Hz. The knobs write to these control channels (exact names, case-sensitive):

<<<CHANNELS>>>

OUTPUT FORMAT (strict):
- Emit exactly ONE complete CSD: \`<CsoundSynthesizer>…</CsoundSynthesizer>\`.
- No <Cabbage>, no HTML, no code fences, no prose.
- <CsOptions> is exactly: -odac -d

ADAPTATION RULES — follow precisely:

1. **Preserve the source's character.** If the source is an FM voice, keep FM; if a filter synth, keep the filter; if a granular texture, keep the grains. Your job is re-wiring, not re-composing.

2. **Channel reads live INSIDE each instrument body**, never at global scope (global chnget runs once at init and returns 0 — knob moves would do nothing). In EVERY voice instrument that uses a parameter:

       instr 1
         kFreq chnget "frequency"
         kAmp  chnget "amplitude"
         kIdx  chnget "modIndex"
         kRat  chnget "modRatio"
         kAtt  chnget "attack"
         kDec  chnget "decay"
         ; ...use them in the signal path

   Use \`portk\` / \`port\` smoothing (0.01–0.05 s) on parameters that would zipper.

3. **Channel initialization.** At the top of <CsInstruments>, emit one \`chnset <default>, "<name>"\` per channel so the engine has sensible values before the first UI frame. Use the defaults above verbatim.

4. **Pitch via p4.** The voice instrument (usually \`instr 1\`) MUST treat \`p4\` as pitch in Hz when provided, and fall back to the \`frequency\` knob when p4 is 0 or absent:

       iPitch = (p4 > 0 ? p4 : i(kFreq))

   Then drive the carrier from \`iPitch\`. If the source used MIDI note numbers or cps-from-pch, convert at the boundary so internal logic stays the same.

5. **Envelope from attack/decay.** Shape the voice with an envelope driven by the \`attack\` and \`decay\` knobs. A \`transeg\` or \`madsr\`-style shape is fine. Clamp attack to >= 0.001 and decay to >= 0.01 to avoid dc blips.

6. **Channel-writer helper (\`instr 100\`) — MANDATORY.** The host updates knobs at runtime by sending \`i 100 0 0 "<channelName>" <value>\` score events, which rely on this exact instrument. Include it verbatim:

       instr 100
         Schan = p4
         kVal  = p5
         chnset kVal, Schan
         turnoff
       endin

   Do not rename it, do not change its p-field layout, and do not strip the \`turnoff\`.

7. **Always-on reverb bus (\`instr 99\`).** Route every voice into \`"revL"\` / \`"revR"\` via \`chnmix\`, and render the wet path from an always-on \`instr 99\` that reads \`reverbMix\` and \`reverbSize\`:

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

   Voices still \`outs\` their dry signal; reverb is additive. If the source already had its own reverb, REPLACE it with this bus — do not double up.

8. **Score.** Replace <CsScore> with:

       i 99 0 36000       ; reverb bus runs the whole session
       f 0 36000          ; keep the engine alive for keyboard triggering

   No pre-scheduled notes for instr 1 — the keyboard triggers them live.

9. **Drop anything the Player can't drive**: MIDI opcodes, OSC listeners, \`gk<Name> init …\` knob globals (those become channel reads instead), hard-coded score melodies. Keep ftables, wavetables, and init-time setup.

10. **Unmapped source parameters**: if the source has knobs outside the 8 above (e.g. \`cutoff\`), fold them into the closest match — usually \`modIndex\` for timbre-shaping controls or \`modRatio\` for harmonic-character controls. Do NOT invent new channels.

11. **Quality bar**: the output must compile with stock Csound 6/7, render stereo to \`-odac\`, and produce audible output when the user clicks a keyboard key with default knob values.

SOURCE CSD:
<<<SOURCE>>>

Emit the adapted CSD now.`

function renderChannelList(): string {
  return PLAYER_CHANNELS
    .map((c) => `- "${c.name}" (default ${c.default}, ${c.range}) — ${c.role}`)
    .join('\n')
}

export function buildConvertPrompt(target: ConvertTarget, source: string): string {
  const template =
    target === 'webapp' ? WEBAPP_TEMPLATE :
    target === 'vst' ? VST_TEMPLATE :
    target === 'player' ? PLAYER_TEMPLATE :
    CSD_TEMPLATE
  return template
    .replace('<<<CHANNELS>>>', renderChannelList())
    .replace('<<<SOURCE>>>', source.trim())
}

// Quick heuristic: does this CSD already look Player-ready? If not, the caller
// should route through buildConvertPrompt('player', ...).
export function needsPlayerAdapt(source: string): boolean {
  const s = source.toLowerCase()
  if (!s.includes('<csoundsynthesizer')) return true
  const requiredChannels = ['frequency', 'amplitude', 'modindex', 'modratio', 'attack', 'decay', 'reverbmix', 'reverbsize']
  const hasAllChannels = requiredChannels.every((c) => s.includes(`"${c}"`))
  if (!hasAllChannels) return true
  // If every channel is present but p4 isn't referenced anywhere, the keyboard
  // won't trigger notes — still worth adapting.
  if (!s.includes('p4')) return true
  // Channel-writer helper (instr 100) is required for live knob updates. If
  // a hand-written CSD is missing it, the knobs become read-only.
  if (!/\binstr\s+100\b/.test(s)) return true
  return false
}
