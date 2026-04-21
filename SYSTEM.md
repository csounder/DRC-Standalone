# DrC System Architecture

DrC is a standalone Electron desktop application for AI-powered Csound sound design. It combines a conversational coding agent with an artifact-based workflow for creating Csound instruments, web applications, and VST plugins.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Electron Shell                           │
│                                                                 │
│  ┌─ Main Process (Node.js) ──────────────────────────────────┐  │
│  │                                                           │  │
│  │  Agent System ──→ Provider ──→ Anthropic / Google / OpenAI│  │
│  │       │                                                   │  │
│  │       ├── RAG Engine (197 opcodes, 1952 CSD examples,     │  │
│  │       │              53K lines from The Csound Book)      │  │
│  │       │                                                   │  │
│  │       ├── Tool Registry (compile, render, play, write...) │  │
│  │       │                                                   │  │
│  │       └── Csound CLI (child_process.spawn)                │  │
│  │                                                           │  │
│  │  IPC Handlers: agent, csound, retrieval, config, graph,   │  │
│  │                export, memory                             │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                          │ contextBridge (typed window.api)      │
│  ┌─ Renderer (React 19) ┴───────────────────────────────────┐  │
│  │                                                           │  │
│  │  ┌─ Chat ──────────┐  ┌─ Artifact Panel ──────────────┐  │  │
│  │  │                  │  │                               │  │  │
│  │  │  Conversation    │  │  ♪ CSD  → Play, Edit, Save   │  │  │
│  │  │  with artifact   │  │  ◫ App  → Live iframe preview │  │  │
│  │  │  cards inline    │  │  ⬡ VST  → Cabbage config     │  │  │
│  │  │                  │  │                               │  │  │
│  │  │  [input bar]     │  │  Versions: v1  v2  v3  v4    │  │  │
│  │  └──────────────────┘  │  Export: Save | Web App | VST │  │  │
│  │                        └───────────────────────────────┘  │  │
│  │                                                           │  │
│  │  Pages: Agent | Web Apps | Player | Graph | Settings      │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### Artifacts

Artifacts are the primary output of DrC. Every time the agent generates code, it appears as an interactive artifact in the conversation — not as raw text. There are three artifact types:

| Type | Icon | Trigger | Panel View |
|------|------|---------|------------|
| **CSD** | ♪ | Agent outputs `<CsoundSynthesizer>...</CsoundSynthesizer>` | Code editor with Play/Stop, line count, instrument count. Auto-plays on creation. |
| **Web App** | ◫ | Agent outputs `<!DOCTYPE html>...</html>` | Live iframe preview running @csound/browser. Interactive controls visible immediately. |
| **VST Plugin** | ⬡ | Agent outputs a CSD with `<Cabbage>...</Cabbage>` section | Cabbage widget config + full CSD source. Ready for Cabbage export. |

Artifacts are **detected automatically** from the LLM response. The system prompt instructs the agent on the exact format for each type. Users can convert between types:

- CSD → Web App: click **"◫ Make Web App"** in the artifact panel
- CSD → VST: click **"⬡ Make VST"** in the artifact panel

Each conversion sends a prompt to the LLM asking it to transform the current artifact. The result appears as a new artifact of the target type.

### Versioning

Every artifact has a version number. Edits and conversions create new versions rather than overwriting. The version bar in the artifact panel (`v1 v2 v3...`) allows navigating the full history of a sound's evolution.

---

## Process Architecture

### Main Process (Node.js)

All computation, file I/O, LLM calls, and Csound execution happen here. The renderer never has direct access to Node.js APIs.

**Key modules:**

| Module | Path | Purpose |
|--------|------|---------|
| `agent/agent.ts` | Agent definitions | Three primary modes (Complex, Sine, Sketch) + sub-agents (synthesis, effects, modulation, narrator) |
| `session/session.ts` | Session management | Creates sessions, sends messages, streams LLM responses via `generateText`, manages conversation history |
| `provider/provider.ts` | LLM provider abstraction | Supports Anthropic (Claude), Google (Gemini), OpenAI. Defaults to Gemini 2.5 Flash (free tier). Auto-upgrades to Claude if Anthropic key is set. |
| `retrieval/engine.ts` | RAG retrieval engine | Multi-tier search: opcode cards → CSD examples → Csound Book full-text. Injects relevant knowledge into system prompt. |
| `tool/*.ts` | Tool definitions | csound_compile, csound_render, csound_smoke, write_file, read_file, apply_csd_patch, bash |
| `ipc/*.ts` | IPC handlers | Bridge between main and renderer processes |

