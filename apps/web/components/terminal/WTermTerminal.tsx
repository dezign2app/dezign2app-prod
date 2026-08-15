"use client";

import React, { useEffect, useRef, useCallback, useState, useImperativeHandle, forwardRef } from "react";
import { Terminal, useTerminal } from "@wterm/react";
import "@wterm/react/css";

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
 * Preserves standalone \r (carriage return) for in-place cursor overwrites and does NOT append trailing newlines to raw keystroke echoes.
 */
function formatTerminalChunk(raw: string): string {
  if (!raw) return "";
  return raw.replace(/(?<!\r)\n/g, "\r\n");
}

export const WTermTerminal = forwardRef<WTermTerminalHandle, WTermTerminalProps>(
  function WTermTerminal(
    {
      logs = [],
      onData,
      onResize,
      onReady,
      theme = "monokai",
      autoScroll = true,
      className = "",
      placeholder = "Terminal ready. Click to type commands.",
      interactive = true,
      rawStream = false,
    },
    forwardedRef,
  ) {
    const { ref: terminalRef, write, resize, focus } = useTerminal();
    const [isReady, setIsReady] = useState(false);
    const lastWrittenIndexRef = useRef<number>(0);
    const prevLogsRef = useRef<string[]>(logs);
    const logsRef = useRef<string[]>(logs);
    logsRef.current = logs;

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
      try {
        focus?.();
      } catch (e) {}
    }, [focus]);

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
      // Write any existing logs on initial ready
      if (logsRef.current.length > 0 && write) {
        logsRef.current.forEach((line) => {
          write(rawStream ? line : formatTerminalChunk(line));
        });
        lastWrittenIndexRef.current = logsRef.current.length;
      }
      onReady?.();
      // Auto-focus terminal on mount
      setTimeout(() => {
        focusTerminal();
      }, 50);
    }, [write, onReady, focusTerminal, rawStream]);

    // Synchronize incremental log writes & tab switches
    useEffect(() => {
      if (!isReady || !write) return;

      const prevLogs = prevLogsRef.current;
      prevLogsRef.current = logs;

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
        logs[lastWrittenIndexRef.current - 1] === prevLogs[lastWrittenIndexRef.current - 1];

      if (!isAppend) {
        // Tab switch, log replacement, or log reset: full refresh
        clearTerminal();
        logs.forEach((line) => {
          write(rawStream ? line : formatTerminalChunk(line));
        });
        lastWrittenIndexRef.current = logs.length;
      } else {
        // Incremental new log lines in the same session
        const newEntries = logs.slice(lastWrittenIndexRef.current);
        if (newEntries.length > 0) {
          newEntries.forEach((line) => {
            write(rawStream ? line : formatTerminalChunk(line));
          });
          lastWrittenIndexRef.current = logs.length;
        }
      }
    }, [logs, isReady, write, clearTerminal, rawStream]);

    // Handle user typing and keystrokes
    const handleData = useCallback(
      (data: string) => {
        if (!interactive) return;

        // If parent provided custom onData (e.g. forwarding to node-pty or child process stdin)
        if (onData) {
          onData(data);
          return;
        }

        // Built-in standalone local echo & shell emulator
        if (!write) return;

        // Enter key
        if (data === "\r" || data === "\n") {
          const cmd = inputBufferRef.current.trim();
          inputBufferRef.current = "";
          write("\r\n");

          if (cmd === "clear" || cmd === "cls") {
            write("\x1bc");
          } else if (cmd === "help") {
            write("\x1b[36mAvailable commands:\x1b[0m\r\n");
            write("  pnpm dev       - Run all workspace apps with hot reload\r\n");
            write("  pnpm install   - Install all workspace dependencies\r\n");
            write("  docker compose - Run containerized stack\r\n");
            write("  clear / cls    - Clear terminal window\r\n");
            write("  help           - Show this help message\r\n\n");
          } else if (cmd) {
            write(`\x1b[90mExecuted: ${cmd}\x1b[0m\r\n`);
          }

          write("\x1b[32mblueprint\x1b[0m \x1b[34m❯\x1b[0m ");
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

    return (
      <div
        onClick={focusTerminal}
        className={`relative w-full h-full bg-[#090d13] text-[#e6edf3] font-mono select-text overflow-hidden cursor-text ${className}`}
        style={
          {
            "--term-bg": "#090d13",
            "--term-fg": "#e6edf3",
            "--term-cursor": "#38bdf8",
            "--term-selection": "rgba(56, 189, 248, 0.25)",
            "--term-font-family": "Consolas, 'Cascadia Code', 'Fira Code', 'Courier New', ui-monospace, monospace",
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
