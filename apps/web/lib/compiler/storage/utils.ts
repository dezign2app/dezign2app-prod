import { BackendNode, BackendEdge } from "@/types/canvas";
import { Endpoint, AnyMessagingResource } from "@workspace/canvas/types";

/** Convert a label like "Media Storage" → "media-storage" */
export function toStorageFolderName(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "storage"
  );
}

/** Convert a bucket name like "user-uploads" → "USER_UPLOADS" */
export function toBucketKey(name: string): string {
  if (!name) return "BUCKET";
  const cleaned = name
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return cleaned || "BUCKET";
}

/**
 * Checks if a given node is an object storage node.
 */
export function isStorageNode(n: BackendNode): boolean {
  return n.type === "storage";
}

/**
 * Determines whether a specific service or web app node is actively connected to any storage node.
 */
export function isServiceConnectedToStorage(
  serviceNode: BackendNode,
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = [],
  endpoints: (Endpoint & { nodeId?: string })[] = [],
  events: (AnyMessagingResource & { nodeId?: string })[] = [],
): boolean {
  const storageNodes = allNodes.filter(isStorageNode);
  if (storageNodes.length === 0) return false;

  const storageNodeIds = new Set(storageNodes.map((s) => s.id));
  const storageBucketIds = new Set(
    storageNodes.flatMap((s) => (s.data?.buckets || []).map((b) => b.id)),
  );

  // 1. Direct or handle-based edges between service and storage node
  const serviceEndpoints = [
    ...(serviceNode.data?.endpoints || []),
    ...(serviceNode.data?.routeGroups?.flatMap((rg) => rg.endpoints || []) || []),
    ...endpoints.filter((ep) => ep.nodeId === serviceNode.id),
  ];
  const serviceEndpointIds = new Set(serviceEndpoints.map((ep) => ep.id));

  const serviceEvents = [
    ...(serviceNode.data?.publishedEvents || []),
    ...(serviceNode.data?.consumedEvents || []),
    ...events.filter((ev) => ev.nodeId === serviceNode.id),
  ];
  const serviceEventIds = new Set(serviceEvents.map((ev) => ev.id));

  const hasConnectedEdge = allEdges.some((edge) => {
    if (!edge) return false;
    const isSourceService = edge.source === serviceNode.id;
    const isTargetService = edge.target === serviceNode.id;
    const isSourceStorage = storageNodeIds.has(edge.source);
    const isTargetStorage = storageNodeIds.has(edge.target);

    // Direct edge between service node and storage node
    if ((isSourceService && isTargetStorage) || (isTargetService && isSourceStorage)) {
      return true;
    }

    // Endpoint -> Storage edge
    if (edge.sourceHandle?.startsWith("endpoint-out-")) {
      const epId = edge.sourceHandle.replace("endpoint-out-", "");
      if (serviceEndpointIds.has(epId) && isTargetStorage) return true;
    }

    // Storage handle connections (storage-target or storage-source)
    if (
      (isSourceService && (edge.targetHandle === "storage-target" || edge.targetHandle === "storage-source")) ||
      (isTargetService && (edge.sourceHandle === "storage-target" || edge.sourceHandle === "storage-source"))
    ) {
      return true;
    }

    // Check if handle references a bucket resource ID
    if (isSourceService && edge.targetHandle) {
      for (const bucketId of storageBucketIds) {
        if (edge.targetHandle.includes(bucketId)) return true;
      }
    }
    if (isTargetService && edge.sourceHandle) {
      for (const bucketId of storageBucketIds) {
        if (edge.sourceHandle.includes(bucketId)) return true;
      }
    }

    // Check if connected to a storage reference node (StorageBucketRefNode / StorageOperationRefNode)
    const isRefType = (t?: string) =>
      t === "StorageBucketRefNode" ||
      t === "StorageOperationRefNode" ||
      t === "storage_bucket_ref" ||
      t === "storage_operation_ref" ||
      t === "bucket_ref" ||
      t === "storage_ref";

    const otherId = isSourceService ? edge.target : isTargetService ? edge.source : null;
    if (otherId) {
      const otherNode = allNodes.find((n) => n.id === otherId);
      if (otherNode && isRefType(otherNode.type)) {
        if (otherNode.data.storageNodeId && storageNodeIds.has(otherNode.data.storageNodeId)) {
          return true;
        }
        const refBucket = otherNode.data.bucketId || otherNode.data.bucketName;
        if (refBucket) {
          const match = storageNodes.some((s) =>
            (s.data.buckets || []).some((b) => b.id === refBucket || b.name === refBucket),
          );
          if (match) return true;
        }
        const hasRefEdgeToStorage = allEdges.some(
          (e) =>
            (e.type === "storage-reference" || e.type === "reference") &&
            ((e.source === otherNode.id && storageNodeIds.has(e.target)) ||
              (e.target === otherNode.id && storageNodeIds.has(e.source))),
        );
        if (hasRefEdgeToStorage) return true;
        if (storageNodes.length === 1) return true;
      }
    }

    return false;
  });

  if (hasConnectedEdge) return true;

  // 2. Direct data properties (e.g. from WebPage upload config or Service config)
  if (
    serviceNode.data?.connectedStorageNodeId &&
    storageNodeIds.has(serviceNode.data.connectedStorageNodeId)
  ) {
    return true;
  }
  if (serviceNode.data?.uploadBucketId) {
    const bucket = serviceNode.data.uploadBucketId;
    const match = storageNodes.some((s) =>
      (s.data?.buckets || []).some((b: any) => b.id === bucket || b.name === bucket),
    );
    if (match) return true;
  }

  // 3. Endpoint pipeline steps referencing storage operations
  const hasStoragePipelineStep = serviceEndpoints.some((ep) =>
    ep.pipelineSteps?.some(
      (s: { type?: string; storageNodeId?: string; bucketId?: string; functionRef?: { importPath?: string } }) =>
        s.type === "storage_operation" ||
        s.type === "storage" ||
        (s.functionRef?.importPath && s.functionRef.importPath.includes("storage")) ||
        (s.storageNodeId && storageNodeIds.has(s.storageNodeId)) ||
        (s.bucketId &&
          storageNodes.some((sn) =>
            (sn.data?.buckets || []).some((b: { id?: string; name?: string }) => b.id === s.bucketId || b.name === s.bucketId),
          )),
    ),
  );
  if (hasStoragePipelineStep) return true;

  // 4. UI Section / Event Action bindings (for WebPages or WebApps)
  const pageSections = (serviceNode.data?.sections || []) as any[];
  const hasActionStorageBinding = pageSections.some((sec) =>
    (sec.actions || []).some(
      (act: any) =>
        act.storageOperationBinding?.storageNodeId &&
        storageNodeIds.has(act.storageOperationBinding.storageNodeId),
    ),
  );
  if (hasActionStorageBinding) return true;

  const pageEvents = (serviceNode.data?.events || []) as any[];
  const hasEventStorageBinding = pageEvents.some(
    (ev: any) =>
      ev.storageOperationBinding?.storageNodeId &&
      storageNodeIds.has(ev.storageOperationBinding.storageNodeId),
  );
  if (hasEventStorageBinding) return true;

  // 5. Events or endpoints referencing a storage node or bucket ID
  const allEvents = [
    ...serviceEvents,
    ...serviceEndpoints.flatMap((ep) => ep.publishedEvents || []),
  ];

  const hasStorageRef = allEvents.some((ev) => {
    const brokerId =
      "brokerNodeId" in ev && typeof ev.brokerNodeId === "string"
        ? ev.brokerNodeId
        : "";
    const resId =
      "messagingResourceId" in ev && typeof ev.messagingResourceId === "string"
        ? ev.messagingResourceId
        : "";
    if (brokerId && storageNodeIds.has(brokerId)) return true;
    if (resId && storageBucketIds.has(resId)) return true;
    return false;
  });

  return hasStorageRef;
}
