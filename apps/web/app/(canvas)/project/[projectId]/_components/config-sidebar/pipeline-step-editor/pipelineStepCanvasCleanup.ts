import {
  Endpoint,
  BackendNode,
} from "@workspace/canvas/types";
import { ConnectedTransformer } from "@/types/canvas";
import { PipelineStepDraft } from "./types";
import {
  cleanupRedisCacheConnection,
  ensureRedisCacheConnection,
  cleanupDatabaseRefConnection,
  ensureDatabaseRefConnection,
  updateDatabaseRefConnection,
  cleanupPageRefConnection,
  ensurePageRefConnection,
  cleanupStorageOperationRefConnection,
  ensureStorageOperationRefConnection,
  cleanupLangGraphConnection,
  ensureLangGraphConnection,
  cleanupTransformerConnection,
  ensureTransformerConnection,
  cleanupServiceCallConnection,
  ensureServiceCallConnection,
} from "./utils";
import { removeDerivedConnection } from "./PushToClientStepSection";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";

export interface HandleStepUpdateCanvasEffectsParams {
  prevStep: PipelineStepDraft;
  updatedStep: PipelineStepDraft;
  remainingSteps: PipelineStepDraft[];
  serviceNodeId?: string;
  endpointId?: string;
  consumedEventId?: string;
  allNodes: BackendNode[];
  isNested: boolean;
}

