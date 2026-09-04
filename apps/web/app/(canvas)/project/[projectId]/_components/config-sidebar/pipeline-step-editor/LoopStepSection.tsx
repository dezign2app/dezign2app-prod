"use client";

import React, { useMemo } from "react";
import { Endpoint, BackendNode, BackendEdge, AnyMessagingResource } from "@workspace/canvas/types";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { SmartPathInput } from "./SmartPathInput";
import { ConditionExprEditor } from "./ConditionExprEditor";
import { PipelineStepDraft, AvailableSource } from "./types";
import { PipelineStepEditor } from "./index";
import { ShieldAlert, Repeat } from "lucide-react";

export interface LoopStepSectionProps {
  step: PipelineStepDraft;
  availableSources: AvailableSource[];
  endpoint?: Endpoint;
  consumedEvent?: AnyMessagingResource;
  allNodes?: BackendNode[];
  allEdges?: BackendEdge[];
  serviceNodeId?: string;
  depth?: number;
  onChange: (updated: PipelineStepDraft) => void;
}

export const LoopStepSection = ({
  step,
  availableSources,
  endpoint,
  consumedEvent,
  allNodes = [],
  allEdges = [],
  serviceNodeId,
  depth = 0,
  onChange,
}: LoopStepSectionProps) => {
  const loopKind = step.loopKind || "for_each";
  const loopSource = step.loopSource || { kind: "req_body", field: "" };
  const iterVar = step.iteratorVariable || (loopKind === "for" ? "i" : "item");
  const maxIterations = step.loopMaxIterations ?? 100;
  const forStart = step.loopForStart ?? 0;
  const forEnd = step.loopForEnd ?? 10;
  const forStep = step.loopForStep ?? 1;

  const currentSourceOptionId = useMemo(() => {
    if (loopSource.kind === "step_output") {
      return `step:${loopSource.stepId}`;
    }
    return loopSource.kind;
  }, [loopSource]);

  const activeSource = availableSources.find((s) => s.id === currentSourceOptionId);

  const handleSourceSelect = (selectedId: string) => {
    if (selectedId.startsWith("step:")) {
      const stepId = selectedId.replace("step:", "");
      onChange({
        ...step,
        loopSource: { kind: "step_output", stepId, field: "" },
      });
    } else if (selectedId === "req_body") {
      onChange({ ...step, loopSource: { kind: "req_body", field: "" } });
    } else if (selectedId === "req_params") {
      onChange({ ...step, loopSource: { kind: "req_params", field: "" } });
    } else if (selectedId === "req_query") {
      onChange({ ...step, loopSource: { kind: "req_query", field: "" } });
    } else if (selectedId === "req_headers") {
      onChange({ ...step, loopSource: { kind: "req_headers", field: "" } });
    } else if (selectedId === "inline") {
      onChange({ ...step, loopSource: { kind: "inline", value: "5" } });
    }
  };

  const loopExtraSources: AvailableSource[] = useMemo(() => {
    if (loopKind === "while" || loopKind === "do_while") return [];
    return [
      {
        id: `iterator_${iterVar}`,
        label: loopKind === "for" ? `Loop Index (${iterVar})` : `Loop Item (${iterVar})`,
        kind: "step_output",
        stepId: `__iterator__${iterVar}`,
        variableName: iterVar,
        rootVariableName: iterVar,
        paths: [],
      },
    ];
  }, [loopKind, iterVar]);

  return (
    <div className="flex flex-col gap-3">
      {/* Loop Type Selection & Header Config */}
      <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-secondary/30 border border-border/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Repeat size={13} className="text-primary/80" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/90">
              Loop Type
            </span>
          </div>

          {/* Loop Kind Selector */}
          <Select
            value={loopKind}
            onValueChange={(val) => {
              const kind = val as "for" | "for_each" | "while" | "do_while";
              onChange({
                ...step,
                loopKind: kind,
                iteratorVariable:
                  step.iteratorVariable || (kind === "for" ? "i" : "item"),
                ...(kind !== "for" && kind !== "for_each" && !step.loopConditionExpr && !step.conditionExpr
                  ? {
                      loopConditionExpr: {
                        left: { kind: "req_body", field: "" },
                        operator: "truthy",
                      },
                    }
                  : {}),
              });
            }}
          >
            <SelectTrigger className="h-6 text-xs bg-background/80 border-border/60 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="for_each" className="text-xs">
                For Each (Collection / Array)
              </SelectItem>
              <SelectItem value="while" className="text-xs">
                While Loop (Pre-Condition)
              </SelectItem>
              <SelectItem value="do_while" className="text-xs">
                Do While Loop (Post-Condition)
              </SelectItem>
              <SelectItem value="for" className="text-xs">
                For Loop (Index / Range)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 1. FOR LOOP: Index, Start, End, Step */}
        {loopKind === "for" && (
          <div className="flex flex-col gap-2 pt-1 border-t border-border/40">
            <div className="grid grid-cols-4 gap-2">
              {/* Index Variable Name */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-semibold text-muted-foreground">
                  Index Var
                </span>
                <Input
                  className="h-7 text-xs font-mono bg-background/60 border-border/60"
                  value={iterVar}
                  onChange={(e) =>
                    onChange({
                      ...step,
                      iteratorVariable: e.target.value,
                    })
                  }
                  placeholder="i"
                />
              </div>

              {/* Start Value */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-semibold text-muted-foreground">
                  Start (From)
                </span>
                <Input
                  type="number"
                  className="h-7 text-xs font-mono bg-background/60 border-border/60"
                  value={forStart}
                  onChange={(e) =>
                    onChange({
                      ...step,
                      loopForStart: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  placeholder="0"
                />
              </div>

              {/* End / Count Limit */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-semibold text-muted-foreground">
                  End (Count &lt;)
                </span>
                <Input
                  type="number"
                  className="h-7 text-xs font-mono bg-background/60 border-border/60"
                  value={forEnd}
                  onChange={(e) =>
                    onChange({
                      ...step,
                      loopForEnd: parseInt(e.target.value, 10) || 10,
                    })
                  }
                  placeholder="10"
                />
              </div>

              {/* Step / Increment */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-semibold text-muted-foreground">
                  Step (+N)
                </span>
                <Input
                  type="number"
                  min={1}
                  className="h-7 text-xs font-mono bg-background/60 border-border/60"
                  value={forStep}
                  onChange={(e) =>
                    onChange({
                      ...step,
                      loopForStep: parseInt(e.target.value, 10) || 1,
                    })
                  }
                  placeholder="1"
                />
              </div>
            </div>

            <span className="text-[9px] text-muted-foreground/70 font-mono">
              Syntax: for (let {iterVar} = {forStart}; {iterVar} &lt; {forEnd}; {iterVar} += {forStep})
            </span>
          </div>
        )}

        {/* 2. FOR EACH: Array & Iterator Configuration */}
        {loopKind === "for_each" && (
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
            {/* Target Source */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-semibold text-muted-foreground">
                Collection Source (Items to Iterate)
              </span>
              <div className="flex gap-1 items-center">
                <Select value={currentSourceOptionId} onValueChange={handleSourceSelect}>
                  <SelectTrigger className="h-7 text-xs bg-background/60 border-border/60 w-[120px] shrink-0">
                    <SelectValue placeholder="Source..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSources
                      .filter((s) => Boolean(s && s.id && s.id.trim()))
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">
                          {s.label}
                        </SelectItem>
                      ))}
                    {!availableSources.some((s) => s.id === "inline") && (
                      <SelectItem value="inline" className="text-xs">
                        Inline / Fixed Array
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>

                {loopSource.kind !== "inline" ? (
                  <SmartPathInput
                    value={loopSource.field ?? ""}
                    onChange={(field) =>
                      onChange({
                        ...step,
                        loopSource: { ...loopSource, field },
                      })
                    }
                    suggestedPaths={activeSource?.paths || []}
                    sourceKindLabel={activeSource?.label}
                    rootVariableName={activeSource?.rootVariableName}
                    placeholder="field or (entire output)"
                  />
                ) : (
                  <Input
                    className="h-7 text-xs font-mono bg-background/60 border-border/60 flex-1"
                    value={String(loopSource.value ?? "")}
                    onChange={(e) =>
                      onChange({
                        ...step,
                        loopSource: { kind: "inline", value: e.target.value },
                      })
                    }
                    placeholder="e.g. [1, 2, 3]"
                  />
                )}
              </div>
            </div>

            {/* Iterator Variable Name */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-semibold text-muted-foreground">
                Item Variable Name
              </span>
              <Input
                className="h-7 text-xs font-mono bg-background/60 border-border/60"
                value={iterVar}
                onChange={(e) =>
                  onChange({
                    ...step,
                    iteratorVariable: e.target.value,
                  })
                }
                placeholder="e.g. item"
              />
            </div>
          </div>
        )}

        {/* 3. WHILE / DO WHILE: Condition & Safety Limit Configuration */}
        {(loopKind === "while" || loopKind === "do_while") && (
          <div className="flex flex-col gap-2.5 pt-1 border-t border-border/40">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-semibold text-muted-foreground">
                {loopKind === "while"
                  ? "Loop Condition (Runs while condition is true)"
                  : "Post-Condition (Runs body once, then repeats while true)"}
              </span>
              <ConditionExprEditor
                expr={
                  step.loopConditionExpr ||
                  step.conditionExpr || {
                    left: { kind: "req_body", field: "" },
                    operator: "truthy",
                  }
                }
                availableSources={availableSources}
                onChange={(loopConditionExpr) =>
                  onChange({ ...step, loopConditionExpr, conditionExpr: loopConditionExpr })
                }
                compact={true}
              />
            </div>

            {/* Max Iterations Safety Limit */}
            <div className="flex items-center justify-between p-1.5 rounded bg-background/40 border border-border/40">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldAlert size={12} className="text-amber-400 shrink-0" />
                <span className="text-[10px]">
                  Max Iterations limit (prevents infinite loops):
                </span>
              </div>
              <Input
                type="number"
                min={1}
                max={10000}
                className="h-6 w-20 text-xs font-mono bg-background border-border/60 text-right"
                value={maxIterations}
                onChange={(e) =>
                  onChange({
                    ...step,
                    loopMaxIterations: parseInt(e.target.value, 10) || 100,
                  })
                }
              />
            </div>
          </div>
        )}
      </div>

      {/* Loop Body Step Editor */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Loop Body Steps:
          </span>
          <span className="text-[9px] font-mono text-foreground/80 bg-secondary/50 px-1.5 py-0.5 rounded border border-border/60">
            {loopKind === "for"
              ? `for (${iterVar} = ${forStart}; ${iterVar} < ${forEnd}; ${iterVar} += ${forStep})`
              : loopKind === "while"
              ? "while (condition) { ... }"
              : loopKind === "do_while"
              ? "do { ... } while (condition)"
              : `for (const ${iterVar} of items)`}
          </span>
        </div>

        <div className="p-2 rounded-lg bg-background/30 border border-border/40">
          <PipelineStepEditor
            steps={step.loopBody || []}
            onChange={(loopBody) => onChange({ ...step, loopBody })}
            endpoint={endpoint}
            consumedEvent={consumedEvent}
            allNodes={allNodes}
            allEdges={allEdges}
            serviceNodeId={serviceNodeId}
            depth={depth + 1}
            isNested={true}
            extraSources={loopExtraSources}
            droppableId={`droppable-${step.id}-loop`}
          />
        </div>
      </div>
    </div>
  );
};
