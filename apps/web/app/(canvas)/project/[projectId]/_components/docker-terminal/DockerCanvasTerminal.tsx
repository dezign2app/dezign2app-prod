"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { isElectron, getElectronAPI } from "@/lib/electron";
import { WTermTerminalHandle, cleanTerminalText } from "@/components/terminal";

import { DockerCanvasTerminalProps, TerminalTab } from "./types";
import { downloadMonorepoZip } from "./utils/terminalExportUtils";
import { useTerminalWorkspace } from "./hooks/useTerminalWorkspace";
import { useMonorepoEndpoints } from "./hooks/useMonorepoEndpoints";
import { useDevSession } from "./hooks/useDevSession";
import { useDockerSession } from "./hooks/useDockerSession";
import { useShellSession } from "./hooks/useShellSession";

import { TerminalHeader } from "./components/TerminalHeader";
import { TerminalEndpointsBar } from "./components/TerminalEndpointsBar";
import { TerminalViewport } from "./components/TerminalViewport";
import { TerminalFooter } from "./components/TerminalFooter";
import { TerminalDockButton } from "./components/TerminalDockButton";

export function DockerCanvasTerminal({
  projectId,
  projectName = "Blueprint",
}: DockerCanvasTerminalProps) {
  const inElectron = isElectron();

  // UI state
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TerminalTab>("dev");
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);
  const [downloadingZip, setDownloadingZip] = useState<boolean>(false);

  // 1. Workspace persistence & folder picker
  const { outputDir, saveWorkspaceDir, handlePickDirectory } =
    useTerminalWorkspace(projectId);

  // 2. Monorepo compilation & live service endpoints
  const { formattedProjectName, monorepoResult, files, serviceEndpoints } =
    useMonorepoEndpoints(projectName);

  // 3. Dev Server session
  const {
    devLogs,
    devStatus,
    isExportingDev,
    handleStartDev: startDev,
    handleStopDev,
    clearDevLogs,
  } = useDevSession({
    projectId,
    outputDir,
    saveWorkspaceDir,
    files,
    monorepoResult,
  });

  // 4. Docker Build session
  const {
    dockerLogs,
    dockerStatus,
    isExportingDocker,
    handleStartDocker: startDocker,
    handleStopDocker,
    clearDockerLogs,
  } = useDockerSession({
    projectId,
    outputDir,
    saveWorkspaceDir,
    files,
    monorepoResult,
    serviceEndpoints,
  });

  // 5. Interactive Shell session
  const {
    shellLogs,
    shellActive,
    shellIdRef,
    handleShellResize,
    clearShellLogs,
  } = useShellSession({
    projectId,
    outputDir,
    activeTab,
  });

  // Dedicated refs for each terminal session to ensure 100% log, buffer, and scroll isolation
  const devWtermRef = useRef<WTermTerminalHandle>(null);
  const dockerWtermRef = useRef<WTermTerminalHandle>(null);
  const shellWtermRef = useRef<WTermTerminalHandle>(null);

  // Auto-focus active tab terminal when switching tabs, expanding, or opening
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
    [inElectron, devStatus, dockerStatus, shellIdRef],
  );

  const handleStartDev = useCallback(() => {
    setIsOpen(true);
    setActiveTab("dev");
    startDev();
  }, [startDev]);

  const handleStartDocker = useCallback(() => {
    setIsOpen(true);
    setActiveTab("docker");
    startDocker();
  }, [startDocker]);

  // Clear logs for active tab
  const handleClearLogs = useCallback(() => {
    if (activeTab === "dev") {
      devWtermRef.current?.clear();
      clearDevLogs();
    } else if (activeTab === "docker") {
      dockerWtermRef.current?.clear();
      clearDockerLogs();
    } else {
      shellWtermRef.current?.clear();
      clearShellLogs();
    }
  }, [activeTab, clearDevLogs, clearDockerLogs, clearShellLogs]);

  // Copy active logs
  const handleCopyLogs = useCallback(() => {
    const logsToCopy =
      activeTab === "dev" ? devLogs : activeTab === "docker" ? dockerLogs : shellLogs;
    if (logsToCopy.length === 0) return;
    navigator.clipboard.writeText(cleanTerminalText(logsToCopy.join("")));
    setCopiedLogs(true);
    toast.success("Terminal output copied!");
    setTimeout(() => setCopiedLogs(false), 2000);
  }, [activeTab, devLogs, dockerLogs, shellLogs]);

  // Copy command
  const handleCopyCommand = useCallback(() => {
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
  }, [activeTab]);

  // Download ZIP
  const handleDownloadZip = useCallback(async () => {
    setDownloadingZip(true);
    try {
      await downloadMonorepoZip(files, formattedProjectName);
    } finally {
      setDownloadingZip(false);
    }
  }, [files, formattedProjectName]);

  // Active tab logs & status
  const currentLogs =
    activeTab === "dev" ? devLogs : activeTab === "docker" ? dockerLogs : shellLogs;

  const isExporting = isExportingDev || isExportingDocker;
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
            <TerminalHeader
              inElectron={inElectron}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              devStatus={devStatus}
              dockerStatus={dockerStatus}
              shellActive={shellActive}
              outputDir={outputDir}
              onPickDirectory={handlePickDirectory}
              onDownloadZip={handleDownloadZip}
              downloadingZip={downloadingZip}
              isExporting={isExporting}
              onStartDev={handleStartDev}
              onStopDev={handleStopDev}
              onStartDocker={handleStartDocker}
              onStopDocker={handleStopDocker}
              onCopyCommand={handleCopyCommand}
              copiedCmd={copiedCmd}
              onCopyLogs={handleCopyLogs}
              copiedLogs={copiedLogs}
              hasLogs={currentLogs.length > 0}
              onClearLogs={handleClearLogs}
              isExpanded={isExpanded}
              onToggleExpand={() => setIsExpanded(!isExpanded)}
              onClose={() => setIsOpen(false)}
            />

            {/* Sub-Header: Active Mode Details & Quick Endpoints */}
            <TerminalEndpointsBar
              activeTab={activeTab}
              serviceEndpoints={serviceEndpoints}
            />

            {/* wterm WebAssembly DOM Terminal Viewport - 3 Isolated Interactive Terminal Instances */}
            <TerminalViewport
              activeTab={activeTab}
              devLogs={devLogs}
              dockerLogs={dockerLogs}
              shellLogs={shellLogs}
              devWtermRef={devWtermRef}
              dockerWtermRef={dockerWtermRef}
              shellWtermRef={shellWtermRef}
              onTerminalInput={handleTerminalInput}
              onShellResize={handleShellResize}
            />

            {/* Terminal Status Footer */}
            <TerminalFooter
              activeTab={activeTab}
              outputDir={outputDir}
              eventCount={currentLogs.length}
              inElectron={inElectron}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Bottom Dock Toggle Button */}
      <TerminalDockButton
        isOpen={isOpen}
        onToggleOpen={() => setIsOpen(!isOpen)}
        overallRunning={overallRunning}
        overallBuilding={overallBuilding}
        activeTab={activeTab}
      />
    </div>
  );
}
