"use client";

import React from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { BackendCanvasView } from "@/types/canvas";
import { ChatContainer } from "@/app/(protected)/_components/chat/chat-container";
import { ConfigSidebar } from "./ConfigSidebar";
import { useBackendSync } from "./hooks/useBackendSync";
import { SchemaView } from "./SchemaView";
import { GraphView } from "./GraphView";
import { SequenceView } from "./SequenceView";
import { useChatStore } from "@/app/(protected)/_components/chat/chat-store";
import { useSimulationStore } from "@/lib/stores/simulationStore";
import { NodeDeletionDialog } from "./NodeDeletionDialog";

import { Loader2 } from "lucide-react";

interface BackendCanvasProps {
  projectId: string;
  projectName?: string;
  view: BackendCanvasView;
}

function Flow({ projectId, view }: BackendCanvasProps) {
  // Syncs the local zustand store with the remote Convex database
  const { isLoading } = useBackendSync(projectId, view);

  // Syncs the active test case for this project from localStorage
  const testCases = useSimulationStore((s) => s.testCases) ?? [];
  const selectedCaseId = useSimulationStore((s) => s.selectedCaseId);
  const selectTestCase = useSimulationStore((s) => s.selectTestCase);

  React.useEffect(() => {
    if (testCases.length > 0 && !selectedCaseId) {
      const savedId = localStorage.getItem(`active-test-case-${projectId}`);
      if (savedId && testCases.some((tc) => tc.id === savedId)) {
        selectTestCase(savedId);
      }
    }
  }, [testCases.length, selectedCaseId, projectId, selectTestCase]);

  React.useEffect(() => {
    if (selectedCaseId) {
      localStorage.setItem(`active-test-case-${projectId}`, selectedCaseId);
    } else {
      localStorage.removeItem(`active-test-case-${projectId}`);
    }
  }, [selectedCaseId, projectId]);

  // Clear runtime simulation state when switching projects or unmounting the canvas page
  React.useEffect(() => {
    return () => {
      useSimulationStore.getState().clear();
    };
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background text-muted-foreground">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Loading canvas...</span>
        </div>
      </div>
    );
  }

  if (view === "sequence") {
    return <SequenceView key={projectId} />;
  }

  if (view === "schema") {
    return <SchemaView key={projectId} projectId={projectId} />;
  }

  return <GraphView key={projectId} projectId={projectId} />;
}

export function BackendCanvas(props: BackendCanvasProps) {
  React.useEffect(() => {
    useChatStore.setState({ showAIPopup: false });
    useSimulationStore.setState({ terminalOpen: false });
  }, []);

  if (!props.projectId) return null;

  const nodesPendingDeletion = useBackendCanvasStore(
    (s) => s.nodesPendingDeletion,
  );
  const setNodesPendingDeletion = useBackendCanvasStore(
    (s) => s.setNodesPendingDeletion,
  );

  return (
    <>
      <Flow {...props} />
      <NodeDeletionDialog
        open={nodesPendingDeletion.length > 0}
        onOpenChange={(open) => !open && setNodesPendingDeletion([])}
        nodesPendingDeletion={nodesPendingDeletion}
        projectId={props.projectId}
        projectName={props.projectName}
      />
      <ConfigSidebar />
      <ChatContainer />
    </>
  );
}
