"use client";

import React, { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { Id } from "@workspace/backend/_generated/dataModel";
import { toast } from "sonner";
import { Terminal } from "./terminal/Terminal";
import { useTerminalWorkspace } from "./terminal/hooks/useTerminalWorkspace";
import { ProjectFolderModal } from "./ProjectFolderModal";
import { useSidebarStore } from "@/lib/stores/sidebarStore";

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

  const projectFolderModalOpen = useSidebarStore(
    (s) => s.projectFolderModalOpen
  );
  const setProjectFolderModalOpen = useSidebarStore(
    (s) => s.setProjectFolderModalOpen
  );

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
          outputDir.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || outputDir;
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
    <div className="flex-1 w-full h-full min-h-0 flex flex-col overflow-hidden relative">
      {/* Active Route Workspace (Canvas, Compiler, Schemas, Pages, etc.) */}
      <div className="flex-1 min-h-0 w-full relative overflow-hidden flex flex-col">
        {children}
      </div>

      {/* Global Persistent Bottom Terminal - Preserved across all tab and route navigations */}
      <Terminal
        projectId={projectId}
        projectName={project?.name || "Dezign2App"}
      />

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
  );
}

