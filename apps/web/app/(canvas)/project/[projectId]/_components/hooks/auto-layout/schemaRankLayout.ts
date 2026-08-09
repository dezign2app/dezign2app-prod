import type { LayoutNode, LayoutEdge, DagreGraph, DagreNodeInfo } from "./types";
import { getNodeDimensions } from "./nodeDimensions";

export interface SchemaRankLayoutOptions {
  dagreGraph: DagreGraph;
  entityFlowNodes: LayoutNode[];
  entityFlowEdges: LayoutEdge[];
  positionsMap: Map<string, { x: number; y: number }>;
}

/**
 * Organizes schema entity nodes into staggered sub-columns (lines) per Dagre rank.
 * Instead of stacking all intermediary tables in a single vertical column,
 * alternating nodes (e.g. 2nd, 4th, 6th) are pushed to secondary lines / sub-columns.
 * For large schemas (e.g. 100+ tables), nodes wrap across up to 4 sub-columns per rank,
 * creating a highly organized, balanced, and compact grid layout.
 */
export function layoutSchemaRanks({
  dagreGraph,
  entityFlowNodes,
  positionsMap,
}: SchemaRankLayoutOptions): void {
  if (entityFlowNodes.length === 0) return;

  // 1. Group entity nodes by Dagre rank
  const rankMap = new Map<number, LayoutNode[]>();
  entityFlowNodes.forEach((node) => {
    const dNode: DagreNodeInfo | undefined = dagreGraph.node(node.id);
    const rank = typeof dNode?.rank === "number" ? dNode.rank : 0;
    const existing = rankMap.get(rank);
    if (existing) {
      existing.push(node);
    } else {
      rankMap.set(rank, [node]);
    }
  });

  const sortedRanks = Array.from(rankMap.keys()).sort((a, b) => a - b);

  // Spacing & Gap Constants
  const subColGapX = 90; // Horizontal offset to push staggered sub-columns/lines
  const nodeGapY = 70; // Vertical gap between stacked tables within a sub-column
  const minRankSep = 260; // Minimum horizontal gap between consecutive ranks

  let currentRankStartX = 120; // Initial margin for rank 0

  sortedRanks.forEach((rankKey) => {
    const nodesInRank = rankMap.get(rankKey);
    if (!nodesInRank || nodesInRank.length === 0) return;

    // Sort nodes in rank vertically by Dagre's computed Y position
    nodesInRank.sort((a, b) => {
      const dNodeA: DagreNodeInfo | undefined = dagreGraph.node(a.id);
      const dNodeB: DagreNodeInfo | undefined = dagreGraph.node(b.id);
      const yA = dNodeA?.y ?? 0;
      const yB = dNodeB?.y ?? 0;
      return yA - yB;
    });

    // 2. Determine number of sub-columns (stagger lines)
    // - 1 node: 1 column
    // - 2..8 nodes: 2 sub-columns (alternating odd/even staggering: 1st & 3rd on line 1, 2nd & 4th pushed to line 2)
    // - > 8 nodes: 3 or 4 sub-columns to maintain a balanced, organized grid for 100+ tables
    const count = nodesInRank.length;
    let numCols = 1;
    if (count > 1 && count <= 8) {
      numCols = 2;
    } else if (count > 8) {
      numCols = Math.min(4, Math.ceil(Math.sqrt(count)));
    }

    // 3. Partition nodes into sub-columns (alternating / round-robin)
    const subCols: LayoutNode[][] = Array.from({ length: numCols }, () => []);
    nodesInRank.forEach((node, idx) => {
      const colIdx = idx % numCols;
      const targetCol = subCols[colIdx];
      if (targetCol) {
        targetCol.push(node);
      }
    });

    // Compute max width of nodes in each sub-column
    const colWidths: number[] = subCols.map((colNodes) => {
      let maxW = 0;
      colNodes.forEach((n) => {
        const { width } = getNodeDimensions(n);
        if (width > maxW) maxW = width;
      });
      return maxW;
    });

    // Compute total stacked height of each sub-column
    const colHeights: number[] = subCols.map((colNodes) => {
      if (colNodes.length === 0) return 0;
      let totalH = 0;
      colNodes.forEach((n, i) => {
        const { height } = getNodeDimensions(n);
        totalH += height + (i > 0 ? nodeGapY : 0);
      });
      return totalH;
    });

    // Calculate average Dagre Y center for nodes in this rank
    const rankCenterY =
      nodesInRank.reduce((sum, n) => {
        const dNode: DagreNodeInfo | undefined = dagreGraph.node(n.id);
        const dY = dNode?.y;
        return sum + (typeof dY === "number" ? dY : 400);
      }, 0) / nodesInRank.length;

    // 4. Calculate X positions for sub-columns
    const colXPositions: number[] = [];
    let curX = currentRankStartX;
    for (let c = 0; c < numCols; c++) {
      colXPositions.push(curX);
      const colW = colWidths[c] ?? 0;
      curX += colW + (c < numCols - 1 ? subColGapX : 0);
    }

    // 5. Assign (x, y) coordinates to each node
    subCols.forEach((colNodes, colIdx) => {
      const xPos = colXPositions[colIdx] ?? currentRankStartX;
      const totalH = colHeights[colIdx] ?? 0;
      let startY = rankCenterY - totalH / 2;

      colNodes.forEach((node) => {
        const { height } = getNodeDimensions(node);
        positionsMap.set(node.id, {
          x: xPos,
          y: startY,
        });
        startY += height + nodeGapY;
      });
    });

    // 6. Advance start X for the next rank
    const lastColX = colXPositions[numCols - 1] ?? currentRankStartX;
    const lastColW = colWidths[numCols - 1] ?? 0;
    const lastColMaxRight = lastColX + lastColW;
    currentRankStartX = lastColMaxRight + minRankSep;
  });
}
