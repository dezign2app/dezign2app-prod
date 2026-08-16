import { app, utilityProcess, UtilityProcess } from "electron";
import path from "path";
import fs from "fs";

// ─────────────────────────────────────────────
//  Production Next.js Server Runner (utilityProcess)
// ─────────────────────────────────────────────
let nextUtilityProcess: UtilityProcess | null = null;

export function startNextServer(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const webAppPath = app.isPackaged
      ? path.join(process.resourcesPath, "web")
      : path.join(__dirname, "../../web");

    const runnerPath = path.join(__dirname, "../server-runner.js");

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

export function stopNextServer(): void {
  if (nextUtilityProcess) {
    try {
      nextUtilityProcess.kill();
    } catch (e) {
      console.warn("[main] Failed to kill Next.js server utilityProcess:", e);
    }
    nextUtilityProcess = null;
  }
}
