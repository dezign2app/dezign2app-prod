import { PageSection, UIEventItem } from "@workspace/canvas/types";
import {
  DeletionPageRenameTarget,
  NodeArchitectureImpact,
  CascadeElementInfo,
  BrokenReferenceInfo,
} from "../types";
import { SubItemSimulationContext, SubItemSimulationResult } from "./types";

export function handlePageRename(
  ctx: SubItemSimulationContext,
  target: DeletionPageRenameTarget,
): SubItemSimulationResult {
  const { nodes, endpoints, events, edges } = ctx;
  const parentNode = nodes.find((n) => n.id === target.nodeId);
  const oldLabel = target.oldLabel || parentNode?.data?.label || "Page";
  const newLabel = target.newLabel;

  const targetNodes: NodeArchitectureImpact["targetNodes"] = [
    {
      id: target.nodeId,
      label: `${oldLabel} → ${newLabel}`,
      type: "webPage",
      techStack: "Next.js Page",
    },
  ];

  // 1. Simulate canvas modification: update page label to newLabel
  const nextNodes = nodes.map((n) => {
    if (n.id === target.nodeId) {
      return {
        ...n,
        data: {
          ...n.data,
          label: newLabel,
        },
      };
    }
    return n;
  });

  const cascadeElements: CascadeElementInfo[] = [];
  const brokenReferences: BrokenReferenceInfo[] = [];

  // 2. Cascade check: page references connected to this page
  edges.forEach((e) => {
    if (e.target === target.nodeId || e.source === target.nodeId) {
      const otherId = e.source === target.nodeId ? e.target : e.source;
      const otherNode = nodes.find((n) => n.id === otherId);
      if (otherNode && otherNode.type === "page_ref") {
        cascadeElements.push({
          id: otherNode.id,
          label: otherNode.data?.label || "Page Reference",
          type: "page_ref",
          category: "ref",
          description: `Page reference pointing to "${oldLabel}" updated to "${newLabel}"`,
        });
      }
    }
  });

  // 3. Check actions in other pages navigating to this page
  nodes.forEach((n) => {
    if (n.id !== target.nodeId && n.type === "webPage") {
      const sections: PageSection[] = n.data?.sections || [];
      sections.forEach((sec) => {
        (sec.actions || []).forEach((act: UIEventItem) => {
          if (act.event === "navigateToPage" && act.targetPageId === target.nodeId) {
            brokenReferences.push({
              referencingNodeId: n.id,
              referencingNodeLabel: `${n.data?.label || "Page"} → ${act.name || "Action"}`,
              referencingNodeType: "webPage",
              referenceType: "Navigation Target",
              description: `Navigation action routing updated from "${oldLabel}" to "${newLabel}"`,
            });
          }
        });
      });
    }
  });

  return {
    nextNodes,
    nextEndpoints: [...endpoints],
    nextEvents: [...events],
    nextEdges: [...edges],
    targetNodes,
    severedConnections: [],
    cascadeElements,
    brokenReferences,
  };
}
