"use client";

import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Terminal, useTerminal } from "@wterm/react";
import "@wterm/react/css";
import "@/lib/utils/patchResizeObserver";
import { cleanTerminalText } from "./terminalUtils";

export interface WTermTerminalHandle {
  write: (data: string) => void;
  clear: () => void;
  focus: () => void;
  resize: (cols: number, rows: number) => void;
}

export interface WTermTerminalProps {
  logs?: string[];
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  onReady?: () => void;
  theme?: "solarized-dark" | "monokai" | "light" | string;
  autoScroll?: boolean;
  className?: string;
  placeholder?: string;
  interactive?: boolean;
  rawStream?: boolean;
}

/**
 * Normalizes standalone \n to standard VT100/ANSI CRLF (\r\n).
 * Preserves standalone \r (carriage return) for in-place cursor overwrites.
 */
function formatTerminalChunk(raw: string): string {
  if (!raw) return "";
  return raw.replace(/(?<!\r)\n/g, "\r\n");
}

/**
 * Finds all scrollable elements within a root and its ancestors to preserve exact scroll positions.
 */
function captureScrollableElements(root: HTMLElement | null): Map<HTMLElement, { top: number; left: number }> {
  const map = new Map<HTMLElement, { top: number; left: number }>();
  if (!root) return map;

  const elements = [root, ...Array.from(root.querySelectorAll("*"))] as HTMLElement[];
  for (const el of elements) {
    if (
      el.scrollHeight > el.clientHeight ||
      el.scrollWidth > el.clientWidth ||
      el.scrollTop > 0 ||
      el.scrollLeft > 0
    ) {
      map.set(el, { top: el.scrollTop, left: el.scrollLeft });
    }
  }

  let parent = root.parentElement;
  while (parent) {
    if (
      parent.scrollHeight > parent.clientHeight ||
      parent.scrollWidth > parent.clientWidth ||
      parent.scrollTop > 0 ||
      parent.scrollLeft > 0
    ) {
      map.set(parent, { top: parent.scrollTop, left: parent.scrollLeft });
    }
    parent = parent.parentElement;
  }

  return map;
}

function restoreCapturedScrolls(map: Map<HTMLElement, { top: number; left: number }>) {
  map.forEach(({ top, left }, el) => {
    if (el.scrollTop !== top) el.scrollTop = top;
    if (el.scrollLeft !== left) el.scrollLeft = left;
  });
}

