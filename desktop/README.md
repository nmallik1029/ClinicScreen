# ClinicScreen Desktop

A native Windows desktop app for the ClinicScreen admin panel. It's an Electron
shell that loads the deployed ClinicScreen web app, so **login and every feature run
inside the app** — it behaves like an installed program, not a browser tab.

- Login (the quickAuth OAuth flow) happens in-window and **persists across restarts**.
- Foreign links (e.g. external sites) open in your default browser.
- Native window, menus, and a single-instance lock.

## Develop / run locally

```powershell
cd R:\dev\ClinicScreen\desktop
npm install
npm start          # opens the app against the deployed site
npm run dev        # same, plus DevTools and localhost allowed
```

Point it somewhere else (staging, or your local `next start`) without editing code:

```powershell
$env:CLINICSCREEN_URL = "http://localhost:3001"
$env:QUICKAUTH_URL    = "http://localhost:3000"
npm run dev
```

## Build the Windows installer

```powershell
cd R:\dev\ClinicScreen\desktop
npm install
npm run dist
```

The installer (`.exe`) lands in `desktop/dist/`. `npm run pack` produces an unpacked
build in `desktop/dist/win-unpacked/` for quick testing without an installer.

## Two builds from one codebase: Manager vs Player

This project produces two apps from the same source, selected by a build flag:

- **Manager** (default) — the admin/superadmin panel for the office PC. Windowed,
  OAuth login, loading/logout overlay.
- **Player** — the kiosk build for the TV PCs. No admin UI/menu, fullscreen kiosk,
  keeps the display awake, auto-starts on login, self-heals on network loss. It
  loads the deployed `/enroll` page, which shows a **pairing code** (or jumps
  straight to playback if the device is already paired). An admin enters that code
  in the Manager (**practice → Screens → Pair a screen**) to bind it to a Screen.
  Maintenance escape hatch: **Ctrl+Shift+Q** quits the kiosk.

```powershell
# Run the player locally (windowed in dev, kiosk when packaged)
npm run dev:player        # or: npm run start:player

# Build the Player installer → desktop/dist-player/
npm run dist:player
```

The flag is `--player` in dev; the packaged Player sets `csTarget: "player"` in its
bundled metadata (via electron-builder `extraMetadata`). The two installers have
distinct names/appIds so they install side by side.

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `CLINICSCREEN_URL` | `https://clinicscreen-app.nmallik1029.workers.dev` | App the shell loads |
| `QUICKAUTH_URL` | `https://clinicscreen-auth.nmallik1029.workers.dev` | OAuth IdP kept in-window |

The deployed URLs are also the defaults baked into `main.js`. Update them there if
you move to a custom domain (e.g. `app.clinicscreen.com`).

## App icon (optional)

To brand the installer and window, drop a `512x512` (or larger) icon at
`desktop/assets/icon.ico`. electron-builder picks it up automatically from
`buildResources`.
