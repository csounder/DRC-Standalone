#!/usr/bin/env bash
# Launch Dr.C Standalone with Csound 7 first on PATH (workshop / education build)
set -euo pipefail

export PATH="${HOME}/bin:${HOME}/Applications/Csound:${HOME}/.local/bin:/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:${PATH:-}"

# Pro+ tier (default for Dr. B workshop): Gemini Pro, narration, specialist sub-agents,
# no free-tier rate-limit UI. Set DRC_PRO_PLUS=0 to restore free-tier behavior.
export DRC_PRO_PLUS="${DRC_PRO_PLUS:-1}"

# Workshop-lite (Groq-only, one call/turn) is OFF under Pro+. Override with DRC_WORKSHOP_LITE=1.
export DRC_WORKSHOP_LITE="${DRC_WORKSHOP_LITE:-0}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v csound >/dev/null 2>&1; then
  echo "Csound not found. Install Csound 7 and ensure it is on PATH."
  echo "See INSTALLATION.md or https://github.com/mateolarreaferro/DRC-Standalone"
  exit 1
fi

echo "Dr.C Standalone (Csound 7) — tier: ${DRC_PRO_PLUS:-1} Pro+"
echo "Csound: $(csound --version 2>&1 | head -1)"
echo ""

if [[ ! -d node_modules ]]; then
  echo "Run: npm install"
  exit 1
fi

# A stale dev server on 5173 leaves Electron on a dead port → blank screen after send.
if lsof -ti:5173 >/dev/null 2>&1; then
  echo "Closing previous Dr.C session on port 5173…"
  lsof -ti:5173 | xargs kill 2>/dev/null || true
  sleep 1
fi

if ! npm run check-memory --silent 2>/dev/null; then
  echo ""
  echo "Memory is OFF — rebuilding better-sqlite3 for Electron…"
  npx electron-builder install-app-deps
  if ! npm run check-memory --silent 2>/dev/null; then
    echo ""
    echo "Memory still unavailable. 👍/👎 learning will not persist until fixed."
    echo "Run manually: npx electron-builder install-app-deps"
    echo ""
  else
    echo "Memory module rebuilt — 👍/👎 preferences will persist."
    echo ""
  fi
fi

exec npm run dev
