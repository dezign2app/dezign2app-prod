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
import { PipelineStepDraft, AvailableSource, ParallelBranch } from "./types";
import { PipelineStepEditor } from "./index";
import { generateId } from "./utils";

export interface ParallelStepSectionProps {
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

export const ParallelStepSection = ({
  step,
  availableSources,
  endpoint,
  consumedEvent,
  allNodes = [],
  allEdges = [],
  serviceNodeId,
  depth = 0,
  onChange,
}: ParallelStepSectionProps) => {
  const branches = useMemo(() => step.parallelBranches || [], [step.parallelBranches]);
  const [activeTab, setActiveTab] = useState<number>(0);
  const failureMode = step.failureMode || "all";

  const addBranch = () => {
    const newBranch: ParallelBranch = {
      id: generateId(),
      label: `Branch ${branches.length + 1}`,
      steps: [],
    };
    const nextBranches = [...branches, newBranch];
    onChange({ ...step, parallelBranches: nextBranches });
    setActiveTab(nextBranches.length - 1);
  };

  const updateBranch = (index: number, updated: ParallelBranch) => {
    const nextBranches = [...branches];
    nextBranches[index] = updated;
    onChange({ ...step, parallelBranches: nextBranches });
  };

  const removeBranch = (index: number) => {
    const nextBranches = branches.filter((_, i) => i !== index);
    onChange({ ...step, parallelBranches: nextBranches });
    setActiveTab(0);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Failure Mode Configuration */}
      <div className="flex items-center justify-between p-2 rounded-lg bg-sky-500/10 border border-sky-500/20">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
            Execution Strategy
          </span>
          <span className="text-[10px] text-muted-foreground">
            {failureMode === "all"
              ? "Promise.all — throws immediately if any branch fails (Critical operations)"
              : "Promise.allSettled — runs all branches and collects results (Side effects)"}
          </span>
        </div>

        <Select
          value={failureMode}
          onValueChange={(v) => onChange({ ...step, failureMode: v as "all" | "any" })}
        >
          <SelectTrigger className="h-7 text-xs bg-background/60 border-border/60 w-36 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              Promise.all (All)
            </SelectItem>
            <SelectItem value="any" className="text-xs">
              Promise.allSettled (Any)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Branch Tabs */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1 border-b border-border/40 pb-1 flex-wrap">
          {branches.map((b, idx) => {
            const isCurrent = activeTab === idx;
            return (
              <button
                key={b.id || `branch-${idx}`}
                type="button"
                className={`px-2.5 py-1 text-xs font-semibold rounded-t-md transition-colors flex items-center gap-1.5 ${
                  isCurrent
                    ? "bg-sky-500/20 text-sky-300 border-b-2 border-sky-500"
                    : "text-muted-foreground/70 hover:text-foreground hover:bg-accent/30"
                }`}
                onClick={() => setActiveTab(idx)}
              >
                <span>{b.label || `Branch ${idx + 1}`}</span>
                {(b.steps?.length ?? 0) > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-sky-500/30 text-sky-200">
                    {b.steps.length}
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 transition-colors ml-auto"
            onClick={addBranch}
          >
            <Plus size={10} />
            <span>Add Branch</span>
          </button>
        </div>

        {/* Branch Step Editor */}
        <div className="p-2 rounded-lg bg-background/30 border border-border/40">
          {(() => {
            const currentBranch = branches[activeTab];
            if (!currentBranch) {
              return (
                <div className="text-xs text-muted-foreground p-3 text-center">
                  No branch created yet. Click &quot;Add Branch&quot; to create a concurrent branch.
                </div>
              );
            }

            return (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    Branch Name:
                  </span>
                  <Input
                    className="h-7 text-xs font-mono bg-background/60 border-border/60 w-48"
                    value={currentBranch.label || ""}
                    onChange={(e) =>
                      updateBranch(activeTab, {
                        ...currentBranch,
                        label: e.target.value,
                      })
                    }
                    placeholder={`Branch ${activeTab + 1}`}
                  />
                  {branches.length > 1 && (
                    <button
                      type="button"
                      className="p-1 rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors ml-auto"
                      onClick={() => removeBranch(activeTab)}
                      title="Delete this branch"
                    >
                      <Trash size={12} />
                    </button>
                  )}
                </div>

                <PipelineStepEditor
                  steps={currentBranch.steps || []}
                  onChange={(steps) =>
                    updateBranch(activeTab, { ...currentBranch, steps })
                  }
                  endpoint={endpoint}
                  consumedEvent={consumedEvent}
                  allNodes={allNodes}
                  allEdges={allEdges}
                  serviceNodeId={serviceNodeId}
                  depth={depth + 1}
                  isNested={true}
                  droppableId={`droppable-${step.id}-branch-${activeTab}`}
                />
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
