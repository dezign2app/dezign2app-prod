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
 * Ensures a dedicated db_ref node exists for the target pipeline step (1 table ref per step),
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

  // 1. Look for existing db_ref node for this step
  let dbRefNode: BackendNode | undefined;
  if (dbRefNodeId) {
    dbRefNode = allNodes.find((n) => n.id === dbRefNodeId);
  } else if (stepId) {
    dbRefNode = allNodes.find(
      (n) => n.type === "db_ref" && n.data?.stepId === stepId,
    );
  }

  // Fallback for legacy calls where stepId and dbRefNodeId were not provided:
  if (!dbRefNode && !stepId && !dbRefNodeId) {
    dbRefNode = allNodes.find((n) => {
      if (n.type !== "db_ref") return false;
      const matchesTable =
        (tableNodeId && (n.data?.tableRef === tableNodeId || n.id === tableNodeId)) ||
        (!tableNodeId && databaseId && n.data?.databaseId === databaseId);
      if (!matchesTable) return false;

      const isConnectedToThisService = edges.some(
        (e) =>
          (e.source === serviceNodeId && e.target === n.id) ||
          (e.target === serviceNodeId && e.source === n.id),
      );
      const isTaggedForService = n.data?.targetServiceId === serviceNodeId;
      return isConnectedToThisService || isTaggedForService;
    });

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
  }

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
    dbRefNode?.data?.label ||
    "Table Ref";

  const resolvedDbId =
    databaseId ||
    targetEntityNode?.data?.databaseId ||
    targetDbNode?.id ||
    dbRefNode?.data?.databaseId;

  // 2. If existing db_ref node found, update it in place!
  if (dbRefNode) {
    store.updateNode(dbRefNode.id, {
      data: {
        ...dbRefNode.data,
        label: tableLabel,
        tableRef: targetEntityNode?.type === "entity" ? targetEntityNode.id : (tableNodeId || dbRefNode.data?.tableRef),
        databaseId: resolvedDbId,
        targetServiceId: serviceNodeId,
        stepId: stepId || dbRefNode.data?.stepId,
        endpointId: endpointId || dbRefNode.data?.endpointId,
        consumedEventId: consumedEventId || dbRefNode.data?.consumedEventId,
        description: `Reference to ${tableLabel}`,
      },
    });
  } else {
    // 3. Otherwise, create a new db_ref node dedicated to this step
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

  // Clean up any outdated edges for this step/endpoint to avoid duplicate function handles
  const currentEdges = useBackendCanvasStore.getState().edges;
  const edgesToDelete = currentEdges.filter((e) => {
    const isIngress = e.source === dbRefNode!.id && e.target === serviceNodeId;
    const isEgress = e.target === dbRefNode!.id && e.source === serviceNodeId;
    if (!isIngress && !isEgress) return false;
    const serviceH = isIngress ? e.targetHandle : e.sourceHandle;
    if (endpointId && serviceH && !serviceH.includes(endpointId)) return false;
    if (consumedEventId && serviceH && !serviceH.includes(consumedEventId)) return false;
    const dbH = isIngress ? e.sourceHandle : e.targetHandle;
    return dbH !== dbSourceHandle;
  });
  edgesToDelete.forEach((e) => store.deleteEdge(e.id));

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
 * Cleans up edge(s) and db_ref node when the db_operation step is deleted.
 * In 1:1 link model, deleting the step deletes its linked db_ref node and connected edges.
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

  // 1. In 1:1 model, look up the step's dedicated db_ref node by dbRefNodeId or stepId
  let targetRefNode: BackendNode | undefined;
  if (dbRefNodeId) {
    targetRefNode = allNodes.find((n) => n.id === dbRefNodeId);
  } else if (stepId) {
    targetRefNode = allNodes.find(
      (n) => n.type === "db_ref" && n.data?.stepId === stepId,
    );
  }

  if (targetRefNode) {
    // Delete all edges connected to this step's node
    const connectedEdges = store.edges.filter(
      (e) => e.source === targetRefNode!.id || e.target === targetRefNode!.id,
    );
    connectedEdges.forEach((e) => store.deleteEdge(e.id));

    // Delete node
    store.deleteNode(targetRefNode.id);

    // Update endpoint databaseNodeIds
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
    return;
  }

  // 2. Legacy fallback if stepId/dbRefNodeId are not provided
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

  const allRemainingSteps = flattenAllPipelineSteps(remainingSteps);
  const isFunctionStillUsed = allRemainingSteps.some((s) => {
    if (!stepMatchesTable(s)) return false;
    if (!functionName) return true;
    const sFnName = s.functionRef?.name || s.operationId;
    return sFnName === functionName;
  });

  const isTableStillUsedAtAll = allRemainingSteps.some((s) => stepMatchesTable(s));

  const matchingDbRefNodes = allNodes.filter((n) => {
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

  const matchingDbRefNodeIds = new Set<string>();
  matchingDbRefNodes.forEach((n) => matchingDbRefNodeIds.add(n.id));
  if (tableNodeId) matchingDbRefNodeIds.add(tableNodeId);
  if (resolvedEntityId) matchingDbRefNodeIds.add(resolvedEntityId);

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

  if (!isTableStillUsedAtAll) {
    const remainingTableEdges = store.edges.filter((e) => {
      const isServiceSource = e.source === serviceNodeId && matchingDbRefNodeIds.has(e.target);
      const isDbSource = e.target === serviceNodeId && matchingDbRefNodeIds.has(e.source);
      if (!isServiceSource && !isDbSource) return false;
      const serviceH = isServiceSource ? e.sourceHandle : e.targetHandle;
      if (endpointId && serviceH && !serviceH.includes(endpointId)) return false;
      if (consumedEventId && serviceH && !serviceH.includes(consumedEventId)) return false;
      return true;
    });
    remainingTableEdges.forEach((e) => store.deleteEdge(e.id));

    if (endpointId) {
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

    const currentEdges = useBackendCanvasStore.getState().edges;
    matchingDbRefNodes.forEach((refNode) => {
      const remainingEdges = currentEdges.filter(
        (edge) => edge.target === refNode.id || edge.source === refNode.id,
      );
      if (remainingEdges.length === 0) {
        store.deleteNode(refNode.id);
      }
    });
  }
}

/**
 * Updates an existing db_ref node and function edge when a db_operation step's table or function changes.
 * - In 1:1 link model (stepId or dbRefNodeId provided): updates the step's dedicated db_ref node in place.
 * - In legacy fallback mode: shares db_ref across endpoints if applicable without leaving unused nodes.
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

  // 1. Locate the step's dedicated db_ref node
  let dbRefNode: BackendNode | undefined;
  if (dbRefNodeId) {
    dbRefNode = allNodes.find((n) => n.id === dbRefNodeId);
  }
  if (!dbRefNode && stepId) {
    dbRefNode = allNodes.find(
      (n) => n.type === "db_ref" && n.data?.stepId === stepId,
    );
  }

  // -------------------------------------------------------------------------
  // Mode A: Dedicated 1:1 Step Link Model (stepId or dbRefNodeId is provided)
  // -------------------------------------------------------------------------
  if (stepId || dbRefNodeId) {
    if (!dbRefNode && prevTableNodeId) {
      const prevTargetNode = allNodes.find((n) => n.id === prevTableNodeId);
      const resolvedPrevEntityId =
        prevTargetNode?.type === "entity"
          ? prevTargetNode.id
          : prevTargetNode?.data?.tableRef || prevTableNodeId;

      dbRefNode = allNodes.find((n) => {
        if (n.type !== "db_ref") return false;
        const matchesTable =
          (prevTableNodeId && (n.id === prevTableNodeId || n.data?.tableRef === prevTableNodeId)) ||
          (resolvedPrevEntityId && (n.id === resolvedPrevEntityId || n.data?.tableRef === resolvedPrevEntityId));
        if (!matchesTable) return false;

        const isConnected = edges.some(
          (e) =>
            (e.source === serviceNodeId && e.target === n.id) ||
            (e.target === serviceNodeId && e.source === n.id),
        );
        return isConnected || n.data?.targetServiceId === serviceNodeId;
      });
    }

    if (dbRefNode) {
      const newTargetNode = allNodes.find((n) => n.id === newTableNodeId);
      const resolvedNewEntityId =
        newTargetNode?.type === "entity"
          ? newTargetNode.id
          : newTargetNode?.data?.tableRef || newTableNodeId;

      const tableLabel =
        newTargetNode?.data?.label ||
        (newTargetNode?.type === "db_ref" ? newTargetNode?.data?.label : undefined) ||
        "Table Ref";

      const targetDbNode = allNodes.find(
        (n) => n.id === (newDatabaseId || newTargetNode?.data?.databaseId),
      );
      const newDbId =
        newDatabaseId ||
        newTargetNode?.data?.databaseId ||
        targetDbNode?.id ||
        dbRefNode.data?.databaseId;

      store.updateNode(dbRefNode.id, {
        data: {
          ...dbRefNode.data,
          label: tableLabel,
          tableRef: newTargetNode?.type === "entity" ? newTargetNode.id : (resolvedNewEntityId || newTableNodeId),
          databaseId: newDbId,
          targetServiceId: serviceNodeId,
          stepId: stepId || dbRefNode.data?.stepId,
          endpointId: endpointId || dbRefNode.data?.endpointId,
          consumedEventId: consumedEventId || dbRefNode.data?.consumedEventId,
          description: `Reference to ${tableLabel}`,
        },
      });

      const oldEdges = store.edges.filter((e) => {
        const isIngress = e.source === dbRefNode!.id && e.target === serviceNodeId;
        const isEgress = e.target === dbRefNode!.id && e.source === serviceNodeId;
        if (!isIngress && !isEgress) return false;
        const serviceH = isIngress ? e.targetHandle : e.sourceHandle;
        if (endpointId && serviceH && !serviceH.includes(endpointId)) return false;
        if (consumedEventId && serviceH && !serviceH.includes(consumedEventId)) return false;
        return true;
      });
      oldEdges.forEach((e) => store.deleteEdge(e.id));

      let resolvedFnName = newFunctionName;
      const effectiveTableRef = resolvedNewEntityId || newTableNodeId;
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

      store.addEdge({
        id: `edge-dbref-${dbRefNode.id}-${serviceNodeId}-${endpointId || consumedEventId || "ep"}-${resolvedFnName || "fn"}-${Date.now()}`,
        source: dbRefNode.id,
        target: serviceNodeId,
        sourceHandle: dbSourceHandle,
        targetHandle: serviceTargetHandle,
        type: "connection",
      });

      if (endpointId) {
        const ep = store.endpoints.find((e) => e.id === endpointId);
        if (ep) {
          const currentDbIds =
            ep.databaseNodeIds ||
            (ep.databaseNodeId && ep.databaseNodeId !== "none" ? [ep.databaseNodeId] : []);
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
        functionName: resolvedFnName,
      };
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
  // Mode B: Legacy Fallback (neither stepId nor dbRefNodeId was provided)
  // -------------------------------------------------------------------------
  if (prevTableNodeId && newTableNodeId && prevTableNodeId === newTableNodeId) {
    if (prevFunctionName !== newFunctionName) {
      cleanupDatabaseRefConnection({
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
      tableNodeId: newTableNodeId,
      databaseId: newDatabaseId,
      serviceNodeId,
      endpointId,
      consumedEventId,
      functionName: newFunctionName,
    });
  }

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

  const prevDbRefNode = allNodes.find((n) => {
    if (n.type !== "db_ref") return false;
    const matchesTable =
      (prevTableNodeId && (n.id === prevTableNodeId || n.data?.tableRef === prevTableNodeId)) ||
      (resolvedPrevEntityId && (n.id === resolvedPrevEntityId || n.data?.tableRef === resolvedPrevEntityId));
    if (!matchesTable) return false;

    const isConnected = edges.some(
      (e) =>
        (e.source === serviceNodeId && e.target === n.id) ||
        (e.target === serviceNodeId && e.source === n.id),
    );
    return isConnected || n.data?.targetServiceId === serviceNodeId;
  });

  const stepMatchesPrevTable = (s: PipelineStepDraft) => {
    if (s.type !== "db_operation" || !s.tableNodeId) return false;
    if (s.tableNodeId === prevTableNodeId || s.tableNodeId === resolvedPrevEntityId) return true;
    const sNode = allNodes.find((n) => n.id === s.tableNodeId);
    const sEntityId = sNode?.type === "entity" ? sNode.id : sNode?.data?.tableRef || s.tableNodeId;
    return Boolean(resolvedPrevEntityId && sEntityId === resolvedPrevEntityId);
  };

  const allRemainingSteps = flattenAllPipelineSteps(remainingSteps);
  const isUsedInRemainingSteps = allRemainingSteps.some(stepMatchesPrevTable);
  const otherEndpoints = store.endpoints.filter(
    (e) => e.nodeId === serviceNodeId && e.id !== endpointId,
  );
  const isUsedInOtherEndpoints = otherEndpoints.some((ep) =>
    flattenAllPipelineSteps(ep.pipelineSteps || []).some(stepMatchesPrevTable),
  );
  const otherEvents = (store.events || []).filter(
    (ev: any) => ev.nodeId === serviceNodeId && ev.id !== consumedEventId,
  );
  const isUsedInOtherEvents = otherEvents.some((ev: any) =>
    flattenAllPipelineSteps(ev.pipelineSteps || []).some(stepMatchesPrevTable),
  );
  const isPrevTableStillUsedOnService =
    isUsedInRemainingSteps || isUsedInOtherEndpoints || isUsedInOtherEvents;

  const existingNewDbRefNode = allNodes.find((n) => {
    if (n.type !== "db_ref") return false;
    const matchesTable =
      (newTableNodeId && (n.data?.tableRef === newTableNodeId || n.id === newTableNodeId)) ||
      (resolvedNewEntityId && (n.data?.tableRef === resolvedNewEntityId || n.id === resolvedNewEntityId));
    if (!matchesTable) return false;

    const isConnected = edges.some(
      (e) =>
        (e.source === serviceNodeId && e.target === n.id) ||
        (e.target === serviceNodeId && e.source === n.id),
    );
    return isConnected || n.data?.targetServiceId === serviceNodeId;
  });

  if (prevDbRefNode && !isPrevTableStillUsedOnService && !existingNewDbRefNode) {
    const tableLabel =
      newTargetNode?.data?.label ||
      (newTargetNode?.type === "db_ref" ? newTargetNode?.data?.label : undefined) ||
      "Table Ref";
    const targetDbNode = allNodes.find(
      (n) => n.id === (newDatabaseId || newTargetNode?.data?.databaseId),
    );
    const newDbId =
      newDatabaseId ||
      newTargetNode?.data?.databaseId ||
      targetDbNode?.id ||
      prevDbRefNode.data?.databaseId;

    store.updateNode(prevDbRefNode.id, {
      data: {
        ...prevDbRefNode.data,
        label: tableLabel,
        tableRef: newTargetNode?.type === "entity" ? newTargetNode.id : (resolvedNewEntityId || newTableNodeId),
        databaseId: newDbId,
        targetServiceId: serviceNodeId,
        description: `Reference to ${tableLabel}`,
      },
    });

    const oldEdges = store.edges.filter((e) => {
      const isIngress = e.source === prevDbRefNode.id && e.target === serviceNodeId;
      const isEgress = e.target === prevDbRefNode.id && e.source === serviceNodeId;
      if (!isIngress && !isEgress) return false;
      const serviceH = isIngress ? e.targetHandle : e.sourceHandle;
      if (endpointId && serviceH && !serviceH.includes(endpointId)) return false;
      if (consumedEventId && serviceH && !serviceH.includes(consumedEventId)) return false;
      return true;
    });
    oldEdges.forEach((e) => store.deleteEdge(e.id));

    let resolvedFnName = newFunctionName;
    const effectiveTableRef = resolvedNewEntityId || newTableNodeId;
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

    store.addEdge({
      id: `edge-dbref-${prevDbRefNode.id}-${serviceNodeId}-${endpointId || consumedEventId || "ep"}-${resolvedFnName || "fn"}-${Date.now()}`,
      source: prevDbRefNode.id,
      target: serviceNodeId,
      sourceHandle: dbSourceHandle,
      targetHandle: serviceTargetHandle,
      type: "connection",
    });

    if (endpointId) {
      const ep = store.endpoints.find((e) => e.id === endpointId);
      if (ep) {
        const currentDbIds =
          ep.databaseNodeIds ||
          (ep.databaseNodeId && ep.databaseNodeId !== "none" ? [ep.databaseNodeId] : []);
        if (!currentDbIds.includes(prevDbRefNode.id)) {
          const nextDbIds = [...currentDbIds, prevDbRefNode.id];
          store.updateEndpoint(endpointId, {
            databaseNodeIds: nextDbIds,
            databaseNodeId: nextDbIds[0] || prevDbRefNode.id,
          });
        }
      }
    }

    return {
      dbRefNodeId: prevDbRefNode.id,
      functionName: resolvedFnName,
    };
  }

  if (prevDbRefNode && !isPrevTableStillUsedOnService && existingNewDbRefNode) {
    const orphanEdges = store.edges.filter(
      (e) => e.source === prevDbRefNode.id || e.target === prevDbRefNode.id,
    );
    orphanEdges.forEach((e) => store.deleteEdge(e.id));
    store.deleteNode(prevDbRefNode.id);

    if (endpointId) {
      const ep = store.endpoints.find((e) => e.id === endpointId);
      if (ep && ep.databaseNodeIds) {
        const nextDbIds = ep.databaseNodeIds.filter((id) => id !== prevDbRefNode.id);
        store.updateEndpoint(endpointId, {
          databaseNodeIds: nextDbIds,
          databaseNodeId: nextDbIds[0] || "none",
        });
      }
    }

    return ensureDatabaseRefConnection({
      tableNodeId: newTableNodeId,
      databaseId: newDatabaseId,
      serviceNodeId,
      endpointId,
      consumedEventId,
      functionName: newFunctionName,
    });
  }

  if (prevDbRefNode && isPrevTableStillUsedOnService) {
    cleanupDatabaseRefConnection({
      tableNodeId: prevTableNodeId,
      databaseId: prevDatabaseId,
      serviceNodeId,
      endpointId,
      consumedEventId,
      functionName: prevFunctionName,
      remainingSteps,
    });

    return ensureDatabaseRefConnection({
      tableNodeId: newTableNodeId,
      databaseId: newDatabaseId,
      serviceNodeId,
      endpointId,
      consumedEventId,
      functionName: newFunctionName,
    });
  }

  return ensureDatabaseRefConnection({
    tableNodeId: newTableNodeId,
    databaseId: newDatabaseId,
    serviceNodeId,
    endpointId,
    consumedEventId,
    functionName: newFunctionName,
  });
}
