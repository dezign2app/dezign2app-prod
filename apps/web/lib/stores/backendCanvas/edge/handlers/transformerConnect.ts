import { BackendNode } from "@/types/canvas";
import { generateKeyBetween } from "fractional-indexing";
import { getLastIndex } from "../../utils";
import { ConnectionContext } from "../types";

/**
 * Handles transformer to service endpoint or consumed event connections.
 * For global transformers: ensures 1 transformer_ref node per service, links edges, and removes direct edge.
 * For local/ref transformers: updates targetEndpointIds/targetEventIds.
 *
 * @returns boolean `true` if direct edge was intercepted and removed (global transformer case), `false` otherwise.
 */
export function handleTransformerConnect({
  set,
  get,
  connection,
  sourceNode,
  targetNode,
  newEdge,
}: ConnectionContext): boolean {
  const isTransformerSource =
    sourceNode.type === "transformer" || sourceNode.type === "transformer_ref";
  const isTargetService = targetNode.type === "service";

  if (
    sourceNode.type === "transformer" &&
    sourceNode.data?.scope === "global" &&
    isTargetService
  ) {
    const serviceId = targetNode.id;
    const targetHandle = connection.targetHandle ?? "";
    const isEndpoint = targetHandle.startsWith("endpoint-in-");
    const isConsumer = targetHandle.startsWith("consumedEvents-in-");
    const targetId = isEndpoint
      ? targetHandle.replace("endpoint-in-", "")
      : isConsumer
      ? targetHandle.replace("consumedEvents-in-", "")
      : targetHandle;

    const currentNodes = get().nodes;
    const currentEdges = get().edges;
    const fnName =
      sourceNode.data?.functionName || sourceNode.data?.label || "transformData";

    // 1 Ref per service rule: Check if this service already has a transformer_ref node
    const existingRefNode = currentNodes.find(
      (n) =>
        n.type === "transformer_ref" &&
        (n.data?.targetServiceId === serviceId ||
          currentEdges.some(
            (e) => e.source === n.id && e.target === serviceId,
          )),
    );

    let refNodeId = existingRefNode?.id;

    if (!refNodeId) {
      refNodeId = crypto.randomUUID();
      const serviceX = targetNode.position?.x ?? 0;
      const serviceY = targetNode.position?.y ?? 0;

      const newRefNode: BackendNode = {
        id: refNodeId,
        type: "transformer_ref",
        position: {
          x: Math.max(0, serviceX - 300),
          y: serviceY + 40,
        },
        data: {
          label: `${fnName} (Ref)`,
          transformerRef: sourceNode.id,
          targetServiceId: serviceId,
          targetEndpointId: isEndpoint ? targetId : undefined,
          targetEndpointIds: isEndpoint && targetId ? [targetId] : [],
          targetEventId: isConsumer ? targetId : undefined,
          targetEventIds: isConsumer && targetId ? [targetId] : [],
        },
        fractionalIndex: generateKeyBetween(getLastIndex(currentNodes), null),
      };
      get().addNode(newRefNode);
    } else {
      const currentLiveRef = currentNodes.find((n) => n.id === refNodeId);
      if (currentLiveRef?.data) {
        if (isEndpoint && targetId) {
          const curEpIds: string[] =
            currentLiveRef.data.targetEndpointIds ||
            (currentLiveRef.data.targetEndpointId
              ? [currentLiveRef.data.targetEndpointId]
              : []);
          const nextEpIds = curEpIds.includes(targetId)
            ? curEpIds
            : [...curEpIds, targetId];
          get().updateNode(refNodeId, {
            data: {
              ...currentLiveRef.data,
              transformerRef:
                currentLiveRef.data.transformerRef || sourceNode.id,
              targetServiceId: serviceId,
              targetEndpointIds: nextEpIds,
              targetEndpointId: nextEpIds[0],
            },
          });
        } else if (isConsumer && targetId) {
          const curEvIds: string[] =
            currentLiveRef.data.targetEventIds ||
            (currentLiveRef.data.targetEventId
              ? [currentLiveRef.data.targetEventId]
              : []);
          const nextEvIds = curEvIds.includes(targetId)
            ? curEvIds
            : [...curEvIds, targetId];
          get().updateNode(refNodeId, {
            data: {
              ...currentLiveRef.data,
              transformerRef:
                currentLiveRef.data.transformerRef || sourceNode.id,
              targetServiceId: serviceId,
              targetEventIds: nextEvIds,
              targetEventId: nextEvIds[0],
            },
          });
        }
      }
    }

    // Ensure reference edge from global transformer to transformer_ref
    const refLinkExists = get().edges.some(
      (e) =>
        (e.type === "transformer-reference" || e.type === "reference") &&
        e.source === sourceNode.id &&
        e.target === refNodeId,
    );
    if (!refLinkExists) {
      get().addEdge({
        id: `edge-ref-link-${sourceNode.id}-${refNodeId}`,
        source: sourceNode.id,
        target: refNodeId,
        sourceHandle: "transformer-out",
        targetHandle: "transformer-in",
        type: "transformer-reference",
      });
    }

    // Ensure connection edge from transformer_ref to service
    const refConnExists = get().edges.some(
      (e) =>
        e.source === refNodeId &&
        e.target === serviceId &&
        e.targetHandle === targetHandle,
    );
    if (!refConnExists) {
      get().addEdge({
        id: `edge-ref-${refNodeId}-${targetId || "conn"}-${Date.now()}`,
        source: refNodeId,
        target: serviceId,
        sourceHandle: "transformer-out",
        targetHandle,
        type: "connection",
      });
    }

    // Remove direct edge created by ReactFlow
    const directEdgeId = newEdge.id;
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== directEdgeId),
      pendingEdgeUpserts: state.pendingEdgeUpserts.filter(
        (e) => e.id !== directEdgeId,
      ),
      pendingEdgeRemovals: [...state.pendingEdgeRemovals, directEdgeId],
    }));
    return true;
  }

  if (isTransformerSource && isTargetService) {
    if (connection.targetHandle?.startsWith("endpoint-in-")) {
      const epId = connection.targetHandle.replace("endpoint-in-", "");
      const currentEpIds: string[] =
        sourceNode.data?.targetEndpointIds ||
        (sourceNode.data?.targetEndpointId
          ? [sourceNode.data.targetEndpointId]
          : []);
      if (!currentEpIds.includes(epId)) {
        const nextEpIds = [...currentEpIds, epId];
        get().updateNode(sourceNode.id, {
          data: {
            ...sourceNode.data,
            targetServiceId: targetNode.id,
            targetEndpointIds: nextEpIds,
            targetEndpointId: nextEpIds[0],
          },
        });
      }
    } else if (connection.targetHandle?.startsWith("consumedEvents-in-")) {
      const evId = connection.targetHandle.replace("consumedEvents-in-", "");
      const currentEvIds: string[] =
        sourceNode.data?.targetEventIds ||
        (sourceNode.data?.targetEventId
          ? [sourceNode.data.targetEventId]
          : []);
      if (!currentEvIds.includes(evId)) {
        const nextEvIds = [...currentEvIds, evId];
        get().updateNode(sourceNode.id, {
          data: {
            ...sourceNode.data,
            targetServiceId: targetNode.id,
            targetEventIds: nextEvIds,
            targetEventId: nextEvIds[0],
          },
        });
      }
    }
  }

  return false;
}
