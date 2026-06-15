# LAC 2026 — Workshop Participant Guide

**Dr.C Standalone** (GUI) + optional **Dr.C Terminal** (CLI).  
Branch: **`lac-2026-csound7`** · Version **1.3.1**

---

## Choose your path

| I want… | Use |
|---------|-----|
| Visual app, Player keyboard, Web Apps | **Dr.C Standalone** (this guide) |
| Terminal / shell workflow | [Dr.C Terminal](#dr-c-terminal-optional) |
| No install, browser only | CsoundLive Web (separate repo) |

**No API key required** for offline demos (FM bell, Player workshop demo, Web Apps tab).

---

## 1. Install Csound 7 (all platforms)

Verify after install:

```bash
csound --version
```

You should see **version 7.x**.

### macOS

1. Download Csound 7 from [Csound releases](https://github.com/csound/csound/releases) (universal `.pkg` or `.dmg`).
2. Install to **`~/Applications/Csound/`** (user install — no admin needed).
3. Symlink CLI:
   ```bash
   mkdir -p ~/bin
   ln -sf ~/Applications/Csound/csound ~/bin/csound
   ```
4. If Homebrew Csound 6 shadows CS7: `brew unlink csound`

**Also need:** [Node.js 22](https://nodejs.org/) (`node -v` → v22.x recommended)

### Linux (Ubuntu / Debian)

> **Important:** On **Ubuntu 22.04 (Jammy)**, `sudo apt install csound` installs **Csound 6.17**, not 7.  
> `npm run test:platform` and `npm run test:workshop` require **7.x**. Use **Option B** (build from source) or install Csound 7 binaries from [GitHub releases](https://github.com/csound/csound/releases).  
> `npm run test:smoke` may still pass on 6.x for many compile checks — do not treat that as a full workshop gate.

```bash
# Build tools if compiling from source
sudo apt update
sudo apt install -y build-essential cmake git libjack-jackd2-dev

# Option A — distro package ONLY if csound --version shows 7.x (not on 22.04 Jammy)
sudo apt install -y csound
csound --version   # must show version 7.x for workshop gate

# Option B — build Csound 7 from source (recommended on 22.04)
# https://github.com/csound/csound/blob/develop/BUILD.md

# Node.js 22 (Node 20 may work for smoke tests; 22 recommended)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

User-local install path (optional): `~/Applications/Csound/csound` on `PATH` via `~/bin`.

**Headless Linux (SSH, no desktop):** GUI launchers need a display (`DISPLAY` or Wayland). Use `npm run test:platform` and `npm run test:smoke` in the repo; run the Electron app on a machine with a desktop session.

### Windows

1. Download installer from [csound.com/download.html](https://csound.com/download.html).
2. Run installer — note install folder (e.g. `C:\Program Files\Csound`).
3. Ensure `csound.exe` is on **PATH** (installer usually does this).
4. Open **new** Command Prompt and run: `csound --version`

**Also need:** [Node.js 22 LTS](https://nodejs.org/) — check **Add to PATH** during install.

---

## 2. Get Dr.C Standalone

### Option A — Download installer (easiest)

[GitHub Releases](https://github.com/mateolarreaferro/DRC-Standalone/releases) on branch **`lac-2026-csound7`**:

| OS | File |
|----|------|
| macOS Apple Silicon | `DrC-*-arm64.dmg` |
| macOS Intel | `DrC-*-x64.dmg` |
| Linux | `DrC-*.AppImage` |
| Windows | `DrC Setup *.exe` |

**macOS first launch:** app is unsigned — **Right-click → Open → Open**, or:
```bash
xattr -cr /Applications/DrC.app
```

### Option B — Run from source (developers)

```bash
git clone -b lac-2026-csound7 https://github.com/mateolarreaferro/DRC-Standalone.git
cd DRC-Standalone
npm install
cp .env.example .env    # optional — or use Settings UI
```

---

## 3. Launch Dr.C

### macOS

**Double-click** (after `chmod +x` if needed):

| Role | Launcher |
|------|----------|
| Attendee (free tier) | `launchers/Dr.C-Workshop-Attendee.command` |
| Instructor (Pro+) | `launchers/Dr.C-Standalone.command` |

Or in Terminal:

```bash
cd DRC-Standalone
./scripts/launch-workshop-attendee.sh   # attendees
./scripts/launch-drc.sh                 # instructor
```

### Linux

```bash
cd DRC-Standalone
chmod +x launchers/*.sh scripts/*.sh
./launchers/Dr.C-Workshop-Attendee.sh     # attendees
./launchers/Dr.C-Standalone.sh            # instructor
```

### Windows

**Double-click:**

| Role | Launcher |
|------|----------|
| Attendee | `launchers\Dr.C-Workshop-Attendee.bat` |
| Instructor | `launchers\Dr.C-Standalone.bat` |

Or Command Prompt:

```bat
cd DRC-Standalone
scripts\launch-workshop-attendee.bat
```

If PowerShell blocks scripts, launchers use `-ExecutionPolicy Bypass` automatically.

---

## 4. API keys (optional)

Open **Settings** in Dr.C:

| Provider | Cost | Get a key |
|----------|------|-----------|
| Gemini | Free tier | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Groq (backup) | Free tier | [console.groq.com/keys](https://console.groq.com/keys) |

Use an **AI Studio** Gemini key (not Vertex). Click **Test** after pasting.

---

## 5. First steps in the app

### Without any API key

1. **Agent** → **Load workshop FM bell (no key)**
2. **Player** → **Workshop demo (no key)** → click keyboard
3. **Web Apps** tab — works offline

### With API key — try these prompts

**Shimmer FM bell:**
```
make a plain Csound CSD only — no Cabbage. Shimmering FM bell: two inharmonic oscili modulators into a carrier, expsegr decay, global reverb bus (instr 99). Score: descending bell melody (~15 s).
```

**Ping-pong bass:**
```
make a plain Csound CSD only — no Cabbage. Ping-pong pluck bass: foscili FM voice, butterlp, gaEcho + vdelay3 cross-feedback. Score: four-note bass riff (~8 s).
```

Golden reference CSDs: `resources/workshop-starters/`

---

## 6. Verify your install

### macOS / Linux

```bash
export PATH="$HOME/bin:$HOME/Applications/Csound:$HOME/.local/bin:$PATH"
cd DRC-Standalone
npm run test:smoke
```

Expected: **99 passed, 0 failed**

### Windows (PowerShell)

```powershell
cd DRC-Standalone
npm run test:smoke
```

---

## Dr.C Terminal (optional)

For shell-native users — full guide: **`Dr.C/opencode/GET-STARTED.md`**

| OS | Launcher |
|----|----------|
| macOS | `Dr.C/opencode/launchers/Dr.C-Terminal.command` |
| Linux | `Dr.C/opencode/launchers/Dr.C-Terminal.sh` |
| Windows | `Dr.C/opencode/launchers/Dr.C-Terminal.bat` |

```bash
git clone https://github.com/mateolarreaferro/Dr.C.git
cd Dr.C/opencode
bun install
chmod +x scripts/*.sh launchers/*.sh   # macOS/Linux
./scripts/launch-drc-terminal.sh
```

Workshop knowledge bundles are **included in the repo** (no extra sync step).

See also `Dr.C/opencode/WORKSHOP.md`.

---

## Reference links

| Resource | URL |
|----------|-----|
| Dr.C Standalone repo | https://github.com/mateolarreaferro/DRC-Standalone |
| Dr.C Terminal repo | https://github.com/mateolarreaferro/Dr.C |
| Csound 7 releases | https://github.com/csound/csound/releases |
| Csound download | https://csound.com/download.html |
| FLOSS Manual | https://flossmanual.csound.com/ |
| Opcode index | https://csound.com/manual/opcodesIndex/ |
| CsoundQt 7 | https://github.com/CsoundQt/CsoundQt/releases |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `csound not found` | Re-run OS install steps; restart terminal; use workshop launcher (sets PATH) |
| Blank screen after Send | Close app; launcher kills stale port 5173 |
| Gemini empty / rate limit | Add Groq key; wait for countdown; use offline demos |
| macOS "damaged" app | Right-click → Open, or `xattr -cr DrC.app` |
| Windows script blocked | Use `.bat` launchers in `launchers/` |
| Linux `npm install` fails | Use Node 22; `npx electron-builder install-app-deps` |
| Linux apt `csound` is 6.x | Ubuntu 22.04 ships 6.17 — build Csound 7 from source (see Linux section above) |
| `test:platform` fails Csound 7 | Same — workshop gate needs 7.x even if `test:smoke` passes on 6.x |

Instructor docs: `WORKSHOP.md`, `TESTING.md`, `VERSIONS.md`
