import { Position } from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import type { LayoutNode, LayoutEdge, PositionNodeChange } from "./types";
import { getNodeDimensions } from "./nodeDimensions";
import { layoutHeadNodes } from "./headNodeLayout";

export interface PerformLangGraphLayoutOptions {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  onNodesChange?: (changes: PositionNodeChange[]) => void;
  fitView: (options?: { duration?: number; padding?: number; maxZoom?: number; nodes?: { id: string }[] }) => void;
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

// ─── Definition node type groups ─────────────────────────────────────────────
// Each group becomes its own vertical column on the left side.
// The State column contains StateStoreNode(s) and LangGraphCanvasMemoryNode(s),
// where LangGraphCanvasMemoryNode is always aligned directly below the StateStoreNode.
// Subsequent columns are ordered: Tool | LLM | Middleware
export type DefColumnId = "state" | "tool" | "llm" | "middleware";

export function isStateStoreNode(node: LayoutNode): boolean {
  const type = node.type || "";
  const id   = node.id   || "";
  return (
    id === "STATE_GLOBAL" ||
    type === "state_global" ||
    type === "STATE_GLOBAL" ||
    type === "state_store" ||
    type === "StateStoreNode"
  );
}

export function isMemoryNode(node: LayoutNode): boolean {
  const type = node.type || "";
  const id   = node.id   || "";
  return (
    type !== "langgraph_memory_ref" &&
    (id === "CHECKPOINTER" ||
      type === "langgraph_memory" ||
      type === "memory" ||
      type === "LangGraphCanvasMemoryNode")
  );
}

export function getDefColumn(node: LayoutNode): DefColumnId | null {
  const type = node.type || "";

  if (isStateStoreNode(node) || isMemoryNode(node))
    return "state";
  if (type === "langgraph_tool" || type === "tool")
    return "tool";
  if (type === "langgraph_llm" || type === "llm")
    return "llm";
  if (type === "langgraph_middleware" || type === "middleware")
    return "middleware";

  return null; // not a definition node → belongs in topology
}

export function isLangGraphDefinitionNode(node: LayoutNode): boolean {
  return getDefColumn(node) !== null;
}

// Ordered column list (left → right)
export const DEF_COLUMN_ORDER: DefColumnId[] = ["state", "tool", "llm", "middleware"];

export function isStartNode(node: LayoutNode): boolean {
  const type = node.type || "";
  const id = node.id || "";
  return (
    id === "START" ||
    type === "start" ||
    type === "START" ||
    (node.data as Record<string, unknown> | undefined)?.stepType === "start"
  );
}

export function isEndNode(node: LayoutNode): boolean {
  const type = node.type || "";
  const id = node.id || "";
  return (
    id === "END" ||
    id.startsWith("end_") ||
    id.startsWith("END_") ||
    type === "end" ||
    type === "END" ||
    (node.data as Record<string, unknown> | undefined)?.stepType === "end"
  );
}

/**
 * Extracts only the flow nodes from the START node to the END node in LangGraph.
 * Ignores definition nodes (state, tools, llm, middleware) and any disconnected nodes.
 */
export function getLangGraphFlowNodes(
  nodes: LayoutNode[],
  edges: LayoutEdge[] = [],
): LayoutNode[] {
  if (nodes.length === 0) return [];

  // Exclude definition nodes (state, memory, tool, llm, middleware)
  const candidateNodes = nodes.filter((n) => !isLangGraphDefinitionNode(n));
  if (candidateNodes.length === 0) return [];

  const candidateIdSet = new Set(candidateNodes.map((n) => n.id));

  // Flow edges: edges between candidates that are not reference edges or head handle connections
  const flowEdges = edges.filter(
    (e) =>
      candidateIdSet.has(e.source) &&
      candidateIdSet.has(e.target) &&
      e.type !== "langgraph-reference" &&
      !LANGGRAPH_HEAD_HANDLES.has(e.targetHandle ?? ""),
  );

  const startNodes = candidateNodes.filter(isStartNode);
  const endNodes = candidateNodes.filter(isEndNode);

  // If there are no flow edges, but start or end nodes exist:
  // Return start and end nodes (or candidate topology nodes if start/end don't exist)
  if (flowEdges.length === 0) {
    const defaultFlow = candidateNodes.filter((n) => isStartNode(n) || isEndNode(n));
    return defaultFlow.length > 0 ? defaultFlow : candidateNodes;
  }

  // Build adjacency graph for flow edges
  const forwardAdj = new Map<string, string[]>();
  const backwardAdj = new Map<string, string[]>();
  const undirectedAdj = new Map<string, string[]>();

  candidateNodes.forEach((n) => {
    forwardAdj.set(n.id, []);
    backwardAdj.set(n.id, []);
    undirectedAdj.set(n.id, []);
  });

  flowEdges.forEach((e) => {
    forwardAdj.get(e.source)?.push(e.target);
    backwardAdj.get(e.target)?.push(e.source);
    undirectedAdj.get(e.source)?.push(e.target);
    undirectedAdj.get(e.target)?.push(e.source);
  });

  const bfs = (startIds: string[], adjMap: Map<string, string[]>): Set<string> => {
    const visited = new Set<string>();
    const queue = [...startIds];
    startIds.forEach((id) => visited.add(id));

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const neighbors = adjMap.get(curr) || [];
      for (const nbr of neighbors) {
        if (!visited.has(nbr)) {
          visited.add(nbr);
          queue.push(nbr);
        }
      }
    }
    return visited;
  };

