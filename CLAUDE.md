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
  - `agent/agent.ts` + `agent/prompts/*.txt` — agent definitions (primary:
    `csound`, `csound-sine`, `sketch`; hidden sub-agents). Prompts are inlined at
    bundle time via Vite `?raw` (runtime file reads break in packaged builds).
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
  - `lib/playback.ts` — single owner of the compile→play→autofix loop.
  - `stores/` — `sessionStore`, `artifactStore`, `playbackStore`, etc.

## Memory & learning (`src/main/memory/`)

Pure in-context (no fine-tuning). SQLite via `better-sqlite3` at
`userData/drc/memory.db`. Degrades to a silent no-op if the native module fails.

- `db.ts` — connection + idempotent DDL + graceful-disable guard (`isReady()`).
- `schema.ts` — DDL + row types: `sessions`, `messages`, `feedback`,
  `error_fixes`, single-row `profile`.
- `store.ts` — `MemoryStore`: persistence, `signatureOf(error)` fingerprinting.
- `profile.ts` — `ProfileManager`: heuristic EMA expertise + technique weights
  from feedback (no ML).
- `retrieve.ts` — `MemoryRetrieval`: token-bounded prompt blocks
  (`<user-profile>`, `<preferences>`, `<error-fix-memory>`), injected by
  `buildSystemPrompt`.

Learning loop: every chat persists; 👍/👎 (renderer `MessageFeedback`) and
auto-captured error→fix pairs (when an autofix-and-play succeeds, see
`playback.ts`) flow through `memory:feedback` → profile update → smarter prompts.

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