### Preload Script

Exposes a typed `window.api` object via Electron's `contextBridge`. Every IPC channel has a corresponding method:

```typescript
window.api.session.create(agentName)    // Create a new agent session
window.api.session.send(sessionID, msg) // Send message, triggers streaming
window.api.csound.writeCsd(content)     // Write CSD to temp file
window.api.csound.compile(path)         // Syntax check
window.api.csound.play(path)            // Real-time playback via -odac
window.api.csound.stop()                // Kill playback process
window.api.config.setApiKey(provider, key) // Save API key
window.api.graph.getData()              // Load knowledge graph
```

### Renderer Process (React 19)

Pure UI rendering. Communicates exclusively through `window.api`. State management via Zustand stores:

| Store | Purpose |
|-------|---------|
| `sessionStore` | Messages, agent mode, streaming state |
| `artifactStore` | Artifact list, active artifact, panel state, version history |
| `appStore` | Theme, audio feedback toggle |
| `graphStore` | Graph selection, search, filters |
| `editorStore` | CSD content for direct editing |
| `playerStore` | Playback state, channel values |

---

## Agent System

### Three Modes

| Mode | Model | Temperature | Use Case |
|------|-------|-------------|----------|
| **Complex** | Gemini 2.5 Flash / Claude Sonnet | default | Full design work: RAG retrieval, all tools, detailed responses |
| **Sine** | Gemini 2.5 Flash / Claude Haiku | default | Quick edits, parameter tweaks, fast iteration. Reduced tool set. |
| **Sketch** | Gemini 2.5 Flash / Claude Sonnet | 0.8 | Exploration mode. Higher temperature for creative variation. |

### Model Resolution

Models are resolved at runtime, not hardcoded:

1. If an **Anthropic API key** is set → use Claude (Sonnet for Complex/Sketch, Haiku for Sine)
2. If a **Google AI key** is set → use Gemini 2.5 Flash for all modes
3. If **both** are set → prefer Anthropic for primary, Google for fallback

### Sub-Agents

Hidden agents used internally:
- `csound-synthesis` — oscillators, FM/AM, additive/subtractive
- `csound-effects` — reverb, delay, filters, distortion, EQ
- `csound-modulation` — envelopes, LFOs, control signals
- `narrator` — computer music history context (educational)

---

## RAG (Retrieval-Augmented Generation)

The retrieval engine loads three tiers of knowledge at startup:

### Tier 0: Opcode Cards (197 opcodes)
Direct lookup by opcode name. Each card has: name, category, syntax, description, related opcodes, domain tags, and linked CSD example IDs.

Source: `resources/knowledge/opcode-cards.json`

### Tier 1: CSD Examples (1,952 files)
Full Csound instrument code from The Csound Book (Boulanger), Cooking with Csound (Horner), the FLOSS Manual, CsoundQt examples, and Iain McCurdy's Realtime Examples. Searched by keyword matching.

Source: `resources/knowledge/bundle-csd.json`

### Tier 2: The Csound Book (53,622 lines)
Full text of The Csound Book (MIT Press, 2000). Windowed search over 20-line chunks for in-depth reference on synthesis techniques, signal processing theory, and Csound programming patterns.

Source: `resources/knowledge/csound_book.txt`

### Knowledge Graph (3,542 nodes, 20,934 edges)
An opcode-to-technique-to-example graph loaded from `bundle-core.json`. Nodes are opcodes, techniques, examples, and chapters. Edges represent relationships: `uses`, `demonstrates`, `explains`, `alternative_to`, `requires`.

### Injection

For each user message, the RAG engine:
1. Scans for opcode names → injects matching opcode cards
2. Searches CSD examples by keyword → injects top matches (with code)
3. Searches book text → injects relevant passages
4. Caps total context at ~3,000 characters to avoid prompt bloat

