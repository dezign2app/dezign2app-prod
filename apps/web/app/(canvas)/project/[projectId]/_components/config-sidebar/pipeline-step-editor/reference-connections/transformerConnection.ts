import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { BackendNode } from "@workspace/canvas/types";
import { PipelineStepDraft } from "../types";
import { flattenAllPipelineSteps } from "../stepConstants";

// ---------------------------------------------------------------------------
// Transformer Ref Node & Edge Synchronization Helpers
// ---------------------------------------------------------------------------

export interface EnsureTransformerConnectionParams {
  transformerNodeId?: string;
  functionName?: string;
  serviceNodeId?: string;
  endpointId?: string;
  consumedEventId?: string;
  allNodes?: BackendNode[];
}

export interface TransformerConnectionResult {
  transformerNodeId: string;
  edgeId?: string;
}

export interface CleanupTransformerConnectionParams {
  transformerNodeId?: string;
  functionName?: string;
  serviceNodeId?: string;
  endpointId?: string;
  consumedEventId?: string;
  remainingSteps: PipelineStepDraft[];
}

export function ensureTransformerConnection({
  transformerNodeId,
  functionName,
  serviceNodeId,
  endpointId,
  consumedEventId,
  allNodes: passedNodes,
}: EnsureTransformerConnectionParams): TransformerConnectionResult | undefined {
  if (!serviceNodeId) return undefined;
  const targetId = endpointId || consumedEventId;
  if (!targetId) return undefined;

  const store = useBackendCanvasStore.getState();
  const allNodes = passedNodes && passedNodes.length > 0 ? passedNodes : store.nodes;

  const targetHandle = endpointId
    ? (endpointId.startsWith("endpoint-in-") ? endpointId : `endpoint-in-${endpointId}`)
    : (consumedEventId!.startsWith("consumedEvents-in-") ? consumedEventId! : `consumedEvents-in-${consumedEventId}`);

  // Find the transformer node
  const masterTransformerNode = allNodes.find(
    (n) =>
      (n.type === "transformer" || n.type === "transformer_ref") &&
      ((transformerNodeId && (n.id === transformerNodeId || (n.type === "transformer_ref" && n.data?.transformerRef === transformerNodeId))) ||
        (functionName && (n.data?.functionName === functionName || n.data?.label === functionName || n.id === functionName))),
  );

  const isGlobal =
    masterTransformerNode?.type === "transformer_ref" ||
    masterTransformerNode?.data?.scope === "global" ||
    masterTransformerNode?.data?.isGlobal === true;
  const masterId = masterTransformerNode?.type === "transformer_ref"
    ? masterTransformerNode.data?.transformerRef || masterTransformerNode.id
    : masterTransformerNode?.id || transformerNodeId;

  if (isGlobal && masterId) {
    const serviceNode = allNodes.find((n) => n.id === serviceNodeId);

    // 1 Ref per service rule: Check if a transformer_ref node already exists on canvas for this service
    const existingRefNode = store.nodes.find(
      (n) =>
        n.type === "transformer_ref" &&
        (n.data?.targetServiceId === serviceNodeId ||
          store.edges.some((e) => e.source === n.id && e.target === serviceNodeId)),
    );

    let refNodeId = existingRefNode?.id;

    if (!refNodeId) {
      refNodeId = crypto.randomUUID();
      const serviceX = serviceNode?.position?.x ?? 0;
      const serviceY = serviceNode?.position?.y ?? 0;

      store.addNode({
        id: refNodeId,
        type: "transformer_ref",
        position: {
          x: Math.max(0, serviceX - 300),
          y: serviceY + 40,
        },
        data: {
          label: `${functionName || masterTransformerNode?.data?.label || "Transformer"} (Ref)`,
          transformerRef: masterId,
          targetServiceId: serviceNodeId,
          targetEndpointId: endpointId,
          targetEndpointIds: endpointId ? [endpointId] : [],
          targetEventId: consumedEventId,
          targetEventIds: consumedEventId ? [consumedEventId] : [],
        },
      });
    } else {
      const currentLiveRef = store.nodes.find((n) => n.id === refNodeId);
      if (currentLiveRef?.data) {
        const currentEpIds: string[] =
          currentLiveRef.data.targetEndpointIds ||
          (currentLiveRef.data.targetEndpointId ? [currentLiveRef.data.targetEndpointId] : []);
        const nextEpIds = endpointId && !currentEpIds.includes(endpointId)
          ? [...currentEpIds, endpointId]
          : currentEpIds;

        const currentEvIds: string[] =
          currentLiveRef.data.targetEventIds ||
          (currentLiveRef.data.targetEventId ? [currentLiveRef.data.targetEventId] : []);
        const nextEvIds = consumedEventId && !currentEvIds.includes(consumedEventId)
          ? [...currentEvIds, consumedEventId]
          : currentEvIds;

        const epChanged = nextEpIds.length !== currentEpIds.length;
        const evChanged = nextEvIds.length !== currentEvIds.length;
        const serviceChanged = currentLiveRef.data.targetServiceId !== serviceNodeId;
        const refChanged = !currentLiveRef.data.transformerRef && Boolean(masterId);

        if (epChanged || evChanged || serviceChanged || refChanged) {
          store.updateNode(refNodeId, {
            data: {
              ...currentLiveRef.data,
              transformerRef: currentLiveRef.data.transformerRef || masterId,
              targetServiceId: serviceNodeId,
              targetEndpointIds: nextEpIds,
              targetEndpointId: nextEpIds[0],
              targetEventIds: nextEvIds,
              targetEventId: nextEvIds[0],
            },
          });
        }
      }
    }

    // Ensure reference edge from master global transformer to transformer_ref node
    const actualMasterNode = store.nodes.find((n) => n.id === masterId);
    if (actualMasterNode) {
      const refEdgeExists = store.edges.some(
        (e) =>
          (e.type === "transformer-reference" || e.type === "reference") &&
          e.source === actualMasterNode.id &&
          e.target === refNodeId,
      );
      if (!refEdgeExists) {
        store.addEdge({
          id: `edge-ref-link-${actualMasterNode.id}-${refNodeId}`,
          source: actualMasterNode.id,
          target: refNodeId,
          sourceHandle: "transformer-out",
          targetHandle: "transformer-in",
          type: "transformer-reference",
        });
      }

      // Clean up any direct edge from master global transformer to this service endpoint
      const directEdges = store.edges.filter(
        (e) =>
          e.source === actualMasterNode.id &&
          e.target === serviceNodeId &&
          (e.targetHandle === targetHandle || e.targetHandle === targetId),
      );
      directEdges.forEach((e) => store.deleteEdge(e.id));
    }

    // Draw edge between transformer_ref and service endpoint / consumer
    const edgeExists = store.edges.some(
      (e) =>
        e.source === refNodeId &&
        e.target === serviceNodeId &&
        e.targetHandle === targetHandle,
    );
    let edgeId: string | undefined;
    if (!edgeExists) {
      edgeId = `edge-ref-${refNodeId}-${targetId}-${Date.now()}`;
      store.addEdge({
        id: edgeId,
        source: refNodeId,
        target: serviceNodeId,
        sourceHandle: "transformer-out",
        targetHandle,
        type: "connection",
      });
    }

    return { transformerNodeId: refNodeId, edgeId };
  } else if (masterTransformerNode) {
    // Local transformer: connect directly
    const edgeExists = store.edges.some(
      (e) =>
        e.source === masterTransformerNode.id &&
        e.target === serviceNodeId &&
        e.targetHandle === targetHandle,
    );
    let edgeId: string | undefined;
    if (!edgeExists) {
      edgeId = `edge-local-tr-${masterTransformerNode.id}-${targetId}-${Date.now()}`;
      store.addEdge({
        id: edgeId,
        source: masterTransformerNode.id,
        target: serviceNodeId,
        sourceHandle: "transformer-out",
        targetHandle,
        type: "connection",
      });
    }

    const currentEpIds: string[] =
      masterTransformerNode.data?.targetEndpointIds ||
      (masterTransformerNode.data?.targetEndpointId ? [masterTransformerNode.data.targetEndpointId] : []);
    const nextEpIds = endpointId && !currentEpIds.includes(endpointId)
      ? [...currentEpIds, endpointId]
      : currentEpIds;

    const currentEvIds: string[] =
      masterTransformerNode.data?.targetEventIds ||
      (masterTransformerNode.data?.targetEventId ? [masterTransformerNode.data.targetEventId] : []);
    const nextEvIds = consumedEventId && !currentEvIds.includes(consumedEventId)
      ? [...currentEvIds, consumedEventId]
      : currentEvIds;

    const epChanged = nextEpIds.length !== currentEpIds.length;
    const evChanged = nextEvIds.length !== currentEvIds.length;
    const serviceChanged = masterTransformerNode.data?.targetServiceId !== serviceNodeId;

    if (epChanged || evChanged || serviceChanged) {
      store.updateNode(masterTransformerNode.id, {
        data: {
          ...masterTransformerNode.data,
          targetServiceId: serviceNodeId,
          targetEndpointIds: nextEpIds,
          targetEndpointId: nextEpIds[0],
          targetEventIds: nextEvIds,
          targetEventId: nextEvIds[0],
        },
      });
    }

    return { transformerNodeId: masterTransformerNode.id, edgeId };
  }

  return undefined;
}

