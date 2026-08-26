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

  // Forward renderer console logs to main process stdout
  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    const levelNames = ["VERBOSE", "INFO", "WARN", "ERROR"];
    console.log(`[renderer:${levelNames[level] || level}] ${message} (${sourceId}:${line})`);
  });

  // Handle load failures gracefully (e.g. while dev server or Turbopack is compiling)
  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      // Ignore aborted loads (such as fast redirects)
      if (errorCode === -3) return; // ERR_ABORTED
      console.warn(
        `[window] Page load warning on ${validatedURL}: ${errorDescription} (${errorCode})`
      );
      if (IS_DEV && mainWindow && !mainWindow.isDestroyed()) {
        setTimeout(() => {
          const devUrl = DEV_SERVER_URL.replace("localhost", "127.0.0.1");
          mainWindow
            ?.loadURL(`${devUrl}/projects`)
            .catch(() => {});
        }, 1500);
      }
    }
  );

  const showSplashScreen = (initialStatus: string = "Starting Dezign2App...") => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Dezign2App</title>
            <style>
              * { box-sizing: border-box; }
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
                padding: 24px;
                overflow: hidden;
              }
              .container {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.4s ease-out;
              }
              .spinner {
                width: 44px;
                height: 44px;
                border: 3px solid rgba(56, 189, 248, 0.15);
                border-top-color: #38bdf8;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                margin-bottom: 24px;
                box-shadow: 0 0 20px rgba(56, 189, 248, 0.2);
              }
              @keyframes spin { to { transform: rotate(360deg); } }
              @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
              h2 {
                font-weight: 600;
                font-size: 20px;
                margin: 0 0 8px 0;
                letter-spacing: -0.02em;
                color: #f0f6fc;
              }
              p {
                color: #8b949e;
                margin: 0;
                font-size: 13px;
                max-width: 450px;
                text-align: center;
                line-height: 1.5;
                transition: opacity 0.2s;
              }
              .badge {
                display: inline-block;
                padding: 3px 8px;
                border-radius: 9999px;
                background: rgba(56, 189, 248, 0.1);
                border: 1px solid rgba(56, 189, 248, 0.25);
                color: #38bdf8;
                font-size: 11px;
                font-weight: 500;
                margin-bottom: 12px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="badge">Desktop Workspace</div>
              <div class="spinner"></div>
              <h2>Dezign2App</h2>
              <p id="status-text">${initialStatus}</p>
            </div>
            <script>
              window.setStatus = (text) => {
                const el = document.getElementById("status-text");
                if (el) el.textContent = text;
              };
            </script>
          </body>
        </html>
      `)}`
    ).catch(() => {});
  };

  const updateStatus = (text: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents
        .executeJavaScript(
          `if (window.setStatus) window.setStatus(${JSON.stringify(text)});`
        )
        .catch(() => {});
    }
  };

  const loadWithRetry = async (
    targetUrl: string,
    maxRetries: number = 20,
    delayMs: number = 1000
  ): Promise<void> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      try {
        console.log(`[window] Loading ${targetUrl} (attempt ${attempt}/${maxRetries})...`);
        if (attempt > 1) {
          updateStatus(`Connecting to workspace engine (attempt ${attempt}/${maxRetries})...`);
        }
        await mainWindow.loadURL(targetUrl);
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `[window] Attempt ${attempt}/${maxRetries} failed to load ${targetUrl}:`,
          message
        );
        if (attempt === maxRetries) {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL(
              `data:text/html;charset=utf-8,${encodeURIComponent(`
                <!DOCTYPE html>
                <html>
                  <head>
                    <meta charset="utf-8" />
                    <title>Dezign2App - Connection Failed</title>
                    <style>
                      * { box-sizing: border-box; }
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
                        padding: 24px;
                        text-align: center;
                      }
                      .icon { font-size: 40px; margin-bottom: 16px; }
                      h2 { font-size: 20px; font-weight: 600; margin: 0 0 10px 0; color: #f87171; }
                      p { color: #8b949e; margin: 0 0 24px 0; font-size: 13px; max-width: 480px; line-height: 1.5; }
                      .btn {
                        background-color: #38bdf8;
                        color: #0d1117;
                        border: none;
                        padding: 10px 24px;
                        font-size: 13px;
                        font-weight: 600;
                        border-radius: 6px;
                        cursor: pointer;
                        transition: opacity 0.2s;
                      }
                      .btn:hover { opacity: 0.9; }
                    </style>
                  </head>
                  <body>
                    <div class="icon">⚠️</div>
                    <h2>Application Engine Unavailable</h2>
                    <p>Could not establish connection to the workspace engine at <code>${targetUrl}</code>. Please make sure the service is running.</p>
                    <button class="btn" onclick="window.location.href='${targetUrl}'">Retry Connection</button>
                  </body>
                </html>
              `)}`
            );
          }
          return;
        }
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  };

  // Launch initial flow
  if (IS_DEV) {
    showSplashScreen("Connecting to development server...");
    const devUrl = DEV_SERVER_URL.replace("localhost", "127.0.0.1");
    loadWithRetry(`${devUrl}/projects`, 25, 1200);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    showSplashScreen("Initializing workspace...");

    const targetPort = await getAvailablePort(DEFAULT_PORT);

    startNextServer(targetPort, updateStatus)
      .then((port) => {
        loadWithRetry(`http://127.0.0.1:${port}/projects`, 15, 1000);
      })
      .catch((err) => {
        dialog.showErrorBox(
          "Dezign2App Startup Error",
          `Unable to start internal server:\n${err?.message || err}`
        );
      });
  }

  // Open external links in the system browser, not inside Electron
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
