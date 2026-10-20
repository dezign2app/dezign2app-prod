import { NodeConnectionDetail, Endpoint } from "@workspace/canvas/types";
import { BackendNode, BackendEdge } from "@/types/canvas";

/**
 * Deduplicates trace items based on nodeId, nodeName, and detail
 */
export function deduplicateTraces(
  traces: NodeConnectionDetail[],
): NodeConnectionDetail[] {
  const seen = new Set<string>();
  return traces.filter((item) => {
    const key = `${item.nodeId}:${item.nodeName}:${item.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Clean path parameters for representation (e.g., /users/:id -> /users/1)
 */
export function cleanPath(pathStr: string): string {
  const p = pathStr.startsWith("/") ? pathStr : `/${pathStr}`;
  return p.replace(/:\w+|\{\w+\}/g, "1");
}

/**
 * Checks whether a given node is an authenticated page (WebClient/WebPage).
 */
export function isPageNodeAuthenticated(
  pageNode: BackendNode,
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = [],
): boolean {
  if (pageNode.type !== "webPage") return false;
  const data = pageNode.data;
  if (!data) return false;

  // 1. Direct explicit auth / protected flags on node data
  if (
    data.requireAuth === true ||
    (data.accessType !== undefined && data.accessType !== "public") ||
    (data.protectionOverride?.accessType !== undefined && data.protectionOverride.accessType !== "public")
  ) {
    return true;
  }

  // 2. Zone default override
  if (data.useZoneDefault === false && data.protectionOverride?.accessType !== undefined && data.protectionOverride.accessType !== "public") {
    return true;
  }

  // 3. Connected to Auth Node via authNodeId or direct edge
  if (
    data.authNodeId &&
    allNodes.some((n) => n.id === data.authNodeId && n.type === "auth")
  ) {
    return true;
  }
  const hasAuthEdge = allEdges.some((e) => {
    return (
      (e.source === pageNode.id && allNodes.some((n) => n.id === e.target && n.type === "auth")) ||
      (e.target === pageNode.id && allNodes.some((n) => n.id === e.source && n.type === "auth"))
    );
  });
  if (hasAuthEdge) return true;

  // 4. Connected to a WebApp node in a protected zone (e.g. handle private-in or zone with accessType === "protected")
  const webAppEdge = allEdges.find(
    (e) =>
      (e.target === pageNode.id || e.source === pageNode.id) &&
      allNodes.some(
        (n) => n.id === (e.target === pageNode.id ? e.source : e.target) && n.type === "webApp",
      ),
  );
  if (webAppEdge) {
    const webAppNode = allNodes.find(
      (n) => n.type === "webApp" && (n.id === webAppEdge.source || n.id === webAppEdge.target),
    );
    const handleId =
      webAppEdge.source === webAppNode?.id
        ? webAppEdge.sourceHandle
        : webAppEdge.targetHandle;
    if (
      handleId === "private-in" ||
      handleId?.includes("private") ||
      handleId?.includes("protected")
    ) {
      return true;
    }
    const zones = webAppNode?.data?.zones || [
      { handleId: "public-in", name: "Public Section", accessType: "public" },
      { handleId: "private-in", name: "Private Section", accessType: "protected" },
    ];
    const matchedZone = zones.find((z) => z.handleId === handleId);
    if (
      matchedZone &&
      (matchedZone.accessType === "protected" || matchedZone.handleId === "private-in")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether a service node (or a specific endpoint on it) is connected to an authenticated page.
 */
export function isRouteConnectedToAuthenticatedPage(
  serviceNode: BackendNode,
  endpoint?: Endpoint,
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = [],
): boolean {
  if (endpoint && endpoint.requireAuth === true) {
    return true;
  }

  const epId = endpoint?.id;
  const epName = endpoint?.name || "";

  // Check incoming edges from any authenticated page to serviceNode
  const connectingEdges = allEdges.filter((e) => {
    const isTargetService = e.target === serviceNode.id;
    const isSourceService = e.source === serviceNode.id;
    if (!isTargetService && !isSourceService) return false;

    const otherNodeId = isTargetService ? e.source : e.target;
    const otherNode = allNodes.find((n) => n.id === otherNodeId);
    if (!otherNode || !isPageNodeAuthenticated(otherNode, allNodes, allEdges)) {
      return false;
    }

    if (endpoint) {
      const handle = isTargetService ? e.targetHandle : e.sourceHandle;
      if (!handle) return true;

      if (handle.includes("-in-")) {
        const parts = handle.split("-in-");
        const handleEpId = parts[parts.length - 1];
        if (handleEpId && handleEpId !== epId && handleEpId !== epName) {
          return false;
        }
      }

      return (
        (Boolean(epId) && handle.includes(epId!)) ||
        (Boolean(epName) && handle.includes(epName)) ||
        handle.startsWith("endpoint-in") ||
        handle.startsWith("endpoints-in") ||
        handle.startsWith("events-in") ||
        handle === "service-in" ||
        !handle
      );
    }

    return true;
  });

  return connectingEdges.length > 0;
}

