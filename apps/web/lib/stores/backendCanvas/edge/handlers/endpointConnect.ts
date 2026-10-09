import {
  DEFAULT_PUBLISH_TRIGGER_CONDITION,
  DEFAULT_PUBLISHED_EVENT_DEFAULTS,
} from "@workspace/canvas";
import {
  PipelineStep,
  PipelineStepInputSource,
  PipelineStepInputBinding,
  Endpoint,
} from "@workspace/canvas/types";
import { toFolderName, toPascalCase, toVarName } from "@/lib/compiler/utils";
import {
  getStorageOperations,
  computeStorageOpBindings,
} from "@/lib/utils/storageOperationsHelper";
import { ConnectionContext } from "../types";
import {
  isMessagingResourceType,
  MESSAGING_NODE_TYPES,
  isStorageRefNode,
} from "../utils";
import { toast } from "sonner";
import { PageSection } from "@/types/canvas";

/**
 * Handles endpoint connections:
 * 1. StorageRef -> Service endpoint: auto-provisions storage_operation pipeline step on endpoint
 * 2. Endpoint -> Database/DB_ref node: syncs databaseNodeIds on endpoint
 * 3. Endpoint -> StorageRef node: syncs storage_operation pipeline step on endpoint (reverse)
 * 4. Endpoint -> Messaging node: auto-creates publisher event and pipeline step,
 *    updates endpoint, and cleans up direct ReactFlow edge.
 *
 * @returns boolean `true` if direct edge was intercepted and rewired (messaging target), `false` otherwise.
 */
