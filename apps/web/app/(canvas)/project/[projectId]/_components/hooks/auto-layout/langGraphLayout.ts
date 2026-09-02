import { Position } from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import type { LayoutNode, LayoutEdge, PositionNodeChange } from "./types";
import { getNodeDimensions } from "./nodeDimensions";
import { layoutHeadNodes } from "./headNodeLayout";

export interface PerformLangGraphLayoutOptions {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  onNodesChange?: (changes: PositionNodeChange[]) => void;
  fitView: (options?: { duration?: number; padding?: number; maxZoom?: number }) => void;
  direction?: string;
}

const LANGGRAPH_HEAD_HANDLES = new Set([
  "llm_in",
  "tool_in",
  "middleware_in",
  "memory_in",
  "HANDLE_LLM_IN",
  "HANDLE_TOOL_IN",
  "HANDLE_MIDDLEWARE_IN",
  "HANDLE_MEMORY_IN",
]);

export function performLangGraphLayout({
  nodes,
  edges,
  onNodesChange,
  fitView,
  direction = "LR",
}: PerformLangGraphLayoutOptions) {
  if (nodes.length === 0) return;
  const isHorizontal = direction === "LR";

  // 1. Identify head-connection edges vs main graph flow edges
  const headEdges = edges.filter((e: LayoutEdge) =>
    LANGGRAPH_HEAD_HANDLES.has(e.targetHandle ?? ""),
  );
  const flowEdges = edges.filter(
    (e: LayoutEdge) => !LANGGRAPH_HEAD_HANDLES.has(e.targetHandle ?? ""),
  );

  // 2. Identify attached head nodes and target nodes
  const attachedHeadNodeIdSet = new Set<string>(headEdges.map((e) => e.source));
  const targetNodeIds = new Set<string>(headEdges.map((e) => e.target));

  const attachedHeadNodes = nodes.filter((n) => attachedHeadNodeIdSet.has(n.id));
  const mainFlowNodes = nodes.filter((n) => !attachedHeadNodeIdSet.has(n.id));

  // 3. Dagre layout for main flow nodes
  const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    marginx: 80,
    marginy: 80,
    ranksep: isHorizontal ? 220 : 160,
    nodesep: 50,
  });

  mainFlowNodes.forEach((node: LayoutNode) => {
    const { width, height } = getNodeDimensions(node);
    dagreGraph.setNode(node.id, { width, height });
  });

  flowEdges.forEach((edge: LayoutEdge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  // 4. Extract positions computed by Dagre
  const positionsMap = new Map<string, { x: number; y: number }>();
  mainFlowNodes.forEach((node: LayoutNode) => {
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

  // 5. Layout attached head nodes (LLM, Tool, Middleware, Memory) above target step nodes
  layoutHeadNodes({
    targetNodeIds,
    nodes,
    positionsMap,
    headEdges,
    attachedHeadNodes,
  });

  // 6. Enforce positive origin margin
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

  // 7. Update node positions
  const nodeChanges: PositionNodeChange[] = nodes.map((node: LayoutNode) => {
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

  if (onNodesChange) {
    onNodesChange(nodeChanges);
  }

  setTimeout(() => {
    fitView({ duration: 300, padding: 0.2, maxZoom: 0.85 });
  }, 50);
}
