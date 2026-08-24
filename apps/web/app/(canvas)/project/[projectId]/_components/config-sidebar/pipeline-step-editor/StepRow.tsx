"use client";

import React, { useState } from "react";
import { Endpoint, BackendNode, BackendEdge, AnyMessagingResource } from "@workspace/canvas/types";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Check, AlertTriangle } from "lucide-react";
import { Draggable } from "@hello-pangea/dnd";
import { StepRowHeader } from "./StepRowHeader";
import { TransformerStepSection } from "./TransformerStepSection";
import { DbOperationStepSection } from "./DbOperationStepSection";
import { RedisOperationStepSection } from "./RedisOperationStepSection";
import { KafkaPublishStepSection } from "./KafkaPublishStepSection";
import { ServiceCallStepSection } from "./ServiceCallStepSection";
import { GenericFunctionRefSection } from "./GenericFunctionRefSection";
import { CustomCodeSection } from "./CustomCodeSection";
import { ArgumentBindingsSection } from "./ArgumentBindingsSection";
import { useStepRowState } from "./useStepRowState";
import { StepType, PipelineStepDraft } from "./types";
import { STEP_TYPE_META, ADDABLE_STEP_TYPES } from "./utils";

function isStepType(val: string): val is StepType {
  return val in STEP_TYPE_META;
}

