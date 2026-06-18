#!/usr/bin/env bash
# Shared macOS-host helpers for LAC 2026 Multipass VM launchers.
# Source from launch-linux-*.sh and launch-linux-vm.sh (do not execute directly).

: "${DRC_LINUX_VM:=lac-2026-linux}"
VM_NAME="${DRC_LINUX_VM}"

# Workshop PATH inside the Ubuntu VM (bash -lc).
DRC_VM_PATH_EXPORT='export PATH="$HOME/bin:$HOME/Applications/Csound/bin:$HOME/Applications/Csound:$HOME/.bun/bin:$PATH"'
DRC_VM_LD_EXPORT='export LD_LIBRARY_PATH="$HOME/Applications/Csound/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"'

drc_vm_ip() {
  multipass info "${VM_NAME}" 2>/dev/null | awk -F': ' '/^IPv4:/ {gsub(/^[ \t]+/, "", $2); print $2; exit}'
}

drc_require_multipass() {
  if ! command -v multipass >/dev/null 2>&1; then
    echo "multipass is not installed."
    echo ""
    echo "Install: brew install --cask multipass  — or — https://multipass.run/install"
    exit 1
  fi
}

drc_require_vm() {
  drc_require_multipass
  if ! multipass info "${VM_NAME}" >/dev/null 2>&1; then
    echo "Multipass VM '${VM_NAME}' not found."
    echo "Create and provision with scripts/linux-vm-provision.sh (see PARTICIPANTS.md)."
    exit 1
  fi
}

drc_ensure_vm_running() {
  drc_require_vm
  local state
  state="$(multipass info "${VM_NAME}" 2>/dev/null | awk -F': ' '/^State:/ {print $2}')"
  if [[ "${state}" != "Running" ]]; then
    echo "Starting ${VM_NAME}…"
    multipass start "${VM_NAME}"
  fi
}

drc_vm_exec() {
  multipass exec "${VM_NAME}" -- "$@"
}

drc_vm_bash_lc() {
  drc_vm_exec bash -lc "$1"
}

# Detect active X11 display inside the VM (xrdp sessions are usually :10+).
drc_vm_detect_display() {
  drc_vm_bash_lc '
    rdp_display=""
    fallback=""
    for sock in /tmp/.X11-unix/X*; do
      [[ -S "$sock" ]] || continue
      n="${sock##*/X}"
      [[ "$n" =~ ^[0-9]+$ ]] || continue
      disp=":$n"
      fallback="$disp"
      if (( n >= 10 )); then
        if [[ -z "$rdp_display" ]] || (( n > ${rdp_display#:} )); then
          rdp_display="$disp"
        fi
      fi
    done
    if [[ -n "$rdp_display" ]]; then
      echo "$rdp_display"
    elif [[ -n "$fallback" ]]; then
      echo "$fallback"
    elif systemctl is-active xrdp >/dev/null 2>&1; then
      echo ":10"
    fi
  ' 2>/dev/null | tail -1
}

drc_vm_xrdp_reminder() {
  local ip display
  ip="$(drc_vm_ip || echo '?')"
  display="$(drc_vm_detect_display || true)"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo " Linux desktop (RDP) — connect before GUI launch"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "  1. Double-click: a-Dr.C Linux Desktop.command (or open-linux-desktop.sh)"
  echo "  2. Windows App → Add PC → ${ip}:3389"
  echo "  3. Login: ubuntu / ubuntu"
  echo ""
  if [[ -n "${display}" ]]; then
    echo "  Active DISPLAY in VM: ${display}"
  else
    echo "  No X display detected yet — connect RDP first, then re-run this launcher."
  fi
  echo ""
  echo "  Guide: ~/Dr.C-Workshop-Demo/LINUX-DESKTOP.md"
  echo ""
}

# Copy host-mounted repos into ~ (never sync node_modules — run npm install on the VM).
drc_vm_sync_from_mount() {
  echo "Syncing repos from VM mounts (if present)…"
  drc_vm_bash_lc '
    set -euo pipefail
    synced=0
    if [ -d /mnt/Dr.C-Standalone ]; then
      rsync -a --delete \
        --exclude node_modules --exclude out --exclude release --exclude dist \
        /mnt/Dr.C-Standalone/ ~/Dr.C-Standalone/
      echo "  synced /mnt/Dr.C-Standalone → ~/Dr.C-Standalone (node_modules excluded)"
      synced=1
    fi
    if [ -d /mnt/Dr.C ]; then
      rsync -a --delete \
        --exclude node_modules --exclude .turbo --exclude dist \
        --exclude "sdks/vscode/images/icon.png" \
        --exclude "sdks/vscode/images/button-dark.svg" \
        --exclude "sdks/vscode/images/button-light.svg" \
        /mnt/Dr.C/ ~/Dr.C/ || true
      echo "  synced /mnt/Dr.C → ~/Dr.C (node_modules excluded)"
      synced=1
    fi
    if [ "$synced" -eq 0 ]; then
      echo "  no /mnt mounts — using ~/Dr.C-Standalone and ~/Dr.C as-is"
    fi
  '
  echo ""
}
