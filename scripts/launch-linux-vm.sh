#!/usr/bin/env bash
# LAC 2026 — open Multipass Linux VM shell for workshop demos (macOS host)
set -euo pipefail

VM_NAME="${DRC_LINUX_VM:-lac-2026-linux}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROVISION_SCRIPT="${SCRIPT_DIR}/linux-vm-provision.sh"
START_SCRIPT="${SCRIPT_DIR}/start-linux-vm.sh"

DO_PROVISION=0
DO_SYNC=0
for arg in "$@"; do
  case "$arg" in
    --provision) DO_PROVISION=1 ;;
    --sync) DO_SYNC=1 ;;
    -h|--help)
      cat <<EOF
Usage: $(basename "$0") [--provision] [--sync]

  Default: start VM if needed, show status, enter interactive shell.

  --provision  Re-run linux-vm-provision.sh inside the VM
  --sync       Rsync repos from /mnt mounts (if present in VM)

VM name: ${VM_NAME} (override with DRC_LINUX_VM)

To start the VM without entering a shell, use: ./scripts/start-linux-vm.sh
EOF
      exit 0
      ;;
  esac
done

"${START_SCRIPT}"

if [[ "${DO_SYNC}" -eq 1 ]]; then
  echo "Syncing repos from VM mounts (if present)…"
  multipass exec "${VM_NAME}" -- bash -lc '
    set -euo pipefail
    synced=0
    if [ -d /mnt/Dr.C-Standalone ]; then
      rsync -a --delete \
        --exclude node_modules --exclude out --exclude release --exclude dist \
        /mnt/Dr.C-Standalone/ ~/Dr.C-Standalone/
      echo "  synced /mnt/Dr.C-Standalone → ~/Dr.C-Standalone"
      synced=1
    fi
    if [ -d /mnt/Dr.C ]; then
      rsync -a --delete \
        --exclude node_modules --exclude .turbo --exclude dist \
        --exclude "sdks/vscode/images/icon.png" \
        --exclude "sdks/vscode/images/button-dark.svg" \
        --exclude "sdks/vscode/images/button-light.svg" \
        /mnt/Dr.C/ ~/Dr.C/ || true
      echo "  synced /mnt/Dr.C → ~/Dr.C"
      synced=1
    fi
    if [ "$synced" -eq 0 ]; then
      echo "  no /mnt mounts — repos should already be in ~/Dr.C-Standalone and ~/Dr.C"
    fi
  '
  echo ""
fi

if [[ "${DO_PROVISION}" -eq 1 ]]; then
  echo "Re-running provision inside ${VM_NAME}…"
  if [[ -f "${PROVISION_SCRIPT}" ]]; then
    multipass transfer "${PROVISION_SCRIPT}" "${VM_NAME}:/tmp/linux-vm-provision.sh"
    multipass exec "${VM_NAME}" -- bash -lc 'chmod +x /tmp/linux-vm-provision.sh && /tmp/linux-vm-provision.sh'
  elif multipass exec "${VM_NAME}" -- test -x ~/linux-vm-provision.sh 2>/dev/null; then
    multipass exec "${VM_NAME}" -- bash -lc '~/linux-vm-provision.sh'
  else
    echo "Provision script not found on host (${PROVISION_SCRIPT}) or in VM (~/linux-vm-provision.sh)."
    exit 1
  fi
  echo ""
fi

cat <<'CHEAT'
Quick commands (inside VM):

  export PATH="$HOME/bin:$HOME/Applications/Csound/bin:$HOME/.bun/bin:$PATH"
  export LD_LIBRARY_PATH="$HOME/Applications/Csound/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
  cd ~/Dr.C-Standalone
  csound --version
  npm test
  ./scripts/launch-drc.sh
  ./launchers/Dr.C-Standalone.sh

CHEAT

echo "Entering Linux shell (type exit to return to macOS)…"
echo ""
exec multipass shell "${VM_NAME}"
