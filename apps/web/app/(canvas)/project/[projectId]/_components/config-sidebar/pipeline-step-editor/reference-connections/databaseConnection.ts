import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";
import { PipelineStepDraft } from "../types";
import { flattenAllPipelineSteps } from "../stepConstants";
import type { BackendNode } from "@workspace/canvas/types";

// ---------------------------------------------------------------------------
// Database Table Ref Node & Function Edge Synchronization Helpers
// ---------------------------------------------------------------------------

export interface DatabaseRefConnectionResult {
  dbRefNodeId: string;
  edgeId?: string;
  functionName?: string;
}

export interface EnsureDatabaseRefConnectionParams {
  stepId?: string;
  dbRefNodeId?: string;
  tableNodeId?: string;
  databaseId?: string;
  serviceNodeId?: string;
  endpointId?: string;
  consumedEventId?: string;
  functionName?: string;
}

export interface CleanupDatabaseRefConnectionParams {
  stepId?: string;
  dbRefNodeId?: string;
  tableNodeId?: string;
  databaseId?: string;
  serviceNodeId?: string;
  endpointId?: string;
  consumedEventId?: string;
  functionName?: string;
  remainingSteps: PipelineStepDraft[];
}

export interface UpdateDatabaseRefConnectionParams {
  stepId?: string;
  dbRefNodeId?: string;
  prevTableNodeId?: string;
  prevDatabaseId?: string;
  prevFunctionName?: string;
  newTableNodeId?: string;
  newDatabaseId?: string;
  newFunctionName?: string;
  serviceNodeId?: string;
  endpointId?: string;
  consumedEventId?: string;
  remainingSteps: PipelineStepDraft[];
}

/**
 * Ensures a db_ref node exists for the target table on the target service (max 1 tableRef per table per ServiceNode),
 * and creates an edge targeting the specific entity function handle (`func-out-${functionName}`).
 */