The result is wrapped in `<retrieved-knowledge>` tags in the system prompt.

---

## Knowledge Graph (Visual)

The Graph page renders an interactive force-directed visualization of computer music history. This is separate from the RAG knowledge graph — it's designed for exploration and education.

### Data

`resources/graph/computer-music-history.json` — a curated dataset of:

- **34 people**: Mathews, Chowning, Xenakis, Vercoe, Risset, Stockhausen, Schaeffer, Boulez, Roads, Puckette, Lazzarini, Boulanger, Walsh, Yi, Heintz, McCurdy, and more
- **15 organizations**: Bell Labs, IRCAM, CCRMA, MIT Media Lab, GRM, WDR, CNMAT, Berklee, Maynooth, MTG
- **25 technologies**: FM synthesis, granular synthesis, spectral processing, physical modeling, Csound, Max/MSP, SuperCollider, Faust, Cabbage, Web Audio API, ambisonics, and more
- **12 artworks**: Stria, Gesang der Jünglinge, Riverrun, Silver Apples of the Moon, GENDY3, Kontakte, Mutations, and more
- **10 concepts**: Fourier's theorem, unit generators, microsound, spectromorphology, live coding, sonification
- **120+ edges**: created, influenced, worked_at, founded, used, developed, taught, preceded

### Rendering

Canvas2D force-directed layout (no WebGL — avoids Electron GPU crashes). Features:
- Force simulation: repulsion between all nodes, attraction along edges, gravity toward center
- Pan and zoom (mouse drag + scroll wheel)
- Click to select nodes, hover for highlight
- Node detail panel: description, year, list of connections
- Entity type filter chips with color-coded dots
- Search by name/description

### Community Detection

Uses graphology's Louvain algorithm (resolution 1.2) to detect clusters. Each community gets a jewel-tone color from a 20-color palette.

---

## Csound Integration

### Compilation
`csound --syntax-check-only <file>` via `child_process.execFile`. Returns success/failure with parsed error messages.

### Rendering
`csound -o <output.wav> <file>` with 30-second timeout. Parses WAV header for duration/sample rate metadata.

### Real-time Playback
`csound -odac -d -m0 <file>` spawned as a child process. The process reference is tracked so it can be killed on stop. On macOS, playback goes through the default audio output.

### Temp Files
CSD content from the editor is written to `<electron-temp>/drc/current.csd` before any Csound operation. This keeps the pipeline simple — the LLM generates text, the UI detects it, writes it to disk, and runs Csound on it.

---

## UI / Design System

### SATIE-Inspired Aesthetic

The visual design references the SATIE spatial audio application:

- **Colors**: Warm cream/green. Light mode: `#f4f3ee` bg, `#1a3a2a` accent. Dark mode: `#111110` bg, `#7cb8a4` accent.
- **Typography**: Inter (primary), SF Mono (code). Light weights (300-500), generous letter-spacing (0.02-0.06em).
- **Layout**: 72px icon sidebar, conversation fills remaining width, artifact panel slides in from right (520px).
- **Borders**: 1.5px solid, 20px radius on panels, 12-14px on buttons.
- **Interactions**: `transform: scale(0.96)` on active, 150ms transitions.
- **Audio feedback**: Subtle sine tones from C major scale on click, navigate, toggle, success. Max volume 0.075.

### Pages

