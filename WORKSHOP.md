# Dr.C Standalone — LAC / Education Workshop Build

This branch targets **Csound 7** for native CLI compile/render and **@csound/browser 7** for web synth exports.

## What changed (v1.3.1+)

- System prompts unified for **Csound 7** (removed contradictory 6.18 rules)
- **First-turn simplicity**: simple requests emit one working CSD, not three alternatives
- **PATH** prefers `~/bin` and `~/Applications/Csound` (user-local Csound 7)
- **Runtime detection** injects detected Csound version into the agent environment
- **Web app conversion** compile-checks orchestra before wrapping HTML
- **Workshop starters** in `resources/workshop-starters/` (verified compile targets)

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
csound -n -d -m0 -o /tmp/test.wav resources/workshop-starters/fm_starter.csd
npm run typecheck
node scripts/smoke-test.mjs
```

## Suggested attendee prompt

```
make a plain Csound CSD only — no Cabbage. Simple 2-operator FM synth with foscili, warm and resonant. Include score i 1 0 3 so it renders to WAV.
```

## Web synths

Converted web apps use `@csound/browser@7.0.0-beta31` from CDN. Reference apps in **Web Apps** gallery are educational demos.

## Cabbage

For live MIDI instruments, convert to Cabbage after the plain CSD works. Most Cabbage patches use `f0 z` and realtime MIDI, not offline `i 1 0 3` scores.