export function handleStepUpdateCanvasEffects({
  prevStep,
  updatedStep,
  remainingSteps,
  serviceNodeId,
  endpointId,
  consumedEventId,
  allNodes,
  isNested,
}: HandleStepUpdateCanvasEffectsParams): void {
  if (prevStep.type === "redis_operation" && updatedStep.type !== "redis_operation") {
    if (!isNested) {
      cleanupRedisCacheConnection({
        tableNodeId: prevStep.tableNodeId,
        databaseId: prevStep.databaseId,
        serviceNodeId,
        endpointId,
        consumedEventId,
        remainingSteps,
      });
    }
  } else if (
    prevStep.type === "redis_operation" &&
    updatedStep.type === "redis_operation" &&
    prevStep.tableNodeId &&
    prevStep.tableNodeId !== updatedStep.tableNodeId
  ) {
    if (!isNested) {
      cleanupRedisCacheConnection({
        tableNodeId: prevStep.tableNodeId,
        databaseId: prevStep.databaseId,
        serviceNodeId,
        endpointId,
        consumedEventId,
        remainingSteps,
      });
    }
    if (updatedStep.tableNodeId) {
      ensureRedisCacheConnection({
        schemaId: updatedStep.tableNodeId,
        instanceId: updatedStep.databaseId,
        serviceNodeId,
        endpointId,
        consumedEventId,
      });
    }
  }

  if (prevStep.type === "db_operation" && updatedStep.type !== "db_operation") {
    if (!isNested) {
      cleanupDatabaseRefConnection({
        stepId: prevStep.id,
        dbRefNodeId: prevStep.dbRefNodeId,
        tableNodeId: prevStep.tableNodeId,
        databaseId: prevStep.databaseId,
        serviceNodeId,
        endpointId,
        consumedEventId,
        functionName: prevStep.functionRef?.name || prevStep.operationId,
        remainingSteps,
      });
    }
  } else if (
    prevStep.type === "db_operation" &&
    updatedStep.type === "db_operation" &&
    (prevStep.tableNodeId !== updatedStep.tableNodeId ||
      prevStep.databaseId !== updatedStep.databaseId ||
      prevStep.functionRef?.name !== updatedStep.functionRef?.name ||
      prevStep.operationId !== updatedStep.operationId)
  ) {
    if (!isNested) {
      const res = updateDatabaseRefConnection({
        stepId: updatedStep.id,
        dbRefNodeId: updatedStep.dbRefNodeId || prevStep.dbRefNodeId,
        prevTableNodeId: prevStep.tableNodeId,
        prevDatabaseId: prevStep.databaseId,
        prevFunctionName: prevStep.functionRef?.name || prevStep.operationId,
        newTableNodeId: updatedStep.tableNodeId,
        newDatabaseId: updatedStep.databaseId,
        newFunctionName: updatedStep.functionRef?.name || updatedStep.operationId,
        serviceNodeId,
        endpointId,
        consumedEventId,
        remainingSteps,
      });
      if (res?.dbRefNodeId) {
        updatedStep.dbRefNodeId = res.dbRefNodeId;
      }
    }
  }

  if (prevStep.type === "push_to_client" && updatedStep.type !== "push_to_client") {
    if (!isNested) {
      cleanupPageRefConnection({
        pageRefNodeId: prevStep.clientDeliveryPageRefNodeId,
        serviceNodeId,
        endpointId,
        consumedEventId,
        remainingSteps,
      });
      if (prevStep.clientDeliveryTargetPageId) {
        const store = useBackendCanvasStore.getState();
        removeDerivedConnection(store, prevStep.clientDeliveryTargetPageId, prevStep.id);
      }
    }
  } else if (prevStep.type !== "push_to_client" && updatedStep.type === "push_to_client") {
    const allWebPageNodes = allNodes.filter((n) => n.type === "webPage");
    const targetPageId = updatedStep.clientDeliveryTargetPageId || allWebPageNodes[0]?.id;
    const connectionResult = ensurePageRefConnection({
      targetPageId,
      serviceNodeId,
      endpointId,
      consumedEventId,
      stepId: updatedStep.id,
    });
    if (connectionResult) {
      updatedStep.clientDeliveryPageRefNodeId = connectionResult.pageRefNodeId;
      if (!updatedStep.clientDeliveryTargetPageId && connectionResult.targetPageId) {
        updatedStep.clientDeliveryTargetPageId = connectionResult.targetPageId;
      }
    }
  }

  if (prevStep.type === "storage_operation" && updatedStep.type !== "storage_operation") {
    if (!isNested) {
      cleanupStorageOperationRefConnection({
        storageNodeId: prevStep.storageNodeId || prevStep.brokerNodeId,
        bucketId: prevStep.bucketId,
        serviceNodeId,
        endpointId,
        consumedEventId,
        functionName: prevStep.functionRef?.name || prevStep.operationId,
        remainingSteps,
      });
    }
  } else if (
    (prevStep.type === "storage_operation" && updatedStep.type === "storage_operation") ||
    (prevStep.type !== "storage_operation" && updatedStep.type === "storage_operation")
  ) {
    if (
      !isNested &&
      prevStep.type === "storage_operation" &&
      (prevStep.storageNodeId !== updatedStep.storageNodeId ||
        prevStep.bucketId !== updatedStep.bucketId ||
        prevStep.functionRef?.name !== updatedStep.functionRef?.name ||
        prevStep.operationId !== updatedStep.operationId)
    ) {
      cleanupStorageOperationRefConnection({
        storageNodeId: prevStep.storageNodeId || prevStep.brokerNodeId,
        bucketId: prevStep.bucketId,
        serviceNodeId,
        endpointId,
        consumedEventId,
        functionName: prevStep.functionRef?.name || prevStep.operationId,
        remainingSteps,
      });
    }

    if (updatedStep.type === "storage_operation") {
      ensureStorageOperationRefConnection({
        storageNodeId: updatedStep.storageNodeId || updatedStep.brokerNodeId,
        bucketId: updatedStep.bucketId,
        serviceNodeId,
        endpointId,
        consumedEventId,
        functionName: updatedStep.functionRef?.name || updatedStep.operationId,
      });
    }
  }

  if (prevStep.type === "transform" && updatedStep.type !== "transform") {
    if (!isNested) {
      cleanupTransformerConnection({
        transformerNodeId: prevStep.transformerNodeId,
        functionName: prevStep.functionRef?.name,
        serviceNodeId,
        endpointId,
        consumedEventId,
        remainingSteps,
      });
    }
  } else if (
    (prevStep.type === "transform" && updatedStep.type === "transform") ||
    (prevStep.type !== "transform" && updatedStep.type === "transform")
  ) {
    if (
      !isNested &&
      prevStep.type === "transform" &&
      (prevStep.transformerNodeId !== updatedStep.transformerNodeId ||
        prevStep.functionRef?.name !== updatedStep.functionRef?.name)
    ) {
      cleanupTransformerConnection({
        transformerNodeId: prevStep.transformerNodeId,
        functionName: prevStep.functionRef?.name,
        serviceNodeId,
        endpointId,
        consumedEventId,
        remainingSteps,
      });
    }

    if (updatedStep.type === "transform" && (updatedStep.transformerNodeId || updatedStep.functionRef?.name)) {
      ensureTransformerConnection({
        transformerNodeId: updatedStep.transformerNodeId,
        functionName: updatedStep.functionRef?.name,
        serviceNodeId,
        endpointId,
        consumedEventId,
        allNodes,
      });
    }
  }

  if (prevStep.type === "langgraph_invoke" && updatedStep.type !== "langgraph_invoke") {
    if (!isNested) {
      cleanupLangGraphConnection({
        langGraphNodeId: prevStep.langGraphTargetNodeId,
        serviceNodeId,
        endpointId,
        consumedEventId,
        remainingSteps,
      });
    }
  } else if (
    (prevStep.type === "langgraph_invoke" && updatedStep.type === "langgraph_invoke") ||
    (prevStep.type !== "langgraph_invoke" && updatedStep.type === "langgraph_invoke")
  ) {
    if (
      !isNested &&
      prevStep.type === "langgraph_invoke" &&
      prevStep.langGraphTargetNodeId !== updatedStep.langGraphTargetNodeId
    ) {
      cleanupLangGraphConnection({
        langGraphNodeId: prevStep.langGraphTargetNodeId,
        serviceNodeId,
        endpointId,
        consumedEventId,
        remainingSteps,
      });
    }

    if (updatedStep.type === "langgraph_invoke") {
      ensureLangGraphConnection({
        langGraphNodeId: updatedStep.langGraphTargetNodeId,
        serviceNodeId,
        endpointId,
        consumedEventId,
      });
    }
  }

  if (prevStep.type === "service_call" && updatedStep.type !== "service_call") {
    if (!isNested) {
      cleanupServiceCallConnection({
        serviceNodeId,
        endpointId,
        targetServiceId: prevStep.databaseId || prevStep.externalNodeId,
        targetEndpointId: prevStep.tableNodeId || prevStep.externalEndpointId,
        remainingSteps,
      });
    }
  } else if (
    (prevStep.type === "service_call" && updatedStep.type === "service_call") ||
    (prevStep.type !== "service_call" && updatedStep.type === "service_call")
  ) {
    if (
      !isNested &&
      prevStep.type === "service_call" &&
      (prevStep.databaseId !== updatedStep.databaseId ||
        prevStep.tableNodeId !== updatedStep.tableNodeId)
    ) {
      cleanupServiceCallConnection({
        serviceNodeId,
        endpointId,
        targetServiceId: prevStep.databaseId || prevStep.externalNodeId,
        targetEndpointId: prevStep.tableNodeId || prevStep.externalEndpointId,
        remainingSteps,
      });
    }

    if (
      updatedStep.type === "service_call" &&
      (updatedStep.databaseId || updatedStep.externalNodeId) &&
      (updatedStep.tableNodeId || updatedStep.externalEndpointId)
    ) {
      ensureServiceCallConnection({
        serviceNodeId,
        endpointId,
        targetServiceId: updatedStep.databaseId || updatedStep.externalNodeId,
        targetEndpointId: updatedStep.tableNodeId || updatedStep.externalEndpointId,
      });
    }
  }
}

