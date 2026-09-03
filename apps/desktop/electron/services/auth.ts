import { app, shell } from "electron";
import path from "path";
import fs from "fs";
import { PROTOCOL_SCHEME, IS_DEV } from "../constants";
import { getMainWindow, getCurrentAppUrl } from "../window";

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
  if (!urlStr) {
    console.warn("[auth-service] handleAuthUrl called with empty urlStr");
    return;
  }
  console.log("[auth-service] handleAuthUrl received input:", urlStr);
  const match = urlStr.match(/dezign2app:\/\/[^\s"']+/i);
  if (!match) {
    console.warn("[auth-service] URL did not match dezign2app:// pattern:", urlStr);
    return;
  }
  const cleanUrl = match[0].replace(/\/$/, "");
  console.log("[auth-service] Clean auth deep link:", cleanUrl);

  try {
    const urlObj = new URL(cleanUrl);
    const token = urlObj.searchParams.get("token") || undefined;
    const ticket = urlObj.searchParams.get("ticket") || undefined;
    console.log("[auth-service] Parsed deep link params:", {
      hasToken: !!token,
      hasTicket: !!ticket,
      ticketPreview: ticket ? `${ticket.substring(0, 15)}...` : undefined,
    });

    const mainWindow = getMainWindow();
    if (!mainWindow) {
      console.error("[auth-service] getMainWindow() is null! Cannot deliver auth:callback.");
      return;
    }

    console.log("[auth-service] Sending auth:callback event to renderer...");
    mainWindow.webContents.send("auth:callback", {
      token,
      ticket,
      rawUrl: cleanUrl,
    });

    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } catch (err) {
    console.error("[auth-service] Failed to parse auth deep link URL:", err);
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

export async function openBrowserLogin(customUrl?: string): Promise<{ success: boolean }> {
  const authUrl =
    process.env.NEXT_PUBLIC_DESKTOP_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "";

  const loginUrl =
    customUrl ||
    `${authUrl}/sign-in?desktop=true&redirect_url=${encodeURIComponent(
      `${authUrl}/auth/desktop`
    )}`;

  console.log("[auth-service] Opening external browser for authentication:", loginUrl);
  try {
    await shell.openExternal(loginUrl);
    console.log("[auth-service] shell.openExternal succeeded");
    return { success: true };
  } catch (err) {
    console.error("[auth-service] Failed to open external browser:", err);
    return { success: false };
  }
}
