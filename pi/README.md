# ClinicScreen on Raspberry Pi

Turns a Raspberry Pi 4 into a self-booting ClinicScreen player: power on → fullscreen
pairing/playback, no keyboard or mouse. Built one phase at a time; each phase has a
checkpoint that must work before moving on.

- **Phase 2 — Kiosk player** ← you are here
- Phase 3 — Remote access (Tailscale)
- Phase 4 — Easy WiFi onboarding (wifi-connect)
- Phase 5 — Reliability (nightly reboot, auto-updates)
- Phase 6 — Golden image + fleet script

---

## Phase 2 — Kiosk player

### What it does
Boots the Pi straight into Chromium in kiosk mode pointed at `<CLINICSCREEN_URL>/enroll`.
That one URL self-heals: an unpaired Pi shows a pairing code; an already-paired Pi jumps
to its player; a reset screen re-pairs itself. The device identity is stored in the
browser's `localStorage`, so Chromium uses a **persistent profile** that survives reboots.

### Prerequisites (Phase 0–1)
- Raspberry Pi OS **Lite (64-bit)** flashed, with SSH enabled and your home WiFi set
  (via Raspberry Pi Imager's advanced settings).
- You can `ssh <user>@<hostname>.local` from your PC and the Pi has internet.

### Install
From your PC, copy this folder to the Pi and run the setup script:

```bash
# from the repo root on your PC (Git Bash / WSL / PowerShell scp)
scp -r pi <user>@<hostname>.local:~/clinicscreen-pi

# then on the Pi
ssh <user>@<hostname>.local
cd ~/clinicscreen-pi
sudo bash setup-kiosk.sh
sudo reboot
```

### Checkpoint ✅
After reboot the TV should show, **with no keyboard/mouse**:

1. The navy **ClinicScreen** pairing screen with a 6-digit code, then
2. after you pair it (practice → Screens → *Pair a screen* → enter the code),
   your playlist playing fullscreen.

Reboot once more — it should come straight back to the **playing** screen
(not the pairing code), proving the persistent profile works.

### Handy commands
```bash
journalctl -u clinicscreen-kiosk -f                 # live logs
sudo systemctl restart clinicscreen-kiosk           # restart the kiosk
sudo nano /etc/clinicscreen/kiosk.env               # change the app URL
```

### Troubleshooting
- **Black screen / service flapping:** `journalctl -u clinicscreen-kiosk -b` — usually
  a missing package or the X wrapper. Re-run `sudo bash setup-kiosk.sh`.
- **"Chrome didn't shut down correctly" bar:** handled automatically on next launch;
  if it lingers, a full power-cycle clears it.
- **Re-pairs every boot:** the profile isn't persisting — confirm
  `~/.config/clinicscreen-chromium` exists and is owned by the kiosk user.
- **To un-pair a screen for testing:** delete `~/.config/clinicscreen-chromium` and restart.
