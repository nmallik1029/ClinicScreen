// ClinicScreen desktop app — Electron main process.
//
// This is a thin native shell around the deployed ClinicScreen web app. The whole
// admin panel and the quickAuth OAuth login flow run inside this window, so login
// and every feature happen "in the app" exactly as they do in a browser — but as a
// real installed Windows application with persistent login, native menus, and
// foreign links pushed out to the system browser.

const { app, BrowserWindow, shell, Menu, session } = require("electron");
const path = require("path");
const { APP_URL, isDev, APP_HOST, isInternal, attachStartupSplash } = require("./shared");

// Which build is this: the admin "Manager" (default) or the kiosk "Player"?
// Dev: pass --player. Packaged Player build: electron-builder writes csTarget into
// the bundled package.json via extraMetadata.
const TARGET = process.argv.includes("--player")
  ? "player"
  : (() => {
      try {
        return require("./package.json").csTarget || "manager";
      } catch {
        return "manager";
      }
    })();

// Give each flavor its own app identity so they use separate userData dirs (and
// therefore separate single-instance locks and sessions). Without this, both
// builds share the package.json "name" and Electron's single-instance lock treats
// the second one as a duplicate of the first — so you can't run the Manager and
// Player on the same machine at the same time. A "(dev)" suffix keeps source runs
// from clobbering an installed app's data.
const appName = TARGET === "player" ? "ClinicScreen Player" : "ClinicScreen";
app.setName(app.isPackaged ? appName : `${appName} (dev)`);

// Wipe every session cookie — including the quickAuth IdP's login cookie — so the
// next sign-in can't silently reuse the last account (single-sign-on auto-login).
async function clearSessionCookies() {
  try {
    await session.defaultSession.clearStorageData({ storages: ["cookies"] });
  } catch {
    /* best effort */
  }
}

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {BrowserWindow | null} */
let loadingOverlay = null;
let hideOverlayTimer = null;

// Keep the loading overlay exactly covering the main window's content area.
function positionOverlay() {
  if (!loadingOverlay || loadingOverlay.isDestroyed() || !mainWindow || mainWindow.isDestroyed()) return;
  loadingOverlay.setBounds(mainWindow.getContentBounds());
}

function showLoading() {
  if (!loadingOverlay || loadingOverlay.isDestroyed()) return;
  clearTimeout(hideOverlayTimer);
  positionOverlay();
  if (!loadingOverlay.isVisible()) loadingOverlay.showInactive();
}

// Debounced hide so the overlay stays up across the rapid cross-app redirects of
// the login flow instead of flickering between each hop.
function hideLoading() {
  clearTimeout(hideOverlayTimer);
  hideOverlayTimer = setTimeout(() => {
    if (loadingOverlay && !loadingOverlay.isDestroyed() && loadingOverlay.isVisible()) {
      loadingOverlay.hide();
    }
  }, 250);
}

