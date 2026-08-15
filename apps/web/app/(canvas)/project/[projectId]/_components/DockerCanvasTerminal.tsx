"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Button } from "@workspace/ui/components/button";
import {
  Terminal as TerminalIcon,
  Play,
  Square,
  ChevronUp,
  ChevronDown,
  Folder,
  Copy,
  Check,
  Archive,
  Maximize2,
  Minimize2,
  X,
  Trash2,
  ArrowDown,
  ExternalLink,
  Zap,
  Layers,
  Search,
  Loader2,
  AlertCircle,
  Code2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { isElectron, getElectronAPI, openExternalUrl } from "@/lib/electron";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useSimulationStore } from "@/lib/stores/simulationStore";
import { compileMonorepo, CompiledMonorepoResult, CompiledFile } from "@/lib/compiler";
import { WTermTerminal, WTermTerminalHandle } from "@/components/terminal";

export interface DockerCanvasTerminalProps {
  projectId: string;
  projectName?: string;
}

export type TerminalTab = "dev" | "docker" | "shell";
export type ProcessStatus = "idle" | "starting" | "building" | "running" | "stopped" | "error";

interface ServiceEndpoint {
  name: string;
  port: string;
  url: string;
  type: "web" | "service" | "db" | "redis" | "kafka";
  healthUrl?: string;
  docsUrl?: string;
}

