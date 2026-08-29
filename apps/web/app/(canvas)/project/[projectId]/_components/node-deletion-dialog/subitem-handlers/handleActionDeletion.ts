import { PageSection } from "@workspace/canvas/types";
import {
  DeletionActionTarget,
  NodeArchitectureImpact,
  SeveredConnectionInfo,
  CascadeElementInfo,
} from "../types";
import { SubItemSimulationContext, SubItemSimulationResult } from "./types";

export function handleActionDeletion(
  ctx: SubItemSimulationContext,
  target: DeletionActionTarget,
): SubItemSimulationResult {
  const { nodes, endpoints, events, edges } = ctx;
  const parentNode = nodes.find((n) => n.id === target.nodeId);
  const pageLabel = parentNode?.data?.label || "Page";
  const actionName = target.action.name || target.action.event || "Action";

  const targetNodes: NodeArchitectureImpact["targetNodes"] = [
    {
      id: target.action.id,
      label: `${pageLabel} → ${actionName}`,
      type: "action",
      techStack: target.action.event || "click",
    },
  ];

  // 1. Simulate canvas modification: remove action from sections
  let nextNodes = nodes.map((n) => {
    if (n.id === target.nodeId) {
      const sections: PageSection[] = n.data?.sections || [];
      const updatedSections = sections.map((sec) => ({
        ...sec,
        actions: (sec.actions || []).filter((act) => act.id !== target.action.id),
      }));
      return {
        ...n,
        data: {
          ...n.data,
          sections: updatedSections,
        },
      };
    }
    return n;
  });

  const severedConnections: SeveredConnectionInfo[] = [];
  const cascadeElements: CascadeElementInfo[] = [];

  // 2. Severed connections originating from this action's handle
  const actionHandle = `events-${target.action.id}`;
  edges.forEach((e) => {
    if (e.source === target.nodeId && e.sourceHandle === actionHandle) {
      const targetNode = nodes.find((n) => n.id === e.target);
      severedConnections.push({
        edgeId: e.id,
        edgeType: e.type,
        sourceNodeId: e.source,
        sourceNodeLabel: `${pageLabel} (${actionName})`,
        sourceNodeType: "webPage",
        targetNodeId: e.target,
        targetNodeLabel: targetNode?.data?.label || "Target",
        targetNodeType: targetNode?.type || "node",
        otherNodeId: targetNode?.id || "",
        otherNodeLabel: targetNode?.data?.label || "Node",
        otherNodeType: targetNode?.type || "node",
        direction: "outgoing",
        description: `Severed event trigger connection to "${targetNode?.data?.label || "Target"}"`,
      });

      // 3. Cascade check: if connected to page_ref with no other incoming edges
      if (targetNode && targetNode.type === "page_ref") {
        const remainingEdges = edges.filter(
          (edge) => edge.target === targetNode.id && edge.id !== e.id,
        );
        if (remainingEdges.length === 0) {
          cascadeElements.push({
            id: targetNode.id,
            label: targetNode.data?.label || "Page Reference",
            type: "page_ref",
            category: "ref",
            description: `Orphaned page navigation reference node "${targetNode.data?.label || "Page Reference"}"`,
          });
          nextNodes = nextNodes.filter((n) => n.id !== targetNode.id);
        }
      }
    }
  });

  return {
    nextNodes,
    nextEndpoints: [...endpoints],
    nextEvents: [...events],
    nextEdges: [...edges],
    targetNodes,
    severedConnections,
    cascadeElements,
    brokenReferences: [],
  };
}
