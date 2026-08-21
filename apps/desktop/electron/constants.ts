import { app } from "electron";
import path from "path";
import fs from "fs";
import net from "net";

// ─────────────────────────────────────────────
//  App Identity & Constants
// ─────────────────────────────────────────────
export const APP_NAME = "D2A";
export const APP_USER_MODEL_ID = "com.dezign2app.desktop";
export const PROTOCOL_SCHEME = "dezign2app";

export const DEV_SERVER_URL =
  process.env.ELECTRON_DEV_URL || "http://127.0.0.1:46500";
export const IS_DEV = !app.isPackaged;
export const DEFAULT_PORT = 46500;

/**
 * Finds an available open port dynamically (prevents EADDRINUSE).
 */
export function getAvailablePort(preferredPort: number = DEFAULT_PORT): Promise<number> {
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

/**
 * Locates the application icon across common production and dev locations.
 */
export function getAppIcon(): string | undefined {
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
