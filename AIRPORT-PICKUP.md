# Airport pickup — Dr.C (2026-06-15)

> **Superseded for resume:** use [`HOTEL-RESUME.md`](HOTEL-RESUME.md) + `git pull` on `lac-2026-csound7`.  
> Below is the **historical** no-sound investigation log (fixes are now committed).

---

## 30-second status (historical)

| Area | Status |
|------|--------|
| **Smoke tests** | 103/103 pass locally (after uncommitted fixes) |
| **Workshop CSD files** | `pluck_bass_starter.csd`, `player_fm_starter.csd`, etc. **compile and produce audio** when run with `csound` in Terminal |
| **Dr.C UI** | User reports **no sound** on Agent FM bass generation and Player demos |
| **Git** | Only `66a123f` (usage display crash) is pushed. **All audio/workshop fixes below are LOCAL ONLY — not committed** |

---

## Launch Dr.C correctly (macOS)

**Always use the launcher** — not the Dock icon alone:

```bash
~/Desktop/Dr.C-Standalone.command
# or
cd ~/Dr.C-Standalone && ./scripts/launch-drc.sh
```

Launcher prepends **Csound 7** (`~/bin/csound`). Dock-only may pick up **Csound 6.18** from `/usr/local/bin`.

Verify in Terminal:

```bash
which csound
csound --version   # must show version 7
```

---

## Two different “no sound” paths

### A) Agent — “generate FM bass” (or any CSD)

1. User prompts Agent → CSD artifact appears → **auto-play** runs.
2. On macOS this is **not** realtime keyboard. It is:
   - `csound -o preview.wav …` (offline render)
   - then **`afplay preview.wav`** (system default output)
3. **Bug we found:** LLM often emits **Player hold scores** (`f 0 36000`, no `i 1` notes). Compile check passes (shortened score) but **WAV is silent**.
4. **Fix written (uncommitted):** `src/shared/csd-offline-prepare.ts` injects demo bass riff before render; `csound.ipc.ts` detects silent render.

### B) Player — workshop demos / keyboard

1. User clicks **Simple FM demo**, **FM bell demo**, or **Bass demo** (or loads from Agent).
2. Realtime path: `csound -+rtaudio=auhal -odac … -Lstdin` + score events for keyboard.
3. **Bug we found:** Settings listed devices via **portaudio** but Csound 7 on Mac plays via **auhal** — saved `audioOutputDevice` index can route to **wrong dac (silent)**.
4. **Fix written (uncommitted):** `audio-devices.ts` + `audio-flags.ts` use **auhal** consistently on macOS + Csound 7; stale indices cleared before play; Player waits for live stdin before demo arpeggio.

---

## First 5 minutes at the airport (diagnostics)

### 1. Rebuild with local fixes

```bash
cd ~/Dr.C-Standalone
npm run build
```

Quit Dr.C fully (Cmd+Q), relaunch from **Dr.C-Standalone.command**.

### 2. Reset audio (Settings)

- **Settings → Audio**
- **Output:** System default (blank), not a numbered device
- Tap **Reset audio devices** if shown
- Relaunch Dr.C

### 3. Open Csound console

Sidebar → **`>_`** (Csound console). Leave it open for every test.

### 4. Player no-key test (should need no API key)

**Player → Simple FM demo**

**Good signs in console:**

- `Audio: output: system default → -+rtaudio=auhal -odac`
- `writing … sample blks … to dac`
- `Realtime audio ready`
- Short arpeggio, then `Live — click the keyboard`

**Bad signs:**

- `Csound did not start realtime audio in time`
- `Compile error:`
- `Silent render`
- `overall amps: 0.00000` (in console after render)

### 5. Agent FM bass test (needs API key)

**＋ New** session. Paste:

```
Make a plain Csound CSD only (no Cabbage). FM pluck bass with foscili, short expsegr envelope. Score must include timed i 1 demo notes (~8 s), not f 0 hold only.
```

Watch playback bar + console for compile error vs silent render vs afplay.

### 6. Prove Csound + speakers outside Dr.C

```bash
export PATH="$HOME/bin:$PATH"
csound -n -d -m0 -o /tmp/bass-test.wav \
  ~/Dr.C-Standalone/resources/workshop-starters/pluck_bass_starter.csd
afplay /tmp/bass-test.wav
```

