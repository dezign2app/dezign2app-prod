import type { LayoutNode, LayoutEdge } from "./types";
import { getNodeDimensions } from "./nodeDimensions";

export interface TypesNodeLayoutParams {
  typesNodes: LayoutNode[];
  positionsMap: Map<string, { x: number; y: number }>;
  edges?: LayoutEdge[];
  startMarginX?: number;
  startMarginY?: number;
  columnGap?: number;
  rowGap?: number;
  mainGraphSeparation?: number;
}

/**
 * Positions TypesNode (package types, custom data contracts, extended types)
 * in a dedicated "away" area along the left canvas margin:
 *
 *  - Column 1 (x: 60): Base types (packages, standalone custom contracts)
 *  - Column 2 (x: 380): Extended types aligned with their parent base types
 *  - Main architecture graph is shifted right so it cleanly begins after the Types section.
 */
export function layoutTypesNodes({
  typesNodes,
  positionsMap,
  edges = [],
  startMarginX = 60,
  startMarginY = 60,
  columnGap = 80,
  rowGap = 32,
  mainGraphSeparation = 200,
}: TypesNodeLayoutParams): void {
  if (typesNodes.length === 0) return;

  const typesNodeIds = new Set<string>(typesNodes.map((n) => n.id));

  // 1. Identify base vs extended types nodes
  const isExtendedNode = (node: LayoutNode): boolean => {
    const data = node.data as
      | { isExtended?: boolean; extendedFromNodeId?: string }
      | undefined;
    if (
      data?.isExtended ||
      (data?.extendedFromNodeId && typesNodeIds.has(data.extendedFromNodeId))
    ) {
      return true;
    }
    return edges.some(
      (e) => e.target === node.id && typesNodeIds.has(e.source),
    );
  };

  const getParentBaseId = (node: LayoutNode): string | undefined => {
    const data = node.data as { extendedFromNodeId?: string } | undefined;
    if (data?.extendedFromNodeId && typesNodeIds.has(data.extendedFromNodeId)) {
      return data.extendedFromNodeId;
    }
    const incomingEdge = edges.find(
      (e) => e.target === node.id && typesNodeIds.has(e.source),
    );
    return incomingEdge?.source;
  };

  const baseNodes: LayoutNode[] = [];
  const extendedNodes: LayoutNode[] = [];

  typesNodes.forEach((node) => {
    if (isExtendedNode(node)) {
      extendedNodes.push(node);
    } else {
      baseNodes.push(node);
    }
  });

  // Fallback: If all are categorized as extended without any base, treat all as base
  if (baseNodes.length === 0 && extendedNodes.length > 0) {
    baseNodes.push(...extendedNodes.splice(0, extendedNodes.length));
  }

  // 2. Layout Column 1 (Base Types)
  let curCol1Y = startMarginY;
  let col1Width = 270;

  baseNodes.forEach((node) => {
    const dims = getNodeDimensions(node);
    if (dims.width > col1Width) {
      col1Width = dims.width;
    }
    positionsMap.set(node.id, {
      x: startMarginX,
      y: curCol1Y,
    });
    curCol1Y += dims.height + rowGap;
  });

  // 3. Layout Column 2 (Extended Types)
  let typesRight = startMarginX + col1Width;

  if (extendedNodes.length > 0) {
    const col2X = startMarginX + col1Width + columnGap;
    let col2Width = 270;
    let curCol2Y = startMarginY;

    // Place extended nodes grouped next to their parent base node
    const placedExtIds = new Set<string>();

    baseNodes.forEach((baseNode) => {
      const children = extendedNodes.filter(
        (ext) => getParentBaseId(ext) === baseNode.id,
      );
      if (children.length > 0) {
        const parentPos = positionsMap.get(baseNode.id) ?? {
          x: startMarginX,
          y: startMarginY,
        };
        let extY = Math.max(curCol2Y, parentPos.y);

        children.forEach((child) => {
          const dims = getNodeDimensions(child);
          if (dims.width > col2Width) {
            col2Width = dims.width;
          }
          positionsMap.set(child.id, {
            x: col2X,
            y: extY,
          });
          placedExtIds.add(child.id);
          extY += dims.height + rowGap;
        });

        curCol2Y = extY;
      }
    });

    // Place any remaining extended nodes whose parent was not found
    extendedNodes.forEach((node) => {
      if (!placedExtIds.has(node.id)) {
        const dims = getNodeDimensions(node);
        if (dims.width > col2Width) {
          col2Width = dims.width;
        }
        positionsMap.set(node.id, {
          x: col2X,
          y: curCol2Y,
        });
        curCol2Y += dims.height + rowGap;
      }
    });

    typesRight = col2X + col2Width;
  }

  // 4. Shift main architecture graph nodes rightwards so they begin safely after Types section
  let minMainX = Infinity;
  positionsMap.forEach((pos, id) => {
    if (!typesNodeIds.has(id)) {
      if (pos.x < minMainX) {
        minMainX = pos.x;
      }
    }
  });

  if (minMainX !== Infinity) {
    const targetMainX = typesRight + mainGraphSeparation;
    if (minMainX < targetMainX) {
      const shiftX = targetMainX - minMainX;
      positionsMap.forEach((pos, id) => {
        if (!typesNodeIds.has(id)) {
          positionsMap.set(id, {
            x: pos.x + shiftX,
            y: pos.y,
          });
        }
      });
    }
  }
}
