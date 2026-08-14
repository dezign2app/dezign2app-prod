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
