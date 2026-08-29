import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";
import {
  DeletionIndexTarget,
  NodeArchitectureImpact,
  CascadeElementInfo,
} from "../types";
import { SubItemSimulationContext, SubItemSimulationResult } from "./types";

export function handleIndexDeletion(
  ctx: SubItemSimulationContext,
  target: DeletionIndexTarget,
): SubItemSimulationResult {
  const { nodes, endpoints, events, edges } = ctx;
  const parentNode = nodes.find((n) => n.id === target.nodeId);
  const tableLabel = parentNode?.data?.label || "Table";
  const indexName = target.indexItem.name;

  const targetNodes: NodeArchitectureImpact["targetNodes"] = [
    {
      id: target.nodeId,
      label: `${tableLabel} (${indexName})`,
      type: "index",
      dbEngine: parentNode?.data?.dbEngine || parentNode?.type,
      techStack: target.indexItem.isUnique ? "UNIQUE INDEX" : "INDEX",
    },
  ];

  // Remove index from table
  const nextNodes = nodes.map((n) => {
    if (n.id === target.nodeId) {
      const indexes: Array<{ name: string; columns: string; isUnique?: boolean }> =
        n.data?.indexes || [];
      const remainingIdxs = indexes.filter((idx) => idx.name !== indexName);
      return {
        ...n,
        data: {
          ...n.data,
          indexes: remainingIdxs,
        },
      };
    }
    return n;
  });

  const cascadeElements: CascadeElementInfo[] = [];

  // Affected fetchByIndex operations
  if (parentNode) {
    const dbOps = getEntityDbOperations(parentNode, nodes);
    dbOps.forEach((op) => {
      if (
        op.kind === "fetchByIndex" &&
        op.name.toLowerCase().includes(indexName.toLowerCase())
      ) {
        cascadeElements.push({
          id: op.id,
          label: `${tableLabel}.${op.name}`,
          type: "fetchByIndex",
          category: "step",
          description: `Index query function configured for index "${indexName}"`,
        });
      }
    });
  }

  return {
    nextNodes,
    nextEndpoints: [...endpoints],
    nextEvents: [...events],
    nextEdges: [...edges],
    targetNodes,
    severedConnections: [],
    cascadeElements,
    brokenReferences: [],
  };
}
