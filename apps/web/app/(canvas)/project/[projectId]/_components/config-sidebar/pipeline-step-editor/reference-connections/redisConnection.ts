import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { PipelineStepDraft } from "../types";
import { flattenAllPipelineSteps } from "../stepConstants";

// ---------------------------------------------------------------------------
// Redis Cache Node & Edge Synchronization Helpers
// ---------------------------------------------------------------------------

export interface EnsureRedisCacheConnectionParams {
  schemaId?: string;
  instanceId?: string;
  serviceNodeId?: string;
  endpointId?: string;
  consumedEventId?: string;
}

/**
 * Ensures a RedisCacheNode (type="redis-cache") exists on canvas for the given schema/instance
 * and connects the ServiceNode endpoint handle to it.
 */
export function ensureRedisCacheConnection({
  schemaId,
  instanceId,
  serviceNodeId,
  endpointId,
  consumedEventId,
}: EnsureRedisCacheConnectionParams): string | undefined {
  if (!serviceNodeId) return undefined;
  const store = useBackendCanvasStore.getState();
  const allNodes = store.nodes;

  // 1. Look for an existing redis-cache node
  let cacheNode = allNodes.find(
    (n) =>
      n.type === "redis-cache" &&
      ((schemaId && schemaId !== "__direct__" && (n.data?.schemaRef === schemaId || n.id === schemaId)) ||
        (schemaId === "__direct__" && (n.data?.databaseId === instanceId || n.id === instanceId))),
  );

  // If not found by direct match, look by schemaRef
  if (!cacheNode && schemaId && schemaId !== "__direct__" && schemaId !== "__none__") {
    cacheNode = allNodes.find(
      (n) => n.type === "redis-cache" && n.data?.schemaRef === schemaId,
    );
  }

  // 2. If no redis-cache node exists, create one!
  if (!cacheNode) {
    const targetSchemaNode = allNodes.find((n) => n.id === schemaId);
    const serviceNode = allNodes.find((n) => n.id === serviceNodeId);
    const targetInstanceNode = allNodes.find(
      (n) => n.id === (instanceId || targetSchemaNode?.data?.databaseId),
    );

    const schemaLabel =
      targetSchemaNode?.data?.label ||
      (schemaId === "__direct__"
        ? `${targetInstanceNode?.data?.label || "Redis"} Direct`
        : "Redis Cache");

    const newCacheNodeId = crypto.randomUUID();
    const basePos = serviceNode?.position || targetSchemaNode?.position || { x: 300, y: 200 };

    const existingCacheNodes = allNodes.filter((n) => n.type === "redis-cache");
    const yOffset = existingCacheNodes.length * 90;
    const newPos = {
      x: basePos.x - 340,
      y: basePos.y + yOffset,
    };

    store.addNode({
      id: newCacheNodeId,
      type: "redis-cache",
      position: newPos,
      data: {
        label: schemaLabel,
        schemaRef:
          schemaId && schemaId !== "__direct__" && schemaId !== "__none__"
            ? schemaId
            : undefined,
        databaseId: instanceId || targetSchemaNode?.data?.databaseId,
        description: `Reference to ${schemaLabel}`,
      },
    });

    cacheNode = useBackendCanvasStore
      .getState()
      .nodes.find((n) => n.id === newCacheNodeId);
  }

  if (!cacheNode) return undefined;

  // 3. Draw edge from RedisCacheNode database-source handle to ServiceNode endpoint-in handle (or consumedEvents-in)
  const serviceTargetHandle = endpointId
    ? `endpoint-in-${endpointId}`
    : consumedEventId
    ? `consumedEvents-in-${consumedEventId}`
    : `endpoint-in-${serviceNodeId}`;

  const currentEdges = useBackendCanvasStore.getState().edges;
  const existingEdge = currentEdges.find((e) => {
    // Ingress edge (step hanging on left feeding into server): cacheNode -> serviceNode
    const ingressMatch =
      e.source === cacheNode!.id &&
      e.target === serviceNodeId &&
      (e.targetHandle === serviceTargetHandle ||
        !e.targetHandle ||
        (endpointId && e.targetHandle.includes(endpointId)));

    // Backward compatibility with legacy egress edge: serviceNode -> cacheNode
    const legacyEgressMatch =
      e.source === serviceNodeId &&
      e.target === cacheNode!.id &&
      (!e.sourceHandle || (endpointId && e.sourceHandle.includes(endpointId)));

    return ingressMatch || legacyEgressMatch;
  });

  if (!existingEdge) {
    store.addEdge({
      id: `edge-rediscache-${cacheNode.id}-${serviceNodeId}-${endpointId || consumedEventId || "ep"}-${Date.now()}`,
      source: cacheNode.id,
      target: serviceNodeId,
      sourceHandle: "database-source",
      targetHandle: serviceTargetHandle,
      type: "connection",
    });
  }

  // 4. Update endpoint databaseNodeIds if endpointId exists
  if (endpointId) {
    const ep = store.endpoints.find((e) => e.id === endpointId);
    if (ep) {
      const currentDbIds =
        ep.databaseNodeIds ||
        (ep.databaseNodeId && ep.databaseNodeId !== "none"
          ? [ep.databaseNodeId]
          : []);

      if (!currentDbIds.includes(cacheNode.id)) {
        const nextDbIds = [...currentDbIds, cacheNode.id];
        store.updateEndpoint(endpointId, {
          databaseNodeIds: nextDbIds,
          databaseNodeId: nextDbIds[0] || cacheNode.id,
        });
      }
    }
  }

  return cacheNode.id;
}

