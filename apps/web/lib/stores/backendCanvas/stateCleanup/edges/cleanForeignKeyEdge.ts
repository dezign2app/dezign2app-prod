import { BackendEdge } from "@/types/canvas";
import { EdgeCleanupContext } from "../types";

/**
 * Handles edge cleanup for foreign key edges, resetting column isForeignKey
 * and references when disconnected.
 */
export function cleanForeignKeyEdge(
  edge: BackendEdge,
  ctx: EdgeCleanupContext,
): void {
  if (edge.type !== "foreign-key") return;

  const handleNodes = [
    { nodeId: edge.source, handleId: edge.sourceHandle },
    { nodeId: edge.target, handleId: edge.targetHandle },
  ];

  handleNodes.forEach(({ nodeId, handleId }) => {
    if (!handleId) return;
    const match = handleId.match(/^(?:source|target)-(\d+)$/);
    if (!match) return;
    const colIdx = parseInt(match[1]!, 10);

    const stillConnected = ctx.nextEdges.some(
      (e) =>
        e &&
        ((e.source === nodeId &&
          (e.sourceHandle === handleId || e.targetHandle === handleId)) ||
          (e.target === nodeId &&
            (e.sourceHandle === handleId || e.targetHandle === handleId))),
    );

    if (!stillConnected) {
      const targetNode = ctx.nextNodes.find((n) => n.id === nodeId);
      if (
        targetNode &&
        targetNode.type === "entity" &&
        targetNode.data?.columns
      ) {
        const cols = targetNode.data.columns;
        if (
          cols[colIdx] &&
          (cols[colIdx].isForeignKey || cols[colIdx].references)
        ) {
          ctx.nodesChanged = true;
          const newCols = [...cols];
          const oldCol = newCols[colIdx]!;
          newCols[colIdx] = {
            ...oldCol,
            isForeignKey: false,
            references: undefined,
          };
          const updatedNode = {
            ...targetNode,
            data: { ...targetNode.data, columns: newCols },
          };
          ctx.nextNodes = ctx.nextNodes.map((n) =>
            n.id === nodeId ? updatedNode : n,
          );
          ctx.pendingNodeUpserts.push(updatedNode);
        }
      }
    }
  });
}
