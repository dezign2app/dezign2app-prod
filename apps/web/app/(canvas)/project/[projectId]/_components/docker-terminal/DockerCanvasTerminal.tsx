"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { isElectron } from "@/lib/electron";
import { WTermTerminalHandle } from "@/components/terminal";

import { DockerCanvasTerminalProps } from "./types";
import { downloadMonorepoZip } from "./utils/terminalExportUtils";
import { useTerminalWorkspace } from "./hooks/useTerminalWorkspace";
import { useMonorepoEndpoints } from "./hooks/useMonorepoEndpoints";
import { useDynamicTerminalSessions } from "./hooks/useDynamicTerminalSessions";
import { useAutoDiskSync } from "./hooks/useAutoDiskSync";

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

  // Drawer UI state
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [downloadingZip, setDownloadingZip] = useState<boolean>(false);

  // 1. Workspace directory persistence & folder picker
  const { outputDir, handlePickDirectory } = useTerminalWorkspace(projectId);

  // 2. Monorepo compilation & endpoints
  const { formattedProjectName, files, serviceEndpoints } =
    useMonorepoEndpoints(projectName);

  // 3. Dynamic User-Created Terminal Sessions (Persistent across drawers/nodes until closed)
  const {
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
  } = useDynamicTerminalSessions({
    projectId,
    outputDir,
  });

  // 4. Real-time automatic disk synchronization (Electron mode)
  const {
    syncStatus,
    lastSyncedAt,
    autoSyncEnabled,
    setAutoSyncEnabled,
    forceSyncNow,
  } = useAutoDiskSync({
    projectId,
    outputDir,
    files,
  });

  // Map of refs for each mounted terminal instance to ensure log and buffer isolation
  const terminalRefs = useRef<Map<string, WTermTerminalHandle | null>>(
    new Map(),
  );

  // Auto-initialize 1 default terminal when drawer is opened and no sessions exist
  useEffect(() => {
    if (isOpen && sessions.length === 0) {
      createTerminal({ title: "Terminal 1", type: "shell" });
    }
  }, [isOpen, sessions.length, createTerminal]);

  // Auto-focus active terminal when switching tabs, expanding, or opening drawer
  useEffect(() => {
    if (!isOpen || !activeSessionId) return;
    const timer = setTimeout(() => {
      const handle = terminalRefs.current.get(activeSessionId);
      handle?.focus();
    }, 60);
    return () => clearTimeout(timer);
  }, [activeSessionId, isOpen, isExpanded]);

  // Download ZIP (Web mode)
  const handleDownloadZip = useCallback(async () => {
    setDownloadingZip(true);
    try {
      await downloadMonorepoZip(files, formattedProjectName);
    } finally {
      setDownloadingZip(false);
    }
  }, [files, formattedProjectName]);

  const hasRunningSession = sessions.some((s) => s.status === "running");

  return (
    <div className="fixed bottom-3 right-4 z-40 flex flex-col items-end pointer-events-none font-sans">
      {/* wterm-Powered Dynamic Modern Terminal Window */}
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
            {/* Terminal Dynamic Tabs & Action Header */}
            <TerminalHeader
              inElectron={inElectron}
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectTab={selectTerminal}
              onCloseTab={closeTerminal}
              onNewTab={(type, shell, title) =>
                createTerminal({ type, shell, title })
              }
              onRenameTab={renameTerminal}
              onClearActiveTab={() => {
                if (activeSessionId) clearTerminal(activeSessionId);
              }}
              outputDir={outputDir}
              onPickDirectory={handlePickDirectory}
              onDownloadZip={handleDownloadZip}
              downloadingZip={downloadingZip}
              syncStatus={syncStatus}
              lastSyncedAt={lastSyncedAt}
              onForceSync={forceSyncNow}
              isExpanded={isExpanded}
              onToggleExpand={() => setIsExpanded(!isExpanded)}
              onClose={() => setIsOpen(false)}
            />

            {/* Sub-Header: Live Service Endpoints & Detected Runtime Ports */}
            <TerminalEndpointsBar
              serviceEndpoints={serviceEndpoints}
              detectedPorts={allDetectedPorts}
            />

            {/* Multi-Tab Terminal Viewport with disabled autoScroll & launcher empty state */}
            <TerminalViewport
              sessions={sessions}
              activeSessionId={activeSessionId}
              terminalRefs={terminalRefs}
              onTerminalInput={writeToSession}
              onTerminalResize={resizeSession}
              onNewTab={(type, shell, title) =>
                createTerminal({ type, shell, title })
              }
            />

            {/* Terminal Status Footer */}
            <TerminalFooter
              activeTitle={activeSession?.title}
              sessionCount={sessions.length}
              outputDir={outputDir}
              eventCount={activeSession?.logs.length || 0}
              inElectron={inElectron}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Bottom Dock Toggle Button */}
      <TerminalDockButton
        isOpen={isOpen}
        onToggleOpen={() => setIsOpen(!isOpen)}
        sessionCount={sessions.length}
        hasRunningSession={hasRunningSession}
      />
    </div>
  );
}