export const WTermTerminal = forwardRef<WTermTerminalHandle, WTermTerminalProps>(
  function WTermTerminal(
    {
      logs = [],
      onData,
      onResize,
      onReady,
      theme = "monokai",
      autoScroll = false,
      className = "",
      placeholder = "Terminal ready. Click to type commands.",
      interactive = true,
      rawStream = false,
    },
    forwardedRef,
  ) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const { ref: terminalRef, write, resize, focus } = useTerminal();
    const [isReady, setIsReady] = useState(false);
    const lastWrittenIndexRef = useRef<number>(0);
    const prevLogsRef = useRef<string[]>(logs);
    const logsRef = useRef<string[]>(logs);
    logsRef.current = logs;

    const mouseDownScrollMapRef = useRef<Map<HTMLElement, { top: number; left: number }> | null>(null);

    // Buffer for local shell echo when no external PTY is connected
    const inputBufferRef = useRef<string>("");

    const clearTerminal = useCallback(() => {
      try {
        write?.("\x1bc");
        lastWrittenIndexRef.current = 0;
        inputBufferRef.current = "";
      } catch (e) {
        console.error("[wterm] clear error:", e);
      }
    }, [write]);

    const focusTerminal = useCallback(() => {
      // Do not focus if interactive is false or if user is selecting text
      if (!interactive) return;

      const selection =
        typeof window !== "undefined" ? window.getSelection() : null;
      if (selection && selection.toString().length > 0) {
        return;
      }

      // Capture existing scroll positions so focus does not snap ancestor containers or buffer
      const scrollMap = captureScrollableElements(wrapperRef.current);

      try {
        const helperInput = wrapperRef.current?.querySelector(
          "textarea, input",
        ) as HTMLElement | null;
        if (helperInput && typeof helperInput.focus === "function") {
          helperInput.focus({ preventScroll: true });
        } else {
          focus?.();
        }
      } catch (e) {
        try {
          focus?.();
        } catch {}
      }

      if (!autoScroll) {
        restoreCapturedScrolls(scrollMap);
        requestAnimationFrame(() => restoreCapturedScrolls(scrollMap));
        setTimeout(() => restoreCapturedScrolls(scrollMap), 0);
        setTimeout(() => restoreCapturedScrolls(scrollMap), 40);
      }
    }, [focus, autoScroll, interactive]);

    // Expose handle methods to parent components
    useImperativeHandle(
      forwardedRef,
      () => ({
        write: (data: string) => {
          try {
            write?.(rawStream ? data : formatTerminalChunk(data));
          } catch (e) {
            console.error("[wterm] write error:", e);
          }
        },
        clear: clearTerminal,
        focus: focusTerminal,
        resize: (cols: number, rows: number) => {
          try {
            resize?.(cols, rows);
          } catch (e) {}
        },
      }),
      [write, clearTerminal, focusTerminal, resize, rawStream],
    );

    const handleReady = useCallback(() => {
      setIsReady(true);
      // Write any existing logs on initial ready in a single batch
      if (logsRef.current.length > 0 && write) {
        const fullContent = logsRef.current
          .map((line) => (rawStream ? line : formatTerminalChunk(line)))
          .join("");
        if (fullContent) {
          write(fullContent);
        }
        lastWrittenIndexRef.current = logsRef.current.length;
      }
      onReady?.();
      // Auto-focus terminal on initial mount ONLY if interactive and autoScroll enabled
      if (interactive && autoScroll) {
        setTimeout(() => {
          focusTerminal();
        }, 50);
      }
    }, [write, onReady, focusTerminal, rawStream, interactive, autoScroll]);

    // Synchronize incremental log writes & tab switches
    useEffect(() => {
      if (!isReady || !write) return;

      const prevLogs = prevLogsRef.current;
      prevLogsRef.current = logs;

      const scrollMap = !autoScroll
        ? captureScrollableElements(wrapperRef.current)
        : null;

      if (logs.length === 0) {
        if (lastWrittenIndexRef.current > 0) {
          clearTerminal();
        }
        return;
      }

      // Check if `logs` is an incremental extension of the previous array
      const isAppend =
        lastWrittenIndexRef.current > 0 &&
        logs.length >= lastWrittenIndexRef.current &&
        prevLogs.length > 0 &&
        logs[0] === prevLogs[0] &&
        logs[lastWrittenIndexRef.current - 1] ===
          prevLogs[lastWrittenIndexRef.current - 1];

      if (!isAppend) {
        // Tab switch, log replacement, or log reset: full refresh in a single batch
        clearTerminal();
        const batch = logs
          .map((line) => (rawStream ? line : formatTerminalChunk(line)))
          .join("");
        if (batch) {
          write(batch);
        }
        lastWrittenIndexRef.current = logs.length;
      } else {
        // Incremental new log lines in the same session: batch write
        const newEntries = logs.slice(lastWrittenIndexRef.current);
        if (newEntries.length > 0) {
          const batch = newEntries
            .map((line) => (rawStream ? line : formatTerminalChunk(line)))
            .join("");
          if (batch) {
            write(batch);
          }
          lastWrittenIndexRef.current = logs.length;
        }
      }

      // If autoScroll is disabled, preserve scroll position across incoming logs
      if (scrollMap && !autoScroll) {
        restoreCapturedScrolls(scrollMap);
        requestAnimationFrame(() => restoreCapturedScrolls(scrollMap));
      }
    }, [logs, isReady, write, clearTerminal, rawStream, autoScroll]);

    // Handle user typing and keystrokes
    const handleData = useCallback(
      (data: string) => {
        if (!interactive) return;

        // If parent provided custom onData (e.g. forwarding to node-pty)
        if (onData) {
          onData(data);
          return;
        }

        // Built-in standalone local echo & shell emulator (Web preview fallback)
        if (!write) return;

        // Enter key
        if (data === "\r" || data === "\n") {
          const cmd = inputBufferRef.current.trim();
          inputBufferRef.current = "";

          const lowerCmd = cmd.toLowerCase();
          let response = "\r\n";

          if (lowerCmd === "clear" || lowerCmd === "cls") {
            response = "\x1bc\x1b[32mblueprint\x1b[0m \x1b[34m❯\x1b[0m ";
          } else if (lowerCmd === "help") {
            response +=
              "\x1b[36mAvailable commands:\x1b[0m\r\n" +
              "  pnpm i / install - Install workspace dependencies\r\n" +
              "  pnpm dev         - Run all workspace apps with hot reload\r\n" +
              "  docker compose   - Run containerized stack\r\n" +
              "  clear / cls      - Clear terminal window\r\n" +
              "  help             - Show this help message\r\n\n" +
              "\x1b[32mblueprint\x1b[0m \x1b[34m❯\x1b[0m ";
          } else if (
            lowerCmd === "pnpm i" ||
            lowerCmd === "pnpm install" ||
            lowerCmd.startsWith("pnpm i ") ||
            lowerCmd.startsWith("pnpm install ") ||
            lowerCmd.startsWith("pnpm add ")
          ) {
            response +=
              "\x1b[90mResolving dependencies...\x1b[0m\r\n" +
              "\x1b[32m✔ Packages are up to date.\x1b[0m (Simulated workspace environment)\r\n\r\n" +
              "\x1b[32mblueprint\x1b[0m \x1b[34m❯\x1b[0m ";
          } else if (lowerCmd === "pnpm dev" || lowerCmd === "npm run dev") {
            response +=
              "\x1b[32m✔\x1b[0m Ready in 450ms\r\n" +
              "\x1b[36m▲ Next.js 16.0.10 (Turbopack)\x1b[0m\r\n" +
              "  - Local:   http://localhost:3000\r\n" +
              "  - Network: http://192.168.1.100:3000\r\n\r\n" +
              "\x1b[32mblueprint\x1b[0m \x1b[34m❯\x1b[0m ";
          } else if (cmd) {
            response += `\x1b[90mExecuted: ${cmd}\x1b[0m\r\n\x1b[32mblueprint\x1b[0m \x1b[34m❯\x1b[0m `;
          } else {
            response += "\x1b[32mblueprint\x1b[0m \x1b[34m❯\x1b[0m ";
          }

          // Single batched write to avoid multi-layout passes triggering ResizeObserver loops
          write(response);
          return;
        }

        // Backspace
        if (data === "\x7f" || data === "\b") {
          if (inputBufferRef.current.length > 0) {
            inputBufferRef.current = inputBufferRef.current.slice(0, -1);
            write("\b \b");
          }
          return;
        }

        // Ctrl+C
        if (data === "\x03") {
          inputBufferRef.current = "";
          write("^C\r\n\x1b[32mblueprint\x1b[0m \x1b[34m❯\x1b[0m ");
          return;
        }

        // Ctrl+L (Clear)
        if (data === "\x0c") {
          inputBufferRef.current = "";
          write("\x1bc\x1b[32mblueprint\x1b[0m \x1b[34m❯\x1b[0m ");
          return;
        }

        // Regular printable character
        inputBufferRef.current += data;
        write(data);
      },
      [interactive, onData, write],
    );

    // Mouse handlers to prevent copy selection from scrolling to bottom
    const handleMouseDown = useCallback(() => {
      mouseDownScrollMapRef.current = captureScrollableElements(wrapperRef.current);
    }, []);

    const handleMouseUp = useCallback(() => {
      const selection =
        typeof window !== "undefined" ? window.getSelection() : null;
      if (selection && selection.toString().length > 0) {
        // User selected text to copy: restore exact scroll position
        if (mouseDownScrollMapRef.current) {
          restoreCapturedScrolls(mouseDownScrollMapRef.current);
        }
      }
    }, []);

    const handleWrapperClick = useCallback(
      (e: React.MouseEvent) => {
        if (!interactive) return;

        const selection =
          typeof window !== "undefined" ? window.getSelection() : null;
        if (selection && selection.toString().length > 0) {
          e.stopPropagation();
          return;
        }
        focusTerminal();
      },
      [focusTerminal, interactive],
    );

    return (
      <div
        ref={wrapperRef}
        onClick={handleWrapperClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        className={`relative w-full h-full bg-[#090d13] text-[#e6edf3] font-mono select-text overflow-hidden cursor-text ${className}`}
        style={
          {
            "--term-bg": "#090d13",
            "--term-fg": "#e6edf3",
            "--term-cursor": "#38bdf8",
            "--term-selection": "rgba(56, 189, 248, 0.25)",
            "--term-font-family":
              "Consolas, 'Cascadia Code', 'Fira Code', 'Courier New', ui-monospace, monospace",
            "--term-font-size": "13px",
            "--term-line-height": "1.25",
          } as React.CSSProperties
        }
      >
        <Terminal
          ref={terminalRef}
          onReady={handleReady}
          onData={handleData}
          onResize={onResize}
          autoResize={true}
          cursorBlink={true}
          className="w-full h-full"
        />

        {logs.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-zinc-500 text-xs italic">
            {placeholder}
          </div>
        )}
      </div>
    );
  },
);
