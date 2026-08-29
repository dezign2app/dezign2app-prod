import {
  DeletionEndpointTarget,
  NodeArchitectureImpact,
} from "../types";
import { SubItemSimulationContext, SubItemSimulationResult } from "./types";

export function handleEndpointDeletion(
  ctx: SubItemSimulationContext,
  target: DeletionEndpointTarget,
): SubItemSimulationResult {
  const { nodes, endpoints, events, edges } = ctx;
  const parentNode = nodes.find((n) => n.id === target.nodeId);
  const serviceLabel = parentNode?.data?.label || "Service";

  const targetNodes: NodeArchitectureImpact["targetNodes"] = [
    {
      id: target.endpoint.id,
      label: `${serviceLabel} → ${target.endpoint.type || "GET"} ${target.endpoint.name}`,
      type: "endpoint",
      techStack: target.endpoint.type || "GET",
    },
  ];

  const nextEndpoints = endpoints.filter((ep) => ep.id !== target.endpoint.id);

  return {
    nextNodes: [...nodes],
    nextEndpoints,
    nextEvents: [...events],
    nextEdges: [...edges],
    targetNodes,
    severedConnections: [],
    cascadeElements: [],
    brokenReferences: [],
  };
}
