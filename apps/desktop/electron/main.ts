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
import { spawn, execFile, ChildProcess } from "child_process";

// ─────────────────────────────────────────────
//  App Identity & Constants
// ─────────────────────────────────────────────
app.name = "D2A";
app.setName("D2A");
if (process.platform === "win32") {
  app.setAppUserModelId("com.dezign2app.desktop");
}

const DEV_SERVER_URL = process.env.ELECTRON_DEV_URL || "http://localhost:46500";
const IS_DEV = !app.isPackaged;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// Helper to find an open port dynamically (prevents EADDRINUSE)
function getAvailablePort(preferredPort: number = 46500): Promise<number> {
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
  for (const [, pty] of ptyMap.entries()) {
    try {
      pty.kill();
    } catch (e) {}
  }
  ptyMap.clear();
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

function getAppIcon(): string | undefined {
  const isWin = process.platform === "win32";
  const primaryExt = isWin ? "ico" : "png";
  const fallbackExt = isWin ? "png" : "ico";

  const searchPaths = [
    path.join(__dirname, `../public/icon.${primaryExt}`),
    path.join(__dirname, `../public/icon.${fallbackExt}`),
    path.join(__dirname, `../build/icon.${primaryExt}`),
    path.join(__dirname, `../build/icon.${fallbackExt}`),
    path.join(process.resourcesPath, `public/icon.${primaryExt}`),
    path.join(process.resourcesPath, `app/public/icon.${primaryExt}`),
    path.join(process.resourcesPath, `web/public/favicon.ico`),
    path.join(process.resourcesPath, `web/app/favicon.ico`),
  ];

  for (const p of searchPaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

async function createWindow() {
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

    const targetPort = await getAvailablePort(46500);

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
    if (url && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("mailto:"))) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ─────────────────────────────────────────────
//  IPC — Shell (External Browser Links)
// ─────────────────────────────────────────────
ipcMain.handle("shell:open-external", async (_event, url: string) => {
  if (url && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("mailto:"))) {
    shell.openExternal(url);
    return { success: true };
  }
  return { success: false };
});

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
      : "http://localhost:46500/sign-in?desktop=true");

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
    files: { filename: string; content: string }[],
    options?: { cleanStale?: boolean }
  ) => {
    if (!outputDir) {
      return { success: false, path: outputDir, writtenCount: 0, totalCount: 0 };
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    let writtenCount = 0;
    const currentFileSet = new Set<string>();

    for (const file of files) {
      const relativePath = file.filename.replace(/\\/g, "/");
      currentFileSet.add(relativePath);

      const fullPath = path.join(outputDir, relativePath);
      const targetDir = path.dirname(fullPath);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Check if file content changed before rewriting to minimize disk I/O and hot-reload watcher churn
      let needsWrite = true;
      if (fs.existsSync(fullPath)) {
        try {
          const existingContent = fs.readFileSync(fullPath, "utf-8");
          if (existingContent === file.content) {
            needsWrite = false;
          }
        } catch (e) {
          needsWrite = true;
        }
      }

      if (needsWrite) {
        fs.writeFileSync(fullPath, file.content, "utf-8");
        writtenCount++;
      }
    }

    // Optional safe cleanup of stale app folders if services were renamed/deleted on canvas
    if (options?.cleanStale) {
      try {
        const appsDir = path.join(outputDir, "apps");
        if (fs.existsSync(appsDir)) {
          const existingAppFolders = fs.readdirSync(appsDir, { withFileTypes: true });
          for (const item of existingAppFolders) {
            if (item.isDirectory() && !item.name.startsWith(".")) {
              const appPrefix = `apps/${item.name}/`;
              const hasMatchingFile = Array.from(currentFileSet).some((f) =>
                f.startsWith(appPrefix)
              );
              if (!hasMatchingFile) {
                // Stale app directory that is no longer in canvas project
                const staleFolderPath = path.join(appsDir, item.name);
                fs.rmSync(staleFolderPath, { recursive: true, force: true });
              }
            }
          }
        }
      } catch (err) {
        console.warn("[main] Stale folder cleanup warning:", err);
      }
    }

    return { success: true, path: outputDir, writtenCount, totalCount: files.length };
  }
);

// ─────────────────────────────────────────────
//  IPC — Docker runner
// ─────────────────────────────────────────────

/**
 * Runs a command and resolves with { ok, output }.
 * Never rejects — errors are returned as { ok: false, output: errorMessage }.
 */
function checkCommand(
  cmd: string,
  args: string[]
): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { shell: true, timeout: 10_000 }, (err, stdout, stderr) => {
      if (err) {
        resolve({ ok: false, output: stderr.trim() || err.message });
      } else {
        resolve({ ok: true, output: (stdout + stderr).trim() });
      }
    });
  });
}

/**
 * docker:preflight — runs environment checks and streams results as docker:log events.
 * Returns { ok: boolean } — if false, the caller must NOT proceed with docker:up.
 */
