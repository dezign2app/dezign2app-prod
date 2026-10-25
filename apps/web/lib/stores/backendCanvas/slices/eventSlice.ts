import {
  AnyMessagingResource,
  Endpoint,
  PublishedEvent,
  PublishedEventItem,
  ConsumedEventItem,
  PipelineStep,
} from "@workspace/canvas/types";
import { sanitizeTopicName } from "@workspace/canvas";
import {
  BackendCanvasState,
  EventWithNode,
  PendingEventRemoval,
} from "../types";
import { syncConfiguredEventEdge } from "../edgeSync";

export interface EventSlice {
  events: EventWithNode[];
  pendingEventUpserts: EventWithNode[];
  pendingEventRemovals: PendingEventRemoval[];
  addEvent: (
    nodeId: string,
    variant: "publish" | "consume",
    event: AnyMessagingResource,
  ) => void;
  updateEvent: (id: string, changes: Partial<AnyMessagingResource>) => void;
  deleteEvent: (id: string) => void;
}

export const createEventSlice = (
  set: (
    partial:
      | Partial<BackendCanvasState>
      | ((state: BackendCanvasState) => Partial<BackendCanvasState>),
  ) => void,
  get: () => BackendCanvasState,
): EventSlice => ({
  events: [],
  pendingEventUpserts: [],
  pendingEventRemovals: [],

  addEvent: (nodeId, variant, event) => {
    get().pushHistorySnapshot("graph");
    const sanitizedName = event.name ? sanitizeTopicName(event.name) : event.name;
    const newEvent = { ...event, name: sanitizedName, nodeId, variant };
    set({
      events: [...get().events, newEvent],
      pendingEventUpserts: [...get().pendingEventUpserts, newEvent],
    });
  },

  updateEvent: (id, changes) => {
    get().pushHistorySnapshot("graph");
    const sanitizedChanges = { ...changes };
    if (typeof sanitizedChanges.name === "string") {
      sanitizedChanges.name = sanitizeTopicName(sanitizedChanges.name);
    }
    const nextEvents = get().events.map((e) =>
      e.id === id ? { ...e, ...sanitizedChanges } : e,
    );
    const updated = nextEvents.find((e) => e.id === id);

    let endpointsChanged = false;
    const pendingEndpointUpserts = [...get().pendingEndpointUpserts];
    let updatedEndpointEvent: AnyMessagingResource | null = null;
    let endpointOwnerNodeId: string = "";

    const nextEndpoints = get().endpoints.map((ep) => {
      if (ep.publishedEvents?.some((pev) => pev.id === id)) {
        endpointsChanged = true;
        endpointOwnerNodeId = ep.nodeId;
        const updatedEp = {
          ...ep,
          publishedEvents: ep.publishedEvents.map((pev) => {
            if (pev.id !== id) return pev;
            const updatedItem = { ...pev };
            if (changes.name !== undefined) updatedItem.name = changes.name;
            if (changes.publishedWhen !== undefined)
              updatedItem.publishedWhen = changes.publishedWhen;
            if (changes.brokerNodeId !== undefined)
              updatedItem.brokerNodeId = changes.brokerNodeId;
            if (changes.messagingResourceId !== undefined)
              updatedItem.messagingResourceId = changes.messagingResourceId;
            if (changes.payloadSchema !== undefined)
              updatedItem.payloadSchema = changes.payloadSchema;
            updatedEndpointEvent = updatedItem;
            return updatedItem;
          }),
        };
        pendingEndpointUpserts.push(updatedEp);
        return updatedEp;
      }
      return ep;
    });

    if (updated) {
      const synced = syncConfiguredEventEdge(
        updated,
        updated.nodeId,
        updated.variant,
        get().nodes,
        get().edges,
      );
      set({
        events: nextEvents,
        ...(endpointsChanged ? { endpoints: nextEndpoints, pendingEndpointUpserts } : {}),
        edges: synced.edges,
        pendingEventUpserts: [...get().pendingEventUpserts, updated],
        pendingEdgeUpserts: [...get().pendingEdgeUpserts, ...synced.added],
        pendingEdgeRemovals: [...get().pendingEdgeRemovals, ...synced.removed],
      });
    } else if (updatedEndpointEvent && endpointOwnerNodeId) {
      const synced = syncConfiguredEventEdge(
        updatedEndpointEvent,
        endpointOwnerNodeId,
        "publish",
        get().nodes,
        get().edges,
      );
      set({
        endpoints: nextEndpoints,
        pendingEndpointUpserts,
        edges: synced.edges,
        pendingEdgeUpserts: [...get().pendingEdgeUpserts, ...synced.added],
        pendingEdgeRemovals: [...get().pendingEdgeRemovals, ...synced.removed],
      });
    } else if (endpointsChanged) {
      set({
        endpoints: nextEndpoints,
        pendingEndpointUpserts,
      });
    }
  },

  deleteEvent: (id) => {
    get().pushHistorySnapshot("graph");
    const event = get().events.find((e) => e.id === id);
    const active = get().activeConfigItem;

    const nextEvents = get().events.filter((e) => e.id !== id);

    let endpointsChanged = false;
    const pendingEndpointUpserts = [...get().pendingEndpointUpserts];
    const nextEndpoints = get().endpoints.map((ep) => {
      if (ep.publishedEvents?.some((pev) => pev.id === id)) {
        endpointsChanged = true;
        const matchingPub = ep.publishedEvents.find((pev) => pev.id === id);
        const updatedPubs = ep.publishedEvents.filter((pev) => pev.id !== id);
        const updatedSteps = (ep.pipelineSteps ?? []).filter((step) => {
          if (step.type !== "kafka_publish") return true;
          if (matchingPub?.brokerNodeId && step.brokerNodeId === matchingPub.brokerNodeId) {
            if (!step.messagingResourceId || step.messagingResourceId === matchingPub.messagingResourceId) {
              return false;
            }
          }
          if (matchingPub?.messagingResourceId && step.messagingResourceId === matchingPub.messagingResourceId) {
            return false;
          }
          if (
            matchingPub?.name &&
            (step.name === matchingPub.name ||
              step.name === `Publish ${matchingPub.name}` ||
              step.functionRef?.name?.toLowerCase().includes(
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
        pendingEndpointUpserts.push(updatedEp);
        return updatedEp;
      }
      return ep;
    });

    let targetNodeId = event?.nodeId || "";
    if (!targetNodeId) {
      for (const ep of get().endpoints) {
        if (ep.publishedEvents?.some((pev) => pev.id === id)) {
          targetNodeId = ep.nodeId;
          break;
        }
      }
    }

    // Clean up node data for service nodes (endpoints, publishedEvents, consumedEvents)
    let nodesChanged = false;
    const pendingNodeUpserts = [...get().pendingNodeUpserts];
    const nextNodes = get().nodes.map((node) => {
      if (node.type === "service" && node.data) {
        let nodeDataChanged = false;
        const newData = { ...node.data };
        if (newData.publishedEvents?.some((pe: PublishedEventItem) => pe.id === id)) {
          newData.publishedEvents = newData.publishedEvents.filter((pe: PublishedEventItem) => pe.id !== id);
          nodeDataChanged = true;
        }
        if (newData.consumedEvents?.some((ce: ConsumedEventItem) => ce.id === id)) {
          newData.consumedEvents = newData.consumedEvents.filter((ce: ConsumedEventItem) => ce.id !== id);
          nodeDataChanged = true;
        }
        if (newData.endpoints?.some((ep: Endpoint) => ep.publishedEvents?.some((pe: PublishedEventItem) => pe.id === id))) {
          newData.endpoints = newData.endpoints.map((ep: Endpoint) => {
            const matchingPub = ep.publishedEvents?.find((pe: PublishedEventItem) => pe.id === id);
            if (matchingPub && ep.publishedEvents) {
              const updatedPubs = ep.publishedEvents.filter((pe: PublishedEventItem) => pe.id !== id);
              const updatedSteps = (ep.pipelineSteps ?? []).filter((step: PipelineStep) => {
                if (step.type !== "kafka_publish") return true;
                if (matchingPub.brokerNodeId && step.brokerNodeId === matchingPub.brokerNodeId) {
                  if (!step.messagingResourceId || step.messagingResourceId === matchingPub.messagingResourceId) return false;
                }
                if (matchingPub.messagingResourceId && step.messagingResourceId === matchingPub.messagingResourceId) return false;
                if (matchingPub.name && (step.name === matchingPub.name || step.name === `Publish ${matchingPub.name}` || step.functionRef?.name?.toLowerCase().includes(matchingPub.name.toLowerCase().replace(/^publish\s*/i, "")))) return false;
                return true;
              });
              return { ...ep, publishedEvents: updatedPubs, pipelineSteps: updatedSteps };
            }
            return ep;
          });
          nodeDataChanged = true;
        }
        if (nodeDataChanged) {
          nodesChanged = true;
          const updatedNode = { ...node, data: newData };
          pendingNodeUpserts.push(updatedNode);
          return updatedNode;
        }
      }
      return node;
    });

    // Clean up all edges connected to this event handle or resource ID
    const currentEdges = get().edges;
    const removedEdges = currentEdges.filter(
      (edge) =>
        edge &&
        (edge.sourceHandle === `publishedEvents-out-${id}` ||
          edge.targetHandle === `publishedEvents-out-${id}` ||
          edge.sourceHandle === `publishedEvents-in-${id}` ||
          edge.targetHandle === `publishedEvents-in-${id}` ||
          edge.sourceHandle === `consumedEvents-in-${id}` ||
          edge.targetHandle === `consumedEvents-in-${id}` ||
          edge.sourceHandle === `consumedEvents-out-${id}` ||
          edge.targetHandle === `consumedEvents-out-${id}` ||
          edge.sourceHandle?.includes(id) ||
          edge.targetHandle?.includes(id) ||
          edge.sourceResourceId === id ||
          edge.targetResourceId === id),
    );
    const removedEdgeIds = removedEdges.map((e) => e.id);
    const nextEdges = currentEdges.filter((e) => !removedEdgeIds.includes(e.id));

    set({
      events: nextEvents,
      ...(endpointsChanged ? { endpoints: nextEndpoints, pendingEndpointUpserts } : {}),
      ...(nodesChanged ? { nodes: nextNodes, pendingNodeUpserts } : {}),
      edges: nextEdges,
      pendingEdgeRemovals: [...get().pendingEdgeRemovals, ...removedEdgeIds],
      activeConfigItem: active?.id === id ? null : active,
      ...(targetNodeId
        ? {
            pendingEventRemovals: [
              ...get().pendingEventRemovals,
              { nodeId: targetNodeId, eventId: id },
            ],
          }
        : {}),
    });
  },
});
