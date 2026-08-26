"use client";

/**
 * Universal patch and error interceptor for ResizeObserver.
 * Defers ResizeObserver callbacks to requestAnimationFrame to prevent
 * "ResizeObserver loop completed with undelivered notifications" and
 * suppresses Next.js Turbopack dev error overlays for benign ResizeObserver events.
 */
type PatchedResizeObserverConstructor = typeof ResizeObserver & { __isPatched?: boolean };

if (typeof window !== "undefined") {
  const OriginalResizeObserver = window.ResizeObserver as PatchedResizeObserverConstructor | undefined;
  if (OriginalResizeObserver && !OriginalResizeObserver.__isPatched) {
    class PatchedResizeObserver extends OriginalResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        const wrappedCallback: ResizeObserverCallback = (entries, observer) => {
          window.requestAnimationFrame(() => {
            try {
              callback(entries, observer);
            } catch {
              // Benign resize notification loop suppression
            }
          });
        };
        super(wrappedCallback);
      }
    }
    (PatchedResizeObserver as PatchedResizeObserverConstructor).__isPatched = true;
    window.ResizeObserver = PatchedResizeObserver;
  }

  const isResizeObserverError = (msg: unknown): boolean => {
    if (typeof msg !== "string") return false;
    return (
      msg.includes("ResizeObserver loop completed with undelivered notifications") ||
      msg.includes("ResizeObserver loop limit exceeded") ||
      msg.includes("ResizeObserver")
    );
  };

  window.addEventListener(
    "error",
    (e: ErrorEvent) => {
      if (isResizeObserverError(e.message) || isResizeObserverError(e.error?.message)) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    },
    true,
  );

  window.addEventListener(
    "unhandledrejection",
    (e: PromiseRejectionEvent) => {
      const msg = e.reason?.message || String(e.reason);
      if (isResizeObserverError(msg)) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    },
    true,
  );
}
