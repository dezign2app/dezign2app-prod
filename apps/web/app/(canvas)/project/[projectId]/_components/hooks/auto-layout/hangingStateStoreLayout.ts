import type { LayoutNode, LayoutEdge } from "./types";
import { getNodeDimensions, getHandleYRatio } from "./nodeDimensions";

export interface HangingStateStoreLayoutParams {
  nodes: LayoutNode[];
  positionsMap: Map<string, { x: number; y: number }>;
  hangingStateStoreEdges: LayoutEdge[];
  hangingStateStoreNodes: LayoutNode[];
  isHorizontal?: boolean;
  stackedZonesList?: Array<{
    leadPage: LayoutNode;
    sortedPages: LayoutNode[];
  }>;
}

/**
 * Positions hanging StateStore nodes (Zustand state stores)
 * in a dedicated column immediately preceding (to the left of) the WebPage node they connect to.
 * This prevents StateStore nodes from being aligned with the WebApp node in the root rank.
 */
export function layoutHangingStateStoreNodes({
  nodes,
  positionsMap,
  hangingStateStoreEdges,
  hangingStateStoreNodes,
  isHorizontal = true,
  stackedZonesList = [],
}: HangingStateStoreLayoutParams): void {
  if (hangingStateStoreNodes.length === 0) return;

  // Group hanging StateStore nodes by their connected target WebPage node ID
  const storesByWebPage = new Map<string, LayoutNode[]>();
  const unattachedStores: LayoutNode[] = [];

  hangingStateStoreNodes.forEach((storeNode) => {
    // 1. Direct edge connection to a webPage node
    const edge = hangingStateStoreEdges.find(
      (e) =>
        (e.source === storeNode.id && nodes.find((n) => n.id === e.target)?.type === "webPage") ||
        (e.target === storeNode.id && nodes.find((n) => n.id === e.source)?.type === "webPage"),
    );

    let targetPageId = edge
      ? edge.source === storeNode.id
        ? edge.target
        : edge.source
      : undefined;

    // 2. Fallback: check storeNode.data?.targetPageId
    if (!targetPageId && storeNode.data && typeof storeNode.data === "object" && "targetPageId" in storeNode.data) {
      const candidateId = (storeNode.data as any).targetPageId;
      if (candidateId && nodes.some((n) => n.id === candidateId && n.type === "webPage")) {
        targetPageId = candidateId;
      }
    }

    // 3. Fallback: check if any WebPage has section actions bound to this store
    if (!targetPageId) {
      const pageWithBinding = nodes.find((n) => {
        if (n.type !== "webPage" || !n.data || typeof n.data !== "object") return false;
        const sections = Array.isArray((n.data as any).sections) ? (n.data as any).sections : [];
        return sections.some((sec: any) =>
          Array.isArray(sec.actions) &&
          sec.actions.some((a: any) => a.storeActionBinding?.storeNodeId === storeNode.id),
        );
      });
      if (pageWithBinding) {
        targetPageId = pageWithBinding.id;
      }
    }

    if (!targetPageId) {
      unattachedStores.push(storeNode);
      return;
    }

    if (!storesByWebPage.has(targetPageId)) {
      storesByWebPage.set(targetPageId, []);
    }
    storesByWebPage.get(targetPageId)!.push(storeNode);
  });

  storesByWebPage.forEach((stores, pageId) => {
    const pageNode = nodes.find((n) => n.id === pageId);
    const pagePos = positionsMap.get(pageId);
    if (!pageNode || !pagePos) return;

    // If the target WebPage is part of a Hand-of-Cards stack, find the stack's leftmost boundary
    const stack = stackedZonesList.find((st) =>
      st.sortedPages.some((p) => p.id === pageId),
    );
    const leadPos = stack ? positionsMap.get(stack.leadPage.id) : undefined;
    // leadPos.x is the minimum / leftmost X coordinate of all cards in the stack
    const stackLeftX = leadPos ? leadPos.x : pagePos.x;

    const { width: pageW, height: pageH } = getNodeDimensions(pageNode);

    if (isHorizontal) {
      // LR Layout: State stores sit in a dedicated column immediately to the left of the WebPage (or WebPage stack)
      const gapX = 80;
      const minVerticalGap = 16;

      const maxStoreW = Math.max(
        ...stores.map((s) => getNodeDimensions(s).width),
      );

      // Find the rightmost edge of any node strictly to the left of this page/stack (e.g. WebApp node)
      let maxPrecedingRight = -Infinity;
      positionsMap.forEach((pos, id) => {
        if (
          id === pageId ||
          stack?.sortedPages.some((p) => p.id === id) ||
          stores.some((s) => s.id === id)
        ) {
          return;
        }
        const otherNode = nodes.find((n) => n.id === id);
        if (!otherNode) return;
        const { width: otherW } = getNodeDimensions(otherNode);
        const otherRight = pos.x + otherW;
        if (otherRight <= stackLeftX && otherRight > maxPrecedingRight) {
          maxPrecedingRight = otherRight;
        }
      });

      let effectiveStackLeftX = stackLeftX;
      const minPrecedingGap = 60;
      if (maxPrecedingRight !== -Infinity) {
        const minRequiredStackX = maxPrecedingRight + minPrecedingGap + maxStoreW + gapX;
        if (effectiveStackLeftX < minRequiredStackX) {
          const shiftX = minRequiredStackX - effectiveStackLeftX;
          effectiveStackLeftX = minRequiredStackX;

          // Shift all pages in this stack (or this page) rightward
          const pagesToShift = stack ? stack.sortedPages : [pageNode];
          const shiftedIdSet = new Set(pagesToShift.map((p) => p.id));
          pagesToShift.forEach((p) => {
            const currentPos = positionsMap.get(p.id);
            if (currentPos) {
              positionsMap.set(p.id, {
                ...currentPos,
                x: currentPos.x + shiftX,
              });
            }
          });

          // Also shift any downstream nodes that were placed at or to the right of stackLeftX
          positionsMap.forEach((pos, id) => {
            if (
              !shiftedIdSet.has(id) &&
              !stores.some((s) => s.id === id) &&
              pos.x >= stackLeftX
            ) {
              positionsMap.set(id, {
                ...pos,
                x: pos.x + shiftX,
              });
            }
          });
        }
      }

      const targetX = effectiveStackLeftX - maxStoreW - gapX;

      interface StoreItem {
        node: LayoutNode;
        width: number;
        height: number;
        idealY: number;
        y: number;
      }

      const items: StoreItem[] = stores.map((storeNode) => {
        const { width, height } = getNodeDimensions(storeNode);
        const edge = hangingStateStoreEdges.find(
          (e) =>
            (e.source === storeNode.id && e.target === pageId) ||
            (e.source === pageId && e.target === storeNode.id),
        );

        const pageHandle =
          edge?.source === pageId ? edge?.sourceHandle : edge?.targetHandle;
        const storeHandle =
          edge?.source === storeNode.id ? edge?.sourceHandle : edge?.targetHandle;

        const pageHandleRatio = getHandleYRatio(pageNode, pageHandle);
        const storeHandleRatio = getHandleYRatio(storeNode, storeHandle);

        const targetHandleY = pagePos.y + pageHandleRatio * pageH;
        const storeHandleOffset = storeHandleRatio * height;
        const idealY = targetHandleY - storeHandleOffset;

        return {
          node: storeNode,
          width,
          height,
          idealY,
          y: idealY,
        };
      });

      // Sort by ideal Y
      items.sort((a, b) => a.idealY - b.idealY);

      // Relax / resolve collisions so no state store nodes overlap
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
        const posX = targetX + (maxStoreW - item.width) / 2;
        positionsMap.set(item.node.id, {
          x: posX,
          y: item.y,
        });
      });
    } else {
      // TB Layout: State store nodes sit in a row above the WebPage node
      const gapY = 60;
      const minHorizontalGap = 20;

      const maxStoreH = Math.max(
        ...stores.map((s) => getNodeDimensions(s).height),
      );
      const targetY = pagePos.y - maxStoreH - gapY;

      const items = stores.map((sNode) => {
        const { width, height } = getNodeDimensions(sNode);
        return {
          node: sNode,
          width,
          height,
          x: pagePos.x + pageW / 2 - width / 2,
        };
      });

      const totalW =
        items.reduce((s, it) => s + it.width, 0) +
        (items.length - 1) * minHorizontalGap;
      let startX = pagePos.x + pageW / 2 - totalW / 2;

      items.forEach((item) => {
        positionsMap.set(item.node.id, {
          x: startX,
          y: targetY + (maxStoreH - item.height) / 2,
        });
        startX += item.width + minHorizontalGap;
      });
    }
  });

  // If there are unattached StateStore nodes, place them gracefully
  if (unattachedStores.length > 0) {
    let maxY = 0;
    let maxX = 0;
    positionsMap.forEach((pos) => {
      if (pos.y > maxY) maxY = pos.y;
      if (pos.x > maxX) maxX = pos.x;
    });

    unattachedStores.forEach((node, idx) => {
      if (!positionsMap.has(node.id)) {
        if (node.position && (node.position.x !== 0 || node.position.y !== 0)) {
          positionsMap.set(node.id, {
            x: node.position.x,
            y: node.position.y,
          });
        } else {
          positionsMap.set(node.id, {
            x: isHorizontal ? maxX + 80 : 80 + idx * 280,
            y: isHorizontal ? 80 + idx * 260 : maxY + 80,
          });
        }
      }
    });
  }
}
