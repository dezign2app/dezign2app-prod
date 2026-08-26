import { BackendNode, BackendEdge } from "@/types/canvas";
import {
  DEFAULT_LLM_PROVIDER,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_TEMPERATURE,
  BROKER_RESOURCE_KEYS,
} from "@workspace/canvas/constants";
import { getUniqueNodeLabel } from "@workspace/canvas";
import { applyNodeChanges, NodeChange } from "@xyflow/react";
import { generateKeyBetween } from "fractional-indexing";
import { BackendCanvasState } from "../types";
import { cleanupDeletedNodesState } from "../stateCleanup";
import { getLastIndex } from "../utils";

export interface NodeSlice {
  nodes: BackendNode[];
  pendingNodeUpserts: BackendNode[];
  pendingNodeRemovals: string[];
  nodesPendingDeletion: BackendNode[];
  setNodesPendingDeletion: (nodes: BackendNode[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  addNode: (node: Omit<BackendNode, "fractionalIndex">) => void;
  addTableNode: (
    parentId?: string,
    position?: { x: number; y: number },
  ) => void;
  addLangGraphStepNode: (
    parentId: string,
    position?: { x: number; y: number },
    name?: string,
    stepType?: string,
  ) => void;
  updateNode: (id: string, changes: Partial<BackendNode>) => void;
  deleteNode: (id: string) => void;
}

export const createNodeSlice = (
  set: (
    partial:
      | Partial<BackendCanvasState>
      | ((state: BackendCanvasState) => Partial<BackendCanvasState>),
  ) => void,
  get: () => BackendCanvasState,
): NodeSlice => ({
  nodes: [],
  pendingNodeUpserts: [],
  pendingNodeRemovals: [],
  nodesPendingDeletion: [],

  setNodesPendingDeletion: (nodes) => set({ nodesPendingDeletion: nodes }),

  onNodesChange: (changes) => {
    const removedIds: string[] = changes
      .filter((c) => c.type === "remove")
      .map((c) => c.id);

    const nonRemoveChanges = changes.filter((c) => c.type !== "remove");

    let currentState = get();
    let updates: Partial<BackendCanvasState> = {};

    const persistentChangedNodeIds = new Set(
      nonRemoveChanges
        .filter((c) => {
          if (
            c.type === "add" ||
            c.type === "replace" ||
            c.type === "dimensions"
          )
            return true;
          if (c.type === "position" && !c.dragging) return true;
          return false;
        })
        .map((c) => c.id),
    );

    if (removedIds.length > 0) {
      const isSchema = currentState.nodes.some(
        (n) =>
          removedIds.includes(n.id) &&
          (n.type === "entity" ||
            n.type === "database" ||
            n.type === "group" ||
            n.type === "redis_instance" ||
            n.type === "redis_schema"),
      );
      get().pushHistorySnapshot(isSchema ? "schema" : "graph");
    }

    if (removedIds.length > 0) {
      updates = cleanupDeletedNodesState(currentState, removedIds);
      currentState = { ...currentState, ...updates };
    }

    if (nonRemoveChanges.length > 0) {
      const rawNext = applyNodeChanges<BackendNode>(
        nonRemoveChanges,
        currentState.nodes,
      );
      const next = rawNext.filter((n): n is BackendNode => Boolean(n?.id));

      const upserts = next.filter((n) => persistentChangedNodeIds.has(n.id));

      updates = {
        ...updates,
        nodes: next,
        pendingNodeUpserts: [...get().pendingNodeUpserts, ...upserts],
      };
    }

    if (Object.keys(updates).length > 0) {
      set(updates);
    }
  },

  addNode: (nodeWithoutIndex) => {
    const isSchema =
      nodeWithoutIndex.type === "entity" ||
      nodeWithoutIndex.type === "database" ||
      nodeWithoutIndex.type === "group" ||
      nodeWithoutIndex.type === "redis_instance" ||
      nodeWithoutIndex.type === "redis_schema";
    get().pushHistorySnapshot(isSchema ? "schema" : "graph");
    let finalNode = nodeWithoutIndex;
    if (
      (nodeWithoutIndex.type === "entity" || nodeWithoutIndex.type === "database") &&
      nodeWithoutIndex.data?.label
    ) {
      const uniqueLabel = getUniqueNodeLabel(
        get().nodes,
        nodeWithoutIndex.data.label,
        nodeWithoutIndex.type,
      );
      finalNode = {
        ...finalNode,
        data: {
          ...finalNode.data,
          label: uniqueLabel,
        },
      };
    }
    if (nodeWithoutIndex.type === "service") {
      let nextPort = 8080;
      let nextGrpcPort = 50051;

      if (!nodeWithoutIndex.data?.port) {
        const existingPorts = new Set(
          get()
            .nodes.filter((n) => n.type === "service")
            .map((n) => parseInt(String(n.data?.port || "8080"), 10))
            .filter((p) => !isNaN(p)),
        );
        while (existingPorts.has(nextPort)) {
          nextPort++;
        }
      }

      if (!nodeWithoutIndex.data?.grpcPort) {
        const existingGrpcPorts = new Set(
          get()
            .nodes.filter((n) => n.type === "service")
            .map((n) => parseInt(String(n.data?.grpcPort || "50051"), 10))
            .filter((p) => !isNaN(p)),
        );
        while (existingGrpcPorts.has(nextGrpcPort)) {
          nextGrpcPort++;
        }
      }

      finalNode = {
        ...finalNode,
        data: {
          ...finalNode.data,
          port: nodeWithoutIndex.data?.port || String(nextPort),
          grpcPort: nodeWithoutIndex.data?.grpcPort || String(nextGrpcPort),
        },
      };
    }
    const lastNodeIndex = getLastIndex(get().nodes);
    const fractionalIndex = generateKeyBetween(lastNodeIndex, null);
    const node = { ...finalNode, fractionalIndex, selected: true };
    const next = [...get().nodes.map((n) => ({ ...n, selected: false })), node];
    set({
      nodes: next,
      pendingNodeUpserts: [...get().pendingNodeUpserts, node],
    });
  },

  addTableNode: (parentId, position) => {
    get().pushHistorySnapshot("schema");
    const lastNodeIndex = getLastIndex(get().nodes);
    const fractionalIndex = generateKeyBetween(lastNodeIndex, null);
    const node: BackendNode = {
      id: crypto.randomUUID(),
      type: "entity",
      position: position || { x: 100, y: 100 },
      parentId,
      fractionalIndex,
      data: {
        label: "",
        columns: [{ name: "id", type: "TEXT", isPrimaryKey: true }],
      },
      selected: true,
    };
    const next = [...get().nodes.map((n) => ({ ...n, selected: false })), node];
    set({
      nodes: next,
      pendingNodeUpserts: [...get().pendingNodeUpserts, node],
    });
  },

  addLangGraphStepNode: (parentId, position, name, stepType) => {
    get().pushHistorySnapshot("graph");
    const existingCount = get().nodes.filter(
      (n) => n.parentId === parentId,
    ).length;
    const defaultPos = position || { x: 40 + existingCount * 220, y: 120 };
    const lastNodeIndex = getLastIndex(get().nodes);
    const fractionalIndex = generateKeyBetween(lastNodeIndex, null);
    const stepId = `step_${Date.now().toString(36).slice(-4)}`;
    const stepName = name || `Step ${existingCount + 1}`;
    const node: BackendNode = {
      id: crypto.randomUUID(),
      type: "langgraph_step",
      position: defaultPos,
      parentId,
      fractionalIndex,
      data: {
        label: stepName,
        stepId,
        stepType:
          (stepType as NonNullable<BackendNode["data"]["stepType"]>) ||
          "llm_call",
        modelConfig: {
          provider: DEFAULT_LLM_PROVIDER,
          model: DEFAULT_LLM_MODEL,
          temperature: DEFAULT_LLM_TEMPERATURE,
        },
      },
      selected: true,
    };
    const next = [...get().nodes.map((n) => ({ ...n, selected: false })), node];
    set({
      nodes: next,
      pendingNodeUpserts: [...get().pendingNodeUpserts, node],
    });
  },

  updateNode: (id, changes) => {
    const updatedNode = get().nodes.find((n) => n.id === id);
    if (!updatedNode) return;
    const isSchema =
      updatedNode.type === "entity" ||
      updatedNode.type === "database" ||
      updatedNode.type === "group" ||
      updatedNode.type === "redis_instance" ||
      updatedNode.type === "redis_schema";
    get().pushHistorySnapshot(isSchema ? "schema" : "graph");

    let currentNodes = get().nodes;

    // If entity label changed, sync references.table across other entity nodes
    if (
      updatedNode.type === "entity" &&
      changes.data?.label !== undefined &&
      changes.data.label !== updatedNode.data.label
    ) {
      const oldLabel = updatedNode.data.label;
      const newLabel = changes.data.label;

      if (
        oldLabel &&
        oldLabel.trim() !== "" &&
        newLabel &&
        newLabel.trim() !== ""
      ) {
        currentNodes = currentNodes.map((node) => {
          if (node.id === id || node.type !== "entity" || !node.data.columns) {
            return node;
          }
          let colsChanged = false;
          const newCols = node.data.columns.map((col) => {
            if (col.references?.table === oldLabel) {
              colsChanged = true;
              return {
                ...col,
                references: {
                  ...col.references,
                  table: newLabel,
                },
              };
            }
            return col;
          });
          return colsChanged
            ? { ...node, data: { ...node.data, columns: newCols } }
            : node;
        });
      }
    }

    const next = currentNodes.map((n) =>
      n.id === id ? { ...n, ...changes } : n,
    );
    const updated = next.find((n) => n.id === id)!;
    console.log("backendCanvasStore: adding to pendingNodeUpserts", updated);

    // Bidirectional sync: sync dropdown updates to edges
    let nextEdges = [...get().edges];
    let edgesChanged = false;
    const newPendingEdgeRemovals: string[] = [];
    const newPendingEdgeUpserts: BackendEdge[] = [];

    if (changes.data?.publishedEvents) {
      const existingPublishEdges = nextEdges.filter(
        (e) =>
          e.source === id && e.sourceHandle?.startsWith("publishedEvents-out-"),
      );

      const currentEvents = changes.data.publishedEvents;

      // 1. Remove edges that are no longer referenced or changed targetNodeId
      existingPublishEdges.forEach((edge) => {
        const eventId = edge.sourceHandle?.replace("publishedEvents-out-", "");
        const ev = currentEvents.find((e) => e.id === eventId);
        if (
          !ev ||
          ev.targetNodeId !== edge.target ||
          ev.targetNodeId === "none"
        ) {
          nextEdges = nextEdges.filter((e) => e.id !== edge.id);
          edgesChanged = true;
          newPendingEdgeRemovals.push(edge.id);
        }
      });

      // 2. Add edges for newly selected targetNodeId
      currentEvents.forEach((ev: { id?: string; targetNodeId?: string }) => {
        if (ev.targetNodeId && ev.targetNodeId !== "none") {
          const hasEdge = existingPublishEdges.some(
            (e) =>
              e.sourceHandle === `publishedEvents-out-${ev.id}` &&
              e.target === ev.targetNodeId,
          );
          if (!hasEdge) {
            const lastEdgeIndex = getLastIndex(nextEdges);
            const fractionalIndex = generateKeyBetween(lastEdgeIndex, null);
            const newEdge: BackendEdge = {
              id: `edge-${Date.now()}-${ev.id}`,
              source: id,
              target: ev.targetNodeId,
              type: "message",
              sourceHandle: `publishedEvents-out-${ev.id}`,
              targetHandle: null,
              fractionalIndex,
            };
            nextEdges.push(newEdge);
            edgesChanged = true;
            newPendingEdgeUpserts.push(newEdge);
          }
        }
      });
    }

    if (changes.data?.consumedEvents) {
      const existingConsumeEdges = nextEdges.filter(
        (e) =>
          e.target === id && e.targetHandle?.startsWith("consumedEvents-in-"),
      );

      const currentEvents = changes.data.consumedEvents;

      // 1. Remove edges that are no longer referenced or changed
      existingConsumeEdges.forEach((edge) => {
        const eventId = edge.targetHandle?.replace("consumedEvents-in-", "");
        const ev = currentEvents.find((e) => e.id === eventId);
        if (
          !ev ||
          ev.targetNodeId !== edge.source ||
          ev.targetNodeId === "none"
        ) {
          nextEdges = nextEdges.filter((e) => e.id !== edge.id);
          edgesChanged = true;
          newPendingEdgeRemovals.push(edge.id);
        }
      });

      // 2. Add edges for newly selected targetNodeId
      currentEvents.forEach((ev: { id?: string; targetNodeId?: string }) => {
        if (ev.targetNodeId && ev.targetNodeId !== "none") {
          const hasEdge = existingConsumeEdges.some(
            (e) =>
              e.targetHandle === `consumedEvents-in-${ev.id}` &&
              e.source === ev.targetNodeId,
          );
          if (!hasEdge) {
            const lastEdgeIndex = getLastIndex(nextEdges);
            const fractionalIndex = generateKeyBetween(lastEdgeIndex, null);
            const newEdge: BackendEdge = {
              id: `edge-${Date.now()}-${ev.id}`,
              source: ev.targetNodeId,
              target: id,
              type: "message",
              sourceHandle: null,
              targetHandle: `consumedEvents-in-${ev.id}`,
              fractionalIndex,
            };
            nextEdges.push(newEdge);
            edgesChanged = true;
            newPendingEdgeUpserts.push(newEdge);
          }
        }
      });
    }

    if (updatedNode.type === "entity" && changes.data?.columns) {
      const currentCols = changes.data.columns;
      const allEntityNodes = next.filter((n) => n.type === "entity");

      // 1. Sync foreign-key edges where node `id` is the TARGET (referencing table)
      currentCols.forEach((col, colIdx) => {
        const existingEdgeIndices: number[] = [];
        nextEdges.forEach((e, idx) => {
          if (
            e.type === "foreign-key" &&
            e.target === id &&
            (e.targetHandle === `target-${colIdx}` ||
              e.targetHandle === `source-${colIdx}`)
          ) {
            existingEdgeIndices.push(idx);
          }
        });

        if (
          col.isForeignKey &&
          col.references?.table &&
          col.references?.column
        ) {
          const refNode = allEntityNodes.find(
            (n) => n.data.label === col.references?.table,
          );
          if (refNode && refNode.data.columns) {
            const refColIdx = refNode.data.columns.findIndex(
              (c) => c.name === col.references?.column,
            );
            if (refColIdx !== -1) {
              const expectedSourceHandle = `source-${refColIdx}`;
              const expectedTargetHandle = `target-${colIdx}`;
              const expectedSourceId = refNode.id;

              if (existingEdgeIndices.length > 0) {
                const primaryEdgeIdx = existingEdgeIndices[0]!;
                const existingEdge = nextEdges[primaryEdgeIdx]!;

                if (
                  existingEdge.source !== expectedSourceId ||
                  existingEdge.target !== id ||
                  existingEdge.sourceHandle !== expectedSourceHandle ||
                  existingEdge.targetHandle !== expectedTargetHandle
                ) {
                  const updatedEdge: BackendEdge = {
                    ...existingEdge,
                    source: expectedSourceId,
                    target: id,
                    sourceHandle: expectedSourceHandle,
                    targetHandle: expectedTargetHandle,
                  };
                  nextEdges[primaryEdgeIdx] = updatedEdge;
                  edgesChanged = true;
                  newPendingEdgeUpserts.push(updatedEdge);
                }

                for (let i = 1; i < existingEdgeIndices.length; i++) {
                  const staleIdx = existingEdgeIndices[i]!;
                  const staleEdge = nextEdges[staleIdx];
                  if (staleEdge) {
                    nextEdges = nextEdges.filter((e) => e.id !== staleEdge.id);
                    newPendingEdgeRemovals.push(staleEdge.id);
                    edgesChanged = true;
                  }
                }
              } else {
                const lastEdgeIndex = getLastIndex(nextEdges);
                const fractionalIndex = generateKeyBetween(lastEdgeIndex, null);
                const newEdge: BackendEdge = {
                  id: `edge-${Date.now()}-${colIdx}`,
                  source: expectedSourceId,
                  target: id,
                  type: "foreign-key",
                  sourceHandle: expectedSourceHandle,
                  targetHandle: expectedTargetHandle,
                  fractionalIndex,
                };
                nextEdges.push(newEdge);
                edgesChanged = true;
                newPendingEdgeUpserts.push(newEdge);
              }
            }
          }
        } else {
          if (existingEdgeIndices.length > 0) {
            existingEdgeIndices.forEach((edgeIdx) => {
              const edgeToRemove = nextEdges[edgeIdx];
              if (edgeToRemove) {
                nextEdges = nextEdges.filter((e) => e.id !== edgeToRemove.id);
                newPendingEdgeRemovals.push(edgeToRemove.id);
              }
            });
            edgesChanged = true;
          }
        }
      });

      // 2. Clean up foreign-key edges where handles point to indices that no longer exist on node `id`
      const maxColIdx = currentCols.length - 1;
      nextEdges.forEach((e) => {
        if (e.type === "foreign-key") {
          if (e.target === id && e.targetHandle) {
            const match = e.targetHandle.match(/^(?:source|target)-(\d+)$/);
            if (match) {
              const idx = parseInt(match[1]!, 10);
              if (idx > maxColIdx) {
                nextEdges = nextEdges.filter((edge) => edge.id !== e.id);
                newPendingEdgeRemovals.push(e.id);
                edgesChanged = true;
              }
            }
          }
          if (e.source === id && e.sourceHandle) {
            const match = e.sourceHandle.match(/^(?:source|target)-(\d+)$/);
            if (match) {
              const idx = parseInt(match[1]!, 10);
              if (idx > maxColIdx) {
                nextEdges = nextEdges.filter((edge) => edge.id !== e.id);
                newPendingEdgeRemovals.push(e.id);
                edgesChanged = true;
              }
            }
          }
        }
      });
    }

    BROKER_RESOURCE_KEYS.forEach((key) => {
      if (changes.data && key in changes.data) {
        const oldData = updatedNode.data as unknown as Record<string, unknown>;
        const newData = changes.data as unknown as Record<string, unknown>;
        const oldList = (Array.isArray(oldData[key]) ? oldData[key] : []) as Array<{ id: string }>;
        const newList = (Array.isArray(newData[key]) ? newData[key] : []) as Array<{ id: string }>;
        const newIds = new Set(newList.map((r) => r.id));
        const removedResourceIds = oldList
          .filter((r) => !newIds.has(r.id))
          .map((r) => r.id);

        if (removedResourceIds.length > 0) {
          removedResourceIds.forEach((resId) => {
            const removedForRes = nextEdges.filter(
              (edge) =>
                edge &&
                (edge.sourceResourceId === resId ||
                  edge.targetResourceId === resId ||
                  edge.sourceHandle?.includes(resId) ||
                  edge.targetHandle?.includes(resId)),
            );
            if (removedForRes.length > 0) {
              const ids = removedForRes.map((e) => e.id);
              nextEdges = nextEdges.filter((e) => !ids.includes(e.id));
              edgesChanged = true;
              newPendingEdgeRemovals.push(...ids);
            }
          });
        }
      }
    });

    const update: Partial<BackendCanvasState> = {
      nodes: next,
      pendingNodeUpserts: [...get().pendingNodeUpserts, updated],
      ...(edgesChanged ? { edges: nextEdges } : {}),
      ...(newPendingEdgeRemovals.length > 0
        ? {
            pendingEdgeRemovals: [
              ...get().pendingEdgeRemovals,
              ...newPendingEdgeRemovals,
            ],
          }
        : {}),
      ...(newPendingEdgeUpserts.length > 0
        ? {
            pendingEdgeUpserts: [
              ...get().pendingEdgeUpserts,
              ...newPendingEdgeUpserts,
            ],
          }
        : {}),
    };
    set(update);
  },

  deleteNode: (id) => {
    const nodeToDelete = get().nodes.find((n) => n.id === id);
    const isSchema =
      nodeToDelete?.type === "entity" ||
      nodeToDelete?.type === "database" ||
      nodeToDelete?.type === "group" ||
      nodeToDelete?.type === "redis_instance" ||
      nodeToDelete?.type === "redis_schema";
    get().pushHistorySnapshot(isSchema ? "schema" : "graph");
    const updates = cleanupDeletedNodesState(get(), [id]);
    set(updates);
  },
});
