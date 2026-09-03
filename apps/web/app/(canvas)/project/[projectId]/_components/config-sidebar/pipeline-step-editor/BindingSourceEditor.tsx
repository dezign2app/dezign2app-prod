"use client";

import React, { useMemo } from "react";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { SmartPathInput } from "./SmartPathInput";
import { StepBinding, AvailableSource } from "./types";

export interface BindingSourceEditorProps {
  binding: StepBinding;
  availableSources: AvailableSource[];
  onChange: (updated: StepBinding) => void;
}

export const BindingSourceEditor = ({
  binding,
  availableSources,
  onChange,
}: BindingSourceEditorProps) => {
  const { source } = binding;

  const currentSourceOptionId = useMemo(() => {
    if (source.kind === "step_output") {
      return `step:${source.stepId}`;
    }
    return source.kind;
  }, [source]);

  const activeSource = availableSources.find((s) => s.id === currentSourceOptionId);

  const handleSourceSelect = (selectedId: string) => {
    if (selectedId.startsWith("step:")) {
      const stepId = selectedId.replace("step:", "");
      onChange({
        ...binding,
        source: { kind: "step_output", stepId, field: "" },
      });
    } else if (selectedId === "req_body") {
      onChange({ ...binding, source: { kind: "req_body", field: "" } });
    } else if (selectedId === "req_params") {
      onChange({ ...binding, source: { kind: "req_params", field: "" } });
    } else if (selectedId === "req_query") {
      onChange({ ...binding, source: { kind: "req_query", field: "" } });
    } else if (selectedId === "req_headers") {
      onChange({ ...binding, source: { kind: "req_headers", field: "" } });
    } else if (selectedId === "literal") {
      onChange({ ...binding, source: { kind: "literal", value: "" } });
    }
  };

  return (
    <div className="flex gap-1.5 items-center w-full">
      {/* Source selector */}
      <Select value={currentSourceOptionId} onValueChange={handleSourceSelect}>
        <SelectTrigger className="h-7 text-xs bg-background/60 border-border/60 w-[140px] shrink-0">
          <SelectValue placeholder="Source..." />
        </SelectTrigger>
        <SelectContent>
          {availableSources
            .filter((s) => Boolean(s && s.id && s.id.trim()))
            .map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
                {s.label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      {/* Path / Value field editor */}
      {source.kind !== "literal" ? (
        <SmartPathInput
          value={source.field ?? ""}
          onChange={(field) => onChange({ ...binding, source: { ...source, field } })}
          suggestedPaths={activeSource?.paths || []}
          sourceKindLabel={activeSource?.label}
          rootVariableName={activeSource?.rootVariableName}
        />
      ) : (
        <Input
          className="h-7 text-xs font-mono bg-background/60 border-border/60 flex-1"
          placeholder="value"
          value={String(source.value ?? "")}
          onChange={(e) =>
            onChange({ ...binding, source: { ...source, value: e.target.value } })
          }
        />
      )}
    </div>
  );
};
