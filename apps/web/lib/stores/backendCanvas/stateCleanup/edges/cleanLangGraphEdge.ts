import { BackendEdge } from "@/types/canvas";
import { EdgeCleanupContext } from "../types";

/**
 * Handles edge cleanup between Service nodes and LangGraph nodes,
 * removing langgraph_invoke pipeline steps if no other edge remains.
 */
export function cleanLangGraphEdge(
  edge: BackendEdge,
  ctx: EdgeCleanupContext,
): void {
  const lgSrcNode = ctx.currentState.nodes.find((n) => n.id === edge.source);
  const lgTgtNode = ctx.currentState.nodes.find((n) => n.id === edge.target);
  const isServiceToLangGraph =
    lgSrcNode?.type === "service" && lgTgtNode?.type === "langgraph";
  const isLangGraphToService =
    lgSrcNode?.type === "langgraph" && lgTgtNode?.type === "service";

  if (isServiceToLangGraph || isLangGraphToService) {
    const lgNode = isServiceToLangGraph ? lgTgtNode! : lgSrcNode!;
    const svcNode = isServiceToLangGraph ? lgSrcNode! : lgTgtNode!;
    const handle = isServiceToLangGraph
      ? edge.sourceHandle
      : edge.targetHandle;

    const epId = handle?.startsWith("endpoint-out-")
      ? handle.replace("endpoint-out-", "")
      : handle?.startsWith("endpoint-in-")
        ? handle.replace("endpoint-in-", "")
        : null;

    const evId = handle?.startsWith("consumedEvents-out-")
      ? handle.replace("consumedEvents-out-", "")
      : handle?.startsWith("consumedEvents-in-")
        ? handle.replace("consumedEvents-in-", "")
        : null;

    // Check if any other edge still connects this endpoint or event to this langgraph node
    const hasOtherEdge = ctx.nextEdges.some((e) => {
      if (!e) return false;
      const connectsBoth =
        (e.source === svcNode.id && e.target === lgNode.id) ||
        (e.source === lgNode.id && e.target === svcNode.id);
      if (!connectsBoth) return false;
      if (epId) {
        return (
          e.sourceHandle === `endpoint-out-${epId}` ||
          e.sourceHandle === `endpoint-in-${epId}` ||
          e.targetHandle === `endpoint-in-${epId}` ||
          e.targetHandle === `endpoint-out-${epId}`
        );
      }
      if (evId) {
        return (
          e.sourceHandle === `consumedEvents-out-${evId}` ||
          e.sourceHandle === `consumedEvents-in-${evId}` ||
          e.targetHandle === `consumedEvents-in-${evId}` ||
          e.targetHandle === `consumedEvents-out-${evId}`
        );
      }
      return true;
    });

    if (!hasOtherEdge) {
      if (epId) {
        ctx.nextEndpoints = ctx.nextEndpoints.map((ep) => {
          if (
            ep.id === epId &&
            ep.pipelineSteps &&
            ep.pipelineSteps.length > 0
          ) {
            const updatedSteps = ep.pipelineSteps.filter(
              (step) =>
                !(
                  step.type === "langgraph_invoke" &&
                  step.langGraphTargetNodeId === lgNode.id
                ),
            );
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
      if (evId) {
        ctx.nextEvents = ctx.nextEvents.map((ev) => {
          if (
            ev.id === evId &&
            ev.pipelineSteps &&
            ev.pipelineSteps.length > 0
          ) {
            const updatedSteps = ev.pipelineSteps.filter(
              (step) =>
                !(
                  step.type === "langgraph_invoke" &&
                  step.langGraphTargetNodeId === lgNode.id
                ),
            );
            if (updatedSteps.length !== ev.pipelineSteps.length) {
              ctx.eventsChanged = true;
              const updatedEv = { ...ev, pipelineSteps: updatedSteps };
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
