"use client";

import React from "react";
import { Label } from "@workspace/ui/components/label";
import { BufferedTextarea } from "./BufferedInput";
import { PipelineStepDraft } from "./types";

export interface CustomCodeSectionProps {
  step: PipelineStepDraft;
  onChange: (updated: PipelineStepDraft) => void;
}

export const CustomCodeSection = ({
  step,
  onChange,
}: CustomCodeSectionProps) => {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px] text-muted-foreground">TypeScript code</Label>
      <BufferedTextarea
        className="text-xs font-mono bg-background/60 border border-border/60 rounded-md p-2 min-h-[80px] resize-y text-foreground/90 focus:outline-none focus:ring-1 focus:ring-primary/40"
        value={step.customCode ?? ""}
        onCommit={(val) => onChange({ ...step, customCode: val })}
        placeholder="// raw TypeScript to inline at this step&#10;const result = someValue;"
      />
    </div>
  );
};
