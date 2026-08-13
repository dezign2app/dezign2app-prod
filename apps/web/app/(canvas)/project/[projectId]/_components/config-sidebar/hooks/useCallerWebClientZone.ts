import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";

export interface CallerZoneInfo {
  /** true if the calling WebClient page is in a protected/private zone */
  isProtected: boolean;
  /** Human-readable zone name, e.g. "Private Section" */
  zoneName: string | null;
}

const DEFAULT_ZONES = [
  { handleId: "public-in", name: "Public Section", accessType: "public" as const },
  { handleId: "private-in", name: "Private Section", accessType: "protected" as const },
];

/**
 * Given the nodeId of a service/gateway and an endpointId, traces backwards through
 * the canvas edge graph to find the WebClient page that triggers this endpoint.
 * Returns whether that page lives in a protected zone.
 */
export function useCallerWebClientZone(
  nodeId: string,
  endpointId: string,
): CallerZoneInfo {
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const edges = useBackendCanvasStore((s) => s.edges);

  // Step 1 — find the edge that wires a WebClient event → this endpoint
  // The targetHandle is of the form "endpoints-in-<endpointId>" or contains the endpointId
  const incomingEdge = edges.find(
    (e) =>
      e.target === nodeId &&
      e.targetHandle != null &&
      e.targetHandle.includes(endpointId),
  );
  if (!incomingEdge) return { isProtected: false, zoneName: null };

  const webClientNode = nodes.find((n) => n.id === incomingEdge.source);
  if (!webClientNode || webClientNode.type !== "webClient") {
    return { isProtected: false, zoneName: null };
  }

  // Step 2 — If the WebClientNode has a local protectionOverride, use it
  const data = webClientNode.data as {
    useZoneDefault?: boolean;
    protectionOverride?: { accessType?: "public" | "protected" };
  };

  if (data.useZoneDefault === false && data.protectionOverride) {
    const isProtected = data.protectionOverride.accessType === "protected";
    return { isProtected, zoneName: isProtected ? "Custom Rules" : null };
  }

  // Step 3 — trace to the connected WebApp node via a page-in / zone edge
  const webAppEdge = edges.find((e) => {
    const isTarget = e.target === webClientNode.id;
    const isSource = e.source === webClientNode.id;
    if (!isTarget && !isSource) return false;
    const otherId = isSource ? e.target : e.source;
    const otherNode = nodes.find((n) => n.id === otherId);
    return otherNode?.type === "webApp";
  });

  if (!webAppEdge) return { isProtected: false, zoneName: null };

  const webAppNode = nodes.find(
    (n) =>
      n.type === "webApp" &&
      (n.id === webAppEdge.source || n.id === webAppEdge.target),
  );
  if (!webAppNode) return { isProtected: false, zoneName: null };

  // Step 4 — determine which zone handle was used
  const handleId =
    webAppEdge.source === webAppNode.id
      ? webAppEdge.sourceHandle
      : webAppEdge.targetHandle;

  const webAppData = webAppNode.data as {
    zones?: Array<{ handleId: string; name: string; accessType?: "public" | "protected" }>;
  };

  const zones =
    webAppData.zones && webAppData.zones.length > 0
      ? webAppData.zones
      : DEFAULT_ZONES;

  const matchedZone = zones.find((z) => z.handleId === handleId);

  if (matchedZone) {
    const isProtected =
      matchedZone.accessType === "protected" ||
      // Fallback heuristic for zones that pre-date the accessType field
      matchedZone.handleId === "private-in";
    return { isProtected, zoneName: matchedZone.name };
  }

  // Raw handle heuristic
  if (handleId === "private-in") return { isProtected: true, zoneName: "Private Section" };
  if (handleId === "public-in") return { isProtected: false, zoneName: "Public Section" };

  return { isProtected: false, zoneName: null };
}
