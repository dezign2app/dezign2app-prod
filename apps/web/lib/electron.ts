/**
 * Utility helpers for Electron environment detection.
 * Safe to import in both SSR (returns false on server) and browser contexts.
 */

/**
 * Returns true when the web app is running inside the Electron desktop shell.
 * Always false during SSR.
 */
export function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.electronAPI;
}

/**
 * Returns window.electronAPI if in Electron, otherwise null.
 * Use this for optional Electron-only features.
 */
export function getElectronAPI() {
  if (typeof window === "undefined") return null;
  return window.electronAPI ?? null;
}

/**
 * Safely opens a URL in the system browser.
 * Works seamlessly whether running inside the Electron Desktop app
 * or inside a standard web browser.
 */
export function openExternalUrl(
  url: string,
  e?: React.MouseEvent | React.SyntheticEvent | MouseEvent
) {
  if (e) {
    try {
      e.preventDefault?.();
      e.stopPropagation?.();
    } catch {}
  }
  if (!url) return;

  const targetUrl = /^[a-zA-Z]+:\/\//.test(url) ? url : `http://${url}`;

  const api = getElectronAPI();
  if (api?.shell?.openExternal) {
    api.shell.openExternal(targetUrl);
    return;
  }

  if (typeof window !== "undefined") {
    try {
      const win = window.open(targetUrl, "_blank", "noopener,noreferrer");
      if (win) return;
    } catch {
      /* popup blocker */
    }

    // Fallback: programmatic anchor click
    try {
      const a = document.createElement("a");
      a.href = targetUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.warn("Failed to open URL in browser:", err);
    }
  }
}

