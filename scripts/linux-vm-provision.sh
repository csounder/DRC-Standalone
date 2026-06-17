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
  libnss3 libatk-bridge2.0-0 libgtk-3-0 libxss1 libasound2 libgbm1 \
  rsync lsb-release python3-numpy

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
export PATH="$HOME/.bun/bin:$HOME/bin:$HOME/Applications/Csound/bin:$HOME/.local/bin:$PATH"
grep -q '.bun/bin' ~/.bashrc 2>/dev/null || echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
bun -v

log "Csound 7 user install"
mkdir -p ~/bin ~/Applications/Csound
if ! ~/Applications/Csound/bin/csound --version 2>/dev/null | head -1 | grep -q 'version 7'; then
  if [ ! -d ~/src/csound ]; then
    git clone --depth 1 --branch develop https://github.com/csound/csound.git ~/src/csound
  fi
  # User prefix for binaries/libs; ctcsound.py installs to system site-packages (sudo).
  cmake -S ~/src/csound -B ~/src/csound/build \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX="$HOME/Applications/Csound" \
    -DINSTALL_PYTHON_INTERFACE=ON
  cmake --build ~/src/csound/build -j"$(nproc)"
  cmake --install ~/src/csound/build
  sudo cmake -DCMAKE_INSTALL_PREFIX="$HOME/Applications/Csound" \
    -P ~/src/csound/build/Python/cmake_install.cmake
  ln -sf ~/Applications/Csound/bin/csound ~/bin/csound
fi
grep -q 'Applications/Csound/lib' ~/.bashrc 2>/dev/null || \
  echo 'export LD_LIBRARY_PATH="$HOME/Applications/Csound/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"' >> ~/.bashrc
export LD_LIBRARY_PATH="$HOME/Applications/Csound/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export PATH="$HOME/bin:$HOME/Applications/Csound/bin:$PATH"
csound --version | head -2
if python3 -c "import ctcsound" 2>/dev/null; then
  log "ctcsound Python module OK"
else
  log "ctcsound import failed (need python3-numpy and LD_LIBRARY_PATH)"
fi

# Optional workshop companion tools — install AFTER Csound 7.
# Docs: PARTICIPANTS.md, INSTALL-STANDALONE.md §2.5–2.8
# Set INSTALL_OPTIONAL_TOOLS=0 to skip.
if [ "${INSTALL_OPTIONAL_TOOLS:-1}" = "1" ]; then
  log "optional companion tools (CsoundQt, Cabbage, Audacity, Reaper)"

  if ! command -v audacity >/dev/null 2>&1; then
    sudo apt-get install -y -qq audacity \
      || log "audacity apt failed — try: flatpak install flathub org.audacityteam.Audacity"
  fi

  ARCH="$(uname -m)"

  # CsoundQt 7 — https://github.com/CsoundQt/CsoundQt/releases (v7 AppImage)
  if ! ls ~/Applications/CsoundQt*.AppImage >/dev/null 2>&1 && ! command -v csoundqt >/dev/null 2>&1; then
    if [ "$ARCH" = "aarch64" ]; then
      log "CsoundQt: check GitHub releases for aarch64 AppImage — https://github.com/CsoundQt/CsoundQt/releases"
    else
      CSOUNDQT_URL="https://github.com/CsoundQt/CsoundQt/releases/download/v7.0.0-beta3/CsoundQt-7.0.0-beta3-x86_64.AppImage"
      if curl -fsSL -o ~/Applications/CsoundQt.AppImage "$CSOUNDQT_URL" 2>/dev/null; then
        chmod +x ~/Applications/CsoundQt.AppImage
        ln -sf ~/Applications/CsoundQt.AppImage ~/bin/csoundqt 2>/dev/null || true
      else
        log "CsoundQt download failed — manual: https://github.com/CsoundQt/CsoundQt/releases"
      fi
    fi
  fi

  # Cabbage — https://cabbageaudio.com/download/ or GitHub releases
  if ! command -v cabbage >/dev/null 2>&1; then
    log "Cabbage: manual install from https://cabbageaudio.com/download/ (aarch64 builds may lag x86_64)"
  fi

  # Reaper — https://www.reaper.fm/download.php (eval license; aarch64 + x86_64)
  if [ ! -d ~/opt/REAPER ] && [ ! -x ~/Applications/Reaper/reaper ]; then
    log "Reaper: manual download from https://www.reaper.fm/download.php — eval license, install to ~/opt/REAPER"
  fi
fi

log "sync repos from host mount (if present)"
if [ -d /mnt/DRC-Standalone ]; then
  rsync -a --delete \
    --exclude node_modules --exclude out --exclude release --exclude dist \
    /mnt/DRC-Standalone/ ~/DRC-Standalone/
fi
if [ -d /mnt/Dr.C ]; then
  rsync -a --delete \
    --exclude node_modules --exclude .turbo --exclude dist \
    --exclude 'sdks/vscode/images/icon.png' \
    --exclude 'sdks/vscode/images/button-dark.svg' \
    --exclude 'sdks/vscode/images/button-light.svg' \
    /mnt/Dr.C/ ~/Dr.C/ || true
fi

# 8G VM: default Node heap OOMs on electron-vite production build in npm test.
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"

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
