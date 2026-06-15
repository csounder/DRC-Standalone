#!/usr/bin/env bash
# Launch Dr.C Standalone with Csound 7 first on PATH (workshop / education build)
set -euo pipefail

export PATH="${HOME}/bin:${HOME}/Applications/Csound:${HOME}/.local/bin:/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:${PATH:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v csound >/dev/null 2>&1; then
  echo "Csound not found. Install Csound 7 and ensure it is on PATH."
  echo "See INSTALLATION.md or https://github.com/mateolarreaferro/DRC-Standalone"
  exit 1
fi

echo "Dr.C Standalone (Csound 7 workshop build)"
echo "Csound: $(csound --version 2>&1 | head -1)"
echo ""

if [[ ! -d node_modules ]]; then
  echo "Run: npm install"
  exit 1
fi

exec npm run dev
