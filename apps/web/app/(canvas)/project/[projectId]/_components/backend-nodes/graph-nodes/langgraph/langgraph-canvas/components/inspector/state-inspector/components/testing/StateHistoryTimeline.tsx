import React, { useState } from "react";
import { History, ChevronDown, ChevronRight, Undo2 } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import type { StateSimulationStep } from "../../utils/reducerSimulationEngine";

export interface StateHistoryTimelineProps {
  stepHistory: StateSimulationStep[];
  activeStepId: string;
  onRevertToStep: (stepId: string) => void;
}

export function StateHistoryTimeline({
  stepHistory,
  activeStepId,
  onRevertToStep,
}: StateHistoryTimelineProps) {
  const [showHistory, setShowHistory] = useState(true);

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-card border border-border/70 shadow-sm">
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setShowHistory((prev) => !prev)}
      >
        <div className="flex items-center gap-2">
          <History className="w-3.5 h-3.5 text-purple-400" />
          <span className="font-bold text-foreground text-xs">
            State Change History (Time Travel)
          </span>
          <Badge
            variant="outline"
            className="text-[9px] h-4 font-mono text-purple-300 border-purple-500/30"
          >
            {stepHistory.length} steps
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {showHistory ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </div>

      {showHistory && (
        <div className="flex flex-col gap-1.5 mt-1">
          {stepHistory.map((step, idx) => {
            const isActive = step.id === activeStepId;
            return (
              <div
                key={step.id}
                className={`flex items-center justify-between p-2 rounded text-xs font-mono transition-colors ${
                  isActive
                    ? "bg-purple-500/15 border border-purple-500/40 text-purple-200"
                    : "bg-muted/20 border border-border/40 text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="font-bold text-foreground">
                    #{idx}
                  </span>
                  <span className="truncate">{step.label}</span>
                  {isActive && (
                    <Badge
                      variant="secondary"
                      className="text-[8px] h-3 px-1 bg-purple-500/30 text-purple-200 border-0"
                    >
                      Active
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!isActive && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 text-[10px] gap-1 text-purple-300 hover:text-purple-100"
                      onClick={() => onRevertToStep(step.id)}
                      title="Revert state to this step"
                    >
                      <Undo2 className="w-3 h-3" />
                      <span>Revert</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
