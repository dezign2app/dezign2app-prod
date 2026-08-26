"use client";

import React, { useState, useEffect, useRef } from "react";
import { Resizable } from "re-resizable";
import { motion, AnimatePresence } from "framer-motion";
import { isElectron, getElectronAPI } from "@/lib/electron";
import { downloadMonorepoZip } from "./utils/terminalExportUtils";
import { toast } from "sonner";
import { WTermTerminalHandle } from "@/components/terminal";
import { TerminalProps } from "./types";
import { useSidebarStore } from "@/lib/stores/sidebarStore";

import { useTerminalWorkspace } from "./hooks/useTerminalWorkspace";
import { useMonorepoEndpoints } from "./hooks/useMonorepoEndpoints";
import { useDynamicTerminalSessions } from "./hooks/useDynamicTerminalSessions";
import { useAutoDiskSync } from "./hooks/useAutoDiskSync";

import { TerminalHeader } from "./components/TerminalHeader";
import { TerminalEndpointsBar } from "./components/TerminalEndpointsBar";
import { TerminalViewport } from "./components/TerminalViewport";
import { TerminalFooter } from "./components/TerminalFooter";
import { TerminalDockButton } from "./components/TerminalDockButton";

export function Terminal({
  projectId,
  projectName = "Blueprint",
  isOpen: controlledIsOpen,
  onToggleOpen: controlledOnToggleOpen,
}: TerminalProps) {
  const inElectron = isElectron();
  const terminalRefs = useRef<Map<string, WTermTerminalHandle | null>>(new Map());

  // Drawer UI state from local store
  const storeTerminalOpen = useSidebarStore((s) => s.terminalOpen);
  const storeToggleTerminal = useSidebarStore((s) => s.toggleTerminal);
  const storeSetTerminalOpen = useSidebarStore((s) => s.setTerminalOpen);
  const terminalHeight = useSidebarStore((s) => s.terminalHeight);
  const setTerminalHeight = useSidebarStore((s) => s.setTerminalHeight);

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : storeTerminalOpen;
  const handleToggleOpen = controlledOnToggleOpen || storeToggleTerminal;
  const handleClose = () => {
    if (controlledOnToggleOpen && isOpen) {
      controlledOnToggleOpen();
    } else {
      storeSetTerminalOpen(false);
    }
  };
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
    syncError,
    forceSyncNow,
  } = useAutoDiskSync({
    projectId,
    outputDir,
    files,
  });

  // Download project as ZIP (Browser / fallback mode)
  const handleDownloadZip = async () => {
    try {
      setDownloadingZip(true);
      await downloadMonorepoZip(files, formattedProjectName);
      toast.success("Project downloaded successfully");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      toast.error("Failed to download project zip", {
        description: msg,
      });
    } finally {
      setDownloadingZip(false);
    }
  };

  // Sync session workspace paths whenever output directory is changed
  useEffect(() => {
    const electronApi = getElectronAPI();
    if (outputDir && electronApi?.workspace?.setPath) {
      electronApi.workspace.setPath(
        `${outputDir}/${formattedProjectName}`,
      );
    }
  }, [outputDir, formattedProjectName]);

  // Handle first-time automatic creation of starter terminal
  useEffect(() => {
    if (sessions.length === 0 && (inElectron || files.length > 0)) {
      createTerminal({
        type: inElectron ? "shell" : "bash",
        title: "Main Terminal",
      });
    }
  }, [files, formattedProjectName]);

  const hasRunningSession = sessions.some((s) => s.status === "running");

  return (
    <>
      {/* wterm-Powered VS Code-style Bottom Docked Terminal Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="w-full z-30 pointer-events-auto flex flex-col font-sans shrink-0"
          >
            <Resizable
              size={{
                width: "100%",
                height: isExpanded ? "80vh" : terminalHeight,
              }}
              onResizeStop={(e, direction, ref, d) => {
                setTerminalHeight((prev: number) =>
                  Math.max(140, Math.min(800, prev + d.height)),
                );
              }}
              minHeight={140}
              maxHeight={800}
              enable={{ top: !isExpanded }}
              handleClasses={{
                top: "h-1 bg-sidebar-border hover:bg-primary cursor-row-resize transition-colors z-30",
              }}
              className="w-full flex flex-col bg-sidebar/95 backdrop-blur-md border-t border-sidebar-border shadow-2xl overflow-hidden"
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
                isExpanded={isExpanded}
                onToggleExpand={() => setIsExpanded(!isExpanded)}
                onClose={handleClose}
                syncStatus={syncStatus}
                lastSyncedAt={lastSyncedAt}
                onForceSync={forceSyncNow}
                onDownloadZip={handleDownloadZip}
                downloadingZip={downloadingZip}
              />

              {/* Dynamic Service Endpoints Bar */}
              <TerminalEndpointsBar
                serviceEndpoints={serviceEndpoints}
                detectedPorts={allDetectedPorts}
              />

              {/* Active Terminal Viewport */}
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
            </Resizable>
          </motion.div>
        )}
      </AnimatePresence>

      {/* VS Code Docked Bottom Status Strip */}
      <TerminalDockButton
        isOpen={isOpen}
        onToggleOpen={handleToggleOpen}
        sessionCount={sessions.length}
        hasRunningSession={hasRunningSession}
        outputDir={outputDir}
      />
    </>
  );
}
