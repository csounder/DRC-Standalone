# LAC 2026 Workshop — Session Handoff

**Date:** 2026-06-15 (airport pause)  
**For:** Richard Boulanger  
**Goal:** Dr.C Standalone + Terminal ready for a Csound 7 workshop at LAC (Maynooth, June 18–20, 2026)

> **START HERE:** [`AIRPORT-PICKUP.md`](AIRPORT-PICKUP.md) — no-sound status, uncommitted fixes, 5-minute diagnostics.

---

## Where we are leaving off (2026-06-15)

**BLOCKER: No sound in Dr.C** (Player demos + Agent FM bass). Workshop CSD files **do** produce audio via `csound`/`afplay` in Terminal — problem is in the app playback path.

**Root causes identified (fixes local, not pushed):**

1. **Player (realtime):** Csound 7 on macOS uses **`auhal`**; Settings enumerated **`portaudio`** devices — wrong `-odacN` → silent output.
2. **Agent (generate FM bass):** Compile check passes on shortened score, but **afplay** renders Player hold scores (`f 0 36000`, no notes) → **silent WAV**.
3. **Workshop UX:** Agent buttons loaded offline starters needing adapt; now load **player-ready** CSDs + auto-play (local).

**Pushed to `lac-2026-csound7`:** `66a123f` — usage display crash (`toLocaleString` on null) only.

**Next at airport:** `npm run build` → relaunch from **Dr.C-Standalone.command** → Settings → Audio → System default → Player **Simple FM demo** with Csound console open. See `AIRPORT-PICKUP.md`.

---

## Documentation index (June 2026)

| Doc | Purpose |
|-----|---------|
| **`AIRPORT-PICKUP.md`** | **No sound — read first at airport** |
| **`VERSIONS.md`** | All products, version numbers, launch modes |
| **`TESTING.md`** | Automated + manual checklist before release |
| **`RELEASE-CHECKLIST.md`** | Commit, build, GitHub release, USB |
| **`WORKSHOP.md`** | Teaching notes, attendee prompt, free tier |
| **`LAC-2026-SESSION-HANDOFF.md`** | This file — session log |
| **`HANDOFF.md`** | Technical change history |

---

## Repositories

| Project | Path | Branch | Remote |
|---------|------|--------|--------|
| **Dr.C Standalone** | `~/DRC-Standalone` | `lac-2026-csound7` | `origin/lac-2026-csound7` |
| **Dr.C Terminal** | `~/Dr.C/opencode` | `main` (local changes uncommitted) | `origin/main` |
| **Install docs** | `~/dB-Studio/DRC-URLS.C/` | — | `INSTALL-STANDALONE.md`, `INSTALL-TERMINAL.md`, `WORKSHOP.md` |

**Launch Standalone (workshop build):**

```bash
~/Desktop/Dr.C-Standalone.command
# or
cd ~/DRC-Standalone && ./scripts/launch-drc.sh
```

Requires **Node 22**, **Csound 7** on PATH, and at least one API key in Settings (or `.env` for dev).

---

## Your machine (verified this session)

| Item | Status |
|------|--------|
| Csound 7 | On PATH via `~/bin` / `~/Applications/Csound` |
| CsoundQt | **v7.0.0-beta4.1** at `/Applications/CsoundQt-d-html-cs7.app` |
| Node | 22 (Homebrew `node@22`) |
| API keys configured | Gemini + Groq (free tier) |
| Workshop-lite mode | **On by default** (`DRC_WORKSHOP_LITE=1` in `scripts/launch-drc.sh`) — one Gemini call per turn, not three |

---

## Work completed (this workshop push)

### Csound 7 workshop foundation (Standalone)

- Unified agent prompts for **Csound 7** (removed contradictory 6.18 rules).
- **PATH resolution** prefers `~/bin` and `~/Applications/Csound`.
- **Runtime Csound version** injected into agent environment block.
- **Compile-before-show** for web app conversion; improved autofix loop messaging.
- **Golden starter CSDs** in `resources/workshop-starters/`.
- **`WORKSHOP.md`**, **`INSTALLATION.md`**, launcher script `scripts/launch-drc.sh`.

### Open in CsoundQt

**Standalone**

