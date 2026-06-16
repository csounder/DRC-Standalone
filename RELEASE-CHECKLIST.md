# Release Checklist — LAC 2026 → GitHub

Steps to publish a **tested, proven** workshop build for **macOS and Linux** (LAC 2026).

**Do not skip manual testing** — run `TESTING.md` checklist first.

---

## 1. Pre-flight (local)

```bash
export PATH="$HOME/bin:$HOME/Applications/Csound:$PATH"
cd ~/DRC-Standalone
npm test                                    # must pass
git status                                  # review diff
git log -5 --oneline                        # commit message style
```

- [ ] `npm run test:platform` on **macOS and Linux**
- [ ] `npm test` on **macOS and Linux** — platform + 99 smoke + memory + build
- [ ] Manual checklist A1–B5 in `TESTING.md`
- [ ] `WORKSHOP.md` and `VERSIONS.md` accurate
- [ ] No secrets in diff (`.env`, API keys)

---

## 2. Commit & push (Standalone)

Branch: **`lac-2026-csound7`**

Suggested commit message (adjust to actual diff):

```
LAC 2026: Csound 7 workshop reliability, offline demos, and test suite.

Player compile-check, provider fallback, rate-limit UI, workshop starters,
mechanical Player adapt, attendee launcher, and npm test workshop gate.
```

```bash
cd ~/DRC-Standalone
git add -A   # review carefully — no .env
git commit -m "..."
git push -u origin lac-2026-csound7
```

- [ ] Push succeeds
- [ ] Update or merge [PR #1](https://github.com/mateolarreaferro/DRC-Standalone/pull/1)
- [ ] CI green (if configured)

---

## 3. Commit & push (Terminal — if shipping TUI fixes)

```bash
cd ~/Dr.C/opencode
npm run test:workshop
git add packages/opencode/src/util/external-apps.ts \
        packages/opencode/src/cli/...   # your changed files
git commit -m "LAC 2026: versioned Cabbage detection and workshop smoke script."
git push origin main
```

- [ ] `test:workshop` passes
- [ ] Push succeeds

---

## 4. Build installers

On each platform (or CI matrix):

```bash
cd ~/DRC-Standalone
npm install
npm run build
npm run dist:mac      # macOS → release/DrC-*.dmg / .zip
npm run dist:linux    # Linux VM → .AppImage or .deb
npm run dist:win      # Windows → .exe (NSIS)
```

- [ ] macOS artifact tested on clean-ish Mac (right-click Open if unsigned)
- [ ] Linux artifact tested in Ubuntu VM
- [ ] Windows artifact tested (or CI artifact downloaded)

> **Signing:** Current builds are **unsigned / unnotarized**. Attendees on macOS need Right-click → Open once, or run `xattr -dr com.apple.quarantine DrC.app`. Plan Developer ID + notarization for post-workshop wide release.

---

## 5. GitHub Release

Create release **`v1.3.1-lac2026`** (or merge to `main` and tag `v1.3.1`):

**Title:** Dr.C Standalone 1.3.1 — LAC 2026 Csound 7 Workshop

**Attach:**

- `DrC-1.3.1-mac.dmg` (or `.zip`)
- `DrC-1.3.1-linux.AppImage`
- `DrC-1.3.1-win.exe`
- Optional: `WORKSHOP.md`, `TESTING.md`, `launch-workshop-attendee.sh`

**Release notes body (template):**

```markdown
## LAC 2026 — Csound 7 Workshop Build

### Requirements
- Csound **7.x** on PATH
- Optional: free Gemini or Groq API key (offline demos work without)

### Highlights
- Csound 7 unified prompts and runtime detection
- Player compile fix for long hold scores
- Offline workshop demos (FM bell, Player keyboard)
- Groq/Gemini fallback + rate-limit countdown
- Web Apps work without API key

### Install
See INSTALL-STANDALONE.md in the repo, or run from source:
git clone … && git checkout lac-2026-csound7 && npm install && ./scripts/launch-workshop-attendee.sh

### Verify
npm test
```

- [ ] Release published
- [ ] Download links work from attendee network

---

## 6. USB / classroom distribution

Copy to USB or shared folder:

```
lac-workshop-demo/
  README.md
  Dr.C-Standalone.command
  Dr.C-Terminal.command
  launch-drc-standalone.sh
  launch-drc-terminal.sh
  launch-drc-attendee.sh          ← add for beginners
  pluck_bass.csd
  pluck_bass_midi.csd
  pluck_bass_web.html
```

Install docs (PDF or markdown):

- `INSTALL-STANDALONE.md`
- `INSTALL-TERMINAL.md`
- `WORKSHOP.md` (attendee prompt on last page)

- [ ] USB tested on second machine
- [ ] Short URL or QR to GitHub release

---

## 7. Post-release

- [ ] Announce branch/tag in workshop materials
- [ ] Note free-tier limits in slide deck (Groq backup, offline demos)
- [ ] Archive test log from `TESTING.md`

---

## Quick command reference

| Task | Command |
|------|---------|
| Full Standalone test | `cd ~/DRC-Standalone && npm test` |
| CLI workshop test | `cd ~/Dr.C/opencode && npm run test:workshop` |
| Attendee launch | `~/DRC-Standalone/scripts/launch-workshop-attendee.sh` |
| Pro+ launch | `~/DRC-Standalone/scripts/launch-drc.sh` |
| Build macOS | `npm run dist:mac` |
