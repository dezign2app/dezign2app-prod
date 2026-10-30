import { KafkaTopic, MESSAGING_TYPES } from "@workspace/canvas/types";
import { BackendCanvasState } from "../../types";
import { resolveCascadeDeletedNodeIds } from "../../node/nodeEntitySync";
import { toFolderName } from "@/lib/compiler/kafka/utils";
import { DeletedNodesMeta } from "../types";
import { cleanRemainingNodes } from "./cleanRemainingNodes";
import { cleanRemainingEvents } from "./cleanRemainingEvents";
import { cleanRemainingEndpoints } from "./cleanRemainingEndpoints";

/**
 * Builds the deletion metadata tracking brokers, transformers, langgraph,
 * redis, and db_ref nodes marked for deletion.
 */
function collectDeletedNodesMeta(
  currentState: BackendCanvasState,
  allIdsSet: Set<string>,
): DeletedNodesMeta {
  const deletedBrokerNodes = currentState.nodes.filter(
    (n) => n && MESSAGING_TYPES.has(n.type) && allIdsSet.has(n.id),
  );
  const deletedBrokerIds = new Set(deletedBrokerNodes.map((n) => n.id));
  const deletedBrokerTopicIds = new Set<string>();
  const deletedBrokerTopicNames = new Set<string>();
  const deletedBrokerPackageNames = new Set<string>();

  deletedBrokerNodes.forEach((n) => {
    const topics: KafkaTopic[] = n.data?.topics || [];
    topics.forEach((t) => {
      if (t.id) deletedBrokerTopicIds.add(t.id);
      if (t.name) deletedBrokerTopicNames.add(t.name.toLowerCase());
    });
    const label = n.data?.label || "Kafka Broker";
    const packageFolder = toFolderName(label) || "kafka";
    deletedBrokerPackageNames.add(`@workspace/${packageFolder}`);
    deletedBrokerPackageNames.add(packageFolder);
  });

  const deletedTransformerNodes = currentState.nodes.filter(
    (n) =>
      n &&
      (n.type === "transformer" || n.type === "transformer_ref") &&
      allIdsSet.has(n.id),
  );
  const deletedTransformerNames = new Set(
    deletedTransformerNodes
      .map((n) => n.data?.functionName || n.data?.label)
      .filter(Boolean),
  );

  const deletedLangGraphNodes = currentState.nodes.filter(
    (n) => n && n.type === "langgraph" && allIdsSet.has(n.id),
  );
  const deletedLangGraphIds = new Set(deletedLangGraphNodes.map((n) => n.id));

  const deletedRedisNodes = currentState.nodes.filter(
    (n) =>
      n &&
      (n.type === "redis-cache" ||
        n.type === "redis_schema" ||
        n.type === "redis_instance") &&
      allIdsSet.has(n.id),
  );
  const deletedRedisIds = new Set(deletedRedisNodes.map((n) => n.id));
  deletedRedisNodes.forEach((n) => {
    if (n.type === "redis-cache" && n.data?.schemaRef) {
      const remainingHasSchema = currentState.nodes.some(
        (other) =>
          other &&
          !allIdsSet.has(other.id) &&
          other.type === "redis-cache" &&
          other.data?.schemaRef === n.data.schemaRef,
      );
      if (!remainingHasSchema) {
        deletedRedisIds.add(n.data.schemaRef);
      }
    }
  });

  const deletedDbRefNodes = currentState.nodes.filter(
    (n) => n && n.type === "db_ref" && allIdsSet.has(n.id),
  );
  const deletedDbRefIds = new Set<string>(deletedDbRefNodes.map((n) => n.id));
  const deletedDbRefStepIds = new Set<string>(
    deletedDbRefNodes
      .map((n) => n.data?.stepId)
      .filter((id): id is string => Boolean(id)),
  );

  currentState.edges.forEach((e) => {
    if (e && (allIdsSet.has(e.source) || allIdsSet.has(e.target))) {
      if (e.data?.stepId) deletedDbRefStepIds.add(e.data.stepId);
      if (e.data?.dbRefNodeId) deletedDbRefIds.add(e.data.dbRefNodeId);
    }
  });

  return {
    allIdsSet,
    deletedBrokerNodes,
    deletedBrokerIds,
    deletedBrokerTopicIds,
    deletedBrokerTopicNames,
    deletedBrokerPackageNames,
    deletedTransformerNodes,
    deletedTransformerNames,
    deletedLangGraphNodes,
    deletedLangGraphIds,
    deletedRedisNodes,
    deletedRedisIds,
    deletedDbRefNodes,
    deletedDbRefIds,
    deletedDbRefStepIds,
  };
}

/**
 * Cleans up canvas state when nodes are deleted, including cascading deletions,
 * references on surviving nodes, pipeline steps, endpoints, events, and edges.
 */
