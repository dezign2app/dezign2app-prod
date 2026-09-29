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

// ─── Definition node type groups ─────────────────────────────────────────────
// Each group becomes its own vertical column on the left side.
// Columns are ordered: State | Tool | LLM | Middleware | Memory
type DefColumnId = "state" | "tool" | "llm" | "middleware" | "memory";

function getDefColumn(node: LayoutNode): DefColumnId | null {
  const type = node.type || "";
  const id   = node.id   || "";

  if (id === "STATE_GLOBAL" || type === "state_global" || type === "STATE_GLOBAL")
    return "state";
  if (type === "langgraph_tool" || type === "tool")
    return "tool";
  if (type === "langgraph_llm" || type === "llm")
    return "llm";
  if (type === "langgraph_middleware" || type === "middleware")
    return "middleware";
  if (type === "langgraph_memory" || type === "memory")
    return "memory";

  return null; // not a definition node → belongs in topology
}

function isLangGraphDefinitionNode(node: LayoutNode): boolean {
  return getDefColumn(node) !== null;
}

// Ordered column list (left → right)
const DEF_COLUMN_ORDER: DefColumnId[] = ["state", "tool", "llm", "middleware", "memory"];

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
    memory:     [],
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

    // Sort nodes in this column by their existing y-position so order is stable
    colNodes.sort(
      (a, b) =>
        (a.position?.y ?? 0) - (b.position?.y ?? 0) ||
        a.id.localeCompare(b.id),
    );

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

  setTimeout(() => {
    fitView({ duration: 300, padding: 0.2, maxZoom: 0.85 });
  }, 50);
}
