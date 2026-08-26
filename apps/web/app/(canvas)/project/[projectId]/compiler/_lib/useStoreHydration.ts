"use client";

import { useEffect } from "react";
import { FunctionReturnType } from "convex/server";
import { api } from "@workspace/backend/_generated/api";
import { Doc } from "@workspace/backend/_generated/dataModel";
import {
  useBackendCanvasStore,
  parseResourceHandle,
} from "@/lib/stores/backendCanvasStore";
import { useSimulationStore } from "@/lib/stores/simulationStore";
import {
  isBackendNode,
  isBackendEdgeType,
} from "@workspace/canvas";
import {
  endpointSchema,
  publishedEventSchema,
  consumedEventSchema,
  nodeDataSchemas,
} from "@workspace/canvas/schemas";
import {
  BackendNode,
  BackendEdge,
  EndpointWithNode,
  EventWithNode,
  IdentityProviderWithNode,
} from "@/types/canvas";

export type CanvasElements =
  | FunctionReturnType<typeof api.canvas.getBackendElements>
  | undefined;

/**
 * Hydrates the Zustand canvas store from Convex data when the compiler page
 * is opened directly (i.e. without having visited the canvas first).
 * No-ops if the store is already populated for this project.
 */
export function useStoreHydration(
  projectId: string,
  canvasElements: CanvasElements,
) {
  const storeProjectId = useBackendCanvasStore((s) => s.projectId);

  useEffect(() => {
    if (canvasElements === undefined) return; // still loading
    if (storeProjectId === projectId) return; // already hydrated

    const rawNodes: BackendNode[] = (canvasElements.nodes ?? [])
      .filter((row): row is Doc<"canvas_backend_nodes"> & { type: BackendNode["type"] } =>
        isBackendNode(row.type),
      )
      .map((row) => {
        const pos = row.data?.position ?? row.position;
        const schema = nodeDataSchemas[row.type];
        const parsedData = schema
          ? schema.parse(row.data ?? {})
          : { label: row.data?.label || row.nodeId, ...row.data };
        return {
          id: row.nodeId,
          type: row.type,
          position: pos,
          data: {
            ...parsedData,
            position: pos,
          },
          fractionalIndex: row.fractionalIndex,
          parentId: row.data?.parentId,
        };
      });

    const rawEdges: BackendEdge[] = (canvasElements.edges ?? [])
      .filter((row): row is Doc<"canvas_backend_edges"> & { type: BackendEdge["type"] } =>
        isBackendEdgeType(row.type),
      )
      .map((row) => {
        const src = parseResourceHandle(row.sourceHandle);
        const tgt = parseResourceHandle(row.targetHandle);
        return {
          id: row.edgeId,
          source: row.source,
          target: row.target,
          type: row.type,
          sourceHandle: row.sourceHandle ?? undefined,
          targetHandle: row.targetHandle ?? undefined,
          sourceResourceId: src?.resourceId,
          targetResourceId: tgt?.resourceId,
          resourceType: tgt?.resourceType ?? src?.resourceType,
          data: row.data,
          fractionalIndex: row.fractionalIndex,
        };
      });

    const mappedEndpoints: EndpointWithNode[] = (
      canvasElements.endpoints || []
    ).map((ep) => ({
      ...endpointSchema.parse(ep),
      nodeId: ep.nodeId,
    }));

    const mappedEvents: EventWithNode[] = (
      canvasElements.events || []
    ).map((ev): EventWithNode => {
      if (ev.variant === "consume") {
        return {
          ...consumedEventSchema.parse(ev),
          nodeId: ev.nodeId,
          variant: "consume",
        };
      }
      return {
        ...publishedEventSchema.parse(ev),
        nodeId: ev.nodeId,
        variant: "publish",
      };
    });

    const mappedProviders: IdentityProviderWithNode[] = (
      canvasElements.identityProviders || []
    ).map((p) => ({
      ...p,
      id: p.id,
      name: p.name || "Provider",
      nodeId: p.nodeId,
    }));

    useBackendCanvasStore.getState().setNodesAndEdges(
      rawNodes,
      rawEdges,
      mappedEndpoints,
      mappedEvents,
      mappedProviders,
      projectId,
    );

    useSimulationStore
      .getState()
      .setTestCases(canvasElements.testCases || []);
  }, [canvasElements, storeProjectId, projectId]);
}
