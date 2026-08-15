"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { isElectron, getElectronAPI } from "@/lib/electron";
import { CompiledFile, CompiledMonorepoResult } from "@/lib/compiler";
import { ProcessStatus } from "../types";
import { exportFilesToDirectory } from "../utils/terminalExportUtils";

interface UseDevSessionProps {
  projectId: string;
  outputDir: string;
  saveWorkspaceDir: (dir: string) => void;
  files: CompiledFile[];
  monorepoResult: CompiledMonorepoResult;
}

export function useDevSession({
  projectId,
  outputDir,
  saveWorkspaceDir,
  files,
  monorepoResult,
}: UseDevSessionProps) {
  const inElectron = isElectron();
  const [devLogs, setDevLogs] = useState<string[]>([]);
  const [devStatus, setDevStatus] = useState<ProcessStatus>("idle");
  const [isExportingDev, setIsExportingDev] = useState<boolean>(false);

  // Hook into Electron Dev logs (pnpm i && pnpm dev)
  useEffect(() => {
    if (!inElectron) return;
    const api = getElectronAPI();
    if (!api?.dev?.onLog) return;

    const cleanup = api.dev.onLog((line: string) => {
      setDevLogs((prev) => [...prev, line]);

      if (
        line.includes("Starting Dev Mode") ||
        line.includes("Installing dependencies") ||
        line.includes("Launching all apps")
      ) {
        setDevStatus("starting");
      } else if (
        line.includes("Ready in") ||
        line.includes("ready on") ||
        line.includes("Local:") ||
        line.includes("http://localhost:") ||
        line.includes("compiled client and server successfully") ||
        line.includes("Server running") ||
        line.includes("Application startup complete")
      ) {
        setDevStatus("running");
      } else if (line.includes("Stopped") || line.includes("exited")) {
        setDevStatus("stopped");
      } else if (line.includes("Failed") || line.includes("ERROR") || line.includes("error")) {
        setDevStatus("error");
      }
    });

    return cleanup;
  }, [inElectron]);

  // Browser Simulation: Dev Run (pnpm i && pnpm dev)
  const handleSimulateDevRun = useCallback(() => {
    const services = monorepoResult.services || [];
    const webClients = monorepoResult.webClients || [];

    setDevLogs([
      "\x1b[36m🚀 Starting Dev Mode (pnpm install && pnpm dev)\x1b[0m\r\n\n",
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

  // Dev Server Runner (pnpm i && pnpm dev)
  const handleStartDev = useCallback(async () => {
    const api = getElectronAPI();
    if (inElectron && (!api?.dev?.run || !api?.fs?.writeProject)) return;

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
    setDevLogs([]);

    if (inElectron && api?.dev?.run) {
      try {
        // 1. Export files
        await exportFilesToDirectory(files, targetDir, setDevLogs);

        // 2. Run dev server (pnpm install && pnpm dev)
        await api.dev.run(targetDir);
        toast.success("Starting dev stack with hot reload...");
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

  const handleStopDev = useCallback(() => {
    const api = getElectronAPI();
    if (inElectron && api?.dev?.stop && outputDir) {
      api.dev.stop(outputDir);
      setDevStatus("stopped");
      toast.info("Stopping dev server...");
    } else {
      setDevStatus("stopped");
      setDevLogs((prev) => [...prev, "\n🛑 Dev server stopped.\n"]);
    }
  }, [inElectron, outputDir]);

  const clearDevLogs = useCallback(() => {
    setDevLogs([]);
    setDevStatus("idle");
  }, []);

  return {
    devLogs,
    setDevLogs,
    devStatus,
    setDevStatus,
    isExportingDev,
    handleStartDev,
    handleStopDev,
    clearDevLogs,
  };
}
