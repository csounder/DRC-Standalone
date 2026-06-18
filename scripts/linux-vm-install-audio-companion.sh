#!/usr/bin/env bash
# One-shot: PulseAudio + CsoundQt/Cabbage companion tools on lac-2026-linux (existing VM).
# Run inside VM: bash ~/Dr.C-Standalone/scripts/linux-vm-install-audio-companion.sh
# Or from Mac host:
#   multipass transfer ~/Dr.C-Standalone/scripts/linux-vm-install-audio-companion.sh lac-2026-linux:/tmp/
#   multipass exec lac-2026-linux -- bash /tmp/linux-vm-install-audio-companion.sh
set -euo pipefail

log() { echo "[audio-companion] $*"; }

export DEBIAN_FRONTEND=noninteractive
ARCH="$(uname -m)"

log "PulseAudio packages"
sudo apt-get update -qq
sudo apt-get install -y -qq pulseaudio pulseaudio-utils pavucontrol alsa-utils
sudo usermod -aG audio "$USER" 2>/dev/null || true
pulseaudio --start 2>/dev/null || true
if pulseaudio --check 2>/dev/null; then
  log "PulseAudio: OK"
else
  log "PulseAudio: not running in this shell (start after GUI login)"
fi

log "xrdp PulseAudio module"
if ! dpkg -l pulseaudio-module-xrdp 2>/dev/null | grep -q '^ii'; then
  if apt-cache show pulseaudio-module-xrdp >/dev/null 2>&1; then
    sudo apt-get install -y -qq pulseaudio-module-xrdp
  else
    log "Building pulseaudio-module-xrdp from neutrinolabs…"
    sudo apt-get install -y -qq libpulse-dev autoconf automake libtool pkg-config git
    BUILD_DIR="/tmp/pulseaudio-module-xrdp-build"
    rm -rf "$BUILD_DIR"
    git clone --depth 1 https://github.com/neutrinolabs/pulseaudio-module-xrdp.git "$BUILD_DIR"
    (cd "$BUILD_DIR" && ./bootstrap && ./configure PULSE_DIR=/usr && make -j"$(nproc)" && sudo make install)
    sudo ldconfig
  fi
fi
ls /etc/xrdp/pulseaudio*.so 2>/dev/null || ls /usr/lib*/pulse-*/modules/module-xrdp-sink.so 2>/dev/null || true

log "Companion tools (CsoundQt, Cabbage) — arch-aware"
export PATH="$HOME/bin:$HOME/Applications/Csound/bin:$PATH"
INSTALL_OPTIONAL_TOOLS=1 bash -c '
  source /dev/stdin
' <<'INLINE' || true
# Re-use provision companion block
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=linux-vm-provision.sh
# Only run the optional-tools section if full provision not desired:
ARCH="$(uname -m)"
mkdir -p ~/Applications/CsoundQt ~/src/cabbage-dl ~/Applications/Cabbage ~/bin
CSQ_APPIMAGE="CsoundQt-7.0.0-beta4-x86_64.AppImage"
if [ "$ARCH" = "x86_64" ] || [ "$ARCH" = "amd64" ]; then
  [ -x "$HOME/Applications/CsoundQt/$CSQ_APPIMAGE" ] || curl -fsSL -o "$HOME/Applications/CsoundQt/$CSQ_APPIMAGE" \
    "https://github.com/CsoundQt/CsoundQt/releases/download/v7.0.0-beta4/$CSQ_APPIMAGE"
  chmod +x "$HOME/Applications/CsoundQt/$CSQ_APPIMAGE"
  ln -sf "$HOME/Applications/CsoundQt/$CSQ_APPIMAGE" ~/bin/csoundqt
  echo "CsoundQt: ~/bin/csoundqt"
else
  echo "CsoundQt: BLOCKED on $ARCH — use macOS CsoundQt (no aarch64 v7 AppImage)"
fi
CABBAGE_ZIP="CabbageLinux-2.10.0.zip"
[ -f "$HOME/src/cabbage-dl/$CABBAGE_ZIP" ] || curl -fsSL -o "$HOME/src/cabbage-dl/$CABBAGE_ZIP" \
  "https://github.com/rorywalsh/cabbage/releases/download/v2.10.0/$CABBAGE_ZIP"
if [ "$ARCH" = "x86_64" ] || [ "$ARCH" = "amd64" ]; then
  unzip -qo "$HOME/src/cabbage-dl/$CABBAGE_ZIP" -d "$HOME/src/cabbage-dl" 2>/dev/null || true
  rsync -a --exclude "$CABBAGE_ZIP" "$HOME/src/cabbage-dl/" "$HOME/Applications/Cabbage/" 2>/dev/null || true
  [ -x "$HOME/Applications/Cabbage/installCabbage.sh" ] && (cd "$HOME/Applications/Cabbage" && sudo ./installCabbage.sh) || true
  command -v cabbage && cabbage --version 2>/dev/null || true
else
  echo "Cabbage: BLOCKED on $ARCH — Linux zip is x86_64; use macOS Cabbage-2.10.x"
fi
INLINE

log "=== verification ==="
export PATH="$HOME/bin:$HOME/Applications/Csound/bin:$PATH"
csound --version 2>/dev/null | head -1 || echo "csound: NOT FOUND"
pulseaudio --check 2>/dev/null && echo "pulseaudio: OK" || echo "pulseaudio: NOT RUNNING"
which csoundqt 2>/dev/null && file "$(which csoundqt)" || echo "csoundqt: not installed (aarch64 blocker)"
which cabbage 2>/dev/null && cabbage --version 2>/dev/null || echo "cabbage: not installed (aarch64 blocker)"
aplay -l 2>/dev/null | head -5 || true
log "RDP audio: Windows App → edit PC → Display & Audio → Play sound on: This computer"
