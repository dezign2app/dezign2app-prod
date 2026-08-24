"use client";

import React from "react";
import { Cloud } from "lucide-react";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { PipelineStepDraft } from "./types";

export interface GenericFunctionRefSectionProps {
  step: PipelineStepDraft;
  onChange: (updated: PipelineStepDraft) => void;
  children?: React.ReactNode;
}

export const GenericFunctionRefSection = ({
  step,
  onChange,
  children,
}: GenericFunctionRefSectionProps) => {
  return (
    <div className="flex flex-col gap-3 p-2.5 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04]">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
        <Cloud size={13} />
        <span>Function Call Reference</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground">Function name</Label>
          <Input
            className="h-7 text-xs font-mono bg-background/60 border-border/60"
            value={step.functionRef?.name ?? ""}
            onChange={(e) =>
              onChange({
                ...step,
                functionRef: {
                  ...(step.functionRef ?? { importPath: "" }),
                  name: e.target.value,
                },
              })
            }
            placeholder="e.g. processData"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground">Import path</Label>
          <Input
            className="h-7 text-xs font-mono bg-background/60 border-border/60"
            value={step.functionRef?.importPath ?? ""}
            onChange={(e) =>
              onChange({
                ...step,
                functionRef: {
                  ...(step.functionRef ?? { name: "" }),
                  importPath: e.target.value,
                },
              })
            }
            placeholder="e.g. @workspace/services"
          />
        </div>
      </div>

      {children}
    </div>
  );
};
