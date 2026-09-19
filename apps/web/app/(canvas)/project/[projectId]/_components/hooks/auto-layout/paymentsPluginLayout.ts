import type { LayoutNode, LayoutEdge } from "./types";
import { getNodeDimensions } from "./nodeDimensions";

export interface PaymentsPluginLayoutParams {
  nodes: LayoutNode[];
  positionsMap: Map<string, { x: number; y: number }>;
  paymentsPluginEdges: LayoutEdge[];
  paymentsPluginNodes: LayoutNode[];
  isHorizontal?: boolean;
}

export const PAYMENTS_PLUGIN_GAP = 80;

/**
 * Positions Creem Payments nodes in a dedicated plugin position
 * immediately preceding (to the left of) the Better Auth node they are injected into.
 * Aligns their tops so handles (injects-plugin-out and payments-plugin-in, both at top: 18px)
 * connect with a straight, crisp horizontal edge.
 */
export function layoutPaymentsPluginNodes({
  nodes,
  positionsMap,
  paymentsPluginEdges,
  paymentsPluginNodes,
  isHorizontal = true,
}: PaymentsPluginLayoutParams): void {
  if (paymentsPluginNodes.length === 0) return;

  // Group payments plugin nodes by their target auth node
  const paymentsByAuth = new Map<string, LayoutNode[]>();

  paymentsPluginNodes.forEach((pNode) => {
    const edge = paymentsPluginEdges.find(
      (e) =>
        (e.source === pNode.id && nodes.find((n) => n.id === e.target)?.type === "auth") ||
        (e.target === pNode.id && nodes.find((n) => n.id === e.source)?.type === "auth"),
    );
    if (!edge) return;
    const authId = edge.source === pNode.id ? edge.target : edge.source;
    if (!paymentsByAuth.has(authId)) {
      paymentsByAuth.set(authId, []);
    }
    paymentsByAuth.get(authId)!.push(pNode);
  });

  paymentsByAuth.forEach((paymentsList, authId) => {
    const authNode = nodes.find((n) => n.id === authId);
    const authPos = positionsMap.get(authId);
    if (!authNode || !authPos) return;

    if (isHorizontal) {
      // In horizontal layout, position payments nodes immediately to the left of the auth node
      let currentY = authPos.y;
      paymentsList.forEach((pNode) => {
        const { width: pWidth, height: pHeight } = getNodeDimensions(pNode);
        const x = authPos.x - pWidth - PAYMENTS_PLUGIN_GAP;
        const y = currentY;
        positionsMap.set(pNode.id, { x, y });
        currentY += pHeight + 20;
      });
    } else {
      // In vertical layout, position payments nodes immediately above the auth node
      let currentX = authPos.x;
      paymentsList.forEach((pNode) => {
        const { width: pWidth, height: pHeight } = getNodeDimensions(pNode);
        const x = currentX;
        const y = authPos.y - pHeight - PAYMENTS_PLUGIN_GAP;
        positionsMap.set(pNode.id, { x, y });
        currentX += pWidth + 20;
      });
    }
  });
}
