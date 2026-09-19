"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { Id } from "@workspace/backend/_generated/dataModel";
import { Terminal } from "./terminal/Terminal";

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
    </div>
  );
}
