#!/usr/bin/env bash
# X session for the ClinicScreen kiosk. Started by startx (see the systemd unit).
# Runs Chromium fullscreen at the enroll URL with a PERSISTENT profile so the
# paired device identity (localStorage "cs_device") survives reboots.
set -euo pipefail

# shellcheck disable=SC1091
source /etc/clinicscreen/kiosk.env

URL="${CLINICSCREEN_URL%/}${KIOSK_PATH:-/enroll}"
PROFILE="${HOME}/.config/clinicscreen-chromium"
mkdir -p "$PROFILE"

# --- Display: never blank or sleep ------------------------------------------
xset s off
xset s noblank
xset -dpms

# Hide the mouse cursor as soon as it stops moving.
unclutter -idle 0.5 -root &

# --- Suppress "Chrome didn't shut down correctly" restore bar ----------------
# A power-cut leaves the profile flagged as crashed; rewrite the flags so the
# next launch comes up clean with no infobar covering the screen.
PREFS="$PROFILE/Default/Preferences"
if [ -f "$PREFS" ]; then
  sed -i 's/"exit_type":"[^"]*"/"exit_type":"Normal"/; s/"exited_cleanly":false/"exited_cleanly":true/' "$PREFS" || true
fi

# --- Pick whichever Chromium the OS installed --------------------------------
CHROME="$(command -v chromium-browser || command -v chromium || true)"
if [ -z "$CHROME" ]; then
  echo "ERROR: no chromium binary found" >&2
  sleep 10
  exit 1
fi

exec "$CHROME" \
  --user-data-dir="$PROFILE" \
  --kiosk "$URL" \
  --start-fullscreen \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-features=Translate,TranslateUI \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --autoplay-policy=no-user-gesture-required \
  --check-for-update-interval=31536000 \
  --no-first-run \
  --fast \
  --fast-start