  const startIds = startNodes.map((n) => n.id);
  const endIds = endNodes.map((n) => n.id);

  // Forward reachable from start nodes
  const reachableFromStart =
    startIds.length > 0 ? bfs(startIds, forwardAdj) : new Set<string>();

  // Backward reachable to end nodes
  const canReachEnd =
    endIds.length > 0 ? bfs(endIds, backwardAdj) : new Set<string>();

  // Nodes strictly on paths from START to END
  const onPathFromStartToEnd = new Set<string>();
  candidateNodes.forEach((n) => {
    if (reachableFromStart.has(n.id) && canReachEnd.has(n.id)) {
      onPathFromStartToEnd.add(n.id);
    }
  });

  let selectedNodeIds: Set<string>;

  if (onPathFromStartToEnd.size > 0) {
    selectedNodeIds = new Set(onPathFromStartToEnd);
    // Include branches connected to start or end along the flow
    reachableFromStart.forEach((id) => selectedNodeIds.add(id));
    canReachEnd.forEach((id) => selectedNodeIds.add(id));
  } else if (reachableFromStart.size > 0) {
    // Graph in progress from START: show all nodes reachable from START + END nodes
    selectedNodeIds = new Set(reachableFromStart);
    endIds.forEach((id) => selectedNodeIds.add(id));
  } else if (canReachEnd.size > 0) {
    selectedNodeIds = new Set(canReachEnd);
    startIds.forEach((id) => selectedNodeIds.add(id));
  } else {
    // Fallback: connected component containing start nodes
    const connectedToStart = bfs(startIds, undirectedAdj);
    selectedNodeIds =
      connectedToStart.size > 0
        ? connectedToStart
        : new Set([...startIds, ...endIds]);
  }

  // Ensure START and END nodes are always included if present
  startIds.forEach((id) => selectedNodeIds.add(id));
  endIds.forEach((id) => selectedNodeIds.add(id));

  const resultNodes: LayoutNode[] = [];
  candidateNodes.forEach((n) => {
    if (selectedNodeIds.has(n.id)) {
      resultNodes.push(n);
    }
  });

  return resultNodes.length > 0 ? resultNodes : candidateNodes;
}

