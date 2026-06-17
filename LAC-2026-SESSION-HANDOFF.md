# LAC 2026 Workshop — Session Handoff

**Updated:** 2026-06-16 (pre-sleep push)  
**For:** Richard Boulanger  
**Goal:** Dr.C Standalone + Terminal CLI ready for Csound 7 workshop (LAC, Maynooth)

> **START HERE (new chat):** [`HOTEL-RESUME.md`](HOTEL-RESUME.md) — one page.  
> **Technical history:** [`HANDOFF.md`](HANDOFF.md) (append-only).

---

## Where we are leaving off

**Branch:** `lac-2026-csound7` — committed and pushed with full Player demo curation, limiter, MIDI fixes, adapt layers, and docs.

### Automated tests (macOS, 2026-06-16)

| Project | Command | Result |
|---------|---------|--------|
| **Standalone** | `npm test` | ✅ platform + **139** smoke + memory + build |
| **Standalone** | `npm run test:parity` | ✅ (after `sync-knowledge-to-cli.mjs`) |
| **CLI (Terminal)** | `node scripts/workshop-test.mjs` | ✅ **16/16** |
| **Linux native** | `npm test` on Ubuntu | ⏳ **Not run** — do on workshop laptop |

### Not yet validated (next session — top priority)

1. **Export to Cabbage** — Convert menu → VST; Settings Cabbage path; open plugin in Cabbage.app  
2. **Export to Chrome** — Web App → Open in Browser; WASM7 Start Audio; keyboard + USB MIDI in exported page  

---

## Session work summary (June 15–16)

### Player demo catalog

- Ingest + curate Dr. B MIDI models → `player-model-demos.json` (now **10** demos after curation)
- Split Chowning orchestras → `models/chowning/*.csd` + `chowning-player-demos.json` (**6** demos)
- Script: `scripts/build-chowning-player-models.mjs`
- Script: `scripts/ingest-player-model-demos.mjs` with `EXCLUDE_BASENAMES` (won’t restore deleted demos)
- Script: `scripts/ensure-limiter-on-csds.mjs` (batch `--limiter=0.9` on workshop CSDs)

**Final demo names (Chowning group):** FM Nasty Lead 1, FM Pad, FM Nasty Lead 2, FM Keys 1, FM Pad 2, FM Lead 1  

**Misc:** FM Lead 3 (was French Horn), Granular 1, Wave Sequencing, Fat Pad 1, Waveshape Brass, etc.

### Adapt pipeline (no LLM for bundled demos)

| Module | Role |
|--------|------|
| `mechanicalPlayerAdapt.ts` | Golden starters, simple FM/pluck/shimmer |
| `scoreModelPlayerAdapt.ts` | Dr. B score models (TB303, wave seq, FOF, …) |
| `legacyDrBModelAdapt.ts` | Waveshape brass/clarinet, FM string pad, **FM Lead 3** horn |
| `midiModelPlayerWrap.ts` | Native MIDI instr → keyboard + `chn_k` (+ granular gain) |
| `trappedPlayerAdapt.ts` | Trapped-in-Convert (demos removed from menu; code retained) |
| `playerDemoArpeggio.ts` | Per-demo rhythmic phrases + harmony |

### Audio / MIDI / safety

- **`--limiter=0.9`:** `buildRealtimeIoFlags`, offline render CLI, `writeCsd`, `prepareCsdFor*`, all bundled CSDs
- **USB MIDI:** `webMidiOnly: true` on Player spawn; Web MIDI permission in Electron; `useMidi(..., inputLive)` re-bind
- **Levels:** Chowning `giMaster` + `tanh`; horn legacy amp rescale; granular softer; wave seq louder
- **Orphan csound kill** before Player play (`killOrphanDrcCsoundProcesses`)

### Agent / Web / export (prior + this session)

- WASM7 web harness: USB MIDI, waveform/FFT, Panic, signal-flow study
- Open in **CsoundQt** (working — verify Cabbage next)
- Open in **Browser** for webapp artifacts
- `convert.ts` prompts require limiter + Player/Web CsOptions templates

### Knowledge / CLI parity

- `node scripts/sync-knowledge-to-cli.mjs` copies bundles to `~/Dr.C/opencode/packages/opencode/resources/knowledge`
- Granular bundle: **10** models (removed `granular-truax.csd` from menu/source)

---

## Repositories

| Project | Path | Branch |
|---------|------|--------|
| **Dr.C Standalone** | `~/DRC-Standalone` | `lac-2026-csound7` |
| **Dr.C Terminal (CLI)** | `~/Dr.C/opencode` | `main` (knowledge sync local; commit separately if needed) |

**Launch Standalone:**

```bash
cd ~/DRC-Standalone && ./scripts/launch-drc.sh
```

**Launch Terminal:**

```bash
~/Dr.C/opencode/launch-drc-terminal.sh   # if present
```

---

## Documentation index

| Doc | Purpose |
|-----|---------|
| **`HOTEL-RESUME.md`** | **New chat starter** |
| **`LAC-2026-SESSION-HANDOFF.md`** | This file — session log |
| **`HANDOFF.md`** | Append-only technical history |
| **`TESTING.md`** | Manual + automated checklist |
| **`WORKSHOP.md`** | Attendee notes |

---

## Suggested manual test plan (after sleep)

### A. Player (5 min)

1. Load **FM Nasty Lead 1** → demo phrase → USB MIDI notes  
2. **FM Lead 3** — confirm level OK (not clipping)  
3. **Granular 1** — confirm softer; **Wave Sequencing** — confirm audible  

### B. Export Cabbage (TOP)

1. Agent → simple FM CSD → Convert → **Cabbage/VST**  
2. Settings → Cabbage path → Open in Cabbage  

### C. Export Chrome (TOP)

1. Convert → **Web App** → Open in Browser → Start Audio → keyboard  

### D. Linux laptop

```bash
cd ~/DRC-Standalone && npm test
cd ~/Dr.C/opencode && node scripts/workshop-test.mjs
```

---

## Key files

| Area | Path |
|------|------|
| Player page / MIDI | `src/renderer/pages/PlayerPage.tsx`, `lib/useMidi.ts` |
| Demo phrases | `src/renderer/lib/playerDemoArpeggio.ts` |
| Limiter | `src/shared/csd-realtime-options.ts`, `src/main/csound/audio-flags.ts` |
| Demo manifests | `resources/workshop-starters/*-player-demos.json` |
| Smoke gate | `scripts/smoke-test.mjs`, `scripts/workshop-test.mjs` |
| Chowning build | `scripts/build-chowning-player-models.mjs` |

---

*Next chat: start with HOTEL-RESUME.md → Cabbage + Chrome exports → Linux native smoke.*
