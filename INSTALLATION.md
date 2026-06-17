# INSTALLATION — Agent Runbook

A step-by-step runbook for an AI coding agent (or a human) to take this repo
from a clean checkout to a **working app** and a **packaged installer**, with the
app fully usable (API keys configured, Csound wired, Cabbage launching).

Follow the steps in order. Each step has a **Verify** line — do not proceed until
it passes. The **Gotchas** section at the end lists the non-obvious failures that
have actually bitten this project; read it before debugging anything.

---

## 0. What this app is (so you set it up correctly)

DrC is an Electron desktop app. A conversational agent generates Csound
instruments (CSD), web apps, and Cabbage plugins, plays them via the local
`csound` CLI, and iterates with the user.

- **Main process** (`src/main/`, Node) — LLM provider, Csound CLI shell-outs,
  RAG engine, IPC, SQLite memory.
- **Preload** (`src/preload/index.ts`) — the typed `window.api` bridge.
- **Renderer** (`src/renderer/`, React 19 + Zustand) — chat + artifact panel.

Two external dependencies the app cannot run without:
1. The **`csound` CLI** on `PATH` (compile/render/play shell out to it).
2. **An LLM API key** — Gemini (free), Anthropic, or OpenAI.

Optional integrations (artifact panel export buttons):
- **Cabbage** — live MIDI plugin UI testing
- **CsoundQt 7** — IDE for editing, manual lookup, comparing with Dr.C output
- **Web browser** — open converted web apps in Chrome/Safari/Firefox (Settings → Web Browser)

See workshop install docs (`INSTALL-STANDALONE.md` §2.5) for CsoundQt 7 download links.

---

## 1. Prerequisites

| Tool | Min version | Install | Verify |
|------|-------------|---------|--------|
| Node.js | 20 (22/24 fine) | https://nodejs.org or `brew install node` | `node -v` |
| npm | bundled with Node | — | `npm -v` |
| Git | any recent | `brew install git` | `git --version` |
| Csound CLI | 6.x or 7.x | macOS `brew install csound` · Debian/Ubuntu `sudo apt install csound` · Windows https://csound.com/download.html | `csound --version` |
| GitHub CLI (only to publish a release) | 2.x | `brew install gh` then `gh auth login` | `gh auth status` |

**Verify:** all of `node -v`, `csound --version`, `git --version` print a version.

> macOS note: GUI-launched Electron does **not** inherit your shell `PATH`, so a
> Homebrew `csound` at `/opt/homebrew/bin` can be invisible to the packaged app.
> The app already re-augments `PATH` at every Csound spawn site
> (`src/main/util/csound-path.ts`) — you don't need to do anything, but know this
> is why "csound not found" can happen in a packaged build even when the terminal
> finds it.

---

## 2. Clone and install dependencies

```bash
git clone https://github.com/mateolarreaferro/Dr.C-Standalone.git
cd Dr.C-Standalone
npm install
```

`npm install` runs electron-builder's `install-app-deps`, which rebuilds the
native module **better-sqlite3** against Electron's ABI. If you ever see a
`NODE_MODULE_VERSION` / "was compiled against a different Node.js version" error
at runtime, re-run:

```bash
npx electron-builder install-app-deps
```

The SQLite memory DB is optional at runtime — if the native module fails to load,
the app degrades to a silent no-op (no learning/memory), it does **not** crash.

**Verify:** `npm install` exits 0 and `node_modules/better-sqlite3` exists.

---

## 3. Configure the API key

There are two independent paths. **Dev** mode auto-loads `.env`; the **packaged**
app does not read `.env` and uses the in-app Settings page (persisted to disk).
Set up whichever matches how the app will run.

### 3a. Dev mode — `.env` (recommended while developing)

```bash
cp .env.example .env
```

Edit `.env` and fill in at least one key:

```
GEMINI_API_KEY=AIza...        # free, recommended default
# optional:
ANTHROPIC_API_KEY=sk-ant-...   # upgrades Complex mode to Claude
OPENAI_API_KEY=sk-...          # embeddings / GPT
```

- Use a **Google AI Studio** key (Gemini *Developer* API), NOT a Vertex AI
  service account. Get one free at https://aistudio.google.com/apikey.
- The app pins the Gemini endpoint to
  `generativelanguage.googleapis.com/v1beta`, which is what AI Studio keys
  authenticate against. Vertex credentials will fail.
- **Never commit `.env`** — it is gitignored. Never hardcode a key in source.

### 3b. Packaged app — Settings page (what end users do)

1. Launch the app.
2. Open **Settings** (gear / nav).
3. Paste a Gemini key into **Google AI (Gemini)** → **Save** → **Test**.
4. A green "✓ Saved in DRC" banner + a passing **Test** means it works.

Keys saved here persist to `config.json` (see §7) and survive restarts. A bad key
can be removed with the **Remove** button next to it.

**Verify (either path):** the Settings banner shows a saved/available provider,
and clicking **Test** returns ✓. If you have no UI yet, run dev (§4) first.

---

## 4. Run in development

```bash
npm run dev          # bundles main+preload+renderer, launches Electron, hot-reloads
```

This is the day-to-day entry point. To run the bundled output without the dev
server:

```bash
npm run build
npx electron out/main/index.js
```

**Verify the app actually works** (end-to-end smoke test — do all of these):
1. Type a prompt like `warm ambient pad` and send. A CSD artifact should appear
   in the right-hand panel and **autoplay** (you should hear audio → confirms the
   `csound` CLI is wired).
2. Click **Convert to Web App**. The panel should switch to a web-app preview.
3. Navigate to the **Web Apps** page and back to **Agent**. The artifact must
   stay a web app (regression guard — it used to revert to CSD).
4. (Optional, needs Cabbage) Generate or convert to **Cabbage**, click **Open in
   Cabbage**. It should launch Cabbage. If not, see §6.

If step 1 produces text but no audio: `csound` isn't on PATH (see §1 note).
If every turn errors with an SDK/version message: see Gotcha #1.

---

## 5. Type-check and build

```bash
npm run typecheck    # tsc for node + web projects
npm run build        # electron-vite build → out/  (does NOT typecheck)
```

> `typecheck` has a **known pre-existing error baseline**. Only treat **new**
> errors (in files you changed) as yours. `build` uses esbuild and will succeed
> even with those baseline type errors.

**Verify:** `npm run build` exits 0 and writes `out/main`, `out/preload`,
`out/renderer`.

---

## 6. Package an installer

The app version comes from `package.json` `"version"`. **Bump it before building
a release** so artifacts are named correctly and the release is distinct.

```bash
npm run dist:mac     # → release/DrC-<version>-arm64.dmg, -x64.dmg, + .zip (both arches)
npm run dist:win     # → release/DrC Setup <version>.exe  (run on/with Windows tooling)
npm run dist:linux   # → release/DrC-<version>.AppImage
npm run dist         # current platform, default targets
```

Artifacts land in `release/` (gitignored). macOS produces a **DMG** (drag-to-
Applications) and a **ZIP** per architecture.

**Verify:** `ls release/` shows the expected `.dmg` (and `.zip`) for the current
version, each non-trivial in size (hundreds of MB — the knowledge resources are
bundled).

### Code signing (optional, macOS)

