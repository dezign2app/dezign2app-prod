"use client";

import React, {
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

export interface XTermTerminalHandle {
  write: (data: string) => void;
  clear: () => void;
  focus: () => void;
  resize: (cols: number, rows: number) => void;
  fit: () => void;
  getText: () => string;
  getSelection: () => string;
}

export interface XTermTerminalProps {
  logs?: string[];
  placeholder?: string;
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  onReady?: () => void;
  className?: string;
  interactive?: boolean;
  rawStream?: boolean;
}

/**
 * Normalizes standalone \n to standard VT100/ANSI CRLF (\r\n).
 * Preserves standalone \r for in-place cursor overwrites.
 */
function formatTerminalChunk(raw: string): string {
  if (!raw) return "";
  return raw.replace(/(?<!\r)\n/g, "\r\n");
}

// GitHub Dark theme — matches the existing #090d13 background
const XTERM_THEME = {
  background: "#090d13",
  foreground: "#e6edf3",
  cursor: "#38bdf8",
  cursorAccent: "#090d13",
  selectionBackground: "rgba(56, 189, 248, 0.25)",
  selectionForeground: "#e6edf3",
  black: "#0d1117",
  red: "#ff7b72",
  green: "#3fb950",
  yellow: "#d29922",
  blue: "#58a6ff",
  magenta: "#bc8cff",
  cyan: "#39c5cf",
  white: "#b1bac4",
  brightBlack: "#6e7681",
  brightRed: "#ffa198",
  brightGreen: "#56d364",
  brightYellow: "#e3b341",
  brightBlue: "#79c0ff",
  brightMagenta: "#d2a8ff",
  brightCyan: "#56d4dd",
  brightWhite: "#f0f6fc",
};

export const XTermTerminal = forwardRef<XTermTerminalHandle, XTermTerminalProps>(
  function XTermTerminal(
    {
      logs,
      placeholder,
      onData,
      onResize,
      onReady,
      className = "",
      interactive = true,
      rawStream = false,
    },
    forwardedRef
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const prevLogsRef = useRef<string[]>([]);
    const lastWrittenIndexRef = useRef(0);

    // Always-current ref callbacks — avoids stale closures without causing re-mounts
    const onDataRef = useRef(onData);
    const onResizeRef = useRef(onResize);
    const onReadyRef = useRef(onReady);
    const interactiveRef = useRef(interactive);
    onDataRef.current = onData;
    onResizeRef.current = onResize;
    onReadyRef.current = onReady;
    interactiveRef.current = interactive;

    useEffect(() => {
      if (!containerRef.current || termRef.current) return;

      const term = new Terminal({
        theme: XTERM_THEME,
        fontFamily:
          "Consolas, 'Cascadia Code', 'Fira Code', 'Courier New', ui-monospace, monospace",
        fontSize: 13,
        lineHeight: 1.25,
        cursorBlink: interactive,
        cursorStyle: interactive ? "block" : "underline",
        allowProposedApi: true,
        scrollback: 5000,
        // PTY already sends CRLF — do NOT double-convert
        convertEol: false,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);
      term.open(containerRef.current);

      termRef.current = term;
      fitAddonRef.current = fitAddon;

      // If initial logs were passed to monitor terminal, write them
      if (logs && logs.length > 0) {
        const formatted = logs
          .map((line) => (rawStream ? line : formatTerminalChunk(line)))
          .join("");
        if (formatted) term.write(formatted);
        lastWrittenIndexRef.current = logs.length;
        prevLogsRef.current = logs;
      }

      // Fit after paint so container has real dimensions
      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
        } catch {
          /* ignore: may fire after unmount during HMR */
        }
        onReadyRef.current?.();
      });

      // Forward keystrokes upstream (to PTY or web simulator)
      const dataDispose = term.onData((data) => {
        if (!interactiveRef.current) return;
        onDataRef.current?.(data);
      });

      // Forward resize upstream so PTY tracks cols/rows
      const resizeDispose = term.onResize(({ cols, rows }) => {
        onResizeRef.current?.(cols, rows);
      });

      // Auto-fit whenever the container element changes size
      const ro = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          try {
            fitAddon.fit();
          } catch {
            /* ignore during unmount */
          }
        });
      });
      ro.observe(containerRef.current);

      return () => {
        ro.disconnect();
        dataDispose.dispose();
        resizeDispose.dispose();
        term.dispose();
        termRef.current = null;
        fitAddonRef.current = null;
        lastWrittenIndexRef.current = 0;
        prevLogsRef.current = [];
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Mount once — dispose on unmount only

    // Support passive/monitor terminals that pass logs[] (e.g. DockerTerminalMonitor)
    useEffect(() => {
      const term = termRef.current;
      if (!term || logs === undefined) return;

      if (logs.length === 0) {
        if (lastWrittenIndexRef.current > 0) {
          term.write("\x1bc");
          lastWrittenIndexRef.current = 0;
        }
        prevLogsRef.current = [];
        return;
      }

      const prevLogs = prevLogsRef.current;
      prevLogsRef.current = logs;

      const isAppend =
        lastWrittenIndexRef.current > 0 &&
        logs.length >= lastWrittenIndexRef.current &&
        prevLogs.length > 0 &&
        logs[0] === prevLogs[0];

      if (!isAppend) {
        // Full refresh
        term.write("\x1bc");
        const formatted = logs
          .map((line) => (rawStream ? line : formatTerminalChunk(line)))
          .join("");
        if (formatted) term.write(formatted);
        lastWrittenIndexRef.current = logs.length;
      } else {
        // Incremental append
        const newEntries = logs.slice(lastWrittenIndexRef.current);
        if (newEntries.length > 0) {
          const formatted = newEntries
            .map((line) => (rawStream ? line : formatTerminalChunk(line)))
            .join("");
          if (formatted) term.write(formatted);
          lastWrittenIndexRef.current = logs.length;
        }
      }
    }, [logs, rawStream]);

    const write = useCallback((data: string) => {
      termRef.current?.write(data);
    }, []);

    const clear = useCallback(() => {
      // ESC c = Full reset (RIS) — clears buffer and scroll history
      termRef.current?.write("\x1bc");
      lastWrittenIndexRef.current = 0;
      prevLogsRef.current = [];
    }, []);

    const focus = useCallback(() => {
      termRef.current?.focus();
    }, []);

    const fit = useCallback(() => {
      requestAnimationFrame(() => {
        try {
          fitAddonRef.current?.fit();
        } catch {
          /* noop */
        }
      });
    }, []);

    const resize = useCallback((cols: number, rows: number) => {
      // Manual resize for programmatic PTY sync (FitAddon handles visual resize)
      termRef.current?.resize(cols, rows);
    }, []);

    const getText = useCallback(() => {
      const term = termRef.current;
      if (!term) return "";
      // Prefer active text selection
      const sel = term.getSelection();
      if (sel.trim()) return sel.trim();
      // Fall back to full visible buffer content
      let text = "";
      const buf = term.buffer.active;
      for (let i = 0; i < buf.length; i++) {
        text += (buf.getLine(i)?.translateToString(true) ?? "") + "\n";
      }
      return text.trim();
    }, []);

    const getSelection = useCallback(() => {
      return termRef.current?.getSelection() ?? "";
    }, []);

    useImperativeHandle(
      forwardedRef,
      () => ({ write, clear, focus, resize, fit, getText, getSelection }),
      [write, clear, focus, resize, fit, getText, getSelection]
    );

    return (
      <div
        ref={containerRef}
        className={`relative w-full h-full overflow-hidden ${className}`}
        style={{ background: "#090d13" }}
      >
        {Boolean(placeholder) && (!logs || logs.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-zinc-500 text-xs italic z-10 px-4 text-center">
            {placeholder}
          </div>
        )}
      </div>
    );
  }
);
