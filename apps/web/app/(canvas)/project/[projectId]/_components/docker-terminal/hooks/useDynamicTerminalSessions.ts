"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { isElectron, getElectronAPI } from "@/lib/electron";
import { TerminalSession, TerminalType } from "../types";
import { useTerminalSessionStore } from "../stores/terminalSessionStore";

// Active IPC subscriptions tracker to prevent duplicate listeners across renders
const activeListeners = new Map<
  string,
  { dataCleanup: () => void; exitCleanup: () => void }
>();

/**
 * Returns shell-appropriate CD command syntax (supports cross-drive change in CMD & PowerShell).
 */
function getCdCommand(shell: string | undefined, dir: string): string {
  if (!dir || !dir.trim()) return "";
  const cleaned = dir.trim();
  const lower = (shell || "").toLowerCase();
  if (lower.includes("cmd.exe") || lower === "cmd") {
    return `cd /d "${cleaned}"\r`;
  }
  return `cd "${cleaned}"\r`;
}

interface UseDynamicTerminalSessionsProps {
  projectId: string;
  outputDir: string;
}

export function useDynamicTerminalSessions({
  projectId,
  outputDir,
}: UseDynamicTerminalSessionsProps) {
  const inElectron = isElectron();
  const store = useTerminalSessionStore();

  const sessions = store.sessionsByProject[projectId] || [];
  const activeSessionId = store.activeSessionIdByProject[projectId] || null;
  const activeSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0] || null;

  const terminalDimensionsRef = useRef<{ cols: number; rows: number }>({
    cols: 100,
    rows: 24,
  });

  const prevOutputDirRef = useRef<string>(outputDir);

  // Attach Electron IPC listeners for a given terminal session
  const attachPtyListeners = useCallback(
    (sessionId: string) => {
      if (!inElectron) return;
      const api = getElectronAPI();
      if (!api?.terminal?.onData) return;

      // Clean up previous listeners if any exist
      if (activeListeners.has(sessionId)) {
        const old = activeListeners.get(sessionId);
        old?.dataCleanup();
        old?.exitCleanup();
        activeListeners.delete(sessionId);
      }

      const dataCleanup = api.terminal.onData(sessionId, (data: string) => {
        store.appendLog(projectId, sessionId, data);
      });

      const exitCleanup = api.terminal.onExit(sessionId, (exitCode: number) => {
        store.updateSession(projectId, sessionId, { status: "stopped" });
        store.appendLog(
          projectId,
          sessionId,
          `\r\n\x1b[33m[Process exited with code ${exitCode}]\x1b[0m\r\n`,
        );
      });

      activeListeners.set(sessionId, { dataCleanup, exitCleanup });
    },
    [inElectron, projectId, store],
  );

  // Create a new dynamic terminal session of user's choice
  const createTerminal = useCallback(
    async (options?: {
      title?: string;
      type?: TerminalType;
      shell?: string;
      initialCommand?: string;
    }) => {
      const type: TerminalType = options?.type || "shell";
      const isWin =
        typeof navigator !== "undefined" &&
        (navigator.platform?.includes("Win") ||
          navigator.userAgent?.includes("Windows"));

      let resolvedShell = options?.shell;
      if (!resolvedShell) {
        if (type === "powershell") resolvedShell = "powershell.exe";
        else if (type === "cmd") resolvedShell = "cmd.exe";
        else if (type === "bash") resolvedShell = "bash";
        else if (type === "zsh") resolvedShell = "zsh";
        else resolvedShell = isWin ? "powershell.exe" : "bash";
      }

      // Resolve workspace target directory with multi-level fallback
      let targetDir = outputDir;
      if (!targetDir && typeof window !== "undefined") {
        try {
          targetDir =
            localStorage.getItem(`workspace_dir_${projectId}`) ||
            localStorage.getItem(`docker_dir_${projectId}`) ||
            localStorage.getItem("blueprint_workspace_dir") ||
            "";
        } catch (e) {}
      }

      const currentSessions = store.getSessions(projectId);
      const nextIndex = currentSessions.length + 1;
      const defaultTitle =
        options?.title ||
        (type === "powershell"
          ? `PowerShell ${nextIndex}`
          : type === "cmd"
            ? `CMD ${nextIndex}`
            : type === "bash"
              ? `Bash ${nextIndex}`
              : `Terminal ${nextIndex}`);

      const sessionId = `pty-${projectId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const newSession: TerminalSession = {
        id: sessionId,
        title: defaultTitle,
        type,
        shell: resolvedShell,
        logs: !inElectron
          ? [
              `\x1b[36mDezign2App Terminal: ${defaultTitle} [Web Preview]\x1b[0m\r\n\x1b[90mWorkspace: ${targetDir || `/workspace/${projectId}`}\x1b[0m\r\n\x1b[90mType commands like "help", "pnpm dev", "clear".\x1b[0m\r\n\r\n\x1b[32mblueprint\x1b[0m \x1b[34m❯\x1b[0m `,
            ]
          : [],
        status: "running",
        detectedPorts: [],
        createdAt: Date.now(),
      };

      // Add to persistent store and make it active
      store.addSession(projectId, newSession);

      if (inElectron) {
        const api = getElectronAPI();
        if (api?.terminal?.create) {
          try {
            const { cols, rows } = terminalDimensionsRef.current;
            await api.terminal.create(
              sessionId,
              targetDir || "",
              cols,
              rows,
              resolvedShell,
            );
            attachPtyListeners(sessionId);

            // Execute cd into current workspace directory as the first command
            const cdCmd = getCdCommand(resolvedShell, targetDir);
            if (cdCmd) {
              setTimeout(() => {
                api?.terminal?.write?.(sessionId, cdCmd);
                if (options?.initialCommand) {
                  setTimeout(() => {
                    api?.terminal?.write?.(
                      sessionId,
                      `${options.initialCommand}\r`,
                    );
                  }, 120);
                }
              }, 200);
            } else if (options?.initialCommand) {
              setTimeout(() => {
                api?.terminal?.write?.(
                  sessionId,
                  `${options.initialCommand}\r`,
                );
              }, 200);
            }
          } catch (err) {
            console.error("Failed to spawn PTY:", err);
            store.updateSession(projectId, sessionId, { status: "error" });
            toast.error("Failed to spawn terminal process");
          }
        }
      }

      return sessionId;
    },
    [inElectron, outputDir, projectId, store, attachPtyListeners],
  );

  // Broadcast directory change to active terminals when user selects a new workspace folder
  useEffect(() => {
    if (!inElectron || !outputDir) return;
    if (prevOutputDirRef.current !== outputDir) {
      prevOutputDirRef.current = outputDir;
      const api = getElectronAPI();
      if (api?.terminal?.write && sessions.length > 0) {
        sessions.forEach((s) => {
          const cdCmd = getCdCommand(s.shell, outputDir);
          if (cdCmd) {
            api.terminal.write(s.id, cdCmd);
          }
        });
      }
    }
  }, [inElectron, outputDir, sessions]);

  // Close and terminate a specific terminal session
  const closeTerminal = useCallback(
    (sessionId: string) => {
      // 1. Clean up IPC listeners
      if (activeListeners.has(sessionId)) {
        const listeners = activeListeners.get(sessionId);
        listeners?.dataCleanup();
        listeners?.exitCleanup();
        activeListeners.delete(sessionId);
      }

      // 2. Kill underlying OS PTY process
      if (inElectron) {
        const api = getElectronAPI();
        api?.terminal?.kill?.(sessionId);
      }

      // 3. Remove from Zustand store
      store.removeSession(projectId, sessionId);
    },
    [inElectron, projectId, store],
  );

  // Write interactive keystroke data to active/target session
  const writeToSession = useCallback(
    (sessionId: string, data: string) => {
      if (inElectron) {
        const api = getElectronAPI();
        api?.terminal?.write?.(sessionId, data);
      }
    },
    [inElectron],
  );

  // Resize PTY dimensions on window/viewport resize
  const resizeSession = useCallback(
    (sessionId: string, cols: number, rows: number) => {
      terminalDimensionsRef.current = { cols, rows };
      if (inElectron) {
        const api = getElectronAPI();
        api?.terminal?.resize?.(sessionId, cols, rows);
      }
    },
    [inElectron],
  );

  // Clear logs & reset screen for a session
  const clearTerminal = useCallback(
    (sessionId: string) => {
      store.clearSessionLogs(projectId, sessionId);
      if (inElectron) {
        const api = getElectronAPI();
        api?.terminal?.write?.(sessionId, "\x0c");
      }
    },
    [inElectron, projectId, store],
  );

  // Rename a terminal session
  const renameTerminal = useCallback(
    (sessionId: string, newTitle: string) => {
      store.renameSession(projectId, sessionId, newTitle);
    },
    [projectId, store],
  );

  // Switch active tab
  const selectTerminal = useCallback(
    (sessionId: string) => {
      store.setActiveSession(projectId, sessionId);
    },
    [projectId, store],
  );

  // Gather all dynamically detected ports across active sessions
  const allDetectedPorts = sessions.flatMap((s) => s.detectedPorts || []);

  return {
    sessions,
    activeSessionId,
    activeSession,
    createTerminal,
    closeTerminal,
    selectTerminal,
    renameTerminal,
    clearTerminal,
    writeToSession,
    resizeSession,
    allDetectedPorts,
  };
}
