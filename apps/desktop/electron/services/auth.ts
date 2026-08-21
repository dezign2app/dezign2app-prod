import { app, shell } from "electron";
import path from "path";
import fs from "fs";
import { PROTOCOL_SCHEME, IS_DEV } from "../constants";
import { getMainWindow } from "../window";

/**
 * Registers custom protocol client (dezign2app://) for browser OAuth redirect.
 */
export function registerProtocolClient(): void {
  if (process.defaultApp || IS_DEV) {
    const packagedExe = path.join(
      __dirname,
      "../../release/win-unpacked/D2A.exe"
    );
    if (fs.existsSync(packagedExe)) {
      app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, packagedExe);
    } else {
      const mainScript = process.argv[1];
      if (mainScript) {
        app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [
          path.resolve(mainScript),
        ]);
      }
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME);
  }
}

/**
 * Handles incoming auth deep links (dezign2app://...).
 */
export function handleAuthUrl(urlStr: string): void {
  if (!urlStr) return;
  const match = urlStr.match(/dezign2app:\/\/[^\s"']+/i);
  if (!match) return;
  const cleanUrl = match[0].replace(/\/$/, "");
  console.log("[main] Received auth deep link:", cleanUrl);

  try {
    const urlObj = new URL(cleanUrl);
    const token = urlObj.searchParams.get("token") || undefined;
    const ticket = urlObj.searchParams.get("ticket") || undefined;

    const mainWindow = getMainWindow();
    mainWindow?.webContents.send("auth:callback", {
      token,
      ticket,
      rawUrl: cleanUrl,
    });

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  } catch (err) {
    console.error("[main] Failed to parse auth deep link URL:", err);
  }
}

/**
 * Checks command line args for initial deep link on startup.
 */
export function handleInitialDeepLink(): void {
  const initialDeepLink = process.argv.find((arg) =>
    arg.toLowerCase().includes("dezign2app://")
  );
  if (initialDeepLink) {
    setTimeout(() => handleAuthUrl(initialDeepLink), 1000);
  }
}

/**
 * Opens system browser to initiate OAuth login flow.
 */
export async function openBrowserLogin(customUrl?: string): Promise<{ success: boolean }> {
  const loginUrl =
    customUrl ||
    (process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/sign-in?desktop=true`
      : "http://localhost:46500/sign-in?desktop=true");

  shell.openExternal(loginUrl);
  return { success: true };
}
