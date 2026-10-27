import { BackendEdge } from "@/types/canvas";
import { Endpoint } from "@workspace/canvas/types";
import { sanitizeEndpointRoute } from "@workspace/canvas";
import { generateKeyBetween } from "fractional-indexing";
import {
  BackendCanvasState,
  EndpointWithNode,
  PendingEndpointRemoval,
} from "../types";
import { syncConfiguredEventEdge } from "../edgeSync";
import { getLastIndex } from "../utils";
import { syncServiceTypesNode } from "../node/serviceEndpointTypesSync";

export interface EndpointSlice {
  endpoints: EndpointWithNode[];
  pendingEndpointUpserts: EndpointWithNode[];
  pendingEndpointRemovals: PendingEndpointRemoval[];
  addEndpoint: (nodeId: string, endpoint: Endpoint) => void;
  updateEndpoint: (id: string, changes: Partial<Endpoint>) => void;
  deleteEndpoint: (id: string) => void;
}

export const createEndpointSlice = (
  set: (
    partial:
      | Partial<BackendCanvasState>
      | ((state: BackendCanvasState) => Partial<BackendCanvasState>),
  ) => void,
  get: () => BackendCanvasState,
): EndpointSlice => ({
  endpoints: [],
  pendingEndpointUpserts: [],
  pendingEndpointRemovals: [],

  addEndpoint: (nodeId, endpoint) => {
    get().pushHistorySnapshot("graph");
    const newEndpoint = {
      ...endpoint,
      name: endpoint.name ? sanitizeEndpointRoute(endpoint.name) : endpoint.name,
      nodeId,
    };
    const newEndpoints = [...get().endpoints, newEndpoint];
    const syncRes = syncServiceTypesNode(
      nodeId,
      get().nodes,
      get().edges,
      newEndpoints,
    );
    set({
      endpoints: newEndpoints,
      pendingEndpointUpserts: [...get().pendingEndpointUpserts, newEndpoint],
      nodes: syncRes.nodes,
      edges: syncRes.edges,
      pendingNodeUpserts: syncRes.updatedTypesNode
        ? [...get().pendingNodeUpserts, syncRes.updatedTypesNode]
        : get().pendingNodeUpserts,
      pendingEdgeUpserts: syncRes.newEdge
        ? [...get().pendingEdgeUpserts, syncRes.newEdge]
        : get().pendingEdgeUpserts,
    });
  },

  updateEndpoint: (id, changes) => {
    get().pushHistorySnapshot("graph");
    const sanitizedChanges = { ...changes };
    if (typeof sanitizedChanges.name === "string") {
      sanitizedChanges.name = sanitizeEndpointRoute(sanitizedChanges.name);
    }
    const next = get().endpoints.map((e) =>
      e.id === id ? { ...e, ...sanitizedChanges } : e,
    );
    const updated = next.find((e) => e.id === id);
    if (updated) {
      let nextEdges = [...get().edges];
      const addedEdges: BackendEdge[] = [];
      const removedEdgeIds: string[] = [];

      let nextEvents = [...get().events];
      const pendingEventRemovals = [...get().pendingEventRemovals];

      if ("publishedEvents" in changes && changes.publishedEvents) {
        const oldEp = get().endpoints.find((e) => e.id === id);
        const oldPubIds = new Set(
          oldEp?.publishedEvents?.map((e) => e.id) || [],
        );
        const newPubIds = new Set(changes.publishedEvents.map((e) => e.id));

        // Endpoint published events live on endpoint.publishedEvents, not background events store
        nextEvents = nextEvents.filter((ev) => !newPubIds.has(ev.id));

        const removedPubIds = Array.from(oldPubIds).filter(
          (eId) => !newPubIds.has(eId),
        );
        if (removedPubIds.length > 0) {
          nextEvents = nextEvents.filter((ev) => !removedPubIds.includes(ev.id));
          removedPubIds.forEach((eId) => {
            pendingEventRemovals.push({ nodeId: updated.nodeId, eventId: eId });
            const handle = `publishedEvents-out-${eId}`;
            nextEdges
              .filter((edge) => edge && (edge.sourceHandle === handle || edge.targetHandle === handle))
              .forEach((edge) => {
                removedEdgeIds.push(edge.id);
              });
            nextEdges = nextEdges.filter(
              (edge) => edge && edge.sourceHandle !== handle && edge.targetHandle !== handle,
            );
          });

          // If pipelineSteps was not explicitly modified in changes, clean up matching kafka_publish steps
          if (!("pipelineSteps" in changes) && updated.pipelineSteps) {
            const removedPubs = oldEp?.publishedEvents?.filter((p) => removedPubIds.includes(p.id)) || [];
            updated.pipelineSteps = updated.pipelineSteps.filter((step) => {
              if (step.type !== "kafka_publish") return true;
              for (const pub of removedPubs) {
                if (step.brokerNodeId && step.brokerNodeId === pub.brokerNodeId) {
                  if (!step.messagingResourceId || step.messagingResourceId === pub.messagingResourceId) return false;
                }
                if (step.messagingResourceId && step.messagingResourceId === pub.messagingResourceId) return false;
                if (
                  pub.name &&
                  (step.name === pub.name ||
                    step.name === `Publish ${pub.name}` ||
                    step.functionRef?.name?.toLowerCase().includes(
                      pub.name.toLowerCase().replace(/^publish\s*/i, ""),
                    ))
                ) {
                  return false;
                }
              }
              return true;
            });
          }
        }
      }

      if (updated.publishedEvents) {
        for (const event of updated.publishedEvents) {
          const synced = syncConfiguredEventEdge(
            event,
            updated.nodeId,
            "publish",
            get().nodes,
            nextEdges,
          );
          nextEdges = synced.edges;
          addedEdges.push(...synced.added);
          removedEdgeIds.push(...synced.removed);
        }
      }

      // Sync database table reference edges for this endpoint ONLY IF databaseNodeIds or databaseNodeId is in changes
      const hasDbChanges =
        "databaseNodeIds" in changes || "databaseNodeId" in changes;
      if (hasDbChanges) {
        const targetDbNodeIds = new Set<string>();
        if (updated.databaseNodeIds) {
          updated.databaseNodeIds.forEach(
            (dbId) => dbId && targetDbNodeIds.add(dbId),
          );
        } else if (updated.databaseNodeId && updated.databaseNodeId !== "none") {
          targetDbNodeIds.add(updated.databaseNodeId);
        }

        const epSourceHandle = `endpoint-out-${updated.id}`;
        const epTargetHandle = `endpoint-in-${updated.id}`;
        const existingDbEdges = nextEdges.filter(
          (e) =>
            e &&
            ((e.source === updated.nodeId && e.sourceHandle === epSourceHandle) ||
              (e.target === updated.nodeId && e.targetHandle === epTargetHandle)),
        );

        // 1. Remove edges ONLY to DB nodes no longer in targetDbNodeIds
        existingDbEdges.forEach((edge) => {
          if (edge) {
            const otherId = edge.source === updated.nodeId ? edge.target : edge.source;
            const targetNode = get().nodes.find((n) => n?.id === otherId);
            const isDbNode =
              targetNode &&
              (targetNode.type === "db_ref" ||
                targetNode.type === "database" ||
                targetNode.type === "entity");

            const isTargetInConfig =
              targetDbNodeIds.has(otherId) ||
              (targetNode?.type === "db_ref" &&
                targetNode.data?.tableRef &&
                targetDbNodeIds.has(targetNode.data.tableRef));

            if (isDbNode && !isTargetInConfig) {
              nextEdges = nextEdges.filter((e) => e && e.id !== edge.id);
              removedEdgeIds.push(edge.id);
            }
          }
        });

        // 2. Add missing edges for DB nodes in targetDbNodeIds
        targetDbNodeIds.forEach((targetDbId) => {
          const dbRefNode = get().nodes.find(
            (n) => n?.type === "db_ref" && n.data?.tableRef === targetDbId,
          );
          const actualTargetId = dbRefNode ? dbRefNode.id : targetDbId;

          const hasEdge = nextEdges.some(
            (e) =>
              e &&
              ((e.source === updated.nodeId &&
                e.sourceHandle === epSourceHandle &&
                (e.target === actualTargetId || e.target === targetDbId)) ||
                (e.target === updated.nodeId &&
                  (!e.targetHandle || e.targetHandle === epTargetHandle) &&
                  (e.source === actualTargetId || e.source === targetDbId))),
          );
          const targetNode = get().nodes.find((n) => n?.id === actualTargetId);
          if (
            !hasEdge &&
            targetNode &&
            (targetNode.type === "db_ref" ||
              targetNode.type === "database" ||
              targetNode.type === "entity")
          ) {
            const lastEdgeIndex = getLastIndex(nextEdges);
            const fractionalIndex = generateKeyBetween(lastEdgeIndex, null);
            const newEdge: BackendEdge = {
              id: `edge-${Date.now()}-${updated.id}-${actualTargetId}`,
              source: actualTargetId,
              target: updated.nodeId,
              type: "connection",
              sourceHandle: "database-source",
              targetHandle: epTargetHandle,
              fractionalIndex,
            };
            nextEdges.push(newEdge);
            addedEdges.push(newEdge);
          }
        });
      }

      const syncRes = syncServiceTypesNode(
        updated.nodeId,
        get().nodes,
        nextEdges,
        next,
      );

      set({
        endpoints: next,
        events: nextEvents,
        pendingEventRemovals,
        edges: syncRes.edges,
        nodes: syncRes.nodes,
        pendingEndpointUpserts: [...get().pendingEndpointUpserts, updated],
        pendingNodeUpserts: syncRes.updatedTypesNode
          ? [...get().pendingNodeUpserts, syncRes.updatedTypesNode]
          : get().pendingNodeUpserts,
        pendingEdgeUpserts: syncRes.newEdge
          ? [...get().pendingEdgeUpserts, ...addedEdges, syncRes.newEdge]
          : [...get().pendingEdgeUpserts, ...addedEdges],
        pendingEdgeRemovals: [...get().pendingEdgeRemovals, ...removedEdgeIds],
      });
    }
  },

  deleteEndpoint: (id) => {
    const endpoint = get().endpoints.find((e) => e.id === id);
    if (endpoint) {
      get().pushHistorySnapshot("graph");
      const active = get().activeConfigItem;
      const pubEventIds = new Set((endpoint.publishedEvents || []).map((p) => p.id));
      const removedEdges = get().edges.filter((edge) => {
        if (!edge) return false;
        if (
          edge.sourceHandle === `endpoint-out-${id}` ||
          edge.targetHandle === `endpoint-in-${id}` ||
          edge.sourceHandle === `endpoint-in-${id}` ||
          edge.targetHandle === `endpoint-out-${id}` ||
          edge.sourceHandle?.includes(id) ||
          edge.targetHandle?.includes(id)
        ) {
          return true;
        }
        for (const peId of pubEventIds) {
          if (
            edge.sourceHandle === `publishedEvents-out-${peId}` ||
            edge.targetHandle === `publishedEvents-out-${peId}` ||
            edge.sourceHandle?.includes(peId) ||
            edge.targetHandle?.includes(peId)
          ) {
            return true;
          }
        }
        return false;
      });
      const removedEdgeIds = removedEdges.map((e) => e.id);
      const nextEdges = get().edges.filter((e) => !removedEdgeIds.includes(e.id));

      const nextNodes = get().nodes.map((node) => {
        if (node.id === endpoint.nodeId && node.data?.endpoints) {
          return {
            ...node,
            data: {
              ...node.data,
              endpoints: node.data.endpoints.filter((ep: Endpoint) => ep.id !== id),
            },
          };
        }
        return node;
      });

      const remainingEndpoints = get().endpoints.filter((e) => e.id !== id);
      const syncRes = syncServiceTypesNode(
        endpoint.nodeId,
        nextNodes,
        nextEdges,
        remainingEndpoints,
      );

      set({
        endpoints: remainingEndpoints,
        edges: syncRes.edges,
        nodes: syncRes.nodes,
        pendingNodeUpserts: syncRes.updatedTypesNode
          ? [...get().pendingNodeUpserts, syncRes.updatedTypesNode]
          : get().pendingNodeUpserts,
        pendingEdgeRemovals: [...get().pendingEdgeRemovals, ...removedEdgeIds],
        activeConfigItem: active?.id === id ? null : active,
        pendingEndpointRemovals: [
          ...get().pendingEndpointRemovals,
          { nodeId: endpoint.nodeId, endpointId: id },
        ],
      });
    }
  },
});
