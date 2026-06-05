// Preload runs in an isolated context before the web app loads. We deliberately
// expose almost nothing to the remote page — just a small, read-only marker so the
// web app can tell it's running inside the desktop shell (e.g. to tweak UI later).
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("clinicscreenDesktop", {
  isDesktop: true,
  version: process.env.npm_package_version || "0.1.0",
  platform: process.platform,
});
