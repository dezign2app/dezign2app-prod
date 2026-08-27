"use client";

import React, { useState } from "react";
import { Endpoint, BackendNode, BackendEdge, AnyMessagingResource } from "@workspace/canvas/types";
import { PipelineStepDraft, AvailableSource } from "./types";
import { PipelineStepEditor } from "./index";

export interface TryCatchStepSectionProps {
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

const CATCH_EXTRA_SOURCES: AvailableSource[] = [
  {
    id: "caught_error",
    label: "Caught Error (caughtError)",
    kind: "step_output",
    stepId: "__catch_error__",
    variableName: "caughtError",
    rootVariableName: "caughtError",
    paths: [
      { path: "message", type: "string", description: "Error message" },
      { path: "name", type: "string", description: "Error name" },
      { path: "stack", type: "string", description: "Stack trace" },
    ],
  },
];

export const TryCatchStepSection = ({
  step,
  availableSources,
  endpoint,
  consumedEvent,
  allNodes = [],
  allEdges = [],
  serviceNodeId,
  depth = 0,
  onChange,
}: TryCatchStepSectionProps) => {
  const [activeTab, setActiveTab] = useState<"try" | "catch">("try");

  const tryCount = step.trySteps?.length ?? 0;
  const catchCount = step.catchSteps?.length ?? 0;

  return (
    <div className="flex flex-col gap-3">
      {/* TRY / CATCH Branch Tabs */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1 border-b border-border/40 pb-1">
          <button
            type="button"
            className={`px-3 py-1 text-xs font-semibold rounded-t-md transition-colors flex items-center gap-1.5 ${
              activeTab === "try"
                ? "bg-rose-500/20 text-rose-300 border-b-2 border-rose-500"
                : "text-muted-foreground/70 hover:text-foreground hover:bg-accent/30"
            }`}
            onClick={() => setActiveTab("try")}
          >
            <span>TRY Block</span>
            {tryCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-500/30 text-rose-200">
                {tryCount}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`px-3 py-1 text-xs font-semibold rounded-t-md transition-colors flex items-center gap-1.5 ${
              activeTab === "catch"
                ? "bg-rose-500/20 text-rose-300 border-b-2 border-rose-500"
                : "text-muted-foreground/70 hover:text-foreground hover:bg-accent/30"
            }`}
            onClick={() => setActiveTab("catch")}
          >
            <span>CATCH (caughtError)</span>
            {catchCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-500/30 text-rose-200">
                {catchCount}
              </span>
            )}
          </button>
        </div>

        {/* Branch Step Editor */}
        <div className="p-2 rounded-lg bg-background/30 border border-border/40">
          {activeTab === "try" ? (
            <PipelineStepEditor
              steps={step.trySteps || []}
              onChange={(trySteps) => onChange({ ...step, trySteps })}
              endpoint={endpoint}
              consumedEvent={consumedEvent}
              allNodes={allNodes}
              allEdges={allEdges}
              serviceNodeId={serviceNodeId}
              depth={depth + 1}
              isNested={true}
              droppableId={`droppable-${step.id}-try`}
            />
          ) : (
            <div className="flex flex-col gap-2">
              <div className="px-2 py-1 text-[10px] text-rose-300/80 bg-rose-500/10 rounded border border-rose-500/20">
                <span>Runs when any step in the TRY block throws. Variable </span>
                <code className="font-mono font-bold text-rose-200">caughtError</code>
                <span> is available for argument mapping.</span>
              </div>
              <PipelineStepEditor
                steps={step.catchSteps || []}
                onChange={(catchSteps) => onChange({ ...step, catchSteps })}
                endpoint={endpoint}
                consumedEvent={consumedEvent}
                allNodes={allNodes}
                allEdges={allEdges}
                serviceNodeId={serviceNodeId}
                depth={depth + 1}
                isNested={true}
                extraSources={CATCH_EXTRA_SOURCES}
                droppableId={`droppable-${step.id}-catch`}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
