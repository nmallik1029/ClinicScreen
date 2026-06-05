// ClinicScreen Player — kiosk build for the TV PCs (N100 mini PCs etc.).
//
// No admin UI and no menu. It loads the deployed /enroll page, which either jumps
// straight to playback (if this device is already paired) or shows a pairing code
// for an admin to enter in the Manager app. Runs fullscreen kiosk, keeps the
// display awake, auto-starts on login, and self-heals on network blips.

const { app, BrowserWindow, Menu, shell, powerSaveBlocker, globalShortcut } = require("electron");
const { APP_URL, isDev, isInternal, attachStartupSplash } = require("./shared");

const ENTRY_URL = `${APP_URL}/enroll`;

let playerWindow = null;
let powerBlockerId = null;
let reloadTimer = null;

function startPlayer() {
  Menu.setApplicationMenu(null);

  // Keep the TV awake.
  try {
    powerBlockerId = powerSaveBlocker.start("prevent-display-sleep");
  } catch {
    /* not fatal */
  }

  // Come back automatically after a reboot/power blip (skip while developing).
  if (!isDev) {
    try {
      app.setLoginItemSettings({ openAtLogin: true });
    } catch {
      /* not fatal */
    }
  }

  playerWindow = new BrowserWindow({
    fullscreen: true,
    kiosk: !isDev,
    frame: false,
    backgroundColor: "#0b1e3b",
    autoHideMenuBar: true,
    show: false, // stay hidden behind the splash until /enroll is loaded
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // The kiosk never navigates to foreign sites; external links (if any) open in the
  // system browser and never replace the signage.
  playerWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isInternal(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  playerWindow.webContents.on("will-navigate", (event, url) => {
    if (!isInternal(url)) event.preventDefault();
  });

  // Self-heal: if a load fails (server cold, network blip), keep retrying.
  playerWindow.webContents.on("did-fail-load", (_e, errorCode, _desc, _url, isMainFrame) => {
    if (isMainFrame && errorCode !== -3) {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        if (playerWindow && !playerWindow.isDestroyed()) playerWindow.loadURL(ENTRY_URL);
      }, 4000);
    }
  });

  // Maintenance escape hatch (kiosk has no menu/title bar): Ctrl+Shift+Q quits.
  globalShortcut.register("CommandOrControl+Shift+Q", () => app.quit());

  attachStartupSplash(playerWindow); // branded splash until /enroll is ready
  playerWindow.loadURL(ENTRY_URL);

  playerWindow.on("closed", () => {
    playerWindow = null;
  });
}

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  clearTimeout(reloadTimer);
  if (powerBlockerId !== null && powerSaveBlocker.isStarted(powerBlockerId)) {
    powerSaveBlocker.stop(powerBlockerId);
  }
});

module.exports = { startPlayer };
