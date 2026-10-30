import { BackendEdge } from "@/types/canvas";
import { EdgeCleanupContext } from "../types";

/**
 * Handles edge cleanup between Service nodes and Redis Cache nodes,
 * removing redis_operation pipeline steps if no other edge remains.
 */
export function cleanRedisEdge(
  edge: BackendEdge,
  ctx: EdgeCleanupContext,
): void {
  const rcSrcNode = ctx.currentState.nodes.find((n) => n.id === edge.source);
  const rcTgtNode = ctx.currentState.nodes.find((n) => n.id === edge.target);
  const isServiceToRedis =
    rcSrcNode?.type === "service" && rcTgtNode?.type === "redis-cache";
  const isRedisToService =
    rcSrcNode?.type === "redis-cache" && rcTgtNode?.type === "service";

  if (isServiceToRedis || isRedisToService) {
    const redisNode = isServiceToRedis ? rcTgtNode! : rcSrcNode!;
    const svcNode = isServiceToRedis ? rcSrcNode! : rcTgtNode!;
    const handle = isServiceToRedis
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

    const schemaRef = redisNode.data?.schemaRef;
    const targetTableNodeId = schemaRef || redisNode.id;

    // Check if any other edge still connects this endpoint or event to this redis-cache node
    const hasOtherEdge = ctx.nextEdges.some((e) => {
      if (!e) return false;
      const connectsBoth =
        (e.source === svcNode.id && e.target === redisNode.id) ||
        (e.source === redisNode.id && e.target === svcNode.id);
      if (!connectsBoth) return false;
      if (epId) {
        return (
          e.sourceHandle === `endpoint-out-${epId}` ||
          e.sourceHandle === `endpoint-in-${epId}` ||
          e.targetHandle === `endpoint-in-${epId}` ||
          e.targetHandle === `endpoint-out-${epId}` ||
          e.sourceHandle === epId ||
          e.targetHandle === epId
        );
      }
      if (evId) {
        return (
          e.sourceHandle === `consumedEvents-out-${evId}` ||
          e.sourceHandle === `consumedEvents-in-${evId}` ||
          e.targetHandle === `consumedEvents-in-${evId}` ||
          e.targetHandle === `consumedEvents-out-${evId}` ||
          e.sourceHandle === evId ||
          e.targetHandle === evId
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
                  step.type === "redis_operation" &&
                  (step.tableNodeId === targetTableNodeId ||
                    step.tableNodeId === redisNode.id ||
                    (redisNode.data?.databaseId &&
                      step.databaseId === redisNode.data?.databaseId))
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
      } else if (!evId) {
        // If neither epId nor evId was in handle, check if first endpoint had the step
        const firstEp = ctx.currentState.endpoints.find(
          (e) => e.nodeId === svcNode.id,
        );
        if (firstEp) {
          ctx.nextEndpoints = ctx.nextEndpoints.map((ep) => {
            if (
              ep.id === firstEp.id &&
              ep.pipelineSteps &&
              ep.pipelineSteps.length > 0
            ) {
              const updatedSteps = ep.pipelineSteps.filter(
                (step) =>
                  !(
                    step.type === "redis_operation" &&
                    (step.tableNodeId === targetTableNodeId ||
                      step.tableNodeId === redisNode.id ||
                      (redisNode.data?.databaseId &&
                        step.databaseId === redisNode.data?.databaseId))
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
                  step.type === "redis_operation" &&
                  (step.tableNodeId === targetTableNodeId ||
                    step.tableNodeId === redisNode.id ||
                    (redisNode.data?.databaseId &&
                      step.databaseId === redisNode.data?.databaseId))
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
