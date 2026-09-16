"use client";

import React, { useMemo } from "react";
import { Layers, ArrowRight, Sparkles } from "lucide-react";
import {
  BackendNode,
  BackendEdge,
  Endpoint,
  AnyMessagingResource,
} from "@workspace/canvas/types";
import { Label } from "@workspace/ui/components/label";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { cn } from "@workspace/ui/lib/utils";
import { toVarName } from "@/lib/compiler/utils";
import { PipelineStepDraft, AvailableSource } from "./types";
import { PipelineStepEditor } from "./PipelineStepEditor";

export interface RedisCacheMissSectionProps {
  step: PipelineStepDraft;
  allNodes: BackendNode[];
  allEdges?: BackendEdge[];
  availableSources?: AvailableSource[];
  endpoint?: Endpoint;
  consumedEvent?: AnyMessagingResource;
  serviceNodeId?: string;
  depth?: number;
  onChange: (updated: PipelineStepDraft) => void;
}

export const RedisCacheMissSection: React.FC<RedisCacheMissSectionProps> = ({
  step,
  allNodes,
  allEdges = [],
  availableSources = [],
  endpoint,
  consumedEvent,
  serviceNodeId,
  depth = 0,
  onChange,
}) => {
  const isEnabled =
    step.cacheMiss?.enabled ??
    Boolean(step.cacheMissSteps && step.cacheMissSteps.length > 0);

  const [localEnabled, setLocalEnabled] = React.useState<boolean>(isEnabled);

  React.useEffect(() => {
    setLocalEnabled(isEnabled);
  }, [isEnabled]);

  const stepCount = step.cacheMissSteps?.length ?? 0;

  const badgeText = useMemo(() => {
    if (!localEnabled) return "Disabled (Proceed with null)";
    if (stepCount > 0) {
      return `${stepCount} ${stepCount === 1 ? "step" : "steps"}`;
    }
    return "Configuring steps...";
  }, [localEnabled, stepCount]);

  const handleToggle = (checked: boolean | "indeterminate") => {
    const isNowEnabled = checked === true;
    setLocalEnabled(isNowEnabled);
    onChange({
      ...step,
      cacheMiss: {
        ...(step.cacheMiss || {}),
        enabled: isNowEnabled,
      },
      cacheMissSteps: step.cacheMissSteps || [],
    });
  };

  // Filter available sources to only prior step outputs so request params/body are not duplicated
  const parentStepSources = useMemo(() => {
    return (availableSources || []).filter(
      (s) =>
        s.kind === "step_output" ||
        s.id.startsWith("step:") ||
        s.id.startsWith("iterator_") ||
        s.id === "caught_error",
    );
  }, [availableSources]);

  // Collect candidate step outputs from inside cacheMissSteps
  const candidateStepOutputs = useMemo(() => {
    return (step.cacheMissSteps || [])
      .filter((s) => s.outputVariable && s.outputVariable.trim())
      .map((s) => s.outputVariable!.trim());
  }, [step.cacheMissSteps]);

  // Check if there was a legacy fallback_db configured without steps
  const hasLegacyConfig = Boolean(
    step.cacheMiss?.action === "fallback_db" &&
      step.cacheMiss.tableNodeId &&
      (!step.cacheMissSteps || step.cacheMissSteps.length === 0),
  );

  const handleConvertLegacyToSteps = () => {
    if (!step.cacheMiss) return;
    const dbOutputVar = `${toVarName(step.outputVariable || "cacheItem")}_db`;
    const newSteps: PipelineStepDraft[] = [];

    // 1. DB Step
    if (step.cacheMiss.tableNodeId) {
      newSteps.push({
        id: `step-${Date.now()}-db`,
        name: step.cacheMiss.functionRef?.name || "Fetch from Database",
        type: "db_operation",
        enabled: true,
        tableNodeId: step.cacheMiss.tableNodeId,
        databaseId: step.cacheMiss.databaseId,
        operationId: step.cacheMiss.operationId,
        functionRef: step.cacheMiss.functionRef,
        inputBindings: step.cacheMiss.inputBindings || [],
        outputVariable: dbOutputVar,
      });
    }

    // 2. Redis write-back step
    if (step.cacheMiss.writeBackToCache && step.cacheMiss.writeBackFunctionRef?.name) {
      newSteps.push({
        id: `step-${Date.now() + 1}-redis`,
        name: step.cacheMiss.writeBackFunctionRef.name,
        type: "redis_operation",
        enabled: true,
        functionRef: step.cacheMiss.writeBackFunctionRef,
        operationId: step.cacheMiss.writeBackOperationId,
        inputBindings: step.cacheMiss.writeBackInputBindings || [],
      });
    }

    onChange({
      ...step,
      cacheMiss: {
        enabled: true,
        reassignVariable: dbOutputVar,
      },
      cacheMissSteps: newSteps,
    });
  };

  return (
    <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
      {/* Header / Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`cache-miss-toggle-${step.id}`}
            checked={localEnabled}
            onCheckedChange={handleToggle}
            className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
          />
          <label
            htmlFor={`cache-miss-toggle-${step.id}`}
            className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90 cursor-pointer"
          >
            <Layers size={13} className="text-amber-500" />
            <span>Cache Miss Handling</span>
          </label>
        </div>

        <span
          className={cn(
            "text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors",
            localEnabled
              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
              : "bg-muted/40 text-muted-foreground border-border/40",
          )}
        >
          {badgeText}
        </span>
      </div>

      {localEnabled && (
        <div className="flex flex-col gap-2.5 p-2.5 rounded-lg border border-border/60 bg-background/50 mt-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              Executed when cache key is not found (result is{" "}
              <code className="text-amber-400 font-mono">null / undefined</code>).
            </span>

            {hasLegacyConfig && (
              <button
                type="button"
                className="text-[9px] text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                onClick={handleConvertLegacyToSteps}
              >
                <Sparkles size={10} />
                Convert Legacy DB Fallback to Steps
              </button>
            )}
          </div>

          {/* Nested Pipeline Step Editor */}
          <div className="p-2 rounded-lg bg-background/40 border border-border/40">
            <PipelineStepEditor
              steps={step.cacheMissSteps || []}
              onChange={(cacheMissSteps) => {
                onChange({
                  ...step,
                  cacheMissSteps,
                  cacheMiss: {
                    ...(step.cacheMiss || {}),
                    enabled: true,
                  },
                });
              }}
              endpoint={endpoint}
              consumedEvent={consumedEvent}
              allNodes={allNodes}
              allEdges={allEdges}
              serviceNodeId={serviceNodeId}
              depth={depth + 1}
              isNested={true}
              extraSources={parentStepSources}
              droppableId={`droppable-${step.id}-cache-miss`}
            />
          </div>

          {/* Output Re-assignment Selector (if step has an outputVariable and cacheMiss has output-producing steps) */}
          {step.outputVariable && candidateStepOutputs.length > 0 && (
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/30">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <ArrowRight size={11} className="text-primary" />
                <span>
                  Update <span className="font-mono text-foreground font-semibold">{step.outputVariable}</span> with:
                </span>
              </Label>
              <Select
                value={step.cacheMiss?.reassignVariable || "__none__"}
                onValueChange={(val) => {
                  onChange({
                    ...step,
                    cacheMiss: {
                      ...(step.cacheMiss || {}),
                      enabled: true,
                      reassignVariable: val === "__none__" ? undefined : val,
                    },
                  });
                }}
              >
                <SelectTrigger className="h-6 w-48 text-[11px] font-mono bg-background border-border/60">
                  <SelectValue placeholder="Select output..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-xs font-mono text-muted-foreground">
                    Do not update (keep null or early returned)
                  </SelectItem>
                  {candidateStepOutputs.map((v) => (
                    <SelectItem key={v} value={v} className="text-xs font-mono">
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
