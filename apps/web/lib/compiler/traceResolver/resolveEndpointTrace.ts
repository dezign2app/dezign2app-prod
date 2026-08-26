import { BackendNode, BackendEdge } from "@/types/canvas";
import { Endpoint, UIEventItem, PageSection, NodeConnectionDetail, EndpointTraceResult } from "@workspace/canvas/types";
import { deduplicateTraces, cleanPath } from "./utils";
import {
  formatDatabaseColumnsContext,
  formatRedisSchemaContext,
  formatEndpointPayloadContext,
} from "./contextFormatters";

/**
 * Traverses incoming edges to an Endpoint on a Service Node
 */
export function resolveEndpointTrace(
  serviceNode: BackendNode,
  endpoint: Endpoint,
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = [],
  allEndpoints: (Endpoint & { nodeId: string })[] = [],
): EndpointTraceResult {
  const incoming: NodeConnectionDetail[] = [];
  const outgoing: NodeConnectionDetail[] = [];

  const epId = endpoint.id;
  const epName = endpoint.name || "";
  const epMethod = (endpoint.type || "GET").toUpperCase();
  const epPath = cleanPath(epName);

  // 1. Resolve INCOMING Connections (edges into serviceNode matching this endpoint)
  const incomingEdges = allEdges.filter((e) => {
    if (e.target !== serviceNode.id) return false;
    if (!e.targetHandle) return true;
    const th = e.targetHandle;

    if (th.includes("-in-")) {
      const parts = th.split("-in-");
      const handleEpId = parts[parts.length - 1];
      if (handleEpId && handleEpId !== epId && handleEpId !== epName) {
        return false;
      }
    }

    return (
      th.includes(epId) ||
      (epName && th.includes(epName)) ||
      th.startsWith("endpoint-in") ||
      th.startsWith("endpoints-in") ||
      th.startsWith("events-in")
    );
  });

  incomingEdges.forEach((edge) => {
    const srcNode = allNodes.find((n) => n.id === edge.source);
    if (!srcNode) return;

    const srcName = srcNode.data?.label || srcNode.id;
    const srcTypeStr = srcNode.type as string;

    // A. WebPage Node
    if (srcNode.type === "webPage") {
      let eventDetail = "UI Action / Link";
      const sections: PageSection[] =
        (srcNode.data?.sections as PageSection[]) || [];
      const srcEvents: UIEventItem[] =
        sections.length > 0
          ? sections.flatMap((s) => s.actions || [])
          : (srcNode.data?.events as UIEventItem[]) || [];
      const sh = edge.sourceHandle || "";
      const matchedEvt = srcEvents.find(
        (evt) => sh.includes(evt.id) || (evt.name && sh.includes(evt.name)),
      );
      if (matchedEvt) {
        eventDetail = `Trigger Event "${matchedEvt.name || "Action"}" (${matchedEvt.event || "click"})`;
      }

      // Check if WebClient page is in a protected zone
      let isProtected = false;
      const wcData = srcNode.data;
      if (wcData?.useZoneDefault === false && wcData?.protectionOverride) {
        isProtected = wcData.protectionOverride.accessType === "protected";
      } else {
        const webAppEdge = allEdges.find(
          (e) =>
            (e.target === srcNode.id || e.source === srcNode.id) &&
            allNodes.find(
              (n) =>
                n.id === (e.target === srcNode.id ? e.source : e.target) &&
                n.type === "webApp",
            ),
        );
        if (webAppEdge) {
          const webAppNode = allNodes.find(
            (n) =>
              n.type === "webApp" &&
              (n.id === webAppEdge.source || n.id === webAppEdge.target),
          );
          const handleId =
            webAppEdge.source === webAppNode?.id
              ? webAppEdge.sourceHandle
              : webAppEdge.targetHandle;
          const zones = webAppNode?.data?.zones || [
            { handleId: "public-in", name: "Public Section", accessType: "public" },
            { handleId: "private-in", name: "Private Section", accessType: "protected" },
          ];
          const matchedZone = zones.find((z) => z.handleId === handleId);
          if (matchedZone) {
            isProtected =
              matchedZone.accessType === "protected" ||
              matchedZone.handleId === "private-in";
          } else if (handleId === "private-in") {
            isProtected = true;
          }
        }
      }

      if (isProtected) {
        eventDetail += " (Protected Page - Requires Auth Token)";
      }

      incoming.push({
        nodeId: srcNode.id,
        nodeName: srcName,
        nodeType: "WebClient Page",
        detail: eventDetail,
        isProtected,
        dataContext: formatEndpointPayloadContext(endpoint),
      });
    }
    // B. Database / Entity Node
    else if (
      srcNode.type === "entity" ||
      srcNode.type === "db_ref" ||
      srcTypeStr === "db" ||
      srcTypeStr === "database"
    ) {
      const tableName =
        srcNode.data?.tableName ||
        srcName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      incoming.push({
        nodeId: srcNode.id,
        nodeName: srcName,
        nodeType: "Database Table",
        detail: `Table "${tableName}"`,
        dataContext: formatDatabaseColumnsContext(srcNode, allNodes),
      });
    }
    // C. Service Node
    else if (srcNode.type === "service") {
      incoming.push({
        nodeId: srcNode.id,
        nodeName: srcName,
        nodeType: "Microservice",
        detail: `HTTP Client call to ${epMethod} ${epPath}`,
        dataContext: formatEndpointPayloadContext(endpoint),
      });
    }
    // D. API Gateway / Load Balancer
    else if (
      srcNode.type === "api_gateway" ||
      srcNode.type === "load_balancer"
    ) {
      incoming.push({
        nodeId: srcNode.id,
        nodeName: srcName,
        nodeType:
          srcNode.type === "api_gateway" ? "API Gateway" : "Load Balancer",
        detail: `Routed through gateway endpoint (Port ${srcNode.data?.port ? String(srcNode.data.port) : "8000"})`,
        dataContext: `Routes to ${epMethod} ${epPath}`,
      });
    }
    // E. External API / Webhook / Other
    else {
      incoming.push({
        nodeId: srcNode.id,
        nodeName: srcName,
        nodeType: srcNode.type,
        detail: `Incoming connection from ${srcName}`,
        dataContext: formatEndpointPayloadContext(endpoint),
      });
    }
  });

  // 2. Resolve OUTGOING Connections (edges from serviceNode matching this endpoint)
  const outgoingEdges = allEdges.filter((e) => {
    if (e.source !== serviceNode.id) return false;
    if (!e.sourceHandle) return true;
    const sh = e.sourceHandle;

    if (sh.includes("-out-")) {
      const parts = sh.split("-out-");
      const handleEpId = parts[parts.length - 1];
      if (handleEpId && handleEpId !== epId && handleEpId !== epName) {
        return false;
      }
    }

    return (
      sh.includes(epId) ||
      (epName && sh.includes(epName)) ||
      sh.startsWith("endpoint-out") ||
      sh.startsWith("endpoints-out") ||
      sh.startsWith("database-source") ||
      sh.startsWith("published-events")
    );
  });

  outgoingEdges.forEach((edge) => {
    const tgtNode = allNodes.find((n) => n.id === edge.target);
    if (!tgtNode) return;

    const tgtName = tgtNode.data?.label || tgtNode.id;
    const nodeData = tgtNode.data;
    const nodeTypeStr = tgtNode.type as string;

    // A. Redis Cache Node
    if (
      tgtNode.type === "redis_schema" ||
      tgtNode.type === "redis-cache" ||
      nodeData?.dbType === "redis"
    ) {
      outgoing.push({
        nodeId: tgtNode.id,
        nodeName: tgtName,
        nodeType: "Redis Cache",
        detail: `Cache "${tgtName}"`,
        dataContext: formatRedisSchemaContext(tgtNode, allNodes),
      });
    }
    // B. Database / Entity Node
    else if (
      tgtNode.type === "entity" ||
      tgtNode.type === "db_ref" ||
      nodeTypeStr === "db" ||
      nodeTypeStr === "database"
    ) {
      const tableName =
        nodeData?.tableName ||
        tgtName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      outgoing.push({
        nodeId: tgtNode.id,
        nodeName: tgtName,
        nodeType: "Database Table",
        detail: `Table "${tableName}"`,
        dataContext: formatDatabaseColumnsContext(tgtNode, allNodes),
      });
    }
    // C. Service Node
    else if (tgtNode.type === "service") {
      let targetEpInfo = `HTTP Request to Service (Port ${nodeData?.port || "8080"})`;
      const tgtEndpoints = allEndpoints.filter((e) => e.nodeId === tgtNode.id);
      let targetDataContext = `Base URL: http://localhost:${nodeData?.port || "8080"}`;

      if (tgtEndpoints.length > 0) {
        const firstEp = tgtEndpoints[0]!;
        targetEpInfo = `Calls ${(firstEp.type || "GET").toUpperCase()} ${firstEp.name || "/"} on ${tgtName}`;
        targetDataContext = formatEndpointPayloadContext(firstEp);
      }

      outgoing.push({
        nodeId: tgtNode.id,
        nodeName: tgtName,
        nodeType: "Microservice",
        detail: targetEpInfo,
        dataContext: targetDataContext,
      });
    }
    // D. Messaging Broker Node
    else if (
      [
        "kafka",
        "sqs",
        "redis-streams",
        "redis-pubsub",
        "pubsub",
        "eventstream",
        "queue",
      ].includes(nodeTypeStr)
    ) {
      outgoing.push({
        nodeId: tgtNode.id,
        nodeName: tgtName,
        nodeType: "Message Broker",
        detail: `Publish event / message to ${tgtName} (${tgtNode.type})`,
        dataContext: `Broker topic/queue event stream`,
      });
    }
    // E. Other
    else {
      outgoing.push({
        nodeId: tgtNode.id,
        nodeName: tgtName,
        nodeType: tgtNode.type,
        detail: `Outgoing connection to ${tgtName}`,
      });
    }
  });

  return {
    incoming: deduplicateTraces(incoming),
    outgoing: deduplicateTraces(outgoing),
  };
}
