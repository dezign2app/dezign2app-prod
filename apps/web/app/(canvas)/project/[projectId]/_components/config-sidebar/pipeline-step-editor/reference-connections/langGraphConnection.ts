import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { PipelineStepDraft } from "../types";
import { flattenAllPipelineSteps } from "../stepConstants";

// ---------------------------------------------------------------------------
// LangGraph Node & Edge Synchronization Helpers
// ---------------------------------------------------------------------------

export interface LangGraphConnectionResult {
  langGraphNodeId: string;
  edgeId?: string;
}

export interface EnsureLangGraphConnectionParams {
  langGraphNodeId?: string;
  serviceNodeId?: string;
  endpointId?: string;
  consumedEventId?: string;
}

export interface CleanupLangGraphConnectionParams {
  langGraphNodeId?: string;
  serviceNodeId?: string;
  endpointId?: string;
  consumedEventId?: string;
  remainingSteps: PipelineStepDraft[];
}

/**
 * Ensures a LangGraph agent node exists on canvas positioned to the left of the service node,
 * and wires an ingress edge from langgraph-out to the service endpoint-in handle.
 */
export function ensureLangGraphConnection({
  langGraphNodeId,
  serviceNodeId,
  endpointId,
  consumedEventId,
}: EnsureLangGraphConnectionParams): LangGraphConnectionResult | undefined {
  if (!serviceNodeId) return undefined;

  const store = useBackendCanvasStore.getState();
  const allNodes = store.nodes;

  // 1. Look for existing langgraph node
  let lgNode = allNodes.find(
    (n) => n.type === "langgraph" && (langGraphNodeId ? n.id === langGraphNodeId : true),
  );

  const serviceNode = allNodes.find((n) => n.id === serviceNodeId);
  const basePos = serviceNode?.position || { x: 300, y: 200 };

  // 2. If no langgraph node exists, create one to the left of the service node
  if (!lgNode) {
    const newLgId = crypto.randomUUID();
    const existingRefNodes = allNodes.filter(
      (n) =>
        n.type === "langgraph" ||
        n.type === "db_ref" ||
        n.type === "redis-cache" ||
        n.type === "transformer_ref" ||
        n.type === "storage_operation_ref",
    );
    const yOffset = existingRefNodes.length * 110;
    const newPos = {
      x: basePos.x - 340,
      y: basePos.y + yOffset,
    };

    store.addNode({
      id: newLgId,
      type: "langgraph",
      position: newPos,
      data: {
        label: "AI Agent",
        stateChannels: [
          { key: "messages", type: "messages", reducer: "add_messages" },
        ],
        graphSteps: [],
        memoryConfig: { enabled: false, checkpointer: "memory" },
      },
    });

    lgNode = useBackendCanvasStore.getState().nodes.find((n) => n.id === newLgId);
  }

  if (!lgNode) return undefined;

  // Reposition to the left if currently located on or to the right of the service node
  if (serviceNode && lgNode.position && lgNode.position.x >= serviceNode.position.x) {
    store.updateNode(lgNode.id, {
      position: {
        x: serviceNode.position.x - 340,
        y: lgNode.position.y,
      },
    });
  }

  // 3. Connect outbound handle from LangGraph node to inbound handle of ServiceNode
  const serviceTargetHandle = endpointId
    ? `endpoint-in-${endpointId}`
    : consumedEventId
    ? `consumedEvents-in-${consumedEventId}`
    : `endpoint-in-${serviceNodeId}`;

  // 4. Ingress edge: lgNode (langgraph-out) -> serviceNode (endpoint-in)
  const currentEdges = useBackendCanvasStore.getState().edges;
  const existingEdge = currentEdges.find((e) => {
    const ingressMatch =
      e.source === lgNode!.id &&
      e.target === serviceNodeId &&
      (e.targetHandle === serviceTargetHandle || !endpointId);
    const reverseMatch =
      e.target === lgNode!.id &&
      e.source === serviceNodeId &&
      (!endpointId || !e.sourceHandle || e.sourceHandle.includes(endpointId));
    return ingressMatch || reverseMatch;
  });

  if (!existingEdge) {
    store.addEdge({
      id: crypto.randomUUID(),
      source: lgNode.id,
      target: serviceNodeId,
      sourceHandle: "langgraph-out",
      targetHandle: serviceTargetHandle,
      type: "connection",
    });
  }

  return {
    langGraphNodeId: lgNode.id,
    edgeId: existingEdge?.id,
  };
}

/**
 * Cleans up edge(s) connecting the service endpoint to a LangGraph node
 * when the step is deleted.
 */
export function cleanupLangGraphConnection({
  langGraphNodeId,
  serviceNodeId,
  endpointId,
  consumedEventId,
  remainingSteps,
}: CleanupLangGraphConnectionParams) {
  if (!serviceNodeId) return;
  const store = useBackendCanvasStore.getState();

  const allRemainingSteps = flattenAllPipelineSteps(remainingSteps);
  const isLgStillUsed = allRemainingSteps.some(
    (s) =>
      s.type === "langgraph_invoke" &&
      (!langGraphNodeId || s.langGraphTargetNodeId === langGraphNodeId),
  );

  if (!isLgStillUsed) {
    const edgesToDelete = store.edges.filter((e) => {
      const isSrc = e.source === serviceNodeId && (!langGraphNodeId || e.target === langGraphNodeId);
      const isTgt = e.target === serviceNodeId && (!langGraphNodeId || e.source === langGraphNodeId);
      if (!isSrc && !isTgt) return false;
      const sHandle = isSrc ? e.sourceHandle : e.targetHandle;
      if (endpointId && sHandle && !sHandle.includes(endpointId)) return false;
      if (consumedEventId && sHandle && !sHandle.includes(consumedEventId)) return false;
      return true;
    });

    edgesToDelete.forEach((e) => store.deleteEdge(e.id));
  }
}
