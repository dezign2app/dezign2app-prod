import { WebAppZone } from "@workspace/canvas/types";
import {
  DeletionZoneTarget,
  NodeArchitectureImpact,
} from "../types";
import { SubItemSimulationContext, SubItemSimulationResult } from "./types";

export function handleZoneDeletion(
  ctx: SubItemSimulationContext,
  target: DeletionZoneTarget,
): SubItemSimulationResult {
  const { nodes, endpoints, events, edges } = ctx;
  const parentNode = nodes.find((n) => n.id === target.nodeId);
  const appLabel = parentNode?.data?.label || "WebApp";
  const zoneName = target.zone.name || target.zone.route || "Zone";

  const targetNodes: NodeArchitectureImpact["targetNodes"] = [
    {
      id: target.nodeId,
      label: `${appLabel} → ${zoneName}`,
      type: "zone",
      techStack: "Access Zone",
    },
  ];

  const nextNodes = nodes.map((n) => {
    if (n.id === target.nodeId) {
      const zones: WebAppZone[] = n.data?.zones || [];
      const remainingZones = zones.filter((z) => z.id !== target.zone.id);
      return {
        ...n,
        data: {
          ...n.data,
          zones: remainingZones,
        },
      };
    }
    return n;
  });

  return {
    nextNodes,
    nextEndpoints: [...endpoints],
    nextEvents: [...events],
    nextEdges: [...edges],
    targetNodes,
    severedConnections: [],
    cascadeElements: [],
    brokenReferences: [],
  };
}
