# DrC — Standalone

AI-powered Csound creative tool. Electron app.

> No packaged binary is published yet — install from source below.

## Prerequisites

- **Node.js ≥ 20** and npm
- **Git**
- **Csound** on your `PATH` — the app shells out to the Csound CLI for
  compile/render/play
  - macOS: `brew install csound`
  - Linux (Debian/Ubuntu): `sudo apt install csound`
  - Windows: download from [csound.com/download](https://csound.com/download.html)

## Install

```bash
git clone https://github.com/mateolarreaferro/DRC-Standalone.git
cd DRC-Standalone
npm install
```

Add an API key (either works):

1. Settings page → paste a Gemini key and hit **Test**. Use an **AI Studio** key
   (Gemini Developer API, free) from https://aistudio.google.com/apikey —
   Vertex AI credentials won't work.
2. Copy `.env.example` to `.env` at the repo root and fill in the key(s):
   ```
   GEMINI_API_KEY=...
   # optional fallbacks:
   ANTHROPIC_API_KEY=...
   OPENAI_API_KEY=...
   ```

The app pins the Gemini endpoint to `generativelanguage.googleapis.com/v1beta`,
which is what free AI Studio keys authenticate against.

## Run

```bash
npm run dev        # dev with hot reload (opens the Electron window)
npm run build      # bundle main + preload + renderer → out/
npm run typecheck  # tsc, both node + web projects
```

`npm run dev` is the usual day-to-day entry point — it bundles, launches
Electron, and hot-reloads on file changes.

After `npm run build`, you can relaunch the bundled output without the dev
server:

```bash
npx electron out/main/index.js
```

## Architecture

See [SYSTEM.md](./SYSTEM.md) for full system documentation.

Short version:
- **Main** (`src/main/`): LLM provider (Google/Anthropic/OpenAI), Csound CLI, RAG engine, IPC handlers.
- **Preload** (`src/preload/`): typed `window.api` bridge.
- **Renderer** (`src/renderer/`): React 19 UI with artifact panel (CSD / Web App / VST).
- **Resources** (`resources/knowledge/`): 197 opcode cards, 1,952 CSD examples, Csound Book full text.

## Artifacts

Three artifact types are auto-detected from LLM output:

| Type | Trigger | Files |
|------|---------|-------|
| CSD | `<CsoundSynthesizer>...</CsoundSynthesizer>` | `main.csd` |
| Web App | `<!DOCTYPE html>...</html>` | `index.html` + derived `app.js`, `style.css`, `main.csd` |
| VST | `<Cabbage>` + `<CsoundSynthesizer>` | `main.csd` + derived `widgets.cabbage` |

Edit the primary file (e.g. `main.csd`, `index.html`) in the artifact panel — derived files are read-only views that re-compute after each edit.
