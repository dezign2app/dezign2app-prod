import { BackendEdge } from "@/types/canvas";
import {
  Endpoint,
  PipelineStep,
  PublishedEvent,
  PublishedEventItem,
  ConsumedEventItem,
  KafkaTopic,
  MESSAGING_TYPES,
} from "@workspace/canvas/types";
import { toFolderName } from "@/lib/compiler/kafka/utils";
import { EdgeCleanupContext } from "../types";

/**
 * Handles edge cleanup for messaging topics, published event handles,
 * and service <-> messaging broker disconnections.
 */
export function cleanMessagingEdge(
  edge: BackendEdge,
  ctx: EdgeCleanupContext,
): void {
  // 1. Messaging Event -> Broker Node cleanup: fully delete publish event & pipeline step
  const pubOutHandle = edge.sourceHandle?.startsWith("publishedEvents-out-")
    ? edge.sourceHandle
    : edge.targetHandle?.startsWith("publishedEvents-out-")
      ? edge.targetHandle
      : null;

  if (pubOutHandle) {
    const eventId = pubOutHandle.replace("publishedEvents-out-", "");

    // Find the event and record it for DB removal
    const deletedEvent = ctx.nextEvents.find((ev) => ev.id === eventId);
    if (deletedEvent) {
      ctx.eventsChanged = true;
      ctx.nextEvents = ctx.nextEvents.filter((ev) => ev.id !== eventId);
      ctx.deletedEventEntries.push({
        nodeId: deletedEvent.nodeId,
        eventId: deletedEvent.id,
      });
    }

    // Remove from endpoint.publishedEvents AND remove matching kafka_publish step from pipelineSteps
    ctx.nextEndpoints = ctx.nextEndpoints.map((ep) => {
      const matchingPub = ep.publishedEvents?.find(
        (pev) => pev.id === eventId,
      );
      if (matchingPub) {
        ctx.endpointsChanged = true;
        const updatedPubs =
          ep.publishedEvents?.filter((pev) => pev.id !== eventId) ?? [];

        // Remove corresponding kafka_publish step from pipelineSteps
        const updatedSteps = (ep.pipelineSteps ?? []).filter((step) => {
          if (step.type !== "kafka_publish") return true;
          if (
            step.brokerNodeId &&
            step.brokerNodeId === matchingPub.brokerNodeId
          ) {
            if (
              !step.messagingResourceId ||
              step.messagingResourceId === matchingPub.messagingResourceId
            ) {
              return false;
            }
          }
          if (
            step.messagingResourceId &&
            step.messagingResourceId === matchingPub.messagingResourceId
          ) {
            return false;
          }
          if (
            matchingPub.name &&
            (step.name === matchingPub.name ||
              step.name === `Publish ${matchingPub.name}` ||
              step.functionRef?.name
                ?.toLowerCase()
                .includes(
                  matchingPub.name.toLowerCase().replace(/^publish\s*/i, ""),
                ))
          ) {
            return false;
          }
          return true;
        });

        const updatedEp = {
          ...ep,
          publishedEvents: updatedPubs,
          pipelineSteps: updatedSteps,
        };
        ctx.pendingEndpointUpserts.push(updatedEp);
        return updatedEp;
      }
      return ep;
    });

    // Update nextNodes live service node data (endpoints and publishedEvents)
    ctx.nextNodes = ctx.nextNodes.map((n) => {
      if (n.type === "service" && n.data) {
        let nodeDataChanged = false;
        const newData = { ...n.data };
        if (
          newData.publishedEvents?.some(
            (pe: PublishedEventItem) => pe.id === eventId,
          )
        ) {
          newData.publishedEvents = newData.publishedEvents.filter(
            (pe: PublishedEventItem) => pe.id !== eventId,
          );
          nodeDataChanged = true;
        }
        if (
          newData.endpoints?.some((ep: Endpoint) =>
            ep.publishedEvents?.some(
              (pe: PublishedEventItem) => pe.id === eventId,
            ),
          )
        ) {
          newData.endpoints = newData.endpoints.map((ep: Endpoint) => {
            const matchingPub = ep.publishedEvents?.find(
              (pe: PublishedEventItem) => pe.id === eventId,
            );
            if (matchingPub && ep.publishedEvents) {
              const updatedPubs = ep.publishedEvents.filter(
                (pe: PublishedEventItem) => pe.id !== eventId,
              );
              const updatedSteps = (ep.pipelineSteps ?? []).filter(
                (step: PipelineStep) => {
                  if (step.type !== "kafka_publish") return true;
                  if (
                    step.brokerNodeId &&
                    step.brokerNodeId === matchingPub.brokerNodeId
                  ) {
                    if (
                      !step.messagingResourceId ||
                      step.messagingResourceId ===
                        matchingPub.messagingResourceId
                    ) {
                      return false;
                    }
                  }
                  if (
                    step.messagingResourceId &&
                    step.messagingResourceId ===
                      matchingPub.messagingResourceId
                  ) {
                    return false;
                  }
                  if (
                    matchingPub.name &&
                    (step.name === matchingPub.name ||
                      step.name === `Publish ${matchingPub.name}` ||
                      step.functionRef?.name
                        ?.toLowerCase()
                        .includes(
                          matchingPub.name
                            .toLowerCase()
                            .replace(/^publish\s*/i, ""),
                        ))
                  ) {
                    return false;
                  }
                  return true;
                },
              );
              return {
                ...ep,
                publishedEvents: updatedPubs,
                pipelineSteps: updatedSteps,
              };
            }
            return ep;
          });
          nodeDataChanged = true;
        }
        if (nodeDataChanged) {
          ctx.nodesChanged = true;
          ctx.pendingNodeUpserts.push({ ...n, data: newData });
          return { ...n, data: newData };
        }
      }
      return n;
    });
  }

  // 2. Topic handle cleanup: when a topic-specific edge is deleted, clean up if no remaining edge connects
  const topicHandle = edge.targetHandle?.startsWith("topics:in:")
    ? edge.targetHandle
    : edge.sourceHandle?.startsWith("topics:in:")
      ? edge.sourceHandle
      : null;

  if (topicHandle) {
    const topicId = topicHandle.replace("topics:in:", "");
    const isTopicStillConnected = ctx.nextEdges.some(
      (e) =>
        e &&
        (e.targetHandle === topicHandle ||
          e.sourceHandle === topicHandle ||
          e.targetResourceId === topicId ||
          e.sourceResourceId === topicId),
    );

    if (!isTopicStillConnected) {
      ctx.nextEndpoints = ctx.nextEndpoints.map((ep) => {
        let epModified = false;
        let updatedPubs = ep.publishedEvents;
        if (ep.publishedEvents) {
          const filtered = ep.publishedEvents.filter(
            (pe) => pe.messagingResourceId !== topicId,
          );
          if (filtered.length !== ep.publishedEvents.length) {
            epModified = true;
            updatedPubs = filtered;
          }
        }
        let updatedSteps = ep.pipelineSteps;
        if (ep.pipelineSteps) {
          const filtered = ep.pipelineSteps.filter((step) => {
            if (step.type !== "kafka_publish") return true;
            if (step.messagingResourceId === topicId) return false;
            return true;
          });
          if (filtered.length !== ep.pipelineSteps.length) {
            epModified = true;
            updatedSteps = filtered;
          }
        }
        if (epModified) {
          ctx.endpointsChanged = true;
          const updatedEp = {
            ...ep,
            publishedEvents: updatedPubs,
            pipelineSteps: updatedSteps,
          };
          ctx.pendingEndpointUpserts.push(updatedEp);
          return updatedEp;
        }
        return ep;
      });

      ctx.nextEvents = ctx.nextEvents.map((ev) => {
        if (ev.messagingResourceId === topicId) {
          ctx.eventsChanged = true;
          const updatedEv = {
            ...ev,
            brokerNodeId: "",
            messagingResourceId: undefined,
          };
          ctx.pendingEventUpserts.push(updatedEv);
          return updatedEv;
        }
        return ev;
      });

      ctx.nextNodes = ctx.nextNodes.map((n) => {
        if (n.type === "service" && n.data) {
          let srvChanged = false;
          const newData = { ...n.data };
          if (newData.publishedEvents) {
            const filtered = newData.publishedEvents.filter(
              (pe: PublishedEventItem) =>
                pe.messagingResourceId !== topicId &&
                pe.targetNodeId !== topicId,
            );
            if (filtered.length !== newData.publishedEvents.length) {
              newData.publishedEvents = filtered;
              srvChanged = true;
            }
          }
          if (newData.consumedEvents) {
            const filtered = newData.consumedEvents.filter(
              (ce: ConsumedEventItem) =>
                ce.messagingResourceId !== topicId &&
                ce.targetNodeId !== topicId,
            );
            if (filtered.length !== newData.consumedEvents.length) {
              newData.consumedEvents = filtered;
              srvChanged = true;
            }
          }
          if (newData.endpoints) {
            const newEps = newData.endpoints.map((ep: Endpoint) => {
              let epChanged = false;
              let epPubs = ep.publishedEvents;
              if (epPubs) {
                const filtered = epPubs.filter(
                  (pe: PublishedEventItem) =>
                    pe.messagingResourceId !== topicId,
                );
                if (filtered.length !== epPubs.length) {
                  epPubs = filtered;
                  epChanged = true;
                }
              }
              let epSteps = ep.pipelineSteps;
              if (epSteps) {
                const filtered = epSteps.filter((step: PipelineStep) => {
                  if (step.type !== "kafka_publish") return true;
                  if (step.messagingResourceId === topicId) return false;
                  return true;
                });
                if (filtered.length !== epSteps.length) {
                  epSteps = filtered;
                  epChanged = true;
                }
              }
              if (epChanged) {
                srvChanged = true;
                return {
                  ...ep,
                  publishedEvents: epPubs,
                  pipelineSteps: epSteps,
                };
              }
              return ep;
            });
            if (srvChanged) {
              newData.endpoints = newEps;
            }
          }
          if (srvChanged) {
            ctx.nodesChanged = true;
            ctx.pendingNodeUpserts.push({ ...n, data: newData });
            return { ...n, data: newData };
          }
        }
        return n;
      });
    }
  }

  // 3. Service <-> Messaging Broker Node cleanup: remove published & consumed references if disconnected
  const srcNode = ctx.currentState.nodes.find((n) => n.id === edge.source);
  const tgtNode = ctx.currentState.nodes.find((n) => n.id === edge.target);
  const serviceNode =
    srcNode?.type === "service"
      ? srcNode
      : tgtNode?.type === "service"
        ? tgtNode
        : null;
  const brokerNode =
    srcNode && MESSAGING_TYPES.has(srcNode.type)
      ? srcNode
      : tgtNode && MESSAGING_TYPES.has(tgtNode.type)
        ? tgtNode
        : null;

  if (serviceNode && brokerNode) {
    const stillConnected = ctx.nextEdges.some((e) => {
      if (!e) return false;
      if (
        (e.source === serviceNode.id && e.target === brokerNode.id) ||
        (e.target === serviceNode.id && e.source === brokerNode.id)
      ) {
        return true;
      }
      const topics: KafkaTopic[] = brokerNode.data?.topics || [];
      if (
        e.source === serviceNode.id &&
        e.targetHandle &&
        topics.some((t: KafkaTopic) => e.targetHandle!.includes(t.id))
      ) {
        return true;
      }
      if (
        e.target === serviceNode.id &&
        e.sourceHandle &&
        topics.some((t: KafkaTopic) => e.sourceHandle!.includes(t.id))
      ) {
        return true;
      }
      return false;
    });

    if (!stillConnected) {
      const brokerTopicIds = new Set(
        (brokerNode.data?.topics || []).map((t: KafkaTopic) => t.id),
      );

      // Clean up nextEvents
      const eventsToRemove = ctx.nextEvents.filter(
        (ev) =>
          ev.nodeId === serviceNode.id &&
          (ev.brokerNodeId === brokerNode.id ||
            (ev.messagingResourceId &&
              brokerTopicIds.has(ev.messagingResourceId))),
      );
      if (eventsToRemove.length > 0) {
        ctx.eventsChanged = true;
        const removeIds = new Set(eventsToRemove.map((ev) => ev.id));
        ctx.nextEvents = ctx.nextEvents.filter((ev) => !removeIds.has(ev.id));
        eventsToRemove.forEach((ev) => {
          ctx.deletedEventEntries.push({
            nodeId: ev.nodeId,
            eventId: ev.id,
          });
        });
      }

      // Clean up nextEndpoints
      ctx.nextEndpoints = ctx.nextEndpoints.map((ep) => {
        if (ep.nodeId === serviceNode.id) {
          let epModified = false;
          let updatedPubs = ep.publishedEvents;
          if (ep.publishedEvents && ep.publishedEvents.length > 0) {
            const remainingPubs = ep.publishedEvents.filter(
              (pe: PublishedEvent) =>
                pe.brokerNodeId !== brokerNode.id &&
                (!pe.messagingResourceId ||
                  !brokerTopicIds.has(pe.messagingResourceId)),
            );
            if (remainingPubs.length !== ep.publishedEvents.length) {
              epModified = true;
              updatedPubs = remainingPubs;
            }
          }

          let updatedSteps = ep.pipelineSteps;
          if (ep.pipelineSteps && ep.pipelineSteps.length > 0) {
            const brokerFolder = toFolderName(
              brokerNode.data?.label || "kafka",
            );
            const remainingSteps = ep.pipelineSteps.filter(
              (step: PipelineStep) => {
                if (step.type !== "kafka_publish") return true;
                if (step.brokerNodeId === brokerNode.id) return false;
                if (
                  step.messagingResourceId &&
                  brokerTopicIds.has(step.messagingResourceId)
                ) {
                  return false;
                }
                if (
                  step.functionRef?.importPath &&
                  brokerFolder &&
                  step.functionRef.importPath.includes(brokerFolder)
                ) {
                  return false;
                }
                return true;
              },
            );
            if (remainingSteps.length !== ep.pipelineSteps.length) {
              epModified = true;
              updatedSteps = remainingSteps;
            }
          }

          if (epModified) {
            ctx.endpointsChanged = true;
            const updatedEp = {
              ...ep,
              publishedEvents: updatedPubs,
              pipelineSteps: updatedSteps,
            };
            ctx.pendingEndpointUpserts.push(updatedEp);
            return updatedEp;
          }
        }
        return ep;
      });

      // Clean up service node data if it contains publishedEvents/consumedEvents
      const liveSrvNode = ctx.nextNodes.find((n) => n.id === serviceNode.id);
      if (liveSrvNode?.data) {
        let nodeDataChanged = false;
        const newData = { ...liveSrvNode.data };
        if (newData.publishedEvents) {
          const remainingPubs = newData.publishedEvents.filter(
            (pe) =>
              pe.targetNodeId !== brokerNode.id &&
              (!pe.targetNodeId || !brokerTopicIds.has(pe.targetNodeId)),
          );
          if (remainingPubs.length !== newData.publishedEvents.length) {
            newData.publishedEvents = remainingPubs;
            nodeDataChanged = true;
          }
        }
        if (newData.consumedEvents) {
          const remainingCons = newData.consumedEvents.filter(
            (ce) =>
              ce.targetNodeId !== brokerNode.id &&
              (!ce.targetNodeId || !brokerTopicIds.has(ce.targetNodeId)),
          );
          if (remainingCons.length !== newData.consumedEvents.length) {
            newData.consumedEvents = remainingCons;
            nodeDataChanged = true;
          }
        }
        if (newData.endpoints) {
          const newEps = newData.endpoints.map((ep) => {
            let epChanged = false;
            let filteredPubs = ep.publishedEvents;
            if (ep.publishedEvents) {
              filteredPubs = ep.publishedEvents.filter(
                (pe) =>
                  pe.brokerNodeId !== brokerNode.id &&
                  (!pe.messagingResourceId ||
                    !brokerTopicIds.has(pe.messagingResourceId)),
              );
              if (filteredPubs.length !== ep.publishedEvents.length) {
                epChanged = true;
              }
            }
            let filteredSteps = ep.pipelineSteps;
            if (ep.pipelineSteps) {
              const brokerFolder = toFolderName(
                brokerNode.data?.label || "kafka",
              );
              filteredSteps = ep.pipelineSteps.filter((step) => {
                if (step.type !== "kafka_publish") return true;
                if (step.brokerNodeId === brokerNode.id) return false;
                if (
                  step.messagingResourceId &&
                  brokerTopicIds.has(step.messagingResourceId)
                ) {
                  return false;
                }
                if (
                  step.functionRef?.importPath &&
                  brokerFolder &&
                  step.functionRef.importPath.includes(brokerFolder)
                ) {
                  return false;
                }
                return true;
              });
              if (filteredSteps.length !== ep.pipelineSteps.length) {
                epChanged = true;
              }
            }
            if (epChanged) {
              nodeDataChanged = true;
              return {
                ...ep,
                publishedEvents: filteredPubs,
                pipelineSteps: filteredSteps,
              };
            }
            return ep;
          });
          if (nodeDataChanged) {
            newData.endpoints = newEps;
          }
        }
        if (nodeDataChanged) {
          ctx.nodesChanged = true;
          const updatedNode = { ...liveSrvNode, data: newData };
          ctx.nextNodes = ctx.nextNodes.map((n) =>
            n.id === serviceNode.id ? updatedNode : n,
          );
          ctx.pendingNodeUpserts.push(updatedNode);
        }
      }
    }
  }
}
