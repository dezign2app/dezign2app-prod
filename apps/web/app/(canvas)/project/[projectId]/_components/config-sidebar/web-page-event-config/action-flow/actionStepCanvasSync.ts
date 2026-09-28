import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import type { BackendNode, BackendEdge } from "@workspace/canvas";
import type { FrontendActionStepDraft } from "./types";

export interface EnsureActionServiceConnectionParams {
  webPageNodeId: string;
  actionId: string;
  serviceNodeId: string;
  endpointId: string;
  stepOrder: number;
}

export function ensureActionServiceConnection({
  webPageNodeId,
  actionId,
  serviceNodeId,
  endpointId,
  stepOrder,
}: EnsureActionServiceConnectionParams): string | undefined {
  if (!webPageNodeId || !actionId || !serviceNodeId || !endpointId) return undefined;

  const store = useBackendCanvasStore.getState();
  const sourceHandle = `events-${actionId}`;
  const targetHandle = `func-in-${endpointId}`;

  // Find existing edge matching this action and endpoint
  const existingEdge = store.edges.find((e) => {
    const forwardMatch =
      e.source === webPageNodeId &&
      e.target === serviceNodeId &&
      e.sourceHandle === sourceHandle &&
      (e.targetHandle === targetHandle || e.targetHandle?.includes(endpointId));
    return forwardMatch;
  });

  if (existingEdge) {
    // Ensure sequence order is updated if needed
    if (
      existingEdge.data?.sequenceOrder !== stepOrder ||
      existingEdge.data?.label !== String(stepOrder)
    ) {
      store.updateEdge(existingEdge.id, {
        ...existingEdge,
        data: {
          ...existingEdge.data,
          sequenceOrder: stepOrder,
          label: String(stepOrder),
        },
      });
    }
    return existingEdge.id;
  }

  // Draw new edge automatically on canvas
  const newEdgeId = `edge-action-${actionId}-${serviceNodeId}-${endpointId}-${Date.now()}`;
  store.addEdge({
    id: newEdgeId,
    source: webPageNodeId,
    target: serviceNodeId,
    sourceHandle,
    targetHandle,
    type: "connection",
    data: {
      sequenceOrder: stepOrder,
      label: String(stepOrder),
    },
  });

  return newEdgeId;
}

export interface EnsureActionStorageConnectionParams {
  webPageNodeId: string;
  actionId: string;
  storageNodeId?: string;
  bucketId: string;
  stepOrder: number;
}

export function ensureActionStorageConnection({
  webPageNodeId,
  actionId,
  storageNodeId,
  bucketId,
  stepOrder,
}: EnsureActionStorageConnectionParams): { edgeId: string; refNodeId: string } | undefined {
  if (!webPageNodeId || !actionId || !bucketId) return undefined;

  const store = useBackendCanvasStore.getState();
  const allNodes = store.nodes;
  const sourceHandle = `events-${actionId}`;

  // 1. Look for an existing StorageBucketRefNode for this bucket
  let refNode = allNodes.find((n) => {
    const isRefType =
      n.type === "storage_operation_ref" ||
      n.type === "storage_ref" ||
      n.type === "StorageBucketRefNode";
    if (!isRefType) return false;
    return n.data?.bucketId === bucketId || n.data?.bucketName === bucketId;
  });

  // 2. If no ref node exists on canvas, create one!
  if (!refNode) {
    const webPageNode = allNodes.find((n) => n.id === webPageNodeId);
    const storageNode =
      allNodes.find((n) => n.id === storageNodeId) ||
      allNodes.find((n) => n.type === "storage");

    const newRefNodeId = `storage-ref-${bucketId}-${Date.now()}`;
    const basePos = webPageNode?.position || { x: 300, y: 300 };
    const existingRefNodes = allNodes.filter(
      (n) =>
        n.type === "storage_operation_ref" ||
        n.type === "storage_ref" ||
        n.type === "StorageBucketRefNode",
    );
    const offset = (existingRefNodes.length + 1) * 80;

    store.addNode({
      id: newRefNodeId,
      type: "StorageBucketRefNode",
      position: {
        x: basePos.x + 360,
        y: basePos.y + offset,
      },
      data: {
        label: bucketId,
        bucketId,
        bucketName: bucketId,
        storageNodeId: storageNode?.id || storageNodeId,
        storageOperations: [
          {
            id: "op-upload",
            name: "uploadObject",
            kind: "presign_upload",
            label: "Upload Object (PUT)",
          },
        ],
      },
    });

    refNode = useBackendCanvasStore.getState().nodes.find((n) => n.id === newRefNodeId);
  }

  if (!refNode) return undefined;

  const targetHandle = "func-in-uploadObject";

  // 3. Look for existing edge to this ref node
  const existingEdge = store.edges.find(
    (e) =>
      e.source === webPageNodeId &&
      e.target === refNode!.id &&
      e.sourceHandle === sourceHandle,
  );

  if (existingEdge) {
    if (
      existingEdge.data?.sequenceOrder !== stepOrder ||
      existingEdge.data?.label !== String(stepOrder)
    ) {
      store.updateEdge(existingEdge.id, {
        ...existingEdge,
        data: {
          ...existingEdge.data,
          sequenceOrder: stepOrder,
          label: String(stepOrder),
          operationName: "uploadObject",
          bucketId,
        },
      });
    }
    return { edgeId: existingEdge.id, refNodeId: refNode.id };
  }

  // 4. Draw new edge to storage bucket ref
  const newEdgeId = `edge-action-${actionId}-${refNode.id}-${Date.now()}`;
  store.addEdge({
    id: newEdgeId,
    source: webPageNodeId,
    target: refNode.id,
    sourceHandle,
    targetHandle,
    type: "connection",
    data: {
      sequenceOrder: stepOrder,
      label: String(stepOrder),
      operationName: "uploadObject",
      bucketId,
    },
  });

  return { edgeId: newEdgeId, refNodeId: refNode.id };
}

export function cleanupActionStepEdge(edgeId: string): void {
  if (!edgeId) return;
  const store = useBackendCanvasStore.getState();
  store.deleteEdge(edgeId);
}

export function reorderActionStepEdges(
  steps: FrontendActionStepDraft[],
  webPageNodeId: string,
  actionId: string,
): void {
  const store = useBackendCanvasStore.getState();
  const sourceHandle = `events-${actionId}`;

  steps.forEach((step, idx) => {
    const newOrder = idx + 1;
    if (step.edgeId) {
      const edge = store.edges.find((e) => e.id === step.edgeId);
      if (edge && (edge.data?.sequenceOrder !== newOrder || edge.data?.label !== String(newOrder))) {
        store.updateEdge(edge.id, {
          ...edge,
          data: {
            ...edge.data,
            sequenceOrder: newOrder,
            label: String(newOrder),
          },
        });
      }
    }
  });
}
