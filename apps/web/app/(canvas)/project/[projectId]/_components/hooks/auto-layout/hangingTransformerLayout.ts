import type { LayoutNode, LayoutEdge } from "./types";
import { getNodeDimensions, getHandleYRatio } from "./nodeDimensions";

export interface HangingTransformerLayoutParams {
  nodes: LayoutNode[];
  positionsMap: Map<string, { x: number; y: number }>;
  hangingEdges: LayoutEdge[];
  hangingTransformerNodes: LayoutNode[];
  isHorizontal?: boolean;
  storeEndpoints?: Array<{ id: string; nodeId: string }>;
  storeEvents?: Array<{ id: string; nodeId: string }>;
}

/**
 * Positions hanging transformer nodes (local transformers & global transformer refs)
 * in a dedicated column immediately preceding (to the left of) the service node they connect to.
 */
export function layoutHangingTransformerNodes({
  nodes,
  positionsMap,
  hangingEdges,
  hangingTransformerNodes,
  isHorizontal = true,
  storeEndpoints = [],
  storeEvents = [],
}: HangingTransformerLayoutParams): void {
  if (hangingTransformerNodes.length === 0) return;

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

  const resolveServiceHandleRatio = (
    serviceNode: LayoutNode,
    targetHandle?: string | null,
  ): number => {
    if (!targetHandle) return 0.5;

    if (
      targetHandle.startsWith("endpoint-in-") ||
      targetHandle.startsWith("endpoint-out-")
    ) {
      const epId = targetHandle.replace(/^endpoint-(in|out)-/, "");
      const r = endpointYRatio.get(epId);
      if (r !== undefined) return r;
    }

    if (targetHandle.startsWith("consumedEvents-in-")) {
      const evId = targetHandle.replace("consumedEvents-in-", "");
      const r = eventYRatio.get(evId);
      if (r !== undefined) return r;
    }

    if (targetHandle.startsWith("events-")) {
      const evId = targetHandle.replace("events-", "");
      const r = eventYRatio.get(evId);
      if (r !== undefined) return r;
    }

    return getHandleYRatio(serviceNode, targetHandle);
  };

  // Group hanging transformers by their target service node ID
  const transformersByService = new Map<string, LayoutNode[]>();
  hangingTransformerNodes.forEach((tNode) => {
    const edge = hangingEdges.find((e) => e.source === tNode.id);
    if (!edge) return;
    const targetServiceId = edge.target;
    if (!transformersByService.has(targetServiceId)) {
      transformersByService.set(targetServiceId, []);
    }
    transformersByService.get(targetServiceId)!.push(tNode);
  });

  transformersByService.forEach((transformers, serviceId) => {
    const serviceNode = nodes.find((n) => n.id === serviceId);
    const servicePos = positionsMap.get(serviceId);
    if (!serviceNode || !servicePos) return;

    const { width: serviceW, height: serviceH } = getNodeDimensions(serviceNode);

    if (isHorizontal) {
      // LR Layout: Transformers sit in a column to the left of the service node
      const gapX = 80;
      const minVerticalGap = 16;

      // Find max width among hanging transformers for this service
      const maxTransW = Math.max(
        ...transformers.map((t) => getNodeDimensions(t).width),
      );

      const targetX = servicePos.x - maxTransW - gapX;

      // Compute ideal Y for each transformer aligned with its connected handle
      interface TransItem {
        node: LayoutNode;
        width: number;
        height: number;
        idealY: number;
        y: number;
      }

      const items: TransItem[] = transformers.map((tNode) => {
        const { width, height } = getNodeDimensions(tNode);
        const edge = hangingEdges.find(
          (e) => e.source === tNode.id && e.target === serviceId,
        );
        const handleRatio = resolveServiceHandleRatio(
          serviceNode,
          edge?.targetHandle,
        );
        const targetHandleY = servicePos.y + handleRatio * serviceH;
        const idealY = targetHandleY - height / 2;

        return {
          node: tNode,
          width,
          height,
          idealY,
          y: idealY,
        };
      });

      // Sort by ideal Y
      items.sort((a, b) => a.idealY - b.idealY);

      // Relax / resolve collisions so no transformers overlap
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
        const posX = targetX + (maxTransW - item.width) / 2;
        positionsMap.set(item.node.id, {
          x: posX,
          y: item.y,
        });
      });
    } else {
      // TB Layout: Transformers sit in a row above the service node
      const gapY = 60;
      const minHorizontalGap = 20;

      const maxTransH = Math.max(
        ...transformers.map((t) => getNodeDimensions(t).height),
      );
      const targetY = servicePos.y - maxTransH - gapY;

      const items = transformers.map((tNode) => {
        const { width, height } = getNodeDimensions(tNode);
        return {
          node: tNode,
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
          y: targetY + (maxTransH - item.height) / 2,
        });
        startX += item.width + minHorizontalGap;
      });
    }
  });
}
