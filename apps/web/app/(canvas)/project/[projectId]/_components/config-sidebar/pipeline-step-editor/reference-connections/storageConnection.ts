import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import {
  getStorageOperations,
  StorageOperationFunction,
  StorageOperationKind,
} from "@/lib/utils/storageOperationsHelper";
import { PipelineStepDraft } from "../types";
import { flattenAllPipelineSteps } from "../stepConstants";

// ---------------------------------------------------------------------------
// Storage Operation Ref Node & Edge Synchronization Helpers
// ---------------------------------------------------------------------------

export interface EnsureStorageOperationRefConnectionParams {
  storageNodeId?: string;
  bucketId?: string;
  serviceNodeId?: string;
  endpointId?: string;
  consumedEventId?: string;
  functionName?: string;
}

export interface StorageOperationRefConnectionResult {
  storageRefNodeId: string;
  edgeId?: string;
  functionName?: string;
}

export interface CleanupStorageOperationRefConnectionParams {
  storageNodeId?: string;
  bucketId?: string;
  serviceNodeId?: string;
  endpointId?: string;
  consumedEventId?: string;
  functionName?: string;
  remainingSteps: PipelineStepDraft[];
}

/**
 * Ensures a single storage_operation_ref node exists for the target bucket/storage node per service,
 * and creates an edge targeting the specific operation function handle (`func-${functionName}`).
 */
