# Hotel resume — Dr.C LAC build (2026-06-16)

**Start a new Cursor chat with this file + `LAC-2026-SESSION-HANDOFF.md`.**  
Do not paste the old transcript — use these docs instead.

**Branch:** `lac-2026-csound7`  
**Last smoke (macOS):** Standalone **139/139** smoke + workshop gate ✅ · CLI **16/16** workshop ✅ · knowledge parity ✅

---

## What to do first when you wake up

```bash
cd ~/DRC-Standalone
git pull
export PATH="$HOME/bin:$HOME/Applications/Csound:$PATH"
npm run build && npm test
./scripts/launch-drc.sh
```

**Top priorities (not yet tested end-to-end):**

1. **Export to Cabbage** — Artifact panel → Convert → VST/Cabbage; open in configured Cabbage.app
2. **Export to Chrome** — Web App artifact → **Open in Browser** (Settings → Web Browser path)

---

## What shipped in this session (Player + demos)

### Demo menu (curated)
- **Chowning FM** split into 6 player-ready models with renames:
  - FM Nasty Lead 1 / FM Nasty Lead 2, FM Pad / FM Pad 2, FM Keys 1, FM Lead 1 (Williams wood drum)
- **Removed:** clarinet/trumpet/DSF clarinet/Risset piano, all **Trapped** variations (~37), Vowgen UDO, many legacy Dr. B duplicates
- **Renames:** French Horn → **FM Lead 3**; Midi Grain → **Granular 1**; Step Sequencer → Fat Pad 1 (prior)
- Manifests: `chowning-player-demos.json`, `player-model-demos.json`
- Rebuild Chowning: `node scripts/build-chowning-player-models.mjs`

### Levels & safety
- **`--limiter=0.9` everywhere:** CLI spawn, `writeCsd`, all workshop CSDs (`scripts/ensure-limiter-on-csds.mjs`), Agent/convert prompts
- **FM Lead 3 (horn):** legacy 32768 amp rescale + `giHornMaster` + `tanh()` — louder in latest pass
- **Granular 1:** softer (`giGrainGain`, lower default amplitude)
- **Wave Sequencing:** slightly louder envelope gain in adapt layer

### Player engine
- **Rhythmic demo phrases** per instrument (`playerDemoArpeggio.ts`) — bass low register, harmony per demo
- **Mechanical adapt stack:** `scoreModelPlayerAdapt`, `legacyDrBModelAdapt`, `trappedPlayerAdapt`, `midiModelPlayerWrap`, `mechanicalPlayerAdapt`
- **USB MIDI:** Web MIDI → stdin; re-bind on engine live (`useMidi` + `inputLive`); default MIDI enabled
- **Orphan csound cleanup** before each Player spawn

### Agent / Web
- Signal-flow study UI, web harness (USB MIDI, waveform/FFT, Panic)
- Golden routes + workshop model shortcuts (`workshop-model-routes.ts`)

---

## Smoke test results (2026-06-16)

| Gate | macOS | Linux |
|------|-------|-------|
| Standalone `npm test` (platform + smoke + memory + build) | ✅ | *Run on Ubuntu laptop* |
| Standalone `npm run test:smoke` alone | **139 pass** | same script on Linux |
| Standalone `npm run test:parity` (vs CLI knowledge) | ✅ after `node scripts/sync-knowledge-to-cli.mjs` | N/A |
| CLI `node scripts/workshop-test.mjs` | **16 pass** | same script on Linux |

Linux was **not executed on a native host** this session (no Docker on build machine). The smoke suite and launchers already assert `linuxPaths` in `csound-path.ts`; run `npm test` on the Ubuntu workshop laptop before LAC.

---

## If something breaks

| Symptom | Fix |
|---------|-----|
| USB MIDI dead after load | Wait for “Live — keyboard or MIDI”; toggle MIDI off/on; reload demo |
| Demo too loud / quiet | Levels are in adapt layers — reload patch after rebuild |
| No system audio | `pkill -f csound`; relaunch Dr.C |
| Parity fail vs CLI | `node scripts/sync-knowledge-to-cli.mjs` from Standalone |

---

## Next session checklist

- [ ] **Cabbage export** — full round-trip on macOS
- [ ] **Chrome / Browser export** — Start Audio, keyboard, USB MIDI in exported HTML
- [ ] **Linux native** — `npm test` on Ubuntu + CLI `node scripts/workshop-test.mjs`
- [ ] Player USB MIDI with hardware controller on all demo groups
- [ ] Optional: re-tag release after LAC validation

---

*Sleep well. Pull, build, test — then Cabbage + Chrome exports first.*
