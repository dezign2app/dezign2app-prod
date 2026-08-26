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
  "component",
  "component_ref",
]);

/**
 * Positions hanging reference nodes (Table Ref, Redis Cache Ref, Vector DB Ref)
 * in a dedicated column immediately following (to the right of) the service node they connect to.
 */
export function layoutHangingReferenceNodes({
  nodes,
  positionsMap,
  hangingRefEdges,
  hangingRefNodes,
  isHorizontal = true,
  storeEndpoints = [],
  storeEvents = [],
}: HangingReferenceLayoutParams): void {
  if (hangingRefNodes.length === 0) return;

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

  // Group hanging reference nodes by their source service node ID
  const refsByService = new Map<string, LayoutNode[]>();
  const unattachedRefs: LayoutNode[] = [];

  hangingRefNodes.forEach((refNode) => {
    const edge = hangingRefEdges.find((e) => e.target === refNode.id);
    if (!edge) {
      unattachedRefs.push(refNode);
      return;
    }
    const sourceServiceId = edge.source;
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
      // LR Layout: Reference nodes sit in a column to the right of the service node
      const gapX = 80;
      const minVerticalGap = 16;

      const targetX = servicePos.x + serviceW + gapX;

      interface RefItem {
        node: LayoutNode;
        width: number;
        height: number;
        idealY: number;
        y: number;
      }

      const items: RefItem[] = refs.map((refNode) => {
        const { width, height } = getNodeDimensions(refNode);
        const edge = hangingRefEdges.find(
          (e) => e.target === refNode.id && e.source === serviceId,
        );
        const handleRatio = resolveServiceSourceHandleRatio(
          serviceNode,
          edge?.sourceHandle,
        );
        const sourceHandleY = servicePos.y + handleRatio * serviceH;
        const idealY = sourceHandleY - height / 2;

        return {
          node: refNode,
          width,
          height,
          idealY,
          y: idealY,
        };
      });

      // Sort by ideal Y
      items.sort((a, b) => a.idealY - b.idealY);

      // Relax / resolve collisions so no reference nodes overlap
      if (items.length > 1) {
        // Forward pass: push overlapping items down
        for (let i = 1; i < items.length; i++) {
          const prev = items[i - 1]!;
          const curr = items[i]!;
          const minAllowedY = prev.y + prev.height + minVerticalGap;
          if (curr.y < minAllowedY) {
            curr.y = minAllowedY;
          }
        }

        // Calculate shift to center the stack around the average ideal Y
        const avgIdeal =
          items.reduce((sum, item) => sum + item.idealY + item.height / 2, 0) /
          items.length;
        const totalStackH =
          items[items.length - 1]!.y +
          items[items.length - 1]!.height -
          items[0]!.y;
        const currentCenter = items[0]!.y + totalStackH / 2;
        const shiftY = avgIdeal - currentCenter;

        items.forEach((item) => {
          item.y += shiftY;
        });
      }

      // Store final positions
      items.forEach((item) => {
        positionsMap.set(item.node.id, {
          x: targetX,
          y: item.y,
        });
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
}
