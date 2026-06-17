#!/usr/bin/env bash
# Start lac-2026-linux and open RDP to the Linux XFCE desktop (Dr.C icons live there).
set -euo pipefail

VM="lac-2026-linux"

if ! command -v multipass >/dev/null 2>&1; then
  echo "Multipass not found. Install from https://multipass.run"
  exit 1
fi

multipass start "$VM" 2>/dev/null || true

IP="$(multipass info "$VM" --format csv 2>/dev/null | tail -1 | cut -d, -f3 || true)"
if [ -z "$IP" ]; then
  IP="$(multipass info "$VM" 2>/dev/null | awk '/IPv4/{print $2; exit}')"
fi

XRDP_STATUS="$(multipass exec "$VM" -- systemctl is-active xrdp 2>/dev/null || echo inactive)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Dr.C Linux Desktop (XFCE inside $VM)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  1. Open Microsoft Remote Desktop (Mac App Store)"
echo "  2. Add PC:  ${IP}:3389"
echo "  3. User:     ubuntu"
echo "  4. Password: ubuntu"
echo ""
echo "  xrdp status: $XRDP_STATUS"
if [ "$XRDP_STATUS" != "active" ]; then
  echo ""
  echo "  xrdp is not active. Install the desktop once:"
  echo "    multipass transfer ~/Dr.C-Standalone/scripts/vm-setup-linux-desktop.sh $VM:/tmp/"
  echo "    multipass exec $VM -- sudo bash /tmp/vm-setup-linux-desktop.sh"
fi
echo ""
echo "  Guide: ~/Dr.C-Workshop-Demo/LINUX-DESKTOP.md"
echo ""

open "rdp://${IP}" 2>/dev/null || open -a "Microsoft Remote Desktop" 2>/dev/null || true

read -r -p "Press Enter to close…" _
