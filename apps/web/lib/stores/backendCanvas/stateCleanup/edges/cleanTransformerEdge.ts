import { BackendEdge } from "@/types/canvas";
import { EdgeCleanupContext } from "../types";

/**
 * Handles edge cleanup between transformers / transformer_refs and service endpoints or events,
 * updating transformer target references and removing transform pipeline steps.
 */
export function cleanTransformerEdge(
  edge: BackendEdge,
  ctx: EdgeCleanupContext,
): void {
  // 1. Transformer -> Endpoint edge cleanup (endpoint-in handle)
  if (edge.targetHandle?.startsWith("endpoint-in-")) {
    const epId = edge.targetHandle.replace("endpoint-in-", "");
    const srcNode = ctx.currentState.nodes.find((n) => n.id === edge.source);
    if (
      srcNode &&
      (srcNode.type === "transformer" || srcNode.type === "transformer_ref")
    ) {
      const fnName = srcNode.data?.functionName || srcNode.data?.label;
      ctx.nextEndpoints = ctx.nextEndpoints.map((ep) => {
        if (ep.id === epId && ep.pipelineSteps && ep.pipelineSteps.length > 0) {
          const updatedSteps = ep.pipelineSteps.filter((step) => {
            if (step.type !== "transform") return true;
            if (step.transformerNodeId === srcNode.id) return false;
            if (fnName && step.functionRef?.name === fnName) return false;
            return true;
          });
          if (updatedSteps.length !== ep.pipelineSteps.length) {
            ctx.endpointsChanged = true;
            const updatedEp = { ...ep, pipelineSteps: updatedSteps };
            ctx.pendingEndpointUpserts.push(updatedEp);
            return updatedEp;
          }
        }
        return ep;
      });
    }
  }

  // 2. Transformer / TransformerRef -> Service Endpoint / Event target metadata & pipeline step cleanup
  const srcNode = ctx.currentState.nodes.find((n) => n.id === edge.source);
  const tgtNode = ctx.currentState.nodes.find((n) => n.id === edge.target);
  const transformerNode =
    srcNode &&
    (srcNode.type === "transformer" || srcNode.type === "transformer_ref")
      ? srcNode
      : tgtNode &&
          (tgtNode.type === "transformer" || tgtNode.type === "transformer_ref")
        ? tgtNode
        : null;

  if (transformerNode) {
    let targetEpId: string | null = null;
    let targetEvId: string | null = null;

    if (edge.targetHandle?.startsWith("endpoint-in-")) {
      targetEpId = edge.targetHandle.replace("endpoint-in-", "");
    } else if (edge.targetHandle?.startsWith("consumedEvents-in-")) {
      targetEvId = edge.targetHandle.replace("consumedEvents-in-", "");
    } else if (edge.sourceHandle?.startsWith("endpoint-in-")) {
      targetEpId = edge.sourceHandle.replace("endpoint-in-", "");
    } else if (edge.sourceHandle?.startsWith("consumedEvents-in-")) {
      targetEvId = edge.sourceHandle.replace("consumedEvents-in-", "");
    }

    if (targetEpId || targetEvId) {
      const currentLiveTNode =
        ctx.nextNodes.find((n) => n.id === transformerNode.id) ||
        transformerNode;
      const currentEpIds: string[] =
        currentLiveTNode.data?.targetEndpointIds ||
        (currentLiveTNode.data?.targetEndpointId
          ? [currentLiveTNode.data.targetEndpointId]
          : []);
      const currentEvIds: string[] =
        currentLiveTNode.data?.targetEventIds ||
        (currentLiveTNode.data?.targetEventId
          ? [currentLiveTNode.data.targetEventId]
          : []);

      const nextEpIds = targetEpId
        ? currentEpIds.filter((id) => id !== targetEpId)
        : currentEpIds;
      const nextEvIds = targetEvId
        ? currentEvIds.filter((id) => id !== targetEvId)
        : currentEvIds;

      const hasRemainingTargets =
        nextEpIds.length > 0 || nextEvIds.length > 0;

      if (
        nextEpIds.length !== currentEpIds.length ||
        nextEvIds.length !== currentEvIds.length
      ) {
        ctx.nodesChanged = true;
        const updatedTNode = {
          ...currentLiveTNode,
          data: {
            ...currentLiveTNode.data,
            targetEndpointIds: nextEpIds,
            targetEndpointId: nextEpIds[0] || undefined,
            targetEventIds: nextEvIds,
            targetEventId: nextEvIds[0] || undefined,
            targetServiceId: hasRemainingTargets
              ? currentLiveTNode.data?.targetServiceId
              : undefined,
          },
        };
        ctx.nextNodes = ctx.nextNodes.map((n) =>
          n.id === transformerNode.id ? updatedTNode : n,
        );
        ctx.pendingNodeUpserts.push(updatedTNode);
      }

      const fnName =
        transformerNode.data?.functionName || transformerNode.data?.label;

      // Clean up endpoint pipelineSteps
      if (targetEpId) {
        ctx.nextEndpoints = ctx.nextEndpoints.map((ep) => {
          if (
            ep.id === targetEpId &&
            ep.pipelineSteps &&
            ep.pipelineSteps.length > 0
          ) {
            const filteredSteps = ep.pipelineSteps.filter(
              (s) =>
                !(
                  s.type === "transform" &&
                  (s.transformerNodeId === transformerNode.id ||
                    (fnName && s.functionRef?.name === fnName))
                ),
            );
            if (filteredSteps.length !== ep.pipelineSteps.length) {
              ctx.endpointsChanged = true;
              const updatedEp = { ...ep, pipelineSteps: filteredSteps };
              ctx.pendingEndpointUpserts.push(updatedEp);
              return updatedEp;
            }
          }
          return ep;
        });
      }

      // Clean up event pipelineSteps
      if (targetEvId) {
        ctx.nextEvents = ctx.nextEvents.map((ev) => {
          if (
            ev.id === targetEvId &&
            ev.pipelineSteps &&
            ev.pipelineSteps.length > 0
          ) {
            const filteredSteps = ev.pipelineSteps.filter(
              (s) =>
                !(
                  s.type === "transform" &&
                  (s.transformerNodeId === transformerNode.id ||
                    (fnName && s.functionRef?.name === fnName))
                ),
            );
            if (filteredSteps.length !== ev.pipelineSteps.length) {
              ctx.eventsChanged = true;
              const updatedEv = { ...ev, pipelineSteps: filteredSteps };
              ctx.pendingEventUpserts.push(updatedEv);
              return updatedEv;
            }
          }
          return ev;
        });
      }
    }
  }
}