export function cleanupDeletedNodesState(
  currentState: BackendCanvasState,
  initialIdsToDelete: string[],
): Partial<BackendCanvasState> {
  const idsToDeleteArray = resolveCascadeDeletedNodeIds(
    currentState.nodes,
    currentState.edges,
    initialIdsToDelete,
  );
  if (idsToDeleteArray.length === 0) return {};

  const allIdsSet = new Set<string>(idsToDeleteArray);
  const meta = collectDeletedNodesMeta(currentState, allIdsSet);

  // 1. Clean surviving nodes
  const nextNodes = cleanRemainingNodes(currentState.nodes, meta);

  // 2. Pre-calculate deleted endpoint and event IDs
  const deletedEndpointIds = new Set(
    currentState.endpoints
      .filter((e) => allIdsSet.has(e.nodeId))
      .map((e) => e.id),
  );
  const deletedEventIds = new Set(
    currentState.events
      .filter((ev) => allIdsSet.has(ev.nodeId))
      .map((ev) => ev.id),
  );

  // 3. Clean surviving events
  const { nextEvents, eventsToDelete } = cleanRemainingEvents(
    currentState.events,
    meta,
    deletedEndpointIds,
  );

  // 4. Clean surviving endpoints
  const { nextEndpoints, endpointsToDelete } = cleanRemainingEndpoints(
    currentState.endpoints,
    meta,
    deletedEventIds,
  );

  // 5. Identity Providers to remove
  const providersToDelete = (currentState.identityProviders || []).filter((p) =>
    allIdsSet.has(p.nodeId),
  );
  const nextProviders = (currentState.identityProviders || []).filter(
    (p) => !allIdsSet.has(p.nodeId),
  );

  // 6. Edges to remove
  const removedEdges = currentState.edges.filter((e) => {
    if (!e) return false;
    if (allIdsSet.has(e.source) || allIdsSet.has(e.target)) return true;
    if (e.sourceHandle) {
      for (const epId of deletedEndpointIds) {
        if (e.sourceHandle.includes(epId)) return true;
      }
      for (const evId of deletedEventIds) {
        if (e.sourceHandle.includes(evId)) return true;
      }
    }
    if (e.targetHandle) {
      for (const epId of deletedEndpointIds) {
        if (e.sourceHandle?.includes(epId)) return true;
        if (e.targetHandle.includes(epId)) return true;
      }
      for (const evId of deletedEventIds) {
        if (e.targetHandle.includes(evId)) return true;
      }
    }
    return false;
  });
  const removedEdgeIds = removedEdges.map((e) => e.id);
  const removedEdgeSet = new Set(removedEdgeIds);
  const nextEdges = currentState.edges.filter((e) => !removedEdgeSet.has(e.id));

  // 7. Config sidebar reset
  let nextActiveConfigItem = currentState.activeConfigItem;
  if (nextActiveConfigItem) {
    if (
      allIdsSet.has(nextActiveConfigItem.nodeId) ||
      deletedEndpointIds.has(nextActiveConfigItem.id) ||
      deletedEventIds.has(nextActiveConfigItem.id)
    ) {
      nextActiveConfigItem = null;
    }
  }

  // 8. Track changed entities for pending upserts
  const changedEndpoints = nextEndpoints.filter((ep) => {
    const old = currentState.endpoints.find((o) => o.id === ep.id);
    return old && old !== ep;
  });

  const changedEvents = nextEvents.filter((ev) => {
    const old = currentState.events.find((o) => o.id === ev.id);
    return old && old !== ev;
  });

  const changedNodes = nextNodes.filter((n) => {
    const old = currentState.nodes.find((o) => o.id === n.id);
    return old && old !== n;
  });

  return {
    nodes: nextNodes,
    edges: nextEdges,
    endpoints: nextEndpoints,
    events: nextEvents,
    identityProviders: nextProviders,
    activeConfigItem: nextActiveConfigItem,
    pendingNodeUpserts: [
      ...(currentState.pendingNodeUpserts || []).filter(
        (n) => !allIdsSet.has(n.id),
      ),
      ...changedNodes,
    ],
    pendingNodeRemovals: [
      ...(currentState.pendingNodeRemovals || []),
      ...idsToDeleteArray,
    ],
    pendingEdgeUpserts: (currentState.pendingEdgeUpserts || []).filter(
      (e) => !removedEdgeSet.has(e.id),
    ),
    pendingEdgeRemovals: [
      ...(currentState.pendingEdgeRemovals || []),
      ...removedEdgeIds,
    ],
    pendingEndpointUpserts: [
      ...(currentState.pendingEndpointUpserts || []),
      ...changedEndpoints,
    ],
    pendingEndpointRemovals: [
      ...(currentState.pendingEndpointRemovals || []),
      ...endpointsToDelete.map((ep) => ({
        nodeId: ep.nodeId,
        endpointId: ep.id,
      })),
    ],
    pendingEventUpserts: [
      ...currentState.pendingEventUpserts,
      ...changedEvents,
    ],
    pendingEventRemovals: [
      ...currentState.pendingEventRemovals,
      ...eventsToDelete.map((ev) => ({ nodeId: ev.nodeId, eventId: ev.id })),
    ],
    pendingIdentityProviderRemovals: [
      ...(currentState.pendingIdentityProviderRemovals || []),
      ...providersToDelete.map((p) => ({
        nodeId: p.nodeId,
        providerId: p.id,
      })),
    ],
  };
}
