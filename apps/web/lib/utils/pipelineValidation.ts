import { BackendNode, BackendEdge, Endpoint, AnyMessagingResource, KafkaTopic } from "@/types/canvas";
import { PipelineStepDraft } from "@/app/(canvas)/project/[projectId]/_components/config-sidebar/pipeline-step-editor/types";
import { toFolderName, toPascalCase } from "@/lib/compiler/utils";

/**
 * Returns all transformers (or transformer refs) connected via canvas edges to an endpoint or consumer.
 */
export function getConnectedTransformersForEndpoint(
  endpointOrConsumerId: string,
  serviceNodeId: string,
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = [],
) {
  const epHandle = `endpoint-in-${endpointOrConsumerId}`;
  const evHandle = `consumedEvents-in-${endpointOrConsumerId}`;

  const connectedEdges = allEdges.filter(
    (e) =>
      e.target === serviceNodeId &&
      (e.targetHandle === epHandle ||
        e.targetHandle === evHandle ||
        e.targetHandle === endpointOrConsumerId),
  );

  return connectedEdges
    .map((edge) => {
      const sourceNode = allNodes.find((n) => n.id === edge.source);
      if (!sourceNode) return null;

      if (sourceNode.type === "transformer") {
        const functionName =
          sourceNode.data?.functionName || sourceNode.data?.label || "transformData";
        return {
          id: sourceNode.id,
          nodeId: sourceNode.id,
          functionName,
          isGlobal: sourceNode.data?.scope === "global",
          inputSchema: sourceNode.data?.inputSchema || [],
          returnSchema: sourceNode.data?.returnSchema || [],
          sourceNode,
        };
      }

      if (sourceNode.type === "transformer_ref") {
        const refTarget = sourceNode.data?.transformerRef;
        const master = allNodes.find(
          (m) =>
            m.type === "transformer" &&
            (m.id === refTarget ||
              m.data?.functionName === refTarget ||
              m.data?.label === refTarget),
        );
        const functionName =
          master?.data?.functionName ||
          master?.data?.label ||
          sourceNode.data?.label?.replace(/\s*\(Ref\)$/i, "") ||
          "transformData";

        return {
          id: sourceNode.id,
          nodeId: sourceNode.id,
          masterId: master?.id,
          functionName,
          isGlobal: true,
          inputSchema: master?.data?.inputSchema || [],
          returnSchema: master?.data?.returnSchema || [],
          sourceNode,
        };
      }

      return null;
    })
    .filter(Boolean) as Array<{
    id: string;
    nodeId: string;
    masterId?: string;
    functionName: string;
    isGlobal: boolean;
    inputSchema: any[];
    returnSchema: any[];
    sourceNode: BackendNode;
  }>;
}

/**
 * Returns all Kafka messaging nodes / topics connected via canvas edges or published events to an endpoint.
 */
