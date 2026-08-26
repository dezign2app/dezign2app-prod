import { Position } from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import {
  HEAD_TARGET_HANDLES,
  HEAD_NODE_TYPES,
  TARGET_NODE_TYPES,
  type LayoutNode,
  type LayoutEdge,
  type PositionNodeChange,
} from "./types";
import { getNodeDimensions } from "./nodeDimensions";
import { runBarycenterRefinement } from "./barycenterLayout";
import { layoutHeadNodes } from "./headNodeLayout";
import { layoutHangingTransformerNodes } from "./hangingTransformerLayout";
import {
  layoutHangingReferenceNodes,
  REFERENCE_NODE_TYPES,
} from "./hangingReferenceLayout";

export interface PerformGraphLayoutOptions {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  onNodesChange?: (changes: PositionNodeChange[]) => void;
  fitView: (options?: { duration?: number; padding?: number }) => void;
  direction?: string;
  storeEndpoints?: any[];
  storeEvents?: any[];
}

export function performGraphLayout({
  nodes,
  edges,
  onNodesChange,
  fitView,
  direction = "LR",
  storeEndpoints = [],
  storeEvents = [],
}: PerformGraphLayoutOptions) {
  const isHorizontal = direction === "LR";

  // Filter for graph nodes and graph edges only
  const graphNodes = nodes.filter(
    (n: LayoutNode) =>
      n.type !== "group" &&
      n.type !== "entity" &&
      n.type !== "database" &&
      n.type !== "redis_instance" &&
      n.type !== "redis_schema",
  );
  if (graphNodes.length === 0) return;

  const graphEdges = edges.filter((e: LayoutEdge) => {
    if (
      e.type === "database-connection" ||
      e.type === "foreign-key" ||
      e.type === "transformer-reference" ||
      e.type === "reference"
    ) {
      return false;
    }
    const sourceNode = graphNodes.find((n) => n.id === e.source);
    const targetNode = graphNodes.find((n) => n.id === e.target);
    if (
      sourceNode?.type === "transformer" &&
      targetNode?.type === "transformer_ref"
    ) {
      return false;
    }
    return true;
  });

  // 1. Identify Target nodes (nodes that can have attached head nodes)
  const targetNodeIds = new Set<string>();
  graphNodes.forEach((n: LayoutNode) => {
    if (TARGET_NODE_TYPES.has(n.type ?? "")) {
      targetNodeIds.add(n.id);
    }
  });
  graphEdges.forEach((edge: LayoutEdge) => {
    if (HEAD_TARGET_HANDLES.has(edge.targetHandle ?? "")) {
      targetNodeIds.add(edge.target);
    }
  });

  // 2. Identify head-connection edges vs hanging transformer edges vs main flow edges
  const isHeadConnectionEdge = (edge: LayoutEdge): boolean => {
    const isTargetMatch = targetNodeIds.has(edge.target);
    const isHeadHandle = HEAD_TARGET_HANDLES.has(edge.targetHandle ?? "");
    const sourceNodeType =
      graphNodes.find((n: LayoutNode) => n.id === edge.source)?.type ?? "";
    const isHeadSourceType = HEAD_NODE_TYPES.has(sourceNodeType);
    return isTargetMatch && (isHeadHandle || isHeadSourceType);
  };

  const isHangingTransformerEdge = (edge: LayoutEdge): boolean => {
    const sourceNode = graphNodes.find((n: LayoutNode) => n.id === edge.source);
    const targetNode = graphNodes.find((n: LayoutNode) => n.id === edge.target);
    if (!sourceNode || !targetNode) return false;
    const isTransType =
      sourceNode.type === "transformer_ref" ||
      sourceNode.type === "transformer" ||
      sourceNode.type === "hook" ||
      sourceNode.type === "hook_ref";
    return isTransType;
  };

  const isHangingReferenceEdge = (edge: LayoutEdge): boolean => {
    const targetNode = graphNodes.find((n: LayoutNode) => n.id === edge.target);
    if (!targetNode) return false;
    return REFERENCE_NODE_TYPES.has(targetNode.type ?? "");
  };

  const headEdges: LayoutEdge[] = graphEdges.filter(isHeadConnectionEdge);
  const hangingEdges: LayoutEdge[] = graphEdges.filter(isHangingTransformerEdge);
  const hangingRefEdges: LayoutEdge[] = graphEdges.filter(isHangingReferenceEdge);

  const flowEdges: LayoutEdge[] = graphEdges.filter(
    (e: LayoutEdge) =>
      !isHeadConnectionEdge(e) &&
      !isHangingTransformerEdge(e) &&
      !isHangingReferenceEdge(e),
  );

  // 3. Identify attached head nodes, hanging transformer nodes, and hanging reference nodes
  const attachedHeadNodeIdSet = new Set<string>(
    headEdges.map((e: LayoutEdge) => e.source),
  );
  const attachedHeadNodes: LayoutNode[] = graphNodes.filter((n: LayoutNode) =>
    attachedHeadNodeIdSet.has(n.id),
  );

  const hangingTransformerNodeIdSet = new Set<string>(
    hangingEdges.map((e: LayoutEdge) => e.source),
  );
  const hangingTransformerNodes: LayoutNode[] = graphNodes.filter((n: LayoutNode) =>
    hangingTransformerNodeIdSet.has(n.id),
  );

  const hangingRefNodeIdSet = new Set<string>();
  graphNodes.forEach((n: LayoutNode) => {
    if (REFERENCE_NODE_TYPES.has(n.type ?? "")) {
      hangingRefNodeIdSet.add(n.id);
    }
  });
  hangingRefEdges.forEach((e: LayoutEdge) => {
    hangingRefNodeIdSet.add(e.target);
  });
  const hangingRefNodes: LayoutNode[] = graphNodes.filter((n: LayoutNode) =>
    hangingRefNodeIdSet.has(n.id),
  );

  const mainGraphNodes: LayoutNode[] = graphNodes.filter(
    (n: LayoutNode) =>
      !attachedHeadNodeIdSet.has(n.id) &&
      !hangingTransformerNodeIdSet.has(n.id) &&
      !hangingRefNodeIdSet.has(n.id),
  );

  // 4. Run Dagre layout for mainGraphNodes and flowEdges
  const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    marginx: 80,
    marginy: 80,
    ranksep: isHorizontal
      ? hangingRefEdges.length > 0
        ? 440
        : 200
      : 150,
    nodesep: 50,
  });

  mainGraphNodes.forEach((node: LayoutNode) => {
    const { width, height } = getNodeDimensions(node);
    dagreGraph.setNode(node.id, { width, height });
  });

  flowEdges.forEach((edge: LayoutEdge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  // 5. Store positions computed by Dagre
  const positionsMap = new Map<string, { x: number; y: number }>();
  mainGraphNodes.forEach((node: LayoutNode) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const { width, height } = getNodeDimensions(node);
    if (nodeWithPosition) {
      positionsMap.set(node.id, {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      });
    } else {
      positionsMap.set(node.id, { x: node.position.x, y: node.position.y });
    }
  });

  // 5.5. Barycenter refinement pass
  runBarycenterRefinement({
    dagreGraph,
    flowNodes: mainGraphNodes,
    flowEdges,
    positionsMap,
    isHorizontal,
    storeEndpoints,
    storeEvents,
    hangingEdges,
    hangingRefEdges,
  });

  // 6. Layout attached head nodes grouped by category columns above each target node
  layoutHeadNodes({
    targetNodeIds,
    nodes: graphNodes,
    positionsMap,
    headEdges,
    attachedHeadNodes,
  });

  // 6.5. Layout hanging transformer nodes in a dedicated column right before their connected service node
  layoutHangingTransformerNodes({
    nodes: graphNodes,
    positionsMap,
    hangingEdges,
    hangingTransformerNodes,
    isHorizontal,
    storeEndpoints,
    storeEvents,
  });

  // 6.6. Layout hanging reference nodes (Table Ref, Redis Cache Ref, Vector DB Ref) in a dedicated column right after their connected service node
  layoutHangingReferenceNodes({
    nodes: graphNodes,
    positionsMap,
    hangingRefEdges,
    hangingRefNodes,
    isHorizontal,
    storeEndpoints,
    storeEvents,
  });

  // 6.6. Enforce positive canvas origin margin (minX >= 60, minY >= 60)
  let globalMinX = Infinity;
  let globalMinY = Infinity;
  positionsMap.forEach((pos) => {
    if (pos.x < globalMinX) globalMinX = pos.x;
    if (pos.y < globalMinY) globalMinY = pos.y;
  });

  const shiftX = globalMinX < 60 ? 60 - globalMinX : 0;
  const shiftY = globalMinY < 60 ? 60 - globalMinY : 0;

  if (shiftX !== 0 || shiftY !== 0) {
    positionsMap.forEach((pos, id) => {
      positionsMap.set(id, {
        x: pos.x + shiftX,
        y: pos.y + shiftY,
      });
    });
  }

  // 7. Update node positions atomically
  if (onNodesChange) {
    const nodeChanges: PositionNodeChange[] = graphNodes.map((node: LayoutNode) => {
      const pos = positionsMap.get(node.id) ?? {
        x: node.position.x,
        y: node.position.y,
      };
      const isAttachedHead = attachedHeadNodeIdSet.has(node.id);
      return {
        id: node.id,
        type: "position",
        position: pos,
        sourcePosition: isAttachedHead
          ? Position.Bottom
          : isHorizontal
            ? Position.Right
            : Position.Bottom,
        targetPosition: isAttachedHead
          ? Position.Top
          : isHorizontal
            ? Position.Left
            : Position.Top,
      };
    });
    onNodesChange(nodeChanges);
  } else {
    useBackendCanvasStore.setState((state) => {
      const updatedNodes = state.nodes.map((node) => {
        const pos = positionsMap.get(node.id);
        if (!pos) return node;
        const isAttachedHead = attachedHeadNodeIdSet.has(node.id);
        return {
          ...node,
          position: pos,
          sourcePosition: isAttachedHead
            ? Position.Bottom
            : isHorizontal
              ? Position.Right
              : Position.Bottom,
          targetPosition: isAttachedHead
            ? Position.Top
            : isHorizontal
              ? Position.Left
              : Position.Top,
        };
      });

      const movedNodeIds = new Set(positionsMap.keys());
      const upserts = updatedNodes.filter((n) => movedNodeIds.has(n.id));

      return {
        nodes: updatedNodes,
        pendingNodeUpserts: [
          ...state.pendingNodeUpserts.filter((u) => !movedNodeIds.has(u.id)),
          ...upserts,
        ],
      };
    });
  }

  setTimeout(() => {
    fitView({ duration: 300, padding: 0.15 });
  }, 50);
}
