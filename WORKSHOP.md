# Dr.C Standalone — LAC / Education Workshop Build

This branch targets **Csound 7** for native CLI compile/render and **@csound/browser 7** for web synth exports.

## What changed (v1.3.1+)

- System prompts unified for **Csound 7** (removed contradictory 6.18 rules)
- **First-turn simplicity**: simple requests emit one working CSD, not three alternatives
- **PATH** prefers `~/bin` and `~/Applications/Csound` (user-local Csound 7)
- **Runtime detection** injects detected Csound version into the agent environment
- **Web app conversion** compile-checks orchestra before wrapping HTML
- **Workshop starters** in `resources/workshop-starters/` (verified compile targets)
- **Workshop-lite mode** (`DRC_WORKSHOP_LITE=1`): skips narration so each turn uses **one** cheap model call — useful for free-tier workshops only
- **Pro+ mode** (default in `scripts/launch-drc.sh` via `DRC_PRO_PLUS=1`): Gemini Pro, narration, specialist consults, full book RAG

## Gemini free tier

Each Agent turn uses one API call (workshop-lite mode). On the free tier you can hit Google's rate limit (~20 requests/minute); when that happens the API may return **empty output with no error**.

- **Workshop launcher prefers Groq** when both Groq and Gemini keys are saved — Groq is faster and more reliable on free tier
- If the primary provider fails, Dr.C **automatically tries the other** (Groq ↔ Gemini)
- Wait for the **countdown** on the Agent screen, then use **Try again** on your prompt *(free tier only)*
- Add a **Groq** key in Settings as a free backup (console.groq.com/keys)
- Use `./scripts/launch-drc.sh` (Pro+ defaults for Dr. B; set `DRC_WORKSHOP_LITE=1` for attendee free-tier builds)
- **Web Apps** need no API key

## Free provider options

| Provider | Cost | Get a key |
|----------|------|-----------|
| Gemini (default) | Free tier | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Groq (backup) | Free tier | [console.groq.com/keys](https://console.groq.com/keys) |

Dr.C prefers Gemini when both are saved. If Gemini is throttled, remove it temporarily or wait; Groq is used when Gemini is not configured.

## Quick start

```bash
git clone https://github.com/mateolarreaferro/DRC-Standalone.git
cd DRC-Standalone
npm install
cp .env.example .env   # add GEMINI_API_KEY or other provider key
chmod +x scripts/launch-drc.sh
./scripts/launch-drc.sh
```

## Csound 7 install (all platforms)

**Verify:**
```bash
csound --version   # should show version 7.x
```

### macOS (recommended — user install, no sudo)

1. Download Csound 7 universal pkg from [Csound releases](https://github.com/csound/csound/releases)
2. Extract or install to `~/Applications/Csound/`
3. Symlink: `mkdir -p ~/bin && ln -sf ~/Applications/Csound/csound ~/bin/csound`

### Linux (Ubuntu/Debian)

Build from source or use a Csound 7 package when available for your distro. Workshop docs in `DRC-URLS.C` cover full Linux setup.

```bash
sudo apt install build-essential cmake libjack-jackd2-dev
# Follow Csound 7 build instructions at https://github.com/csound/csound
```

### Windows

Install Csound 7 from [csound.com/download](https://csound.com/download.html) and ensure `csound` is on PATH.

## Workshop smoke test

```bash
export PATH="$HOME/bin:$HOME/Applications/Csound:$PATH"
cd ~/DRC-Standalone
npm test
```

Runs 45 smoke checks, memory module check, and production build. Quick smoke only: `npm run test:smoke`.

See also: **`TESTING.md`** (manual checklist), **`VERSIONS.md`** (product matrix), **`RELEASE-CHECKLIST.md`** (GitHub publish steps).

## Suggested attendee prompt

**Golden model:** `resources/workshop-starters/fm_bell_starter.csd` — shimmering dual-modulator FM bell (Dr. B).

```
make a plain Csound CSD only — no Cabbage. Shimmering FM bell like the workshop golden model: two inharmonic oscili modulators into a carrier, expsegr decay, global reverb bus (instr 99). Score: descending bell melody, harmonic cluster, final low bell (~15 s).
```

Simple FM (beginners):

```
make a plain Csound CSD only — no Cabbage. Simple 2-operator FM synth with foscili, warm and resonant. Score should demo the instrument: scale, arpeggios, ostinato, closing chord (~12 s).
```

**Ping-pong bass model:** `resources/workshop-starters/pluck_bass_starter.csd` — FM pluck + cross-fed `vdelay3` echo.

```
make a plain Csound CSD only — no Cabbage. Ping-pong pluck bass: foscili FM voice, butterlp lowpass, gaEcho global bus, instr 99 with vdelay3 cross-feedback (280 ms / 420 ms). Score: four-note bass riff (~8 s).
```

## Web synths

Converted web apps use `@csound/browser@7.0.0-beta31` from CDN. Reference apps in **Web Apps** gallery are educational demos.

## Cabbage

For live MIDI instruments, convert to Cabbage after the plain CSD works. Most Cabbage patches use `f0 z` and realtime MIDI, not offline `i 1 0 3` scores.

## CsoundQt

For deeper editing and manual lookup, use **Open in CsoundQt** on any plain CSD (artifact panel or Terminal CSD toolbar). Install **CsoundQt v7.x** after Csound 7 — see `INSTALL-STANDALONE.md` §2.5.
