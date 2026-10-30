import { BackendEdge } from "@/types/canvas";
import {
  Endpoint,
  PipelineStep,
  PublishedEvent,
  MESSAGING_TYPES,
} from "@workspace/canvas/types";
import { EdgeCleanupContext } from "../types";

/**
 * Handles edge cleanup between endpoints/services and databases or db_refs,
 * including messaging target cleanup from endpoint-out handles, CRUD mappings,
 * and db_operation pipeline steps.
 */
export function cleanDatabaseEdge(
  edge: BackendEdge,
  ctx: EdgeCleanupContext,
): void {
  const targetEndpointIds = new Set<string>();
  let targetDbId: string | null = null;

  if (edge.sourceHandle?.startsWith("endpoint-out-")) {
    const epId = edge.sourceHandle.replace("endpoint-out-", "");
    targetEndpointIds.add(epId);
    if (ctx.dbNodeIdsSet.has(edge.target)) {
      targetDbId = edge.target;
    }

    // Check if target is a Kafka / messaging broker node
    const targetNode = ctx.currentState.nodes.find((n) => n.id === edge.target);
    const isTargetMessaging = targetNode && MESSAGING_TYPES.has(targetNode.type);
    if (isTargetMessaging && targetNode) {
      ctx.nextEndpoints = ctx.nextEndpoints.map((ep) => {
        if (ep.id === epId) {
          let epModified = false;
          let updatedSteps = ep.pipelineSteps;
          if (ep.pipelineSteps && ep.pipelineSteps.length > 0) {
            const filteredSteps = ep.pipelineSteps.filter((step) => {
              if (step.type !== "kafka_publish") return true;
              if (step.brokerNodeId === targetNode.id) return false;
              return true;
            });
            if (filteredSteps.length !== ep.pipelineSteps.length) {
              epModified = true;
              updatedSteps = filteredSteps;
            }
          }
          let updatedPubs = ep.publishedEvents;
          if (ep.publishedEvents && ep.publishedEvents.length > 0) {
            const filteredPubs = ep.publishedEvents.filter(
              (pe) => pe.brokerNodeId !== targetNode.id,
            );
            if (filteredPubs.length !== ep.publishedEvents.length) {
              epModified = true;
              updatedPubs = filteredPubs;
            }
          }
          if (epModified) {
            ctx.endpointsChanged = true;
            const updatedEp = {
              ...ep,
              pipelineSteps: updatedSteps,
              publishedEvents: updatedPubs,
            };
            ctx.pendingEndpointUpserts.push(updatedEp);
            return updatedEp;
          }
        }
        return ep;
      });

      // Update live service node data
      ctx.nextNodes = ctx.nextNodes.map((n) => {
        if (n.type === "service" && n.data?.endpoints) {
          const hasTargetEp = n.data.endpoints.some(
            (e: Endpoint) => e.id === epId,
          );
          if (hasTargetEp) {
            ctx.nodesChanged = true;
            const newEps = n.data.endpoints.map((e: Endpoint) => {
              if (e.id === epId) {
                const filteredSteps = (e.pipelineSteps || []).filter(
                  (s: PipelineStep) => {
                    if (s.type !== "kafka_publish") return true;
                    if (s.brokerNodeId === targetNode.id) return false;
                    return true;
                  },
                );
                const filteredPubs = (e.publishedEvents || []).filter(
                  (pe: PublishedEvent) => pe.brokerNodeId !== targetNode.id,
                );
                return {
                  ...e,
                  pipelineSteps: filteredSteps,
                  publishedEvents: filteredPubs,
                };
              }
              return e;
            });
            const updatedNode = {
              ...n,
              data: { ...n.data, endpoints: newEps },
            };
            ctx.pendingNodeUpserts.push(updatedNode);
            return updatedNode;
          }
        }
        return n;
      });
    }
  } else {
    const edgeSrcNode = ctx.currentState.nodes.find((n) => n.id === edge.source);
    const edgeTgtNode = ctx.currentState.nodes.find((n) => n.id === edge.target);
    const isDbRefSource = edgeSrcNode?.type === "db_ref";
    const isDbRefTarget = edgeTgtNode?.type === "db_ref";
    const dbRefNode = isDbRefSource
      ? edgeSrcNode
      : isDbRefTarget
        ? edgeTgtNode
        : ctx.currentState.nodes.find((n) => n.id === edge.data?.dbRefNodeId);
    const effectiveDbRefId = dbRefNode?.id || edge.data?.dbRefNodeId;
    const isDbRefConnection = Boolean(
      effectiveDbRefId || edge.data?.isDbOperation,
    );

    if (ctx.dbNodeIdsSet.has(edge.target) || isDbRefTarget) {
      targetDbId = edge.target;
      if (
        edge.sourceHandle?.startsWith("endpoint-out-") ||
        edge.sourceHandle?.startsWith("endpoint-in-")
      ) {
        const epId = edge.sourceHandle.replace(/^endpoint-(?:out|in)-/, "");
        targetEndpointIds.add(epId);
      } else if (edge.sourceHandle?.startsWith("routeEndpoints-")) {
        const epId = edge.sourceHandle.replace(
          /^routeEndpoints-(?:out|in)-/,
          "",
        );
        targetEndpointIds.add(epId);
      } else {
        ctx.currentState.endpoints
          .filter((ep) => ep.nodeId === edge.source)
          .forEach((ep) => targetEndpointIds.add(ep.id));
      }
    } else if (ctx.dbNodeIdsSet.has(edge.source) || isDbRefSource) {
      targetDbId = edge.source;
      if (
        edge.targetHandle?.startsWith("endpoint-in-") ||
        edge.targetHandle?.startsWith("endpoint-out-")
      ) {
        const epId = edge.targetHandle.replace(/^endpoint-(?:in|out)-/, "");
        targetEndpointIds.add(epId);
      } else if (edge.targetHandle?.startsWith("routeEndpoints-")) {
        const epId = edge.targetHandle.replace(
          /^routeEndpoints-(?:in|out)-/,
          "",
        );
        targetEndpointIds.add(epId);
      } else {
        ctx.currentState.endpoints
          .filter((ep) => ep.nodeId === edge.target)
          .forEach((ep) => targetEndpointIds.add(ep.id));
      }
    }

    if (effectiveDbRefId) {
      targetDbId = targetDbId || effectiveDbRefId;
      if (dbRefNode?.data?.endpointId) {
        targetEndpointIds.add(dbRefNode.data.endpointId);
      }
      if (edge.data?.endpointId) {
        targetEndpointIds.add(edge.data.endpointId);
      }
    }

    const targetStepId = edge.data?.stepId || dbRefNode?.data?.stepId;

    if (targetDbId || effectiveDbRefId) {
      const dbRefIdToClean =
        effectiveDbRefId || (dbRefNode ? dbRefNode.id : null);
      ctx.nextEndpoints = ctx.nextEndpoints.map((ep) => {
        if (targetEndpointIds.size > 0 && !targetEndpointIds.has(ep.id)) {
          return ep;
        }

        const currentDbIds =
          ep.databaseNodeIds ||
          (ep.databaseNodeId && ep.databaseNodeId !== "none"
            ? [ep.databaseNodeId]
            : []);

        const hasDbId = Boolean(
          (targetDbId && currentDbIds.includes(targetDbId)) ||
            (dbRefIdToClean && currentDbIds.includes(dbRefIdToClean)),
        );

        const hasMatchingStep = (ep.pipelineSteps || []).some(
          (s) =>
            s.type === "db_operation" &&
            ((dbRefIdToClean && s.dbRefNodeId === dbRefIdToClean) ||
              (targetDbId &&
                (s.dbRefNodeId === targetDbId || s.databaseId === targetDbId)) ||
              (targetStepId && s.id === targetStepId)),
        );

        if (hasDbId || hasMatchingStep) {
          ctx.endpointsChanged = true;
          const newDbIds = currentDbIds.filter(
            (id) => id !== targetDbId && id !== dbRefIdToClean,
          );
          const newDbId = newDbIds[0] || "none";

          const newCrudOps = { ...(ep.crudOperations || {}) };
          if (targetDbId) delete newCrudOps[targetDbId];
          if (dbRefIdToClean) delete newCrudOps[dbRefIdToClean];

          const newCrudExp = { ...(ep.crudExplanations || {}) };
          if (targetDbId) delete newCrudExp[targetDbId];
          if (dbRefIdToClean) delete newCrudExp[dbRefIdToClean];

          let newPipelineSteps = ep.pipelineSteps;
          if (newPipelineSteps && newPipelineSteps.length > 0) {
            const relatedEntityIds = new Set(
              ctx.currentState.nodes
                .filter(
                  (n) =>
                    n &&
                    ((targetDbId &&
                      (n.id === targetDbId ||
                        n.parentId === targetDbId ||
                        n.data?.databaseId === targetDbId)) ||
                      (dbRefIdToClean &&
                        (n.id === dbRefIdToClean ||
                          n.data?.tableRef === n.id))),
                )
                .map((n) => n.id),
            );
            newPipelineSteps = newPipelineSteps.filter((step) => {
              if (step.type !== "db_operation") return true;
              if (dbRefIdToClean && step.dbRefNodeId === dbRefIdToClean) {
                return false;
              }
              if (targetDbId && step.dbRefNodeId === targetDbId) {
                return false;
              }
              if (targetStepId && step.id === targetStepId) {
                return false;
              }
              if (isDbRefConnection && step.dbRefNodeId) {
                if (
                  step.dbRefNodeId === edge.source ||
                  step.dbRefNodeId === edge.target
                ) {
                  return false;
                }
              }
              if (targetDbId && step.databaseId === targetDbId) {
                return false;
              }
              if (
                step.tableNodeId &&
                relatedEntityIds.has(step.tableNodeId) &&
                (isDbRefConnection || !step.dbRefNodeId)
              ) {
                return false;
              }
              return true;
            });
          }

          const updatedEp = {
            ...ep,
            databaseNodeIds: newDbIds,
            databaseNodeId: newDbId,
            crudOperations: newCrudOps,
            crudExplanations: newCrudExp,
            pipelineSteps: newPipelineSteps,
          };
          ctx.pendingEndpointUpserts.push(updatedEp);
          return updatedEp;
        }
        return ep;
      });

      // Clean up events if connected to consumed event listener
      const targetEventIds = new Set<string>();
      if (edge.sourceHandle?.startsWith("consumedEvents-")) {
        targetEventIds.add(
          edge.sourceHandle.replace(/^consumedEvents-(?:in|out)-/, ""),
        );
      }
      if (edge.targetHandle?.startsWith("consumedEvents-")) {
        targetEventIds.add(
          edge.targetHandle.replace(/^consumedEvents-(?:in|out)-/, ""),
        );
      }
      if (dbRefNode?.data?.consumedEventId) {
        targetEventIds.add(dbRefNode.data.consumedEventId);
      }
      if (
        targetEventIds.size > 0 ||
        (isDbRefConnection &&
          ctx.currentState.events.some(
            (ev) => ev.nodeId === edge.source || ev.nodeId === edge.target,
          ))
      ) {
        ctx.nextEvents = ctx.nextEvents.map((ev) => {
          if (targetEventIds.size > 0 && !targetEventIds.has(ev.id)) return ev;
          if (!ev.pipelineSteps || ev.pipelineSteps.length === 0) return ev;
          const filteredSteps = ev.pipelineSteps.filter((step) => {
            if (step.type !== "db_operation") return true;
            if (dbRefIdToClean && step.dbRefNodeId === dbRefIdToClean) {
              return false;
            }
            if (targetDbId && step.dbRefNodeId === targetDbId) {
              return false;
            }
            if (targetStepId && step.id === targetStepId) {
              return false;
            }
            if (
              isDbRefConnection &&
              (step.dbRefNodeId === edge.source ||
                step.dbRefNodeId === edge.target)
            ) {
              return false;
            }
            return true;
          });
          if (filteredSteps.length !== ev.pipelineSteps.length) {
            ctx.eventsChanged = true;
            const updatedEv = { ...ev, pipelineSteps: filteredSteps };
            ctx.pendingEventUpserts.push(updatedEv);
            return updatedEv;
          }
          return ev;
        });
      }

      // Clean up db_ref node data if no other edge remains
      if (dbRefIdToClean) {
        const remainingEdgesForRef = ctx.nextEdges.filter(
          (e) =>
            e &&
            (e.source === dbRefIdToClean || e.target === dbRefIdToClean),
        );
        if (remainingEdgesForRef.length === 0) {
          ctx.nextNodes = ctx.nextNodes.map((n) => {
            if (n.id === dbRefIdToClean && n.type === "db_ref") {
              ctx.nodesChanged = true;
              const updated = {
                ...n,
                data: {
                  ...n.data,
                  targetServiceId: undefined,
                  endpointId: undefined,
                  consumedEventId: undefined,
                  stepId: undefined,
                },
              };
              ctx.pendingNodeUpserts.push(updated);
              return updated;
            }
            return n;
          });
        }
      }

      if (ctx.endpointsChanged) {
        ctx.nextNodes = ctx.nextNodes.map((n) => {
          if (n.type === "service" && n.data?.endpoints) {
            const serviceEpMap = new Map(
              ctx.nextEndpoints
                .filter((e) => e.nodeId === n.id)
                .map((e) => [e.id, e]),
            );
            const updatedEps = n.data.endpoints.map(
              (e: Endpoint) => serviceEpMap.get(e.id) || e,
            );
            ctx.nodesChanged = true;
            const updated = {
              ...n,
              data: { ...n.data, endpoints: updatedEps },
            };
            ctx.pendingNodeUpserts.push(updated);
            return updated;
          }
          return n;
        });
      }
    }
  }
}
