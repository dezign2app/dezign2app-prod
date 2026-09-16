import { useMemo } from "react";
import { DropResult } from "@hello-pangea/dnd";
import {
  Endpoint,
  BackendNode,
  BackendEdge,
  AnyMessagingResource,
} from "@workspace/canvas/types";
import { StepType, PipelineStepDraft } from "./types";
import { isStepInputUnconfigured } from "@/lib/utils/pipelineValidation";
import { createDefaultStepDraft } from "./pipelineStepFactory";
import { useCanvasStepSync } from "./useCanvasStepSync";
import {
  handleStepUpdateCanvasEffects,
  handleStepDeleteCanvasEffects,
} from "./pipelineStepCanvasCleanup";

export interface UsePipelineStepsProps {
  steps: PipelineStepDraft[];
  onChange: (steps: PipelineStepDraft[]) => void;
  endpoint?: Endpoint;
  consumedEvent?: AnyMessagingResource;
  allNodes?: BackendNode[];
  allEdges?: BackendEdge[];
  serviceNodeId?: string;
  isNested?: boolean;
}

export function usePipelineSteps({
  steps,
  onChange,
  endpoint,
  consumedEvent,
  allNodes = [],
  allEdges = [],
  serviceNodeId,
  isNested = false,
}: UsePipelineStepsProps) {
  const isConsumer = Boolean(consumedEvent);
  const targetId = endpoint?.id || consumedEvent?.id;

  // Separate draggable executable steps from the mandatory pinned return step
  const executableSteps = useMemo(
    () => steps.filter((s) => s.type !== "return_response"),
    [steps],
  );

  const { connectedTransformers } = useCanvasStepSync({
    steps,
    executableSteps,
    onChange,
    targetId,
    serviceNodeId,
    endpoint,
    consumedEvent,
    allNodes,
    allEdges,
    isNested,
    isConsumer,
  });

  const hasUnconfiguredInputs = useMemo(
    () => executableSteps.some((s) => isStepInputUnconfigured(s, allNodes)),
    [executableSteps, allNodes],
  );

  const returnStep: PipelineStepDraft = useMemo(() => {
    if (isConsumer) {
      return {
        id: "return-event-step",
        name: "Acknowledge Event",
        type: "return_response",
        enabled: true,
        statusCode: 200,
        inputBindings: [],
        outputVariable: "",
      };
    }
    const found = steps.find((s) => s.type === "return_response");
    if (found) return found;
    return {
      id: "return-response-step",
      name: "Return Response",
      type: "return_response",
      enabled: true,
      statusCode: endpoint?.type === "POST" ? 201 : 200,
      inputBindings: [],
      outputVariable: "",
    };
  }, [steps, endpoint?.type, isConsumer]);

  const addStep = (type: StepType) => {
    const newStep = createDefaultStepDraft({
      type,
      stepNumber: executableSteps.length + 1,
      allNodes,
      endpoint,
      consumedEvent,
      serviceNodeId,
    });

    if (isConsumer || isNested) {
      onChange([...executableSteps, newStep]);
    } else {
      onChange([...executableSteps, newStep, returnStep]);
    }
  };

  const updateStep = (index: number, updated: PipelineStepDraft) => {
    const prevStep = executableSteps[index];
    if (prevStep) {
      const remainingSteps = executableSteps.filter((_, i) => i !== index);
      handleStepUpdateCanvasEffects({
        prevStep,
        updatedStep: updated,
        remainingSteps,
        serviceNodeId,
        endpointId: endpoint?.id,
        consumedEventId: consumedEvent?.id,
        allNodes,
        isNested,
      });
    }

    const next = [...executableSteps];
    next[index] = updated;
    if (isConsumer || isNested) {
      onChange(next);
    } else {
      onChange([...next, returnStep]);
    }
  };

  const deleteStep = (index: number) => {
    const stepToDelete = executableSteps[index];
    if (!stepToDelete) return;

    const remainingSteps = executableSteps.filter((_, i) => i !== index);
    handleStepDeleteCanvasEffects({
      stepToDelete,
      remainingSteps,
      serviceNodeId,
      targetId,
      endpoint,
      consumedEventId: consumedEvent?.id,
      connectedTransformers,
      isNested,
    });

    if (isConsumer || isNested) {
      onChange(remainingSteps);
    } else {
      onChange([...remainingSteps, returnStep]);
    }
  };

  const moveStep = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= executableSteps.length) return;
    const reordered = Array.from(executableSteps);
    const [moved] = reordered.splice(fromIndex, 1);
    if (!moved) return;
    reordered.splice(toIndex, 0, moved);
    if (isConsumer || isNested) {
      onChange(reordered);
    } else {
      onChange([...reordered, returnStep]);
    }
  };

  const updateReturnStep = (updated: PipelineStepDraft) => {
    if (isConsumer || isNested) return;
    onChange([...executableSteps, updated]);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    moveStep(result.source.index, result.destination.index);
  };

  return {
    isConsumer,
    executableSteps,
    returnStep,
    hasUnconfiguredInputs,
    addStep,
    updateStep,
    deleteStep,
    moveStep,
    updateReturnStep,
    handleDragEnd,
  };
}
export * from "./pipelineStepFactory";
export * from "./useCanvasStepSync";
export * from "./pipelineStepCanvasCleanup";
