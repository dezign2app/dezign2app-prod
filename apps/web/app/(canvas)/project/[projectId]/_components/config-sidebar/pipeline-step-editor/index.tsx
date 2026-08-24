"use client";

import React, { useMemo, useEffect } from "react";
import { Endpoint, BackendNode, BackendEdge, AnyMessagingResource } from "@workspace/canvas/types";
import { Plus, AlertTriangle } from "lucide-react";
import {
  DragDropContext,
  Droppable,
  DropResult,
} from "@hello-pangea/dnd";
import { StepRow } from "./StepRow";
import { ReturnResponseStepRow } from "./ReturnResponseStepRow";
import {
  StepType,
  PipelineStepDraft,
  StepBinding,
} from "./types";
import {
  STEP_TYPE_META,
  ADDABLE_STEP_TYPES,
  generateId,
} from "./utils";
import {
  getConnectedTransformersForEndpoint,
  getConnectedKafkaForEndpoint,
  isStepInputUnconfigured,
} from "@/lib/utils/pipelineValidation";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";

export * from "./types";
export * from "./utils";
export * from "./SmartPathInput";
export * from "./BindingSourceEditor";
export * from "./TransformerStepSection";
export * from "./DbOperationStepSection";
export * from "./RedisOperationStepSection";
export * from "./KafkaPublishStepSection";
export * from "./ServiceCallStepSection";
export * from "./ReturnResponseStepRow";
export * from "./StepRowHeader";
export * from "./ArgumentBindingsSection";
export * from "./GenericFunctionRefSection";
export * from "./CustomCodeSection";
export * from "./useStepRowState";
export * from "./StepRow";

export interface PipelineStepEditorProps {
  steps: PipelineStepDraft[];
  onChange: (steps: PipelineStepDraft[]) => void;
  endpoint?: Endpoint;
  consumedEvent?: AnyMessagingResource;
  allNodes?: BackendNode[];
  allEdges?: BackendEdge[];
  serviceNodeId?: string;
}

