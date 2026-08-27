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
import { PipelineStepDraft, AvailableSource } from "./types";
import { PipelineStepEditor } from "./index";

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
  const loopSource = step.loopSource || { kind: "req_body", field: "" };
  const iterVar = step.iteratorVariable || "item";

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
    }
  };

  const loopExtraSources: AvailableSource[] = useMemo(
    () => [
      {
        id: `iterator_${iterVar}`,
        label: `Loop Item (${iterVar})`,
        kind: "step_output",
        stepId: `__iterator__${iterVar}`,
        variableName: iterVar,
        rootVariableName: iterVar,
        paths: [],
      },
    ],
    [iterVar],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Target Array & Iterator Variable Config */}
      <div className="flex flex-col gap-2 p-2 rounded-lg bg-teal-500/10 border border-teal-500/20">
        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
          Collection to Iterate (forEach / map)
        </span>

        <div className="grid grid-cols-2 gap-2">
          {/* Target Array Source */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-semibold text-muted-foreground">
              Array Source
            </span>
            <div className="flex gap-1 items-center">
              <Select value={currentSourceOptionId} onValueChange={handleSourceSelect}>
                <SelectTrigger className="h-7 text-xs bg-background/60 border-border/60 w-[110px] shrink-0">
                  <SelectValue placeholder="Source..." />
                </SelectTrigger>
                <SelectContent>
                  {availableSources
                    .filter((s) => s.id !== "literal")
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              {loopSource.kind !== "literal" ? (
                <SmartPathInput
                  value={loopSource.field ?? ""}
                  onChange={(field) =>
                    onChange({
                      ...step,
                      loopSource: { ...loopSource, field },
                    })
                  }
                  suggestedPaths={
                    activeSource?.paths.filter((p) => p.type === "array" || !p.type) || []
                  }
                  sourceKindLabel={activeSource?.label}
                  rootVariableName={activeSource?.rootVariableName}
                  placeholder="items"
                />
              ) : (
                <Input
                  className="h-7 text-xs font-mono bg-background/60 border-border/60 flex-1"
                  value={String(loopSource.value ?? "")}
                  onChange={(e) =>
                    onChange({
                      ...step,
                      loopSource: { kind: "literal", value: e.target.value },
                    })
                  }
                  placeholder="items"
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
      </div>

      {/* Loop Body Step Editor */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Loop Body Steps (Executed for each item):
          </span>
          <span className="text-[9px] font-mono text-teal-300 bg-teal-500/20 px-1.5 py-0.5 rounded border border-teal-500/30">
            const {iterVar} = items[i]
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
