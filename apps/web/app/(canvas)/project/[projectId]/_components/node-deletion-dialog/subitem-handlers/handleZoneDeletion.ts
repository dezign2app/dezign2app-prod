import { WebAppZone } from "@workspace/canvas/types";
import {
  DeletionZoneTarget,
  NodeArchitectureImpact,
} from "../types";
import { SubItemSimulationContext, SubItemSimulationResult } from "./types";

function getDescendantZoneIds(rootZoneId: string, zones: WebAppZone[]): Set<string> {
  const ids = new Set<string>([rootZoneId]);
  let added = true;
  while (added) {
    added = false;
    for (const z of zones) {
      if (z.parentId && ids.has(z.parentId) && !ids.has(z.id)) {
        ids.add(z.id);
        added = true;
      }
    }
  }
  return ids;
}

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
      const idsToDelete = getDescendantZoneIds(target.zone.id, zones);
      const remainingZones = zones.filter((z) => !idsToDelete.has(z.id));
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
