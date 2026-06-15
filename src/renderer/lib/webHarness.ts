// Deterministic web-app builder for the "Convert to Web App" path.
//
// The LLM no longer hand-writes the HTML. It emits a web-ready orchestra CSD
// (chn_k declarations = the control manifest); the host parses that manifest
// (parseChannels) and this module assembles a fixed, self-contained HTML page
// around it. Because WE own the runtime, the three long-standing complaints are
// structurally impossible:
//
//   - sliders are responsive  — every <input> writes the channel live via
//     setControlChannel, and the orchestra contract reads k-rate + port-smoothed
//   - there is always an on/off — a real master Start/Stop, not a one-shot button
//   - the UI is consistent     — one hand-designed template, identical every time
//
// The output is a single standalone document (no build step, no frameworks) so
// it renders in the artifact iframe AND exports/downloads to run anywhere.

import type { ChannelSpec } from './parseChannels'

export interface WebAppOptions {
  /** The `<CsInstruments>` body, used verbatim as the compileOrc() source. */
  orc: string
  /** Parsed chn_k manifest — one slider per spec. */
  channels: ChannelSpec[]
  /** Page title (and <h1>). */
  title: string
  /** True when the patch is note-based (orchestra references p4). */
  hasKeyboard: boolean
  /** True when the orchestra defines an always-on reverb bus (instr 99). */
  hasReverbBus: boolean
}

// Pinned to the Csound build the bundled reference apps are verified against
// (src/renderer/assets/apps/fm-bell.html).
const CSOUND_CDN =
  'https://cdn.jsdelivr.net/npm/@csound/browser@7.0.0-beta31/dist/csound.js'

// Theme — hardcoded (the exported file is standalone, so it can't use the app's
// CSS variables). Mirrors the app tokens: dark bg, sage accent.
const THEME = {
  bg: '#111110',
  panel: '#1a1a18',
  text: '#e0e0e0',
  muted: '#6b7670',
  accent: '#7cb8a4',
  border: '#2a2a28',
}

