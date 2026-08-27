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
        targetHandle: "hooks-in",
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

  return false;
}
