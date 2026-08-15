"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { isElectron, getElectronAPI } from "@/lib/electron";
import { CompiledFile, CompiledMonorepoResult } from "@/lib/compiler";
import { ProcessStatus, ServiceEndpoint } from "../types";
import { exportFilesToDirectory } from "../utils/terminalExportUtils";

interface UseDockerSessionProps {
  projectId: string;
  outputDir: string;
  saveWorkspaceDir: (dir: string) => void;
  files: CompiledFile[];
  monorepoResult: CompiledMonorepoResult;
  serviceEndpoints: ServiceEndpoint[];
}

export function useDockerSession({
  projectId,
  outputDir,
  saveWorkspaceDir,
  files,
  monorepoResult,
  serviceEndpoints,
}: UseDockerSessionProps) {
  const inElectron = isElectron();
  const [dockerLogs, setDockerLogs] = useState<string[]>([]);
  const [dockerStatus, setDockerStatus] = useState<ProcessStatus>("idle");
  const [isExportingDocker, setIsExportingDocker] = useState<boolean>(false);

  // Hook into Electron Docker logs
  useEffect(() => {
    if (!inElectron) return;
    const api = getElectronAPI();
    if (!api?.docker?.onLog) return;

    const cleanup = api.docker.onLog((line: string) => {
      setDockerLogs((prev) => [...prev, line]);

      if (line.includes("Building") || line.includes("Step ") || line.includes("build")) {
        setDockerStatus("building");
      } else if (
        line.includes("operational at") ||
        line.includes("Started") ||
        line.includes("running on") ||
        line.includes("Ready on") ||
        line.includes("Application startup complete") ||
        line.includes("healthy")
      ) {
        setDockerStatus("running");
      } else if (line.includes("Stopped") || line.includes("exited with code 0")) {
        setDockerStatus("stopped");
      } else if (line.includes("Failed") || line.includes("ERROR") || line.includes("error")) {
        setDockerStatus("error");
      }
    });

    return cleanup;
  }, [inElectron]);

  // Browser Simulation: Docker Run
  const handleSimulateDockerRun = useCallback(() => {
    const services = monorepoResult.services || [];
    const webClients = monorepoResult.webClients || [];

    setDockerLogs([
      "\x1b[36m🚀 [Preview] docker compose up --build\x1b[0m\r\n",
      "🐳 Building multi-stage container images with BuildKit...\r\n",
      ...services.map(
        (s) =>
          `\x1b[34m[+]\x1b[0m Building ${s.folderName} (Dockerfile: apps/${s.folderName}/Dockerfile) [3.2s] \x1b[32mDONE\x1b[0m\r\n`,
      ),
      ...webClients.map(
        (w) =>
          `\x1b[34m[+]\x1b[0m Building ${w.folderName} (Dockerfile: apps/${w.folderName}/Dockerfile) [4.1s] \x1b[32mDONE\x1b[0m\r\n`,
      ),
      "📦 Creating network blueprint-network...\r\n",
      "📦 Creating container postgres...\r\n",
      "📦 Creating container redis...\r\n",
      ...services.map((s) => `📦 Creating container ${s.folderName}...\r\n`),
      ...webClients.map((w) => `📦 Creating container ${w.folderName}...\r\n`),
      "\x1b[32m✅ Containers healthy and online:\x1b[0m\r\n",
      ...serviceEndpoints.map((ep) => `   ⚡ ${ep.name} -> ${ep.url}\r\n`),
    ]);
    setDockerStatus("running");
  }, [monorepoResult, serviceEndpoints]);

  // Docker Build Runner (Production)
  const handleStartDocker = useCallback(async () => {
    const api = getElectronAPI();
    if (inElectron && (!api?.docker?.up || !api?.fs?.writeProject)) return;

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
        toast.error("Please select a target folder to write project files");
        return;
      }
      saveWorkspaceDir(targetDir);
    }

    setIsExportingDocker(true);
    setDockerStatus("building");
    setDockerLogs([]);

    if (inElectron && api?.docker?.up) {
      try {
        // 1. Preflight
        const preflight = await api.docker.preflight();
        if (!preflight.ok) {
          setDockerStatus("error");
          toast.error("Pre-flight check failed. See terminal for details.");
          return;
        }

        // 2. Export files
        await exportFilesToDirectory(files, targetDir, setDockerLogs);

        // 3. docker compose up --build
        setDockerLogs((prev) => [...prev, `🚀 Running: docker compose up --build\n`]);
        api.docker.up(targetDir);
        toast.success("Docker containers building and starting...");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setDockerLogs((prev) => [...prev, `\n❌ Error starting Docker: ${msg}\n`]);
        setDockerStatus("error");
        toast.error("Failed to start Docker runner");
      } finally {
        setIsExportingDocker(false);
      }
    } else {
      // Browser preview simulation
      setIsExportingDocker(false);
      handleSimulateDockerRun();
    }
  }, [inElectron, outputDir, projectId, saveWorkspaceDir, files, handleSimulateDockerRun]);

  const handleStopDocker = useCallback(() => {
    const api = getElectronAPI();
    if (inElectron && api?.docker?.down && outputDir) {
      api.docker.down(outputDir);
      setDockerStatus("stopped");
      toast.info("Stopping Docker containers...");
    } else {
      setDockerStatus("stopped");
      setDockerLogs((prev) => [...prev, "\n🛑 Docker containers stopped.\n"]);
    }
  }, [inElectron, outputDir]);

  const clearDockerLogs = useCallback(() => {
    setDockerLogs([]);
    setDockerStatus("idle");
  }, []);

  return {
    dockerLogs,
    setDockerLogs,
    dockerStatus,
    setDockerStatus,
    isExportingDocker,
    handleStartDocker,
    handleStopDocker,
    clearDockerLogs,
  };
}
