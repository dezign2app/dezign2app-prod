"use client";

import React, { useMemo } from "react";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Variable, ArrowRight, Code2 } from "lucide-react";
import { BufferedInput } from "./BufferedInput";
import { BindingSourceEditor } from "./BindingSourceEditor";
import {
  PipelineStepDraft,
  AvailableSource,
  StepBinding,
} from "./types";
import { getPriorMutableVariables } from "./utils";
import { toVarName } from "@/lib/compiler/utils";

export interface VariableStepSectionProps {
  step: PipelineStepDraft;
  priorSteps: PipelineStepDraft[];
  availableSources: AvailableSource[];
  serviceNodeId?: string;
  onChange: (updated: PipelineStepDraft) => void;
}

const COMMON_DATA_TYPES: readonly string[] = [
  "string",
  "number",
  "boolean",
  "Record<string, string>",
  "Record<string, number>",
  "string[]",
  "number[]",
  "object",
];

export const VariableStepSection: React.FC<VariableStepSectionProps> = ({
  step,
  priorSteps,
  availableSources,
  serviceNodeId,
  onChange,
}) => {
  const variableOperation = step.variableOperation || "declare";
  const declarationKind = step.declarationKind || "let";
  const variableOperator = step.variableOperator || "=";
  const variableDataType = step.variableDataType || "";
  const varName = step.outputVariable || "myVar";

  // Collect prior mutable variables for the assignment dropdown
  const priorMutableVars = useMemo(
    () => getPriorMutableVariables(priorSteps),
    [priorSteps],
  );

  // Synthesize binding object for BindingSourceEditor
  const currentBinding: StepBinding = useMemo(
    () => ({
      argName: varName || "value",
      source: step.variableSource || { kind: "inline", value: "" },
    }),
    [varName, step.variableSource],
  );

  const handleSourceChange = (updatedBinding: StepBinding) => {
    onChange({
      ...step,
      variableSource: updatedBinding.source,
    });
  };

  // Preview code generator
  const previewCode = useMemo(() => {
    const cleanName = toVarName(varName || "customVar");
    const source = step.variableSource;
    let sourceStr = "/* uninitialized */";

    if (source) {
      if (source.kind === "inline") {
        sourceStr =
          typeof source.value === "string"
            ? `"${source.value}"`
            : String(source.value ?? '""');
      } else if (source.kind === "req_body") {
        sourceStr = source.field ? `req.body.${source.field}` : `req.body`;
      } else if (source.kind === "req_params") {
        sourceStr = source.field ? `req.params.${source.field}` : `req.params`;
      } else if (source.kind === "req_query") {
        sourceStr = source.field ? `req.query.${source.field}` : `req.query`;
      } else if (source.kind === "env") {
        sourceStr = `process.env.${source.field || "ENV_VAR"}`;
      } else if (source.kind === "step_output") {
        const matched = priorSteps.find((s) => s.id === source.stepId);
        const refVar = matched?.outputVariable || source.stepId;
        sourceStr = source.field ? `${refVar}.${source.field}` : refVar;
      }
    }

    if (variableOperation === "assign") {
      return `${cleanName} ${variableOperator} ${sourceStr};`;
    }

    const keyword = declarationKind === "const" ? "const" : "let";
    const typeStr =
      variableDataType && variableDataType.trim() && variableDataType.trim() !== "any"
        ? `: ${variableDataType.trim()}`
        : "";

    if (!source && keyword === "let") {
      return `let ${cleanName}${typeStr};`;
    }

    return `${keyword} ${cleanName}${typeStr} = ${sourceStr};`;
  }, [
    varName,
    variableOperation,
    declarationKind,
    variableOperator,
    variableDataType,
    step.variableSource,
    priorSteps,
  ]);

  return (
    <div className="flex flex-col gap-3">
      {/* Operation Mode Selector: Declare vs Assign */}
      <div className="flex items-center gap-1.5 p-1 rounded-lg bg-secondary/40 border border-border/50">
        <button
          type="button"
          className={`flex-1 py-1 px-2.5 rounded-md text-[11px] font-medium transition-all ${
            variableOperation === "declare"
              ? "bg-background text-foreground shadow-xs border border-border/70"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => {
            onChange({
              ...step,
              variableOperation: "declare",
              declarationKind: step.declarationKind === "reassign" ? "let" : step.declarationKind || "let",
            });
          }}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Variable size={12} className="text-blue-400" />
            <span>Declare Variable</span>
          </span>
        </button>

        <button
          type="button"
          className={`flex-1 py-1 px-2.5 rounded-md text-[11px] font-medium transition-all ${
            variableOperation === "assign"
              ? "bg-background text-foreground shadow-xs border border-border/70"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => {
            const firstAvailable = priorMutableVars[0]?.name || step.outputVariable || "customVar";
            onChange({
              ...step,
              variableOperation: "assign",
              declarationKind: "reassign",
              outputVariable: firstAvailable,
              name: `Assign ${firstAvailable}`,
            });
          }}
        >
          <span className="flex items-center justify-center gap-1.5">
            <ArrowRight size={12} className="text-amber-400" />
            <span>Update / Reassign (=)</span>
          </span>
        </button>
      </div>

      {/* Mode A: Declare Variable */}
      {variableOperation === "declare" && (
        <div className="flex flex-col gap-2.5 p-2.5 rounded-lg border border-border/50 bg-background/40">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Declaration Keyword (let vs const) */}
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground font-medium">Keyword</Label>
              <Select
                value={declarationKind === "const" ? "const" : "let"}
                onValueChange={(val) => {
                  if (val === "let" || val === "const") {
                    onChange({
                      ...step,
                      declarationKind: val,
                    });
                  }
                }}
              >
                <SelectTrigger className="h-7 text-xs bg-background/60 border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="let" className="text-xs font-mono">
                    <span className="font-semibold text-blue-400">let</span>
                    <span className="text-[9px] text-muted-foreground ml-1.5">(mutable)</span>
                  </SelectItem>
                  <SelectItem value="const" className="text-xs font-mono">
                    <span className="font-semibold text-purple-400">const</span>
                    <span className="text-[9px] text-muted-foreground ml-1.5">(immutable)</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Variable Name */}
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground font-medium">Variable Name</Label>
              <BufferedInput
                className="h-7 text-xs font-mono bg-background/60 border-border/60"
                value={step.outputVariable ?? ""}
                onCommit={(val) => {
                  const clean = toVarName(val);
                  onChange({
                    ...step,
                    outputVariable: clean,
                    name: `Set ${clean}`,
                  });
                }}
                placeholder="e.g. totalAmount"
              />
            </div>

            {/* Optional Type Annotation */}
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground font-medium">Type (optional)</Label>
              <Select
                value={variableDataType || "inferred"}
                onValueChange={(val) => {
                  onChange({
                    ...step,
                    variableDataType: val === "inferred" ? "" : val,
                  });
                }}
              >
                <SelectTrigger className="h-7 text-xs font-mono bg-background/60 border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inferred" className="text-xs font-mono text-muted-foreground">
                    (inferred)
                  </SelectItem>
                  {COMMON_DATA_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs font-mono">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Initial Value Source Editor */}
          <div className="flex flex-col gap-1 pt-1.5 border-t border-border/30">
            <Label className="text-[10px] text-muted-foreground font-medium">Initial Value</Label>
            <BindingSourceEditor
              binding={currentBinding}
              availableSources={availableSources}
              serviceNodeId={serviceNodeId}
              onChange={handleSourceChange}
            />
          </div>
        </div>
      )}

      {/* Mode B: Update / Reassign Variable */}
      {variableOperation === "assign" && (
        <div className="flex flex-col gap-2.5 p-2.5 rounded-lg border border-border/50 bg-background/40">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Target Variable Dropdown */}
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground font-medium">
                Target Variable <span className="text-muted-foreground/60">(from prior steps)</span>
              </Label>
              {priorMutableVars.length > 0 ? (
                <Select
                  value={step.outputVariable || priorMutableVars[0]?.name || ""}
                  onValueChange={(val) => {
                    onChange({
                      ...step,
                      outputVariable: val,
                      name: `Assign ${val}`,
                    });
                  }}
                >
                  <SelectTrigger className="h-7 text-xs font-mono bg-background/60 border-border/60">
                    <SelectValue placeholder="Select mutable variable..." />
                  </SelectTrigger>
                  <SelectContent>
                    {priorMutableVars.map((v) => (
                      <SelectItem key={v.name} value={v.name} className="text-xs font-mono">
                        <span className="font-semibold text-blue-300">{v.name}</span>
                        {v.type && (
                          <span className="text-[9px] text-muted-foreground ml-1.5">
                            ({v.type})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <BufferedInput
                  className="h-7 text-xs font-mono bg-background/60 border-border/60"
                  value={step.outputVariable ?? ""}
                  onCommit={(val) => {
                    const clean = toVarName(val);
                    onChange({
                      ...step,
                      outputVariable: clean,
                      name: `Assign ${clean}`,
                    });
                  }}
                  placeholder="e.g. totalAmount"
                />
              )}
            </div>

            {/* Operator (=, +=, -=) */}
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground font-medium">Operator</Label>
              <Select
                value={variableOperator}
                onValueChange={(val) => {
                  if (val === "=" || val === "+=" || val === "-=") {
                    onChange({
                      ...step,
                      variableOperator: val,
                    });
                  }
                }}
              >
                <SelectTrigger className="h-7 text-xs font-mono bg-background/60 border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="=" className="text-xs font-mono font-semibold">
                    = (Assign)
                  </SelectItem>
                  <SelectItem value="+=" className="text-xs font-mono font-semibold">
                    += (Add / Append)
                  </SelectItem>
                  <SelectItem value="-=" className="text-xs font-mono font-semibold">
                    -= (Subtract)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* New Value Source Editor */}
          <div className="flex flex-col gap-1 pt-1.5 border-t border-border/30">
            <Label className="text-[10px] text-muted-foreground font-medium">New Value</Label>
            <BindingSourceEditor
              binding={currentBinding}
              availableSources={availableSources}
              serviceNodeId={serviceNodeId}
              onChange={handleSourceChange}
            />
          </div>
        </div>
      )}

      {/* Code Generation Preview Bar */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/40 border border-border/40 text-[11px] font-mono text-muted-foreground">
        <Code2 size={12} className="text-primary/70 shrink-0" />
        <span className="text-[10px] text-muted-foreground/60 select-none">emits:</span>
        <span className="text-foreground/90 font-medium truncate">{previewCode}</span>
      </div>
    </div>
  );
};
