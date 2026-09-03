import { app, BrowserWindow, dialog } from "electron";
import { APP_NAME, APP_USER_MODEL_ID } from "./constants";
import { createMainWindow, getMainWindow } from "./window";
import { registerIpcHandlers } from "./ipc/register";
import {
  registerProtocolClient,
  handleAuthUrl,
  handleInitialDeepLink,
} from "./services/auth";
import { stopNextServer } from "./services/nextServer";
import { cleanupAllTerminals } from "./services/terminal";
import { stopDockerProcess } from "./services/docker";
import { stopDevProcess } from "./services/devRunner";

// ─────────────────────────────────────────────
//  App Identity & Single Instance Lock
// ─────────────────────────────────────────────
app.name = APP_NAME;
app.setName(APP_NAME);
if (process.platform === "win32") {
  app.setAppUserModelId(APP_USER_MODEL_ID);
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// ─────────────────────────────────────────────
//  Global Error Handling
// ─────────────────────────────────────────────
process.on("uncaughtException", (error) => {
  console.error("[main] Uncaught Exception:", error);
  dialog.showErrorBox(
    "Dezign2App Error",
    error?.stack || error?.message || String(error)
  );
});

process.on("unhandledRejection", (reason) => {
  console.error("[main] Unhandled Rejection:", reason);
});

// ─────────────────────────────────────────────
//  Deep Linking & Second Instance
// ─────────────────────────────────────────────
registerProtocolClient();

app.on("second-instance", (_event, commandLine) => {
  console.log("[main] App received second-instance event with args:", commandLine);
  const mainWindow = getMainWindow();
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
  const deepLink = commandLine.find((arg) =>
    arg.toLowerCase().includes("dezign2app://")
  );
  if (deepLink) {
    console.log("[main] Found deepLink in second-instance args:", deepLink);
    handleAuthUrl(deepLink);
  } else {
    console.warn("[main] second-instance fired but no dezign2app:// URL found in args:", commandLine);
  }
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  console.log("[main] App received open-url event with URL:", url);
  handleAuthUrl(url);
});

// ─────────────────────────────────────────────
//  App Lifecycle
// ─────────────────────────────────────────────
app.whenReady().then(async () => {
  registerIpcHandlers();
  await createMainWindow();
  handleInitialDeepLink();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopNextServer();
  cleanupAllTerminals();
  stopDockerProcess();
  stopDevProcess();
});
