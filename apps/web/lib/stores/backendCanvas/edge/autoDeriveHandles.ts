import { BackendEdge, BackendNode } from "@/types/canvas";

/**
 * When AI or external tool creates a foreign-key edge (via addEdge) without setting
 * sourceHandle / targetHandle, ReactFlow falls back to the default handle.
 * Auto-derive column handles here from primary key on source node and foreign key on target node.
 */
export function autoDeriveForeignKeyHandles<T extends Partial<BackendEdge>>(
  edge: T,
  nodes: BackendNode[],
): T {
  if (
    edge.type === "foreign-key" &&
    (!edge.sourceHandle || !edge.targetHandle)
  ) {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);

    if (
      sourceNode?.type === "entity" &&
      targetNode?.type === "entity" &&
      sourceNode.data.columns &&
      targetNode.data.columns
    ) {
      // Find the PK column on the source node
      const pkIdx = sourceNode.data.columns.findIndex(
        (c) => c.isPrimaryKey,
      );
      // Find the FK column on the target node that references the source table
      const fkIdx = targetNode.data.columns.findIndex(
        (c) =>
          c.isForeignKey &&
          c.references?.table === sourceNode.data.label,
      );

      if (pkIdx !== -1) {
        return {
          ...edge,
          sourceHandle: `source-${pkIdx}`,
          // Only set targetHandle if we found a matching FK column
          targetHandle: fkIdx !== -1 ? `target-${fkIdx}` : edge.targetHandle,
        };
      }
    }
  }

  return edge;
}