export function DockerCanvasTerminal({
  projectId,
  projectName = "Blueprint",
}: DockerCanvasTerminalProps) {
  const inElectron = isElectron();

  // Zustand Store selectors
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const endpoints = useBackendCanvasStore((s) => s.endpoints);
  const events = useBackendCanvasStore((s) => s.events);
  const edges = useBackendCanvasStore((s) => s.edges);
  const testCases = useSimulationStore((s) => s.testCases);

  // UI state
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TerminalTab>("dev");
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);
  const [downloadingZip, setDownloadingZip] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Target directory for local output with persistent multi-level fallback
  const [outputDir, setOutputDir] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        return (
          localStorage.getItem(`workspace_dir_${projectId}`) ||
          localStorage.getItem(`docker_dir_${projectId}`) ||
          localStorage.getItem("blueprint_workspace_dir") ||
          ""
        );
      } catch (e) {
        return "";
      }
    }
    return "";
  });

  // Re-sync outputDir if projectId mounts or changes
  useEffect(() => {
    if (!projectId || typeof window === "undefined") return;
    try {
      const saved =
        localStorage.getItem(`workspace_dir_${projectId}`) ||
        localStorage.getItem(`docker_dir_${projectId}`) ||
        localStorage.getItem("blueprint_workspace_dir") ||
        "";
      if (saved && saved !== outputDir) {
        setOutputDir(saved);
      }
    } catch (e) {}
  }, [projectId]);

  const saveWorkspaceDir = useCallback(
    (dir: string) => {
      setOutputDir(dir);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`workspace_dir_${projectId}`, dir);
          localStorage.setItem(`docker_dir_${projectId}`, dir);
          localStorage.setItem("blueprint_workspace_dir", dir);
        } catch (e) {}
      }
    },
    [projectId],
  );

  // Separate log streams & statuses for Dev vs Docker vs Interactive Shell
  const [devLogs, setDevLogs] = useState<string[]>([]);
  const [devStatus, setDevStatus] = useState<ProcessStatus>("idle");

  const [dockerLogs, setDockerLogs] = useState<string[]>([]);
  const [dockerStatus, setDockerStatus] = useState<ProcessStatus>("idle");

  const [shellLogs, setShellLogs] = useState<string[]>([]);
  const [shellActive, setShellActive] = useState<boolean>(false);

  // Dedicated refs for each terminal session to ensure 100% log and buffer isolation
  const devWtermRef = useRef<WTermTerminalHandle>(null);
  const dockerWtermRef = useRef<WTermTerminalHandle>(null);
  const shellWtermRef = useRef<WTermTerminalHandle>(null);
  const shellIdRef = useRef<string>(`pty-${projectId}-${Date.now()}`);

  // Auto-focus and align active tab terminal when switching tabs or expanding
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      if (activeTab === "dev") {
        devWtermRef.current?.focus();
      } else if (activeTab === "docker") {
        dockerWtermRef.current?.focus();
      } else if (activeTab === "shell") {
        shellWtermRef.current?.focus();
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [activeTab, isOpen, isExpanded]);

  // Formatted project name
  const formattedProjectName = useMemo(() => {
    const raw = projectName.trim();
    return raw.toLowerCase().endsWith("monorepo") ? raw : `${raw} Monorepo`;
  }, [projectName]);

  // Compile Monorepo result on demand
  const monorepoResult: CompiledMonorepoResult = useMemo(() => {
    return compileMonorepo(nodes, endpoints, events, edges, testCases, formattedProjectName);
  }, [nodes, endpoints, events, edges, testCases, formattedProjectName]);

  const files = monorepoResult.files;

  // Extract active service endpoint URLs for direct browser navigation
  const serviceEndpoints: ServiceEndpoint[] = useMemo(() => {
    const list: ServiceEndpoint[] = [];
    const webClients = monorepoResult.webClients || [];
    const services = monorepoResult.services || [];

    // Web Clients
    webClients.forEach((w, idx) => {
      const port = idx === 0 ? "3000" : `${3000 + idx}`;
      list.push({
        name: w.name || "Web Application",
        port,
        url: `http://localhost:${port}`,
        type: "web",
      });
    });

    // Backend Microservices
    services.forEach((s) => {
      const srvEnvFile = files.find(
        (f) =>
          f.filename === `apps/${s.folderName}/.env.example` ||
          f.filename === `apps/${s.folderName}/.env`,
      );
      let port = "8080";
      if (srvEnvFile) {
        const match = srvEnvFile.content.match(/^PORT=(\d+)/m);
        if (match && match[1]) port = match[1];
      }
      list.push({
        name: s.name,
        port,
        url: `http://localhost:${port}`,
        healthUrl: `http://localhost:${port}/health`,
        docsUrl: `http://localhost:${port}/docs`,
        type: "service",
      });
    });

    // Infrastructure: DB / Redis / Kafka (only if actually configured in docker-compose)
    const composeFile = files.find(
      (f) => f.filename === "docker-compose.yml" || f.filename === "docker-compose.infra.yml",
    );
    const composeContent = composeFile?.content || "";

    if (
      composeContent.includes("image: postgres") ||
      composeContent.includes("container_name: postgres") ||
      nodes.some((n) => {
        if (n.type !== "database") return false;
        const engine = (n.data?.dbEngine || n.data?.provider || n.data?.dbType || "").toLowerCase();
        return engine.includes("postgres") || engine.includes("pg");
      })
    ) {
      list.push({
        name: "PostgreSQL",
        port: "5432",
        url: "postgresql://localhost:5432",
        type: "db",
      });
    }

    if (
      composeContent.includes("image: redis") ||
      composeContent.includes("container_name: redis") ||
      nodes.some((n) => (n.data?.label || "").toLowerCase().includes("redis"))
    ) {
      list.push({
        name: "Redis",
        port: "6379",
        url: "redis://localhost:6379",
        type: "redis",
      });
    }

    if (
      composeContent.includes("kafka") ||
      nodes.some((n) => (n.data?.label || "").toLowerCase().includes("kafka"))
    ) {
      list.push({
        name: "Kafka",
        port: "9092",
        url: "localhost:9092",
        type: "kafka",
      });
    }

    return list;
  }, [monorepoResult, files, nodes]);

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

  // Dynamic PTY dimensions measured directly from wterm DOM grid
  const shellDimensionsRef = useRef<{ cols: number; rows: number }>({ cols: 100, rows: 20 });

  const handleShellResize = useCallback(
    (cols: number, rows: number) => {
      shellDimensionsRef.current = { cols, rows };
      if (inElectron) {
        const api = getElectronAPI();
        api?.terminal?.resize?.(shellIdRef.current, cols, rows);
      }
    },
    [inElectron],
  );

  // Interactive PTY Session Handler (Electron only)
  useEffect(() => {
    if (!inElectron || activeTab !== "shell") return;
    const api = getElectronAPI();
    if (!api?.terminal?.create) return;

    const ptyId = shellIdRef.current;
    let isSubscribed = true;
    const { cols, rows } = shellDimensionsRef.current;

    api.terminal.create(ptyId, outputDir || "", cols, rows).then(() => {
      if (!isSubscribed) return;
      setShellActive(true);
      setShellLogs((prev) =>
        prev.length === 0
          ? [`\x1b[36mConnected to Interactive Shell (${outputDir || "default"})\x1b[0m\r\n`]
          : prev,
      );
    });

    const cleanupData = api.terminal.onData(ptyId, (data: string) => {
      if (isSubscribed) {
        setShellLogs((prev) => [...prev, data]);
      }
    });

    const cleanupExit = api.terminal.onExit(ptyId, () => {
      if (isSubscribed) {
        setShellActive(false);
        setShellLogs((prev) => [...prev, "\r\n\x1b[31m[Shell Session Exited]\x1b[0m\r\n"]);
      }
    });

    return () => {
      isSubscribed = false;
      cleanupData();
      cleanupExit();
    };
  }, [inElectron, activeTab, outputDir]);

  // Handle Interactive Key Input (wterm onData)
  const handleTerminalInput = useCallback(
    (data: string, tab: TerminalTab) => {
      const api = getElectronAPI();
      if (inElectron) {
        if (tab === "shell") {
          api?.terminal?.write(shellIdRef.current, data);
        } else if (tab === "dev" && (devStatus === "running" || devStatus === "starting")) {
          api?.dev?.write(data);
        } else if (tab === "docker" && (dockerStatus === "running" || dockerStatus === "building")) {
          api?.docker?.write(data);
        }
      }
    },
    [inElectron, devStatus, dockerStatus],
  );

  // Electron Directory Picker
  const handlePickDirectory = async () => {
    const api = getElectronAPI();
    if (!api?.fs?.pickDirectory) return;
    try {
      const selected = await api.fs.pickDirectory();
      if (selected) {
        saveWorkspaceDir(selected);
        toast.success(`Target folder: ${selected}`);
      }
    } catch (err) {
      toast.error("Failed to select directory");
    }
  };

  // Helper: export files to directory
  const exportFilesToDirectory = async (
    targetDir: string,
    logSetter: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    const api = getElectronAPI();
    if (!api?.fs?.writeProject) throw new Error("File export not available in this environment");

    logSetter((prev) => [
      ...prev,
      `📂 Syncing ${files.length} monorepo files to ${targetDir}...\n`,
    ]);

    const exportFiles: CompiledFile[] = files.map((f: CompiledFile) => ({
      filename: f.filename,
      language: f.language,
      content: f.content,
    }));

    await api.fs.writeProject(targetDir, exportFiles);
    logSetter((prev) => [...prev, `✅ Files written successfully to ${targetDir}\n`]);
  };

  // ── Dev Server Runner (pnpm i && pnpm dev) ────────────────────────
  const handleStartDev = async () => {
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

    setIsExporting(true);
    setDevStatus("starting");
    setIsOpen(true);
    setActiveTab("dev");
    setDevLogs([]);

    if (inElectron && api?.dev?.run) {
      try {
        // 1. Export files
        await exportFilesToDirectory(targetDir, setDevLogs);

        // 2. Run dev server (pnpm install && pnpm dev)
        await api.dev.run(targetDir);
        toast.success("Starting dev stack with hot reload...");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setDevLogs((prev) => [...prev, `\n❌ Error starting dev mode: ${msg}\n`]);
        setDevStatus("error");
        toast.error("Failed to start dev stack");
      } finally {
        setIsExporting(false);
      }
    } else {
      // Browser preview simulation
      setIsExporting(false);
      handleSimulateDevRun();
    }
  };

  const handleStopDev = () => {
    const api = getElectronAPI();
    if (inElectron && api?.dev?.stop && outputDir) {
      api.dev.stop(outputDir);
      setDevStatus("stopped");
      toast.info("Stopping dev server...");
    } else {
      setDevStatus("stopped");
      setDevLogs((prev) => [...prev, "\n🛑 Dev server stopped.\n"]);
    }
  };

  // ── Docker Build Runner (Production) ──────────────────────
  const handleStartDocker = async () => {
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

    setIsExporting(true);
    setDockerStatus("building");
    setIsOpen(true);
    setActiveTab("docker");
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
        await exportFilesToDirectory(targetDir, setDockerLogs);

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
        setIsExporting(false);
      }
    } else {
      // Browser preview simulation
      setIsExporting(false);
      handleSimulateDockerRun();
    }
  };

  const handleStopDocker = () => {
    const api = getElectronAPI();
    if (inElectron && api?.docker?.down && outputDir) {
      api.docker.down(outputDir);
      setDockerStatus("stopped");
      toast.info("Stopping Docker containers...");
    } else {
      setDockerStatus("stopped");
      setDockerLogs((prev) => [...prev, "\n🛑 Docker containers stopped.\n"]);
    }
  };

  // Browser Simulation: Dev Run (pnpm i && pnpm dev)
  const handleSimulateDevRun = () => {
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
  };

  // Browser Simulation: Docker Run
  const handleSimulateDockerRun = () => {
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
  };

  // Clear logs for active tab
  const handleClearLogs = () => {
    if (activeTab === "dev") {
      devWtermRef.current?.clear();
      setDevLogs([]);
      setDevStatus("idle");
    } else if (activeTab === "docker") {
      dockerWtermRef.current?.clear();
      setDockerLogs([]);
      setDockerStatus("idle");
    } else {
      shellWtermRef.current?.clear();
      setShellLogs([]);
    }
  };

  // Copy active logs
  const handleCopyLogs = () => {
    const logsToCopy =
      activeTab === "dev" ? devLogs : activeTab === "docker" ? dockerLogs : shellLogs;
    if (logsToCopy.length === 0) return;
    navigator.clipboard.writeText(logsToCopy.join(""));
    setCopiedLogs(true);
    toast.success("Terminal output copied!");
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  // Copy command
  const handleCopyCommand = () => {
    const cmd =
      activeTab === "dev"
        ? "pnpm install && pnpm dev"
        : activeTab === "docker"
          ? "docker compose up --build"
          : "powershell.exe";
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    toast.success("Command copied to clipboard!");
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  // Download ZIP
  const handleDownloadZip = async () => {
    if (files.length === 0) return;
    setDownloadingZip(true);
    toast.info("Compressing project into ZIP...");
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      files.forEach((f) => zip.file(f.filename, f.content));
      const blob = await zip.generateAsync({ type: "blob" });
      const zipName = `${formattedProjectName.toLowerCase().replace(/[^a-z0-9]/g, "-")}.zip`;
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: zipName });
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${zipName}!`);
    } catch (err) {
      toast.error("Failed to generate ZIP archive");
    } finally {
      setDownloadingZip(false);
    }
  };

  // Active tab logs & status
  const currentLogs =
    activeTab === "dev" ? devLogs : activeTab === "docker" ? dockerLogs : shellLogs;
  const currentStatus = activeTab === "dev" ? devStatus : dockerStatus;

  const renderStatusBadge = (status: ProcessStatus) => {
    switch (status) {
      case "starting":
      case "building":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-mono">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            <span className="capitalize">{status}</span>
          </span>
        );
      case "running":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Running</span>
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-red-400 font-mono">
            <AlertCircle className="w-2.5 h-2.5" />
            <span>Failed</span>
          </span>
        );
      case "stopped":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
            <Square className="w-2 h-2 fill-zinc-400" />
            <span>Stopped</span>
          </span>
        );
      case "idle":
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
            <span>Idle</span>
          </span>
        );
    }
  };

  // Combined overall status for floating badge
  const overallRunning = devStatus === "running" || dockerStatus === "running";
  const overallBuilding = devStatus === "starting" || dockerStatus === "building";

  return (
    <div className="fixed bottom-3 right-4 z-40 flex flex-col items-end pointer-events-none font-sans">
      {/* wterm-Powered Modern Terminal Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={`pointer-events-auto mb-2 flex flex-col bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden ${
              isExpanded
                ? "w-[min(1180px,calc(100vw-2.5rem))] h-[600px]"
                : "w-[min(900px,calc(100vw-2.5rem))] h-[420px]"
            }`}
          >
            {/* Terminal Header & Tabs Bar */}
            <div className="flex items-center justify-between h-9 bg-zinc-900 border-b border-zinc-800 shrink-0 px-2 select-none text-zinc-300">
              {/* Left: Terminal Tabs */}
              <div className="flex items-center h-full gap-0.5">
                {/* Dev Server Tab (pnpm i && pnpm dev) */}
                <button
                  type="button"
                  onClick={() => setActiveTab("dev")}
                  className={`flex items-center gap-2 h-full px-3 text-xs font-medium transition-colors border-b-2 ${
                    activeTab === "dev"
                      ? "bg-zinc-950 text-zinc-100 border-emerald-500 font-semibold"
                      : "bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border-transparent"
                  }`}
                >
                  <Zap
                    className={`w-3.5 h-3.5 ${activeTab === "dev" ? "text-emerald-400" : "text-zinc-500"}`}
                  />
                  <span>1: Dev (pnpm dev)</span>
                  {renderStatusBadge(devStatus)}
                </button>

                {/* Docker Build Tab */}
                <button
                  type="button"
                  onClick={() => setActiveTab("docker")}
                  className={`flex items-center gap-2 h-full px-3 text-xs font-medium transition-colors border-b-2 ${
                    activeTab === "docker"
                      ? "bg-zinc-950 text-zinc-100 border-blue-500 font-semibold"
                      : "bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border-transparent"
                  }`}
                >
                  <Layers
                    className={`w-3.5 h-3.5 ${activeTab === "docker" ? "text-blue-400" : "text-zinc-500"}`}
                  />
                  <span>2: Docker Build</span>
                  {renderStatusBadge(dockerStatus)}
                </button>

                {/* Interactive Shell Tab */}
                {inElectron && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("shell")}
                    className={`flex items-center gap-2 h-full px-3 text-xs font-medium transition-colors border-b-2 ${
                      activeTab === "shell"
                        ? "bg-zinc-950 text-zinc-100 border-purple-500 font-semibold"
                        : "bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border-transparent"
                    }`}
                  >
                    <Code2
                      className={`w-3.5 h-3.5 ${activeTab === "shell" ? "text-purple-400" : "text-zinc-500"}`}
                    />
                    <span>3: Interactive Shell</span>
                    {shellActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                    )}
                  </button>
                )}
              </div>

              {/* Right: Terminal Actions */}
              <div className="flex items-center gap-1">
                {/* Directory Selector in Desktop */}
                {inElectron ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handlePickDirectory}
                    className="h-6 px-2 text-[11px] gap-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                    title={outputDir ? `Workspace: ${outputDir}` : "Choose workspace directory"}
                  >
                    <Folder className="w-3 h-3 text-zinc-400" />
                    <span className="max-w-[130px] truncate hidden sm:inline font-mono">
                      {outputDir ? outputDir.split(/[\\/]/).pop() : "Folder..."}
                    </span>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDownloadZip}
                    disabled={downloadingZip}
                    className="h-6 px-2 text-[11px] gap-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                    title="Download complete monorepo ZIP"
                  >
                    <Archive className="w-3 h-3 text-zinc-400" />
                    <span className="hidden sm:inline">
                      {downloadingZip ? "Zipping..." : "ZIP"}
                    </span>
                  </Button>
                )}

                {/* Primary Action Button (Start / Stop) for Active Tab */}
                {activeTab === "dev" ? (
                  devStatus === "running" || devStatus === "starting" ? (
                    <Button
                      size="sm"
                      onClick={handleStopDev}
                      className="h-6 px-2.5 text-[11px] gap-1 bg-red-600 hover:bg-red-700 text-white border-0 font-medium"
                    >
                      <Square className="w-2.5 h-2.5 fill-white" />
                      <span>Stop Dev</span>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleStartDev}
                      disabled={isExporting}
                      className="h-6 px-2.5 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0 font-medium"
                    >
                      <Play className="w-2.5 h-2.5 fill-white" />
                      <span>Run Dev</span>
                    </Button>
                  )
                ) : activeTab === "docker" ? (
                  dockerStatus === "running" || dockerStatus === "building" ? (
                    <Button
                      size="sm"
                      onClick={handleStopDocker}
                      className="h-6 px-2.5 text-[11px] gap-1 bg-red-600 hover:bg-red-700 text-white border-0 font-medium"
                    >
                      <Square className="w-2.5 h-2.5 fill-white" />
                      <span>Stop Build</span>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleStartDocker}
                      disabled={isExporting}
                      className="h-6 px-2.5 text-[11px] gap-1 bg-blue-600 hover:bg-blue-700 text-white border-0 font-medium"
                    >
                      <Play className="w-2.5 h-2.5 fill-white" />
                      <span>Docker Build</span>
                    </Button>
                  )
                ) : null}

                {/* Copy Command */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyCommand}
                  className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  title="Copy startup command"
                >
                  {copiedCmd ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>

                {/* Copy Logs */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyLogs}
                  disabled={currentLogs.length === 0}
                  className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-30"
                  title="Copy Terminal Logs"
                >
                  {copiedLogs ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>

                {/* Clear Output */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleClearLogs}
                  disabled={currentLogs.length === 0}
                  className="h-6 w-6 p-0 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 disabled:opacity-30"
                  title="Clear Terminal Output"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>

                {/* Expand / Minimize */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  title={isExpanded ? "Restore Size" : "Maximize Terminal"}
                >
                  {isExpanded ? (
                    <Minimize2 className="w-3 h-3" />
                  ) : (
                    <Maximize2 className="w-3 h-3" />
                  )}
                </Button>

                {/* Close Window */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                  className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  title="Close Terminal"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Sub-Header: Active Mode Details & Quick Endpoints */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/70 border-b border-zinc-800/80 text-[11px] shrink-0">
              <div className="flex items-center gap-2 overflow-x-auto py-0.5">
                <span className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider shrink-0">
                  {activeTab === "dev"
                    ? "Dev Stack:"
                    : activeTab === "docker"
                      ? "Docker Stack:"
                      : "Shell Session:"}
                </span>

                {serviceEndpoints.map((svc) => (
                  <a
                    key={svc.name}
                    href={svc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => openExternalUrl(svc.url, e)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/60 text-zinc-300 hover:text-white transition-colors shrink-0 text-[11px] cursor-pointer"
                    title={`Open ${svc.name} (${svc.url}) in browser`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        svc.type === "web"
                          ? "bg-blue-400"
                          : svc.type === "service"
                            ? "bg-emerald-400"
                            : "bg-amber-400"
                      }`}
                    />
                    <span className="font-medium">{svc.name}</span>
                    <span className="text-zinc-500 font-mono">:{svc.port}</span>
                    <ExternalLink className="w-2.5 h-2.5 text-zinc-500" />
                  </a>
                ))}
              </div>

              <div className="flex items-center gap-1.5 pl-2 shrink-0">
                <span className="text-[10px] bg-zinc-800/80 text-zinc-400 px-1.5 py-0.5 rounded font-mono border border-zinc-700/50">
                  wterm engine (WASM)
                </span>
              </div>
            </div>

            {/* wterm WebAssembly DOM Terminal Viewport - 3 Isolated Instances */}
            <div className="flex-1 min-h-0 bg-[#090d13] relative overflow-hidden">
              {/* Tab 1: Dev Server Terminal (Isolated) */}
              <div
                className={`absolute inset-0 w-full h-full transition-opacity duration-150 ${
                  activeTab === "dev"
                    ? "opacity-100 z-10 pointer-events-auto"
                    : "opacity-0 z-0 pointer-events-none"
                }`}
              >
                <WTermTerminal
                  ref={devWtermRef}
                  logs={devLogs}
                  rawStream={true}
                  onData={
                    devStatus === "running" || devStatus === "starting"
                      ? (data) => handleTerminalInput(data, "dev")
                      : undefined
                  }
                  interactive={devStatus === "running" || devStatus === "starting"}
                  placeholder='Click "Run Dev" to run pnpm install and launch all apps with hot reload.'
                />
              </div>

              {/* Tab 2: Docker Build Terminal (Isolated) */}
              <div
                className={`absolute inset-0 w-full h-full transition-opacity duration-150 ${
                  activeTab === "docker"
                    ? "opacity-100 z-10 pointer-events-auto"
                    : "opacity-0 z-0 pointer-events-none"
                }`}
              >
                <WTermTerminal
                  ref={dockerWtermRef}
                  logs={dockerLogs}
                  rawStream={true}
                  onData={
                    dockerStatus === "running" || dockerStatus === "building"
                      ? (data) => handleTerminalInput(data, "docker")
                      : undefined
                  }
                  interactive={dockerStatus === "running" || dockerStatus === "building"}
                  placeholder='Click "Docker Build" to compile container images and orchestrate with Docker Compose.'
                />
              </div>

              {/* Tab 3: Interactive Shell Terminal (Isolated) */}
              <div
                className={`absolute inset-0 w-full h-full transition-opacity duration-150 ${
                  activeTab === "shell"
                    ? "opacity-100 z-10 pointer-events-auto"
                    : "opacity-0 z-0 pointer-events-none"
                }`}
              >
                <WTermTerminal
                  ref={shellWtermRef}
                  logs={shellLogs}
                  onData={(data) => handleTerminalInput(data, "shell")}
                  onResize={handleShellResize}
                  rawStream={true}
                  interactive={true}
                  placeholder="Interactive shell ready. Type commands and press Enter."
                />
              </div>
            </div>

            {/* Terminal Status Footer */}
            <div className="flex items-center justify-between px-3 py-1 bg-zinc-900 border-t border-zinc-800 text-[10px] text-zinc-400 shrink-0 font-mono">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="text-zinc-500">Mode:</span>
                  <span className="text-zinc-200 font-medium uppercase">{activeTab}</span>
                </span>
                {outputDir && (
                  <span className="hidden sm:flex items-center gap-1 text-zinc-500 truncate max-w-[260px]">
                    <span>dir:</span>
                    <span className="text-zinc-300">{outputDir}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-zinc-500">{currentLogs.length} events</span>
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-400">
                  {inElectron ? "Electron Desktop Native" : "Web Preview"}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Bottom Dock Toggle Button */}
      <div className="pointer-events-auto flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className={`h-9 px-3.5 gap-2 rounded-full shadow-xl border text-xs font-medium transition-all ${
            isOpen
              ? "bg-zinc-900 text-zinc-100 border-zinc-700 hover:bg-zinc-800"
              : overallRunning
                ? "bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700 ring-2 ring-emerald-500/30"
                : overallBuilding
                  ? "bg-amber-600 text-white border-amber-500 hover:bg-amber-700"
                  : "bg-zinc-900 text-zinc-100 border-zinc-800 hover:bg-zinc-800"
          }`}
        >
          <TerminalIcon
            className={`w-3.5 h-3.5 ${overallRunning ? "text-white" : "text-emerald-400"}`}
          />
          <span className="font-semibold">Terminal</span>
          {overallRunning ? (
            <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-700/80 text-[10px] text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Running
            </span>
          ) : overallBuilding ? (
            <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-amber-700/80 text-[10px] text-white">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              Building
            </span>
          ) : (
            <span className="text-[10px] text-zinc-400 font-mono uppercase">{activeTab}</span>
          )}
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
          )}
        </Button>
      </div>
    </div>
  );
}
