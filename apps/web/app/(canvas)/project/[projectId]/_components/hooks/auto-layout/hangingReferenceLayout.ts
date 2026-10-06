import type { LayoutNode, LayoutEdge } from "./types";
import { getNodeDimensions, getHandleYRatio } from "./nodeDimensions";

export interface HangingReferenceLayoutParams {
  nodes: LayoutNode[];
  positionsMap: Map<string, { x: number; y: number }>;
  hangingRefEdges: LayoutEdge[];
  hangingRefNodes: LayoutNode[];
  isHorizontal?: boolean;
  storeEndpoints?: Array<{ id: string; nodeId: string }>;
  storeEvents?: Array<{ id: string; nodeId: string }>;
}

export const REFERENCE_NODE_TYPES = new Set<string>([
  "db_ref",
  "redis-cache",
  "vector_db_ref",
  "langgraph",
  "langgraph_agent",
  "langgraph_node",
  "storage_operation_ref",
  "storage_ref",
  "StorageOperationRefNode",
  "StorageBucketRefNode",
]);

const STEP_CARD_HEADER_OFFSET_Y = 44;
const STEP_CARD_HEADER_OFFSET_X = -8;

export interface HangingReferenceLayoutResult {
  stackedRefDeckGroups: string[][];
}

/**
 * Positions hanging reference nodes (Table Ref, Redis Cache Ref, Vector DB Ref, LangGraph Agent, Storage Bucket Ref)
 * in a dedicated column immediately preceding (to the left of) the service node they feed into.
 * When multiple reference cards attach to the same endpoint, they stack into a deck of cards by default.
 */