If this is **silent**, problem is macOS output device / volume — not Dr.C.

If this **plays** but Dr.C does not, problem is in Electron app path (see uncommitted fixes).

---

## Uncommitted local changes (2026-06-15)

**Branch:** `lac-2026-csound7` (pushed through `66a123f` only)

### Workshop / Player

| File | What |
|------|------|
| `resources/workshop-starters/player_fm_starter.csd` | New no-key simple FM Player demo |
| `src/main/util/workshop-starters.ts` | Registers player_fm_starter |
| `src/renderer/lib/workshopDemos.ts` | Maps Agent buttons → player-ready CSDs |
| `src/renderer/pages/AgentPage.tsx` | Simple FM / bell / bass buttons; auto-load Player |
| `src/renderer/pages/PlayerPage.tsx` | Auto-play on workshop load; event wait/retry |
| `src/renderer/lib/mechanicalPlayerAdapt.ts` | Simple FM + bass adapt paths |

### Audio routing (Player silence)

| File | What |
|------|------|
| `src/main/util/audio-devices.ts` | `auhal` on macOS Csound 7 for `--devices` |
| `src/main/csound/audio-flags.ts` | Same module on realtime play |
| `src/main/csound/csd-playback.ts` | auhal-ready detection strings |
| `src/main/ipc/csound.ipc.ts` | No blind 2.5s “ready”; sanitize devices; offline prepare |

### Agent FM bass silence

| File | What |
|------|------|
| `src/shared/csd-offline-prepare.ts` | **NEW** — inject demo score for offline preview |
| `src/renderer/lib/playback.ts` | Uses shared offline prepare |
| `src/main/agent/prompts/csound.txt` | Never `f 0 36000` for Agent CSD |
| `src/main/agent/prompts/demo-score.txt` | FM bass golden pattern |
| `src/main/retrieval/engine.ts` | RAG: `fm bass` → pluck_bass_starter |

### Tests

| File | What |
|------|------|
| `scripts/smoke-test.mjs` | 103 checks incl. offline prepare + player_fm_starter |
| `tsconfig.*.json` | Include `src/shared/` |

### Already pushed

| Commit | What |
|--------|------|
| `66a123f` | Fix Agent crash: `toLocaleString` on null token usage |

---

## If still no sound after rebuild — next debug steps

1. **Paste Csound console output** from one failed Player demo (last ~30 lines).
2. **Settings → Audio** screenshot or list: saved output index vs dropdown labels.
3. Run and save output:
   ```bash
   csound -+rtaudio=auhal --devices 2>&1 | head -30
   ```
4. Check whether **Player** shows `Live` but keyboard is silent (stdin/events) vs **no status at all** (dac).
5. Check whether **Agent** shows `Playing your sound…` then nothing (afplay / silent WAV).

### Hypotheses still open

- [ ] User running **built app** without `npm run build` after local fixes
- [ ] **audioOutputDevice** still set to stale portaudio index in config store
- [ ] **Electron** not inheriting `~/bin` PATH when launched from Dock
- [ ] **afplay** routing to different device than expected (headphones vs monitor)
- [ ] LLM still emitting unplayable CSD despite RAG (compile error loop)

---

## Commit when stable

```bash
cd ~/Dr.C-Standalone
git add -A
git status   # review — no secrets
git commit -m "$(cat <<'EOF'
Fix workshop audio: auhal routing, offline demo scores, Player auto-play.

Align macOS Csound 7 device list with realtime play, inject demo scores for silent Agent previews, and wire no-key workshop Player demos.
EOF
)"
git push -u origin lac-2026-csound7
```

---

## Related docs

| Doc | Purpose |
|-----|---------|
| `LAC-2026-SESSION-HANDOFF.md` | Full workshop session log |
| `WORKSHOP.md` | Attendee prompts + golden models |
| `PARTICIPANTS.md` | Launch + no-key demos |
| `TESTING.md` | Manual checklist |

## ComfyUI / ACE-Step (separate from Dr.C)

- ComfyUI at `~/ComfyUI` — use `~/ComfyUI/workflows/ACE-Step-1.5-DrC-80s-pop.json` (not blueprint alone)
- Songs folder: `~/dB-Studio/ComfyUI - Songs/`

---

*Last updated: 2026-06-15 — airport handoff, no sound unresolved.*