export interface CleanupRedisCacheConnectionParams {
  tableNodeId?: string;
  databaseId?: string;
  serviceNodeId?: string;
  endpointId?: string;
  consumedEventId?: string;
  remainingSteps: PipelineStepDraft[];
}

/**
 * Cleans up edge(s) connecting the service endpoint to a Redis cache node when
 * the step is deleted or no longer references that cache node.
 */
export function cleanupRedisCacheConnection({
  tableNodeId,
  databaseId,
  serviceNodeId,
  endpointId,
  consumedEventId,
  remainingSteps,
}: CleanupRedisCacheConnectionParams) {
  if (!serviceNodeId) return;
  const store = useBackendCanvasStore.getState();

  // Check if any other redis_operation in remainingSteps still uses this tableNodeId / databaseId
  const allRemainingSteps = flattenAllPipelineSteps(remainingSteps);
  const isStillUsed = allRemainingSteps.some(
    (s) =>
      s.type === "redis_operation" &&
      ((tableNodeId && s.tableNodeId === tableNodeId) ||
        (!tableNodeId && databaseId && s.databaseId === databaseId)),
  );
  if (isStillUsed) return;

  // Find matching redis-cache nodes
  const matchingCacheNodes = store.nodes.filter(
    (n) =>
      n.type === "redis-cache" &&
      ((tableNodeId && (n.id === tableNodeId || n.data?.schemaRef === tableNodeId)) ||
        (!tableNodeId && databaseId && n.data?.databaseId === databaseId)),
  );

  const matchingCacheNodeIds = new Set(matchingCacheNodes.map((n) => n.id));
  if (tableNodeId) matchingCacheNodeIds.add(tableNodeId);

  const edgesToDelete = store.edges.filter((e) => {
    const isServiceSource = e.source === serviceNodeId && matchingCacheNodeIds.has(e.target);
    const isCacheSource = e.target === serviceNodeId && matchingCacheNodeIds.has(e.source);
    if (!isServiceSource && !isCacheSource) return false;
    if (endpointId) {
      const handle = isServiceSource ? e.sourceHandle : e.targetHandle;
      if (handle && !handle.includes(endpointId)) return false;
    }
    if (consumedEventId) {
      const handle = isServiceSource ? e.sourceHandle : e.targetHandle;
      if (handle && !handle.includes(consumedEventId)) return false;
    }
    return true;
  });

  edgesToDelete.forEach((e) => store.deleteEdge(e.id));

  // Cascade deletion of orphaned redis-cache node if no connected edges remain
  matchingCacheNodes.forEach((cacheNode) => {
    const remainingEdges = store.edges.filter(
      (edge) =>
        (edge.target === cacheNode.id || edge.source === cacheNode.id) &&
        !edgesToDelete.some((delEdge) => delEdge.id === edge.id),
    );
    if (remainingEdges.length === 0) {
      store.deleteNode(cacheNode.id);
    }
  });

  // Clean up endpoint databaseNodeIds
  if (endpointId) {
    const ep = store.endpoints.find((e) => e.id === endpointId);
    if (ep && ep.databaseNodeIds) {
      const nextDbIds = ep.databaseNodeIds.filter(
        (id) => !matchingCacheNodeIds.has(id),
      );
      store.updateEndpoint(endpointId, {
        databaseNodeIds: nextDbIds,
        databaseNodeId: nextDbIds[0] || "none",
      });
    }
  }
}
