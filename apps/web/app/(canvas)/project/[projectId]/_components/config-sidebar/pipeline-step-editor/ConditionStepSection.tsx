"use client";

import React, { useState } from "react";
import { Endpoint, BackendNode, BackendEdge, AnyMessagingResource } from "@workspace/canvas/types";
import { ConditionExprEditor } from "./ConditionExprEditor";
import { PipelineStepDraft, AvailableSource } from "./types";
import { PipelineStepEditor } from "./index";

export interface ConditionStepSectionProps {
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

export const ConditionStepSection = ({
  step,
  availableSources,
  endpoint,
  consumedEvent,
  allNodes = [],
  allEdges = [],
  serviceNodeId,
  depth = 0,
  onChange,
}: ConditionStepSectionProps) => {
  const [activeTab, setActiveTab] = useState<"then" | "else">("then");

  const thenCount = step.thenSteps?.length ?? 0;
  const elseCount = step.elseSteps?.length ?? 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Condition Expression Builder */}
      <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-accent/15 border border-border/60">
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
          Condition (IF)
        </span>
        <ConditionExprEditor
          expr={step.conditionExpr}
          availableSources={availableSources}
          onChange={(conditionExpr) => onChange({ ...step, conditionExpr })}
        />
      </div>

      {/* THEN / ELSE Branch Tabs */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1 border-b border-border/40 pb-1">
          <button
            type="button"
            className={`px-3 py-1 text-xs font-semibold rounded-t-md transition-colors flex items-center gap-1.5 ${
              activeTab === "then"
                ? "bg-amber-500/20 text-amber-300 border-b-2 border-amber-500"
                : "text-muted-foreground/70 hover:text-foreground hover:bg-accent/30"
            }`}
            onClick={() => setActiveTab("then")}
          >
            <span>THEN (If True)</span>
            {thenCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500/30 text-amber-200">
                {thenCount}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`px-3 py-1 text-xs font-semibold rounded-t-md transition-colors flex items-center gap-1.5 ${
              activeTab === "else"
                ? "bg-amber-500/20 text-amber-300 border-b-2 border-amber-500"
                : "text-muted-foreground/70 hover:text-foreground hover:bg-accent/30"
            }`}
            onClick={() => setActiveTab("else")}
          >
            <span>ELSE (If False)</span>
            {elseCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500/30 text-amber-200">
                {elseCount}
              </span>
            )}
          </button>
        </div>

        {/* Branch Step Editor */}
        <div className="p-2 rounded-lg bg-background/30 border border-border/40">
          {activeTab === "then" ? (
            <PipelineStepEditor
              steps={step.thenSteps || []}
              onChange={(thenSteps) => onChange({ ...step, thenSteps })}
              endpoint={endpoint}
              consumedEvent={consumedEvent}
              allNodes={allNodes}
              allEdges={allEdges}
              serviceNodeId={serviceNodeId}
              depth={depth + 1}
              isNested={true}
              droppableId={`droppable-${step.id}-then`}
            />
          ) : (
            <PipelineStepEditor
              steps={step.elseSteps || []}
              onChange={(elseSteps) => onChange({ ...step, elseSteps })}
              endpoint={endpoint}
              consumedEvent={consumedEvent}
              allNodes={allNodes}
              allEdges={allEdges}
              serviceNodeId={serviceNodeId}
              depth={depth + 1}
              isNested={true}
              droppableId={`droppable-${step.id}-else`}
            />
          )}
        </div>
      </div>
    </div>
  );
};
