import {
  BackendCanvasState,
  EndpointWithNode,
  EventWithNode,
  IdentityProviderWithNode,
  PendingEndpointRemoval,
  PendingEventRemoval,
  PendingIdentityProviderRemoval,
} from "../types";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { GraphSnapshot } from "./types";
import { isSchemaNode, isSchemaEdge } from "./schemaHistory";

export function isGraphNode(node: BackendNode): boolean {
  return !isSchemaNode(node);
}

export function isGraphEdge(
  edge: BackendEdge,
  nodesMap: Map<string, BackendNode>,
): boolean {
  return !isSchemaEdge(edge, nodesMap);
}

export function captureGraphSnapshot(
  state: BackendCanvasState,
): GraphSnapshot {
  const nodesMap = new Map<string, BackendNode>(
    state.nodes.map((n) => [n.id, n]),
  );
  const graphNodes = state.nodes.filter(isGraphNode);
  const graphEdges = state.edges.filter((e) => isGraphEdge(e, nodesMap));

  return {
    nodes: JSON.parse(JSON.stringify(graphNodes)),
    edges: JSON.parse(JSON.stringify(graphEdges)),
    endpoints: JSON.parse(JSON.stringify(state.endpoints)),
    events: JSON.parse(JSON.stringify(state.events)),
    identityProviders: JSON.parse(JSON.stringify(state.identityProviders)),
  };
}