export function cleanupTransformerConnection({
  transformerNodeId,
  functionName,
  serviceNodeId,
  endpointId,
  consumedEventId,
  remainingSteps,
}: CleanupTransformerConnectionParams) {
  if (!serviceNodeId) return;
  const targetId = endpointId || consumedEventId;
  if (!targetId) return;

  const allRemaining = flattenAllPipelineSteps(remainingSteps);
  const isStillUsed = allRemaining.some(
    (s) =>
      s.type === "transform" &&
      ((transformerNodeId &&
        (s.transformerNodeId === transformerNodeId ||
          s.functionRef?.name === transformerNodeId)) ||
        (functionName &&
          (s.functionRef?.name === functionName ||
            s.transformerNodeId === functionName))),
  );
  if (isStillUsed) return;

  const store = useBackendCanvasStore.getState();
  const matchingTransformerNodes = store.nodes.filter(
    (n) =>
      (n.type === "transformer" || n.type === "transformer_ref") &&
      (n.id === transformerNodeId ||
        n.id === functionName ||
        n.data?.functionName === functionName ||
        n.data?.label === functionName ||
        (n.type === "transformer_ref" && n.data?.transformerRef === transformerNodeId) ||
        (n.type === "transformer_ref" && n.data?.targetServiceId === serviceNodeId)),
  );

  const matchingNodeIds = new Set<string>(matchingTransformerNodes.map((n) => n.id));
  if (transformerNodeId) matchingNodeIds.add(transformerNodeId);

  const edgesToDelete = store.edges.filter((e) => {
    if (!e) return false;
    const isFromTransformer = matchingNodeIds.has(e.source) || matchingNodeIds.has(e.target);
    if (!isFromTransformer) return false;

    const isToThisService = e.target === serviceNodeId || e.source === serviceNodeId;
    if (!isToThisService) return false;

    const isToThisTargetHandle =
      e.targetHandle === `endpoint-in-${targetId}` ||
      e.targetHandle === `consumedEvents-in-${targetId}` ||
      e.targetHandle === targetId ||
      e.sourceHandle === `endpoint-in-${targetId}` ||
      e.sourceHandle === `consumedEvents-in-${targetId}`;

    return isToThisTargetHandle;
  });

  edgesToDelete.forEach((e) => store.deleteEdge(e.id));

  matchingTransformerNodes.forEach((tNode) => {
    if (tNode.data) {
      const currentEpIds: string[] =
        tNode.data.targetEndpointIds ||
        (tNode.data.targetEndpointId ? [tNode.data.targetEndpointId] : []);
      const currentEvIds: string[] =
        tNode.data.targetEventIds ||
        (tNode.data.targetEventId ? [tNode.data.targetEventId] : []);

      const nextEpIds = endpointId ? currentEpIds.filter((id) => id !== endpointId) : currentEpIds;
      const nextEvIds = consumedEventId ? currentEvIds.filter((id) => id !== consumedEventId) : currentEvIds;
      const hasRemainingTargets = nextEpIds.length > 0 || nextEvIds.length > 0;

      // If it's a transformer_ref node and has no remaining targets and no connection edges, clean it up
      if (tNode.type === "transformer_ref" && !hasRemainingTargets) {
        const remainingEdges = store.edges.filter(
          (edge) =>
            (edge.target === tNode.id || edge.source === tNode.id) &&
            !edgesToDelete.some((delEdge) => delEdge.id === edge.id),
        );
        const onlyRefEdges = remainingEdges.every(
          (edge) => edge.type === "transformer-reference" || edge.type === "reference",
        );
        if (onlyRefEdges) {
          remainingEdges.forEach((re) => store.deleteEdge(re.id));
          store.deleteNode(tNode.id);
          return;
        }
      }

      const epChanged = nextEpIds.length !== currentEpIds.length;
      const evChanged = nextEvIds.length !== currentEvIds.length;

      if (epChanged || evChanged) {
        store.updateNode(tNode.id, {
          data: {
            ...tNode.data,
            targetEndpointIds: nextEpIds,
            targetEndpointId: nextEpIds[0] || undefined,
            targetEventIds: nextEvIds,
            targetEventId: nextEvIds[0] || undefined,
            targetServiceId: hasRemainingTargets ? tNode.data.targetServiceId : undefined,
          },
        });
      }
    }
  });
}
