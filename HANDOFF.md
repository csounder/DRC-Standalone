# HANDOFF log

Append-only notes from agents and the main thread when finishing a chunk of work. Keep entries short — one block each, dated, with the files touched and any caveats.

Format:
```
## [yyyy-mm-dd] <agent or human> — <subject>
- files: list
- notes: surprises, deviations, follow-ups
```

---

## [2026-05-05] Claude (main) — v1.1.0 release: PATH fix, prompt cleanup, MIDI Learn diagnostics, Settings polish, LIVE removal, graph dedupe, tooltip animation
- files:
  - src/main/util/csound-path.ts (new)
  - src/main/ipc/csound.ipc.ts (PATH on every spawn site, multi-line `<CsOptions>` normalization in writeCsd, removed `csound:live:*` IPC stubs)
  - src/main/ipc/llm.ipc.ts (`maxTokens` 4000 → 8192)
  - src/main/tool/{bash,csound_compile,csound_render,csound_smoke}.ts (PATH augmentation)
  - src/renderer/prompts/convert.ts (new `cleanSource()` strips bsbPanel/bsbPresets/MacGUI/MacOptions/EventPanel and trailing junk after `</CsoundSynthesizer>`)
  - src/renderer/pages/PlayerPage.tsx (case-insensitive spec lookup + console.warn in `handleCCBinding`; LIVE button + handler + styles removed)
  - src/renderer/pages/SettingsPage.tsx (banner says "Saved in DRC", distinguishes saved-vs-env, Gemini link is a real `<a target="_blank">`, new `extLink` style)
  - src/renderer/stores/playerStore.ts (`isLiveMode`/`setLiveMode` removed)
  - src/renderer/components/layout/Sidebar.tsx (tooltip uses opacity-only fade)
  - src/renderer/styles/globals.css (new `drc-fade-opacity` keyframes)
  - src/preload/index.ts (`liveStart`/`liveChannel`/`liveHotReload` bridge methods removed)
  - resources/graph/computer-music-history.json (merged duplicate "csound-lang" → "csound": 1236 edges rewritten, 189 duplicates dropped, 0 self-loops; node count 2985 → 2984, edge count 5377 → 5188)
  - scripts/smoke-test.mjs (new — 20-case end-to-end smoke test)
  - package.json (1.0.0 → 1.1.0)
