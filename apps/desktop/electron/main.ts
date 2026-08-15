import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  dialog,
  utilityProcess,
  UtilityProcess,
} from "electron";
import path from "path";
import fs from "fs";
import net from "net";
import { spawn, ChildProcess } from "child_process";

// ─────────────────────────────────────────────
//  App Identity & Constants
// ─────────────────────────────────────────────
app.name = "D2A";
app.setName("D2A");
if (process.platform === "win32") {
  app.setAppUserModelId("com.dezign2app.desktop");
}

const DEV_SERVER_URL = process.env.ELECTRON_DEV_URL || "http://localhost:3000";
const IS_DEV = !app.isPackaged;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// Helper to find an open port dynamically (prevents EADDRINUSE)
function getAvailablePort(preferredPort: number = 3100): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(preferredPort, "127.0.0.1", () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
    server.on("error", () => {
      // Preferred port busy, ask OS for an available random port
      const fallbackServer = net.createServer();
      fallbackServer.listen(0, "127.0.0.1", () => {
        const { port } = fallbackServer.address() as net.AddressInfo;
        fallbackServer.close(() => resolve(port));
      });
    });
  });
}

// ─────────────────────────────────────────────
//  Production: spawn bundled Next.js server via Electron's official utilityProcess API
// ─────────────────────────────────────────────
let nextUtilityProcess: UtilityProcess | null = null;

function startNextServer(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const webAppPath = app.isPackaged
      ? path.join(process.resourcesPath, "web")
      : path.join(__dirname, "../../web");

    const runnerPath = path.join(__dirname, "server-runner.js");

    console.log("[main] Target webAppPath:", webAppPath);
    console.log("[main] Runner path:", runnerPath);
    console.log("[main] Target dynamic port:", port);

    if (!fs.existsSync(webAppPath)) {
      const err = new Error(
        `Web app bundle directory not found at: ${webAppPath}`
      );
      console.error("[main]", err);
      return reject(err);
    }

    try {
      nextUtilityProcess = utilityProcess.fork(runnerPath, [], {
        cwd: webAppPath,
        env: {
          ...process.env,
          NEXT_WEB_DIR: webAppPath,
          PORT: String(port),
          NODE_ENV: "production",
        },
        serviceName: "next-server",
        stdio: "pipe",
      });

      let resolved = false;

      const onData = (data: Buffer) => {
        const msg = data.toString();
        console.log("[next-server]", msg);
        if (
          !resolved &&
          (msg.includes("Ready") ||
            msg.includes("started server") ||
            msg.includes("http://localhost"))
        ) {
          resolved = true;
          resolve(port);
        }
      };

      nextUtilityProcess.stdout?.on("data", onData);
      nextUtilityProcess.stderr?.on("data", onData);

      nextUtilityProcess.on("exit", (code) => {
        console.log("[next-server] Process exited with code:", code);
      });

      // Fallback: resolve after 3s so UI displays
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(port);
        }
      }, 3000);
    } catch (err) {
      console.error("[main] Failed to fork utilityProcess:", err);
      reject(err);
    }
  });
}

app.on("before-quit", () => {
  nextUtilityProcess?.kill();
});

// Register custom protocol client (dezign2app://) for browser OAuth redirect
if (process.defaultApp || IS_DEV) {
  const packagedExe = path.join(__dirname, "../release/win-unpacked/D2A.exe");
  if (fs.existsSync(packagedExe)) {
    app.setAsDefaultProtocolClient("dezign2app", packagedExe);
  } else {
    const mainScript = process.argv[1];
    if (mainScript) {
      app.setAsDefaultProtocolClient("dezign2app", process.execPath, [
        path.resolve(mainScript),
      ]);
    }
  }
} else {
  app.setAsDefaultProtocolClient("dezign2app");
}

function handleAuthUrl(urlStr: string) {
  if (!urlStr || !urlStr.startsWith("dezign2app://")) return;
  console.log("[main] Received auth deep link:", urlStr);
  try {
    const urlObj = new URL(urlStr);
    const token = urlObj.searchParams.get("token") || undefined;
    const ticket = urlObj.searchParams.get("ticket") || undefined;

    mainWindow?.webContents.send("auth:callback", {
      token,
      ticket,
      rawUrl: urlStr,
    });

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  } catch (err) {
    console.error("[main] Failed to parse auth deep link URL:", err);
  }
}

// Handle initial deep link argument if launched with one on Windows
const initialDeepLink = process.argv.find((arg) =>
  arg.startsWith("dezign2app://")
);
if (initialDeepLink) {
  setTimeout(() => handleAuthUrl(initialDeepLink), 1500);
}

// ─────────────────────────────────────────────
//  Window management
// ─────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  const iconPath =
    process.platform === "win32"
      ? path.join(__dirname, "../public/icon.ico")
      : path.join(__dirname, "../public/icon.png");

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
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
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

    const targetPort = await getAvailablePort(3100);

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

  // Open external links in the system browser, not inside Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://localhost") || url.startsWith(DEV_SERVER_URL)) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ─────────────────────────────────────────────
