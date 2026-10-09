import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import type { BackendNode, BackendEdge } from "@workspace/canvas";
import type { FrontendActionStepDraft } from "./types";

export interface EnsureActionServiceConnectionParams {
  webPageNodeId: string;
  actionId: string;
  serviceNodeId: string;
  endpointId: string;
  stepOrder: number;
  previousEdgeId?: string;
}

export function ensureActionServiceConnection({
  webPageNodeId,
  actionId,
  serviceNodeId,
  endpointId,
  stepOrder,
  previousEdgeId,
}: EnsureActionServiceConnectionParams): string | undefined {
  if (!webPageNodeId || !actionId || !serviceNodeId || !endpointId) return undefined;

  const store = useBackendCanvasStore.getState();
  const sourceHandle = `events-${actionId}`;
  const targetHandle = `endpoint-in-${endpointId}`;

  // 1. Identify previous edge for this step (if any)
  const prevEdge =
    (previousEdgeId ? store.edges.find((e) => e.id === previousEdgeId) : undefined) ||
    store.edges.find(
      (e) =>
        e.source === webPageNodeId &&
        e.sourceHandle === sourceHandle &&
        (e.data?.sequenceOrder === stepOrder ||
          e.data?.label === String(stepOrder)),
    );

  // 2. Find existing edge already targeting this exact service & endpoint
  const existingTargetEdge = store.edges.find((e) => {
    const forwardMatch =
      e.source === webPageNodeId &&
      e.target === serviceNodeId &&
      e.sourceHandle === sourceHandle &&
      (e.targetHandle === targetHandle ||
        e.targetHandle === `func-in-${endpointId}` ||
        e.targetHandle?.includes(endpointId));
    return forwardMatch;
  });

  if (prevEdge) {
    // If an edge to the target already exists and is distinct from prevEdge, remove prevEdge
    if (existingTargetEdge && existingTargetEdge.id !== prevEdge.id) {
      store.deleteEdge(prevEdge.id);
      if (
        existingTargetEdge.targetHandle !== targetHandle ||
        existingTargetEdge.data?.sequenceOrder !== stepOrder ||
        existingTargetEdge.data?.label !== String(stepOrder)
      ) {
        store.updateEdge(existingTargetEdge.id, {
          targetHandle,
          data: {
            ...existingTargetEdge.data,
            sequenceOrder: stepOrder,
            label: String(stepOrder),
          },
        });
      }
      return existingTargetEdge.id;
    }

    // Otherwise, update prevEdge to the new service and endpoint
    const oldTargetId = prevEdge.target;
    store.updateEdge(prevEdge.id, {
      target: serviceNodeId,
      targetHandle,
      data: {
        ...prevEdge.data,
        sequenceOrder: stepOrder,
        label: String(stepOrder),
      },
    });

    // If prevEdge was previously pointing to an orphaned StorageBucketRefNode, clean it up
    if (oldTargetId !== serviceNodeId) {
      const remainingEdges = store.edges.filter(
        (e) => e.id !== prevEdge.id && (e.target === oldTargetId || e.source === oldTargetId),
      );
      const oldNode = store.nodes.find((n) => n.id === oldTargetId);
      if (
        remainingEdges.length === 0 &&
        oldNode &&
        (oldNode.type === "StorageBucketRefNode" ||
          oldNode.type === "storage_ref" ||
          oldNode.type === "storage_operation_ref")
      ) {
        store.deleteNode(oldTargetId);
      }
    }

    return prevEdge.id;
  }

  if (existingTargetEdge) {
    if (
      existingTargetEdge.targetHandle !== targetHandle ||
      existingTargetEdge.data?.sequenceOrder !== stepOrder ||
      existingTargetEdge.data?.label !== String(stepOrder)
    ) {
      store.updateEdge(existingTargetEdge.id, {
        targetHandle,
        data: {
          ...existingTargetEdge.data,
          sequenceOrder: stepOrder,
          label: String(stepOrder),
        },
      });
    }
    return existingTargetEdge.id;
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
  previousEdgeId?: string;
}

export function ensureActionStorageConnection({
  webPageNodeId,
  actionId,
  storageNodeId,
  bucketId,
  stepOrder,
  previousEdgeId,
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

    // Resolve the human-readable bucket name from the storage node's buckets array
    const storageBuckets = (storageNode?.data?.buckets ?? []) as Array<{
      id?: string;
      name?: string;
    }>;
    const matchedBucket = storageBuckets.find(
      (b) => b.id === bucketId || b.name === bucketId,
    );
    const resolvedBucketName = matchedBucket?.name || bucketId;
    const resolvedBucketId = matchedBucket?.id || bucketId;

    const newRefNodeId = `storage-ref-${resolvedBucketId}-${Date.now()}`;
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
        label: resolvedBucketName,
        bucketId: resolvedBucketId,
        bucketName: resolvedBucketName,
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

  // 3. Identify previous edge for this step (if any)
  const prevEdge =
    (previousEdgeId ? store.edges.find((e) => e.id === previousEdgeId) : undefined) ||
    store.edges.find(
      (e) =>
        e.source === webPageNodeId &&
        e.sourceHandle === sourceHandle &&
        (e.data?.sequenceOrder === stepOrder ||
          e.data?.label === String(stepOrder)),
    );

  // 4. Look for existing edge to this ref node
  const existingEdge = store.edges.find(
    (e) =>
      e.source === webPageNodeId &&
      e.target === refNode!.id &&
      e.sourceHandle === sourceHandle,
  );

  if (prevEdge) {
    if (existingEdge && existingEdge.id !== prevEdge.id) {
      store.deleteEdge(prevEdge.id);
      if (
        existingEdge.data?.sequenceOrder !== stepOrder ||
        existingEdge.data?.label !== String(stepOrder) ||
        existingEdge.data?.bucketId !== bucketId
      ) {
        store.updateEdge(existingEdge.id, {
          targetHandle,
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

    const oldTargetNodeId = prevEdge.target;
    store.updateEdge(prevEdge.id, {
      target: refNode.id,
      targetHandle,
      data: {
        ...prevEdge.data,
        sequenceOrder: stepOrder,
        label: String(stepOrder),
        operationName: "uploadObject",
        bucketId,
      },
    });

    if (oldTargetNodeId !== refNode.id) {
      const remainingEdges = store.edges.filter(
        (e) => e.id !== prevEdge.id && (e.target === oldTargetNodeId || e.source === oldTargetNodeId),
      );
      const oldNode = store.nodes.find((n) => n.id === oldTargetNodeId);
      if (
        remainingEdges.length === 0 &&
        oldNode &&
        (oldNode.type === "StorageBucketRefNode" ||
          oldNode.type === "storage_ref" ||
          oldNode.type === "storage_operation_ref")
      ) {
        store.deleteNode(oldTargetNodeId);
      }
    }

    return { edgeId: prevEdge.id, refNodeId: refNode.id };
  }

  if (existingEdge) {
    if (
      existingEdge.data?.sequenceOrder !== stepOrder ||
      existingEdge.data?.label !== String(stepOrder) ||
      existingEdge.data?.bucketId !== bucketId
    ) {
      store.updateEdge(existingEdge.id, {
        targetHandle,
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

  // Draw new edge to storage bucket ref
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
