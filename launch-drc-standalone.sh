#!/usr/bin/env bash
# LAC 2026 — Dr.C Standalone from source (Csound 7 workshop build)
set -euo pipefail

export PATH="${HOME}/bin:${HOME}/Applications/Csound:${HOME}/.local/bin:/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:${PATH:-}"

DRC_ROOT="${DRC_STANDALONE_ROOT:-${HOME}/DRC-Standalone}"
WORKSHOP_BRANCH="${DRC_STANDALONE_BRANCH:-lac-2026-csound7}"

die() {
  echo "$@"
  echo ""
  read -r -p "Press Enter to close..." || true
  exit 1
}

[[ -d "$DRC_ROOT" ]] || die "Dr.C Standalone not found at $DRC_ROOT

Clone workshop build:
  git clone https://github.com/mateolarreaferro/DRC-Standalone.git ~/DRC-Standalone
  cd ~/DRC-Standalone && git checkout $WORKSHOP_BRANCH
  npm install && cp .env.example .env"

command -v csound >/dev/null 2>&1 || die "Csound not on PATH — install Csound 7 to ~/Applications/Csound"

VER="$(csound --version 2>&1 | head -1)"
if ! echo "$VER" | grep -qi "version 7"; then
  echo "WARNING: Expected Csound 7, got: $VER"
  echo "Tip: brew unlink csound   (if Homebrew csound 6 shadows CS7)"
  echo ""
fi

cd "$DRC_ROOT"

if [[ -d .git ]] && git rev-parse --verify "$WORKSHOP_BRANCH" >/dev/null 2>&1; then
  CURRENT="$(git branch --show-current 2>/dev/null || true)"
  if [[ "$CURRENT" != "$WORKSHOP_BRANCH" ]]; then
    echo "Switching to workshop branch: $WORKSHOP_BRANCH"
    git checkout "$WORKSHOP_BRANCH"
  fi
fi

[[ -d node_modules ]] || die "Run: cd $DRC_ROOT && npm install  (use Node 22)"

if ! command -v node >/dev/null 2>&1; then
  die "Node.js not found. Install Node 22: brew install node@22"
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" -gt 22 ]]; then
  echo "WARNING: Node $NODE_MAJOR detected. Use Node 22 for npm install (better-sqlite3)."
  echo "  export PATH=\"/opt/homebrew/opt/node@22/bin:\$PATH\""
  echo ""
fi

echo "Dr.C Standalone — workshop build"
echo "Source:  $DRC_ROOT"
echo "Branch:  $(git branch --show-current 2>/dev/null || echo 'n/a')"
echo "Csound:  $VER"
echo ""

if [[ -x "${DRC_ROOT}/scripts/launch-drc.sh" ]]; then
  exec "${DRC_ROOT}/scripts/launch-drc.sh"
fi

exec npm run dev
