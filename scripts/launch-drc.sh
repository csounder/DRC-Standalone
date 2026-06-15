#!/usr/bin/env bash
# Launch Dr.C Standalone with Csound 7 first on PATH (macOS + Linux workshop build)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=workshop-path.sh
source "${SCRIPT_DIR}/workshop-path.sh"

export DRC_PRO_PLUS="${DRC_PRO_PLUS:-1}"
export DRC_WORKSHOP_LITE="${DRC_WORKSHOP_LITE:-0}"

ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$ROOT"

if ! command -v csound >/dev/null 2>&1; then
  echo "Csound not found. Install Csound 7 and ensure it is on PATH."
  echo "See PARTICIPANTS.md (macOS / Linux / Windows section for your OS)."
  exit 1
fi

echo "Dr.C Standalone (Csound 7) — tier: ${DRC_PRO_PLUS} Pro+ | OS: $(uname -s)"
echo "Csound: $(csound --version 2>&1 | head -1)"
echo ""

if [[ ! -d node_modules ]]; then
  echo "Run: npm install"
  exit 1
fi

if command -v lsof >/dev/null 2>&1 && lsof -ti:5173 >/dev/null 2>&1; then
  echo "Closing previous Dr.C session on port 5173…"
  lsof -ti:5173 | xargs kill 2>/dev/null || true
  sleep 1
fi

if ! npm run check-memory --silent 2>/dev/null; then
  echo ""
  echo "Memory is OFF — rebuilding better-sqlite3 for Electron…"
  npx electron-builder install-app-deps
fi

exec npm run dev
