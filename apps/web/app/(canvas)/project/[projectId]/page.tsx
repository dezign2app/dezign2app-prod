"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { Id } from "@workspace/backend/_generated/dataModel";
import { useQueryState, parseAsStringEnum } from "nuqs";
import {
  BackendCanvasView,
  BackendNode,
  BackendEdge,
} from "@/types/canvas";
import {
  EndpointWithNode,
  EventWithNode,
  IdentityProviderWithNode,
  useBackendCanvasStore,
} from "@/lib/stores/backendCanvasStore";
import { CanvasToolbar } from "./_components/CanvasToolbar";
import { BackendCanvas } from "./_components/BackendCanvas";
import { AiPanel } from "./_components/AiPanel";
import { CreateCommitDialog } from "./_components/history/CreateCommitDialog";
import { VersionHistoryDrawer } from "./_components/history/VersionHistoryDrawer";
import { VersionPreviewBanner } from "./_components/history/VersionPreviewBanner";
import { useCanvasKeyboardShortcuts } from "./_components/hooks/useCanvasKeyboardShortcuts";
import { Loader2 } from "lucide-react";
import { ReactFlowProvider } from "@xyflow/react";
import { toast } from "sonner";

import { z } from "zod";
import {
  endpointSchema,
  publishedEventSchema,
  consumedEventSchema,
  identityProviderSchema,
} from "@workspace/canvas/schemas";
import { convexNodeToBackendNode } from "@/lib/stores/backendCanvas/utils";



export default function ProjectCanvasPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): React.JSX.Element {
  const { projectId } = React.use(params);

  const [view, setView] = useQueryState<BackendCanvasView>(
    "view",
    parseAsStringEnum<BackendCanvasView>([
      "graph",
      "sequence",
      "schema",
    ]).withDefault("graph"),
  );

  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [previewVersionId, setPreviewVersionId] = useState<Id<"project_versions"> | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Synchronize store canvasView with query state
  const setStoreView = useBackendCanvasStore((s) => s.setView);
  React.useEffect(() => {
    setStoreView(view);
  }, [view, setStoreView]);

  // Enable global keyboard shortcuts (Ctrl+Z / Ctrl+Y) with input isolation
  useCanvasKeyboardShortcuts(true, view);

  // Fetch project basic info to show in toolbar
  const project = useQuery(api.projects.getProjectById, {
    projectId: projectId as Id<"projects">,
  });

  // Fetch preview version details if user clicked Preview in History Drawer
  const previewVersion = useQuery(
    api.canvas.getVersionById,
    previewVersionId ? { versionId: previewVersionId } : "skip",
  );

  const restoreVersion = useMutation(api.canvas.restoreProjectVersion);

  // Load preview snapshot into local canvas store in read-only mode
  useEffect(() => {
    if (previewVersion && previewVersion.snapshot) {
      const { snapshot } = previewVersion;
      const previewNodes: BackendNode[] = (snapshot.nodes || []).map(
        convexNodeToBackendNode,
      );

      const previewEdges: BackendEdge[] = (snapshot.edges || []).map((e) => ({
          id: e.edgeId,
          source: e.source,
          target: e.target,
          type: e.type as BackendEdge["type"],
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          data: e.data,
          fractionalIndex: e.fractionalIndex,
          rulesVersion: e.rulesVersion,
        }));

      const fullEndpointSchema = endpointSchema.extend({ nodeId: z.string() });
      const fullEventSchema = z.union([
        publishedEventSchema.extend({
          nodeId: z.string(),
          variant: z.literal("publish"),
        }),
        consumedEventSchema.extend({
          nodeId: z.string(),
          variant: z.literal("consume"),
        }),
      ]);
      const fullIdentityProviderSchema = identityProviderSchema.extend({
        nodeId: z.string(),
      });

      const rawEndpoints = (snapshot.endpoints || []).map((ep) => ({
          ...ep.data,
          nodeId: ep.nodeId,
          id: ep.endpointId,
        }));
      const previewEndpoints: EndpointWithNode[] = z
        .array(fullEndpointSchema)
        .parse(rawEndpoints);

      const rawEvents = (snapshot.events || []).map((ev) => ({
          ...ev.data,
          nodeId: ev.nodeId,
          variant: ev.variant,
          id: ev.eventId,
        }));
      const previewEvents: EventWithNode[] = z
        .array(fullEventSchema)
        .parse(rawEvents);

      const rawProviders = (snapshot.identityProviders || []).map((p) => ({
          ...p.data,
          nodeId: p.nodeId,
          id: p.providerId,
        }));
      const previewProviders: IdentityProviderWithNode[] = z
        .array(fullIdentityProviderSchema)
        .parse(rawProviders);

      useBackendCanvasStore.getState().setNodesAndEdges(
        previewNodes,
        previewEdges,
        previewEndpoints,
        previewEvents,
        previewProviders,
        projectId,
      );
    }
  }, [previewVersion, projectId]);

  // When exiting preview mode, reset store to trigger live Convex re-hydration
  const prevPreviewIdRef = useRef<Id<"project_versions"> | null>(null);
  useEffect(() => {
    if (prevPreviewIdRef.current && !previewVersionId) {
      useBackendCanvasStore.getState().reset(projectId);
    }
    prevPreviewIdRef.current = previewVersionId;
  }, [previewVersionId, projectId]);

  const handleRestoreFromPreview = async (): Promise<void> => {
    if (!previewVersionId || !previewVersion) return;

    try {
      setIsRestoring(true);
      const result = await restoreVersion({
        projectId: projectId as Id<"projects">,
        versionId: previewVersionId,
      });

      if (result) {
        toast.success(`Restored project to version v${result.restoredVersionNumber}`);
        setPreviewVersionId(null);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to restore version";
      toast.error(errorMessage);
    } finally {
      setIsRestoring(false);
    }
  };

  if (project === undefined) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <p>Project not found.</p>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-full w-full relative">
        <CanvasToolbar
          projectName={project.name}
          projectId={projectId}
          view={view}
          setView={setView}
          aiPanelOpen={aiPanelOpen}
          setAiPanelOpen={setAiPanelOpen}
          onOpenCommit={() => setCommitDialogOpen(true)}
          onOpenHistory={() => setHistoryDrawerOpen(true)}
        />

        {previewVersion && (
          <VersionPreviewBanner
            versionNumber={previewVersion.versionNumber}
            title={previewVersion.title}
            onExitPreview={() => setPreviewVersionId(null)}
            onRestore={() => void handleRestoreFromPreview()}
            isRestoring={isRestoring}
          />
        )}

        <div className="flex-1 relative overflow-hidden flex">
          <div className="flex-1 relative">
            <BackendCanvas projectId={projectId} projectName={project.name} view={view} />
          </div>

          <AiPanel
            projectId={projectId}
            isOpen={aiPanelOpen}
            onClose={() => setAiPanelOpen(false)}
            setView={setView}
          />
        </div>

        {/* Create Checkpoint Modal */}
        <CreateCommitDialog
          projectId={projectId}
          isOpen={commitDialogOpen}
          onClose={() => setCommitDialogOpen(false)}
        />

        {/* History Drawer */}
        <VersionHistoryDrawer
          projectId={projectId}
          isOpen={historyDrawerOpen}
          onClose={() => setHistoryDrawerOpen(false)}
          onPreviewVersion={(verId) => setPreviewVersionId(verId)}
        />
      </div>
    </ReactFlowProvider>
  );
}