// A frameless child window layered over the main window that shows the branded
// "Getting things ready for you" spinner while pages load — replaces the black
// flash during navigations and the OAuth redirect chain.
function createLoadingOverlay() {
  loadingOverlay = new BrowserWindow({
    parent: mainWindow,
    frame: false,
    transparent: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    focusable: false,
    skipTaskbar: true,
    show: false,
    backgroundColor: "#0b1e3b",
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  loadingOverlay.setMenu(null);
  loadingOverlay.loadFile(path.join(__dirname, "loading.html"));
  // Follow the main window as it moves/resizes.
  mainWindow.on("resize", positionOverlay);
  mainWindow.on("move", positionOverlay);
  mainWindow.on("minimize", () => loadingOverlay && !loadingOverlay.isDestroyed() && loadingOverlay.hide());
}

// --- Transition gating ---
// The loading screen appears ONLY during the two auth transitions, not on first
// launch, the login page, or normal in-app navigation:
//   login  — from the OAuth /auth/callback hop until the ClinicScreen app is ready
//   logout — from the /auth/logout hop until we're back on the login page
// Both hops are ClinicScreen routes only ever hit during their respective flow, so
// they're unambiguous triggers.
let transitionMode = null; // null | "login" | "logout"
let transitionSafetyTimer = null;

function appPath(url) {
  try {
    const u = new URL(url);
    return u.hostname === APP_HOST ? u.pathname : null;
  } catch {
    return null;
  }
}
const isCallbackUrl = (url) => appPath(url) === "/auth/callback";
const isLogoutUrl = (url) => appPath(url) === "/auth/logout";

// We've settled when we land on a real ClinicScreen page (not the transient
// callback/logout hops): the dashboard after login, or /login after logout.
function isSettledAppPage(url) {
  const p = appPath(url);
  return p !== null && p !== "/auth/callback" && p !== "/auth/logout";
}

function beginTransition(mode) {
  if (transitionMode === mode) return;
  transitionMode = mode;
  clearTimeout(transitionSafetyTimer);
  transitionSafetyTimer = setTimeout(endTransition, 30000); // backstop so it can't get stuck
  // Tell the overlay which message set to show, then reveal it.
  if (loadingOverlay && !loadingOverlay.isDestroyed()) {
    loadingOverlay.webContents
      .executeJavaScript(`window.__setMode && window.__setMode(${JSON.stringify(mode)})`)
      .catch(() => {});
  }
  showLoading();
}

function endTransition() {
  transitionMode = null;
  clearTimeout(transitionSafetyTimer);
  hideLoading();
}

// Friendly offline screen shown if the app can't reach the server, with a Retry
// button that reloads the real app.
function showOfflinePage(win) {
  const html = `
    <!doctype html><html><head><meta charset="utf-8" />
    <style>
      html,body{height:100%;margin:0}
      body{display:flex;align-items:center;justify-content:center;background:#0a0a0a;color:#e4e4e7;
        font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif}
      .card{max-width:380px;text-align:center;padding:32px}
      h1{font-size:18px;margin:0 0 8px}
      p{color:#a1a1aa;margin:0 0 20px}
      button{background:#fff;color:#000;border:0;border-radius:8px;padding:10px 18px;
        font-size:14px;font-weight:600;cursor:pointer}
      button:hover{background:#e4e4e7}
    </style></head><body>
      <div class="card">
        <h1>Can't reach ClinicScreen</h1>
        <p>Check your internet connection and try again.</p>
        <button onclick="location.href='${APP_URL}'">Retry</button>
      </div>
    </body></html>`;
  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
}

function buildMenu() {
  const template = [
    {
      label: "ClinicScreen",
      submenu: [
        {
          label: "Home",
          accelerator: "CmdOrCtrl+H",
          click: () => mainWindow && mainWindow.loadURL(APP_URL),
        },
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => mainWindow && mainWindow.webContents.reload(),
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Navigate",
      submenu: [
        {
          label: "Back",
          accelerator: "Alt+Left",
          click: () => mainWindow && mainWindow.webContents.navigationHistory.canGoBack() && mainWindow.webContents.navigationHistory.goBack(),
        },
        {
          label: "Forward",
          accelerator: "Alt+Right",
          click: () => mainWindow && mainWindow.webContents.navigationHistory.canGoForward() && mainWindow.webContents.navigationHistory.goForward(),
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        ...(isDev ? [{ role: "toggleDevTools" }] : []),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 940,
    minHeight: 640,
    title: "ClinicScreen",
    backgroundColor: "#0b1e3b",
    // Stay hidden behind the splash until the first page is loaded.
    show: false,
    // Hide the native menu bar (it looks out of place over the web UI). Shortcuts
    // still work; press Alt to reveal it momentarily.
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  // External links / popups go to the system browser; app + IdP stay in-window so
  // the OAuth redirect login flow completes here.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternal(url)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isInternal(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Landing on ClinicScreen's own /login page means we're signed out (fresh start
  // or just after logout). Clear cookies so quickAuth forces a real login instead
  // of auto-signing-in the previous account.
  mainWindow.webContents.on("did-navigate", (_e, url) => {
    try {
      const u = new URL(url);
      if (u.hostname === APP_HOST && u.pathname === "/login") {
        clearSessionCookies();
      }
    } catch {
      /* ignore non-URL navigations */
    }
  });

  mainWindow.webContents.on("did-fail-load", (_e, errorCode, _desc, validatedURL, isMainFrame) => {
    // -3 is ERR_ABORTED (e.g. a redirect superseded the load) — not a real failure.
    if (isMainFrame && errorCode !== -3 && !validatedURL.startsWith("data:")) {
      endTransition();
      showOfflinePage(mainWindow);
    }
  });

  // Show the loading screen ONLY for the two auth transitions. The /auth/callback
  // and /auth/logout hops are each only ever hit during their respective flow, so
  // they're unambiguous triggers; we catch them whether they arrive as a fresh
  // navigation, a form-submit navigation, or a redirect within one.
  const onNav = (_e, url) => {
    if (isCallbackUrl(url)) beginTransition("login");
    else if (isLogoutUrl(url)) beginTransition("logout");
  };
  mainWindow.webContents.on("did-start-navigation", onNav);
  mainWindow.webContents.on("did-redirect-navigation", onNav);
  mainWindow.webContents.on("will-navigate", onNav);
  mainWindow.webContents.on("will-redirect", onNav);

  // Hide once we've settled on a real app page: the dashboard after login, or the
  // login page after logout.
  mainWindow.webContents.on("did-stop-loading", () => {
    if (transitionMode && isSettledAppPage(mainWindow.webContents.getURL())) {
      endTransition();
    }
  });

  createLoadingOverlay();
  attachStartupSplash(mainWindow); // branded splash until the first page is ready
  mainWindow.loadURL(APP_URL);
  // DevTools are not opened automatically; use View → Toggle DevTools (dev) if needed.

  mainWindow.on("closed", () => {
    clearTimeout(hideOverlayTimer);
    if (loadingOverlay && !loadingOverlay.isDestroyed()) loadingOverlay.destroy();
    loadingOverlay = null;
    mainWindow = null;
  });
}

// Single-instance: focus the existing window instead of opening a second one.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    if (TARGET === "player") {
      // Kiosk player build — no admin UI, no menu, fullscreen signage.
      require("./player").startPlayer();
      return;
    }

    buildMenu();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
