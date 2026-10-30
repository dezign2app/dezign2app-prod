import { BackendEdge } from "@/types/canvas";
import { EdgeCleanupContext } from "../types";

/**
 * Handles edge cleanup for StateStore connections, including section-state-in
 * subscriptions / type references and store-field-in type references.
 */
export function cleanStateStoreEdge(
  edge: BackendEdge,
  ctx: EdgeCleanupContext,
): void {
  // 1. State Store <-> WebPage Section State Subscription cleanup
  if (edge.targetHandle?.startsWith("section-state-in-")) {
    const isTypeEdge =
      edge.type === "type-reference" ||
      edge.sourceHandle?.startsWith("type-out-") ||
      Boolean(edge.data?.isTypeReference);

    const pageNode = ctx.nextNodes.find((n) => n.id === edge.target);
    if (pageNode?.data?.sections && Array.isArray(pageNode.data.sections)) {
      let pageChanged = false;
      const newSections = pageNode.data.sections.map((section) => {
        const prefix = `section-state-in-${section.id}-`;
        if (!edge.targetHandle?.startsWith(prefix)) return section;

        const stateId = edge.targetHandle.slice(prefix.length);
        if (!section.stateObjects || !Array.isArray(section.stateObjects)) {
          return section;
        }

        if (isTypeEdge) {
          // Disconnected custom type from state object - reset type to primitive/any
          const updatedStates = section.stateObjects.map((st) => {
            if (st.id === stateId) {
              const isArray = st.type?.endsWith("[]");
              return { ...st, type: isArray ? "any[]" : "any" };
            }
            return st;
          });
          pageChanged = true;
          return { ...section, stateObjects: updatedStates };
        } else {
          // Disconnected store state subscription edge - remove state object from section
          const remainingStates = section.stateObjects.filter(
            (st) => st.id !== stateId,
          );
          if (remainingStates.length !== section.stateObjects.length) {
            pageChanged = true;
            return { ...section, stateObjects: remainingStates };
          }
        }
        return section;
      });

      if (pageChanged) {
        ctx.nodesChanged = true;
        const updatedPage = {
          ...pageNode,
          data: { ...pageNode.data, sections: newSections },
        };
        ctx.nextNodes = ctx.nextNodes.map((n) =>
          n.id === pageNode.id ? updatedPage : n,
        );
        ctx.pendingNodeUpserts.push(updatedPage);
      }
    }
  }

  // 2. Types Node -> State Store Field Type Reference cleanup
  if (edge.targetHandle?.startsWith("store-field-in-")) {
    const fieldId = edge.targetHandle.replace("store-field-in-", "");
    const storeNode = ctx.nextNodes.find((n) => n.id === edge.target);
    if (storeNode?.data?.fields && Array.isArray(storeNode.data.fields)) {
      let storeChanged = false;
      const newFields = storeNode.data.fields.map((f) => {
        if (f.id === fieldId) {
          storeChanged = true;
          const isArray = f.isArray || f.type?.endsWith("[]");
          return {
            ...f,
            type: isArray ? "any[]" : "any",
          };
        }
        return f;
      });

      if (storeChanged) {
        ctx.nodesChanged = true;
        const updatedStore = {
          ...storeNode,
          data: { ...storeNode.data, fields: newFields },
        };
        ctx.nextNodes = ctx.nextNodes.map((n) =>
          n.id === storeNode.id ? updatedStore : n,
        );
        ctx.pendingNodeUpserts.push(updatedStore);
      }
    }
  }
}
