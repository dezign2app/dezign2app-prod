"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { isElectron, getElectronAPI } from "@/lib/electron";
import { CompiledFile, CompiledMonorepoResult } from "@/lib/compiler";
import { ProcessStatus, ServiceEndpoint, TerminalTab } from "../types";
import { exportFilesToDirectory } from "../utils/terminalExportUtils";

interface UseDockerSessionProps {
  projectId: string;
  outputDir: string;
  saveWorkspaceDir: (dir: string) => void;
  files: CompiledFile[];
  monorepoResult: CompiledMonorepoResult;
  serviceEndpoints: ServiceEndpoint[];
  activeTab?: TerminalTab;
}

export function useDockerSession({
  projectId,
  outputDir,
  saveWorkspaceDir,
  files,
  monorepoResult,
  serviceEndpoints,
  activeTab = "docker",
}: UseDockerSessionProps) {
  const inElectron = isElectron();
  const [dockerLogs, setDockerLogs] = useState<string[]>(() => {
    if (!inElectron) {
      return [
        `\x1b[36mDezign2App Docker Shell [Web Preview]\x1b[0m\r\n\x1b[90mWorkspace: ${outputDir || `/workspace/${projectId}`}\x1b[0m\r\n\x1b[90mClick "Docker Build" or type "docker compose up --build" to compile containers.\x1b[0m\r\n\r\n\x1b[32mblueprint\x1b[0m \x1b[34m❯\x1b[0m `,
      ];
    }
    return [];
  });
  const [dockerStatus, setDockerStatus] = useState<ProcessStatus>("idle");
  const [isExportingDocker, setIsExportingDocker] = useState<boolean>(false);

  const dockerDimensionsRef = useRef<{ cols: number; rows: number }>({ cols: 100, rows: 20 });
  const dockerIdRef = useRef<string>(`pty-docker-${projectId}`);
  const ptyCreatedRef = useRef<boolean>(false);
  const prevOutputDirRef = useRef<string>(outputDir);

  const handleDockerResize = useCallback(
    (cols: number, rows: number) => {
      dockerDimensionsRef.current = { cols, rows };
      if (inElectron) {
        const api = getElectronAPI();
        api?.terminal?.resize?.(dockerIdRef.current, cols, rows);
      }
    },
    [inElectron],
  );

  // Initialize Interactive PTY Shell for Docker Session (Electron)
  useEffect(() => {
    if (!inElectron) return;
    const api = getElectronAPI();
    if (!api?.terminal?.create) return;

    const ptyId = dockerIdRef.current;
    const { cols, rows } = dockerDimensionsRef.current;

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
      setDockerLogs((prev) => [...prev, data]);

      // Automatically infer process status from PTY ANSI stream
      if (
        data.includes("docker compose up") ||
        data.includes("Building") ||
        data.includes("Step ") ||
        data.includes("[+] Building")
      ) {
        setDockerStatus("building");
      } else if (
        data.includes("operational at") ||
        data.includes("Started") ||
        data.includes("running on") ||
        data.includes("Ready on") ||
        data.includes("Application startup complete") ||
        data.includes("healthy")
      ) {
        setDockerStatus("running");
      } else if (data.includes("[Docker Session Exited]")) {
        setDockerStatus("stopped");
      } else if (data.includes("ERROR") || data.includes("failed to solve") || data.includes("Error response from daemon")) {
        setDockerStatus("error");
      }
    });

    const cleanupExit = api.terminal.onExit(ptyId, () => {
      setDockerStatus("stopped");
      setDockerLogs((prev) => [...prev, "\r\n\x1b[31m[Docker Session Exited]\x1b[0m\r\n"]);
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
      api?.terminal?.write(dockerIdRef.current, `cd "${outputDir}"\r`);
    }
  }, [inElectron, outputDir]);

  // Browser Simulation: Docker Run
  const handleSimulateDockerRun = useCallback(() => {
    const services = monorepoResult.services || [];
    const webClients = monorepoResult.webClients || [];

    setDockerLogs((prev) => [
      ...prev,
      "docker compose up --build\r\n",
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

  // Docker Build Runner (Production) in live PTY
  const handleStartDocker = useCallback(async () => {
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
        toast.error("Please select a target folder to write project files");
        return;
      }
      saveWorkspaceDir(targetDir);
    }

    setIsExportingDocker(true);
    setDockerStatus("building");

    if (inElectron && api?.terminal?.write) {
      try {
        // 1. Export files
        if (targetDir) {
          await exportFilesToDirectory(files, targetDir, setDockerLogs);
        }

        // 2. Ensure PTY is in directory and execute docker compose up --build
        if (targetDir) {
          api.terminal.write(dockerIdRef.current, `cd "${targetDir}"\r`);
        }
        api.terminal.write(dockerIdRef.current, "docker compose up --build\r");
        toast.success("Building & orchestrating Docker containers in Build Terminal...");
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

  // Stop Docker Build (sends SIGINT or docker compose down)
  const handleStopDocker = useCallback(() => {
    const api = getElectronAPI();
    if (inElectron && api?.terminal?.write) {
      api.terminal.write(dockerIdRef.current, "\x03\r\n");
      setDockerStatus("stopped");
      toast.info("Stopped Docker runner");
      setTimeout(() => {
        setDockerStatus("idle");
      }, 1200);
    } else {
      setDockerStatus("stopped");
      setDockerLogs((prev) => [
        ...prev,
        "^C\r\n\x1b[31m[Docker Runner Stopped]\x1b[0m\r\n\r\n\x1b[32mblueprint\x1b[0m \x1b[34m❯\x1b[0m ",
      ]);
      setTimeout(() => {
        setDockerStatus("idle");
      }, 1200);
    }
  }, [inElectron]);

  const clearDockerLogs = useCallback(() => {
    setDockerLogs([]);
    setDockerStatus("idle");
    if (inElectron) {
      const api = getElectronAPI();
      api?.terminal?.write(dockerIdRef.current, "\x0c");
    }
  }, [inElectron]);

  return {
    dockerLogs,
    setDockerLogs,
    dockerStatus,
    setDockerStatus,
    isExportingDocker,
    dockerIdRef,
    handleDockerResize,
    handleStartDocker,
    handleStopDocker,
    clearDockerLogs,
  };
}
