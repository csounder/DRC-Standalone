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



# --- Optional workshop companion tools (recommended for LAC; install after Csound 7) ---
log "optional: Audacity"
if ! command -v audacity >/dev/null 2>&1; then
  sudo apt-get install -y -qq audacity
fi

log "optional: Reaper eval (reaper.fm — accept license on first GUI launch)"
ARCH="$(uname -m)"
REAPER_VER=774
case "$ARCH" in
  aarch64|arm64) REAPER_TAR="reaper${REAPER_VER}_linux_aarch64.tar.xz" ;;
  x86_64|amd64) REAPER_TAR="reaper${REAPER_VER}_linux_x86_64.tar.xz" ;;
  *) REAPER_TAR="" ;;
esac
if [ -n "$REAPER_TAR" ] && [ ! -x "$HOME/Applications/Reaper/REAPER/reaper" ]; then
  mkdir -p ~/Applications/Reaper ~/bin
  curl -fsSL -A "Mozilla/5.0" -o "/tmp/$REAPER_TAR" "https://www.reaper.fm/files/7.x/$REAPER_TAR"
  tar -xf "/tmp/$REAPER_TAR" -C /tmp
  REAPER_DIR="$(find /tmp -maxdepth 1 -type d -name "reaper_linux_*" | head -1)"
  rsync -a "$REAPER_DIR/" ~/Applications/Reaper/
  chmod +x ~/Applications/Reaper/REAPER/reaper
  ln -sf ~/Applications/Reaper/REAPER/reaper ~/bin/reaper
fi

log "optional: CsoundQt 7 (GitHub v7 AppImage — upstream x86_64 only as of beta4)"
mkdir -p ~/Applications/CsoundQt
CSQ_APPIMAGE="CsoundQt-7.0.0-beta4-x86_64.AppImage"
if [ ! -f "$HOME/Applications/CsoundQt/$CSQ_APPIMAGE" ]; then
  curl -fsSL -o "$HOME/Applications/CsoundQt/$CSQ_APPIMAGE"     "https://github.com/CsoundQt/CsoundQt/releases/download/v7.0.0-beta4/$CSQ_APPIMAGE"
  chmod +x "$HOME/Applications/CsoundQt/$CSQ_APPIMAGE"
fi
if [ "$ARCH" = aarch64 ] || [ "$ARCH" = arm64 ]; then
  log "note: CsoundQt AppImage is x86_64 — on ARM VMs use host macOS CsoundQt or build from source"
fi

log "optional: Cabbage (rorywalsh/cabbage Linux zip — VST3/rack; binaries are x86_64)"
mkdir -p ~/src/cabbage-dl ~/Applications/Cabbage
CABBAGE_ZIP="CabbageLinux-2.10.0.zip"
if [ ! -f "$HOME/src/cabbage-dl/$CABBAGE_ZIP" ]; then
  curl -fsSL -o "$HOME/src/cabbage-dl/$CABBAGE_ZIP"     "https://github.com/rorywalsh/cabbage/releases/download/v2.10.0/$CABBAGE_ZIP"
  unzip -qo "$HOME/src/cabbage-dl/$CABBAGE_ZIP" -d "$HOME/src/cabbage-dl"
fi
if [ ! -f "$HOME/Applications/Cabbage/installCabbage.sh" ]; then
  rsync -a --exclude "$CABBAGE_ZIP" "$HOME/src/cabbage-dl/" "$HOME/Applications/Cabbage/"
fi
if [ "$ARCH" = aarch64 ] || [ "$ARCH" = arm64 ]; then
  log "note: Cabbage Linux 2.10 zip has no native aarch64 IDE — use macOS Cabbage for GUI workshop steps"
fi

log "provision complete"
