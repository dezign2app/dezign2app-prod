import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { PipelineStepDraft } from "../types";
import { flattenAllPipelineSteps } from "../stepConstants";

// ---------------------------------------------------------------------------
// Service Call (Inter-Service Endpoint) Edge Synchronization Helpers
// ---------------------------------------------------------------------------

export interface EnsureServiceCallConnectionParams {
  serviceNodeId?: string;
  endpointId?: string;
  targetServiceId?: string;
  targetEndpointId?: string;
}

export interface CleanupServiceCallConnectionParams {
  serviceNodeId?: string;
  endpointId?: string;
  targetServiceId?: string;
  targetEndpointId?: string;
  remainingSteps: PipelineStepDraft[];
}

/**
 * Ensures an edge exists on canvas from caller service endpoint to callee service endpoint.
 */
export function ensureServiceCallConnection({
  serviceNodeId,
  endpointId,
  targetServiceId,
  targetEndpointId,
}: EnsureServiceCallConnectionParams): string | undefined {
  if (!serviceNodeId || !targetServiceId || serviceNodeId === targetServiceId) {
    return undefined;
  }

  const store = useBackendCanvasStore.getState();
  const allNodes = store.nodes;
  const sourceNode = allNodes.find((n) => n.id === serviceNodeId);
  const targetNode = allNodes.find((n) => n.id === targetServiceId);

  if (!sourceNode || !targetNode) return undefined;

  const sourceHandle = endpointId
    ? `endpoint-out-${endpointId}`
    : `endpoint-out-${serviceNodeId}`;

  const targetHandle = targetEndpointId
    ? `endpoint-in-${targetEndpointId}`
    : `endpoint-in-${targetServiceId}`;

  const currentEdges = store.edges;
  const existingEdge = currentEdges.find(
    (e) =>
      e &&
      e.source === serviceNodeId &&
      e.target === targetServiceId &&
      (e.sourceHandle === sourceHandle || !endpointId) &&
      (e.targetHandle === targetHandle || !targetEndpointId),
  );

  if (existingEdge) return existingEdge.id;

  const edgeId = `edge-service-${serviceNodeId}-${targetServiceId}-${Date.now()}`;
  store.addEdge({
    id: edgeId,
    source: serviceNodeId,
    target: targetServiceId,
    sourceHandle,
    targetHandle,
    type: "connection",
    data: {
      isServiceCall: true,
      targetServiceId,
      targetEndpointId,
      sourceEndpointId: endpointId,
    },
  });

  return edgeId;
}

/**
 * Cleans up an edge from caller service endpoint to callee service endpoint if no remaining
 * service_call steps target that service/endpoint.
 */
export function cleanupServiceCallConnection({
  serviceNodeId,
  endpointId,
  targetServiceId,
  targetEndpointId,
  remainingSteps,
}: CleanupServiceCallConnectionParams): void {
  if (!serviceNodeId || !targetServiceId) return;

  const allFlatRemaining = flattenAllPipelineSteps(remainingSteps);
  const isStillNeeded = allFlatRemaining.some(
    (s: any) =>
      s.type === "service_call" &&
      (s.databaseId === targetServiceId ||
        s.serviceId === targetServiceId ||
        s.externalNodeId === targetServiceId) &&
      (!targetEndpointId ||
        s.tableNodeId === targetEndpointId ||
        s.endpointId === targetEndpointId ||
        s.externalEndpointId === targetEndpointId ||
        s.operationId?.includes(targetEndpointId)),
  );

  if (isStillNeeded) return;

  const store = useBackendCanvasStore.getState();
  const sourceHandle = endpointId
    ? `endpoint-out-${endpointId}`
    : `endpoint-out-${serviceNodeId}`;
  const targetHandle = targetEndpointId
    ? `endpoint-in-${targetEndpointId}`
    : `endpoint-in-${targetServiceId}`;

  const edgesToDelete = store.edges.filter(
    (e) =>
      e &&
      e.source === serviceNodeId &&
      e.target === targetServiceId &&
      (e.sourceHandle === sourceHandle || !endpointId) &&
      (e.targetHandle === targetHandle || !targetEndpointId),
  );

  edgesToDelete.forEach((e) => store.deleteEdge(e.id));
}
