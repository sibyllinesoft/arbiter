#!/usr/bin/env bash
set -euo pipefail

echo "[info] user/groups:"
id

if ! id -nG | grep -qw adbusers; then
  echo "[warn] You are not in group 'adbusers'. Run 'newgrp adbusers' or log out/in, then retry."
fi

echo "[info] Google (18d1) USB devices:"
if ! lsusb | grep -i 18d1; then
  echo "[warn] No Google/Pixel device detected. Check cable/port and ensure the phone is plugged in."
fi

if lsusb | grep -q '18d1:4ee1'; then
  echo "[warn] Device is in MTP/charging mode (4ee1) without adb."
  echo "       On the phone: enable Developer options, turn on USB debugging, and set USB to 'File transfer'."
fi

echo "[info] Restarting adb server..."
adb kill-server >/dev/null 2>&1 || true
adb start-server

echo "[info] adb devices:"
adb devices -l

cat <<'EOF'
If the list above is empty or shows 'unauthorized':
  1) Unplug/replug the phone with a data-capable cable (avoid hubs).
  2) Keep the phone unlocked; when prompted, accept the RSA fingerprint.
  3) Ensure USB mode is "File transfer" and USB debugging is enabled.
  4) Rerun this script.
EOF