// Embed a JS string/value safely inside an inline <script>: JSON-encode, then
// neutralize any "</script>" or "<!--" sequences the source might contain.
function jsLiteral(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildWebApp(opts: WebAppOptions): string {
  const title = (opts.title || 'Csound Web App').trim()
  const safeTitle = htmlEscape(title)

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${safeTitle}</title>
<style>
${STYLES}
</style>
</head>
<body>
<div class="wrap">
  <h1>${safeTitle}</h1>
  <p class="sub">Csound web app, made with DrC</p>

  <button id="power" class="power">Start Audio</button>
  <div id="status" class="status">Press Start Audio to load the engine.</div>

  <div id="keyboard" class="keyboard" hidden>
    <div class="kb-label">Keyboard — click or use your computer keys</div>
    <div id="keys" class="keys"></div>
  </div>

  <div id="controls" class="controls"></div>
</div>

<script>
const ORC = ${jsLiteral(opts.orc)};
const CHANNELS = ${jsLiteral(opts.channels)};
const HAS_KEYBOARD = ${opts.hasKeyboard ? 'true' : 'false'};
const HAS_REVERB_BUS = ${opts.hasReverbBus ? 'true' : 'false'};
const CSOUND_CDN = ${jsLiteral(CSOUND_CDN)};

${RUNTIME}
</script>
</body>
</html>`
}

// ── Inlined CSS ──────────────────────────────────────────────────────────────
const STYLES = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: ${THEME.bg};
  color: ${THEME.text};
  padding: 24px 16px;
  min-height: 100vh;
}
.wrap { max-width: 720px; margin: 0 auto; }
h1 { font-size: 1.6em; font-weight: 600; letter-spacing: -0.01em; }
.sub { color: ${THEME.muted}; font-size: 0.82em; margin: 4px 0 22px; }

.power {
  display: block; width: 100%;
  background: ${THEME.accent}; color: #0d0d0c;
  border: none; border-radius: 12px;
  padding: 14px; font-size: 1em; font-weight: 700;
  cursor: pointer; transition: filter .15s, opacity .15s;
}
.power:hover { filter: brightness(1.08); }
.power:disabled { opacity: .45; cursor: progress; }
.power.running { background: ${THEME.panel}; color: ${THEME.accent}; border: 1px solid ${THEME.accent}; }

.status {
  text-align: center; font-size: 0.82em; color: ${THEME.muted};
  margin: 12px 0 20px; min-height: 1.2em;
}
.status.error { color: #e08c8c; }
.status.ready { color: ${THEME.accent}; }

.controls {
  background: ${THEME.panel}; border: 1px solid ${THEME.border};
  border-radius: 14px; padding: 20px 22px;
}
.controls:empty { display: none; }
.ctl { margin-bottom: 18px; }
.ctl:last-child { margin-bottom: 0; }
.ctl-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 7px; }
.ctl-label { font-size: 0.86em; color: ${THEME.text}; }
.ctl-val {
  font-family: "SF Mono", "Fira Code", ui-monospace, monospace;
  font-size: 0.82em; font-weight: 600; color: ${THEME.accent};
}
input[type="range"] {
  -webkit-appearance: none; appearance: none;
  width: 100%; height: 5px; border-radius: 3px;
  background: ${THEME.border}; outline: none; cursor: pointer;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; width: 17px; height: 17px; border-radius: 50%;
  background: ${THEME.accent}; cursor: pointer; transition: transform .1s;
}
input[type="range"]::-webkit-slider-thumb:active { transform: scale(1.15); }
input[type="range"]::-moz-range-thumb {
  width: 17px; height: 17px; border-radius: 50%; border: none;
  background: ${THEME.accent}; cursor: pointer;
}

.keyboard {
  margin-top: 20px; background: ${THEME.panel};
  border: 1px solid ${THEME.border}; border-radius: 14px; padding: 18px;
}
.kb-label { font-size: 0.74em; letter-spacing: .12em; text-transform: uppercase; color: ${THEME.muted}; margin-bottom: 12px; }
.keys { display: flex; flex-wrap: wrap; gap: 5px; }
.key {
  flex: 1 1 38px; min-width: 38px;
  background: #232321; border: 1px solid ${THEME.border};
  border-radius: 7px; padding: 14px 4px 8px; text-align: center;
  cursor: pointer; user-select: none; transition: background .06s, transform .06s;
}
.key:hover { background: #2c2c2a; }
.key.black { background: #161615; }
.key.active { background: ${THEME.accent}; color: #0d0d0c; transform: translateY(1px); }
.key-name { font-size: 0.7em; opacity: .65; }
.key-bind { font-size: 0.82em; font-weight: 600; min-height: 1em; }
`

// ── Inlined runtime (plain JS; no backticks, no template interpolation, so it
// survives being embedded in the TS template literal above unescaped) ─────────
const RUNTIME = `
var csound = null;
var running = false;
var starting = false;
var active = {};
var keyEls = {};

var powerBtn = document.getElementById("power");
var statusEl = document.getElementById("status");
var controlsEl = document.getElementById("controls");
var keyboardEl = document.getElementById("keyboard");
var keysEl = document.getElementById("keys");

function setStatus(msg, cls) {
  statusEl.textContent = msg;
  statusEl.className = "status" + (cls ? " " + cls : "");
}

// Bound an await so a stalled network/WASM load never hangs forever on a loading
// status — whichever loses the race rejects with a clear, user-visible message.
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error(label + " timed out after " + (ms / 1000) + "s — check your network connection and press Start Audio again."));
      }, ms);
    })
  ]);
}

// ── Slider value mapping. Exponential channels with a positive floor get a log
// response so wide ranges (20Hz..20kHz, 1ms..2s) feel right at the low end. ──
function isExp(ch) { return ch.curve === "exp" && ch.min > 0; }
function sliderToValue(ch, raw) {
  if (isExp(ch)) { return ch.min * Math.pow(ch.max / ch.min, raw / 1000); }
  return raw;
}
function valueToSlider(ch, val) {
  if (isExp(ch)) {
    return Math.round((Math.log(val / ch.min) / Math.log(ch.max / ch.min)) * 1000);
  }
  return val;
}
function fmtValue(val, ch) {
  var d = ch.step >= 1 ? 0 : ch.step >= 0.1 ? 1 : ch.step >= 0.01 ? 2 : 3;
  var s = val.toFixed(d);
  return ch.unit ? s + " " + ch.unit : s;
}

function buildControl(ch) {
  var row = document.createElement("div");
  row.className = "ctl";
  var top = document.createElement("div");
  top.className = "ctl-top";
  var label = document.createElement("span");
  label.className = "ctl-label";
  label.textContent = ch.label;
  var out = document.createElement("span");
  out.className = "ctl-val";
  out.textContent = fmtValue(ch.default, ch);
  var slider = document.createElement("input");
  slider.type = "range";
  if (isExp(ch)) {
    slider.min = "0"; slider.max = "1000"; slider.step = "1";
    slider.value = String(valueToSlider(ch, ch.default));
  } else {
    slider.min = String(ch.min); slider.max = String(ch.max);
    slider.step = String(ch.step); slider.value = String(ch.default);
  }
  slider.addEventListener("input", function () {
    var val = sliderToValue(ch, Number(slider.value));
    out.textContent = fmtValue(val, ch);
    if (running && csound) { csound.setControlChannel(ch.name, val); }
  });
  top.appendChild(label); top.appendChild(out);
  row.appendChild(top); row.appendChild(slider);
  controlsEl.appendChild(row);
}

for (var i = 0; i < CHANNELS.length; i++) { buildControl(CHANNELS[i]); }

// ── Keyboard (note-based patches only) ──────────────────────────────────────
var NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
var LOW_MIDI = 48, HIGH_MIDI = 72;
var KEY_BIND = {
  60: "a", 61: "w", 62: "s", 63: "e", 64: "d", 65: "f", 66: "t",
  67: "g", 68: "y", 69: "h", 70: "u", 71: "j", 72: "k"
};
var BIND_TO_MIDI = {};
for (var mk in KEY_BIND) { BIND_TO_MIDI[KEY_BIND[mk]] = Number(mk); }

function noteName(m) { return NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1); }
function isBlack(m) { var p = m % 12; return p === 1 || p === 3 || p === 6 || p === 8 || p === 10; }
function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function tagFor(m) { return (1 + m / 1000).toFixed(3); }

function noteOn(m) {
  if (!running || !csound || active[m]) return;
  active[m] = true;
  csound.inputMessage("i " + tagFor(m) + " 0 -1 " + midiToFreq(m).toFixed(4) + " 0.8");
  if (keyEls[m]) keyEls[m].classList.add("active");
}
function noteOff(m) {
  if (!active[m]) return;
  delete active[m];
  if (csound) csound.inputMessage("i -" + tagFor(m) + " 0 0");
  if (keyEls[m]) keyEls[m].classList.remove("active");
}
function allNotesOff() {
  for (var m in active) { noteOff(Number(m)); }
}

function buildKeyboard() {
  for (var m = LOW_MIDI; m <= HIGH_MIDI; m++) {
    (function (midi) {
      var el = document.createElement("div");
      el.className = "key" + (isBlack(midi) ? " black" : "");
      var bind = document.createElement("div");
      bind.className = "key-bind";
      bind.textContent = KEY_BIND[midi] ? KEY_BIND[midi].toUpperCase() : "";
      var name = document.createElement("div");
      name.className = "key-name";
      name.textContent = noteName(midi);
      el.appendChild(bind); el.appendChild(name);
      el.addEventListener("mousedown", function () { noteOn(midi); });
      el.addEventListener("mouseup", function () { noteOff(midi); });
      el.addEventListener("mouseleave", function () { noteOff(midi); });
      el.addEventListener("touchstart", function (e) { e.preventDefault(); noteOn(midi); }, { passive: false });
      el.addEventListener("touchend", function (e) { e.preventDefault(); noteOff(midi); }, { passive: false });
      keyEls[midi] = el;
      keysEl.appendChild(el);
    })(m);
  }
  document.addEventListener("keydown", function (e) {
    if (e.repeat) return;
    var midi = BIND_TO_MIDI[e.key.toLowerCase()];
    if (midi !== undefined) { e.preventDefault(); noteOn(midi); }
  });
  document.addEventListener("keyup", function (e) {
    var midi = BIND_TO_MIDI[e.key.toLowerCase()];
    if (midi !== undefined) { e.preventDefault(); noteOff(midi); }
  });
}

if (HAS_KEYBOARD) { keyboardEl.hidden = false; buildKeyboard(); }

// ── Master Start / Stop ─────────────────────────────────────────────────────
async function start() {
  if (running || starting) return;
  starting = true;
  powerBtn.disabled = true;
  try {
    setStatus("Loading Csound from CDN...", "");
    var mod = await withTimeout(import(CSOUND_CDN), 20000, "Loading Csound from CDN");
    var Csound = mod.Csound;
    setStatus("Creating audio engine...", "");
    csound = await withTimeout(Csound({ useWorker: false, useSPN: false, outputChannelCount: 2 }), 20000, "Starting the audio engine");
    await csound.setOption("-odac");
    await csound.setOption("-m0");
    setStatus("Compiling orchestra...", "");
    // compileOrc resolves to a Csound status code (0 = success). On a parse
    // error it does NOT reject — it returns non-zero and leaves instruments
    // undefined, which would otherwise look like a silent "Ready" with no sound.
    var compileStatus = await csound.compileOrc(ORC);
    if (typeof compileStatus === "number" && compileStatus !== 0) {
      throw new Error("the orchestra has a Csound syntax error (code " + compileStatus + "). See the browser console for the parser message.");
    }
    await csound.start();
    // Init every channel to its slider default so the first k-period never reads 0.
    for (var i = 0; i < CHANNELS.length; i++) {
      await csound.setControlChannel(CHANNELS[i].name, CHANNELS[i].default);
    }
    if (HAS_REVERB_BUS) await csound.inputMessage("i 99 0 -1");
    if (!HAS_KEYBOARD) await csound.inputMessage("i 1 0 -1");
    running = true;
    starting = false;
    powerBtn.textContent = "Stop";
    powerBtn.classList.add("running");
    powerBtn.disabled = false;
    setStatus(HAS_KEYBOARD ? "Ready, play the keyboard or drag a slider." : "Running, drag a slider to shape the sound.", "ready");
  } catch (err) {
    starting = false;
    powerBtn.disabled = false;
    setStatus("Error: " + (err && err.message ? err.message : err), "error");
    console.error(err);
  }
}

async function stop() {
  allNotesOff();
  running = false;
  if (csound) {
    try { await csound.stop(); } catch (e) {}
    try { if (csound.destroy) await csound.destroy(); } catch (e) {}
  }
  csound = null;
  active = {};
  powerBtn.textContent = "Start Audio";
  powerBtn.classList.remove("running");
  setStatus("Stopped. Press Start Audio to resume.", "");
}

powerBtn.addEventListener("click", function () {
  if (running) { stop(); } else { start(); }
});
`