export function ensureStorageOperationRefConnection({
  storageNodeId,
  bucketId,
  serviceNodeId,
  endpointId,
  consumedEventId,
  functionName,
}: EnsureStorageOperationRefConnectionParams): StorageOperationRefConnectionResult | undefined {
  if (!serviceNodeId) return undefined;

  const store = useBackendCanvasStore.getState();
  const allNodes = store.nodes;
  const edges = store.edges;

  // 1. Look for existing storage_operation_ref node associated with this serviceNodeId
  let refNode = allNodes.find((n) => {
    if (
      n.type !== "storage_operation_ref" &&
      n.type !== "storage_ref" &&
      n.type !== "bucket_ref" &&
      n.type !== "storage_bucket_ref" &&
      n.type !== "StorageBucketRefNode"
    )
      return false;
    const matchesStorage = !storageNodeId || n.data?.storageNodeId === storageNodeId;
    const matchesBucket =
      !bucketId || n.data?.bucketId === bucketId || n.data?.bucketName === bucketId;
    if (!matchesStorage || !matchesBucket) return false;

    const isConnectedToThisService = edges.some(
      (e) =>
        (e.source === serviceNodeId && e.target === n.id) ||
        (e.target === serviceNodeId && e.source === n.id),
    );
    const isTaggedForService = n.data?.targetServiceId === serviceNodeId;
    return isConnectedToThisService || isTaggedForService;
  });

  // If not found, check if an unattached storage_operation_ref matches bucket
  if (!refNode && bucketId) {
    refNode = allNodes.find((n) => {
      if (
        n.type !== "storage_operation_ref" &&
        n.type !== "storage_ref" &&
        n.type !== "bucket_ref" &&
        n.type !== "storage_bucket_ref" &&
        n.type !== "StorageBucketRefNode"
      )
        return false;
      const matchesBucket =
        n.data?.bucketId === bucketId || n.data?.bucketName === bucketId;
      if (!matchesBucket) return false;
      const isClaimedByOther =
        Boolean(n.data?.targetServiceId && n.data?.targetServiceId !== serviceNodeId) ||
        edges.some(
          (e) =>
            (e.target === n.id && e.source !== serviceNodeId) ||
            (e.source === n.id && e.target !== serviceNodeId),
        );
      return !isClaimedByOther;
    });
  }

  // 2. If no storage_operation_ref node exists, create one!
  if (!refNode) {
    const allStorageNodes = allNodes.filter((n) => n.type === "storage");
    const targetStorageNode =
      allStorageNodes.find((n) => n.id === storageNodeId) || allStorageNodes[0];
    const serviceNode = allNodes.find((n) => n.id === serviceNodeId);

    const resolvedStorageId = targetStorageNode?.id || storageNodeId;
    const targetBuckets = targetStorageNode?.data?.buckets || [];
    const resolvedBucket =
      bucketId || targetBuckets[0]?.name || "default-bucket";
    const bucketLabel = `${resolvedBucket}`;

    const newRefId = crypto.randomUUID();
    const basePos =
      serviceNode?.position || targetStorageNode?.position || { x: 300, y: 200 };

    const existingRefNodes = allNodes.filter(
      (n) =>
        n.type === "storage_operation_ref" ||
        n.type === "storage_ref" ||
        n.type === "bucket_ref" ||
        n.type === "storage_bucket_ref" ||
        n.type === "StorageBucketRefNode" ||
        n.type === "db_ref" ||
        n.type === "redis-cache",
    );
    const yOffset = existingRefNodes.length * 110;
    const newPos = {
      x: basePos.x - 340,
      y: basePos.y + yOffset,
    };

    store.addNode({
      id: newRefId,
      type: "storage_operation_ref",
      position: newPos,
      data: {
        label: bucketLabel,
        storageNodeId: resolvedStorageId,
        storageProvider: targetStorageNode?.data?.storageProvider || "s3",
        bucketId: resolvedBucket,
        bucketName: resolvedBucket,
        targetServiceId: serviceNodeId,
        description: `Reference to ${resolvedBucket} on ${targetStorageNode?.data?.label || "Storage"}`,
      },
    });

    refNode = useBackendCanvasStore
      .getState()
      .nodes.find((n) => n.id === newRefId);
  }

  if (!refNode) return undefined;

  // 3. Ensure invisible reference edge exists between bucket on StorageNode and this ref node header
  const effectiveStorageId = storageNodeId || refNode.data?.storageNodeId;
  const effectiveBucket = bucketId || refNode.data?.bucketId || refNode.data?.bucketName;
  if (effectiveStorageId && effectiveBucket) {
    const targetStorage = allNodes.find((n) => n.id === effectiveStorageId);
    const bucketObj = targetStorage?.data?.buckets?.find(
      (b) => b.id === effectiveBucket || b.name === effectiveBucket,
    );
    const resolvedBucketId = bucketObj?.id || effectiveBucket;
    const refSourceHandle = `buckets:out:${resolvedBucketId}`;
    const legacyRefSourceHandle = `bucket:out:${resolvedBucketId}`;
    const refTargetHandle = "storage-ref-header";

    const hasRefEdge = store.edges.some(
      (e) =>
        (e.type === "storage-reference" || e.type === "reference") &&
        e.source === effectiveStorageId &&
        e.target === refNode!.id &&
        (e.sourceHandle === refSourceHandle ||
          e.sourceHandle === legacyRefSourceHandle ||
          !e.sourceHandle),
    );
    if (!hasRefEdge) {
      store.addEdge({
        id: `edge-storage-ref-${effectiveStorageId}-${resolvedBucketId}-${refNode.id}`,
        source: effectiveStorageId,
        target: refNode.id,
        sourceHandle: refSourceHandle,
        targetHandle: refTargetHandle,
        type: "storage-reference",
      });
    }
  }

  // 4. Target handle: specific function on storage ref node
  const resolvedFnName = functionName || "uploadObject";
  const refSourceHandle = `func-out-${resolvedFnName}`;

  // 5. Ensure this operation is added to the refNode data so it displays in the operations list
  const currentOps: StorageOperationFunction[] = Array.isArray(refNode.data?.storageOperations)
    ? refNode.data.storageOperations
    : [];
  if (!currentOps.some((o) => o.name === resolvedFnName || o.id === resolvedFnName)) {
    const targetStorage = allNodes.find((n) => n.id === effectiveStorageId);
    const availableOps = getStorageOperations(targetStorage);
    const inferredKind: StorageOperationKind = resolvedFnName.includes("download")
      ? "download"
      : resolvedFnName.includes("delete")
      ? "delete"
      : resolvedFnName.includes("presign")
      ? "presign_upload"
      : "upload";

    const foundOp: StorageOperationFunction =
      availableOps.find((o) => o.name === resolvedFnName || o.id === resolvedFnName) || {
        id: resolvedFnName,
        name: resolvedFnName,
        kind: inferredKind,
      };
    store.updateNode(refNode.id, {
      data: {
        ...refNode.data,
        storageOperations: [...currentOps, foundOp],
      },
    });
  }

  // 6. Target handle on service node (endpoint-in)
  const serviceTargetHandle = endpointId
    ? `endpoint-in-${endpointId}`
    : consumedEventId
    ? `consumedEvents-in-${consumedEventId}`
    : `endpoint-in-${serviceNodeId}`;

  const currentEdges = useBackendCanvasStore.getState().edges;
  const existingEdge = currentEdges.find((e) => {
    // Ingress edge (step hanging on left feeding into server): refNode -> serviceNode
    const ingressMatch =
      e.source === refNode!.id &&
      e.target === serviceNodeId &&
      (e.targetHandle === serviceTargetHandle ||
        !e.targetHandle ||
        (endpointId && e.targetHandle.includes(endpointId))) &&
      (e.sourceHandle === refSourceHandle ||
        !e.sourceHandle ||
        (resolvedFnName && e.sourceHandle.includes(resolvedFnName)));

    // Backward compatibility with legacy egress edge: serviceNode -> refNode
    const legacyEgressMatch =
      e.source === serviceNodeId &&
      e.target === refNode!.id &&
      (!e.sourceHandle || (endpointId && e.sourceHandle.includes(endpointId))) &&
      (!e.targetHandle || (resolvedFnName && e.targetHandle.includes(resolvedFnName)));

    return ingressMatch || legacyEgressMatch;
  });

  if (!existingEdge) {
    store.addEdge({
      id: `edge-storageref-${refNode.id}-${serviceNodeId}-${endpointId || consumedEventId || "ep"}-${resolvedFnName || "fn"}-${Date.now()}`,
      source: refNode.id,
      target: serviceNodeId,
      sourceHandle: refSourceHandle,
      targetHandle: serviceTargetHandle,
      type: "connection",
    });
  }

  return {
    storageRefNodeId: refNode.id,
    edgeId: existingEdge?.id,
    functionName: resolvedFnName,
  };
}