export const PipelineStepEditor = ({
  steps,
  onChange,
  endpoint,
  consumedEvent,
  allNodes = [],
  allEdges = [],
  serviceNodeId,
}: PipelineStepEditorProps) => {
  const isConsumer = Boolean(consumedEvent);

  // Separate draggable executable steps from the mandatory pinned return step
  const executableSteps = useMemo(
    () => steps.filter((s) => s.type !== "return_response"),
    [steps],
  );

  const targetId = endpoint?.id || consumedEvent?.id;
  const connectedTransformers = useMemo(() => {
    if (!targetId || !serviceNodeId) return [];
    return getConnectedTransformersForEndpoint(
      targetId,
      serviceNodeId,
      allNodes,
      allEdges,
    );
  }, [targetId, serviceNodeId, allNodes, allEdges]);

  // Auto-synchronize connected transformers into the pipeline steps
  useEffect(() => {
    if (connectedTransformers.length === 0) return;

    const missingTransformers = connectedTransformers.filter(
      (ct) =>
        !executableSteps.some(
          (s) =>
            s.type === "transform" &&
            (s.functionRef?.name === ct.functionName ||
              s.transformerNodeId === ct.id),
        ),
    );

    if (missingTransformers.length > 0) {
      const newSteps: PipelineStepDraft[] = missingTransformers.map(
        (ct, idx) => {
          const stepNum = executableSteps.length + idx + 1;
          const outputVar = `transformedData${stepNum}`;
          return {
            id: generateId(),
            name: outputVar,
            type: "transform",
            enabled: true,
            outputVariable: outputVar,
            functionRef: {
              name: ct.functionName,
              importPath: ct.isGlobal
                ? "@workspace/transformers"
                : `@/services/${serviceNodeId}/transformers/${ct.functionName}`,
              isGlobal: ct.isGlobal,
              inputSchema: ct.inputSchema,
              returnSchema: ct.returnSchema,
            },
            transformerNodeId: ct.id,
            inputBindings: [],
          };
        },
      );

      if (isConsumer) {
        onChange([...executableSteps, ...newSteps]);
      } else {
        const foundReturn = steps.find((s) => s.type === "return_response");
        onChange([
          ...executableSteps,
          ...newSteps,
          foundReturn || {
            id: "return-response-step",
            name: "Return Response",
            type: "return_response",
            enabled: true,
            statusCode: endpoint?.type === "POST" ? 201 : 200,
            inputBindings: [],
            outputVariable: "",
          },
        ]);
      }
    }
  }, [
    connectedTransformers,
    executableSteps,
    isConsumer,
    onChange,
    serviceNodeId,
    endpoint?.type,
    steps,
  ]);

  const connectedKafka = useMemo(() => {
    if (!targetId || !serviceNodeId) return [];
    return getConnectedKafkaForEndpoint(
      targetId,
      serviceNodeId,
      allNodes,
      allEdges,
      endpoint,
    );
  }, [targetId, serviceNodeId, allNodes, allEdges, endpoint]);

  // Auto-synchronize connected Kafka topics into the pipeline steps
  useEffect(() => {
    if (connectedKafka.length === 0) return;

    const missingKafka = connectedKafka.filter(
      (ck) =>
        !executableSteps.some(
          (s) =>
            s.type === "kafka_publish" &&
            (s.functionRef?.name === ck.functionName ||
              s.brokerNodeId === ck.brokerNodeId ||
              s.messagingResourceId === ck.topicId),
        ),
    );

    if (missingKafka.length > 0) {
      const newKafkaSteps: PipelineStepDraft[] = missingKafka.map(
        (ck, idx) => {
          const stepNum = executableSteps.length + idx + 1;
          const outputVar = `kafkaPublishResult${stepNum > 1 ? stepNum : ""}`;
          return {
            id: generateId(),
            name: ck.publisherName || `Publish ${ck.topicName}`,
            type: "kafka_publish",
            enabled: true,
            outputVariable: outputVar,
            functionRef: {
              name: ck.functionName,
              importPath: ck.importPath,
            },
            inputBindings: [
              ...(ck.functionName === "publishKafkaEvent"
                ? [
                    {
                      argName: "topic",
                      source: {
                        kind: "literal" as const,
                        value: ck.topicName || "events",
                      },
                    },
                  ]
                : []),
              {
                argName: ck.functionName === "publishKafkaEvent" ? "payload" : "message",
                source: { kind: "req_body" as const, field: "" },
              },
            ],
            brokerNodeId: ck.brokerNodeId,
            messagingResourceId: ck.topicId,
          };
        },
      );

      if (isConsumer) {
        onChange([...executableSteps, ...newKafkaSteps]);
      } else {
        const foundReturn = steps.find((s) => s.type === "return_response");
        onChange([
          ...executableSteps,
          ...newKafkaSteps,
          foundReturn || {
            id: "return-response-step",
            name: "Return Response",
            type: "return_response",
            enabled: true,
            statusCode: endpoint?.type === "POST" ? 201 : 200,
            inputBindings: [],
            outputVariable: "",
          },
        ]);
      }
    }
  }, [
    connectedKafka,
    executableSteps,
    isConsumer,
    onChange,
    serviceNodeId,
    endpoint?.type,
    steps,
  ]);

  const hasUnconfiguredInputs = useMemo(
    () => executableSteps.some((s) => isStepInputUnconfigured(s, allNodes)),
    [executableSteps, allNodes],
  );

  const returnStep: PipelineStepDraft = useMemo(() => {
    if (isConsumer) {
      return {
        id: "return-response-step",
        name: "Return Response",
        type: "return_response",
        enabled: true,
        statusCode: 200,
        inputBindings: [],
        outputVariable: "",
      };
    }
    const found = steps.find((s) => s.type === "return_response");
    if (found) return found;
    const defaultStatusCode = endpoint?.type === "POST" ? 201 : 200;
    const lastPriorStep = executableSteps[executableSteps.length - 1];
    const initialBindings: StepBinding[] = lastPriorStep
      ? [
          {
            argName: "data",
            source: {
              kind: "step_output",
              stepId: lastPriorStep.id,
              field: "",
            },
          },
        ]
      : [
          {
            argName: "data",
            source: { kind: "req_body", field: "" },
          },
        ];

    return {
      id: "return-response-step",
      name: "Return Response",
      type: "return_response",
      enabled: true,
      statusCode: defaultStatusCode,
      inputBindings: initialBindings,
      outputVariable: "",
    };
  }, [steps, endpoint, executableSteps, isConsumer]);

  const addStep = (type: StepType) => {
    const id = generateId();
    const stepNum = executableSteps.length + 1;
    const defaultVar =
      type === "transform"
        ? `transformedData${stepNum}`
        : type === "db_operation"
        ? `dbResult${stepNum}`
        : type === "redis_operation"
        ? `cachedResult${stepNum}`
        : type === "kafka_publish"
        ? `publishResult${stepNum}`
        : type === "service_call"
        ? `serviceResponse${stepNum}`
        : `step${stepNum}Result`;

    const newStep: PipelineStepDraft = {
      id,
      name: defaultVar,
      type,
      enabled: true,
      inputBindings: [],
      outputVariable: defaultVar,
    };
    if (isConsumer) {
      onChange([...executableSteps, newStep]);
    } else {
      onChange([...executableSteps, newStep, returnStep]);
    }
  };

  const updateStep = (index: number, updated: PipelineStepDraft) => {
    const next = [...executableSteps];
    next[index] = updated;
    if (isConsumer) {
      onChange(next);
    } else {
      onChange([...next, returnStep]);
    }
  };

  const deleteStep = (index: number) => {
    const stepToDelete = executableSteps[index];
    if (!stepToDelete) return;

    if (stepToDelete.type === "transform") {
      const store = useBackendCanvasStore.getState();
      const fnName = stepToDelete.functionRef?.name;
      const tNodeId = stepToDelete.transformerNodeId;

      // Find matching transformer or transformer_ref nodes
      const matchingTransformerNodes = store.nodes.filter(
        (n) =>
          (n.type === "transformer" || n.type === "transformer_ref") &&
          (n.id === tNodeId ||
            n.id === fnName ||
            n.data?.functionName === fnName ||
            n.data?.label === fnName ||
            (n.type === "transformer_ref" && n.data?.transformerRef === fnName)),
      );

      const matchingNodeIds = new Set(matchingTransformerNodes.map((n) => n.id));

      // Also check connectedTransformers for this endpoint/consumer
      connectedTransformers.forEach((ct) => {
        if (
          ct.functionName === fnName ||
          ct.id === tNodeId ||
          ct.nodeId === tNodeId
        ) {
          matchingNodeIds.add(ct.id);
          matchingNodeIds.add(ct.nodeId);
          if (ct.masterId) matchingNodeIds.add(ct.masterId);
        }
      });

      // 1. Delete matching canvas edges connecting this transformer to this service endpoint/event
      const edgesToDelete = store.edges.filter((e) => {
        if (!e) return false;
        const isFromTransformer =
          matchingNodeIds.has(e.source) || matchingNodeIds.has(e.target);
        if (!isFromTransformer) return false;

        const isToThisService =
          Boolean(serviceNodeId) &&
          (e.target === serviceNodeId || e.source === serviceNodeId);

        const isToThisTargetHandle =
          Boolean(targetId) &&
          (e.targetHandle === `endpoint-in-${targetId}` ||
            e.targetHandle === `consumedEvents-in-${targetId}` ||
            e.targetHandle === targetId ||
            e.sourceHandle === `endpoint-in-${targetId}` ||
            e.sourceHandle === `consumedEvents-in-${targetId}`);

        return isToThisService && isToThisTargetHandle;
      });

      edgesToDelete.forEach((e) => store.deleteEdge(e.id));

      // 2. Clean up targetEndpointIds / targetEventIds on the transformer node(s)
      matchingTransformerNodes.forEach((tNode) => {
        if (tNode.data) {
          const currentEpIds: string[] =
            tNode.data.targetEndpointIds ||
            (tNode.data.targetEndpointId ? [tNode.data.targetEndpointId] : []);
          const currentEvIds: string[] =
            tNode.data.targetEventIds ||
            (tNode.data.targetEventId ? [tNode.data.targetEventId] : []);

          const nextEpIds = targetId
            ? currentEpIds.filter((id) => id !== targetId)
            : currentEpIds;
          const nextEvIds = targetId
            ? currentEvIds.filter((id) => id !== targetId)
            : currentEvIds;

          const hasRemainingTargets =
            nextEpIds.length > 0 || nextEvIds.length > 0;

          store.updateNode(tNode.id, {
            data: {
              ...tNode.data,
              targetEndpointIds: nextEpIds,
              targetEndpointId: nextEpIds[0] || undefined,
              targetEventIds: nextEvIds,
              targetEventId: nextEvIds[0] || undefined,
              targetServiceId: hasRemainingTargets
                ? tNode.data.targetServiceId
                : undefined,
            },
          });
        }
      });
    }

    if (stepToDelete.type === "kafka_publish") {
      const store = useBackendCanvasStore.getState();
      const brokerNodeId = stepToDelete.brokerNodeId;
      const messagingResourceId = stepToDelete.messagingResourceId;

      // Clean up matching publishedEvents on the endpoint if found
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

    const next = executableSteps.filter((_, i) => i !== index);
    if (isConsumer) {
      onChange(next);
    } else {
      onChange([...next, returnStep]);
    }
  };

  const moveStep = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= executableSteps.length) return;
    const reordered = Array.from(executableSteps);
    const [moved] = reordered.splice(fromIndex, 1);
    if (!moved) return;
    reordered.splice(toIndex, 0, moved);
    if (isConsumer) {
      onChange(reordered);
    } else {
      onChange([...reordered, returnStep]);
    }
  };

  const updateReturnStep = (updated: PipelineStepDraft) => {
    if (isConsumer) return;
    onChange([...executableSteps, updated]);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    moveStep(result.source.index, result.destination.index);
  };

  return (
    <div className="flex flex-col gap-3">
      {hasUnconfiguredInputs && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-xs">
          <AlertTriangle size={14} className="shrink-0 text-destructive" />
          <span className="font-medium text-[11px] leading-tight">
            Pipeline has steps with unconfigured input variables. Map all required inputs below.
          </span>
        </div>
      )}

      {/* Draggable step list */}
      {executableSteps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/40 p-4 text-center">
          <p className="text-xs text-muted-foreground/60">
            No pipeline steps configured yet.
          </p>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">
            {isConsumer
              ? "Add transform, DB operations, or downstream event publish steps to process incoming events."
              : "Add transform or DB operations below to define data flow before returning the response."}
          </p>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="pipeline-steps-droppable">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex flex-col gap-2 rounded-lg transition-colors ${
                  snapshot.isDraggingOver ? "bg-accent/15 p-1 -m-1" : ""
                }`}
              >
                {executableSteps.map((step, i) => (
                  <StepRow
                    key={step.id || `step-${i}`}
                    step={step}
                    index={i}
                    priorSteps={executableSteps.slice(0, i)}
                    endpoint={endpoint}
                    consumedEvent={consumedEvent}
                    allNodes={allNodes}
                    allEdges={allEdges}
                    serviceNodeId={serviceNodeId}
                    onChange={(updated) => updateStep(i, updated)}
                    onDelete={() => deleteStep(i)}
                    isFirst={i === 0}
                    isLast={i === executableSteps.length - 1}
                    onMoveUp={() => moveStep(i, i - 1)}
                    onMoveDown={() => moveStep(i, i + 1)}
                  />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Add step buttons */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {ADDABLE_STEP_TYPES.map((type) => {
          const meta = STEP_TYPE_META[type];
          return (
            <button
              key={type}
              type="button"
              className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded border transition-all duration-150 hover:brightness-110 active:scale-95 ${meta.color}`}
              onClick={() => addStep(type)}
            >
              <Plus size={9} />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Mandatory Pinned Return Response Step (Only for HTTP Endpoints) */}
      {!isConsumer && (
        <div className="pt-2 border-t border-border/40">
          <ReturnResponseStepRow
            step={returnStep}
            priorSteps={executableSteps}
            endpoint={endpoint}
            allNodes={allNodes}
            onChange={updateReturnStep}
          />
        </div>
      )}
    </div>
  );
};
