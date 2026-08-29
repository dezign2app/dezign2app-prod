import { useMemo } from "react";
import { BackendNode, BackendEdge, WebAppZone } from "@/types/canvas";
import { Endpoint } from "@workspace/canvas";

interface UseWebPageConnectedContextParams {
  nodeId: string;
  data: BackendNode["data"];
  allNodes: BackendNode[];
  allEdges: BackendEdge[];
  allEndpoints: (Endpoint & { nodeId?: string })[];
}

export function useWebPageConnectedContext({
  nodeId,
  data,
  allNodes,
  allEdges,
  allEndpoints,
}: UseWebPageConnectedContextParams) {
  // Determine connected WebApp section name & zone
  const { connectedWebApp, connectedZoneName, incomingEdge } = useMemo(() => {
    const edge = allEdges.find(
      (e) => e.target === nodeId || e.source === nodeId,
    );
    const webApp = edge
      ? allNodes.find(
          (n) =>
            n.type === "webApp" &&
            (n.id === edge.source || n.id === edge.target),
        )
      : null;

    let zoneName: string | null = null;
    if (webApp && edge) {
      const handleId =
        edge.source === webApp.id
          ? edge.sourceHandle
          : edge.targetHandle;
      const zones: WebAppZone[] = webApp.data?.zones || [];
      const matchedZone = zones.find((z: WebAppZone) => z.handleId === handleId);
      if (matchedZone) {
        zoneName = matchedZone.name;
      }
    }

    return {
      connectedWebApp: webApp,
      connectedZoneName: zoneName,
      incomingEdge: edge,
    };
  }, [allEdges, allNodes, nodeId]);

  const isProtected = useMemo(() => {
    if (data.useZoneDefault === false) {
      return data.accessType !== "public";
    }
    return Boolean(
      connectedZoneName?.toLowerCase().includes("private") ||
        connectedZoneName?.toLowerCase().includes("protected") ||
        incomingEdge?.sourceHandle === "private-in" ||
        incomingEdge?.targetHandle === "private-in" ||
        (data.accessType && data.accessType !== "public"),
    );
  }, [data.useZoneDefault, data.accessType, connectedZoneName, incomingEdge]);

  // Find connected service endpoint via any edge connected to this WebPage node
  const connectedEndpoint = useMemo<Endpoint | null>(() => {
    const connectedServiceEdge = allEdges.find(
      (e) =>
        (e.source === nodeId &&
          allNodes.some((n) => n.id === e.target && n.type === "service")) ||
        (e.target === nodeId &&
          allNodes.some((n) => n.id === e.source && n.type === "service")),
    );

    if (!connectedServiceEdge) return null;

    const isSource = connectedServiceEdge.source === nodeId;
    const targetNodeId = isSource
      ? connectedServiceEdge.target
      : connectedServiceEdge.source;
    const targetHandle = isSource
      ? connectedServiceEdge.targetHandle
      : connectedServiceEdge.sourceHandle;
    const targetNode = allNodes.find((n) => n.id === targetNodeId);

    if (!targetNode) return null;

    let endpointId = targetHandle
      ? targetHandle.replace(
          /^(endpoint-in-|endpoint-out-|endpoints-in-|endpoints-out-|events-in-|events-out-)/,
          "",
        )
      : undefined;

    if (endpointId && endpointId.includes("-in-")) {
      const parts = endpointId.split("-in-");
      endpointId = parts[parts.length - 1];
    }

    if (endpointId) {
      const endpointsList: Endpoint[] = targetNode.data?.endpoints || [];
      const found =
        allEndpoints.find(
          (ep) =>
            ep.nodeId === targetNode.id &&
            (ep.id === endpointId || ep.name === endpointId),
        ) ||
        endpointsList.find(
          (ep: Endpoint) => ep.id === endpointId || ep.name === endpointId,
        ) ||
        null;
      if (found) return found;
    }

    const srvEndpoints = allEndpoints.filter((ep) => ep.nodeId === targetNode.id);
    if (srvEndpoints.length > 0 && srvEndpoints[0]) {
      return srvEndpoints[0];
    }
    const nodeEndpointsList: Endpoint[] = targetNode.data?.endpoints || [];
    if (nodeEndpointsList.length > 0 && nodeEndpointsList[0]) {
      return nodeEndpointsList[0];
    }

    return null;
  }, [allEdges, allNodes, allEndpoints, nodeId]);

  return {
    connectedWebApp,
    connectedZoneName,
    isProtected,
    connectedEndpoint,
  };
}
