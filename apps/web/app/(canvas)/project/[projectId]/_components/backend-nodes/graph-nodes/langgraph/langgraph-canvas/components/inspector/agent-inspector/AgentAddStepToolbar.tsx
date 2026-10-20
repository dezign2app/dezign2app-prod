import React from "react";
import { Plus } from "lucide-react";
import type { LangGraphNodePipelineStep, LangGraphNodeStepType } from "@workspace/canvas";
import { ADDABLE_LANGGRAPH_STEP_TYPES, LANGGRAPH_STEP_META } from "./stepTypes";

interface AgentAddStepToolbarProps {
  stepCount: number;
  activePipelineSteps: LangGraphNodePipelineStep[];
  onAddStep: (type: LangGraphNodeStepType) => void;
}

export function AgentAddStepToolbar({
  stepCount,
  activePipelineSteps,
  onAddStep,
}: AgentAddStepToolbarProps) {
  return (
    <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Add Execution Step
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">
          {stepCount} {stepCount === 1 ? "Step" : "Steps"} Configured
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ADDABLE_LANGGRAPH_STEP_TYPES.map((type) => {
          const meta = LANGGRAPH_STEP_META[type];
          const Icon = meta.icon;
          const count = activePipelineSteps.filter((s) => s.type === type).length;

          return (
            <button
              key={type}
              type="button"
              onClick={() => onAddStep(type)}
              className="flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-md border transition-all duration-150 shadow-xs cursor-pointer bg-secondary/40 hover:bg-secondary border-border/60 text-foreground/85 hover:text-foreground active:scale-95 hover:border-border"
              title={meta.description}
            >
              <Plus className="w-2.5 h-2.5 text-muted-foreground/80 shrink-0" />
              <Icon className={`w-3 h-3 ${meta.color} shrink-0`} />
              <span>{meta.label}</span>
              {count > 0 && (
                <span className="text-[9px] px-1 py-0 rounded bg-secondary/80 font-mono text-muted-foreground">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