/**
 * Cleans up edge(s) connecting the service endpoint to a storage_operation_ref node / function
 * when the step is deleted or changes function/bucket.
 */
export function cleanupStorageOperationRefConnection({
  storageNodeId,
  bucketId,
  serviceNodeId,
  endpointId,
  consumedEventId,
  functionName,
  remainingSteps,
}: CleanupStorageOperationRefConnectionParams) {
  if (!serviceNodeId) return;
  const store = useBackendCanvasStore.getState();

  // Check if function or bucket is still used by another step
  const allRemainingSteps = flattenAllPipelineSteps(remainingSteps);
  const isFunctionStillUsed = allRemainingSteps.some(
    (s) =>
      s.type === "storage_operation" &&
      (!functionName || s.functionRef?.name === functionName || s.operationId === functionName) &&
      (!bucketId || s.bucketId === bucketId) &&
      (!storageNodeId || s.storageNodeId === storageNodeId),
  );

  const isBucketStillUsed = allRemainingSteps.some(
    (s) =>
      s.type === "storage_operation" &&
      (!bucketId || s.bucketId === bucketId) &&
      (!storageNodeId || s.storageNodeId === storageNodeId),
  );

  const matchingRefNodes = store.nodes.filter((n) => {
    if (
      n.type !== "storage_operation_ref" &&
      n.type !== "storage_ref" &&
      n.type !== "bucket_ref" &&
      n.type !== "storage_bucket_ref" &&
      n.type !== "StorageBucketRefNode"
    )
      return false;
    const matchesStorage = !storageNodeId || n.data?.storageNodeId === storageNodeId;
    const matchesBucket =
      !bucketId || n.data?.bucketId === bucketId || n.data?.bucketName === bucketId;
    return matchesStorage && matchesBucket;
  });

  const matchingNodeIds = new Set<string>(matchingRefNodes.map((n) => n.id));

  // 1. If function is no longer used, remove edges to that function
  if (!isFunctionStillUsed) {
    const edgesToDelete = store.edges.filter((e) => {
      const isServiceSource = e.source === serviceNodeId && matchingNodeIds.has(e.target);
      const isRefSource = e.target === serviceNodeId && matchingNodeIds.has(e.source);
      if (!isServiceSource && !isRefSource) return false;
      const serviceH = isServiceSource ? e.sourceHandle : e.targetHandle;
      if (endpointId && serviceH && !serviceH.includes(endpointId)) return false;
      if (consumedEventId && serviceH && !serviceH.includes(consumedEventId)) return false;
      if (functionName) {
        const refH = isServiceSource ? e.targetHandle : e.sourceHandle;
        return Boolean(refH && refH.includes(functionName));
      }
      return !isBucketStillUsed;
    });

    edgesToDelete.forEach((e) => store.deleteEdge(e.id));
  }
}
