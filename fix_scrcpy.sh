#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root, e.g. sudo $0"
  exit 1
fi

# User to grant adb access to (defaults to the sudo caller if present)
ADB_USER="${SUDO_USER:-${USER}}"

echo "[1/4] Install adb/scrcpy udev support"
pacman -S --needed --noconfirm android-tools android-udev scrcpy

echo "[2/4] Ensure adbusers group exists and ${ADB_USER} is a member"
getent group adbusers >/dev/null || groupadd adbusers
usermod -a -G adbusers "${ADB_USER}"

echo "[3/4] Reload udev rules so the new permissions take effect"
udevadm control --reload-rules
udevadm trigger

echo "[4/4] Restart adb server as ${ADB_USER}"
sudo -u "${ADB_USER}" adb kill-server || true
sudo -u "${ADB_USER}" adb start-server
sudo -u "${ADB_USER}" adb devices -l || true

cat <<'EOF'
Done.
Unplug and replug the phone, set USB mode to "File transfer", and accept the RSA
prompt on the device if it appears. Then run `scrcpy -d` (or just `scrcpy` if
only one device is connected). If you want Wi‑Fi, while USB is connected run
`adb tcpip 5555`, then `adb connect <phone-ip>:5555` and start scrcpy.
EOF