export function applyGraphSnapshot(
  targetSnapshot: GraphSnapshot,
  currentState: BackendCanvasState,
): Partial<BackendCanvasState> {
  const currentNodesMap = new Map<string, BackendNode>(
    currentState.nodes.map((n) => [n.id, n]),
  );
  const currentGraphNodes = currentState.nodes.filter(isGraphNode);
  const preservedSchemaNodes = currentState.nodes.filter(isSchemaNode);

  const currentGraphEdges = currentState.edges.filter((e) =>
    isGraphEdge(e, currentNodesMap),
  );
  const preservedSchemaEdges = currentState.edges.filter((e) =>
    isSchemaEdge(e, currentNodesMap),
  );

  const currentGraphNodesMap = new Map<string, BackendNode>(
    currentGraphNodes.map((n) => [n.id, n]),
  );
  const targetNodesMap = new Map<string, BackendNode>(
    targetSnapshot.nodes.map((n) => [n.id, n]),
  );

  // Graph nodes to upsert
  const nodeUpsertsToApply: BackendNode[] = [];
  for (const [id, targetNode] of targetNodesMap) {
    const curr = currentGraphNodesMap.get(id);
    if (
      !curr ||
      curr.position.x !== targetNode.position.x ||
      curr.position.y !== targetNode.position.y ||
      curr.parentId !== targetNode.parentId ||
      curr.fractionalIndex !== targetNode.fractionalIndex ||
      curr.type !== targetNode.type ||
      JSON.stringify(curr.data) !== JSON.stringify(targetNode.data)
    ) {
      nodeUpsertsToApply.push(targetNode);
    }
  }

  // Graph nodes to delete
  const nodeRemovalsToApply: string[] = [];
  for (const [id] of currentGraphNodesMap) {
    if (!targetNodesMap.has(id)) {
      nodeRemovalsToApply.push(id);
    }
  }

  const nextPendingNodeUpserts = currentState.pendingNodeUpserts
    .filter(
      (n) =>
        !nodeRemovalsToApply.includes(n.id) &&
        !nodeUpsertsToApply.some((u) => u.id === n.id),
    )
    .concat(nodeUpsertsToApply);

  const nextPendingNodeRemovals = currentState.pendingNodeRemovals
    .filter(
      (id) =>
        !targetNodesMap.has(id) &&
        !nodeRemovalsToApply.includes(id),
    )
    .concat(nodeRemovalsToApply);

  // Graph edges
  const currentGraphEdgesMap = new Map<string, BackendEdge>(
    currentGraphEdges.map((e) => [e.id, e]),
  );
  const targetEdgesMap = new Map<string, BackendEdge>(
    targetSnapshot.edges.map((e) => [e.id, e]),
  );

  const edgeUpsertsToApply: BackendEdge[] = [];
  for (const [id, targetEdge] of targetEdgesMap) {
    const curr = currentGraphEdgesMap.get(id);
    if (
      !curr ||
      curr.source !== targetEdge.source ||
      curr.target !== targetEdge.target ||
      curr.sourceHandle !== targetEdge.sourceHandle ||
      curr.targetHandle !== targetEdge.targetHandle ||
      curr.type !== targetEdge.type ||
      JSON.stringify(curr.data) !== JSON.stringify(targetEdge.data)
    ) {
      edgeUpsertsToApply.push(targetEdge);
    }
  }

  const edgeRemovalsToApply: string[] = [];
  for (const [id] of currentGraphEdgesMap) {
    if (!targetEdgesMap.has(id)) {
      edgeRemovalsToApply.push(id);
    }
  }

  const nextPendingEdgeUpserts = currentState.pendingEdgeUpserts
    .filter(
      (e) =>
        !edgeRemovalsToApply.includes(e.id) &&
        !edgeUpsertsToApply.some((u) => u.id === e.id),
    )
    .concat(edgeUpsertsToApply);

  const nextPendingEdgeRemovals = currentState.pendingEdgeRemovals
    .filter(
      (id) =>
        !targetEdgesMap.has(id) &&
        !edgeRemovalsToApply.includes(id),
    )
    .concat(edgeRemovalsToApply);

  // Endpoints
  const currentEndpointsMap = new Map<string, EndpointWithNode>(
    currentState.endpoints.map((ep) => [ep.id, ep]),
  );
  const targetEndpointsMap = new Map<string, EndpointWithNode>(
    targetSnapshot.endpoints.map((ep) => [ep.id, ep]),
  );

  const endpointUpsertsToApply: EndpointWithNode[] = [];
  for (const [id, ep] of targetEndpointsMap) {
    const curr = currentEndpointsMap.get(id);
    if (!curr || JSON.stringify(curr) !== JSON.stringify(ep)) {
      endpointUpsertsToApply.push(ep);
    }
  }

  const endpointRemovalsToApply: PendingEndpointRemoval[] = [];
  for (const [id, ep] of currentEndpointsMap) {
    if (!targetEndpointsMap.has(id)) {
      endpointRemovalsToApply.push({ nodeId: ep.nodeId, endpointId: ep.id });
    }
  }

  const removedEpIds = new Set(endpointRemovalsToApply.map((r) => r.endpointId));
  const nextPendingEndpointUpserts = currentState.pendingEndpointUpserts
    .filter(
      (ep) =>
        !removedEpIds.has(ep.id) &&
        !endpointUpsertsToApply.some((u) => u.id === ep.id),
    )
    .concat(endpointUpsertsToApply);

  const nextPendingEndpointRemovals = currentState.pendingEndpointRemovals
    .filter((r) => !targetEndpointsMap.has(r.endpointId))
    .concat(endpointRemovalsToApply);

  // Events
  const currentEventsMap = new Map<string, EventWithNode>(
    currentState.events.map((ev) => [ev.id, ev]),
  );
  const targetEventsMap = new Map<string, EventWithNode>(
    targetSnapshot.events.map((ev) => [ev.id, ev]),
  );

  const eventUpsertsToApply: EventWithNode[] = [];
  for (const [id, ev] of targetEventsMap) {
    const curr = currentEventsMap.get(id);
    if (!curr || JSON.stringify(curr) !== JSON.stringify(ev)) {
      eventUpsertsToApply.push(ev);
    }
  }

  const eventRemovalsToApply: PendingEventRemoval[] = [];
  for (const [id, ev] of currentEventsMap) {
    if (!targetEventsMap.has(id)) {
      eventRemovalsToApply.push({ nodeId: ev.nodeId, eventId: ev.id });
    }
  }

  const removedEvIds = new Set(eventRemovalsToApply.map((r) => r.eventId));
  const nextPendingEventUpserts = currentState.pendingEventUpserts
    .filter(
      (ev) =>
        !removedEvIds.has(ev.id) &&
        !eventUpsertsToApply.some((u) => u.id === ev.id),
    )
    .concat(eventUpsertsToApply);

  const nextPendingEventRemovals = currentState.pendingEventRemovals
    .filter((r) => !targetEventsMap.has(r.eventId))
    .concat(eventRemovalsToApply);

  // Identity Providers
  const currentIdpMap = new Map<string, IdentityProviderWithNode>(
    currentState.identityProviders.map((idp) => [idp.id, idp]),
  );
  const targetIdpMap = new Map<string, IdentityProviderWithNode>(
    targetSnapshot.identityProviders.map((idp) => [idp.id, idp]),
  );

  const idpUpsertsToApply: IdentityProviderWithNode[] = [];
  for (const [id, idp] of targetIdpMap) {
    const curr = currentIdpMap.get(id);
    if (!curr || JSON.stringify(curr) !== JSON.stringify(idp)) {
      idpUpsertsToApply.push(idp);
    }
  }

  const idpRemovalsToApply: PendingIdentityProviderRemoval[] = [];
  for (const [id, idp] of currentIdpMap) {
    if (!targetIdpMap.has(id)) {
      idpRemovalsToApply.push({
        nodeId: idp.nodeId,
        providerId: idp.id,
      });
    }
  }

  const removedIdpIds = new Set(idpRemovalsToApply.map((r) => r.providerId));
  const nextPendingIdpUpserts = currentState.pendingIdentityProviderUpserts
    .filter(
      (idp) =>
        !removedIdpIds.has(idp.id) &&
        !idpUpsertsToApply.some((u) => u.id === idp.id),
    )
    .concat(idpUpsertsToApply);

  const nextPendingIdpRemovals = currentState.pendingIdentityProviderRemovals
    .filter((r) => !targetIdpMap.has(r.providerId))
    .concat(idpRemovalsToApply);

  const finalNodes = [...preservedSchemaNodes, ...targetSnapshot.nodes];
  const finalEdges = [...preservedSchemaEdges, ...targetSnapshot.edges];

  let activeConfigItem = currentState.activeConfigItem;
  if (activeConfigItem) {
    const activeNodeId = activeConfigItem.nodeId;
    const nodeStillExists = finalNodes.some((n) => n.id === activeNodeId);
    if (!nodeStillExists) {
      activeConfigItem = null;
    }
  }

  return {
    nodes: finalNodes,
    edges: finalEdges,
    endpoints: targetSnapshot.endpoints,
    events: targetSnapshot.events,
    identityProviders: targetSnapshot.identityProviders,
    activeConfigItem,
    pendingNodeUpserts: nextPendingNodeUpserts,
    pendingNodeRemovals: nextPendingNodeRemovals,
    pendingEdgeUpserts: nextPendingEdgeUpserts,
    pendingEdgeRemovals: nextPendingEdgeRemovals,
    pendingEndpointUpserts: nextPendingEndpointUpserts,
    pendingEndpointRemovals: nextPendingEndpointRemovals,
    pendingEventUpserts: nextPendingEventUpserts,
    pendingEventRemovals: nextPendingEventRemovals,
    pendingIdentityProviderUpserts: nextPendingIdpUpserts,
    pendingIdentityProviderRemovals: nextPendingIdpRemovals,
  };
}