- `src/main/util/csoundqt-path.ts` — detect / configure CsoundQt 7.
- `src/main/util/launch-external.ts` — reliable external app launch.
- `src/main/ipc/export.ipc.ts` — `export:openInCsoundQt`.
- Settings → CsoundQt path picker.
- **⌨ Open in CsoundQt** in `ArtifactPanel.tsx` (plain CSD / VST, not web apps).
- Saves exports under `~/Documents/DrC/csoundqt/`.

**Terminal**

- `packages/opencode/src/util/external-apps.ts` — improved `findCsoundQt()`.
- CSD panel toolbar **csoundqt** button.
- Command palette **Open in CsoundQt** (already existed).
- `/settings` dialog for paths (see below).

### Main-screen UX (Standalone)

- Removed intrusive **Free API tier** banner from landing and top bar.
- Free-tier note kept in **Settings** only.
- Subtle hint above prompt when no key is configured.
- **`ApiKeyPromptDialog`** on first send without a key.

### Activity feedback + stuck-request fixes (Standalone)

Problem you hit: after ~60s, only timers visible — unclear if Dr.C was still working; afraid to resend (rate limits).

**Fixes implemented (restart app to load):**

| Feature | Files |
|---------|--------|
| Activity bar (Calling Gemini…, Writing CSD…, compile/play, elapsed seconds) | `AgentActivityBar.tsx`, `useStream.ts`, `session.ts` |
| **2-minute stream timeout** with clear error | `session.ts` |
| **Cancel** (activity bar + ✕ on send button while streaming) | `session.ts`, `agent.ipc.ts`, `AgentPage.tsx` |
| Renderer watchdog if main process never completes | `useStream.ts` |
| **`status` stream chunks** from main process | `session.ts`, `useStream.ts` |

### One-click retry (no retyping) — latest change

Problem: after timeout/error on free keys, you had to retype the prompt.

**Fixes:**

| Feature | Behavior |
|---------|----------|
| **Clickable user prompt bubble** | Last prompt → **Try again**; older prompts → **Edit** (refill text field) |
| **Try again / Edit / Variation** under last user message | Same prompt, one new API call; retry does **not** duplicate user history |
| **Try variation** | Slightly higher temperature + random Csound `seed` in header |
| **`PromptRetryBar`** above input | Shown after errors / empty failed turns |
| **Error bubble actions** | Try again, Edit prompt, Try variation |
| **`session:send` options** `{ retry, variant }` | `session.ts`, `agent.ipc.ts`, preload |

### Ollama (local, no API quota) — Standalone

- `src/main/provider/ollama.ts`
- Settings section + config IPC handlers.
- Useful fallback when free cloud tiers throttle.

### Terminal `/settings` (Dr.C opencode)

- `dialog-settings.tsx` — providers, free-tier notes, Ollama, CsoundQt/Cabbage paths.
- `util/workshop.ts`, `server/routes/workshop.ts`, config section.
- `app.tsx` — `/settings` command.
- `dialog-provider.tsx` — Gemini/Groq prioritized.
- `external-apps.ts` — reads `workshop.csoundqt_path` / `cabbage_path`.
- `INSTALL-TERMINAL.md` documents `/settings`.
- `launch-drc-terminal.sh` (untracked) — workshop launcher.

### Documentation

- `~/dB-Studio/DRC-URLS.C/INSTALL-STANDALONE.md` — Csound 7, CsoundQt §2.5, workshop launch.
- `~/dB-Studio/DRC-URLS.C/INSTALL-TERMINAL.md` — Terminal install + `/settings`.
- `DRC-Standalone/WORKSHOP.md` — attendee quick start, free-tier notes, starter prompt.

---

## Known issues (not yet solved)

### 1. Free tier may not return Csound

- Gemini free tier: ~20 requests/minute; can return **empty streams** with no thrown error.
- Symptom: timer runs 30–120s, no text, no sound.
- **Do not** send the same prompt repeatedly while the timer is running — that burns quota faster.
- **Do** use **Cancel** or wait for timeout, then **Try again** (one click on your prompt).

### 2. Uncommitted code

**Standalone** (`lac-2026-csound7`) — modified / new files not yet committed:

```
INSTALLATION.md, WORKSHOP.md
src/main/ipc/{agent,config,export}.ipc.ts
src/main/provider/{provider,ollama}.ts
src/main/session/session.ts
src/main/util/{csoundqt-path,launch-external,usage-cost}.ts
src/preload/index.ts
src/renderer/{pages/AgentPage,SettingsPage}.tsx
src/renderer/components/{ApiKeyPromptDialog,artifacts/ArtifactPanel}.tsx
src/renderer/components/chat/{AgentActivityBar,PromptRetryBar}.tsx
src/renderer/hooks/useStream.ts
src/renderer/stores/sessionStore.ts
src/renderer/lib/playback.ts
```

**Terminal** — modified / new files not yet committed:

```
packages/opencode/src/cli/cmd/tui/{app,dialog-settings,dialog-provider}.tsx
packages/opencode/src/cli/cmd/tui/routes/session/{csd-panel,index}.tsx
packages/opencode/src/{config/config,server/server}.ts
packages/opencode/src/server/routes/workshop.ts
packages/opencode/src/util/{external-apps,workshop}.ts
launch-drc-terminal.sh (new)
```

### 3. Pre-existing TypeScript errors

`npm run typecheck` still reports errors in tool files, retrieval, etc. — predates this workshop work. Smoke test and runtime dev still work.

---

## Suggested test plan (when you return)

### A. Free tier — minimal path

1. Restart Dr.C from `Dr.C-Standalone.command`.
2. Settings → confirm **Gemini** key; optionally add **Groq** as backup.
3. New chat. Send exactly:

   ```
   make a plain Csound CSD only — no Cabbage. Simple sine tone at 440 Hz. Include score i 1 0 3 so it renders.
   ```

4. **Success looks like:** activity bar → short text → CSD in panel → compile → **you hear sound**.
5. If it fails: wait for error or Cancel → click your prompt bubble → **Try again** (not retype).
6. If still failing: Settings → try **Groq** only (remove Gemini temporarily) or enable **Ollama** if installed locally.

### B. Paid / full keys

1. Settings → add Anthropic and/or a non-free Gemini key.
2. Same sine test, then a richer prompt (FM pad, granular texture).
3. Compare latency and success rate vs free tier.

### C. CsoundQt round-trip

1. Generate any plain CSD.
2. Artifact panel → **Open in CsoundQt**.
3. Confirm file opens in `/Applications/CsoundQt-d-html-cs7.app`.

### D. Workshop smoke (CLI)

```bash
cd ~/DRC-Standalone
export PATH="$HOME/bin:$HOME/Applications/Csound:$PATH"
csound -n -d -m0 -o /tmp/test.wav resources/workshop-starters/fm_starter.csd
node scripts/smoke-test.mjs
```

---

## Architecture reminder — one user turn

```
User prompt
  → session:send (workshop-lite: 1 LLM call, no narration)
  → stream chunks: status → text (CSD) → stream:complete
  → artifact detection → compile → play
```

Retry path (`retry: true`): reuses stored payload, **no new user message** in session history.  
Variant path: same + higher temperature + random `seed N` hint in CSD.

---

## Key files quick reference

| Area | Path |
|------|------|
| Session / timeout / retry | `src/main/session/session.ts` |
| IPC | `src/main/ipc/agent.ipc.ts` |
| Agent UI | `src/renderer/pages/AgentPage.tsx` |
| Activity + cancel | `src/renderer/components/chat/AgentActivityBar.tsx` |
| Retry bar | `src/renderer/components/chat/PromptRetryBar.tsx` |
| Stream handling | `src/renderer/hooks/useStream.ts` |
| Providers | `src/main/provider/provider.ts`, `ollama.ts` |
| Workshop launcher | `scripts/launch-drc.sh` |
| Starters | `resources/workshop-starters/` |

---

## Agent / project notes

- **Do not commit** unless Richard asks — large uncommitted diff waiting for validation.
- **Do not bump** `@ai-sdk/google` to 2.x without migrating to AI SDK 5 (documented in HANDOFF.md).
- **Workshop-lite** must stay on for free-tier workshops (`DRC_WORKSHOP_LITE=1`).
- Prior HANDOFF log entries: `HANDOFF.md` (append-only technical history).

---

*Sleep well. When you're back: restart Dr.C, run the sine test on free keys, then add full keys and compare.*