Builds are **unsigned** (`identity: null`, `dmg.sign: false`). An unsigned mac
build triggers Gatekeeper on first launch ("damaged / cannot be opened"). To
distribute signed, set `CSC_LINK` + `CSC_KEY_PASSWORD` to an Apple Developer ID
cert and remove the `identity: null` override; see
https://www.electron.build/code-signing. For unsigned distribution, document the
workaround (Gotcha #4).

---

## 7. Where runtime state lives

Everything user-specific lives under Electron's `userData/drc`:

- macOS: `~/Library/Application Support/drc/drc/`
- Windows: `%APPDATA%/drc/drc/`
- Linux: `~/.config/drc/drc/`

Files there:
- `config.json` — saved API keys **and** optional `cabbagePath` / `csoundQtPath` / `browserPath` settings.

Saved exports handed to external apps:
- Cabbage → `~/Documents/DrC/cabbage/`
- CsoundQt → `~/Documents/DrC/csoundqt/`
- Web apps → `~/Documents/DrC/webapps/<title>/index.html`

To reset the app to a clean state for testing onboarding: quit the app and delete
the `userData/drc/drc/` directory.

---

## 8. Publish a GitHub release (optional)

Only do this when the user explicitly wants the build published — it is a public,
outward-facing action.

```bash
# from the repo root, version already bumped + committed + pushed
VERSION=$(node -p "require('./package.json').version")
gh release create "v$VERSION" \
  release/DrC-$VERSION-arm64.dmg \
  release/DrC-$VERSION-x64.dmg \
  --title "v$VERSION" \
  --notes "See commit history for changes."
```

Add the `.zip` files and Windows/Linux artifacts to the same command if you built
them. The README's "Install (no terminal needed)" section links users to the
Releases page and expects these exact filename patterns — keep them consistent.

**Verify:** `gh release view "v$VERSION"` lists the uploaded assets.

---

## Gotchas (read before debugging)

1. **`@ai-sdk/google` MUST stay on the 1.x line.** This app runs on **AI SDK 4**
   (`ai@^4`), which only drives spec-version **`v1`** models. `@ai-sdk/google` 2.x/3.x
   are AI SDK 5 packages whose models advertise `v2`, and `streamText` then throws
   an opaque "upgrade to AI SDK 5" error on **every** turn (this once bricked
   Gemini). `package.json` pins `^1.2.22` on purpose. There is a load-time guard
   (`assertV1` in `src/main/provider/provider.ts`) that fails fast with a clear
   message if a `v2` model slips in. **Do not "upgrade" the AI SDK packages**
   without migrating the whole app to AI SDK 5.

2. **No API key → app can't generate.** Symptoms: prompts produce an error about
   missing/invalid key. Fix via §3. A free Gemini AI Studio key is the default.

3. **No audio on generate → `csound` not on PATH.** The model output is fine but
   playback shells out to `csound`. Install it (§1) and confirm `csound --version`.
   In packaged macOS builds, the app augments PATH itself — if it still fails,
   csound genuinely isn't installed in a standard location.

4. **macOS "damaged / cannot be opened" on first launch** — the build is
   unsigned. The user must either right-click → **Open** → **Open**, or run once:
   ```bash
   xattr -cr /Applications/DrC.app
   ```

5. **"Open in Cabbage" / "Open in CsoundQt" / "Open in Browser" fails** — the app auto-detects installs
   and lets the user set an explicit path in **Settings → Cabbage**, **Settings → CsoundQt**, or
   **Settings → Web Browser** (native file picker or typed path). If launch fails it reports an error
   and offers **Reveal file** to the saved export under `~/Documents/DrC/`. All three are **optional** —
   the rest of the app works without them. CsoundQt requires the **v7.x** build for Csound 7. Web apps
   need network access in the browser for `@csound/browser` WASM from the CDN; press **Start Audio** in the page.

6. **`NODE_MODULE_VERSION` mismatch at runtime** — better-sqlite3 was built for
   the wrong ABI. Run `npx electron-builder install-app-deps` (§2). The app won't
   crash from this (memory degrades to a no-op), but learning/persistence is off
   until fixed.

7. **Converted web apps don't survive a full app restart.** Within a running
   session, navigating away and back is fine. But the persisted record is the
   chat message (an orchestra CSD), so after a cold restart that session reopens
   as a CSD. Known limitation — not a setup error.
