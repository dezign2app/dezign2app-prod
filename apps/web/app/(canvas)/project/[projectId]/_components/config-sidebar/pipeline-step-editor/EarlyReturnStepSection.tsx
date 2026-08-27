"use client";

import React from "react";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { ArgumentBindingsSection } from "./ArgumentBindingsSection";
import { PipelineStepDraft, AvailableSource, StepBinding, ExpectedArg } from "./types";
import { HTTP_STATUS_OPTIONS } from "./utils";

export interface EarlyReturnStepSectionProps {
  step: PipelineStepDraft;
  availableSources: AvailableSource[];
  expectedArgs: ExpectedArg[];
  onChange: (updated: PipelineStepDraft) => void;
  onAutoMapArguments?: () => void;
}

export const EarlyReturnStepSection = ({
  step,
  availableSources,
  expectedArgs,
  onChange,
  onAutoMapArguments,
}: EarlyReturnStepSectionProps) => {
  const statusCode = step.statusCode || 404;

  const updateBinding = (index: number, updated: StepBinding) => {
    const nextBindings = [...(step.inputBindings || [])];
    nextBindings[index] = updated;
    onChange({ ...step, inputBindings: nextBindings });
  };

  const addBinding = () => {
    const newArgName = `arg${(step.inputBindings || []).length + 1}`;
    const newBinding: StepBinding = {
      argName: newArgName,
      source: { kind: "req_body", field: "" },
    };
    onChange({
      ...step,
      inputBindings: [...(step.inputBindings || []), newBinding],
    });
  };

  const removeBinding = (index: number) => {
    const nextBindings = (step.inputBindings || []).filter((_, i) => i !== index);
    onChange({ ...step, inputBindings: nextBindings });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Early Return Status Code Selector */}
      <div className="flex items-center justify-between p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">
            HTTP Status Code
          </span>
          <span className="text-[10px] text-muted-foreground">
            Immediately terminates execution and sends this response to the client
          </span>
        </div>

        <Select
          value={String(statusCode)}
          onValueChange={(v) => onChange({ ...step, statusCode: parseInt(v, 10) })}
        >
          <SelectTrigger className="h-7 text-xs bg-background/60 border-border/60 w-36 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HTTP_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.code} value={String(opt.code)} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Response Data Payload Mapping */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
          Response Body Payload Mapping
        </Label>
        <ArgumentBindingsSection
          bindings={step.inputBindings || []}
          expectedArgs={expectedArgs.length > 0 ? expectedArgs : [{ name: "data", type: "any" }]}
          availableSources={availableSources}
          onAddBinding={addBinding}
          onUpdateBinding={updateBinding}
          onRemoveBinding={removeBinding}
          onAutoMapArguments={onAutoMapArguments || (() => {})}
        />
      </div>
    </div>
  );
};
