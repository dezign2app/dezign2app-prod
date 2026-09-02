import { app, utilityProcess, UtilityProcess } from "electron";
import path from "path";
import fs from "fs";

// ─────────────────────────────────────────────
//  Production Next.js Server Runner (utilityProcess)
// ─────────────────────────────────────────────
let nextUtilityProcess: UtilityProcess | null = null;

export async function startNextServer(
  port: number,
  onStatus?: (status: string) => void
): Promise<number> {
  const webAppPath = app.isPackaged
    ? path.join(process.resourcesPath, "web")
    : path.join(__dirname, "../../web");

  const runnerPath = path.join(__dirname, "../server-runner.js");

  onStatus?.("Starting internal application engine...");
  console.log("[main] Target webAppPath:", webAppPath);
  console.log("[main] Runner path:", runnerPath);
  console.log("[main] Target dynamic port:", port);

  if (!fs.existsSync(webAppPath)) {
    const err = new Error(
      `Web app bundle directory not found at: ${webAppPath}`
    );
    console.error("[main]", err);
    throw err;
  }

  return new Promise((resolve, reject) => {
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
      let stderrAccumulator = "";
      let fallbackTimer: NodeJS.Timeout | null = null;

      const finishSuccess = () => {
        if (!resolved) {
          resolved = true;
          if (fallbackTimer) clearTimeout(fallbackTimer);
          resolve(port);
        }
      };

      const onData = (data: Buffer) => {
        const msg = data.toString();
        console.log("[next-server]", msg);
        if (
          !resolved &&
          (msg.includes("Ready") ||
            msg.includes("started server") ||
            msg.includes("Listening on") ||
            msg.includes("http://localhost") ||
            msg.includes("http://127.0.0.1") ||
            msg.includes("Local:") ||
            msg.includes("Network:"))
        ) {
          onStatus?.("Connecting to workspace...");
          finishSuccess();
        }
      };

      const onErrorData = (data: Buffer) => {
        const msg = data.toString();
        console.error("[next-server:err]", msg);
        stderrAccumulator += msg;
      };

      nextUtilityProcess.stdout?.on("data", onData);
      nextUtilityProcess.stderr?.on("data", onErrorData);

      nextUtilityProcess.on("exit", (code) => {
        console.log("[next-server] Process exited with code:", code);
        if (!resolved) {
          resolved = true;
          if (fallbackTimer) clearTimeout(fallbackTimer);
          reject(
            new Error(
              `Next.js server exited unexpectedly with code ${code}.\n${
                stderrAccumulator ? `Errors:\n${stderrAccumulator}` : ""
              }`
            )
          );
        }
      });

      // Fallback: if server doesn't print explicit Ready but stays running, resolve after 3s
      fallbackTimer = setTimeout(() => {
        finishSuccess();
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

