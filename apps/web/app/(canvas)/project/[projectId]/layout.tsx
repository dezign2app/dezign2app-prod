import React from "react";
import { ProjectCanvasLayout } from "./_components/ProjectCanvasLayout";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <ProjectCanvasLayout projectId={projectId}>
      {children}
    </ProjectCanvasLayout>
  );
}