export interface StepRowProps {
  step: PipelineStepDraft;
  index: number;
  priorSteps: PipelineStepDraft[];
  endpoint?: Endpoint;
  consumedEvent?: AnyMessagingResource;
  allNodes: BackendNode[];
  allEdges: BackendEdge[];
  serviceNodeId?: string;
  onChange: (updated: PipelineStepDraft) => void;
  onDelete: () => void;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export const StepRow = ({
  step,
  index,
  priorSteps,
  endpoint,
  consumedEvent,
  allNodes,
  allEdges,
  serviceNodeId,
  onChange,
  onDelete,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: StepRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const {
    meta,
    availableSources,
    availableTransformers,
    selectedDbId,
    expectedArgs,
    isUnconfigured,
    stepId,
    displayVarName,
    handleAutoMapArguments,
    updateBinding,
    addBinding,
    removeBinding,
  } = useStepRowState({
    step,
    index,
    priorSteps,
    endpoint,
    consumedEvent,
    allNodes,
    allEdges,
    serviceNodeId,
    onChange,
  });

  return (
    <Draggable draggableId={stepId} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`rounded-lg border transition-all duration-150 ${
            step.enabled === false ? "opacity-50" : ""
          } ${
            snapshot.isDragging
              ? "border-primary shadow-xl shadow-black/25 bg-background z-50 ring-1 ring-primary/40"
              : "border-border/60 bg-card/40 hover:border-border/80"
          }`}
        >
          {/* Header */}
          <StepRowHeader
            step={step}
            index={index}
            meta={meta}
            displayVarName={displayVarName}
            isUnconfigured={isUnconfigured}
            expanded={expanded}
            isFirst={isFirst}
            isLast={isLast}
            dragHandleProps={provided.dragHandleProps}
            onToggleExpand={() => setExpanded((v) => !v)}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onDelete={onDelete}
          />

          {/* Expanded Step Body */}
          {expanded && (
            <div className="border-t border-border/40 px-3 pt-3 pb-3 flex flex-col gap-3.5">
              {/* Unconfigured Warning Banner */}
              {isUnconfigured && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-[11px]">
                  <AlertTriangle size={12} className="shrink-0" />
                  <span>Input variables for this step are not configured. Map the arguments below.</span>
                </div>
              )}

              {/* Output Variable Name + Step Type */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground font-medium">
                    Output Variable Name
                  </Label>
                  <Input
                    className="h-7 text-xs font-mono bg-background/60 border-border/60"
                    value={step.outputVariable ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      onChange({ ...step, outputVariable: val, name: val });
                    }}
                    placeholder="e.g. createdProduct"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground font-medium">Step Type</Label>
                  <Select
                    value={step.type}
                    onValueChange={(v) => {
                      if (!isStepType(v)) return;
                      const nextVar =
                        v === "transform"
                          ? `transformedData${index + 1}`
                          : v === "db_operation"
                          ? `dbResult${index + 1}`
                          : v === "redis_operation"
                          ? `cachedResult${index + 1}`
                          : v === "kafka_publish"
                          ? `publishResult${index + 1}`
                          : v === "service_call"
                          ? `serviceResponse${index + 1}`
                          : `step${index + 1}Result`;
                      onChange({
                        ...step,
                        type: v,
                        outputVariable: step.outputVariable || nextVar,
                        name: step.outputVariable || nextVar,
                      });
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs bg-background/60 border-border/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ADDABLE_STEP_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {STEP_TYPE_META[t].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Step Type Specific Sections */}
              {(() => {
                const argumentBindingsSection = (
                  <ArgumentBindingsSection
                    bindings={step.inputBindings}
                    expectedArgs={expectedArgs}
                    availableSources={availableSources}
                    onAddBinding={addBinding}
                    onUpdateBinding={updateBinding}
                    onRemoveBinding={removeBinding}
                    onAutoMapArguments={handleAutoMapArguments}
                  />
                );

                if (step.type === "transform") {
                  return (
                    <TransformerStepSection
                      step={step}
                      availableTransformers={availableTransformers}
                      serviceNodeId={serviceNodeId}
                      endpointId={endpoint?.id}
                      expectedArgs={expectedArgs}
                      onChange={onChange}
                      onAutoMapArguments={handleAutoMapArguments}
                    >
                      {argumentBindingsSection}
                    </TransformerStepSection>
                  );
                }

                if (step.type === "db_operation") {
                  return (
                    <DbOperationStepSection
                      step={step}
                      allNodes={allNodes}
                      allEdges={allEdges}
                      expectedArgs={expectedArgs}
                      selectedDbId={selectedDbId}
                      showAdvancedSettings={showAdvancedSettings}
                      onToggleAdvancedSettings={() => setShowAdvancedSettings((v) => !v)}
                      onChange={onChange}
                      onAutoMapArguments={handleAutoMapArguments}
                    >
                      {argumentBindingsSection}
                    </DbOperationStepSection>
                  );
                }

                if (step.type === "redis_operation") {
                  return (
                    <RedisOperationStepSection
                      step={step}
                      allNodes={allNodes}
                      allEdges={allEdges}
                      expectedArgs={expectedArgs}
                      selectedDbId={selectedDbId}
                      showAdvancedSettings={showAdvancedSettings}
                      onToggleAdvancedSettings={() => setShowAdvancedSettings((v) => !v)}
                      onChange={onChange}
                      onAutoMapArguments={handleAutoMapArguments}
                    >
                      {argumentBindingsSection}
                    </RedisOperationStepSection>
                  );
                }

                if (step.type === "kafka_publish") {
                  return (
                    <KafkaPublishStepSection
                      step={step}
                      allNodes={allNodes}
                      allEdges={allEdges}
                      expectedArgs={expectedArgs}
                      showAdvancedSettings={showAdvancedSettings}
                      onToggleAdvancedSettings={() => setShowAdvancedSettings((v) => !v)}
                      onChange={onChange}
                      onAutoMapArguments={handleAutoMapArguments}
                    >
                      {argumentBindingsSection}
                    </KafkaPublishStepSection>
                  );
                }

                if (step.type === "service_call") {
                  return (
                    <ServiceCallStepSection
                      step={step}
                      allNodes={allNodes}
                      allEdges={allEdges}
                      serviceNodeId={serviceNodeId}
                      expectedArgs={expectedArgs}
                      showAdvancedSettings={showAdvancedSettings}
                      onToggleAdvancedSettings={() => setShowAdvancedSettings((v) => !v)}
                      onChange={onChange}
                      onAutoMapArguments={handleAutoMapArguments}
                    >
                      {argumentBindingsSection}
                    </ServiceCallStepSection>
                  );
                }

                if (step.type === "custom_code") {
                  return <CustomCodeSection step={step} onChange={onChange} />;
                }

                return (
                  <GenericFunctionRefSection step={step} onChange={onChange}>
                    {argumentBindingsSection}
                  </GenericFunctionRefSection>
                );
              })()}

              {/* Enable / Disable Step */}
              <div className="flex items-center justify-between pt-1 border-t border-border/30">
                <span className="text-[9px] text-muted-foreground/50 font-mono">
                  {step.type !== "custom_code" && step.functionRef?.name
                    ? `const ${displayVarName} = await ${step.functionRef.name}(...)`
                    : `Step ${index + 1}`}
                </span>
                <button
                  type="button"
                  className={`flex items-center gap-1.5 text-[10px] transition-colors ${
                    step.enabled === false
                      ? "text-muted-foreground/50"
                      : "text-primary/70 hover:text-primary"
                  }`}
                  onClick={() =>
                    onChange({ ...step, enabled: step.enabled === false ? true : false })
                  }
                >
                  <Check size={11} />
                  {step.enabled === false ? "Enable step" : "Disable step"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};
