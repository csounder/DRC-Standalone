export type ConvertTarget = 'webapp' | 'vst' | 'csd'

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

4. **Global k-rate controls**: for every line \`gk<Name> init <value>\` in the source, rewrite the orchestra so that immediately after the init line you do:
       gk<Name> chnget "<name>"
   Channel name is the variable name without the "gk" prefix, lowercased (gkCutoff → "cutoff"). Keep the init line so the default is preserved.

5. **Parameter → UI mapping**:
   - One \`<input type="range">\` per gk channel. Range heuristic: init ∈ [0,1] → [0, 1, 0.001]; init ∈ [0, 127] → [0, 127, 1]; init ∈ [20, 20000] → [20, 20000, 1] log-scaled if possible, else step=1; else [init*0.1, init*3, (max-min)/200].
   - Label = Name (split camelCase, e.g. "Cutoff Freq").
   - Show the current value to 2 decimals next to the slider.
   - Event handler: \`csound.setControlChannel("<name>", Number(slider.value))\`.

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

export function buildConvertPrompt(target: ConvertTarget, source: string): string {
  const template =
    target === 'webapp' ? WEBAPP_TEMPLATE :
    target === 'vst' ? VST_TEMPLATE :
    CSD_TEMPLATE
  return template.replace('<<<SOURCE>>>', source.trim())
}
