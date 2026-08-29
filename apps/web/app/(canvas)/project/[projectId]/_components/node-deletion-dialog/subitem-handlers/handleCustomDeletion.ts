import {
  DeletionGenericTarget,
  NodeArchitectureImpact,
} from "../types";
import { SubItemSimulationContext, SubItemSimulationResult } from "./types";

export function handleCustomDeletion(
  ctx: SubItemSimulationContext,
  target: DeletionGenericTarget,
): SubItemSimulationResult {
  const { nodes, endpoints, events, edges } = ctx;

  const targetNodes: NodeArchitectureImpact["targetNodes"] = [
    {
      id: target.nodeId || "custom",
      label: target.itemLabel || "Item",
      type: target.itemType || "item",
    },
  ];

  return {
    nextNodes: [...nodes],
    nextEndpoints: [...endpoints],
    nextEvents: [...events],
    nextEdges: [...edges],
    targetNodes,
    severedConnections: [],
    cascadeElements: [],
    brokenReferences: [],
  };
}