//  App lifecycle & Global Error Handling
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

app.on("second-instance", (_event, commandLine) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
  const deepLink = commandLine.find((arg) => arg.startsWith("dezign2app://"));
  if (deepLink) {
    handleAuthUrl(deepLink);
  }
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  handleAuthUrl(url);
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ─────────────────────────────────────────────
//  IPC — Authentication (Browser OAuth flow)
// ─────────────────────────────────────────────
ipcMain.handle("auth:open-browser-login", async (_event, customUrl?: string) => {
  const loginUrl =
    customUrl ||
    (process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/sign-in?desktop=true`
      : "http://localhost:3000/sign-in?desktop=true");

  shell.openExternal(loginUrl);
  return { success: true };
});

// ─────────────────────────────────────────────
//  IPC — File system (write generated project)
// ─────────────────────────────────────────────
ipcMain.handle("fs:pick-directory", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: "Choose output folder for your project",
    properties: ["openDirectory", "createDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle(
  "fs:write-project",
  async (
    _event,
    outputDir: string,
    files: { filename: string; content: string }[]
  ) => {
    for (const file of files) {
      const fullPath = path.join(outputDir, file.filename);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, file.content, "utf-8");
    }
    return { success: true, path: outputDir };
  }
);

// ─────────────────────────────────────────────
//  IPC — Docker runner
// ─────────────────────────────────────────────
let dockerProcess: ChildProcess | null = null;

ipcMain.on("docker:up", (_event, projectDir: string) => {
  if (dockerProcess) {
    mainWindow?.webContents.send("docker:log", "⚠️  Docker is already running. Stop it first.\n");
    return;
  }

  mainWindow?.webContents.send("docker:log", `🚀 Starting: docker compose up --build in ${projectDir}\n`);

  dockerProcess = spawn("docker", ["compose", "up", "--build"], {
    cwd: projectDir,
    shell: true,
  });

  dockerProcess.stdout?.on("data", (data: Buffer) => {
    mainWindow?.webContents.send("docker:log", data.toString());
  });

  dockerProcess.stderr?.on("data", (data: Buffer) => {
    mainWindow?.webContents.send("docker:log", data.toString());
  });

  dockerProcess.on("close", (code: number | null) => {
    mainWindow?.webContents.send("docker:log", `\n✅ docker compose exited with code ${code}\n`);
    dockerProcess = null;
  });

  dockerProcess.on("error", (err: Error) => {
    mainWindow?.webContents.send("docker:log", `\n❌ Failed to start Docker: ${err.message}\n`);
    dockerProcess = null;
  });
});

ipcMain.on("docker:down", (_event, projectDir: string) => {
  if (!dockerProcess) {
    mainWindow?.webContents.send("docker:log", "ℹ️  No running Docker process found.\n");
    return;
  }
  // First try graceful docker compose down
  spawn("docker", ["compose", "down"], { cwd: projectDir, shell: true });
  dockerProcess.kill("SIGTERM");
  dockerProcess = null;
  mainWindow?.webContents.send("docker:log", "🛑 Stopped Docker Compose.\n");
});

// ─────────────────────────────────────────────
//  IPC — Terminal (node-pty)
// ─────────────────────────────────────────────
// We lazy-import node-pty so the app still starts even if native build fails
import type * as NodePty from "node-pty";
const ptyMap = new Map<string, NodePty.IPty>();

async function getPty(): Promise<typeof NodePty> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("node-pty") as typeof NodePty;
}

ipcMain.handle(
  "terminal:create",
  async (_event, id: string, cwd: string, cols: number, rows: number) => {
    const pty = await getPty();
    const shell =
      process.platform === "win32"
        ? "powershell.exe"
        : process.env.SHELL || "/bin/bash";

    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-color",
      cols: cols || 80,
      rows: rows || 24,
      cwd: cwd || app.getPath("home"),
      env: process.env as { [key: string]: string },
    });

    ptyProcess.onData((data: string) => {
      mainWindow?.webContents.send(`terminal:data:${id}`, data);
    });

    ptyProcess.onExit(({ exitCode }: { exitCode: number; signal?: number }) => {
      mainWindow?.webContents.send(`terminal:exit:${id}`, exitCode);
      ptyMap.delete(id);
    });

    ptyMap.set(id, ptyProcess);
    return { success: true };
  }
);

ipcMain.on("terminal:write", (_event, id: string, data: string) => {
  ptyMap.get(id)?.write(data);
});

ipcMain.on("terminal:resize", (_event, id: string, cols: number, rows: number) => {
  ptyMap.get(id)?.resize(cols, rows);
});

ipcMain.on("terminal:kill", (_event, id: string) => {
  ptyMap.get(id)?.kill();
  ptyMap.delete(id);
});

// ─────────────────────────────────────────────
//  IPC — Platform info
// ─────────────────────────────────────────────
ipcMain.handle("app:platform", () => process.platform);
ipcMain.handle("app:is-electron", () => true);

function registerIpcHandlers() {
  // Handlers are registered above at module level; this is just a hook for
  // any additional setup that needs the app to be ready.
}
