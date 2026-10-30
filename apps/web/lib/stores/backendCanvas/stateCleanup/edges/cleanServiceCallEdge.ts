import { BackendEdge } from "@/types/canvas";
import { EdgeCleanupContext } from "../types";

const parseEpHandle = (handle?: string | null) => {
  if (!handle) return { isEndpoint: false, isOut: false, isIn: false, epId: "" };
  const outMatch =
    handle.match(/^(?:routeEndpoints|endpoints|endpoint)-out-(.+)$/) ||
    handle.match(/^func-out-(.+)$/);
  if (outMatch && outMatch[1]) {
    return { isEndpoint: true, isOut: true, isIn: false, epId: outMatch[1] };
  }
  const inMatch =
    handle.match(/^(?:routeEndpoints|endpoints|endpoint)-in-(.+)$/) ||
    handle.match(/^func-in-(.+)$/) ||
    handle.match(/^func-(.+)$/);
  if (inMatch && inMatch[1]) {
    return { isEndpoint: true, isOut: false, isIn: true, epId: inMatch[1] };
  }
  return { isEndpoint: false, isOut: false, isIn: false, epId: "" };
};

/**
 * Handles edge cleanup between services making inter-service endpoint calls,
 * removing matching service_call pipeline steps if no other edge remains.
 */
export function cleanServiceCallEdge(
  edge: BackendEdge,
  ctx: EdgeCleanupContext,
): void {
  const edgeData = edge.data as any;
  const isServiceCallEdge =
    edgeData?.isServiceCall ||
    (edge.sourceHandle &&
      edge.targetHandle &&
      (edge.sourceHandle.includes("endpoint") ||
        edge.sourceHandle.startsWith("func-")) &&
      (edge.targetHandle.includes("endpoint") ||
        edge.targetHandle.startsWith("func-")));

  if (!isServiceCallEdge) return;

  const srcNode = ctx.currentState.nodes.find((n) => n.id === edge.source);
  const tgtNode = ctx.currentState.nodes.find((n) => n.id === edge.target);

  const isServiceNode = (n?: any) =>
    n &&
    (n.type === "service" ||
      n.type === "serverless" ||
      n.type === "worker" ||
      Boolean(n.data?.endpoints));

  if (
    isServiceNode(srcNode) &&
    isServiceNode(tgtNode) &&
    srcNode?.id !== tgtNode?.id
  ) {
    const parsedSrc = parseEpHandle(edge.sourceHandle);
    const parsedTgt = parseEpHandle(edge.targetHandle);

    let callerNodeId = edge.source;
    let callerEpId = parsedSrc.epId;
    let calleeNodeId = edge.target;
    let calleeEpId = edgeData?.targetEndpointId || parsedTgt.epId;

    if (parsedSrc.isIn && parsedTgt.isOut) {
      callerNodeId = edge.target;
      callerEpId = parsedTgt.epId;
      calleeNodeId = edge.source;
      calleeEpId = edgeData?.targetEndpointId || parsedSrc.epId;
    }

    const callerEndpointsToClean: string[] = callerEpId
      ? [callerEpId]
      : ctx.nextEndpoints
          .filter((ep) => ep.nodeId === callerNodeId)
          .map((ep) => ep.id);

    callerEndpointsToClean.forEach((targetCallerEpId) => {
      const hasOtherEdge = ctx.nextEdges.some((e) => {
        if (!e || e.id === edge.id) return false;
        const otherData = e.data as any;
        const otherSrc = parseEpHandle(e.sourceHandle);
        const otherTgt = parseEpHandle(e.targetHandle);

        let otherCallerNodeId = e.source;
        let otherCallerEpId = otherSrc.epId;
        let otherCalleeNodeId = otherData?.targetServiceId || e.target;
        let otherCalleeEpId = otherData?.targetEndpointId || otherTgt.epId;

        if (otherSrc.isIn && otherTgt.isOut) {
          otherCallerNodeId = e.target;
          otherCallerEpId = otherTgt.epId;
          otherCalleeNodeId = otherData?.targetServiceId || e.source;
          otherCalleeEpId = otherData?.targetEndpointId || otherSrc.epId;
        }

        return (
          otherCallerNodeId === callerNodeId &&
          (otherCallerEpId === targetCallerEpId || !otherCallerEpId) &&
          otherCalleeNodeId === calleeNodeId &&
          (!calleeEpId || !otherCalleeEpId || otherCalleeEpId === calleeEpId)
        );
      });

      if (!hasOtherEdge) {
        ctx.nextEndpoints = ctx.nextEndpoints.map((ep) => {
          if (
            ep.id === targetCallerEpId &&
            ep.pipelineSteps &&
            ep.pipelineSteps.length > 0
          ) {
            const updatedSteps = ep.pipelineSteps.filter((step) => {
              if (step.type !== "service_call") return true;
              const matchesCalleeNode =
                !calleeNodeId ||
                step.databaseId === calleeNodeId ||
                step.serviceId === calleeNodeId ||
                (step as any).externalNodeId === calleeNodeId;
              const matchesCalleeEp =
                !calleeEpId ||
                step.tableNodeId === calleeEpId ||
                step.endpointId === calleeEpId ||
                (step as any).externalEndpointId === calleeEpId;

              if (calleeEpId && matchesCalleeEp && matchesCalleeNode) {
                return false;
              }
              if (!calleeEpId && matchesCalleeNode) {
                return false;
              }
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

        // Also check nextNodes for embedded endpoints on the caller node
        const liveCallerNode = ctx.nextNodes.find(
          (n) => n.id === callerNodeId,
        );
        if (liveCallerNode?.data?.endpoints) {
          let nodeEndpointsChanged = false;
          const updatedNodeEndpoints = liveCallerNode.data.endpoints.map(
            (ep: any) => {
              if (
                ep.id === targetCallerEpId &&
                ep.pipelineSteps &&
                ep.pipelineSteps.length > 0
              ) {
                const updatedSteps = ep.pipelineSteps.filter((step: any) => {
                  if (step.type !== "service_call") return true;
                  const matchesCalleeNode =
                    !calleeNodeId ||
                    step.databaseId === calleeNodeId ||
                    step.serviceId === calleeNodeId ||
                    step.externalNodeId === calleeNodeId;
                  const matchesCalleeEp =
                    !calleeEpId ||
                    step.tableNodeId === calleeEpId ||
                    step.endpointId === calleeEpId ||
                    step.externalEndpointId === calleeEpId;

                  if (calleeEpId && matchesCalleeEp && matchesCalleeNode) {
                    return false;
                  }
                  if (!calleeEpId && matchesCalleeNode) {
                    return false;
                  }
                  return true;
                });
                if (updatedSteps.length !== ep.pipelineSteps.length) {
                  nodeEndpointsChanged = true;
                  return { ...ep, pipelineSteps: updatedSteps };
                }
              }
              return ep;
            },
          );

          if (nodeEndpointsChanged) {
            ctx.nodesChanged = true;
            const updatedNode = {
              ...liveCallerNode,
              data: {
                ...liveCallerNode.data,
                endpoints: updatedNodeEndpoints,
              },
            };
            ctx.nextNodes = ctx.nextNodes.map((n) =>
              n.id === callerNodeId ? updatedNode : n,
            );
            ctx.pendingNodeUpserts.push(updatedNode);
          }
        }
      }
    });
  }
}
