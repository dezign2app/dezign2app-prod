import { PageSection } from "@workspace/canvas/types";
import {
  DeletionSectionTarget,
  NodeArchitectureImpact,
} from "../types";
import { SubItemSimulationContext, SubItemSimulationResult } from "./types";

export function handleSectionDeletion(
  ctx: SubItemSimulationContext,
  target: DeletionSectionTarget,
): SubItemSimulationResult {
  const { nodes, endpoints, events, edges } = ctx;
  const parentNode = nodes.find((n) => n.id === target.nodeId);
  const pageLabel = parentNode?.data?.label || "Page";
  const sectionName = target.section.name || target.section.title || "Section";

  const targetNodes: NodeArchitectureImpact["targetNodes"] = [
    {
      id: target.nodeId,
      label: `${pageLabel} → ${sectionName}`,
      type: "section",
      techStack: target.section.type || "Section",
    },
  ];

  const nextNodes = nodes.map((n) => {
    if (n.id === target.nodeId) {
      const sections: PageSection[] = n.data?.sections || [];
      const remainingSections = sections.filter((s) => s.id !== target.section.id);
      return {
        ...n,
        data: {
          ...n.data,
          sections: remainingSections,
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
