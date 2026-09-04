"use client";

import React, { useState, useMemo } from "react";
import { Endpoint, BackendNode, BackendEdge, AnyMessagingResource } from "@workspace/canvas/types";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Plus, Trash } from "lucide-react";
import { SmartPathInput } from "./SmartPathInput";
import { PipelineStepDraft, AvailableSource, StepSource, SwitchCase } from "./types";
import { PipelineStepEditor } from "./index";
import { generateId } from "./utils";

export interface SwitchStepSectionProps {
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

export const SwitchStepSection = ({
  step,
  availableSources,
  endpoint,
  consumedEvent,
  allNodes = [],
  allEdges = [],
  serviceNodeId,
  depth = 0,
  onChange,
}: SwitchStepSectionProps) => {
  const switchSource = step.switchSource || { kind: "req_body", field: "" };
  const cases = useMemo(() => step.switchCases || [], [step.switchCases]);
  const [activeTab, setActiveTab] = useState<string>("case-0");

  const currentSourceOptionId = useMemo(() => {
    if (switchSource.kind === "step_output") {
      return `step:${switchSource.stepId}`;
    }
    return switchSource.kind;
  }, [switchSource]);

  const activeSource = availableSources.find((s) => s.id === currentSourceOptionId);

  const handleSourceSelect = (selectedId: string) => {
    if (selectedId.startsWith("step:")) {
      const stepId = selectedId.replace("step:", "");
      onChange({
        ...step,
        switchSource: { kind: "step_output", stepId, field: "" },
      });
    } else if (selectedId === "req_body") {
      onChange({ ...step, switchSource: { kind: "req_body", field: "" } });
    } else if (selectedId === "req_params") {
      onChange({ ...step, switchSource: { kind: "req_params", field: "" } });
    } else if (selectedId === "req_query") {
      onChange({ ...step, switchSource: { kind: "req_query", field: "" } });
    } else if (selectedId === "req_headers") {
      onChange({ ...step, switchSource: { kind: "req_headers", field: "" } });
    } else if (selectedId === "inline") {
      onChange({ ...step, switchSource: { kind: "inline", value: "" } });
    }
  };

  const addCase = () => {
    const newCaseId = generateId();
    const newCase: SwitchCase = {
      id: newCaseId,
      value: `value_${cases.length + 1}`,
      label: `Case ${cases.length + 1}`,
      steps: [],
    };
    const nextCases = [...cases, newCase];
    onChange({ ...step, switchCases: nextCases });
    setActiveTab(`case-${nextCases.length - 1}`);
  };

  const updateCase = (index: number, updated: SwitchCase) => {
    const nextCases = [...cases];
    nextCases[index] = updated;
    onChange({ ...step, switchCases: nextCases });
  };

  const removeCase = (index: number) => {
    const nextCases = cases.filter((_, i) => i !== index);
    onChange({ ...step, switchCases: nextCases });
    setActiveTab("case-0");
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Switch Target Value Selector */}
      <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
          Switch Target Value (switch on)
        </span>
        <div className="flex gap-1.5 items-center w-full">
          <Select value={currentSourceOptionId} onValueChange={handleSourceSelect}>
            <SelectTrigger className="h-7 text-xs bg-background/60 border-border/60 w-[130px] shrink-0">
              <SelectValue placeholder="Source..." />
            </SelectTrigger>
            <SelectContent>
              {availableSources
                .filter((s) => Boolean(s && s.id && s.id.trim() && s.id !== "inline"))
                .map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          {switchSource.kind !== "inline" ? (
            <SmartPathInput
              value={switchSource.field ?? ""}
              onChange={(field) =>
                onChange({
                  ...step,
                  switchSource: { ...switchSource, field },
                })
              }
              suggestedPaths={activeSource?.paths || []}
              sourceKindLabel={activeSource?.label}
              rootVariableName={activeSource?.rootVariableName}
            />
          ) : (
            <Input
              className="h-7 text-xs font-mono bg-background/60 border-border/60 flex-1"
              value={String(switchSource.value ?? "")}
              onChange={(e) =>
                onChange({
                  ...step,
                  switchSource: { kind: "inline", value: e.target.value },
                })
              }
              placeholder="inline value"
            />
          )}
        </div>
      </div>

      {/* Cases Tab Strip */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1 border-b border-border/40 pb-1 flex-wrap">
          {cases.map((c, idx) => {
            const tabKey = `case-${idx}`;
            const isCurrent = activeTab === tabKey;
            return (
              <button
                key={c.id || tabKey}
                type="button"
                className={`px-2.5 py-1 text-xs font-semibold rounded-t-md transition-colors flex items-center gap-1.5 ${
                  isCurrent
                    ? "bg-indigo-500/20 text-indigo-300 border-b-2 border-indigo-500"
                    : "text-muted-foreground/70 hover:text-foreground hover:bg-accent/30"
                }`}
                onClick={() => setActiveTab(tabKey)}
              >
                <span>case &quot;{String(c.value)}&quot;</span>
                {(c.steps?.length ?? 0) > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-indigo-500/30 text-indigo-200">
                    {c.steps.length}
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            className={`px-2.5 py-1 text-xs font-semibold rounded-t-md transition-colors flex items-center gap-1.5 ${
              activeTab === "default"
                ? "bg-indigo-500/20 text-indigo-300 border-b-2 border-indigo-500"
                : "text-muted-foreground/70 hover:text-foreground hover:bg-accent/30"
            }`}
            onClick={() => setActiveTab("default")}
          >
            <span>default</span>
            {(step.switchDefault?.length ?? 0) > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-indigo-500/30 text-indigo-200">
                {step.switchDefault?.length}
              </span>
            )}
          </button>

          <button
            type="button"
            className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition-colors ml-auto"
            onClick={addCase}
          >
            <Plus size={10} />
            <span>Add Case</span>
          </button>
        </div>

        {/* Active Tab Body */}
        <div className="p-2 rounded-lg bg-background/30 border border-border/40">
          {activeTab === "default" ? (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-muted-foreground">
                Default fallback branch when no case matches:
              </span>
              <PipelineStepEditor
                steps={step.switchDefault || []}
                onChange={(switchDefault) => onChange({ ...step, switchDefault })}
                endpoint={endpoint}
                consumedEvent={consumedEvent}
                allNodes={allNodes}
                allEdges={allEdges}
                serviceNodeId={serviceNodeId}
                depth={depth + 1}
                isNested={true}
                droppableId={`droppable-${step.id}-default`}
              />
            </div>
          ) : (
            (() => {
              const caseIndex = parseInt(activeTab.replace("case-", ""), 10);
              const currentCase = cases[caseIndex];
              if (!currentCase) {
                return (
                  <div className="text-xs text-muted-foreground p-3 text-center">
                    No case selected. Click &quot;Add Case&quot; above.
                  </div>
                );
              }

              return (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      Match Value:
                    </span>
                    <Input
                      className="h-7 text-xs font-mono bg-background/60 border-border/60 w-48"
                      value={String(currentCase.value ?? "")}
                      onChange={(e) =>
                        updateCase(caseIndex, {
                          ...currentCase,
                          value: e.target.value,
                        })
                      }
                      placeholder="e.g. pending"
                    />
                    <button
                      type="button"
                      className="p-1 rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors ml-auto"
                      onClick={() => removeCase(caseIndex)}
                      title="Delete this case"
                    >
                      <Trash size={12} />
                    </button>
                  </div>

                  <PipelineStepEditor
                    steps={currentCase.steps || []}
                    onChange={(steps) =>
                      updateCase(caseIndex, { ...currentCase, steps })
                    }
                    endpoint={endpoint}
                    consumedEvent={consumedEvent}
                    allNodes={allNodes}
                    allEdges={allEdges}
                    serviceNodeId={serviceNodeId}
                    depth={depth + 1}
                    isNested={true}
                    droppableId={`droppable-${step.id}-case-${caseIndex}`}
                  />
                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
};
