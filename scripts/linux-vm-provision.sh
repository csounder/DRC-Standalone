#!/usr/bin/env bash
# LAC 2026 Linux VM provision — Ubuntu 22.04 (PARTICIPANTS.md + INSTALL-* guides)
set -euo pipefail

log() { echo "[provision] $*"; }

export DEBIAN_FRONTEND=noninteractive

log "apt base packages"
sudo apt-get update -qq
sudo apt-get install -y -qq \
  build-essential cmake git curl ca-certificates \
  libsndfile1-dev libasound2-dev libjack-jackd2-dev \
  bison flex libssl-dev python3 unzip \
  libnss3 libatk-bridge2.0-0 libgtk-3-0 libxss1 libasound2 \
  rsync lsb-release

log "Node.js 22"
if ! node -v 2>/dev/null | grep -q '^v22\.'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y -qq nodejs
fi
node -v
npm -v

log "Bun (Terminal)"
if ! command -v bun >/dev/null 2>&1; then
  curl -fsSL https://bun.sh/install | bash
fi
export PATH="$HOME/.bun/bin:$HOME/bin:$HOME/Applications/Csound:$HOME/.local/bin:$PATH"
grep -q '.bun/bin' ~/.bashrc 2>/dev/null || echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
bun -v

log "Csound 7 user install"
mkdir -p ~/bin ~/Applications/Csound
if ! ~/Applications/Csound/csound --version 2>/dev/null | head -1 | grep -q 'version 7'; then
  if [ ! -d ~/src/csound ]; then
    git clone --depth 1 --branch develop https://github.com/csound/csound.git ~/src/csound
  fi
  cmake -S ~/src/csound -B ~/src/csound/build \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX="$HOME/Applications/Csound"
  cmake --build ~/src/csound/build -j"$(nproc)"
  cmake --install ~/src/csound/build
  ln -sf ~/Applications/Csound/bin/csound ~/bin/csound
fi
csound --version | head -2

log "sync repos from host mount (if present)"
if [ -d /mnt/DRC-Standalone ]; then
  rsync -a --delete \
    --exclude node_modules --exclude out --exclude release --exclude dist \
    /mnt/DRC-Standalone/ ~/DRC-Standalone/
fi
if [ -d /mnt/Dr.C ]; then
  rsync -a --delete \
    --exclude node_modules --exclude .turbo --exclude dist \
    /mnt/Dr.C/ ~/Dr.C/
fi

log "npm install Standalone"
cd ~/DRC-Standalone
npm install

log "bun install Terminal"
cd ~/Dr.C/opencode
bun install

log "git identity for bash unit tests"
git config --global user.email "workshop@local" 2>/dev/null || true
git config --global user.name "Workshop" 2>/dev/null || true

log "workshop demo folder"
mkdir -p ~/lac-workshop-demo

log "provision complete"
