import { useEffect } from "react";

/**
 * Checks if the event target or active DOM element is an editable input
 * to prevent shortcuts from firing while typing.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  if (
    target.closest(
      "input, textarea, select, [contenteditable='true'], [role='textbox'], [role='combobox'], .monaco-editor, [data-inspector], .inspector-sidebar, .nodrag",
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if the user is currently typing in an input field anywhere in the document.
 */
export function isTypingActive(e?: KeyboardEvent): boolean {
  if (e && isEditableTarget(e.target)) return true;
  if (
    typeof document !== "undefined" &&
    isEditableTarget(document.activeElement)
  ) {
    return true;
  }
  return false;
}

/**
 * Hook to register Shift + A (and Ctrl+Alt+L alias) keyboard shortcut for Auto Layout.
 * Strictly ignores any keystrokes when the user is focused inside an input box or editor.
 */
export function useAutoLayoutShortcut(
  onLayout: () => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      // Guard against typing in any input, textarea, monaco editor, or contenteditable
      if (isTypingActive(e)) {
        return;
      }

      // Shift + A (Figma standard)
      const isShiftA =
        e.shiftKey &&
        (e.key === "A" || e.key === "a") &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey;

      // Ctrl + Alt + L / Cmd + Option + L (developer IDE reformat alias)
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const isCtrlAltL =
        isCmdOrCtrl && e.altKey && e.key.toLowerCase() === "l";

      if (isShiftA || isCtrlAltL) {
        e.preventDefault();
        e.stopPropagation();
        onLayout();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onLayout, enabled]);
}
