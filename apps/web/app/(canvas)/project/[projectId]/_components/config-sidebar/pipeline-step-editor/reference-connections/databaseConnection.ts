import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";
import { PipelineStepDraft } from "../types";
import { flattenAllPipelineSteps } from "../stepConstants";

// ---------------------------------------------------------------------------
// Database Table Ref Node & Function Edge Synchronization Helpers
// ---------------------------------------------------------------------------

export interface DatabaseRefConnectionResult {
  dbRefNodeId: string;
  edgeId?: string;
  functionName?: string;
}

export interface EnsureDatabaseRefConnectionParams {
  tableNodeId?: string;
  databaseId?: string;
  serviceNodeId?: string;
  endpointId?: string;
  consumedEventId?: string;
  functionName?: string;
}

export interface CleanupDatabaseRefConnectionParams {
  tableNodeId?: string;
  databaseId?: string;
  serviceNodeId?: string;
  endpointId?: string;
  consumedEventId?: string;
  functionName?: string;
  remainingSteps: PipelineStepDraft[];
}

/**
 * Ensures a single db_ref node exists for the target table/entity per service,
 * and creates an edge targeting the specific entity function handle (`func-${functionName}`).
 */
export function ensureDatabaseRefConnection({
  tableNodeId,
  databaseId,
  serviceNodeId,
  endpointId,
  consumedEventId,
  functionName,
}: EnsureDatabaseRefConnectionParams): DatabaseRefConnectionResult | undefined {
  if (!serviceNodeId) return undefined;

  const store = useBackendCanvasStore.getState();
  const allNodes = store.nodes;
  const edges = store.edges;

  // 1. Look for existing db_ref node for this entity/table associated with this server (serviceNodeId)
  // "1 db_ref for any entity per server"
  let dbRefNode = allNodes.find((n) => {
    if (n.type !== "db_ref") return false;
    const matchesTable =
      (tableNodeId && (n.data?.tableRef === tableNodeId || n.id === tableNodeId)) ||
      (!tableNodeId && databaseId && n.data?.databaseId === databaseId);
    if (!matchesTable) return false;

    // Check if this db_ref belongs to this server
    const isConnectedToThisService = edges.some(
      (e) =>
        (e.source === serviceNodeId && e.target === n.id) ||
        (e.target === serviceNodeId && e.source === n.id),
    );
    const isTaggedForService = n.data?.targetServiceId === serviceNodeId;
    return isConnectedToThisService || isTaggedForService;
  });

  // If not found, check if an unattached db_ref (not belonging to any other server) matches tableRef
  if (!dbRefNode && tableNodeId) {
    dbRefNode = allNodes.find((n) => {
      if (n.type !== "db_ref") return false;
      const matchesTable = n.data?.tableRef === tableNodeId || n.id === tableNodeId;
      if (!matchesTable) return false;
      const isClaimedByOther =
        Boolean(n.data?.targetServiceId && n.data?.targetServiceId !== serviceNodeId) ||
        edges.some(
          (e) =>
            (e.target === n.id && e.source !== serviceNodeId) ||
            (e.source === n.id && e.target !== serviceNodeId),
        );
      return !isClaimedByOther;
    });
  }

  // 2. If no db_ref node exists, create one!
  if (!dbRefNode) {
    const targetEntityNode = allNodes.find(
      (n) => n.id === tableNodeId && (n.type === "entity" || n.type === "db_ref"),
    );
    const serviceNode = allNodes.find((n) => n.id === serviceNodeId);
    const targetDbNode = allNodes.find(
      (n) => n.id === (databaseId || targetEntityNode?.data?.databaseId),
    );

    const tableLabel =
      targetEntityNode?.data?.label ||
      (targetEntityNode?.type === "db_ref" ? targetEntityNode?.data?.label : undefined) ||
      "Table Ref";

    const newDbRefId = crypto.randomUUID();
    const basePos = serviceNode?.position || targetEntityNode?.position || { x: 300, y: 200 };

    const existingRefNodes = allNodes.filter(
      (n) => n.type === "db_ref" || n.type === "redis-cache",
    );
    const yOffset = existingRefNodes.length * 110;
    const newPos = {
      x: basePos.x - 340,
      y: basePos.y + yOffset,
    };

    store.addNode({
      id: newDbRefId,
      type: "db_ref",
      position: newPos,
      data: {
        label: tableLabel,
        tableRef: targetEntityNode?.type === "entity" ? targetEntityNode.id : tableNodeId,
        databaseId: databaseId || targetEntityNode?.data?.databaseId || targetDbNode?.id,
        targetServiceId: serviceNodeId,
        description: `Reference to ${tableLabel}`,
      },
    });

    dbRefNode = useBackendCanvasStore
      .getState()
      .nodes.find((n) => n.id === newDbRefId);
  }

  if (!dbRefNode) return undefined;

  // 3. Determine target handle: connect to specific function
  let resolvedFnName = functionName;
  const effectiveTableRef = dbRefNode.data?.tableRef || tableNodeId;
  if (!resolvedFnName && effectiveTableRef) {
    const refEntity = allNodes.find((n) => n.id === effectiveTableRef);
    if (refEntity) {
      const ops = getEntityDbOperations(refEntity, allNodes);
      if (ops.length > 0) {
        resolvedFnName = ops[0]?.name;
      }
    }
  }

  // Outbound handle on DatabaseTableRefNode (func-out-${resolvedFnName} or database-source)
  const dbSourceHandle = resolvedFnName ? `func-out-${resolvedFnName}` : "database-source";

  // Inbound handle on ServiceNode (endpoint-in-${endpointId})
  const serviceTargetHandle = endpointId
    ? `endpoint-in-${endpointId}`
    : consumedEventId
    ? `consumedEvents-in-${consumedEventId}`
    : `endpoint-in-${serviceNodeId}`;

  // 4. Draw edge from DatabaseTableRefNode function handle (source) to ServiceNode endpoint-in handle (target)
  const currentEdges = useBackendCanvasStore.getState().edges;
  const existingEdge = currentEdges.find((e) => {
    // Ingress edge (step hanging on left feeding into server): dbRefNode -> serviceNode
    const ingressMatch =
      e.source === dbRefNode!.id &&
      e.target === serviceNodeId &&
      (e.targetHandle === serviceTargetHandle ||
        !e.targetHandle ||
        (endpointId && e.targetHandle.includes(endpointId))) &&
      (e.sourceHandle === dbSourceHandle ||
        !e.sourceHandle ||
        (resolvedFnName && e.sourceHandle.includes(resolvedFnName)));

    // Backward compatibility with legacy egress edge: serviceNode -> dbRefNode
    const legacyEgressMatch =
      e.source === serviceNodeId &&
      e.target === dbRefNode!.id &&
      (!e.sourceHandle || (endpointId && e.sourceHandle.includes(endpointId))) &&
      (!e.targetHandle || (resolvedFnName && e.targetHandle.includes(resolvedFnName)));

    return ingressMatch || legacyEgressMatch;
  });

  if (!existingEdge) {
    store.addEdge({
      id: `edge-dbref-${dbRefNode.id}-${serviceNodeId}-${endpointId || consumedEventId || "ep"}-${resolvedFnName || "fn"}-${Date.now()}`,
      source: dbRefNode.id,
      target: serviceNodeId,
      sourceHandle: dbSourceHandle,
      targetHandle: serviceTargetHandle,
      type: "connection",
    });
  }

  // 5. Update endpoint databaseNodeIds if endpointId exists
  if (endpointId) {
    const ep = store.endpoints.find((e) => e.id === endpointId);
    if (ep) {
      const currentDbIds =
        ep.databaseNodeIds ||
        (ep.databaseNodeId && ep.databaseNodeId !== "none"
          ? [ep.databaseNodeId]
          : []);

      if (!currentDbIds.includes(dbRefNode.id)) {
        const nextDbIds = [...currentDbIds, dbRefNode.id];
        store.updateEndpoint(endpointId, {
          databaseNodeIds: nextDbIds,
          databaseNodeId: nextDbIds[0] || dbRefNode.id,
        });
      }
    }
  }

  return {
    dbRefNodeId: dbRefNode.id,
    edgeId: existingEdge?.id,
    functionName: resolvedFnName,
  };
}

