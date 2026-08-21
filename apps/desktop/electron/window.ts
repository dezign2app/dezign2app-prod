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
          mainWindow
            ?.loadURL(`${DEV_SERVER_URL}/projects`)
            .catch(() => {});
        }, 1500);
      }
    }
  );

  const loadWithRetry = async (
    targetUrl: string,
    maxRetries: number = 8,
    delayMs: number = 1000
  ): Promise<void> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      try {
        console.log(`[window] Loading ${targetUrl} (attempt ${attempt}/${maxRetries})...`);
        await mainWindow.loadURL(targetUrl);
        return;
      } catch (err: any) {
        console.warn(
          `[window] Attempt ${attempt}/${maxRetries} failed to load ${targetUrl}:`,
          err?.message
        );
        if (attempt === maxRetries) {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL(
              `data:text/html;charset=utf-8,${encodeURIComponent(`
                <!DOCTYPE html>
                <html>
                  <head>
                    <title>Dezign2App - Connection Failed</title>
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
                        padding: 24px;
                        box-sizing: border-box;
                        text-align: center;
                      }
                      .icon { font-size: 40px; margin-bottom: 16px; }
                      h2 { font-size: 20px; font-weight: 600; margin: 0 0 10px 0; color: #f87171; }
                      p { color: #8b949e; margin: 0 0 24px 0; font-size: 13px; max-width: 480px; line-height: 1.5; }
                      .btn {
                        background-color: #38bdf8;
                        color: #0d1117;
                        border: none;
                        padding: 10px 22px;
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
                    <h2>Application Service Unavailable</h2>
                    <p>Could not connect to the internal workspace engine at <code>${targetUrl}</code>. Please click Retry to reconnect.</p>
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

  // Directly navigate to /projects (bypassing landing/pricing/marketing pages)
  if (IS_DEV) {
    const devUrl = DEV_SERVER_URL.replace("localhost", "127.0.0.1");
    loadWithRetry(`${devUrl}/projects`, 12, 1200);
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
                padding: 24px;
                box-sizing: border-box;
              }
              .spinner {
                width: 40px;
                height: 40px;
                border: 3px solid rgba(255,255,255,0.08);
                border-top-color: #38bdf8;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                margin-bottom: 24px;
              }
              @keyframes spin { to { transform: rotate(360deg); } }
              h2 { font-weight: 500; font-size: 19px; margin: 0 0 8px 0; }
              p { color: #8b949e; margin: 0; font-size: 13px; max-width: 450px; text-align: center; line-height: 1.4; }
            </style>
          </head>
          <body>
            <div class="spinner"></div>
            <h2>Starting Dezign2App</h2>
            <p id="status-text">Initializing workspace...</p>
            <script>
              window.setStatus = (text) => {
                const el = document.getElementById("status-text");
                if (el) el.textContent = text;
              };
            </script>
          </body>
        </html>
      `)}`
    );

    const targetPort = await getAvailablePort(DEFAULT_PORT);

    const updateStatus = (text: string) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents
          .executeJavaScript(
            `if (window.setStatus) window.setStatus(${JSON.stringify(text)});`
          )
          .catch(() => {});
      }
    };

    startNextServer(targetPort, updateStatus)
      .then((port) => {
        loadWithRetry(`http://127.0.0.1:${port}/projects`, 8, 1000);
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
