# DrC — Standalone

AI-powered Csound creative tool. Electron app.

## Setup

```bash
npm install
```

Add an API key (either works):

1. Settings page → paste a Gemini key (free, from https://aistudio.google.com/apikey), or
2. Create `.env` at the repo root:
   ```
   GEMINI_API_KEY=...
   # optional fallbacks:
   ANTHROPIC_API_KEY=...
   OPENAI_API_KEY=...
   ```

## Run

```bash
npm run dev        # dev with hot reload
npm run build      # production build → out/
npm run typecheck  # tsc, both node + web projects
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