- notes:
  - **PATH bug was root-causing every "Csound not found" symptom in packaged builds.** macOS Electron is launched by `launchd` with a stripped `/usr/bin:/bin` PATH, so `/opt/homebrew/bin/csound` is invisible to `child_process.spawn`. `withCsoundPath()` prepends `/opt/homebrew/bin`, `/usr/local/bin`, and the two CsoundLib64 framework `Resources/bin` paths. Applied to every spawn/execFile site — five tool files plus three handlers in csound.ipc.ts. Order matters (prepend, not append) so a stale csound shim elsewhere on PATH can't win.
  - **Csound 6.18 has a parser bug with `<CsOptions>-odac -d</CsOptions>` on a single line under `--syntax-check-only`.** It mis-parses the next tag as if it were part of options content and bails with `Invalid arguments in <CsOptions>: <CsInstruments>`. Multi-line `<CsOptions>...\n-odac -d\n...</CsOptions>` works fine. The PLAYER_TEMPLATE emits the one-liner and so do many user CSDs; rather than patch every adapter output, `writeCsd` normalizes to multi-line on disk before passing the path to csound. The `--syntax-check-only` flag itself was kept — combined with `-n` it's the lightest valid syntax check.
  - **Adapt was truncating outputs.** `maxTokens: 4000` was below the actual length of an adapted player CSD with `chn_k` bank + `instr 100` helper + reverb bus + rewritten voice (typically 5–7K tokens). The model would stop mid-orchestra, the closing `</CsoundSynthesizer>` tag never arrived, and `extractCsd` returned null with a generic "missing block" error. Bumped to 8192 — leaves headroom and stays well below the model's per-call limit.
  - **CsoundQT metadata was poisoning prompts.** Real-world `.csd` files often trail a `<bsbPanel>...</bsbPanel>` block (CsoundQT's GUI definition) that's hundreds of lines of XML. The model was treating its widget definitions as part of the patch ("the source defines a 'gain' widget so I should keep it"). `cleanSource()` runs in `buildConvertPrompt` and strips the GUI blocks plus anything after `</CsoundSynthesizer>` before the source hits the prompt template.
  - **MIDI Learn most-likely failure mode is a stale binding referencing a chn_k name that no longer exists in the current patch.** Bindings persist in localStorage but the chn_k bank is per-CSD. Pre-fix: `handleCCBinding` did `channelSpecs.find(c => c.name === channelName)`; if undefined, silently bailed → CC moves had no effect. Post-fix: case-insensitive fallback (handles trivial casing drift between adapter runs), then a `console.warn` listing what *is* in the current bank if no match — DevTools surfaces the actual cause. Did *not* auto-prune stale bindings; the user can clear them from the store if needed.
  - **Settings was overclaiming key state.** `Provider.availableProviders()` (in `provider.ts:64-70`) returns providers that are saved *or* present via env vars (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, etc.). The old banner said "Connected: google" while the Saved row was empty whenever a shell-exported key was around. New banner distinguishes "Saved in DRC: …" from "Using API key from environment (…)" and never claims verification — that's what the per-key Test button is for.
  - **Gemini link was a `<span>`.** Now an `<a target="_blank" rel="noopener noreferrer">`; the existing `setWindowOpenHandler` in `main/index.ts:60-63` routes those through `shell.openExternal`. No new IPC needed.
  - **LIVE button was a stub.** Toggled `isLiveMode` boolean, flipped its own border red, called nothing else. Three `csound:live:*` IPC handlers all returned `{ success: false, error: 'Live engine not yet implemented' }` and nothing in the renderer called them. Deleted the button, store flag, IPC handlers, and preload bridge methods.
  - **Sidebar tooltip animation was clobbering its centering offset.** `drc-fade-in` keyframes set `transform: translateY(8px) → translateY(0)`, overriding the static `transform: translateY(-50%)` that vertically centers the tooltip. Visible result: tooltip pops in below center then snaps up. New `drc-fade-opacity` keyframe is opacity-only; the static transform survives.
  - **Knowledge graph had two "Csound" nodes.** `csound-lang` (434 edges) and `csound` (1236 edges) — same label, year, type. Kept `csound` as canonical (more edges, more accurate description), unioned aliases (12 unique), rewrote 1236 edges, dropped 189 duplicates created by the merge, no self-loops. The merge script is `/tmp/merge-csound.mjs`; not committed because it's a one-shot. Other Csound-related nodes (`ctcsound`, `csoundqt`, `csound-api`, etc.) are distinct entities and were left intact.
  - **Smoke test (`node scripts/smoke-test.mjs`) is the regression catch-all.** 20 cases across 6 sections: PATH lookup under stripped env (proves `withCsoundPath` actually finds csound), `cleanSource` behavior, `parseChannels` round-trip and MIDI-name-correctness, real csound spawn (compile + render + audible-output check on a synthetic player-shaped CSD), Settings-page source assertions, and a per-file tsc-vs-HEAD-baseline delta. The repo has pre-existing tsc errors on HEAD (retrieval, session, apply_csd_patch, CsdEditor, Graph3D, etc.); the test gates only on whether files this commit touched exceeded their HEAD baseline. If HEAD moves and the baseline drifts, refresh `BASELINE_NODE` / `BASELINE_WEB` in the test.
  - **Build + release shipped.** `npm run dist:mac` produced 4 mac artifacts (arm64+x64 × dmg+zip). Tagged `v1.1.0`, pushed `main` + tag, created GitHub release with all artifacts and `latest-mac.yml` for auto-update: https://github.com/mateolarreaferro/DRC-Standalone/releases/tag/v1.1.0. App is unsigned — Gatekeeper note in README still applies (`xattr -cr /Applications/DrC.app`).
  - **Did NOT ship Windows or Linux builds.** `dist:win` and `dist:linux` scripts exist in package.json but weren't run; would require a Windows/Linux host or cross-compile setup. Not currently a blocker — README's Releases link works for mac users today.
  - **Did NOT fix the pre-existing tsc errors.** Out of scope; they predate this session and would need their own pass (notably `apply_csd_patch.ts` ToolResult type mismatch, `retrieval.ipc.ts` missing `Retrieval.deepSearch`, `Graph3D.tsx` nodeVal typing, `CsdEditor.tsx` Monaco `setLanguage`).
  - Open questions / follow-ups: (1) The MIDI-Learn diagnostic only fires in DevTools — if users still report bound CCs not working, the next step is checking the main-process log for `setChannel` warnings (process dead, stdin unavailable). (2) `PlayerPage` does not auto-prune stale bindings on CSD swap; consider adding once we confirm the diagnostic surfaces enough info. (3) Adapter occasionally still emits `chnget` at global scope despite the template's explicit warning — that produces silent-knob CSDs even after this commit's fixes. A linter pass on the adapted output (reject + autofix) would catch it; out of scope for this release.
