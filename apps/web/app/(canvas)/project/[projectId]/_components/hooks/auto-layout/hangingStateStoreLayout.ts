import type { LayoutNode, LayoutEdge } from "./types";
import { getNodeDimensions } from "./nodeDimensions";

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

export const STATE_STORE_WEBAPP_GAP = 50;
export const STATE_STORE_VERTICAL_GAP = 30;

/**
 * Positions StateStore nodes (Zustand state stores) directly on top of the WebApp node
 * in the same column where only WebApp stays.
 *
 * If multiple StateStore nodes exist, they stack vertically above the WebApp node.
 * If no WebApp node exists, falls back gracefully to placing above the connected WebPage node.
 */
export function layoutHangingStateStoreNodes({
  nodes,
  positionsMap,
  hangingStateStoreEdges,
  hangingStateStoreNodes,
  isHorizontal = true,
}: HangingStateStoreLayoutParams): void {
  if (hangingStateStoreNodes.length === 0) return;

  const webAppNodes = nodes.filter((n) => n.type === "webApp");

  if (webAppNodes.length > 0) {
    // Map each store to its matching webApp (if multiple webApps, match via page connection or default to first)
    const storesByWebApp = new Map<string, LayoutNode[]>();
    webAppNodes.forEach((w) => storesByWebApp.set(w.id, []));

    hangingStateStoreNodes.forEach((storeNode) => {
      // Find connected webPage
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

      if (!targetPageId && storeNode.data && typeof storeNode.data === "object" && "targetPageId" in storeNode.data) {
        const candidateId = (storeNode.data as any).targetPageId;
        if (candidateId && nodes.some((n) => n.id === candidateId && n.type === "webPage")) {
          targetPageId = candidateId;
        }
      }

      // Check if target page is associated with a specific webApp
      let matchedWebApp = webAppNodes[0]!;
      if (targetPageId) {
        const parentWebApp = webAppNodes.find((w) => {
          if (!w.data || typeof w.data !== "object") return false;
          const zones = Array.isArray((w.data as any).zones) ? (w.data as any).zones : [];
          return zones.some((z: any) => {
            const page = nodes.find((n) => n.id === targetPageId);
            return (
              (page?.data as any)?.zoneId === z.id ||
              (page?.data as any)?.zoneName === z.name
            );
          });
        });
        if (parentWebApp) {
          matchedWebApp = parentWebApp;
        }
      }

      storesByWebApp.get(matchedWebApp.id)?.push(storeNode);
    });

    // Layout stores on top of each webApp
    storesByWebApp.forEach((stores, webAppId) => {
      if (stores.length === 0) return;
      const webAppNode = webAppNodes.find((w) => w.id === webAppId);
      const webAppPos = positionsMap.get(webAppId);
      if (!webAppNode || !webAppPos) return;

      const { width: webAppW } = getNodeDimensions(webAppNode);

      // Stable sort: by label / storeName / id
      stores.sort((a, b) => {
        const nameA = (a.data?.label || (a.data as any)?.storeName || a.id) as string;
        const nameB = (b.data?.label || (b.data as any)?.storeName || b.id) as string;
        return nameA.localeCompare(nameB);
      });

      // Stack vertically directly on top of the webApp node:
      // Store 1 is closest above webApp, Store 2 above Store 1, etc.
      let currentBottomY = webAppPos.y - STATE_STORE_WEBAPP_GAP;

      for (let i = stores.length - 1; i >= 0; i--) {
        const storeNode = stores[i]!;
        const { width: storeW, height: storeH } = getNodeDimensions(storeNode);
        const posX = webAppPos.x + Math.round((webAppW - storeW) / 2);
        const posY = currentBottomY - storeH;

        positionsMap.set(storeNode.id, {
          x: posX,
          y: posY,
        });

        currentBottomY = posY - STATE_STORE_VERTICAL_GAP;
      }
    });

    return;
  }

  // Fallback: If no WebApp node exists on the canvas (e.g. standalone page + store),
  // place StateStore node on top of its connected WebPage node.
  hangingStateStoreNodes.forEach((storeNode, idx) => {
    const edge = hangingStateStoreEdges.find(
      (e) =>
        (e.source === storeNode.id && nodes.find((n) => n.id === e.target)?.type === "webPage") ||
        (e.target === storeNode.id && nodes.find((n) => n.id === e.source)?.type === "webPage"),
    );
    const targetPageId = edge
      ? edge.source === storeNode.id
        ? edge.target
        : edge.source
      : undefined;

    const pageNode = nodes.find((n) => n.id === targetPageId);
    const pagePos = targetPageId ? positionsMap.get(targetPageId) : undefined;

    const { width: storeW, height: storeH } = getNodeDimensions(storeNode);

    if (pageNode && pagePos) {
      const { width: pageW } = getNodeDimensions(pageNode);
      const posX = pagePos.x + Math.round((pageW - storeW) / 2);
      const posY = pagePos.y - STATE_STORE_WEBAPP_GAP - (idx + 1) * (storeH + STATE_STORE_VERTICAL_GAP);
      positionsMap.set(storeNode.id, { x: posX, y: posY });
    } else {
      // Unattached store without webApp or page
      let maxX = 60;
      let maxY = 60;
      positionsMap.forEach((pos) => {
        if (pos.x > maxX) maxX = pos.x;
        if (pos.y > maxY) maxY = pos.y;
      });
      positionsMap.set(storeNode.id, {
        x: 60 + idx * (storeW + 30),
        y: 60,
      });
    }
  });
}