export function performLangGraphLayout({
  nodes,
  edges,
  onNodesChange,
  fitView,
  direction = "LR",
}: PerformLangGraphLayoutOptions) {
  if (nodes.length === 0) return;
  const isHorizontal = direction === "LR";

  // ── 1. Bucket definition nodes into per-type columns ──────────────────────
  const columnBuckets: Record<DefColumnId, LayoutNode[]> = {
    state:      [],
    tool:       [],
    llm:        [],
    middleware: [],
  };

  const defNodeIdSet = new Set<string>();

  nodes.forEach((n) => {
    const col = getDefColumn(n);
    if (col) {
      columnBuckets[col].push(n);
      defNodeIdSet.add(n.id);
    }
  });

  const topologyNodes = nodes.filter((n) => !defNodeIdSet.has(n.id));
  const positionsMap = new Map<string, { x: number; y: number }>();

  // ── 2. Place definition columns on the left, side by side ─────────────────
  const startX        = 60;
  const startY        = 60;
  const colGap        = 40;  // horizontal gap between columns
  const nodeVertGap   = 28;  // vertical gap between nodes within the same column

  let currentColX = startX;
  let leftPanelRight = startX; // right edge of all definition columns combined

  DEF_COLUMN_ORDER.forEach((colId) => {
    const colNodes = columnBuckets[colId];
    if (colNodes.length === 0) return; // skip empty columns

    // For the state column: StateStoreNode(s) must always come first at the top,
    // and LangGraphCanvasMemoryNode(s) must always be placed directly below them.
    if (colId === "state") {
      colNodes.sort((a, b) => {
        const aIsState = isStateStoreNode(a);
        const bIsState = isStateStoreNode(b);
        if (aIsState !== bIsState) {
          return aIsState ? -1 : 1; // StateStoreNode always comes before MemoryNode
        }
        return (
          (a.position?.y ?? 0) - (b.position?.y ?? 0) ||
          a.id.localeCompare(b.id)
        );
      });
    } else {
      // Sort nodes in this column by their existing y-position so order is stable
      colNodes.sort(
        (a, b) =>
          (a.position?.y ?? 0) - (b.position?.y ?? 0) ||
          a.id.localeCompare(b.id),
      );
    }

    // Calculate the column width (widest node in this column)
    const colWidth = Math.max(...colNodes.map((n) => getNodeDimensions(n).width));

    // Stack nodes vertically within the column
    let currentY = startY;
    colNodes.forEach((node) => {
      positionsMap.set(node.id, { x: currentColX, y: currentY });
      const { height } = getNodeDimensions(node);
      currentY += height + nodeVertGap;
    });

    leftPanelRight = currentColX + colWidth;
    currentColX    = leftPanelRight + colGap;
  });

  // ── 3. Process topology nodes ─────────────────────────────────────────────
  const attachedHeadNodeIdSet = new Set<string>();

  if (topologyNodes.length > 0) {
    // Head edges connect Ref nodes to topology steps
    const headEdges = edges.filter(
      (e: LayoutEdge) =>
        LANGGRAPH_HEAD_HANDLES.has(e.targetHandle ?? "") &&
        e.type !== "langgraph-reference" &&
        !defNodeIdSet.has(e.source) &&
        !defNodeIdSet.has(e.target),
    );

    headEdges.forEach((e) => attachedHeadNodeIdSet.add(e.source));
    const targetNodeIds = new Set<string>(headEdges.map((e) => e.target));

    const attachedHeadNodes = topologyNodes.filter((n) =>
      attachedHeadNodeIdSet.has(n.id),
    );
    const mainFlowNodes = topologyNodes.filter(
      (n) => !attachedHeadNodeIdSet.has(n.id),
    );

    // Flow edges: connect main topology nodes (START → Node → END)
    const flowEdges = edges.filter(
      (e: LayoutEdge) =>
        !LANGGRAPH_HEAD_HANDLES.has(e.targetHandle ?? "") &&
        e.type !== "langgraph-reference" &&
        !defNodeIdSet.has(e.source) &&
        !defNodeIdSet.has(e.target) &&
        !attachedHeadNodeIdSet.has(e.source) &&
        !attachedHeadNodeIdSet.has(e.target),
    );

    // 4. Dagre layout for main flow topology nodes
    const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({
      rankdir: direction,
      marginx: 40,
      marginy: 40,
      ranksep: isHorizontal ? 200 : 160,
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

    // 5. Extract positions from Dagre
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

    // 6. Layout Ref nodes above their target step nodes
    layoutHeadNodes({
      targetNodeIds,
      nodes,
      positionsMap,
      headEdges,
      attachedHeadNodes,
    });

    // 7. Shift the entire topology block to the right of the definition panel
    const TOPOLOGY_MARGIN = 160;
    const topologyStartX = defNodeIdSet.size > 0 ? leftPanelRight + TOPOLOGY_MARGIN : startX;
    const topologyStartY = startY;

    let topMinX = Infinity;
    let topMinY = Infinity;
    topologyNodes.forEach((n) => {
      const pos = positionsMap.get(n.id);
      if (pos) {
        if (pos.x < topMinX) topMinX = pos.x;
        if (pos.y < topMinY) topMinY = pos.y;
      }
    });

    const shiftX = Number.isFinite(topMinX) ? topologyStartX - topMinX : 0;
    const shiftY = Number.isFinite(topMinY) ? topologyStartY - topMinY : 0;

    topologyNodes.forEach((n) => {
      const pos = positionsMap.get(n.id);
      if (pos) {
        positionsMap.set(n.id, {
          x: pos.x + shiftX,
          y: pos.y + shiftY,
        });
      }
    });
  }

  // ── 8. Emit node position changes ─────────────────────────────────────────
  const nodeChanges: PositionNodeChange[] = nodes.map((node: LayoutNode) => {
    const pos = positionsMap.get(node.id) ?? {
      x: node.position.x,
      y: node.position.y,
    };
    const isAttachedHead = attachedHeadNodeIdSet.has(node.id);
    const isDef          = defNodeIdSet.has(node.id);

    return {
      id: node.id,
      type: "position",
      position: pos,
      sourcePosition: isAttachedHead
        ? Position.Bottom
        : isDef
          ? Position.Right
          : isHorizontal
            ? Position.Right
            : Position.Bottom,
      targetPosition: isAttachedHead
        ? Position.Top
        : isDef
          ? Position.Left
          : isHorizontal
            ? Position.Left
            : Position.Top,
    };
  });

  if (onNodesChange) {
    onNodesChange(nodeChanges);
  }

  const flowNodes = getLangGraphFlowNodes(nodes, edges);
  const targetNodes =
    flowNodes.length > 0
      ? flowNodes
      : topologyNodes.length > 0
        ? topologyNodes
        : nodes;

  setTimeout(() => {
    fitView({
      nodes: targetNodes.map((n) => ({ id: n.id })),
      duration: 300,
      padding: 0.2,
      maxZoom: 0.85,
    });
  }, 50);
}
