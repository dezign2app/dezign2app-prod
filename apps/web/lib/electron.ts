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
export function openExternalUrl(url: string, e?: React.MouseEvent | React.SyntheticEvent) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  if (!url) return;

  const api = getElectronAPI();
  if (api?.shell?.openExternal) {
    api.shell.openExternal(url);
  } else if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