export function layoutHangingReferenceNodes({
  nodes,
  positionsMap,
  hangingRefEdges,
  hangingRefNodes,
  isHorizontal = true,
  storeEndpoints = [],
  storeEvents = [],
}: HangingReferenceLayoutParams): HangingReferenceLayoutResult {
  const stackedRefDeckGroups: string[][] = [];
  if (hangingRefNodes.length === 0) return { stackedRefDeckGroups };

  // Build lookup maps for endpoint & event handle ratios
  const endpointYRatio = new Map<string, number>();
  const epsByNode = new Map<string, string[]>();
  storeEndpoints.forEach((ep) => {
    if (!epsByNode.has(ep.nodeId)) epsByNode.set(ep.nodeId, []);
    epsByNode.get(ep.nodeId)!.push(ep.id);
  });
  epsByNode.forEach((epIds) => {
    epIds.forEach((epId, idx) => {
      endpointYRatio.set(epId, (idx + 0.5) / epIds.length);
    });
  });

  const eventYRatio = new Map<string, number>();
  const evsByNode = new Map<string, string[]>();
  storeEvents.forEach((ev) => {
    if (!evsByNode.has(ev.nodeId)) evsByNode.set(ev.nodeId, []);
    evsByNode.get(ev.nodeId)!.push(ev.id);
  });
  evsByNode.forEach((evIds) => {
    evIds.forEach((evId, idx) => {
      eventYRatio.set(evId, (idx + 0.5) / evIds.length);
    });
  });

  const resolveServiceSourceHandleRatio = (
    serviceNode: LayoutNode,
    sourceHandle?: string | null,
  ): number => {
    if (!sourceHandle) return 0.5;

    if (
      sourceHandle.startsWith("endpoint-out-") ||
      sourceHandle.startsWith("endpoint-in-")
    ) {
      const epId = sourceHandle.replace(/^endpoint-(out|in)-/, "");
      const r = endpointYRatio.get(epId);
      if (r !== undefined) return r;
    }

    if (
      sourceHandle.startsWith("publishedEvents-out-") ||
      sourceHandle.startsWith("consumedEvents-in-") ||
      sourceHandle.startsWith("events-")
    ) {
      const evId = sourceHandle.replace(
        /^(publishedEvents-out-|consumedEvents-in-|events-)/,
        "",
      );
      const r = eventYRatio.get(evId);
      if (r !== undefined) return r;
    }

    return getHandleYRatio(serviceNode, sourceHandle);
  };

  // Group hanging reference nodes by their connected service node ID
  const refsByService = new Map<string, LayoutNode[]>();
  const unattachedRefs: LayoutNode[] = [];

  hangingRefNodes.forEach((refNode) => {
    const edge = hangingRefEdges.find(
      (e) => e.target === refNode.id || e.source === refNode.id,
    );
    if (!edge) {
      unattachedRefs.push(refNode);
      return;
    }
    const sourceServiceId =
      edge.target === refNode.id ? edge.source : edge.target;
    if (!refsByService.has(sourceServiceId)) {
      refsByService.set(sourceServiceId, []);
    }
    refsByService.get(sourceServiceId)!.push(refNode);
  });

  refsByService.forEach((refs, serviceId) => {
    const serviceNode = nodes.find((n) => n.id === serviceId);
    const servicePos = positionsMap.get(serviceId);
    if (!serviceNode || !servicePos) return;

    const { width: serviceW, height: serviceH } = getNodeDimensions(serviceNode);

    if (isHorizontal) {
      // LR Layout: Reference nodes sit in a column to the LEFT of the service node (ingress side)
      const gapX = 80;
      const minVerticalGap = 20;

      const maxRefW = Math.max(
        ...refs.map((r) => getNodeDimensions(r).width),
      );

      const targetX = servicePos.x - maxRefW - gapX;

      interface RefItem {
        node: LayoutNode;
        width: number;
        height: number;
        sourceHandleY: number;
        idealY: number;
        y: number;
        endpointKey: string;
      }

      const items: RefItem[] = refs.map((refNode) => {
        const { width, height } = getNodeDimensions(refNode);
        const edge = hangingRefEdges.find(
          (e) =>
            (e.target === refNode.id && e.source === serviceId) ||
            (e.source === refNode.id && e.target === serviceId),
        );
        const serviceHandle =
          edge?.target === refNode.id ? edge?.sourceHandle : edge?.targetHandle;
        const handleRatio = resolveServiceSourceHandleRatio(
          serviceNode,
          serviceHandle,
        );
        const sourceHandleY = servicePos.y + handleRatio * serviceH;
        const idealY = sourceHandleY - height / 2;

        const endpointKey = serviceHandle
          ? serviceHandle.replace(
              /^(endpoint-in-|endpoint-out-|consumedEvents-in-|consumedEvents-out-)/,
              "",
            )
          : "default";

        return {
          node: refNode,
          width,
          height,
          sourceHandleY,
          idealY,
          y: idealY,
          endpointKey,
        };
      });

      // Sort primarily by source handle Y so edges don't cross.
      items.sort((a, b) => {
        const diffHandleY = a.sourceHandleY - b.sourceHandleY;
        if (Math.abs(diffHandleY) > 5) {
          return diffHandleY;
        }

        const typePriority = (type?: string) => {
          if (type === "db_ref") return 1;
          if (type === "redis-cache") return 2;
          if (type === "vector_db_ref") return 3;
          if (
            type === "storage_operation_ref" ||
            type === "storage_ref" ||
            type === "StorageOperationRefNode" ||
            type === "StorageBucketRefNode"
          )
            return 4;
          if (
            type === "langgraph" ||
            type === "langgraph_agent" ||
            type === "langgraph_node"
          )
            return 5;
          return 6;
        };

        const pA = typePriority(a.node.type);
        const pB = typePriority(b.node.type);
        if (pA !== pB) return pA - pB;

        return a.idealY - b.idealY;
      });

      // Group items by endpoint to determine stacking
      const expandedStacks: string[] = Array.isArray(serviceNode.data?.expandedStepStacks)
        ? (serviceNode.data.expandedStepStacks as string[])
        : [];

      const endpointGroups = new Map<string, RefItem[]>();
      items.forEach((item) => {
        if (!endpointGroups.has(item.endpointKey)) {
          endpointGroups.set(item.endpointKey, []);
        }
        endpointGroups.get(item.endpointKey)!.push(item);
      });

      // Represent each endpoint group as a layout block
      interface GroupBlock {
        key: string;
        items: RefItem[];
        isStacked: boolean;
        baseY: number;
        height: number;
      }

      const groupBlocks: GroupBlock[] = [];
      endpointGroups.forEach((groupItems, key) => {
        const isStacked = groupItems.length > 1 && !expandedStacks.includes(key);
        const leadItem = groupItems[0]!;
        const totalHeight = isStacked
          ? leadItem.height + (groupItems.length - 1) * STEP_CARD_HEADER_OFFSET_Y
          : groupItems.reduce((acc, it) => acc + it.height + minVerticalGap, 0) - minVerticalGap;

        groupBlocks.push({
          key,
          items: groupItems,
          isStacked,
          baseY: leadItem.idealY,
          height: totalHeight,
        });
      });

      // Sort blocks by baseY
      groupBlocks.sort((a, b) => a.baseY - b.baseY);

      // Relax vertical collisions between different group blocks
      if (groupBlocks.length > 1) {
        for (let i = 1; i < groupBlocks.length; i++) {
          const prev = groupBlocks[i - 1]!;
          const curr = groupBlocks[i]!;
          const minAllowedY = prev.baseY + prev.height + minVerticalGap;
          if (curr.baseY < minAllowedY) {
            curr.baseY = minAllowedY;
          }
        }
      }

      // Assign positions for each group block
      groupBlocks.forEach((block) => {
        if (block.isStacked) {
          if (block.items.length > 1) {
            stackedRefDeckGroups.push(block.items.map((it) => it.node.id));
          }
          // Deck of cards: peeking header offsets
          block.items.forEach((item, idx) => {
            positionsMap.set(item.node.id, {
              x: targetX + idx * STEP_CARD_HEADER_OFFSET_X,
              y: block.baseY + idx * STEP_CARD_HEADER_OFFSET_Y,
            });
          });
        } else {
          // Fanned out vertically
          let currY = block.baseY;
          block.items.forEach((item) => {
            positionsMap.set(item.node.id, {
              x: targetX,
              y: currY,
            });
            currY += item.height + minVerticalGap;
          });
        }
      });
    } else {
      // TB Layout: Reference nodes sit in a row below the service node
      const gapY = 60;
      const minHorizontalGap = 20;

      const targetY = servicePos.y + serviceH + gapY;

      const items = refs.map((rNode) => {
        const { width, height } = getNodeDimensions(rNode);
        return {
          node: rNode,
          width,
          height,
          x: servicePos.x + serviceW / 2 - width / 2,
        };
      });

      items.sort((a, b) => {
        const typePriority = (type?: string) => {
          if (type === "db_ref") return 1;
          if (type === "redis-cache") return 2;
          if (type === "vector_db_ref") return 3;
          if (
            type === "langgraph" ||
            type === "langgraph_agent" ||
            type === "langgraph_node"
          )
            return 4;
          return 5;
        };
        return typePriority(a.node.type) - typePriority(b.node.type);
      });

      const totalW =
        items.reduce((s, it) => s + it.width, 0) +
        (items.length - 1) * minHorizontalGap;
      let startX = servicePos.x + serviceW / 2 - totalW / 2;

      items.forEach((item) => {
        positionsMap.set(item.node.id, {
          x: startX,
          y: targetY,
        });
        startX += item.width + minHorizontalGap;
      });
    }
  });

  // If there are unattached reference nodes, place them gracefully near the bottom right
  if (unattachedRefs.length > 0) {
    let maxY = 0;
    let maxX = 0;
    positionsMap.forEach((pos) => {
      if (pos.y > maxY) maxY = pos.y;
      if (pos.x > maxX) maxX = pos.x;
    });

    unattachedRefs.forEach((node, idx) => {
      if (!positionsMap.has(node.id)) {
        positionsMap.set(node.id, {
          x: isHorizontal ? maxX + 80 : 80 + idx * 260,
          y: isHorizontal ? 80 + idx * 90 : maxY + 80,
        });
      }
    });
  }

  return { stackedRefDeckGroups };
}