export function ensureDatabaseRefConnection({
  stepId,
  dbRefNodeId,
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

  const targetEntityNode = allNodes.find(
    (n) => n.id === tableNodeId && (n.type === "entity" || n.type === "db_ref"),
  );
  const resolvedTableId =
    targetEntityNode?.type === "entity"
      ? targetEntityNode.id
      : targetEntityNode?.data?.tableRef || tableNodeId;

  // 1. Look for existing db_ref node for this table and this service (max 1 per table per ServiceNode)
  let dbRefNode: BackendNode | undefined;
  if (dbRefNodeId) {
    const candidate = allNodes.find((n) => n.id === dbRefNodeId);
    if (
      candidate &&
      candidate.type === "db_ref" &&
      (candidate.data?.tableRef === resolvedTableId ||
        candidate.data?.tableRef === tableNodeId ||
        candidate.id === resolvedTableId ||
        candidate.id === tableNodeId)
    ) {
      dbRefNode = candidate;
    }
  }

  // Find any existing db_ref node representing this table that belongs to this serviceNode
  if (!dbRefNode && (resolvedTableId || tableNodeId)) {
    const targetTable = resolvedTableId || tableNodeId;
    dbRefNode = allNodes.find((n) => {
      if (n.type !== "db_ref") return false;
      const matchesTable =
        n.data?.tableRef === targetTable ||
        n.id === targetTable ||
        (tableNodeId && n.data?.tableRef === tableNodeId);
      if (!matchesTable) return false;

      const isConnectedToThisService = edges.some(
        (e) =>
          (e.source === serviceNodeId && e.target === n.id) ||
          (e.target === serviceNodeId && e.source === n.id),
      );
      const isTaggedForService = n.data?.targetServiceId === serviceNodeId;
      return isConnectedToThisService || isTaggedForService;
    });

    if (!dbRefNode) {
      dbRefNode = allNodes.find((n) => {
        if (n.type !== "db_ref") return false;
        const matchesTable =
          n.data?.tableRef === targetTable ||
          n.id === targetTable ||
          (tableNodeId && n.data?.tableRef === tableNodeId);
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
  }

  const serviceNode = allNodes.find((n) => n.id === serviceNodeId);
  const targetDbNode = allNodes.find(
    (n) => n.id === (databaseId || targetEntityNode?.data?.databaseId),
  );

  const tableLabel =
    targetEntityNode?.data?.label ||
    (targetEntityNode?.type === "db_ref" ? targetEntityNode?.data?.label : undefined) ||
    dbRefNode?.data?.label ||
    "Table Ref";

  const resolvedDbId =
    databaseId ||
    targetEntityNode?.data?.databaseId ||
    targetDbNode?.id ||
    dbRefNode?.data?.databaseId;

  // 2. If existing db_ref node found, update it in place (preserve single node per table)
  if (dbRefNode) {
    store.updateNode(dbRefNode.id, {
      data: {
        ...dbRefNode.data,
        label: tableLabel,
        tableRef: targetEntityNode?.type === "entity" ? targetEntityNode.id : (tableNodeId || dbRefNode.data?.tableRef),
        databaseId: resolvedDbId,
        targetServiceId: serviceNodeId,
        endpointId: endpointId || dbRefNode.data?.endpointId,
        consumedEventId: consumedEventId || dbRefNode.data?.consumedEventId,
        description: `Reference to ${tableLabel}`,
      },
    });
  } else {
    // 3. Otherwise, create a new db_ref node for this table
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
        databaseId: resolvedDbId,
        targetServiceId: serviceNodeId,
        stepId,
        endpointId,
        consumedEventId,
        description: `Reference to ${tableLabel}`,
      },
    });

    dbRefNode = useBackendCanvasStore
      .getState()
      .nodes.find((n) => n.id === newDbRefId);
  }

  if (!dbRefNode) return undefined;

  // 4. Determine target handle: connect to specific function
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

  const dbSourceHandle = resolvedFnName ? `func-out-${resolvedFnName}` : "database-source";
  const serviceTargetHandle = endpointId
    ? `endpoint-in-${endpointId}`
    : consumedEventId
    ? `consumedEvents-in-${consumedEventId}`
    : `endpoint-in-${serviceNodeId}`;

  const refreshedEdges = useBackendCanvasStore.getState().edges;
  const existingEdge = refreshedEdges.find((e) => {
    const ingressMatch =
      e.source === dbRefNode!.id &&
      e.target === serviceNodeId &&
      (e.targetHandle === serviceTargetHandle ||
        !e.targetHandle ||
        (endpointId && e.targetHandle.includes(endpointId))) &&
      (e.sourceHandle === dbSourceHandle ||
        !e.sourceHandle ||
        (resolvedFnName && e.sourceHandle.includes(resolvedFnName)));

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
 * Cleans up edge(s) and db_ref node when a db_operation step is deleted.
 * If other steps still use this table on this service, preserves the db_ref node
 * and only removes the specific function edge if that function is no longer needed.
 */
export function cleanupDatabaseRefConnection({
  stepId,
  dbRefNodeId,
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

  const targetNode = allNodes.find((n) => n.id === tableNodeId);
  const resolvedEntityId =
    targetNode?.type === "entity"
      ? targetNode.id
      : targetNode?.data?.tableRef || tableNodeId;

  // 1. Locate the matching db_ref node
  let targetRefNode: BackendNode | undefined;
  if (dbRefNodeId) {
    targetRefNode = allNodes.find((n) => n.id === dbRefNodeId);
  }
  if (!targetRefNode) {
    targetRefNode = allNodes.find((n) => {
      if (n.type !== "db_ref") return false;
      const matchesTable =
        (tableNodeId && (n.id === tableNodeId || n.data?.tableRef === tableNodeId)) ||
        (resolvedEntityId && (n.id === resolvedEntityId || n.data?.tableRef === resolvedEntityId));
      if (!matchesTable) return false;
      return (
        n.data?.targetServiceId === serviceNodeId ||
        store.edges.some(
          (e) =>
            (e.source === serviceNodeId && e.target === n.id) ||
            (e.target === serviceNodeId && e.source === n.id),
        )
      );
    });
  }

  const stepMatchesTable = (s: PipelineStepDraft) => {
    if (s.type !== "db_operation" || !s.tableNodeId) return false;
    if (stepId && s.id === stepId) return false;
    if (targetRefNode && s.dbRefNodeId === targetRefNode.id) return true;
    if (tableNodeId && s.tableNodeId === tableNodeId) return true;
    if (resolvedEntityId && s.tableNodeId === resolvedEntityId) return true;
    const sNode = allNodes.find((n) => n.id === s.tableNodeId);
    const sEntityId =
      sNode?.type === "entity" ? sNode.id : sNode?.data?.tableRef || s.tableNodeId;
    return Boolean(resolvedEntityId && sEntityId === resolvedEntityId);
  };

  const allRemainingSteps = flattenAllPipelineSteps(remainingSteps);
  const isTableUsedInRemaining = allRemainingSteps.some(stepMatchesTable);

  const otherEndpoints = store.endpoints.filter(
    (e) => e.nodeId === serviceNodeId && (!endpointId || e.id !== endpointId),
  );
  const isTableUsedInOtherEndpoints = otherEndpoints.some((ep) =>
    flattenAllPipelineSteps(ep.pipelineSteps || []).some(stepMatchesTable),
  );

  const otherEvents = (store.events || []).filter(
    (ev: any) => ev.nodeId === serviceNodeId && (!consumedEventId || ev.id !== consumedEventId),
  );
  const isTableUsedInOtherEvents = otherEvents.some((ev: any) =>
    flattenAllPipelineSteps(ev.pipelineSteps || []).some(stepMatchesTable),
  );

  const isTableStillUsedOnService =
    isTableUsedInRemaining || isTableUsedInOtherEndpoints || isTableUsedInOtherEvents;

  if (!isTableStillUsedOnService) {
    // If the table is no longer used by any step on this service, delete connected edges and the node
    if (targetRefNode) {
      const connectedEdges = store.edges.filter(
        (e) => e.source === targetRefNode!.id || e.target === targetRefNode!.id,
      );
      connectedEdges.forEach((e) => store.deleteEdge(e.id));
      store.deleteNode(targetRefNode.id);

      if (endpointId) {
        const ep = store.endpoints.find((e) => e.id === endpointId);
        if (ep && ep.databaseNodeIds) {
          const nextDbIds = ep.databaseNodeIds.filter((id) => id !== targetRefNode!.id);
          store.updateEndpoint(endpointId, {
            databaseNodeIds: nextDbIds,
            databaseNodeId: nextDbIds[0] || "none",
          });
        }
      }
    }
  } else {
    // Table is still in use by another step on this service: keep the node!
    // Only delete the specific function edge if no other step on this endpoint still uses it
    const isFunctionStillUsed = allRemainingSteps.some((s) => {
      if (!stepMatchesTable(s)) return false;
      const sFnName = s.functionRef?.name || s.operationId;
      return sFnName === functionName;
    });

    if (!isFunctionStillUsed && functionName && targetRefNode) {
      const edgesToDelete = store.edges.filter((e) => {
        const isIngress = e.source === targetRefNode!.id && e.target === serviceNodeId;
        const isEgress = e.target === targetRefNode!.id && e.source === serviceNodeId;
        if (!isIngress && !isEgress) return false;
        const serviceH = isIngress ? e.targetHandle : e.sourceHandle;
        if (endpointId && serviceH && !serviceH.includes(endpointId)) return false;
        if (consumedEventId && serviceH && !serviceH.includes(consumedEventId)) return false;
        const dbH = isIngress ? e.sourceHandle : e.targetHandle;
        return (
          dbH === `func-out-${functionName}` ||
          dbH === `func-${functionName}` ||
          dbH?.includes(functionName)
        );
      });
      edgesToDelete.forEach((e) => store.deleteEdge(e.id));
    }
  }
}

/**
 * Updates an existing db_ref node and function edge when a db_operation step's table or function changes.
 * Guarantees max 1 db_ref node per table per serviceNode.
 */
export function updateDatabaseRefConnection({
  stepId,
  dbRefNodeId,
  prevTableNodeId,
  prevDatabaseId,
  prevFunctionName,
  newTableNodeId,
  newDatabaseId,
  newFunctionName,
  serviceNodeId,
  endpointId,
  consumedEventId,
  remainingSteps,
}: UpdateDatabaseRefConnectionParams): DatabaseRefConnectionResult | undefined {
  if (!serviceNodeId) return undefined;

  const store = useBackendCanvasStore.getState();
  const allNodes = store.nodes;
  const edges = store.edges;

  const prevTargetNode = allNodes.find((n) => n.id === prevTableNodeId);
  const resolvedPrevEntityId =
    prevTargetNode?.type === "entity"
      ? prevTargetNode.id
      : prevTargetNode?.data?.tableRef || prevTableNodeId;

  const newTargetNode = allNodes.find((n) => n.id === newTableNodeId);
  const resolvedNewEntityId =
    newTargetNode?.type === "entity"
      ? newTargetNode.id
      : newTargetNode?.data?.tableRef || newTableNodeId;

  const isTableSame =
    Boolean(resolvedPrevEntityId && resolvedNewEntityId && resolvedPrevEntityId === resolvedNewEntityId) ||
    Boolean(prevTableNodeId && newTableNodeId && prevTableNodeId === newTableNodeId);

  if (isTableSame) {
    // Same table: update function connection on the same db_ref node
    if (prevFunctionName && prevFunctionName !== newFunctionName) {
      cleanupDatabaseRefConnection({
        stepId,
        dbRefNodeId,
        tableNodeId: prevTableNodeId,
        databaseId: prevDatabaseId,
        serviceNodeId,
        endpointId,
        consumedEventId,
        functionName: prevFunctionName,
        remainingSteps,
      });
    }

    return ensureDatabaseRefConnection({
      stepId,
      dbRefNodeId,
      tableNodeId: newTableNodeId,
      databaseId: newDatabaseId,
      serviceNodeId,
      endpointId,
      consumedEventId,
      functionName: newFunctionName,
    });
  }

  // -------------------------------------------------------------------------
  // Different table:
  // 1. On table change check for other connections on the table ref node if there are none then delete the table ref node
  // 2. Check for the existing table refs connected to the service node if you find the table ref then draw an edge to it
  // -------------------------------------------------------------------------
  let prevRefNode: BackendNode | undefined;
  if (dbRefNodeId) {
    prevRefNode = allNodes.find((n) => n.id === dbRefNodeId);
  }
  if (!prevRefNode && (prevTableNodeId || resolvedPrevEntityId)) {
    const targetTable = resolvedPrevEntityId || prevTableNodeId;
    prevRefNode = allNodes.find((n) => {
      if (n.type !== "db_ref") return false;
      const matchesTable =
        n.data?.tableRef === targetTable ||
        n.id === targetTable ||
        (prevTableNodeId && n.data?.tableRef === prevTableNodeId);
      if (!matchesTable) return false;
      return (
        n.data?.targetServiceId === serviceNodeId ||
        edges.some(
          (e) =>
            (e.source === serviceNodeId && e.target === n.id) ||
            (e.target === serviceNodeId && e.source === n.id),
        )
      );
    });
  }

  if (prevRefNode) {
    // Delete the edge(s) for this step / endpoint connected to prevRefNode
    const currentEdges = store.edges;
    const stepEdgesToDelete = currentEdges.filter((e) => {
      const isIngress = e.source === prevRefNode!.id && e.target === serviceNodeId;
      const isEgress = e.target === prevRefNode!.id && e.source === serviceNodeId;
      if (!isIngress && !isEgress) return false;
      const serviceH = isIngress ? e.targetHandle : e.sourceHandle;
      if (endpointId && serviceH && !serviceH.includes(endpointId)) return false;
      if (consumedEventId && serviceH && !serviceH.includes(consumedEventId)) return false;
      if (prevFunctionName) {
        const dbH = isIngress ? e.sourceHandle : e.targetHandle;
        return (
          dbH === `func-out-${prevFunctionName}` ||
          dbH === `func-${prevFunctionName}` ||
          dbH?.includes(prevFunctionName)
        );
      }
      return true;
    });
    stepEdgesToDelete.forEach((e) => store.deleteEdge(e.id));

    // Check if there are other connections on the table ref node
    const refreshedEdges = useBackendCanvasStore.getState().edges;
    const remainingConnections = refreshedEdges.filter(
      (e) => e.source === prevRefNode!.id || e.target === prevRefNode!.id,
    );

    // If there are none, delete the table ref node
    if (remainingConnections.length === 0) {
      store.deleteNode(prevRefNode.id);
      if (endpointId) {
        const ep = store.endpoints.find((e) => e.id === endpointId);
        if (ep && ep.databaseNodeIds) {
          const nextDbIds = ep.databaseNodeIds.filter((id) => id !== prevRefNode!.id);
          store.updateEndpoint(endpointId, {
            databaseNodeIds: nextDbIds,
            databaseNodeId: nextDbIds[0] || "none",
          });
        }
      }
    }
  }

  // 2. Check for the existing table refs connected to the service node.
  // If you find the table ref then draw an edge to it (handled inside ensureDatabaseRefConnection)
  return ensureDatabaseRefConnection({
    stepId,
    tableNodeId: newTableNodeId,
    databaseId: newDatabaseId,
    serviceNodeId,
    endpointId,
    consumedEventId,
    functionName: newFunctionName,
  });
}