export interface HandleStepDeleteCanvasEffectsParams {
  stepToDelete: PipelineStepDraft;
  remainingSteps: PipelineStepDraft[];
  serviceNodeId?: string;
  targetId?: string;
  endpoint?: Endpoint;
  consumedEventId?: string;
  connectedTransformers: ConnectedTransformer[];
  isNested: boolean;
}

export function handleStepDeleteCanvasEffects({
  stepToDelete,
  remainingSteps,
  serviceNodeId,
  targetId,
  endpoint,
  consumedEventId,
  connectedTransformers,
  isNested,
}: HandleStepDeleteCanvasEffectsParams): void {
  if (isNested) return;

  if (stepToDelete.type === "langgraph_invoke") {
    cleanupLangGraphConnection({
      langGraphNodeId: stepToDelete.langGraphTargetNodeId,
      serviceNodeId,
      endpointId: endpoint?.id,
      consumedEventId,
      remainingSteps,
    });
  }

  if (stepToDelete.type === "push_to_client") {
    cleanupPageRefConnection({
      pageRefNodeId: stepToDelete.clientDeliveryPageRefNodeId,
      serviceNodeId,
      endpointId: endpoint?.id,
      consumedEventId,
      remainingSteps,
    });
    if (stepToDelete.clientDeliveryTargetPageId) {
      const store = useBackendCanvasStore.getState();
      removeDerivedConnection(store, stepToDelete.clientDeliveryTargetPageId, stepToDelete.id);
    }
  }

  if (stepToDelete.type === "redis_operation") {
    cleanupRedisCacheConnection({
      tableNodeId: stepToDelete.tableNodeId,
      databaseId: stepToDelete.databaseId,
      serviceNodeId,
      endpointId: endpoint?.id,
      consumedEventId,
      remainingSteps,
    });
  }

  if (stepToDelete.type === "db_operation") {
    cleanupDatabaseRefConnection({
      stepId: stepToDelete.id,
      dbRefNodeId: stepToDelete.dbRefNodeId,
      tableNodeId: stepToDelete.tableNodeId,
      databaseId: stepToDelete.databaseId,
      serviceNodeId,
      endpointId: endpoint?.id,
      consumedEventId,
      functionName: stepToDelete.functionRef?.name || stepToDelete.operationId,
      remainingSteps,
    });
  }

  if (stepToDelete.type === "storage_operation") {
    cleanupStorageOperationRefConnection({
      storageNodeId: stepToDelete.storageNodeId || stepToDelete.brokerNodeId,
      bucketId: stepToDelete.bucketId,
      serviceNodeId,
      endpointId: endpoint?.id,
      consumedEventId,
      functionName: stepToDelete.functionRef?.name || stepToDelete.operationId,
      remainingSteps,
    });
  }

  if (stepToDelete.type === "transform") {
    cleanupTransformerConnection({
      transformerNodeId: stepToDelete.transformerNodeId,
      functionName: stepToDelete.functionRef?.name,
      serviceNodeId,
      endpointId: endpoint?.id,
      consumedEventId,
      remainingSteps,
    });
  }

  if (stepToDelete.type === "kafka_publish") {
    const store = useBackendCanvasStore.getState();
    const brokerNodeId = stepToDelete.brokerNodeId;
    const messagingResourceId = stepToDelete.messagingResourceId;

    if (endpoint && endpoint.publishedEvents && (brokerNodeId || messagingResourceId)) {
      const remainingPubs = endpoint.publishedEvents.filter(
        (pe) =>
          (brokerNodeId && pe.brokerNodeId === brokerNodeId) ||
          (messagingResourceId && pe.messagingResourceId === messagingResourceId)
            ? false
            : true,
      );
      if (remainingPubs.length !== endpoint.publishedEvents.length) {
        store.updateEndpoint(endpoint.id, {
          publishedEvents: remainingPubs,
        });
      }
    }
  }

  if (stepToDelete.type === "langgraph_invoke") {
    const store = useBackendCanvasStore.getState();
    const targetAgentId = stepToDelete.langGraphTargetNodeId;
    if (targetAgentId) {
      const edgesToDelete = store.edges.filter((e) => {
        if (!e) return false;
        const isWithAgent =
          e.source === targetAgentId || e.target === targetAgentId;
        if (!isWithAgent) return false;
        const isWithService =
          Boolean(serviceNodeId) &&
          (e.source === serviceNodeId || e.target === serviceNodeId);
        if (!isWithService) return false;

        const isToThisTargetHandle =
          Boolean(targetId) &&
          (e.targetHandle === `endpoint-in-${targetId}` ||
            e.targetHandle === `endpoint-out-${targetId}` ||
            e.targetHandle === `consumedEvents-in-${targetId}` ||
            e.targetHandle === `consumedEvents-out-${targetId}` ||
            e.targetHandle === targetId ||
            e.sourceHandle === `endpoint-out-${targetId}` ||
            e.sourceHandle === `endpoint-in-${targetId}` ||
            e.sourceHandle === `consumedEvents-out-${targetId}` ||
            e.sourceHandle === `consumedEvents-in-${targetId}` ||
            e.sourceHandle === targetId);

        return isToThisTargetHandle;
      });

      edgesToDelete.forEach((e) => store.deleteEdge(e.id));
    }
  }

  if (stepToDelete.type === "service_call") {
    cleanupServiceCallConnection({
      serviceNodeId,
      endpointId: endpoint?.id,
      targetServiceId: stepToDelete.databaseId || stepToDelete.externalNodeId,
      targetEndpointId: stepToDelete.tableNodeId || stepToDelete.externalEndpointId,
      remainingSteps,
    });
  }
}
