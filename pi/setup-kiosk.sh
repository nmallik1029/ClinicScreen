#!/usr/bin/env bash
# ClinicScreen — Phase 2: kiosk player.
# Installs Chromium + a minimal X server and wires a systemd service that boots
# the Pi straight into the fullscreen ClinicScreen enroll/player screen.
#
# Run on the Pi:   sudo bash setup-kiosk.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo: sudo bash setup-kiosk.sh" >&2
  exit 1
fi

# The non-root user the kiosk runs as (the account you created when flashing).
KIOSK_USER="${SUDO_USER:-pi}"
if [ "$KIOSK_USER" = "root" ]; then
  echo "Don't run as the root login; use 'sudo bash ...' from your normal user." >&2
  exit 1
fi
echo ">> Kiosk user: $KIOSK_USER"

HERE="$(cd "$(dirname "$0")" && pwd)"

echo ">> Installing packages…"
export DEBIAN_FRONTEND=noninteractive
apt-get update
# Bare X (no desktop), a cursor-hider, and Chromium. chromium-browser is the
# Pi OS package name; fall back to chromium on other Debians.
apt-get install -y --no-install-recommends \
  xserver-xorg xinit x11-xserver-utils unclutter ca-certificates
apt-get install -y chromium-browser || apt-get install -y chromium

echo ">> Allowing X to start from the systemd service…"
# startx as a non-root service needs the X wrapper to permit it.
install -d /etc/X11
cat > /etc/X11/Xwrapper.config <<'EOF'
allowed_users=anybody
needs_root_rights=yes
EOF

echo ">> Installing config, session script, and service…"
install -d /etc/clinicscreen
# Don't clobber an edited URL on re-runs.
if [ ! -f /etc/clinicscreen/kiosk.env ]; then
  install -m 0644 "$HERE/kiosk.env" /etc/clinicscreen/kiosk.env
else
  echo "   (keeping existing /etc/clinicscreen/kiosk.env)"
fi

install -m 0755 "$HERE/clinicscreen-kiosk-session.sh" /usr/local/bin/clinicscreen-kiosk-session

sed "s/__KIOSK_USER__/${KIOSK_USER}/g" "$HERE/clinicscreen-kiosk.service" \
  > /etc/systemd/system/clinicscreen-kiosk.service

echo ">> Enabling service…"
systemctl daemon-reload
systemctl disable getty@tty1.service >/dev/null 2>&1 || true
systemctl enable clinicscreen-kiosk.service

cat <<EOF

Done. The kiosk will start on boot.

  Start now:    sudo systemctl start clinicscreen-kiosk
  Watch logs:   journalctl -u clinicscreen-kiosk -f
  Edit the URL: sudo nano /etc/clinicscreen/kiosk.env  (then: sudo systemctl restart clinicscreen-kiosk)

Reboot to confirm it comes up on its own:  sudo reboot
EOF
