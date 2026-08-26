import { BackendNode, BackendEdge } from "@/types/canvas";
import { AnyMessagingResource, NodeConnectionDetail, EventTraceResult } from "@workspace/canvas/types";
import { deduplicateTraces } from "./utils";

/**
 * Traverses incoming & outgoing connections for an Event Consumer
 */
export function resolveConsumerTrace(
  serviceNode: BackendNode,
  consumedEvent: AnyMessagingResource & {
    nodeId: string;
    variant: "publish" | "consume";
  },
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = [],
): EventTraceResult {
  const incoming: NodeConnectionDetail[] = [];
  const outgoing: NodeConnectionDetail[] = [];

  const evtName = consumedEvent.name || "event";
  const evtId = consumedEvent.id;

  // 1. Incoming: Who publishes or sends this event?
  const incomingEdges = allEdges.filter((e) => {
    if (e.target !== serviceNode.id) return false;
    const th = e.targetHandle || "";
    return (
      th.includes(evtId) ||
      th.includes(evtName) ||
      th.startsWith("consumed-events") ||
      th.startsWith("events-in")
    );
  });

  incomingEdges.forEach((edge) => {
    const srcNode = allNodes.find((n) => n.id === edge.source);
    if (!srcNode) return;
    const srcName = srcNode.data?.label || srcNode.id;
    const srcTypeStr = srcNode.type as string;

    if (srcNode.type === "service") {
      incoming.push({
        nodeId: srcNode.id,
        nodeName: srcName,
        nodeType: "Publisher Service",
        detail: `Published by ${srcName}`,
        dataContext: consumedEvent.payloadSchema?.rawJson
          ? `Payload: ${consumedEvent.payloadSchema.rawJson.replace(/\s+/g, " ")}`
          : "Event Payload object",
      });
    } else if (
      [
        "kafka",
        "sqs",
        "redis-streams",
        "redis-pubsub",
        "pubsub",
        "eventstream",
        "queue",
      ].includes(srcTypeStr)
    ) {
      incoming.push({
        nodeId: srcNode.id,
        nodeName: srcName,
        nodeType: "Message Broker",
        detail: `Consumes topic/channel "${evtName}" from ${srcName}`,
        dataContext: consumedEvent.payloadSchema?.rawJson
          ? `Payload: ${consumedEvent.payloadSchema.rawJson.replace(/\s+/g, " ")}`
          : "Event Payload object",
      });
    } else {
      incoming.push({
        nodeId: srcNode.id,
        nodeName: srcName,
        nodeType: srcNode.type,
        detail: `Event source from ${srcName}`,
      });
    }
  });

  if (incoming.length === 0) {
    incoming.push({
      nodeId: "event-bus",
      nodeName: "Event Bus / Message Queue",
      nodeType: "Message Broker",
      detail: `Consumes topic/event "${evtName}"`,
      dataContext: consumedEvent.payloadSchema?.rawJson
        ? `Payload Schema: ${consumedEvent.payloadSchema.rawJson.replace(/\s+/g, " ")}`
        : "Event Payload",
    });
  }

  // 2. Outgoing: Where does consumer output go? (DB mutation, downstream service)
  const outgoingEdges = allEdges.filter((e) => e.source === serviceNode.id);
  outgoingEdges.forEach((edge) => {
    const tgtNode = allNodes.find((n) => n.id === edge.target);
    if (!tgtNode) return;
    const tgtName = tgtNode.data?.label || tgtNode.id;
    const nodeData = tgtNode.data;
    const tgtTypeStr = tgtNode.type;

    if (
      tgtNode.type === "entity" ||
      tgtNode.type === "db_ref" ||
      tgtTypeStr === "database"
    ) {
      const tableName =
        nodeData?.tableName ||
        tgtName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      outgoing.push({
        nodeId: tgtNode.id,
        nodeName: tgtName,
        nodeType: "Database Table",
        detail: `Mutates/Saves to Table "${tableName}"`,
      });
    } else if (tgtNode.type === "service") {
      outgoing.push({
        nodeId: tgtNode.id,
        nodeName: tgtName,
        nodeType: "Microservice",
        detail: `Triggers downstream call to ${tgtName}`,
      });
    }
  });

  return {
    incoming: deduplicateTraces(incoming),
    outgoing: deduplicateTraces(outgoing),
  };
}

/**
 * Traverses incoming & outgoing connections for an Event Producer
 */
export function resolveProducerTrace(
  serviceNode: BackendNode,
  publishedEvent: AnyMessagingResource & {
    nodeId: string;
    variant: "publish" | "consume";
  },
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = [],
): EventTraceResult {
  const incoming: NodeConnectionDetail[] = [];
  const outgoing: NodeConnectionDetail[] = [];

  const evtName = publishedEvent.name || "event";
  const evtId = publishedEvent.id;

  // 1. Incoming: Triggered by internal route/logic
  incoming.push({
    nodeId: serviceNode.id,
    nodeName: serviceNode.data?.label || "Current Service",
    nodeType: "Internal Service Handler",
    detail: `Invoked by route handler or domain logic within ${serviceNode.data?.label || "Service"}`,
  });

  // 2. Outgoing: Which broker or downstream service consumes this?
  const outgoingEdges = allEdges.filter((e) => {
    if (e.source !== serviceNode.id) return false;
    const sh = e.sourceHandle || "";
    return (
      sh.includes(evtId) ||
      sh.includes(evtName) ||
      sh.startsWith("published-events") ||
      sh.startsWith("events-out")
    );
  });

  outgoingEdges.forEach((edge) => {
    const tgtNode = allNodes.find((n) => n.id === edge.target);
    if (!tgtNode) return;
    const tgtName = tgtNode.data?.label || tgtNode.id;
    const tgtTypeStr = tgtNode.type as string;

    if (
      [
        "kafka",
        "sqs",
        "redis-streams",
        "redis-pubsub",
        "pubsub",
        "eventstream",
        "queue",
      ].includes(tgtTypeStr)
    ) {
      // Find downstream consumers of this broker
      const brokerEdges = allEdges.filter((be) => be.source === tgtNode.id);
      const downstreamConsumers = brokerEdges
        .map((be) => allNodes.find((n) => n.id === be.target)?.data?.label)
        .filter(Boolean);

      outgoing.push({
        nodeId: tgtNode.id,
        nodeName: tgtName,
        nodeType: "Message Broker",
        detail: `Publishes topic/channel "${evtName}" to ${tgtName}`,
        dataContext:
          downstreamConsumers.length > 0
            ? `Subscribed Consumers: [${downstreamConsumers.join(", ")}]`
            : "Pushes event to broker queue",
      });
    } else if (tgtNode.type === "service") {
      outgoing.push({
        nodeId: tgtNode.id,
        nodeName: tgtName,
        nodeType: "Consumer Service",
        detail: `Consumed directly by ${tgtName}`,
      });
    } else {
      outgoing.push({
        nodeId: tgtNode.id,
        nodeName: tgtName,
        nodeType: tgtNode.type,
        detail: `Target destination ${tgtName}`,
      });
    }
  });

  if (outgoing.length === 0) {
    outgoing.push({
      nodeId: "event-broker",
      nodeName: "Messaging Broker / Queue",
      nodeType: "Message Broker",
      detail: `Publishes event topic "${evtName}"`,
      dataContext: `Event payload structure: ${publishedEvent.payloadSchema?.rawJson || "Object"}`,
    });
  }

  return {
    incoming: deduplicateTraces(incoming),
    outgoing: deduplicateTraces(outgoing),
  };
}
