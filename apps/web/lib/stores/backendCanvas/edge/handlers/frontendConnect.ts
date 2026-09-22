import { BackendNode } from "@/types/canvas";
import { generateKeyBetween } from "fractional-indexing";
import { getLastIndex } from "../../utils";
import { ConnectionContext } from "../types";

/**
 * Handles frontend Hook and Component connections to WebPages, Endpoints, or each other.
 * For global hooks/components: ensures 1 ref node per target page, links edges, and prevents tangles.
 *
 * @returns boolean `true` if direct edge was intercepted and handled, `false` otherwise.
 */
export function handleFrontendConnect({
  set,
  get,
  connection,
  sourceNode,
  targetNode,
  newEdge,
}: ConnectionContext): boolean {
  const isGlobalHookSource =
    sourceNode.type === "hook" && sourceNode.data?.scope === "global";
  const isTargetWebPage = targetNode.type === "webPage";

  // Case 1: Global Hook -> WebPage
  if (isGlobalHookSource && isTargetWebPage) {
    const pageId = targetNode.id;
    const currentNodes = get().nodes;
    const currentEdges = get().edges;
    const hookName =
      sourceNode.data?.hookName || sourceNode.data?.label || "useCustomHook";

    const existingRefNode = currentNodes.find(
      (n) =>
        n.type === "hook_ref" &&
        (n.data?.targetPageId === pageId ||
          currentEdges.some(
            (e) => e.source === n.id && e.target === pageId,
          )),
    );

    let refNodeId = existingRefNode?.id;

    if (!refNodeId) {
      refNodeId = crypto.randomUUID();
      const pageX = targetNode.position?.x ?? 0;
      const pageY = targetNode.position?.y ?? 0;

      const newRefNode: BackendNode = {
        id: refNodeId,
        type: "hook_ref",
        position: {
          x: Math.max(0, pageX - 300),
          y: pageY + 30,
        },
        data: {
          label: `${hookName} (Ref)`,
          hookRef: sourceNode.id,
          targetPageId: pageId,
          targetPageIds: [pageId],
          targetWebAppId: targetNode.data?.targetWebAppId,
        },
        fractionalIndex: generateKeyBetween(getLastIndex(currentNodes), null),
      };
      get().addNode(newRefNode);
    } else {
      const currentLiveRef = currentNodes.find((n) => n.id === refNodeId);
      if (currentLiveRef?.data) {
        get().updateNode(refNodeId, {
          data: {
            ...currentLiveRef.data,
            hookRef: sourceNode.id,
            label: `${hookName} (Ref)`,
            targetPageId: pageId,
          },
        });
      }
    }

    // Connect master hook -> ref node (reference edge)
    const masterToRefExists = currentEdges.some(
      (e) =>
        (e.type === "reference" || e.type === "connection") &&
        e.source === sourceNode.id &&
        e.target === refNodeId,
    );
    if (!masterToRefExists) {
      get().addEdge({
        id: `edge-hook-ref-${sourceNode.id}-${refNodeId}`,
        source: sourceNode.id,
        target: refNodeId,
        sourceHandle: "hook-out",
        targetHandle: "hook-in",
        type: "reference",
      });
    }

    // Connect ref node -> webPage (connection edge)
    const refToPageExists = currentEdges.some(
      (e) => e.source === refNodeId && e.target === pageId,
    );
    if (!refToPageExists) {
      get().addEdge({
        id: `edge-hook-page-${refNodeId}-${pageId}`,
        source: refNodeId,
        target: pageId,
        sourceHandle: "hook-out",
        targetHandle: "page-in",
        type: "connection",
      });
    }

    return true; // Intercepted direct global edge
  }

  // Case 2: Endpoint -> Hook (binds endpoint to hook query)
  if (sourceNode.type === "service" && (targetNode.type === "hook" || targetNode.type === "hook_ref")) {
    const targetHandle = connection.targetHandle ?? "";
    const sourceHandle = connection.sourceHandle ?? "";
    const endpointId = sourceHandle.replace(/^endpoint-(in|out)-/, "");

    get().updateNode(targetNode.id, {
      data: {
        ...targetNode.data,
        targetEndpointId: endpointId,
        targetServiceId: sourceNode.id,
      },
    });
  }

  // Case 3: StateStore -> WebPage (binds store field to rendered state in section)
  if (sourceNode.type === "state_store" && targetNode.type === "webPage") {
    const sourceHandle = connection.sourceHandle ?? "";
    const targetHandle = connection.targetHandle ?? "";
    const storeName = sourceNode.data?.label || sourceNode.data?.storeName || "Store";
    const storeFields = sourceNode.data?.fields || [];

    if (sourceHandle.startsWith("store-field-out-")) {
      const fieldId = sourceHandle.replace("store-field-out-", "");
      const field = storeFields.find((f: any) => f.id === fieldId);
      if (field) {
        const sections: any[] = targetNode.data?.sections || [];

        // Scenario A: Target is a specific section-state-in handle
        if (targetHandle.startsWith("section-state-in-")) {
          let matchedSec: any = undefined;
          let matchedStateId: string | undefined = undefined;

          for (const sec of sections) {
            for (const st of sec.stateObjects || []) {
              if (targetHandle === `section-state-in-${sec.id}-${st.id}`) {
                matchedSec = sec;
                matchedStateId = st.id;
                break;
              }
            }
            if (matchedSec) break;
          }

          if (matchedSec && matchedStateId) {
            const updatedSections = sections.map((sec) => {
              if (sec.id !== matchedSec!.id) return sec;
              const nextStateObjects = (sec.stateObjects || []).map((st: any) => {
                if (st.id === matchedStateId) {
                  return {
                    ...st,
                    name: field.name,
                    type: field.type,
                    defaultValue: field.defaultValue,
                    storeId: sourceNode.id,
                    storeName,
                    fieldId: field.id,
                  };
                }
                return st;
              });
              return { ...sec, stateObjects: nextStateObjects };
            });

            get().updateNode(targetNode.id, {
              data: {
                ...targetNode.data,
                sections: updatedSections,
              },
            });
          }
        } else {
          // Scenario B: Dropped on page-in or general page target
          let targetSec = sections[0];
          let updatedSections: any[];

          if (!targetSec) {
            targetSec = {
              id: `sec-${Date.now()}`,
              name: "Main",
              renderMode: "client",
              actions: [],
              stateObjects: [],
            };
            sections.push(targetSec);
          }

          const existingSt = (targetSec.stateObjects || []).find(
            (s: any) => s.fieldId === field.id || (s.storeId === sourceNode.id && s.name === field.name),
          );

          let stateId = existingSt?.id;

          if (!existingSt) {
            stateId = `state-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
            const newObj = {
              id: stateId,
              name: field.name,
              type: field.type,
              defaultValue: field.defaultValue,
              storeId: sourceNode.id,
              storeName,
              fieldId: field.id,
            };

            updatedSections = sections.map((sec) =>
              sec.id === targetSec!.id
                ? { ...sec, stateObjects: [...(sec.stateObjects || []), newObj] }
                : sec,
            );

            get().updateNode(targetNode.id, {
              data: {
                ...targetNode.data,
                sections: updatedSections,
              },
            });
          }

          // Retarget edge to specific section-state-in handle
          if (stateId) {
            const specificTargetHandle = `section-state-in-${targetSec.id}-${stateId}`;
            const currentEdges = get().edges;
            const updatedEdges = currentEdges.map((e) =>
              e.id === newEdge.id
                ? {
                    ...e,
                    targetHandle: specificTargetHandle,
                    data: {
                      ...e.data,
                      isStateSubscription: true,
                      storeName,
                      fieldName: field.name,
                    },
                  }
                : e,
            );
            set({ edges: updatedEdges });
          }
        }

        // Enrich newEdge data
        const currentEdges = get().edges;
        const updatedEdges = currentEdges.map((e) =>
          e.id === newEdge.id
            ? {
                ...e,
                data: {
                  ...e.data,
                  isStateSubscription: true,
                  storeName,
                  fieldName: field.name,
                },
              }
            : e,
        );
        set({ edges: updatedEdges });
      }
    }
  }

  // Case 4: TypesNode -> WebPage / StateStore (data contract wiring)
  if (sourceNode.type === "types") {
    const sourceHandle = connection.sourceHandle ?? "";
    const targetHandle = connection.targetHandle ?? "";
    const typeId = sourceHandle.replace(/^type-out-/, "");
    const typesList = sourceNode.data?.types || [];
    const typeItem = typesList.find((t: any) => t.id === typeId);

    if (typeItem) {
      // Subcase 4A: TypesNode -> WebPage (binding type to a section state object)
      if (targetNode.type === "webPage" && targetHandle.startsWith("section-state-in-")) {
        const sections: any[] = targetNode.data?.sections || [];
        const updatedSections = sections.map((sec) => ({
          ...sec,
          stateObjects: (sec.stateObjects || []).map((st: any) => {
            if (targetHandle === `section-state-in-${sec.id}-${st.id}`) {
              const isArray = Boolean(st.type?.endsWith("[]"));
              return {
                ...st,
                type: isArray ? `${typeItem.name}[]` : typeItem.name,
              };
            }
            return st;
          }),
        }));
        get().updateNode(targetNode.id, {
          data: {
            ...targetNode.data,
            sections: updatedSections,
          },
        });
      }

      // Subcase 4B: TypesNode -> StateStore (binding custom type to a store field)
      if (targetNode.type === "state_store" && targetHandle.startsWith("store-field-in-")) {
        const fieldId = targetHandle.replace("store-field-in-", "");
        const fields = targetNode.data?.fields || [];
        const updatedFields = fields.map((f: any) => {
          if (f.id === fieldId) {
            const isArray = Boolean(f.isArray || f.type?.endsWith("[]"));
            return {
              ...f,
              type: isArray ? `${typeItem.name}[]` : typeItem.name,
            };
          }
          return f;
        });
        get().updateNode(targetNode.id, {
          data: {
            ...targetNode.data,
            fields: updatedFields,
          },
        });
      }
    }
  }

  return false;
}
