"use client";

import React, { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { Id } from "@workspace/backend/_generated/dataModel";
import { toast } from "sonner";
import { useTerminalWorkspace } from "./terminal/hooks/useTerminalWorkspace";
import { ProjectFolderModal } from "./ProjectFolderModal";
import { useSidebarStore } from "@/lib/stores/sidebarStore";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { NodePaletteSidebar } from "./NodePaletteSidebar";
import { AiPanel } from "./AiPanel";
import { Terminal } from "./terminal/Terminal";
import { ReactFlowProvider } from "@xyflow/react";

interface ProjectCanvasLayoutProps {
  children: React.ReactNode;
  projectId: string;
}

export function ProjectCanvasLayout({
  children,
  projectId,
}: ProjectCanvasLayoutProps) {
  const project = useQuery(api.projects.getProjectById, {
    projectId: projectId as Id<"projects">,
  });

  const { outputDir, saveWorkspaceDir, handlePickDirectory } =
    useTerminalWorkspace(projectId, project?.name);

  // Sidebar state
  const paletteOpen = useSidebarStore((s) => s.paletteOpen);
  const setPaletteOpen = useSidebarStore((s) => s.setPaletteOpen);
  const aiPanelOpen = useSidebarStore((s) => s.aiPanelOpen);
  const setAiPanelOpen = useSidebarStore((s) => s.setAiPanelOpen);

  const projectFolderModalOpen = useSidebarStore(
    (s) => s.projectFolderModalOpen
  );
  const setProjectFolderModalOpen = useSidebarStore(
    (s) => s.setProjectFolderModalOpen
  );

  // Read the current canvas view from the store (set by each page via setStoreView)
  const canvasView = useBackendCanvasStore((s) => s.canvasView);

  const hasCheckedSwitchRef = useRef<string | null>(null);

  // Detect project switch and automatically prompt for a folder if not configured
  useEffect(() => {
    if (!projectId || typeof window === "undefined") return;
    if (hasCheckedSwitchRef.current === projectId) return;
    hasCheckedSwitchRef.current = projectId;

    try {
      const lastProjectId = localStorage.getItem("dezign2app_last_project_id");
      const isSwitch = Boolean(lastProjectId && lastProjectId !== projectId);
      localStorage.setItem("dezign2app_last_project_id", projectId);

      // If switching to a project that has NO folder selected, prompt the user
      if (!outputDir) {
        setProjectFolderModalOpen(true);
      } else if (isSwitch && project?.name) {
        const folderName =
          outputDir.replace(/[\/]+$/, "").split(/[\/]/).pop() || outputDir;
        toast.info(`Switched to "${project.name}" (Folder: ${folderName})`, {
          action: {
            label: "Change Folder",
            onClick: () => setProjectFolderModalOpen(true),
          },
        });
      }
    } catch (e) {
      console.warn("[ProjectCanvasLayout] Switch detection error:", e);
    }
  }, [projectId, outputDir, project?.name, setProjectFolderModalOpen]);

  return (
    <ReactFlowProvider>
      <div className="flex-1 w-full h-full min-h-0 flex flex-col overflow-hidden relative">
        {/* Active Route Workspace (Canvas, Compiler, Schemas, Pages, etc.) */}
        <div className="flex-1 min-h-0 w-full relative overflow-hidden flex flex-col">
          {children}
        </div>

        {/* ======================================================================== */}
        {/* SHARED UI OVERLAY - Sidebars + Terminal (persists across all tab routes)  */}
        {/* ======================================================================== */}
        <div className="absolute inset-0 w-full h-full z-20 pointer-events-none flex flex-col overflow-hidden">
          {/* Top spacer: matches toolbar height so sidebars start below the toolbar */}
          <div className="shrink-0 h-14" />
          <div className="flex-1 min-h-0 w-full flex overflow-hidden relative pointer-events-none">
            {/* Left: Node Palette Sidebar */}
            <NodePaletteSidebar
              view={canvasView ?? "graph"}
              isOpen={paletteOpen}
              onToggle={() => setPaletteOpen(!paletteOpen)}
            />

            {/* Center Column: Transparent canvas area + Terminal docked at bottom */}
            <div className="flex-1 min-w-0 h-full pointer-events-none overflow-hidden relative flex flex-col">
              <div className="flex-1 min-h-0" />
              <Terminal
                projectId={projectId}
                projectName={project?.name || "Dezign2App"}
              />
            </div>

            {/* Right: AI Assistant Sidebar */}
            <AiPanel
              projectId={projectId}
              isOpen={aiPanelOpen}
              onClose={() => setAiPanelOpen(false)}
            />
          </div>
        </div>

        {/* Unique Project Folder Selection Modal */}
        <ProjectFolderModal
          open={projectFolderModalOpen}
          onOpenChange={setProjectFolderModalOpen}
          projectId={projectId}
          projectName={project?.name || "Dezign2App Project"}
          currentOutputDir={outputDir}
          onPickDirectory={handlePickDirectory}
          onSaveDirectory={saveWorkspaceDir}
        />
      </div>
    </ReactFlowProvider>
  );
}
