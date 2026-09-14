import { PipelineStep } from "@workspace/canvas/types";
import { toFolderName, toVarName } from "@/lib/compiler/utils";
import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";
import { ConnectionContext } from "../types";

/**
 * Handles connections between ServiceNode (endpoint or consumer event) and RedisCacheNode:
 * 1. Endpoint -> RedisCacheNode (or reverse): auto-adds a `redis_operation` step to the endpoint's pipelineSteps.
 * 2. Consumed Event -> RedisCacheNode (or reverse): auto-adds a `redis_operation` step to the event's pipelineSteps.
 *
 * @returns boolean `false` as direct canvas edge is preserved for visual route wiring.
 */
export function handleRedisCacheConnect({
  get,
  connection,
  sourceNode,
  targetNode,
}: ConnectionContext): boolean {
  const isSourceService = sourceNode.type === "service";
  const isTargetRedisCache = targetNode.type === "redis-cache";
  const isSourceRedisCache = sourceNode.type === "redis-cache";
  const isTargetService = targetNode.type === "service";

  if (
    !(
      (isSourceService && isTargetRedisCache) ||
      (isSourceRedisCache && isTargetService)
    )
  ) {
    return false;
  }

  const serviceNode = isSourceService ? sourceNode : targetNode;
  const cacheNode = isTargetRedisCache ? targetNode : sourceNode;
  const serviceHandle = isSourceService
    ? connection.sourceHandle
    : connection.targetHandle;

  // 1. Resolve endpoint or consumer event from serviceHandle
  let endpointId: string | null = null;
  let consumedEventId: string | null = null;

  if (serviceHandle?.startsWith("endpoint-out-")) {
    endpointId = serviceHandle.replace("endpoint-out-", "");
  } else if (serviceHandle?.startsWith("endpoint-in-")) {
    endpointId = serviceHandle.replace("endpoint-in-", "");
  } else if (serviceHandle?.startsWith("consumedEvents-out-")) {
    consumedEventId = serviceHandle.replace("consumedEvents-out-", "");
  } else if (serviceHandle?.startsWith("consumedEvents-in-")) {
    consumedEventId = serviceHandle.replace("consumedEvents-in-", "");
  } else if (serviceHandle) {
    const matchingEp = get().endpoints.find(
      (e) => e.nodeId === serviceNode.id && e.id === serviceHandle,
    );
    if (matchingEp) {
      endpointId = matchingEp.id;
    } else {
      const matchingEv = get().events.find(
        (e) => e.nodeId === serviceNode.id && e.id === serviceHandle,
      );
      if (matchingEv) {
        consumedEventId = matchingEv.id;
      }
    }
  }

  // Fallback: if no specific handle was matched, target the first endpoint of the service
  if (!endpointId && !consumedEventId) {
    const firstEp = get().endpoints.find((e) => e.nodeId === serviceNode.id);
    if (firstEp) {
      endpointId = firstEp.id;
    }
  }

  const allNodes = get().nodes;
  const schemaRef = cacheNode.data?.schemaRef;
  const targetSchemaNode = allNodes.find((n) => n.id === schemaRef) || cacheNode;
  const instanceId = cacheNode.data?.databaseId || targetSchemaNode?.data?.databaseId;
  const targetInstanceNode = allNodes.find((n) => n.id === instanceId);
  const instanceLabel = targetInstanceNode?.data?.label || "primary-redis-cache";
  const importPath = `@workspace/${toFolderName(instanceLabel)}`;

  const ops = getEntityDbOperations(targetSchemaNode, allNodes);
  const defaultOp = ops[0];
  const tableNodeId = schemaRef || cacheNode.id;

  // 2. Add step to Endpoint
  if (endpointId) {
    const endpoint = get().endpoints.find((e) => e.id === endpointId);
    if (!endpoint) return false;

    const existingSteps = endpoint.pipelineSteps || [];
    const hasMatchingStep = existingSteps.some(
      (s) =>
        s.type === "redis_operation" &&
        (s.tableNodeId === tableNodeId || s.tableNodeId === cacheNode.id),
    );

    if (!hasMatchingStep) {
      const stepNum =
        existingSteps.filter((s) => s.type !== "return_response").length + 1;
      const varName = defaultOp
        ? `${toVarName(defaultOp.name)}Result`
        : `cachedResult${stepNum > 1 ? stepNum : ""}`;

      const newRedisStep: PipelineStep = {
        id: `step-redis-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: varName,
        type: "redis_operation",
        enabled: true,
        outputVariable: varName,
        tableNodeId,
        databaseId: instanceId,
        operationId: defaultOp?.id,
        functionRef: defaultOp
          ? {
              name: defaultOp.name,
              importPath,
              signature: defaultOp.signature,
            }
          : undefined,
        inputBindings: [],
      };

      const returnIdx = existingSteps.findIndex(
        (s) => s.type === "return_response",
      );
      let nextPipelineSteps: PipelineStep[];
      if (returnIdx !== -1) {
        nextPipelineSteps = [
          ...existingSteps.slice(0, returnIdx),
          newRedisStep,
          ...existingSteps.slice(returnIdx),
        ];
      } else {
        nextPipelineSteps = [...existingSteps, newRedisStep];
      }

      get().updateEndpoint(endpointId, {
        pipelineSteps: nextPipelineSteps,
      });
    }
  }

  // 3. Add step to Consumed Event
  if (consumedEventId) {
    const event = get().events.find((e) => e.id === consumedEventId);
    if (!event) return false;

    const existingSteps = event.pipelineSteps || [];
    const hasMatchingStep = existingSteps.some(
      (s) =>
        s.type === "redis_operation" &&
        (s.tableNodeId === tableNodeId || s.tableNodeId === cacheNode.id),
    );

    if (!hasMatchingStep) {
      const stepNum = existingSteps.length + 1;
      const varName = defaultOp
        ? `${toVarName(defaultOp.name)}Result`
        : `cachedResult${stepNum > 1 ? stepNum : ""}`;

      const newRedisStep: PipelineStep = {
        id: `step-redis-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: varName,
        type: "redis_operation",
        enabled: true,
        outputVariable: varName,
        tableNodeId,
        databaseId: instanceId,
        operationId: defaultOp?.id,
        functionRef: defaultOp
          ? {
              name: defaultOp.name,
              importPath,
              signature: defaultOp.signature,
            }
          : undefined,
        inputBindings: [],
      };

      get().updateEvent(consumedEventId, {
        pipelineSteps: [...existingSteps, newRedisStep],
      });
    }
  }

  // 4. Update targetServiceId on cacheNode if not set
  if (!cacheNode.data?.targetServiceId) {
    get().updateNode(cacheNode.id, {
      data: {
        ...cacheNode.data,
        targetServiceId: serviceNode.id,
      },
    });
  }

  return false;
}
