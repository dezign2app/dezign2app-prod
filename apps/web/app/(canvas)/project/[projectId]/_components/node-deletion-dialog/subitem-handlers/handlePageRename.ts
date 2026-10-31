import { PageSection, UIEventItem } from "@workspace/canvas/types";
import { pageRouteToUrl, pageRouteToFolderPath, arePageRoutesEqual } from "@workspace/canvas";
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
  const oldPath = pageRouteToUrl(oldLabel);
  const newPath = pageRouteToUrl(newLabel);
  const newSlug = pageRouteToFolderPath(newLabel);

  const targetNodes: NodeArchitectureImpact["targetNodes"] = [
    {
      id: target.nodeId,
      label: `${oldLabel} → ${newLabel}`,
      type: "webPage",
      techStack: "Next.js Page",
    },
  ];

  const cascadeElements: CascadeElementInfo[] = [];
  const brokenReferences: BrokenReferenceInfo[] = [];

  // 1. Simulate canvas modification: update page label, path, pageSlug, route
  const nextNodes = nodes.map((n) => {
    if (n.id === target.nodeId) {
      return {
        ...n,
        data: {
          ...n.data,
          label: newLabel,
          path: newPath,
          pageSlug: newSlug,
          route: newPath,
        },
      };
    }

    // Cascade to Auth nodes referencing this page via nodeId or old route path
    if (n.type === "auth" && n.data?.redirects) {
      const r = { ...n.data.redirects };
      let changed = false;
      if (r.signInPageNodeId === target.nodeId || (oldPath && arePageRoutesEqual(r.signInPageUrl || "", oldPath))) {
        r.signInPageUrl = newPath;
        r.signInPageNodeId = target.nodeId;
        changed = true;
      }
      if (r.signUpPageNodeId === target.nodeId || (oldPath && arePageRoutesEqual(r.signUpPageUrl || "", oldPath))) {
        r.signUpPageUrl = newPath;
        r.signUpPageNodeId = target.nodeId;
        changed = true;
      }
      if (r.signInRedirectNodeId === target.nodeId || (oldPath && arePageRoutesEqual(r.signInRedirectUrl || "", oldPath))) {
        r.signInRedirectUrl = newPath;
        r.signInRedirectNodeId = target.nodeId;
        changed = true;
      }
      if (r.signUpRedirectNodeId === target.nodeId || (oldPath && arePageRoutesEqual(r.signUpRedirectUrl || "", oldPath))) {
        r.signUpRedirectUrl = newPath;
        r.signUpRedirectNodeId = target.nodeId;
        changed = true;
      }
      if (r.signOutRedirectNodeId === target.nodeId || (oldPath && arePageRoutesEqual(r.signOutRedirectUrl || "", oldPath))) {
        r.signOutRedirectUrl = newPath;
        r.signOutRedirectNodeId = target.nodeId;
        changed = true;
      }
      if (r.unauthorizedNodeId === target.nodeId || (oldPath && arePageRoutesEqual(r.unauthorizedUrl || "", oldPath))) {
        r.unauthorizedUrl = newPath;
        r.unauthorizedNodeId = target.nodeId;
        changed = true;
      }
      if (r.pricingNodeId === target.nodeId || (oldPath && arePageRoutesEqual(r.pricingUrl || "", oldPath))) {
        r.pricingUrl = newPath;
        r.pricingNodeId = target.nodeId;
        changed = true;
      }

      if (changed) {
        cascadeElements.push({
          id: n.id,
          label: `${n.data?.label || "Auth"} → Redirects`,
          type: "auth",
          category: "ref",
          description: `Auth redirect updated from "${oldPath}" to "${newPath}"`,
        });
        return {
          ...n,
          data: {
            ...n.data,
            redirects: r,
          },
        };
      }
    }

    return n;
  });

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
