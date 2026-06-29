// Config + shared helpers for the Manager and Player builds.
const { app, BrowserWindow } = require("electron");
const path = require("path");

// The deployed app the shells point at. Override at launch with CLINICSCREEN_URL=…
// (and QUICKAUTH_URL=…) for staging/local testing.
const APP_URL = process.env.CLINICSCREEN_URL || "https://clinicscreen-app.nmallik1029.workers.dev";
const AUTH_URL = process.env.QUICKAUTH_URL || "https://clinicscreen-auth.nmallik1029.workers.dev";
const isDev = process.argv.includes("--dev");
const APP_ICON_PATH = appIconPath();

function appIconPath() {
  return app && app.isPackaged
    ? path.join(process.resourcesPath, "icon.png")
    : path.join(__dirname, "assets", "icon.png");
}

// Origins kept inside the app window: the app itself and its OAuth identity
// provider. Everything else is an external link → system browser.
const ALLOWED_HOSTS = new Set(
  [APP_URL, AUTH_URL]
    .map((u) => {
      try {
        return new URL(u).hostname;
      } catch {
        return null;
      }
    })
    .filter(Boolean),
);
if (isDev) ALLOWED_HOSTS.add("localhost");

const APP_HOST = (() => {
  try {
    return new URL(APP_URL).hostname;
  } catch {
    return null;
  }
})();

function isInternal(urlStr) {
  try {
    return ALLOWED_HOSTS.has(new URL(urlStr).hostname);
  } catch {
    return false;
  }
}

/**
 * Show a branded splash window immediately on launch and keep it up until the
 * target window's first page has loaded — then reveal the (initially hidden)
 * target window and close the splash. The target window must be created with
 * `show: false`. A timeout guards against a load that never completes.
 */
function attachStartupSplash(targetWindow) {
  const splash = new BrowserWindow({
    width: 520,
    height: 320,
    frame: false,
    resizable: false,
    movable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    icon: APP_ICON_PATH,
    backgroundColor: "#ffffff",
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  splash.setMenu(null);
  splash.loadFile(path.join(__dirname, "splash.html"));
  splash.once("ready-to-show", () => {
    if (!splash.isDestroyed()) splash.show();
  });

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (!targetWindow.isDestroyed()) targetWindow.show();
    if (!splash.isDestroyed()) splash.close();
  };

  targetWindow.webContents.once("did-stop-loading", finish);
  targetWindow.webContents.once("did-fail-load", finish);
  setTimeout(finish, 12000);

  return splash;
}

module.exports = {
  APP_URL,
  AUTH_URL,
  APP_ICON_PATH,
  isDev,
  ALLOWED_HOSTS,
  APP_HOST,
  isInternal,
  attachStartupSplash,
};
