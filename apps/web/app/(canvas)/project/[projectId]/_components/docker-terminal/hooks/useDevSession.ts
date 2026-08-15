"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { isElectron, getElectronAPI } from "@/lib/electron";
import { CompiledFile, CompiledMonorepoResult } from "@/lib/compiler";
import { ProcessStatus, TerminalTab } from "../types";
import { exportFilesToDirectory } from "../utils/terminalExportUtils";

interface UseDevSessionProps {
  projectId: string;
  outputDir: string;
  saveWorkspaceDir: (dir: string) => void;
  files: CompiledFile[];
  monorepoResult: CompiledMonorepoResult;
  activeTab?: TerminalTab;
}

export function useDevSession({
  projectId,
  outputDir,
  saveWorkspaceDir,
  files,
  monorepoResult,
  activeTab = "dev",
}: UseDevSessionProps) {
  const inElectron = isElectron();
  const [devLogs, setDevLogs] = useState<string[]>(() => {
    if (!inElectron) {
      return [
        `\x1b[36mDezign2App Dev Shell [Web Preview]\x1b[0m\r\n\x1b[90mWorkspace: ${outputDir || `/workspace/${projectId}`}\x1b[0m\r\n\x1b[90mClick "Run Dev" or type "pnpm dev" to launch all apps with hot reload.\x1b[0m\r\n\r\n\x1b[32mblueprint\x1b[0m \x1b[34m❯\x1b[0m `,
      ];
    }
    return [];
  });
  const [devStatus, setDevStatus] = useState<ProcessStatus>("idle");
  const [isExportingDev, setIsExportingDev] = useState<boolean>(false);

  const devDimensionsRef = useRef<{ cols: number; rows: number }>({ cols: 100, rows: 20 });
  const devIdRef = useRef<string>(`pty-dev-${projectId}`);
  const ptyCreatedRef = useRef<boolean>(false);
  const prevOutputDirRef = useRef<string>(outputDir);

  const handleDevResize = useCallback(
    (cols: number, rows: number) => {
      devDimensionsRef.current = { cols, rows };
      if (inElectron) {
        const api = getElectronAPI();
        api?.terminal?.resize?.(devIdRef.current, cols, rows);
      }
    },
    [inElectron],
  );

  // Initialize Interactive PTY Shell for Dev Session (Electron)
  useEffect(() => {
    if (!inElectron) return;
    const api = getElectronAPI();
    if (!api?.terminal?.create) return;

    const ptyId = devIdRef.current;
    const { cols, rows } = devDimensionsRef.current;

    // Only create PTY once per session
    if (!ptyCreatedRef.current) {
      ptyCreatedRef.current = true;
      api.terminal.create(ptyId, outputDir || "", cols, rows).then(() => {
        if (outputDir) {
          api?.terminal?.write?.(ptyId, `cd "${outputDir}"\r`);
        }
      });
    }

    const cleanupData = api.terminal.onData(ptyId, (data: string) => {
      setDevLogs((prev) => [...prev, data]);

      // Automatically infer process status from PTY ANSI stream
      if (
        data.includes("Starting Dev Mode") ||
        data.includes("Installing dependencies") ||
        data.includes("Launching all apps") ||
        data.includes("pnpm dev") ||
        data.includes("pnpm install") ||
        data.includes("next dev")
      ) {
        setDevStatus("starting");
      } else if (
        data.includes("Ready in") ||
        data.includes("ready on") ||
        data.includes("Local:") ||
        data.includes("http://localhost:") ||
        data.includes("compiled client and server") ||
        data.includes("Server running") ||
        data.includes("Application startup complete")
      ) {
        setDevStatus("running");
      } else if (data.includes("[Dev Session Exited]")) {
        setDevStatus("stopped");
      } else if (data.includes("ERR!") || data.includes("ELIFECYCLE") || data.includes("Command failed")) {
        setDevStatus("error");
      }
    });

    const cleanupExit = api.terminal.onExit(ptyId, () => {
      setDevStatus("stopped");
      setDevLogs((prev) => [...prev, "\r\n\x1b[31m[Dev Session Exited]\x1b[0m\r\n"]);
    });

    return () => {
      cleanupData();
      cleanupExit();
    };
  }, [inElectron, outputDir]);

  // Navigate PTY to new directory if user picks a different folder
  useEffect(() => {
    if (!inElectron || !ptyCreatedRef.current) return;
    if (outputDir && prevOutputDirRef.current !== outputDir) {
      prevOutputDirRef.current = outputDir;
      const api = getElectronAPI();
      api?.terminal?.write(devIdRef.current, `cd "${outputDir}"\r`);
    }
  }, [inElectron, outputDir]);

  // Browser Simulation: Dev Run
  const handleSimulateDevRun = useCallback(() => {
    const services = monorepoResult.services || [];
    const webClients = monorepoResult.webClients || [];

    setDevLogs((prev) => [
      ...prev,
      "pnpm install; pnpm dev\r\n",
      "\x1b[36m🚀 Starting Dev Mode (pnpm install; pnpm dev)\x1b[0m\r\n\n",
      "📦 \x1b[33m[1/2] Installing dependencies (pnpm install --frozen-lockfile=false)...\x1b[0m\r\n",
      "  Scope: all workspace packages\r\n",
      "  Progress: resolved 845, reused 845, downloaded 0\r\n",
      "  \x1b[32m✅ Dependencies installed successfully (2.4s)\x1b[0m\r\n\n",
      "🔥 \x1b[35m[2/2] Launching all apps with hot reload (pnpm dev)...\x1b[0m\r\n",
      "────────────────────────────────────────────────────────────\r\n",
      ...services.map(
        (s) =>
          `\x1b[34m[@workspace/${s.folderName}]\x1b[0m \x1b[32m⚡ Service online on http://localhost:8080\x1b[0m\r\n`,
      ),
      ...webClients.map(
        (w, idx) =>
          `\x1b[34m[@workspace/${w.folderName}]\x1b[0m \x1b[36m▲ Next.js ready on http://localhost:${idx === 0 ? "3000" : `${3000 + idx}`}\x1b[0m\r\n`,
      ),
      "\r\n\x1b[32m✨ All apps running natively with hot reload!\x1b[0m\r\n",
    ]);
    setDevStatus("running");
  }, [monorepoResult]);

  // Start Dev Server (pnpm install; pnpm dev) in live PTY
  const handleStartDev = useCallback(async () => {
    const api = getElectronAPI();
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

    if (inElectron && !targetDir) {
      targetDir = (await api?.fs?.pickDirectory?.()) || "";
      if (!targetDir) {
        toast.error("Please select a target folder to write and run the project");
        return;
      }
      saveWorkspaceDir(targetDir);
    }

    setIsExportingDev(true);
    setDevStatus("starting");

    if (inElectron && api?.terminal?.write) {
      try {
        // 1. Export updated files to workspace directory
        if (targetDir) {
          await exportFilesToDirectory(files, targetDir);
        }

        // 2. Ensure PTY is navigated to the workspace directory
        if (targetDir) {
          api.terminal.write(devIdRef.current, `cd "${targetDir}"\r`);
        }

        // 3. Execute pnpm install; pnpm dev (PowerShell uses ';' statement separator)
        const isWin =
          typeof navigator !== "undefined" &&
          (navigator.platform?.includes("Win") ||
            navigator.userAgent?.includes("Windows"));
        const devCmd = isWin ? "pnpm install; pnpm dev" : "pnpm install && pnpm dev";
        api.terminal.write(devIdRef.current, `${devCmd}\r`);
        toast.success("Starting dev stack in Dev Terminal...");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setDevLogs((prev) => [...prev, `\n❌ Error starting dev mode: ${msg}\n`]);
        setDevStatus("error");
        toast.error("Failed to start dev stack");
      } finally {
        setIsExportingDev(false);
      }
    } else {
      // Browser preview simulation
      setIsExportingDev(false);
      handleSimulateDevRun();
    }
  }, [inElectron, outputDir, projectId, saveWorkspaceDir, files, handleSimulateDevRun]);

  // Stop Dev Server (sends SIGINT / Ctrl+C to PTY)
  const handleStopDev = useCallback(() => {
    const api = getElectronAPI();
    if (inElectron && api?.terminal?.write) {
      api.terminal.write(devIdRef.current, "\x03\r\n");
      setDevStatus("stopped");
      toast.info("Stopped Dev server");
      setTimeout(() => {
        setDevStatus("idle");
      }, 1200);
    } else {
      setDevStatus("stopped");
      setDevLogs((prev) => [
        ...prev,
        "^C\r\n\x1b[31m[Dev Server Stopped]\x1b[0m\r\n\r\n\x1b[32mblueprint\x1b[0m \x1b[34m❯\x1b[0m ",
      ]);
      setTimeout(() => {
        setDevStatus("idle");
      }, 1200);
    }
  }, [inElectron]);

  const clearDevLogs = useCallback(() => {
    setDevLogs([]);
    setDevStatus("idle");
    if (inElectron) {
      const api = getElectronAPI();
      api?.terminal?.write(devIdRef.current, "\x0c");
    }
  }, [inElectron]);

  return {
    devLogs,
    setDevLogs,
    devStatus,
    setDevStatus,
    isExportingDev,
    devIdRef,
    handleDevResize,
    handleStartDev,
    handleStopDev,
    clearDevLogs,
  };
}
