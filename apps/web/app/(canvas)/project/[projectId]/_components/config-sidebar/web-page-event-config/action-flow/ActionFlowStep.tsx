import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Globe,
  HardDrive,
  Database,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { getMethodColor } from "../TargetEndpointSection";
import type { ActionFlowStepProps } from "./types";
import { ApiCallStep } from "./ApiCallStep";
import { StoragePutStep } from "./StoragePutStep";

export const ActionFlowStep: React.FC<ActionFlowStepProps> = ({
  stepDraft,
  canvasStep,
  stepIndex,
  allSteps,
  allCanvasSteps,
  allNodes,
  endpoints,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const stepNumber = stepIndex + 1;
  const isStorage = stepDraft.type === "storage_put";

  const targetNodeLabel =
    canvasStep?.targetNode?.data?.label ||
    canvasStep?.targetNodeId ||
    "Action Target";

  const endpointMethod = canvasStep?.endpoint?.type || "POST";
  const endpointName =
    canvasStep?.endpoint?.name ||
    (isStorage ? `${canvasStep?.operationName || "uploadObject"}()` : "/endpoint");

  return (
    <div className="rounded-lg border bg-card/70 overflow-hidden shadow-xs transition-colors">
      {/* Step Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2.5 flex items-center justify-between cursor-pointer select-none bg-muted/20 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Step Number Circle */}
          <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/30 text-primary flex items-center justify-center text-[11px] font-bold shrink-0">
            {stepNumber}
          </div>

          {/* Type Badge */}
          {isStorage ? (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 flex items-center gap-1 shrink-0"
            >
              <HardDrive size={10} />
              Storage PUT
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 flex items-center gap-1 shrink-0"
            >
              <Globe size={10} />
              API Call
            </Badge>
          )}

          {/* Target details */}
          <div className="flex items-center gap-1.5 truncate text-xs">
            <span className="font-semibold text-foreground truncate">
              {targetNodeLabel}
            </span>
            <ArrowRight size={11} className="text-muted-foreground shrink-0" />
            {!isStorage && (
              <span
                className={`text-[9px] font-bold px-1 py-0.2 rounded border shrink-0 ${getMethodColor(
                  endpointMethod,
                )}`}
              >
                {endpointMethod}
              </span>
            )}
            <span className="text-muted-foreground truncate font-mono text-[11px]">
              {endpointName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-muted-foreground shrink-0 ml-2">
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </div>

      {/* Step Details Body */}
      {isOpen && (
        <div className="p-3 border-t bg-card/40 space-y-3">
          {isStorage ? (
            <StoragePutStep
              draft={stepDraft}
              canvasStep={canvasStep}
              stepIndex={stepIndex}
              allSteps={allSteps}
              allCanvasSteps={allCanvasSteps}
              endpoints={endpoints}
              onChange={onChange}
            />
          ) : (
            <ApiCallStep
              draft={stepDraft}
              canvasStep={canvasStep}
              stepIndex={stepIndex}
              allSteps={allSteps}
              allCanvasSteps={allCanvasSteps}
              onChange={onChange}
            />
          )}
        </div>
      )}
    </div>
  );
};