ipcMain.handle("docker:preflight", async (_event) => {
  const send = (line: string) =>
    mainWindow?.webContents.send("docker:log", line);

  send("🔍 Running pre-flight checks...\n");

  // ── 1. Node.js ──────────────────────────────
  send("  [1/3] Checking Node.js...\n");
  const nodeCheck = await checkCommand("node", ["--version"]);
  if (nodeCheck.ok) {
    send(`  ✅ Node.js: ${nodeCheck.output}\n`);
  } else {
    send(`  ❌ Node.js not found: ${nodeCheck.output}\n`);
    send("\n❌ Pre-flight failed: Node.js is required. Install it from https://nodejs.org\n");
    return { ok: false, reason: "node_missing" };
  }

  // ── 2. Docker CLI ───────────────────────────
  send("  [2/3] Checking Docker CLI...\n");
  const dockerVersionCheck = await checkCommand("docker", ["--version"]);
  if (dockerVersionCheck.ok) {
    send(`  ✅ Docker CLI: ${dockerVersionCheck.output}\n`);
  } else {
    send(`  ❌ Docker CLI not found: ${dockerVersionCheck.output}\n`);
    send("\n❌ Pre-flight failed: Docker is not installed or not in PATH.\n");
    send("   → Install Docker Desktop: https://www.docker.com/products/docker-desktop\n");
    return { ok: false, reason: "docker_missing" };
  }

  // ── 3. Docker Daemon ────────────────────────
  send("  [3/3] Checking Docker daemon...\n");
  const dockerInfoCheck = await checkCommand("docker", ["info", "--format", "{{.ServerVersion}}"]);
  if (dockerInfoCheck.ok) {
    send(`  ✅ Docker daemon running (server v${dockerInfoCheck.output})\n`);
  } else {
    send(`  ❌ Docker daemon not reachable: ${dockerInfoCheck.output}\n`);
    send("\n❌ Pre-flight failed: Docker daemon is not running.\n");
    send("   → Open Docker Desktop and wait until the whale icon stops animating.\n");
    return { ok: false, reason: "docker_daemon_down" };
  }

  send("\n✅ All pre-flight checks passed. Launching containers...\n\n");
  return { ok: true, reason: null };
});

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
//  IPC — Dev runner (infra + pnpm dev)
// ─────────────────────────────────────────────

let devProcess: ChildProcess | null = null;

/**
 * Runs a command to completion and returns { ok, output }.
 * stdout + stderr are concatenated into output.
 */
function runToCompletion(
  cmd: string,
  args: string[],
  cwd: string
): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const chunks: string[] = [];
    const proc = spawn(cmd, args, { cwd, shell: true });
    proc.stdout?.on("data", (d: Buffer) => chunks.push(d.toString()));
    proc.stderr?.on("data", (d: Buffer) => chunks.push(d.toString()));
    proc.on("close", (code) =>
      resolve({ ok: code === 0, output: chunks.join("") })
    );
    proc.on("error", (err: Error) =>
      resolve({ ok: false, output: err.message })
    );
  });
}

ipcMain.handle("dev:run", async (_event, projectDir: string) => {
  const send = (line: string) =>
    mainWindow?.webContents.send("dev:log", line);

  if (devProcess) {
    send("⚠️  Dev server is already running. Stop it first.\n");
    return { ok: false, reason: "already_running" };
  }

  send("🚀 Starting Dev Mode (pnpm install && pnpm dev)...\n\n");

  // ── 1. pnpm install ──────────────────────────
  send("📦 [1/2] Installing dependencies (pnpm install)...\n");
  const installResult = await runToCompletion("pnpm", ["install"], projectDir);
  if (installResult.output.trim()) send(installResult.output);
  if (!installResult.ok) {
    send("\n⚠️  pnpm install finished with warnings or errors.\n\n");
  } else {
    send("  ✅ Dependencies installed successfully.\n\n");
  }

  // ── 2. pnpm dev (long-running Turbo hot reload) ───────────────
  send("🔥 [2/2] Launching all apps with hot reload (pnpm dev)...\n");
  send("─".repeat(60) + "\n\n");

  devProcess = spawn("pnpm", ["dev"], { cwd: projectDir, shell: true });

  devProcess.stdout?.on("data", (data: Buffer) => {
    mainWindow?.webContents.send("dev:log", data.toString());
  });

  devProcess.stderr?.on("data", (data: Buffer) => {
    mainWindow?.webContents.send("dev:log", data.toString());
  });

  devProcess.on("close", (code: number | null) => {
    mainWindow?.webContents.send("dev:log", `\n🛑 Dev server exited (code ${code})\n`);
    devProcess = null;
  });

  devProcess.on("error", (err: Error) => {
    mainWindow?.webContents.send("dev:log", `\n❌ Failed to start dev: ${err.message}\n`);
    devProcess = null;
  });

  return { ok: true, reason: null };
});

ipcMain.on("dev:write", (_event, data: string) => {
  if (devProcess?.stdin?.writable) {
    devProcess.stdin.write(data);
  }
});

ipcMain.on("docker:write", (_event, data: string) => {
  if (dockerProcess?.stdin?.writable) {
    dockerProcess.stdin.write(data);
  }
});

ipcMain.on("dev:stop", (_event, _projectDir: string) => {
  const send = (line: string) =>
    mainWindow?.webContents.send("dev:log", line);

  if (devProcess) {
    devProcess.kill("SIGTERM");
    devProcess = null;
    send("\n🛑 Stopped dev server (pnpm dev).\n");
  } else {
    send("\nℹ️  No running dev server found.\n");
  }
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

    // Clean up any existing PTY process with the same ID
    if (ptyMap.has(id)) {
      try {
        ptyMap.get(id)?.kill();
      } catch (e) {}
      ptyMap.delete(id);
    }

    let targetCwd = app.getPath("home");
    if (cwd && typeof cwd === "string" && cwd.trim()) {
      try {
        fs.mkdirSync(cwd.trim(), { recursive: true });
        targetCwd = cwd.trim();
      } catch (e) {
        console.warn("[main] Failed to prepare terminal cwd:", cwd, e);
      }
    }

    const shellArgs =
      process.platform === "win32"
        ? ["-NoLogo", "-ExecutionPolicy", "Bypass"]
        : [];

    const ptyProcess = pty.spawn(shell, shellArgs, {
      name: "xterm-color",
      cols: cols || 80,
      rows: rows || 24,
      cwd: targetCwd,
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
  try {
    ptyMap.get(id)?.kill();
  } catch (e) {}
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