| Page | Sidebar Icon | Purpose |
|------|-------------|---------|
| **Agent** | ⬡ | Main interface. Chat + artifact panel. |
| **Web Apps** | ◫ | Gallery of 6 reference apps (drum machine, Étude #1, Fibonacci FM, FM bell, fractal explorer, weather sonification). Click to inspect code and CSD. |
| **Player** | ▶ | Standalone player with rotary knobs, piano keyboard, waveform display. |
| **Graph** | ◉ | Interactive knowledge graph of computer music history. |
| **Settings** | ⚙ | API keys (Google/Anthropic/OpenAI), theme, audio feedback, Csound path, profile. |

---

## Configuration

### API Keys

Stored at `<userData>/drc/config.json`. Encrypted at rest by the OS keychain (Electron's userData directory). The settings page saves keys via IPC and reconfigures the provider in real-time.

Priority:
1. Saved keys in config.json
2. Environment variables: `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`

### Default Model

Gemini 2.5 Flash (free tier) is the default. This means DrC works out of the box with just a free Google AI key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Setting an Anthropic key upgrades to Claude automatically.

---

## Educational Layer

### Technique Lineages

10 complete historical timelines covering the evolution of synthesis techniques:

- FM Synthesis (Chowning 1967 → DX7 1983 → Csound foscil)
- Granular Synthesis (Gabor 1947 → Roads 1978 → partikkel)
- Spectral Processing (Fourier 1822 → FFT 1965 → pvs opcodes)
- Physical Modeling (waveguide 1983 → STK 1993 → wgbow/wgflute)
- Additive, Subtractive, Wavetable, Stochastic, Sample-Based, Ring Modulation

Each lineage includes: timeline events with dates and key people, related Csound opcodes, and connected techniques.

### Narrator

A sub-agent (using the small model) that can provide 2-4 sentence computer music history context related to the current work. Triggered optionally during synthesis sessions.

---

## File Structure

```
drc-app/
├── src/
│   ├── main/                          # Electron main process
│   │   ├── index.ts                   # App lifecycle, GPU safety flags
│   │   ├── ipc/
│   │   │   ├── register.ts            # Registers all IPC handlers
│   │   │   ├── agent.ipc.ts           # Session create/send with background streaming
│   │   │   ├── csound.ipc.ts          # writeCsd, compile, render, play, stop
│   │   │   ├── config.ipc.ts          # API key save/load + provider reconfiguration
│   │   │   ├── graph.ipc.ts           # Knowledge graph data serving
│   │   │   ├── retrieval.ipc.ts       # RAG search endpoints
│   │   │   ├── export.ipc.ts          # Export pipeline (stub)
│   │   │   └── memory.ipc.ts          # Memory store (stub)
│   │   ├── agent/
│   │   │   ├── agent.ts               # Agent definitions and mode resolution
│   │   │   └── prompts/               # 7 prompt .txt files (from opencode)
│   │   ├── session/
│   │   │   └── session.ts             # Session manager, LLM streaming, prompt assembly
│   │   ├── provider/
│   │   │   └── provider.ts            # Multi-provider LLM (Google, Anthropic, OpenAI)
│   │   ├── retrieval/
│   │   │   └── engine.ts              # RAG engine: opcode cards, CSD examples, book search
│   │   ├── tool/
│   │   │   ├── tool.ts                # Tool.define() base system
│   │   │   ├── registry.ts            # Tool registration and imports
│   │   │   ├── csound_compile.ts      # Syntax validation
│   │   │   ├── csound_render.ts       # WAV rendering with metadata
│   │   │   ├── csound_smoke.ts        # Quick smoke test
│   │   │   ├── write_file.ts          # File writing
│   │   │   ├── read_file.ts           # File reading
│   │   │   ├── apply_csd_patch.ts     # Unified diff patching
│   │   │   └── bash.ts                # Shell command execution
│   │   ├── educational/
│   │   │   └── lineage-data.ts        # 10 technique lineages with timelines
│   │   └── util/
│   │       ├── bus.ts                 # Event pub/sub
│   │       ├── fs.ts                  # Node.js file utilities (replaces Bun APIs)
│   │       ├── id.ts                  # Ascending ID generator
│   │       └── log.ts                 # Logging
│   │
│   ├── preload/
│   │   └── index.ts                   # contextBridge: typed window.api
│   │
│   └── renderer/                      # React 19 UI
│       ├── main.tsx                   # React root
│       ├── App.tsx                    # Router + streaming hook + theme
│       ├── styles/
│       │   ├── globals.css            # CSS custom properties, reset, scrollbar
│       │   ├── theme.ts              # Light/dark themes, community colors
│       │   ├── audio-feedback.ts     # C major sine tones for UI interactions
│       │   └── particles.ts          # Background particle animation
│       ├── stores/
│       │   ├── sessionStore.ts       # Messages, agent mode, streaming
│       │   ├── artifactStore.ts      # Artifacts, versions, panel state
│       │   ├── appStore.ts           # Theme, audio feedback
│       │   ├── graphStore.ts         # Graph selection/filters
│       │   ├── editorStore.ts        # Direct CSD editing
│       │   └── playerStore.ts        # Playback state
│       ├── hooks/
│       │   └── useStream.ts          # IPC streaming chunk handler
│       ├── pages/
│       │   ├── AgentPage.tsx         # Chat + artifact panel (main interface)
│       │   ├── WebAppsPage.tsx       # Reference app gallery
│       │   ├── PlayerPage.tsx        # Knobs + keyboard + waveform
│       │   ├── GraphPage.tsx         # Knowledge graph visualization
│       │   └── SettingsPage.tsx      # API keys, preferences
│       └── components/
│           ├── layout/
│           │   └── Sidebar.tsx       # 72px navigation sidebar
│           ├── artifacts/
│           │   ├── ArtifactPanel.tsx  # Right-side co-work panel
│           │   ├── CsdArtifact.tsx   # CSD viewer: play/stop, edit, status
│           │   ├── WebAppArtifact.tsx # iframe live preview
│           │   └── VstArtifact.tsx   # Cabbage config viewer
│           ├── chat/
│           │   ├── ArtifactCard.tsx  # Inline artifact reference in chat
│           │   ├── CsdBlock.tsx      # Collapsible CSD block (legacy)
│           │   └── VersionTimeline.tsx # Version bar component
│           ├── editor/
│           │   └── CsdEditor.tsx     # Monaco with Csound syntax highlighting
│           ├── player/
│           │   ├── Knob.tsx          # Rotary knob with drag interaction
│           │   ├── PianoKeyboard.tsx # SVG piano (3 octaves, mouse/touch)
│           │   └── WaveformDisplay.tsx # Canvas waveform renderer
│           └── graph/
│               ├── GraphCanvas.tsx   # Canvas2D force-directed graph
│               ├── NodeDetail.tsx    # Selected node info panel
│               └── graph-data.ts    # graphology processing + Louvain communities
│
├── resources/
│   ├── knowledge/
│   │   ├── bundle-core.json          # 197 opcode cards + 3542-node knowledge graph
│   │   ├── bundle-csd.json           # 1952 CSD example files
│   │   ├── opcode-cards.json         # Standalone opcode reference
│   │   ├── csound_book.txt           # Full Csound Book text (53K lines)
│   │   ├── csound7-reference.txt     # Csound 7 LLM reference guide
│   │   └── sources/                  # Markdown reference docs
│   ├── graph/
│   │   └── computer-music-history.json # Visual knowledge graph dataset
│   └── apps/                         # Reference web app storage
│
├── package.json
├── electron.vite.config.ts
├── tsconfig.json / .node.json / .web.json
└── SYSTEM.md                         # This file
```

---

## Dependencies

### Core
- `electron` + `electron-vite` — Desktop shell and build toolchain
- `react` 19 + `react-dom` + `react-router-dom` — Renderer UI
- `zustand` — State management
- `ai` (Vercel AI SDK) — LLM abstraction
- `@ai-sdk/anthropic` + `@ai-sdk/google` + `@ai-sdk/openai` — Provider SDKs
- `zod` — Schema validation

### Knowledge Graph
- `graphology` — Graph data structure
- `graphology-communities-louvain` — Community detection
- `graphology-layout-forceatlas2` — Force-directed layout (used in data processing)

### UI
- `@monaco-editor/react` — Code editor with Csound syntax highlighting

---

## Future Work

- **True streaming**: Replace `generateText` with proper `streamText` iteration for real-time token display
- **Live coding mode**: Persistent Csound process with UDP hot-reload
- **Ableton integration**: OSC bridge for sending clips and controlling parameters
- **Cabbage compilation**: Direct VST/AU export from the artifact panel
- **@csound/browser**: In-app Csound via WebAssembly for the Player page (no CLI dependency)
- **User profile**: Expertise tracking, preferred techniques, narration depth
- **Session persistence**: SQLite storage for conversation history across app restarts
- **Expanded knowledge graph**: Auto-extract entities from curated books and examples
