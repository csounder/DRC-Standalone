# CLAUDE.md — DrC Standalone

AI-powered Csound creative tool. An Electron desktop app where a conversational
agent generates Csound instruments (CSD), web apps, and VST plugins, plays them,
and iterates with the user. See `SYSTEM.md` for the full architecture diagram and
`HANDOFF.md` for recent status.

## Run / build

```bash
npm run dev          # Electron + hot reload (loads API keys from repo .env in dev)
npm run build        # electron-vite build → out/ (esbuild; does NOT typecheck)
npm run typecheck    # tsc --noEmit for node + web (has a pre-existing error baseline)
npm run dist:mac     # package installer
```

Requires the `csound` CLI on PATH (the app shells out to it for compile/render/play)
and a Gemini/Anthropic/OpenAI key (Settings page, or `.env` in dev).

## Architecture map

- **`src/main/`** — Electron main (Node).
  - `session/session.ts` — the agent loop. Builds the system prompt
    (`buildSystemPrompt`), runs `streamText` (Vercel AI SDK), streams chunks +
    optional parallel narration to the renderer. Sessions live in an in-memory
    `Map` **and** persist to the memory DB (survive restart).
  - `agent/agent.ts` + `agent/prompts/*.txt` — agent definitions. Primary modes:
    `csound` (Complex) and `csound-sine` (Sine) — the only user-facing "level",
    set via the mode toggle. Hidden sub-agents + `narrator`. Prompts are inlined
    at bundle time via Vite `?raw` (runtime file reads break in packaged builds).
  - `session/narration.ts` — `narrator` subagent: 2 short sentences of grounded
    context, canonical attributions (FM→Chowning, etc.) it must honor, plus a
    second pass that emits clickable `suggestions` (one-click follow-up prompts).
  - `provider/provider.ts` — model resolution (default Gemini Flash; upgrades to
    Claude/OpenAI when a key is set).
  - `retrieval/` — RAG over opcode cards / CSD examples / book text; log-weighted
    token-overlap ranking (`passages.ts`, `engine.ts`).
  - `memory/` — **in-context learning** (see below).
  - `tool/` — Csound CLI tools (compile/render/smoke, file ops, bash).
  - `ipc/` — IPC handlers, registered in `ipc/register.ts`.
- **`src/preload/index.ts`** — the typed `window.api` bridge (`DrcAPI`).
- **`src/renderer/`** — React 19 + Zustand.
  - `pages/AgentPage.tsx` — chat + artifact panel; live artifact detection.
  - `lib/artifactContext.ts` — `wrapWithArtifactContext` embeds the **active
    artifact's exact content** as the edit base, so a follow-up edits whatever
    version is loaded in the panel (or hand-edited), not the newest in chat. The
    new version branches from that loaded version (`editBaseRef` →
    `updatePrimary`).
  - `lib/playback.ts` — single owner of the compile→play→autofix loop.
  - `pages/WebAppsPage.tsx` — preview is full-width by default; HTML source is
    behind an "Open Code" toggle.
  - `stores/` — `sessionStore`, `artifactStore` (versioned, `parentId` chain),
    `playbackStore`, etc.

## Memory & learning (`src/main/memory/`)

Pure in-context (no fine-tuning). SQLite via `better-sqlite3` at
`userData/drc/memory.db`. Degrades to a silent no-op if the native module fails.
**The learning improves the agent's generations from feedback — it does NOT model
the user (no "expertise" concept; that was removed).**

- `db.ts` — connection + idempotent DDL + graceful-disable guard (`isReady()`).
- `schema.ts` — DDL + row types: `sessions`, `messages`, `feedback`,
  `error_fixes`, `lessons`, single-row `learning`.
- `store.ts` — `MemoryStore`: persistence, `signatureOf(error)` fingerprinting,
  lesson save/list/delete.
- `learning.ts` — `Learning`: signed technique/opcode preference weights moved by
  👍/👎/accepted-fix (positive = lean toward, negative = avoid). Heuristic, no ML.
- `lessons.ts` — `Lessons`: extracts durable user instructions from chat on the
  small model (gated by phrasing cues) and stores them as remembered rules.
- `retrieve.ts` — `MemoryRetrieval`: token-bounded prompt blocks injected by
  `buildSystemPrompt` — `<remembered-instructions>` (first, strong), then
  `<learned-guidance>` (soft preferences), `<error-fix-memory>` (autofix turns).
  `matchedLessons()` also echoes a relevant rule INLINE next to the user request.

Three learning signals:
1. **Remembered instructions** — "always make granular textures tonal" is
   captured and applied to every future request, across sessions.
2. **Feedback-learned guidance** — 👍/👎 (renderer `MessageFeedback`) shift
   technique/opcode weights via `memory:feedback` → `Learning.applyFeedback`.
3. **Error→fix library** — when an autofix-and-play succeeds (`playback.ts`), the
   broken→fixed CSD is stored and reused on similar future errors.

## Conventions

- Main-process modules are `namespace` singletons (`Retrieval`, `Provider`,
  `SessionManager`, `MemoryStore`). Match that style.
- IDs come from `util/id.ts` `ascending(prefix)`; events via `util/bus.ts`;
  logging via `util/log.ts` `Log.*`.
- IPC: add a handler in `src/main/ipc/*.ipc.ts`, register in `register.ts`,
  expose on `window.api` in `src/preload/index.ts`.
- Native modules stay external (`externalizeDepsPlugin` in
  `electron.vite.config.ts`); ship their binaries via `build.files` +
  `asarUnpack` in `package.json`.
- The renderer auto-detects artifacts from raw model output; the model emits
  full `<CsoundSynthesizer>…`/`<!DOCTYPE html>`/`<Cabbage>` blocks (no tool calls).

## Working here

`.claude/` carries a curated toolkit (agents, `/plan` `/verify` `/code-review`
`/learn`, skills, TypeScript + common rules) adapted from everything-claude-code.
Prefer `/plan` before non-trivial changes and `/verify` after. `typecheck` has a
known pre-existing error baseline — only treat **new** errors as yours.
