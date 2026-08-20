import { useEffect } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { BackendCanvasView } from "@/types/canvas";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  if (target.closest(".monaco-editor") || target.closest("[contenteditable='true']")) {
    return true;
  }

  return false;
}

export function useCanvasKeyboardShortcuts(
  enabled = true,
  activeView?: BackendCanvasView,
): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (isEditableTarget(e.target)) {
        return;
      }

      const isMac =
        typeof navigator !== "undefined" &&
        /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (!isCmdOrCtrl) return;

      const key = e.key.toLowerCase();

      // Undo: Cmd+Z / Ctrl+Z (without Shift)
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        const store = useBackendCanvasStore.getState();
        const currentView = activeView || store.canvasView || "graph";
        if (currentView === "schema") {
          store.undoSchema();
        } else {
          store.undoGraph();
        }
        return;
      }

      // Redo: Cmd+Shift+Z / Ctrl+Shift+Z OR Ctrl+Y
      if ((key === "z" && e.shiftKey) || (!isMac && key === "y")) {
        e.preventDefault();
        const store = useBackendCanvasStore.getState();
        const currentView = activeView || store.canvasView || "graph";
        if (currentView === "schema") {
          store.redoSchema();
        } else {
          store.redoGraph();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, activeView]);
}

