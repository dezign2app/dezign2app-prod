"use client";

import React, { useMemo } from "react";
import { Endpoint, BackendNode, BackendEdge } from "@workspace/canvas/types";
import { Plus } from "lucide-react";
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

export * from "./types";
export * from "./utils";
export * from "./SmartPathInput";
export * from "./BindingSourceEditor";
export * from "./TransformerStepSection";
export * from "./DbOperationStepSection";
export * from "./ReturnResponseStepRow";
export * from "./StepRow";


export interface PipelineStepEditorProps {
  steps: PipelineStepDraft[];
  onChange: (steps: PipelineStepDraft[]) => void;
  endpoint?: Endpoint;
  allNodes?: BackendNode[];
  allEdges?: BackendEdge[];
  serviceNodeId?: string;
}

export const PipelineStepEditor = ({
  steps,
  onChange,
  endpoint,
  allNodes = [],
  allEdges = [],
  serviceNodeId,
}: PipelineStepEditorProps) => {
  // Separate draggable executable steps from the mandatory pinned return step
  const executableSteps = useMemo(
    () => steps.filter((s) => s.type !== "return_response"),
    [steps],
  );

  const returnStep: PipelineStepDraft = useMemo(() => {
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
  }, [steps, endpoint, executableSteps]);

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
    onChange([...executableSteps, newStep, returnStep]);
  };

  const updateStep = (index: number, updated: PipelineStepDraft) => {
    const next = [...executableSteps];
    next[index] = updated;
    onChange([...next, returnStep]);
  };

  const deleteStep = (index: number) => {
    const next = executableSteps.filter((_, i) => i !== index);
    onChange([...next, returnStep]);
  };

  const moveStep = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= executableSteps.length) return;
    const reordered = Array.from(executableSteps);
    const [moved] = reordered.splice(fromIndex, 1);
    if (!moved) return;
    reordered.splice(toIndex, 0, moved);
    onChange([...reordered, returnStep]);
  };

  const updateReturnStep = (updated: PipelineStepDraft) => {
    onChange([...executableSteps, updated]);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    moveStep(result.source.index, result.destination.index);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Draggable step list */}
      {executableSteps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/40 p-4 text-center">
          <p className="text-xs text-muted-foreground/60">
            No pipeline steps configured yet.
          </p>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">
            Add transform or DB operations below to define data flow before returning the response.
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

      {/* Mandatory Pinned Return Response Step */}
      <div className="pt-2 border-t border-border/40">
        <ReturnResponseStepRow
          step={returnStep}
          priorSteps={executableSteps}
          endpoint={endpoint}
          allNodes={allNodes}
          onChange={updateReturnStep}
        />
      </div>
    </div>
  );
};
