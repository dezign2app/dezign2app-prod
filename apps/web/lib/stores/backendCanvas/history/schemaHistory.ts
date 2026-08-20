import { BackendCanvasState } from "../types";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { SchemaSnapshot } from "./types";

export function isSchemaNode(node: BackendNode): boolean {
  return (
    node.type === "entity" ||
    node.type === "database" ||
    node.type === "group"
  );
}

export function isSchemaEdge(
  edge: BackendEdge,
  nodesMap: Map<string, BackendNode>,
): boolean {
  if (edge.type === "foreign-key" || edge.type === "database-connection") {
    return true;
  }
  const src = nodesMap.get(edge.source);
  const tgt = nodesMap.get(edge.target);
  if (src && tgt && isSchemaNode(src) && isSchemaNode(tgt)) {
    return true;
  }
  return false;
}

export function captureSchemaSnapshot(
  state: BackendCanvasState,
): SchemaSnapshot {
  const nodesMap = new Map<string, BackendNode>(
    state.nodes.map((n) => [n.id, n]),
  );
  const schemaNodes = state.nodes.filter(isSchemaNode);
  const schemaEdges = state.edges.filter((e) => isSchemaEdge(e, nodesMap));

  return {
    nodes: JSON.parse(JSON.stringify(schemaNodes)),
    edges: JSON.parse(JSON.stringify(schemaEdges)),
  };
}

export function applySchemaSnapshot(
  targetSnapshot: SchemaSnapshot,
  currentState: BackendCanvasState,
): Partial<BackendCanvasState> {
  const currentNodesMap = new Map<string, BackendNode>(
    currentState.nodes.map((n) => [n.id, n]),
  );
  const currentSchemaNodes = currentState.nodes.filter(isSchemaNode);
  const preservedGraphNodes = currentState.nodes.filter((n) => !isSchemaNode(n));

  const currentSchemaEdges = currentState.edges.filter((e) =>
    isSchemaEdge(e, currentNodesMap),
  );
  const preservedGraphEdges = currentState.edges.filter(
    (e) => !isSchemaEdge(e, currentNodesMap),
  );

  const currentSchemaNodesMap = new Map<string, BackendNode>(
    currentSchemaNodes.map((n) => [n.id, n]),
  );
  const targetNodesMap = new Map<string, BackendNode>(
    targetSnapshot.nodes.map((n) => [n.id, n]),
  );

  // Schema nodes to upsert (added or modified)
  const nodeUpsertsToApply: BackendNode[] = [];
  for (const [id, targetNode] of targetNodesMap) {
    const curr = currentSchemaNodesMap.get(id);
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

  // Schema nodes to delete (present in current schema but not in target snapshot)
  const nodeRemovalsToApply: string[] = [];
  for (const [id] of currentSchemaNodesMap) {
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

  // Schema edges
  const currentSchemaEdgesMap = new Map<string, BackendEdge>(
    currentSchemaEdges.map((e) => [e.id, e]),
  );
  const targetEdgesMap = new Map<string, BackendEdge>(
    targetSnapshot.edges.map((e) => [e.id, e]),
  );

  const edgeUpsertsToApply: BackendEdge[] = [];
  for (const [id, targetEdge] of targetEdgesMap) {
    const curr = currentSchemaEdgesMap.get(id);
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
  for (const [id] of currentSchemaEdgesMap) {
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

  const finalNodes = [...preservedGraphNodes, ...targetSnapshot.nodes];
  const finalEdges = [...preservedGraphEdges, ...targetSnapshot.edges];

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
    activeConfigItem,
    pendingNodeUpserts: nextPendingNodeUpserts,
    pendingNodeRemovals: nextPendingNodeRemovals,
    pendingEdgeUpserts: nextPendingEdgeUpserts,
    pendingEdgeRemovals: nextPendingEdgeRemovals,
  };
}