export function getConnectedKafkaForEndpoint(
  endpointId: string,
  serviceNodeId: string,
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = [],
  endpoint?: Endpoint,
) {
  const kafkaNodes = allNodes.filter(
    (n) =>
      n.type === "kafka" ||
      n.type === "eventstream" ||
      (n.type === "queue" &&
        n.data?.implementation?.toLowerCase() === "kafka"),
  );
  if (kafkaNodes.length === 0) return [];
  const kafkaNodeIds = new Set(kafkaNodes.map((k) => k.id));

  const results: Array<{
    id: string;
    brokerNodeId: string;
    brokerNode: BackendNode;
    topicId?: string;
    topicName: string;
    packageFolder: string;
    functionName: string;
    importPath: string;
    publisherName: string;
  }> = [];
  const seen = new Set<string>();

  // 1. Direct or handle-based edges between endpoint/service and Kafka
  const epOutHandle = `endpoint-out-${endpointId}`;
  allEdges.forEach((edge) => {
    if (!edge) return;
    const isFromThisEndpoint =
      (edge.source === serviceNodeId &&
        (edge.sourceHandle === epOutHandle ||
          edge.sourceHandle === endpointId ||
          (edge.sourceHandle?.startsWith("publishedEvents-out-") &&
            endpoint?.publishedEvents?.some(
              (pe) => edge.sourceHandle === `publishedEvents-out-${pe.id}`,
            )))) ||
      (edge.target === serviceNodeId &&
        (edge.targetHandle === epOutHandle || edge.targetHandle === endpointId));

    const kafkaNodeId = isFromThisEndpoint
      ? kafkaNodeIds.has(edge.target)
        ? edge.target
        : kafkaNodeIds.has(edge.source)
        ? edge.source
        : null
      : null;

    if (kafkaNodeId) {
      const brokerNode = kafkaNodes.find((k) => k.id === kafkaNodeId);
      if (!brokerNode) return;

      const topics: KafkaTopic[] = brokerNode.data?.topics || [];
      const handle = edge.targetHandle || edge.sourceHandle || "";
      const matchTopicId = handle.match(/^([^:]+):in:(.+)$/)?.[2] || handle;
      const matchedTopic =
        topics.find((t) => t.id === matchTopicId || t.name === matchTopicId) ||
        topics[0];

      const topicName = matchedTopic?.name || "events";
      const topicId = matchedTopic?.id || matchTopicId;
      const packageFolder = toFolderName(brokerNode.data?.label || "kafka");
      const key = `${brokerNode.id}:${topicId || topicName}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          id: key,
          brokerNodeId: brokerNode.id,
          brokerNode,
          topicId,
          topicName,
          packageFolder,
          functionName: `publish${toPascalCase(topicName)}`,
          importPath: `@workspace/${packageFolder}/publishers`,
          publisherName: `Publish ${topicName}`,
        });
      }
    }
  });

  // 2. Published events configured on this endpoint
  if (endpoint?.publishedEvents) {
    endpoint.publishedEvents.forEach((pub) => {
      if (pub.brokerNodeId && kafkaNodeIds.has(pub.brokerNodeId)) {
        const brokerNode = kafkaNodes.find((k) => k.id === pub.brokerNodeId);
        if (!brokerNode) return;

        const topics: KafkaTopic[] = brokerNode.data?.topics || [];
        const matchedTopic =
          topics.find(
            (t) =>
              t.id === pub.messagingResourceId ||
              t.name === pub.messagingResourceId,
          ) || topics[0];

        const topicName =
          matchedTopic?.name ||
          pub.name?.replace(/^Publish\s+/i, "") ||
          "events";
        const topicId = pub.messagingResourceId || matchedTopic?.id;
        const packageFolder = toFolderName(brokerNode.data?.label || "kafka");
        const key = `${brokerNode.id}:${topicId || topicName}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            id: key,
            brokerNodeId: brokerNode.id,
            brokerNode,
            topicId,
            topicName,
            packageFolder,
            functionName: `publish${toPascalCase(topicName)}`,
            importPath: `@workspace/${packageFolder}/publishers`,
            publisherName: pub.name || `Publish ${topicName}`,
          });
        }
      }
    });
  }

  return results;
}

/**
 * Validates if an individual pipeline step has missing / unconfigured input bindings.
 */
