// ═══════════════════════════════════════════════════════════════
// MODULE: KafkaEmitter
// LAYER:  generators / routeGenerator / handlers
// EMITS:  publishKafkaEvent() calls when an endpoint is tied to message broker events
// ═══════════════════════════════════════════════════════════════

import { Endpoint, AnyMessagingResource, ReusableFunction } from "@workspace/canvas/types";
import { BackendNode } from "@/types/canvas";
import { toKafkaTopicKey } from "../kafkaResolver";

export interface KafkaEmitterParams {
  pickedKafka: ReusableFunction | null;
  codeBlock: string;
  ep: Endpoint & { nodeId: string };
  nodePublishedEvents: (AnyMessagingResource & { nodeId: string; variant: "publish" | "consume" })[];
  rawName: string;
  allNodes: BackendNode[];
  method: string;
  path: string;
  payloadVar: string;
}

/**
 * Emits legacy auto-inferred Kafka event publishing statements.
 */
export function emitKafkaPublish(params: KafkaEmitterParams): string {
  const {
    pickedKafka,
    codeBlock,
    ep,
    nodePublishedEvents,
    rawName,
    allNodes,
    method,
    path,
    payloadVar,
  } = params;

  const hasKafkaInCodeBlock = Boolean(
    codeBlock && codeBlock.includes("publishKafkaEvent"),
  );

  if (!pickedKafka || hasKafkaInCodeBlock) {
    return "";
  }

  const allPublished = [
    ...(ep.publishedEvents || []),
    ...nodePublishedEvents,
  ];

  const matchedEvent =
    allPublished.find((e) =>
      rawName.toLowerCase().includes((e.name || "").toLowerCase()) ||
      (e.name || "").toLowerCase().includes(rawName.toLowerCase()),
    ) ?? allPublished[0];

  let resolvedTopicName: string | undefined;

  if (matchedEvent) {
    const brokerId =
      "brokerNodeId" in matchedEvent && typeof matchedEvent.brokerNodeId === "string"
        ? matchedEvent.brokerNodeId
        : undefined;
    const resourceId =
      "messagingResourceId" in matchedEvent && typeof matchedEvent.messagingResourceId === "string"
        ? matchedEvent.messagingResourceId
        : undefined;

    if (brokerId && resourceId) {
      const brokerNode = allNodes.find((n) => n.id === brokerId);
      const topics = brokerNode?.data?.topics;
      const topicRes = Array.isArray(topics)
        ? topics.find((t: { id?: string; name?: string }) => t.id === resourceId)
        : undefined;
      if (topicRes?.name) {
        resolvedTopicName = topicRes.name;
      }
    }

    if (!resolvedTopicName && matchedEvent.name) {
      for (const node of allNodes) {
        const topics = node.data?.topics;
        const t = Array.isArray(topics)
          ? topics.find((top: { name?: string }) => top.name === matchedEvent.name)
          : undefined;
        if (t?.name) {
          resolvedTopicName = t.name;
          break;
        }
      }
    }
  }

  if (!resolvedTopicName) {
    for (const node of allNodes) {
      if (node.type === "kafka") {
        const topics = node.data?.topics;
        const firstTopicName = Array.isArray(topics)
          ? (topics[0] as { name?: string } | undefined)?.name
          : undefined;
        if (firstTopicName) {
          resolvedTopicName = firstTopicName;
          break;
        }
      }
    }
  }

  const topicName = resolvedTopicName || matchedEvent?.name || rawName;
  const topicKey = toKafkaTopicKey(topicName);
  const topicRef = `KAFKA_TOPICS.${topicKey}`;

  let code = `    // --- Kafka Event Publish ---\n`;
  code += `    await publishKafkaEvent(\n`;
  code += `      ${topicRef},\n`;
  code += `      { action: "${method}", path: "${path}", payload: ${payloadVar} },\n`;
  code += `    );\n\n`;

  return code;
}
