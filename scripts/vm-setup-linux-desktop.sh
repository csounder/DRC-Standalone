#!/usr/bin/env bash
# One-time setup: XFCE + xrdp on Ubuntu 22.04 (Multipass lac-2026-linux).
# Run on the VM: sudo bash vm-setup-linux-desktop.sh
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

VM_USER="${VM_USER:-ubuntu}"
VM_HOME="/home/${VM_USER}"

install_drc_desktop_shortcuts() {
  local DESK="${VM_HOME}/Desktop"
  local BIN="${VM_HOME}/bin"
  mkdir -p "$DESK" "$BIN"
  chown "${VM_USER}:${VM_USER}" "$DESK" "$BIN"

  # Fallback GUI launcher (Run from terminal or assign to a custom shortcut).
  cat > "${BIN}/drc-standalone-gui.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
export PATH="${HOME}/bin:${HOME}/Applications/Csound/bin:${HOME}/.bun/bin:${PATH:-}"
ROOT="${HOME}/Dr.C-Standalone"
if [[ ! -d "$ROOT" ]]; then
  echo "Missing ${ROOT}. Sync Dr.C-Standalone from the host (see WORKSHOP.md)."
  read -r -p "Press Enter to close…" _
  exit 1
fi
cd "$ROOT"
if [[ ! -x ./scripts/launch-drc.sh ]]; then
  echo "Missing ./scripts/launch-drc.sh in ${ROOT}"
  read -r -p "Press Enter to close…" _
  exit 1
fi
if ! ./scripts/launch-drc.sh; then
  ec=$?
  echo ""
  echo "Dr.C Standalone exited with status ${ec}."
  read -r -p "Press Enter to close…" _
  exit "$ec"
fi
EOF
  chmod +x "${BIN}/drc-standalone-gui.sh"
  chown "${VM_USER}:${VM_USER}" "${BIN}/drc-standalone-gui.sh"

  # XFCE ignores or prompts on untrusted .desktop files; use a visible terminal for errors.
  local DRC_PATH='export PATH="$HOME/bin:$HOME/Applications/Csound/bin:$HOME/.bun/bin:$PATH"'

  cat > "${DESK}/Dr.C-Standalone.desktop" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=Dr.C Standalone
Comment=Launch Dr.C Electron in Linux VM
Path=${VM_HOME}/Dr.C-Standalone
Exec=xfce4-terminal --hold -e bash -lc '${DRC_PATH}; cd "\$HOME/Dr.C-Standalone" && ./scripts/launch-drc.sh'
Icon=applications-multimedia
Terminal=false
Categories=Audio;
EOF

  cat > "${DESK}/Dr.C-Terminal.desktop" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=Dr.C Terminal
Comment=Dr.C TUI
Path=${VM_HOME}/Dr.C/opencode
Exec=xfce4-terminal --hold -e bash -lc '${DRC_PATH}; cd "\$HOME/Dr.C/opencode" && ./scripts/launch-drc-terminal.sh'
Icon=utilities-terminal
Terminal=false
Categories=Development;
EOF

  cat > "${DESK}/Terminal-Dr.C-Standalone.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Version=1.0
Name=Terminal (Dr.C folder)
Comment=Open shell in Dr.C-Standalone
Exec=xfce4-terminal --working-directory=/home/ubuntu/Dr.C-Standalone
Icon=utilities-terminal
Terminal=false
Categories=System;
EOF

  chown "${VM_USER}:${VM_USER}" "${DESK}"/*.desktop
  chmod +x "${DESK}"/*.desktop

  if command -v gio >/dev/null 2>&1; then
    for f in "${DESK}"/*.desktop; do
      runuser -u "${VM_USER}" -- gio set "$f" metadata::trusted true 2>/dev/null || true
    done
  fi

  echo "[vm-setup] desktop shortcuts installed in ${DESK}"
}

if [[ "${DRC_DESKTOP_ONLY:-}" == "1" ]]; then
  install_drc_desktop_shortcuts
  exit 0
fi

echo "[vm-setup] apt update + XFCE + xrdp"
apt-get update -qq
apt-get install -y -qq xfce4 xfce4-goodies xrdp dbus-x11

if ! passwd -S "${VM_USER}" 2>/dev/null | grep -q P; then
  echo "${VM_USER}:ubuntu" | chpasswd
  echo "[vm-setup] set password for user ${VM_USER} (RDP login)"
fi

echo "startxfce4" > "${VM_HOME}/.xsession"
chown "${VM_USER}:${VM_USER}" "${VM_HOME}/.xsession"
chmod +x "${VM_HOME}/.xsession"

systemctl enable xrdp
systemctl restart xrdp

install_drc_desktop_shortcuts

echo "[vm-setup] done — xrdp: $(systemctl is-active xrdp)"
echo "[vm-setup] RDP: <VM-IP>:3389  user ${VM_USER}  password ubuntu"
