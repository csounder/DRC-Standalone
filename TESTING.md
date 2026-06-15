# Testing Guide — LAC 2026

Automated checks you can run in minutes, plus a manual pass Richard should do once on his laptop before pushing to GitHub.

---

## Automated — Dr.C Standalone

From repo root, with Csound 7 on PATH:

```bash
export PATH="$HOME/bin:$HOME/Applications/Csound:$PATH"
cd ~/DRC-Standalone
npm test
```

This runs:

1. **`scripts/test-platform-launchers.mjs`** — launcher files + cross-platform PATH contract (run on **each OS** before LAC)
2. **`scripts/smoke-test.mjs`** — 99 checks (PATH, platform launchers, Player, Settings, knowledge bundle, workshop starters, TypeScript regression guard)
3. **`scripts/check-memory.mjs`** — better-sqlite3 loads under Electron
4. **`npm run build`** — production bundle compiles

Quick smoke only:

```bash
npm run test:smoke
```

Platform launchers only:

```bash
npm run test:platform
```

**Expected:** `99 passed, 0 failed` (smoke) + platform launcher checks, then `Workshop tests passed`.

---

## Automated — Dr.C Terminal (CLI)

```bash
export PATH="$HOME/bin:$HOME/Applications/Csound:$HOME/.local/bin:$PATH"
cd ~/Dr.C/opencode
npm run test:platform    # launcher + GET-STARTED.md (run on each OS)
npm run test:workshop
```

Participant guide: **`Dr.C/opencode/GET-STARTED.md`**

**Expected:** `12 passed, 0 failed` (Csound 7, CLI help, demo CSDs, shared starters, bash tool tests).

> **Note:** Full `bun test` in `packages/opencode` runs 983 upstream tests; ~17 fail on network/skill-discovery fixtures. That is **not** a workshop blocker. Use `test:workshop` for LAC.

---

## Cross-platform gate (run on each OS)

Before LAC, run the automated gate on **macOS**, **Linux**, and **Windows** (VM or physical machine):

| OS | Dr.C Standalone | Dr.C Terminal |
|----|-----------------|---------------|
| **macOS** | `npm run test:platform && npm run test:smoke` | `npm run test:platform && npm run test:workshop` |
| **Linux** | same | same |
| **Windows** | `npm run test:platform` then `npm run test:smoke` in PowerShell | `npm run test:platform` then `npm run test:workshop` |

**Verified on macOS (darwin arm64):** Standalone 28 platform + 99 smoke; Terminal 18 platform + 12 workshop — all passed.

Linux/Windows: file/syntax checks always run; `csound`/`bun` runtime checks skip gracefully if not installed on the CI/VM host.

**Linux caveat (verified on Ubuntu 22.04 VM):** `apt install csound` ships **6.17** — `test:platform` reports a **SKIP** for Csound 7; `test:smoke` may still pass (98/98). Full workshop gate needs Csound 7 built from source. See `PARTICIPANTS.md` Linux section.

---

## Automated — CsoundLive Web

```bash
cd ~/dB-Studio/DRC-WebApps+/_CsoundLive/web
./scripts/compile-check.sh
```

**Expected:** `OK: orchestra compiled` (merged orchestra, Csound 7).

---

## Manual checklist — Richard (before GitHub release)

Do this once after `npm test` passes. Restart Dr.C between main-process changes.

### A. No API key (beginner path)

Launch attendee mode:

```bash
~/DRC-Standalone/scripts/launch-workshop-attendee.sh
```

| # | Step | Pass? |
|---|------|-------|
| A1 | Agent → **Load workshop FM bell (no key)** — CSD appears in panel | |
| A2 | **Web Apps** tab opens without key prompt | |
| A3 | Player → **Workshop demo (no key)** — status reaches “Live — click keyboard” | |
| A4 | Click keyboard — hear sound | |
| A5 | Settings → **Done** returns to Agent; gear toggles Settings off | |

### B. With API keys (Gemini + Groq)

Launch Pro+ or attendee with keys in Settings:

```bash
~/DRC-Standalone/scripts/launch-drc.sh
# or attendee script + keys saved
```

| # | Step | Pass? |
|---|------|-------|
| B1 | Agent → workshop FM prompt (see `WORKSHOP.md`) → CSD → compile → **hear sound** | |
| B2 | Rate limit: if throttled, **countdown** shows; **Try again** works after wait | |
| B3 | Player → **Load current CSD from Agent** → adapt → keyboard plays | |
| B4 | Artifact → **Open in CsoundQt** opens in your CS7 CsoundQt | |
| B5 | Convert to Web App → preview plays in browser | |

### C. Dr.C Terminal

Double-click **`Dr.C-Terminal.command`** or:

```bash
cd ~/Dr.C/opencode && bun run dev -- ~/lac-workshop-demo
```

| # | Step | Pass? |
|---|------|-------|
| C1 | TUI opens, project is `lac-workshop-demo` | |
| C2 | Generate plain FM CSD with workshop prompt | |
| C3 | Compile / smoke from CSD panel | |
| C4 | **Open in Cabbage** (if Cabbage installed) | |

### D. CsoundLive (optional demo)

Double-click **`Launch Web App.command`** → Start audio → load a sample → hear mix.

---

## Known gotchas (not bugs if you know them)

| Symptom | Cause | Fix |
|---------|-------|-----|
| Player “Compiling…” forever | Hold score `f 0 36000` on raw `csound -n` | Fixed in app via `compile-check.ts`; tests shorten scores |
| “Playing” but no sound | `-iadc` with no mic | Fixed — no default ADC unless configured |
| Blank screen after send | Stale dev server on port 5173 | `launch-drc.sh` kills 5173 first |
| Gemini empty / no CSD | Free tier rate limit | Wait for countdown; use Groq; or attendee mode |
| `better-sqlite3` error | Node/Electron ABI mismatch | `npx electron-builder install-app-deps` |
| Packaged app “damaged” (macOS) | Unsigned build | Right-click → Open, or notarize for wide release |

---

## Test log template (fill when you return)

```
Date: ___________
Machine: MacBook ___ / macOS ___
Csound: csound --version → ___________
Node: node -v → ___
npm test: pass / fail
npm run test:workshop (Terminal): pass / fail
Manual A1–A5: pass / fail (notes: ___)
Manual B1–B5: pass / fail (notes: ___)
Ready for GitHub release: yes / no
```
