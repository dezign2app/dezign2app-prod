import { BackendEdge } from "@/types/canvas";
import { EdgeCleanupContext } from "../types";

/**
 * Handles edge cleanup between WebApp nodes and Auth nodes,
 * clearing authNodeId if disconnected.
 */
export function cleanAuthEdge(
  edge: BackendEdge,
  ctx: EdgeCleanupContext,
): void {
  const srcNode = ctx.currentState.nodes.find((n) => n.id === edge.source);
  const tgtNode = ctx.currentState.nodes.find((n) => n.id === edge.target);
  const webAppNode =
    srcNode?.type === "webApp"
      ? srcNode
      : tgtNode?.type === "webApp"
        ? tgtNode
        : null;
  const authNode =
    srcNode?.type === "auth"
      ? srcNode
      : tgtNode?.type === "auth"
        ? tgtNode
        : null;

  if (webAppNode && authNode && webAppNode.data?.authNodeId === authNode.id) {
    const stillConnected = ctx.nextEdges.some(
      (e) =>
        e &&
        ((e.source === webAppNode.id && e.target === authNode.id) ||
          (e.target === webAppNode.id && e.source === authNode.id)),
    );
    if (!stillConnected) {
      ctx.nodesChanged = true;
      const updatedNode = {
        ...webAppNode,
        data: { ...webAppNode.data, authNodeId: undefined },
      };
      ctx.nextNodes = ctx.nextNodes.map((n) =>
        n.id === webAppNode.id ? updatedNode : n,
      );
      ctx.pendingNodeUpserts.push(updatedNode);
    }
  }
}
