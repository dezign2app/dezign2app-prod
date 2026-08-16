import { BrowserWindow, dialog, shell } from "electron";
import path from "path";
import {
  DEV_SERVER_URL,
  IS_DEV,
  DEFAULT_PORT,
  getAppIcon,
  getAvailablePort,
} from "./constants";
import { startNextServer } from "./services/nextServer";

let mainWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export async function createMainWindow(): Promise<BrowserWindow> {
  const iconPath = getAppIcon();

  mainWindow = new BrowserWindow({
    title: "Dezign2App",
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    backgroundColor: "#0d1117",
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    ...(iconPath ? { icon: iconPath } : {}),
  });

  // Inject x-electron-app header on all requests
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    (details, callback) => {
      details.requestHeaders["x-electron-app"] = "1";
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    }
  );

  // Directly navigate to /projects (bypassing landing/pricing/marketing pages)
  if (IS_DEV) {
    mainWindow.loadURL(`${DEV_SERVER_URL}/projects`);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    // Show smooth startup splash while local server initializes
    mainWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Dezign2App</title>
            <style>
              body {
                margin: 0;
                height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background-color: #0d1117;
                color: #e6edf3;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                user-select: none;
              }
              .spinner {
                width: 36px;
                height: 36px;
                border: 3px solid rgba(255,255,255,0.1);
                border-top-color: #38bdf8;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                margin-bottom: 20px;
              }
              @keyframes spin { to { transform: rotate(360deg); } }
              h2 { font-weight: 500; font-size: 18px; margin: 0 0 6px 0; }
              p { color: #8b949e; margin: 0; font-size: 13px; }
            </style>
          </head>
          <body>
            <div class="spinner"></div>
            <h2>Starting Dezign2App</h2>
            <p>Initializing workspace...</p>
          </body>
        </html>
      `)}`
    );

    const targetPort = await getAvailablePort(DEFAULT_PORT);

    startNextServer(targetPort)
      .then((port) => {
        mainWindow?.loadURL(`http://localhost:${port}/projects`);
      })
      .catch((err) => {
        dialog.showErrorBox(
          "Dezign2App Startup Error",
          `Unable to start internal server:\n${err?.message || err}`
        );
      });
  }

  // Open external links and dev stack endpoints in the system browser, not inside Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url &&
      (url.startsWith("http://") ||
        url.startsWith("https://") ||
        url.startsWith("mailto:"))
    ) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}
