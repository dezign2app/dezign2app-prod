import { BackendNode, BackendEdge } from "@/types/canvas";
import { UIEventItem } from "@workspace/canvas/types";

export type StoreActionType =
  | "set"
  | "append"
  | "remove"
  | "toggle"
  | "increment"
  | "reset"
  | "populate"
  | "custom";

export interface ResolvedStoreActionBinding {
  storeNodeId: string;
  storeName: string;
  actionId: string;
  actionName: string;
  actionType: StoreActionType;
}

const NON_ACTION_HANDLES: readonly string[] = [
  "page-in",
  "page-out",
  "store-in",
  "store-out",
  "populate-in",
  "populate-out",
  "mutate-in",
  "mutate-out",
  "reset-in",
  "reset-out",
  "public-in",
  "private-in",
  "auth-in",
  "auth-out",
  "types-in",
  "types-out",
];

function isValidStoreActionType(val: string | undefined): val is StoreActionType {
  return (
    val === "set" ||
    val === "append" ||
    val === "remove" ||
    val === "toggle" ||
    val === "increment" ||
    val === "reset" ||
    val === "populate" ||
    val === "custom"
  );
}

function toPascalCase(str: string): string {
  const clean = str.trim();
  if (!clean) return "State";
  if (/[\s\-_]/.test(clean)) {
    return clean
      .split(/[\s\-_]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("");
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function extractActionIdFromHandle(handleId: string | null | undefined): string | null {
  if (!handleId) {
    return null;
  }
  if (NON_ACTION_HANDLES.includes(handleId)) {
    return null;
  }
  if (handleId.startsWith("pageload-in-")) {
    return handleId.slice("pageload-in-".length);
  }
  if (handleId.startsWith("event-in-")) {
    return handleId.slice("event-in-".length);
  }
  if (handleId.startsWith("action-in-")) {
    return handleId.slice("action-in-".length);
  }
  if (handleId.startsWith("sse-in-")) {
    return handleId.slice("sse-in-".length);
  }
  if (handleId.startsWith("websocket-in-")) {
    return handleId.slice("websocket-in-".length);
  }
  if (handleId.startsWith("ws-in-")) {
    return handleId.slice("ws-in-".length);
  }
  if (handleId.startsWith("webrtc-in-")) {
    return handleId.slice("webrtc-in-".length);
  }
  if (handleId.startsWith("events-")) {
    return handleId.slice("events-".length);
  }
  return handleId;
}

function resolveStoreBindingFromHandle(
  storeNode: BackendNode,
  storeHandleId: string | null | undefined,
  pageAction: UIEventItem,
): { actionId: string; actionName: string; actionType: StoreActionType } {
  const storeActions = storeNode.data?.actions;
  const storeFields = storeNode.data?.fields;

  // 1. Populate / Load handle
  if (
    storeHandleId === "populate-out" ||
    storeHandleId === "populate-in" ||
    storeHandleId === "load" ||
    Boolean(storeHandleId?.startsWith("populate-"))
  ) {
    return {
      actionId: "builtin-populate",
      actionName: "populate",
      actionType: "populate",
    };
  }

  // 2. Reset / Unmount handle
  if (
    storeHandleId === "reset-out" ||
    storeHandleId === "reset-in" ||
    storeHandleId === "reset" ||
    Boolean(storeHandleId?.startsWith("reset-"))
  ) {
    return {
      actionId: "builtin-reset",
      actionName: "reset",
      actionType: "reset",
    };
  }

  // 3. Custom store action: store-action-out-${id} or store-action-in-${id}
  if (
    Boolean(storeHandleId?.startsWith("store-action-out-")) ||
    Boolean(storeHandleId?.startsWith("store-action-in-"))
  ) {
    const handlePrefix = storeHandleId?.startsWith("store-action-out-")
      ? "store-action-out-"
      : "store-action-in-";
    const customId = storeHandleId ? storeHandleId.slice(handlePrefix.length) : "";

    if (Array.isArray(storeActions) && customId) {
      const found = storeActions.find((a) => a.id === customId);
      if (found) {
        const actionType: StoreActionType = isValidStoreActionType(found.actionType)
          ? found.actionType
          : "custom";
        return {
          actionId: found.id,
          actionName: found.name,
          actionType,
        };
      }
    }
  }

  // 4. Mutate handle: mutate-out or mutate-in
  if (
    storeHandleId === "mutate-out" ||
    storeHandleId === "mutate-in" ||
    storeHandleId === "mutate" ||
    Boolean(storeHandleId?.startsWith("mutate-"))
  ) {
    if (Array.isArray(storeActions) && storeActions.length > 0) {
      const matched =
        storeActions.find(
          (a) => a.name.toLowerCase() === pageAction.name.toLowerCase(),
        ) || storeActions[0];

      if (matched) {
        const actionType: StoreActionType = isValidStoreActionType(matched.actionType)
          ? matched.actionType
          : "set";
        return {
          actionId: matched.id,
          actionName: matched.name,
          actionType,
        };
      }
    }

    const firstField =
      Array.isArray(storeFields) && storeFields.length > 0
        ? storeFields[0]
        : undefined;
    const fieldName = firstField?.name;
    const setterName = fieldName
      ? `set${toPascalCase(fieldName)}`
      : "set";

    return {
      actionId: "builtin-mutate",
      actionName: setterName,
      actionType: "set",
    };
  }

  // 5. Generic fallback based on pageAction event
  if (pageAction.event === "pageLoad" || pageAction.name === "pageLoad") {
    return {
      actionId: "builtin-populate",
      actionName: "populate",
      actionType: "populate",
    };
  }

  if (pageAction.event === "unmount" || pageAction.name === "unmount") {
    return {
      actionId: "builtin-reset",
      actionName: "reset",
      actionType: "reset",
    };
  }

  if (Array.isArray(storeActions) && storeActions.length > 0) {
    const firstAct = storeActions[0];
    if (firstAct) {
      const actionType: StoreActionType = isValidStoreActionType(firstAct.actionType)
        ? firstAct.actionType
        : "set";
      return {
        actionId: firstAct.id,
        actionName: firstAct.name,
        actionType,
      };
    }
  }

  return {
    actionId: "builtin-mutate",
    actionName: "set",
    actionType: "set",
  };
}

function findMatchingEdgeForAction(
  pageNodeId: string,
  action: UIEventItem,
  allNodes: readonly BackendNode[],
  allEdges: readonly BackendEdge[],
): { edge: BackendEdge; storeNode: BackendNode; storeHandle: string | null | undefined } | null {
  // First pass: look for exact action handle match (highest priority)
  for (const edge of allEdges) {
    // Direction A: Store -> Page
    if (edge.target === pageNodeId) {
      const targetActionId = extractActionIdFromHandle(edge.targetHandle);
      if (targetActionId === action.id) {
        const storeNode = allNodes.find((n) => n.id === edge.source && n.type === "state_store");
        if (storeNode) {
          return { edge, storeNode, storeHandle: edge.sourceHandle };
        }
      }
    }

    // Direction B: Page -> Store
    if (edge.source === pageNodeId) {
      const sourceActionId = extractActionIdFromHandle(edge.sourceHandle);
      if (sourceActionId === action.id) {
        const storeNode = allNodes.find((n) => n.id === edge.target && n.type === "state_store");
        if (storeNode) {
          return { edge, storeNode, storeHandle: edge.targetHandle };
        }
      }
    }
  }

  // Second pass: page-level lifecycle matching (fallback)
  const isPageLoad = action.event === "pageLoad" || action.name === "pageLoad";
  const isUnmount = action.event === "unmount" || action.name === "unmount";

  if (isPageLoad || isUnmount) {
    for (const edge of allEdges) {
      // Direction A: Store -> Page
      if (edge.target === pageNodeId) {
        const targetActionId = extractActionIdFromHandle(edge.targetHandle);
        if (!targetActionId) {
          const storeNode = allNodes.find((n) => n.id === edge.source && n.type === "state_store");
          if (storeNode) {
            const sh = edge.sourceHandle || "";
            if (isPageLoad && (sh.startsWith("populate") || sh === "load")) {
              return { edge, storeNode, storeHandle: edge.sourceHandle };
            }
            if (isUnmount && (sh.startsWith("reset") || sh === "unmount")) {
              return { edge, storeNode, storeHandle: edge.sourceHandle };
            }
          }
        }
      }

      // Direction B: Page -> Store
      if (edge.source === pageNodeId) {
        const sourceActionId = extractActionIdFromHandle(edge.sourceHandle);
        if (!sourceActionId) {
          const storeNode = allNodes.find((n) => n.id === edge.target && n.type === "state_store");
          if (storeNode) {
            const th = edge.targetHandle || "";
            if (isPageLoad && (th.startsWith("populate") || th === "load")) {
              return { edge, storeNode, storeHandle: edge.targetHandle };
            }
            if (isUnmount && (th.startsWith("reset") || th === "unmount")) {
              return { edge, storeNode, storeHandle: edge.targetHandle };
            }
          }
        }
      }
    }
  }

  return null;
}

/**
 * Resolves canvas edges between StateStoreNode handles and WebPageNode action handles,
 * enriching webClientNodes actions with storeActionBinding without requiring manual sidebar entry.
 */
export function resolveStoreActionBindings(
  webClientNodes: readonly BackendNode[],
  allNodes: readonly BackendNode[] = [],
  allEdges: readonly BackendEdge[] = [],
): BackendNode[] {
  return webClientNodes.map((node) => {
    let hasChanges = false;

    // 1. Process sections
    const rawSections = node.data?.sections;
    const nextSections = Array.isArray(rawSections)
      ? rawSections.map((sec) => {
          let sectionChanged = false;
          const nextActions = (sec.actions || []).map((act) => {
            const match = findMatchingEdgeForAction(node.id, act, allNodes, allEdges);
            if (match) {
              const storeNode = match.storeNode;
              const storeName = storeNode.data?.storeName || storeNode.data?.label || "App";
              const binding = resolveStoreBindingFromHandle(storeNode, match.storeHandle, act);
              sectionChanged = true;
              return {
                ...act,
                storeActionBinding: {
                  storeNodeId: storeNode.id,
                  storeName,
                  actionId: binding.actionId,
                  actionName: binding.actionName,
                  actionType: binding.actionType,
                },
              };
            }
            return act;
          });

          if (sectionChanged) {
            hasChanges = true;
            return {
              ...sec,
              actions: nextActions,
            };
          }
          return sec;
        })
      : rawSections;

    // 2. Process node.data.events (if present)
    const rawEvents = node.data?.events;
    const nextEvents = Array.isArray(rawEvents)
      ? rawEvents.map((evt) => {
          const match = findMatchingEdgeForAction(node.id, evt, allNodes, allEdges);
          if (match) {
            const storeNode = match.storeNode;
            const storeName = storeNode.data?.storeName || storeNode.data?.label || "App";
            const binding = resolveStoreBindingFromHandle(storeNode, match.storeHandle, evt);
            hasChanges = true;
            return {
              ...evt,
              storeActionBinding: {
                storeNodeId: storeNode.id,
                storeName,
                actionId: binding.actionId,
                actionName: binding.actionName,
                actionType: binding.actionType,
              },
            };
          }
          return evt;
        })
      : rawEvents;

    if (!hasChanges) {
      return node;
    }

    return {
      ...node,
      data: {
        ...node.data,
        sections: nextSections,
        events: nextEvents,
      },
    };
  });
}
