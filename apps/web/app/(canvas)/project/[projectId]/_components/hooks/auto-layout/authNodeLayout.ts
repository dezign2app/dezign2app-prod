import type { LayoutNode, LayoutEdge } from "./types";
import { getNodeDimensions } from "./nodeDimensions";

export interface AuthNodeLayoutParams {
  nodes: LayoutNode[];
  positionsMap: Map<string, { x: number; y: number }>;
  authEdges: LayoutEdge[];
  authNodes: LayoutNode[];
  isHorizontal?: boolean;
}

export const AUTH_WEBAPP_GAP = 200;

/**
 * Positions Better Auth nodes immediately behind (to the left in LR, above in TB)
 * of the connected WebApp node they provide authentication for.
 * Aligns their top Y coordinates so handles connect cleanly without jumping to the servers line.
 */
export function layoutAuthNodes({
  nodes,
  positionsMap,
  authEdges,
  authNodes,
  isHorizontal = true,
}: AuthNodeLayoutParams): void {
  if (authNodes.length === 0) return;

  // Map each auth node to the WebApp node(s) it connects to
  const webAppsByAuth = new Map<string, LayoutNode[]>();

  authNodes.forEach((authNode) => {
    const connectedWebAppIds = new Set<string>();

    // 1. Direct edge connections between Auth and WebApp
    authEdges.forEach((e) => {
      if (e.source === authNode.id) {
        const targetNode = nodes.find((n) => n.id === e.target);
        if (targetNode?.type === "webApp") {
          connectedWebAppIds.add(targetNode.id);
        }
      } else if (e.target === authNode.id) {
        const sourceNode = nodes.find((n) => n.id === e.source);
        if (sourceNode?.type === "webApp") {
          connectedWebAppIds.add(sourceNode.id);
        }
      }
    });

    // 2. WebApp data reference (authNodeId)
    nodes.forEach((n) => {
      if (
        n.type === "webApp" &&
        n.data &&
        typeof n.data === "object" &&
        "authNodeId" in n.data &&
        (n.data as any).authNodeId === authNode.id
      ) {
        connectedWebAppIds.add(n.id);
      }
    });

    const connectedWebApps = nodes.filter(
      (n) => n.type === "webApp" && connectedWebAppIds.has(n.id),
    );
    if (connectedWebApps.length > 0) {
      webAppsByAuth.set(authNode.id, connectedWebApps);
    }
  });

  // Group auth nodes by primary target WebApp so multiple auth nodes stack neatly
  const authByWebApp = new Map<string, LayoutNode[]>();
  webAppsByAuth.forEach((webApps, authId) => {
    const authNode = authNodes.find((n) => n.id === authId);
    if (!authNode) return;
    const primaryWebApp = webApps[0];
    if (!primaryWebApp) return;
    if (!authByWebApp.has(primaryWebApp.id)) {
      authByWebApp.set(primaryWebApp.id, []);
    }
    authByWebApp.get(primaryWebApp.id)!.push(authNode);
  });

  authByWebApp.forEach((authList, webAppId) => {
    const webAppPos = positionsMap.get(webAppId);
    if (!webAppPos) return;

    if (isHorizontal) {
      // In horizontal layout, position auth nodes immediately to the left of the webApp node
      let currentY = webAppPos.y;
      authList.forEach((authNode) => {
        const { width: aWidth, height: aHeight } = getNodeDimensions(authNode);
        const x = webAppPos.x - aWidth - AUTH_WEBAPP_GAP;
        const y = currentY;
        positionsMap.set(authNode.id, { x, y });
        currentY += aHeight + 20;
      });
    } else {
      // In vertical layout, position auth nodes immediately above the webApp node
      let currentX = webAppPos.x;
      authList.forEach((authNode) => {
        const { width: aWidth, height: aHeight } = getNodeDimensions(authNode);
        const x = currentX;
        const y = webAppPos.y - aHeight - AUTH_WEBAPP_GAP;
        positionsMap.set(authNode.id, { x, y });
        currentX += aWidth + 20;
      });
    }
  });
}