/**
 * Cleans up edge(s) connecting the service endpoint to a db_ref node / function when
 * the step is deleted or no longer references that function / table.
 * Strictly isolates matching to THIS specific table and service to avoid touching
 * other db_ref nodes and their edges.
 */
export function cleanupDatabaseRefConnection({
  tableNodeId,
  databaseId,
  serviceNodeId,
  endpointId,
  consumedEventId,
  functionName,
  remainingSteps,
}: CleanupDatabaseRefConnectionParams) {
  if (!serviceNodeId) return;
  const store = useBackendCanvasStore.getState();
  const allNodes = store.nodes;

  // Resolve entity ID if tableNodeId points to a db_ref or entity
  const targetNode = allNodes.find((n) => n.id === tableNodeId);
  const resolvedEntityId =
    targetNode?.type === "entity"
      ? targetNode.id
      : targetNode?.data?.tableRef || tableNodeId;

  const stepMatchesTable = (s: PipelineStepDraft) => {
    if (s.type !== "db_operation" || !s.tableNodeId) return false;
    if (s.tableNodeId === tableNodeId) return true;
    if (resolvedEntityId && s.tableNodeId === resolvedEntityId) return true;
    const sNode = allNodes.find((n) => n.id === s.tableNodeId);
    const sEntityId =
      sNode?.type === "entity" ? sNode.id : sNode?.data?.tableRef || s.tableNodeId;
    return Boolean(resolvedEntityId && sEntityId === resolvedEntityId);
  };

  // Check if any other db_operation in remainingSteps still uses this table & function
  const allRemainingSteps = flattenAllPipelineSteps(remainingSteps);
  const isFunctionStillUsed = allRemainingSteps.some((s) => {
    if (!stepMatchesTable(s)) return false;
    if (!functionName) return true;
    const sFnName = s.functionRef?.name || s.operationId;
    return sFnName === functionName;
  });

  const isTableStillUsedAtAll = allRemainingSteps.some((s) => stepMatchesTable(s));

  // Find matching db_ref node for THIS specific table on THIS service
  const matchingDbRefNodes = allNodes.filter((n) => {
    if (n.type !== "db_ref") return false;
    const matchesTable =
      (tableNodeId && (n.id === tableNodeId || n.data?.tableRef === tableNodeId)) ||
      (resolvedEntityId && (n.id === resolvedEntityId || n.data?.tableRef === resolvedEntityId));
    if (!matchesTable) return false;

    // Check if this db_ref belongs to this service
    return (
      n.data?.targetServiceId === serviceNodeId ||
      store.edges.some(
        (e) =>
          (e.source === serviceNodeId && e.target === n.id) ||
          (e.target === serviceNodeId && e.source === n.id),
      )
    );
  });

  const matchingDbRefNodeIds = new Set<string>();
  matchingDbRefNodes.forEach((n) => matchingDbRefNodeIds.add(n.id));
  if (tableNodeId) matchingDbRefNodeIds.add(tableNodeId);
  if (resolvedEntityId) matchingDbRefNodeIds.add(resolvedEntityId);

  // 1. If the specific function is not used anymore, delete the edge targeting that function handle
  if (!isFunctionStillUsed) {
    const edgesToDelete = store.edges.filter((e) => {
      const isServiceSource = e.source === serviceNodeId && matchingDbRefNodeIds.has(e.target);
      const isDbSource = e.target === serviceNodeId && matchingDbRefNodeIds.has(e.source);
      if (!isServiceSource && !isDbSource) return false;
      const serviceH = isServiceSource ? e.sourceHandle : e.targetHandle;
      if (endpointId && serviceH && !serviceH.includes(endpointId)) return false;
      if (consumedEventId && serviceH && !serviceH.includes(consumedEventId)) return false;
      if (functionName) {
        const dbH = isServiceSource ? e.targetHandle : e.sourceHandle;
        return Boolean(dbH && dbH.includes(functionName));
      }
      return !isTableStillUsedAtAll;
    });

    edgesToDelete.forEach((e) => store.deleteEdge(e.id));
  }

  // 2. If the table is not used at all anymore in this endpoint, update endpoint databaseNodeIds
  // removing ONLY this specific table's db_ref node ID (other db_ref nodes remain untouched)
  if (!isTableStillUsedAtAll && endpointId) {
    const remainingTableEdges = store.edges.filter((e) => {
      const isServiceSource = e.source === serviceNodeId && matchingDbRefNodeIds.has(e.target);
      const isDbSource = e.target === serviceNodeId && matchingDbRefNodeIds.has(e.source);
      if (!isServiceSource && !isDbSource) return false;
      const serviceH = isServiceSource ? e.sourceHandle : e.targetHandle;
      if (serviceH && !serviceH.includes(endpointId)) return false;
      return true;
    });
    remainingTableEdges.forEach((e) => store.deleteEdge(e.id));

    const ep = store.endpoints.find((e) => e.id === endpointId);
    if (ep && ep.databaseNodeIds) {
      const nextDbIds = ep.databaseNodeIds.filter(
        (id) => !matchingDbRefNodeIds.has(id),
      );
      store.updateEndpoint(endpointId, {
        databaseNodeIds: nextDbIds,
        databaseNodeId: nextDbIds[0] || "none",
      });
    }
  }
}
