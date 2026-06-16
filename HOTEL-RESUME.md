# Hotel resume — Dr.C LAC build (2026-06-15)

**Start a new Cursor chat with this file + `LAC-2026-SESSION-HANDOFF.md`.**  
Do not paste the old transcript — it costs tokens and is mostly stale.

**Branch:** `lac-2026-csound7` · **Tests (macOS):** `npm test` → 126 smoke + platform + build ✅

---

## What shipped in this push

### Player
- **Demos menu** — 70+ bundled MIDI models (Bass, Chinese, HandPan, FM, Misc, CZ, …) via `player-model-demos.json` + `node scripts/ingest-player-model-demos.mjs`
- **MIDI volume fix** — web/Player keyboard sends p5 as 0–1; `midiModelPlayerWrap` no longer divides by 127
- **QWERTY labels** on piano; **Player CSD panel** (save/revert/delete demos)
- **Orphan csound cleanup** on launch/stop (fixes system-wide silence)
- **`--limiter=0.9`** on realtime play

### Agent / RAG
- **Golden shortcut** for FM woodblock → `fm_woodblock_midi_starter.csd` (`fmpercfl`, not raw `foscili`)
- RAG pins `csoundmanual-fmpercfl` / `fmbell` first; synthesis specialist on all tiers

### Web apps
- **WASM 7** (`@csound/browser@7.0.0-beta31`): compile CSD → `start()` → notes
- **Hz keyboard fix** — `cpsmidinn(p4)` rewritten to `p4` (Hz) in `csd-webapp-prepare.ts` + `webHarness` runtime
- **Open in Browser** artifact button; **Settings → Web Browser** (Chrome/Safari/Firefox path)

### External apps
- Open in **CsoundQt** (existing); Open in **Browser** for webapp artifacts
- Saves: `~/Documents/DrC/webapps/<title>/index.html`

---

## If something breaks at the hotel

| Symptom | Check |
|---------|--------|
| Player demos too quiet | Rebuild; confirm `midiModelPlayerWrap` uses `p5 *` not `p5/127` |
| Web app silent in browser | Re-convert artifact (old HTML has `cpsmidinn p4`); click **Start Audio**; need network for CDN |
| No system audio | `pkill -f csound`; relaunch Dr.C (orphan cleanup) |
| Agent woodblock compile error | Should hit golden shortcut; else re-prompt with "FM woodblock MIDI" |

```bash
cd ~/DRC-Standalone
export PATH="$HOME/bin:$HOME/Applications/Csound:$PATH"
npm run build && npm test
./scripts/launch-drc.sh
```

---

## Next session priorities (optional)

1. End-to-end: Agent "FM woodblock + MIDI" → golden path → Player USB MIDI
2. Re-ingest player demos if source folders change: `node scripts/ingest-player-model-demos.mjs`
3. Linux laptop: run same `npm test` gate on Ubuntu with Csound 7 built from source
4. Terminal repo (`~/Dr.C/opencode`) still has separate uncommitted workshop fixes

---

## Token-saving tip for Cursor

1. **New chat** → attach `@HOTEL-RESUME.md` and one task ("fix X").
2. Use **@filename** for code context instead of pasting logs.
3. After a milestone, start fresh — summaries in git + these markdown files are the memory.