export function handleEndpointConnect({
  set,
  get,
  connection,
  sourceNode,
  targetNode,
  newEdge,
}: ConnectionContext): boolean {
  // 0. Storage Operation Ref (source) → Service Endpoint (target)
  // Flow: webpage action -> storageref operation -> service endpoint
  const isStorageRefSource = isStorageRefNode(sourceNode.type);
  const isServiceTarget = targetNode.type === "service";
  const targetHandle = connection.targetHandle || "";
  const isTargetEndpoint =
    targetHandle.startsWith("endpoint-in-") ||
    targetHandle.startsWith("endpoints-in-") ||
    targetHandle.startsWith("routeEndpoints-in-") ||
    targetHandle.startsWith("endpoint-out-") ||
    targetHandle.startsWith("endpoints-out-") ||
    targetHandle.startsWith("routeEndpoints-out-");

  if (isStorageRefSource && isServiceTarget && isTargetEndpoint) {
    const endpointId = targetHandle.replace(
      /^(?:routeEndpoints|endpoints|endpoint)-(?:in|out)-/,
      "",
    );
    const sourceHandle = connection.sourceHandle || "";
    const fnName =
      sourceHandle
        .replace(/^func-out-/, "")
        .replace(/^func-(?:in-)?/, "") || "uploadObject";
    const storageNodeId = sourceNode.data?.storageNodeId;
    const bucketName =
      sourceNode.data?.bucketId ||
      sourceNode.data?.bucketName ||
      "default-bucket";

    const endpoint =
      get().endpoints.find((e) => e.id === endpointId) ||
      targetNode.data?.endpoints?.find((e: any) => e.id === endpointId);

    if (endpoint) {
      const existingSteps = endpoint.pipelineSteps ?? [];
      const hasMatchingStep = existingSteps.some(
        (s) =>
          s.type === "storage_operation" &&
          (s.functionRef?.name === fnName || s.operationId === fnName) &&
          (s.storageNodeId === storageNodeId || s.bucketId === bucketName),
      );

      if (!hasMatchingStep) {
        const storageNode = get().nodes.find((n) => n.id === storageNodeId);
        const ops = getStorageOperations(storageNode);
        const op =
          ops.find((o) => o.name === fnName || o.id === fnName) || ops[0];
        const rawLabel = storageNode?.data?.label || "storage";
        const packageFolder = toFolderName(rawLabel) || "storage";
        const nextBindings = computeStorageOpBindings(op, [], bucketName);
        const newStep: PipelineStep = {
          id: `step-storage-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: op?.label || op?.name || "Storage Operation",
          type: "storage_operation",
          enabled: true,
          outputVariable:
            op?.kind === "presign_upload" ? "uploadUrl" : "storageResult",
          storageNodeId,
          brokerNodeId: storageNodeId,
          bucketId: bucketName,
          operationId: op?.id,
          functionRef: {
            name: op?.name || fnName,
            importPath: "@workspace/storage/operations",
            signature: op?.signature,
          },
          inputBindings: nextBindings,
        };
        const returnIdx = existingSteps.findIndex(
          (s) => s.type === "return_response",
        );
        const nextPipelineSteps =
          returnIdx !== -1
            ? [
                ...existingSteps.slice(0, returnIdx),
                newStep,
                ...existingSteps.slice(returnIdx),
              ]
            : [...existingSteps, newStep];

        get().updateEndpoint(endpointId, {
          pipelineSteps: nextPipelineSteps,
        });

        // Enrich newEdge data
        const currentEdges = get().edges;
        set({
          edges: currentEdges.map((e) =>
            e.id === newEdge.id
              ? {
                  ...e,
                  data: {
                    ...e.data,
                    isStorageOperation: true,
                    operationName: fnName,
                    bucketId: bucketName,
                    storageNodeId,
                  },
                }
              : e,
          ),
        });

        // Link any WebPage action connected to this storage ref operation
        const webPageNodes = get().nodes.filter((n) => n.type === "webPage");
        webPageNodes.forEach((wp) => {
          const wpSections: PageSection[] = wp.data?.sections || [];
          let wpChanged = false;
          const nextSections = wpSections.map((sec) => {
            const nextActions = (sec.actions || []).map((act) => {
              if (
                act.storageOperationBinding?.refNodeId === sourceNode.id &&
                (act.storageOperationBinding.operationName === fnName ||
                  act.storageOperationBinding.operationName === op?.name)
              ) {
                wpChanged = true;
                return {
                  ...act,
                  storageOperationBinding: {
                    ...act.storageOperationBinding,
                    endpointId,
                    serviceNodeId: targetNode.id,
                  },
                };
              }
              return act;
            });
            return { ...sec, actions: nextActions };
          });
          if (wpChanged) {
            get().updateNode(wp.id, {
              data: {
                ...wp.data,
                sections: nextSections,
                presignEndpointId:
                  op?.kind === "presign_upload"
                    ? endpointId
                    : wp.data?.presignEndpointId,
              },
            });
          }
        });

        toast.success(
          `Linked bucket operation "${op?.name || fnName}" to endpoint "${endpoint.name || endpoint.type || "endpoint"}"`,
        );
      }
    }
  }

  // 0b. Service Endpoint (source) → Service Endpoint (target) [Inter-Service API Call]
  const isSourceServiceNode =
    sourceNode.type === "service" ||
    sourceNode.type === "serverless" ||
    sourceNode.type === "worker" ||
    Boolean(sourceNode.data?.endpoints);

  const isTargetServiceNode =
    targetNode.type === "service" ||
    targetNode.type === "serverless" ||
    targetNode.type === "worker" ||
    Boolean(targetNode.data?.endpoints);

  if (isSourceServiceNode && isTargetServiceNode && sourceNode.id !== targetNode.id) {
    const srcHandle = connection.sourceHandle || "";
    const tgtHandle = connection.targetHandle || "";

    const parseEpHandle = (handle: string) => {
      const outMatch =
        handle.match(/^(?:routeEndpoints|endpoints|endpoint)-out-(.+)$/) ||
        handle.match(/^func-out-(.+)$/);
      if (outMatch && outMatch[1]) {
        return { isEndpoint: true, isOut: true, isIn: false, epId: outMatch[1] };
      }
      const inMatch =
        handle.match(/^(?:routeEndpoints|endpoints|endpoint)-in-(.+)$/) ||
        handle.match(/^func-in-(.+)$/) ||
        handle.match(/^func-(.+)$/);
      if (inMatch && inMatch[1]) {
        return { isEndpoint: true, isOut: false, isIn: true, epId: inMatch[1] };
      }
      return { isEndpoint: false, isOut: false, isIn: false, epId: "" };
    };

    const parsedSrc = parseEpHandle(srcHandle);
    const parsedTgt = parseEpHandle(tgtHandle);

    let callerNode = sourceNode;
    let callerEpId = parsedSrc.epId;
    let calleeNode = targetNode;
    let calleeEpId = parsedTgt.epId;

    if (parsedSrc.isIn && parsedTgt.isOut) {
      callerNode = targetNode;
      callerEpId = parsedTgt.epId;
      calleeNode = sourceNode;
      calleeEpId = parsedSrc.epId;
    }

    const allStoreEndpoints = get().endpoints;
    const callerEndpoints: Endpoint[] =
      allStoreEndpoints.filter((e) => e.nodeId === callerNode.id).length > 0
        ? allStoreEndpoints.filter((e) => e.nodeId === callerNode.id)
        : callerNode.data?.endpoints || [];

    const callerEp =
      allStoreEndpoints.find((e) => e.id === callerEpId) ||
      callerEndpoints.find((e) => e.id === callerEpId || e.name === callerEpId) ||
      callerEndpoints[0];

    const calleeEndpoints: Endpoint[] =
      allStoreEndpoints.filter((e) => e.nodeId === calleeNode.id).length > 0
        ? allStoreEndpoints.filter((e) => e.nodeId === calleeNode.id)
        : calleeNode.data?.endpoints || [];

    const calleeEp =
      allStoreEndpoints.find((e) => e.id === calleeEpId) ||
      calleeEndpoints.find((e) => e.id === calleeEpId || e.name === calleeEpId) ||
      calleeEndpoints[0];

    if (callerEp && calleeEp) {
      const existingSteps = callerEp.pipelineSteps ?? [];
      const serviceLabel = calleeNode.data?.label || "service";
      const pascalService = toPascalCase(serviceLabel);
      const serviceFolder = calleeNode.data?.serviceFolder;
      const folderName = serviceFolder || toFolderName(serviceLabel);
      const rawEpName = calleeEp.name?.replace(/[^a-zA-Z0-9]/g, "") || "call";
      const method = calleeEp.type || "GET";
      const methodLower = method.toLowerCase();
      const cleanedEpName = rawEpName.toLowerCase().startsWith(methodLower)
        ? rawEpName.slice(methodLower.length)
        : rawEpName;
      const pascalEp = toPascalCase(`${methodLower}_${cleanedEpName || "call"}`);
      const fnName = `call${pascalService}${pascalEp}`;
      const opId = `call-${serviceLabel}-${rawEpName}`;

      const hasMatchingStep = existingSteps.some(
        (s) =>
          s.type === "service_call" &&
          ((s.databaseId === calleeNode.id &&
            (s.tableNodeId === calleeEp.id || s.operationId === opId)) ||
            (s.tableNodeId === calleeEp.id && s.functionRef?.name === fnName) ||
            s.externalEndpointId === calleeEp.id),
      );

      if (!hasMatchingStep) {
        const stepNum =
          existingSteps.filter((s) => s.type !== "return_response").length + 1;
        const baseVar = calleeEp.name
          ? `${toVarName(calleeEp.name)}Result`
          : `${toVarName(serviceLabel)}Response`;
        const outputVar = existingSteps.some((s) => s.outputVariable === baseVar)
          ? `${baseVar}${stepNum}`
          : baseVar;

        const defaultBindings: PipelineStepInputBinding[] = [];
        if (calleeEp.pathParams && calleeEp.pathParams.length > 0) {
          calleeEp.pathParams.forEach((p: any) => {
            if (p?.name?.trim()) {
              defaultBindings.push({
                argName: p.name.trim(),
                source: { kind: "req_body", field: p.name.trim() },
              });
            }
          });
        }
        if (calleeEp.queryParams && calleeEp.queryParams.length > 0) {
          calleeEp.queryParams.forEach((q: any) => {
            if (q?.name?.trim()) {
              defaultBindings.push({
                argName: q.name.trim(),
                source: { kind: "req_query", field: q.name.trim() },
              });
            }
          });
        }
        if (calleeEp.requestBody?.fields && calleeEp.requestBody.fields.length > 0) {
          calleeEp.requestBody.fields.forEach((f: any) => {
            if (f?.name?.trim()) {
              defaultBindings.push({
                argName: f.name.trim(),
                source: { kind: "req_body", field: f.name.trim() },
              });
            }
          });
        }

        const newStep: PipelineStep = {
          id: `step-service-call-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: `Call ${serviceLabel} ${calleeEp.name || "Endpoint"}`,
          type: "service_call",
          enabled: true,
          outputVariable: outputVar,
          databaseId: calleeNode.id,
          tableNodeId: calleeEp.id,
          operationId: opId,
          functionRef: {
            name: fnName,
            importPath: `@workspace/services/${folderName}`,
            path: `@workspace/services/${folderName}`,
            signature: `call${pascalService}${pascalEp}(params?: Record<string, unknown>, body?: Record<string, unknown>): Promise<unknown>`,
          },
          inputBindings: defaultBindings,
        };

        const returnIdx = existingSteps.findIndex(
          (s) => s.type === "return_response",
        );
        const nextPipelineSteps =
          returnIdx !== -1
            ? [
                ...existingSteps.slice(0, returnIdx),
                newStep,
                ...existingSteps.slice(returnIdx),
              ]
            : [...existingSteps, newStep];

        get().updateEndpoint(callerEp.id, {
          pipelineSteps: nextPipelineSteps,
        });

        // Enrich newEdge data
        const currentEdges = get().edges;
        set({
          edges: currentEdges.map((e) =>
            e.id === newEdge.id
              ? {
                  ...e,
                  data: {
                    ...e.data,
                    isServiceCall: true,
                    targetServiceId: calleeNode.id,
                    targetEndpointId: calleeEp.id,
                    sourceEndpointId: callerEp.id,
                  },
                }
              : e,
          ),
        });

        toast.success(
          `Added endpoint request step to "${callerEp.name || callerEp.type || "endpoint"}" calling "${serviceLabel}" [${method} ${calleeEp.name || "/"}]`,
        );
      }
    }
  }

  const isEndpointConnect =
    connection.sourceHandle?.startsWith("endpoint-out-") ||
    connection.sourceHandle?.startsWith("endpoints-out-") ||
    connection.sourceHandle?.startsWith("routeEndpoints-out-") ||
    connection.sourceHandle?.startsWith("func-out-");

  if (!isEndpointConnect || !connection.sourceHandle || !connection.target) {
    return false;
  }

  const endpointId = connection.sourceHandle
    .replace(/^(?:routeEndpoints|endpoints|endpoint)-out-/, "")
    .replace(/^func-out-/, "");

  // 1. Endpoint → DB / DB_Ref node
  if (targetNode.type === "db_ref" || targetNode.type === "database") {
    const endpoint = get().endpoints.find((e) => e.id === endpointId);
    if (endpoint) {
      const currentDbIds =
        endpoint.databaseNodeIds ||
        (endpoint.databaseNodeId && endpoint.databaseNodeId !== "none"
          ? [endpoint.databaseNodeId]
          : []);
      if (!currentDbIds.includes(connection.target)) {
        const newDbIds = [...currentDbIds, connection.target];
        get().updateEndpoint(endpointId, {
          databaseNodeIds: newDbIds,
          databaseNodeId: newDbIds[0] || "none",
        });
      }
    }
  }

  // 1b. Endpoint → Storage Operation Ref node
  if (
    targetNode.type === "storage_operation_ref" ||
    targetNode.type === "storage_ref" ||
    targetNode.type === "bucket_ref" ||
    targetNode.type === "storage_bucket_ref" ||
    targetNode.type === "StorageBucketRefNode" ||
    targetNode.type === "StorageOperationRefNode"
  ) {
    const endpoint = get().endpoints.find((e) => e.id === endpointId);
    if (endpoint) {
      const targetHandle = connection.targetHandle || "";
      const fnName = targetHandle.startsWith("func-")
        ? targetHandle.replace("func-", "")
        : "uploadObject";
      const storageNodeId = targetNode.data?.storageNodeId;
      const bucketName =
        targetNode.data?.bucketId ||
        targetNode.data?.bucketName ||
        "default-bucket";
      const existingSteps = endpoint.pipelineSteps ?? [];
      const hasMatchingStep = existingSteps.some(
        (s) =>
          s.type === "storage_operation" &&
          (s.functionRef?.name === fnName || s.operationId === fnName) &&
          (s.storageNodeId === storageNodeId || s.bucketId === bucketName),
      );

      if (!hasMatchingStep) {
        const storageNode = get().nodes.find((n) => n.id === storageNodeId);
        const ops = getStorageOperations(storageNode);
        const op =
          ops.find((o) => o.name === fnName || o.id === fnName) || ops[0];
        const rawLabel = storageNode?.data?.label || "storage";
        const packageFolder = toFolderName(rawLabel) || "storage";
        const nextBindings = computeStorageOpBindings(op, [], bucketName);
        const newStep: PipelineStep = {
          id: `step-storage-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: op?.label || op?.name || "Storage Operation",
          type: "storage_operation",
          enabled: true,
          outputVariable:
            op?.kind === "presign_upload" ? "uploadUrl" : "storageResult",
          storageNodeId,
          brokerNodeId: storageNodeId,
          bucketId: bucketName,
          operationId: op?.id,
          functionRef: {
            name: op?.name || fnName,
            importPath: "@workspace/storage/operations",
            signature: op?.signature,
          },
          inputBindings: nextBindings,
        };
        const returnIdx = existingSteps.findIndex(
          (s) => s.type === "return_response",
        );
        const nextPipelineSteps =
          returnIdx !== -1
            ? [
                ...existingSteps.slice(0, returnIdx),
                newStep,
                ...existingSteps.slice(returnIdx),
              ]
            : [...existingSteps, newStep];

        get().updateEndpoint(endpointId, {
          pipelineSteps: nextPipelineSteps,
        });
      }
    }
  }

  // 2. Endpoint → Messaging node: auto-create a publisher and rewire edge
  const isMessagingTarget = MESSAGING_NODE_TYPES.some(
    (t) => t === targetNode.type,
  );

  if (isMessagingTarget) {
    const endpoint = get().endpoints.find((e) => e.id === endpointId);
    if (!endpoint) return false;

    // Parse topic/resource ID from targetHandle, e.g. "topics:in:<topicId>"
    const targetHandle = connection.targetHandle ?? "";
    const resourceMatch = targetHandle.match(/^([^:]+):in:(.+)$/);
    const messagingResourceId = resourceMatch?.[2] ?? "";
    const rawResourceType = resourceMatch?.[1] ?? "";
    const resolvedResourceType = isMessagingResourceType(rawResourceType)
      ? rawResourceType
      : undefined;

    // Derive a human-readable publisher/writer name
    const endpointLabel =
      endpoint.name || `${endpoint.type ?? "endpoint"} publisher`;
    const isStorageTarget =
      targetNode.type === "storage" || resolvedResourceType === "buckets";
    const bucketList = targetNode.data.buckets || [];
    const topicList = targetNode.data.topics || [];
    const topicName = isStorageTarget
      ? (bucketList.find((b) => b.id === messagingResourceId)?.name ?? "")
      : (messagingResourceId
          ? topicList.find((t) => t.id === messagingResourceId)?.name ?? ""
          : "");
    const publisherName = isStorageTarget
      ? (topicName ? `Upload to ${topicName}` : `${endpointLabel} storage writer`)
      : (topicName ? `Publish ${topicName}` : `${endpointLabel} publisher`);

    // Build the new publisher / writer resource
    const newEventId = `pub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newPublisher = {
      id: newEventId,
      name: publisherName,
      publishedWhen: DEFAULT_PUBLISH_TRIGGER_CONDITION,
      brokerNodeId: targetNode.id,
      messagingResourceId,
      ...DEFAULT_PUBLISHED_EVENT_DEFAULTS,
      ...(resolvedResourceType ? { resourceType: resolvedResourceType } : {}),
    };

    // Auto-add Storage / Messaging publish step to pipelineSteps
    const existingSteps = endpoint.pipelineSteps ?? [];
    const rawLabel = targetNode.data?.label || (isStorageTarget ? "storage" : "kafka");
    const packageFolder = toFolderName(rawLabel) || (isStorageTarget ? "storage" : "kafka");

    if (isStorageTarget) {
      const storageFnName = topicName
        ? `uploadTo${toPascalCase(topicName)}`
        : "uploadToStorage";
      const hasMatchingStorageStep = existingSteps.some(
        (s) =>
          s.brokerNodeId === targetNode.id ||
          s.messagingResourceId === messagingResourceId ||
          s.name === publisherName,
      );

      let nextPipelineSteps = existingSteps;
      if (!hasMatchingStorageStep) {
        const newStorageStep: PipelineStep = {
          id: `step-storage-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: publisherName,
          type: "storage_operation",
          enabled: true,
          outputVariable: "storageUploadResult",
          storageNodeId: targetNode.id,
          brokerNodeId: targetNode.id,
          bucketId: topicName || "default-bucket",
          operationId: "storage-uploadObject",
          functionRef: {
            name: "uploadObject",
            importPath: "@workspace/storage/operations",
          },
          inputBindings: [
            {
              argName: "bucketName",
              source: { kind: "inline", value: topicName || "default-bucket" },
            },
            {
              argName: "key",
              source: { kind: "req_body", field: "filename" },
            },
            {
              argName: "body",
              source: { kind: "req_body", field: "file" },
            },
          ],
          messagingResourceId,
        };

        const returnIdx = existingSteps.findIndex(
          (s) => s.type === "return_response",
        );
        if (returnIdx !== -1) {
          nextPipelineSteps = [
            ...existingSteps.slice(0, returnIdx),
            newStorageStep,
            ...existingSteps.slice(returnIdx),
          ];
        } else {
          nextPipelineSteps = [...existingSteps, newStorageStep];
        }
      }

      const directEdgeId = newEdge.id;
      get().updateEndpoint(endpointId, {
        publishedEvents: [...(endpoint.publishedEvents ?? []), newPublisher],
        pipelineSteps: nextPipelineSteps,
      });

      set((state) => ({
        edges: state.edges.filter((e) => e.id !== directEdgeId),
        pendingEdgeUpserts: state.pendingEdgeUpserts.filter(
          (e) => e.id !== directEdgeId,
        ),
        pendingEdgeRemovals: [...state.pendingEdgeRemovals, directEdgeId],
      }));

      return true;
    }

    const fnName = topicName
      ? `publish${toPascalCase(topicName)}`
      : "publishKafkaEvent";

    const hasMatchingStep = existingSteps.some(
      (s) =>
        s.type === "kafka_publish" &&
        (s.functionRef?.name === fnName ||
          s.brokerNodeId === targetNode.id ||
          s.messagingResourceId === messagingResourceId),
    );

    const targetTopic = topicList.find(
      (t) => t.id === messagingResourceId || t.name === messagingResourceId,
    );
    const targetTopicSchema = targetTopic?.payloadSchema;
    const schemaFields = targetTopicSchema?.fields || [];

    const defaultBindings: Array<{ argName: string; source: PipelineStepInputSource }> = [];
    if (!topicName) {
      defaultBindings.push({
        argName: "topic",
        source: {
          kind: "inline",
          value: "default-topic",
        },
      });
    }

    if (schemaFields.length > 0) {
      schemaFields.forEach((f) => {
        if (f.name) {
          const reqBodyMatch = endpoint.requestBody?.fields?.find(
            (rbf) => rbf.name?.toLowerCase() === f.name?.toLowerCase(),
          );
          defaultBindings.push({
            argName: f.name,
            source: {
              kind: "req_body",
              field: reqBodyMatch?.name ? reqBodyMatch.name : f.name,
            },
          });
        }
      });
    } else {
      defaultBindings.push({
        argName: "payload",
        source: { kind: "req_body", field: "" },
      });
    }

    let nextPipelineSteps = existingSteps;
    if (!hasMatchingStep) {
      const outputVar = `kafkaPublishResult`;
      const newKafkaStep: PipelineStep = {
        id: `step-kafka-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: publisherName || `Publish to ${topicName || "Kafka"}`,
        type: "kafka_publish",
        enabled: true,
        outputVariable: outputVar,
        functionRef: {
          name: fnName,
          importPath: `@workspace/${packageFolder}/publishers`,
        },
        inputBindings: defaultBindings,
        brokerNodeId: targetNode.id,
        messagingResourceId,
      };

      const returnIdx = existingSteps.findIndex(
        (s) => s.type === "return_response",
      );
      if (returnIdx !== -1) {
        nextPipelineSteps = [
          ...existingSteps.slice(0, returnIdx),
          newKafkaStep,
          ...existingSteps.slice(returnIdx),
        ];
      } else {
        nextPipelineSteps = [...existingSteps, newKafkaStep];
      }
    }

    // Record the direct endpoint→topic edge id so we can remove it
    const directEdgeId = newEdge.id;

    // updateEndpoint handles: endpoint upsert, event upsert, and
    // syncConfiguredEventEdge (creates publishedEvents-out-* → topic edge).
    get().updateEndpoint(endpointId, {
      publishedEvents: [...(endpoint.publishedEvents ?? []), newPublisher],
      pipelineSteps: nextPipelineSteps,
    });

    // Remove the direct endpoint→topic edge that ReactFlow added before our
    // interception. The correct publisher edge was already added by updateEndpoint.
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== directEdgeId),
      pendingEdgeUpserts: state.pendingEdgeUpserts.filter(
        (e) => e.id !== directEdgeId,
      ),
      pendingEdgeRemovals: [...state.pendingEdgeRemovals, directEdgeId],
    }));

    return true;
  }

  return false;
}