export function isStepInputUnconfigured(
  step: PipelineStepDraft,
  allNodes: BackendNode[] = [],
): boolean {
  if (step.enabled === false) return false;
  if (step.type === "return_response") return false;

  // 1. Transformer Step validation
  if (step.type === "transform") {
    if (!step.functionRef?.name) return true;

    // Resolve input schema from step or from graph nodes
    let inputSchema = step.functionRef.inputSchema;
    if (!inputSchema || inputSchema.length === 0) {
      const tNode = allNodes.find(
        (n) =>
          (n.type === "transformer" || n.type === "transformer_ref") &&
          (n.id === step.functionRef?.name ||
            n.data?.functionName === step.functionRef?.name ||
            n.data?.label === step.functionRef?.name),
      );
      if (tNode) {
        if (tNode.type === "transformer_ref" && tNode.data?.transformerRef) {
          const master = allNodes.find(
            (m) =>
              m.id === tNode.data?.transformerRef ||
              m.data?.functionName === tNode.data?.transformerRef ||
              m.data?.label === tNode.data?.transformerRef,
          );
          inputSchema = master?.data?.inputSchema || [];
        } else {
          inputSchema = tNode.data?.inputSchema || [];
        }
      }
    }

    const bindings = step.inputBindings || [];

    // If transformer has expected input schema fields
    if (inputSchema && inputSchema.length > 0) {
      if (bindings.length === 0) return true;

      const requiredFields = inputSchema.filter((f) => f.required !== false);
      const fieldsToCheck = requiredFields.length > 0 ? requiredFields : inputSchema;

      for (const field of fieldsToCheck) {
        const binding = bindings.find(
          (b) => b.argName.toLowerCase() === field.name.toLowerCase(),
        );
        if (!binding || !binding.source || !binding.source.kind) {
          return true;
        }
      }
    } else {
      // If no explicit schema fields, check if bindings exist or if empty
      if (bindings.length === 0) {
        return true;
      }
    }

    return false;
  }

  // 2. Database Operation Step validation
  if (step.type === "db_operation") {
    if (!step.tableNodeId && !step.databaseId) return true;
    const op = (step.operationId || step.functionRef?.name || "").toLowerCase();
    if (
      op.includes("create") ||
      op.includes("insert") ||
      op.includes("update") ||
      op.includes("byid") ||
      op.includes("findone") ||
      op.includes("delete")
    ) {
      if (!step.inputBindings || step.inputBindings.length === 0) {
        return true;
      }
    }
    return false;
  }

  // 3. Redis Operation Step validation
  if (step.type === "redis_operation") {
    if (!step.operationId && !step.functionRef?.name) return true;
    if (!step.inputBindings || step.inputBindings.length === 0) return true;
    return false;
  }

  // 4. Kafka Publish Step validation
  if (step.type === "kafka_publish") {
    if (!step.operationId && !step.functionRef?.name) return true;
    if (!step.inputBindings || step.inputBindings.length === 0) return true;
    return false;
  }

  return false;
}

/**
 * Checks if an endpoint or event consumer has an unconfigured or incomplete pipeline.
 * Returns true if the pipeline is incomplete/unconfigured (should be rendered in RED).
 */
export function isEndpointPipelineUnconfigured(
  endpointOrConsumer: {
    id: string;
    pipelineSteps?: PipelineStepDraft[];
  },
  serviceNodeId: string,
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = [],
): boolean {
  const steps = endpointOrConsumer.pipelineSteps || [];

  // Check 1: Are there any existing steps in the pipeline with unconfigured inputs?
  const hasUnconfiguredStep = steps
    .filter((s) => s.type !== "return_response")
    .some((s) => isStepInputUnconfigured(s, allNodes));

  if (hasUnconfiguredStep) return true;

  // Check 2: Are there transformers connected via canvas edges to this endpoint/consumer?
  const connectedTransformers = getConnectedTransformersForEndpoint(
    endpointOrConsumer.id,
    serviceNodeId,
    allNodes,
    allEdges,
  );

  if (connectedTransformers.length > 0) {
    for (const ct of connectedTransformers) {
      const matchingStep = steps.find(
        (s) =>
          s.type === "transform" &&
          (s.functionRef?.name === ct.functionName ||
            s.transformerNodeId === ct.id),
      );

      // If the connected transformer hasn't been added to the steps, or its inputs are unconfigured
      if (!matchingStep || isStepInputUnconfigured(matchingStep, allNodes)) {
        return true;
      }
    }
  }

  // Check 3: Are there Kafka brokers connected via canvas edges to this endpoint?
  const connectedKafka = getConnectedKafkaForEndpoint(
    endpointOrConsumer.id,
    serviceNodeId,
    allNodes,
    allEdges,
    endpointOrConsumer as any,
  );

  if (connectedKafka.length > 0) {
    for (const ck of connectedKafka) {
      const matchingStep = steps.find(
        (s) =>
          s.type === "kafka_publish" &&
          (s.functionRef?.name === ck.functionName ||
            (s as any).brokerNodeId === ck.brokerNodeId ||
            (s as any).messagingResourceId === ck.topicId),
      );

      if (!matchingStep || isStepInputUnconfigured(matchingStep, allNodes)) {
        return true;
      }
    }
  }

  return false;
}
