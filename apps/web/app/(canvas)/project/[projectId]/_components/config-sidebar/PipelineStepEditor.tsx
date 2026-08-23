"use client";

import React, { useState, useCallback } from "react";
import { PipelineStep, PipelineStepInputBinding } from "@workspace/canvas/types";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  GripVertical,
  Database,
  Zap,
  Shuffle,
  Cloud,
  Terminal,
  Radio,
  Check,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StepSource =
  | { kind: "req_body"; field: string }
  | { kind: "req_params"; field: string }
  | { kind: "req_query"; field: string }
  | { kind: "req_headers"; field: string }
  | { kind: "step_output"; stepId: string; field?: string }
  | { kind: "literal"; value: string | number | boolean };

type StepBinding = PipelineStepInputBinding & { source: StepSource };

export type StepType =
  | "transform"
  | "db_operation"
  | "redis_operation"
  | "kafka_publish"
  | "service_call"
  | "custom_code";

export type PipelineStepDraft = {
  id: string;
  name: string;
  type: StepType;
  enabled?: boolean;
  functionRef?: { name: string; importPath: string; signature?: string };
  inputBindings: StepBinding[];
  outputVariable: string;
  outputSchema?: { name: string; type: string; required?: boolean }[];
  customCode?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STEP_TYPE_META: Record<
  StepType,
  { label: string; icon: React.ReactNode; color: string }
> = {
  transform: {
    label: "Transform",
    icon: <Shuffle size={13} />,
    color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  },
  db_operation: {
    label: "DB Operation",
    icon: <Database size={13} />,
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  redis_operation: {
    label: "Redis",
    icon: <Zap size={13} />,
    color: "text-red-400 bg-red-500/10 border-red-500/20",
  },
  kafka_publish: {
    label: "Kafka Publish",
    icon: <Radio size={13} />,
    color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  },
  service_call: {
    label: "Service Call",
    icon: <Cloud size={13} />,
    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  },
  custom_code: {
    label: "Custom Code",
    icon: <Terminal size={13} />,
    color: "text-green-400 bg-green-500/10 border-green-500/20",
  },
};

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Binding Source selector
// ---------------------------------------------------------------------------

interface BindingSourceEditorProps {
  binding: StepBinding;
  priorSteps: PipelineStepDraft[];
  onChange: (updated: StepBinding) => void;
}

const BindingSourceEditor = ({
  binding,
  priorSteps,
  onChange,
}: BindingSourceEditorProps) => {
  const { source } = binding;

  const handleKindChange = (kind: string) => {
    if (kind === "req_body") onChange({ ...binding, source: { kind: "req_body", field: "" } });
    else if (kind === "req_params") onChange({ ...binding, source: { kind: "req_params", field: "" } });
    else if (kind === "req_query") onChange({ ...binding, source: { kind: "req_query", field: "" } });
    else if (kind === "req_headers") onChange({ ...binding, source: { kind: "req_headers", field: "" } });
    else if (kind === "step_output") onChange({ ...binding, source: { kind: "step_output", stepId: priorSteps[0]?.id ?? "", field: "" } });
    else if (kind === "literal") onChange({ ...binding, source: { kind: "literal", value: "" } });
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Source kind */}
      <Select value={source.kind} onValueChange={handleKindChange}>
        <SelectTrigger className="h-7 text-xs bg-background/60 border-border/60">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="req_body">req.body.<em>field</em></SelectItem>
          <SelectItem value="req_params">req.params.<em>field</em></SelectItem>
          <SelectItem value="req_query">req.query.<em>field</em></SelectItem>
          <SelectItem value="req_headers">req.headers.<em>field</em></SelectItem>
          <SelectItem value="step_output">Step output</SelectItem>
          <SelectItem value="literal">Literal value</SelectItem>
        </SelectContent>
      </Select>

      {/* Field / value sub-editors */}
      {(source.kind === "req_body" || source.kind === "req_params" || source.kind === "req_query" || source.kind === "req_headers") && (
        <Input
          className="h-7 text-xs font-mono bg-background/60 border-border/60"
          placeholder="fieldName"
          value={source.field}
          onChange={(e) =>
            onChange({ ...binding, source: { ...source, field: e.target.value } })
          }
        />
      )}

      {source.kind === "step_output" && (
        <div className="flex gap-1.5">
          <Select
            value={source.stepId}
            onValueChange={(v) =>
              onChange({ ...binding, source: { ...source, stepId: v } })
            }
          >
            <SelectTrigger className="h-7 text-xs flex-1 bg-background/60 border-border/60">
              <SelectValue placeholder="Step…" />
            </SelectTrigger>
            <SelectContent>
              {priorSteps.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.outputVariable || s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="h-7 text-xs font-mono flex-1 bg-background/60 border-border/60"
            placeholder=".field (opt)"
            value={source.field ?? ""}
            onChange={(e) =>
              onChange({ ...binding, source: { ...source, field: e.target.value || undefined } })
            }
          />
        </div>
      )}

      {source.kind === "literal" && (
        <Input
          className="h-7 text-xs font-mono bg-background/60 border-border/60"
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

// ---------------------------------------------------------------------------
// Single Step Row
// ---------------------------------------------------------------------------

interface StepRowProps {
  step: PipelineStepDraft;
  index: number;
  priorSteps: PipelineStepDraft[];
  onChange: (updated: PipelineStepDraft) => void;
  onDelete: () => void;
}

const StepRow = ({ step, index, priorSteps, onChange, onDelete }: StepRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const meta = STEP_TYPE_META[step.type];

  const updateBinding = useCallback(
    (bi: number, updated: StepBinding) => {
      const bindings = [...step.inputBindings];
      bindings[bi] = updated;
      onChange({ ...step, inputBindings: bindings });
    },
    [step, onChange],
  );

  const addBinding = () => {
    onChange({
      ...step,
      inputBindings: [
        ...step.inputBindings,
        { argName: "", source: { kind: "req_body", field: "" } } as StepBinding,
      ],
    });
  };

  const removeBinding = (bi: number) => {
    onChange({
      ...step,
      inputBindings: step.inputBindings.filter((_, i) => i !== bi),
    });
  };

  return (
    <div
      className={`rounded-lg border transition-all duration-150 ${
        step.enabled === false ? "opacity-50" : ""
      } border-border/60 bg-card/40`}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <GripVertical size={12} className="text-muted-foreground/40 shrink-0" />
        <span className="text-xs text-muted-foreground/60 w-4 shrink-0">
          {index + 1}
        </span>
        <span
          className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${meta.color}`}
        >
          {meta.icon}
          {meta.label}
        </span>
        <span className="text-xs font-medium text-foreground/90 flex-1 truncate">
          {step.name || "Unnamed step"}
        </span>
        {step.outputVariable && (
          <span className="text-[10px] font-mono text-muted-foreground/50 truncate max-w-[80px]">
            → {step.outputVariable}
          </span>
        )}
        <button
          className="ml-1 text-destructive/60 hover:text-destructive transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 size={11} />
        </button>
        {expanded ? (
          <ChevronDown size={12} className="text-muted-foreground/50 shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-muted-foreground/50 shrink-0" />
        )}
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t border-border/40 px-3 pt-3 pb-3 flex flex-col gap-3">
          {/* Row 1: Name + Type */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground">Step name</Label>
              <Input
                className="h-7 text-xs bg-background/60 border-border/60"
                value={step.name}
                onChange={(e) => onChange({ ...step, name: e.target.value })}
                placeholder="e.g. slugifyInput"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground">Type</Label>
              <Select
                value={step.type}
                onValueChange={(v) => onChange({ ...step, type: v as StepType })}
              >
                <SelectTrigger className="h-7 text-xs bg-background/60 border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STEP_TYPE_META) as StepType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {STEP_TYPE_META[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Function ref */}
          {step.type !== "custom_code" && (
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
                  placeholder="e.g. createProduct"
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
                  placeholder="e.g. @workspace/db/helpers/products"
                />
              </div>
            </div>
          )}

          {/* Custom code block */}
          {step.type === "custom_code" && (
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground">TypeScript code</Label>
              <textarea
                className="text-xs font-mono bg-background/60 border border-border/60 rounded-md p-2 min-h-[80px] resize-y text-foreground/90 focus:outline-none focus:ring-1 focus:ring-primary/40"
                value={step.customCode ?? ""}
                onChange={(e) => onChange({ ...step, customCode: e.target.value })}
                placeholder="// raw TypeScript to inline at this step&#10;const result = someValue;"
              />
            </div>
          )}

          {/* Output variable */}
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-muted-foreground">Output variable name</Label>
            <Input
              className="h-7 text-xs font-mono bg-background/60 border-border/60"
              value={step.outputVariable}
              onChange={(e) => onChange({ ...step, outputVariable: e.target.value })}
              placeholder="e.g. createdProduct"
            />
            <p className="text-[9px] text-muted-foreground/60">
              Referenced by subsequent steps as <span className="font-mono">{step.outputVariable || "…"}.field</span>
            </p>
          </div>

          {/* Input Bindings */}
          {step.type !== "custom_code" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">
                  Argument bindings
                </Label>
                <button
                  className="flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary transition-colors"
                  onClick={addBinding}
                >
                  <Plus size={10} />
                  Add arg
                </button>
              </div>

              {step.inputBindings.length === 0 && (
                <p className="text-[10px] text-muted-foreground/50 italic py-1">
                  No arguments bound. Click "Add arg" to map function arguments to their sources.
                </p>
              )}

              {step.inputBindings.map((binding, bi) => (
                <div
                  key={bi}
                  className="grid grid-cols-[1fr_auto_2fr_auto] gap-1.5 items-start"
                >
                  {/* Arg name */}
                  <Input
                    className="h-7 text-xs font-mono bg-background/60 border-border/60"
                    value={binding.argName}
                    onChange={(e) =>
                      updateBinding(bi, { ...binding, argName: e.target.value })
                    }
                    placeholder="argName"
                  />
                  {/* Arrow */}
                  <span className="text-[10px] text-muted-foreground/50 mt-1.5 px-0.5">←</span>
                  {/* Source */}
                  <BindingSourceEditor
                    binding={binding}
                    priorSteps={priorSteps}
                    onChange={(updated) => updateBinding(bi, updated)}
                  />
                  {/* Delete */}
                  <button
                    className="mt-1 text-muted-foreground/40 hover:text-destructive transition-colors"
                    onClick={() => removeBinding(bi)}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Enabled toggle */}
          <button
            className={`flex items-center gap-1.5 text-[10px] self-end transition-colors ${
              step.enabled === false
                ? "text-muted-foreground/50"
                : "text-primary/70 hover:text-primary"
            }`}
            onClick={() =>
              onChange({ ...step, enabled: step.enabled === false ? true : false })
            }
          >
            <Check size={11} />
            {step.enabled === false ? "Enable step" : "Disable step"}
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// PipelineStepEditor — main component
// ---------------------------------------------------------------------------

export interface PipelineStepEditorProps {
  steps: PipelineStepDraft[];
  onChange: (steps: PipelineStepDraft[]) => void;
}

export const PipelineStepEditor = ({
  steps,
  onChange,
}: PipelineStepEditorProps) => {
  const addStep = (type: StepType) => {
    const id = generateId();
    onChange([
      ...steps,
      {
        id,
        name: `${STEP_TYPE_META[type].label} ${steps.length + 1}`,
        type,
        enabled: true,
        inputBindings: [],
        outputVariable: `step${steps.length + 1}Result`,
      },
    ]);
  };

  const updateStep = (index: number, updated: PipelineStepDraft) => {
    const next = [...steps];
    next[index] = updated;
    onChange(next);
  };

  const deleteStep = (index: number) => {
    onChange(steps.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Step list */}
      {steps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/40 p-4 text-center">
          <p className="text-xs text-muted-foreground/60">
            No pipeline steps yet.
          </p>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">
            Add steps below to define explicit data flow through this endpoint.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {steps.map((step, i) => (
            <StepRow
              key={step.id}
              step={step}
              index={i}
              priorSteps={steps.slice(0, i)}
              onChange={(updated) => updateStep(i, updated)}
              onDelete={() => deleteStep(i)}
            />
          ))}
        </div>
      )}

      {/* Add step buttons */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {(Object.keys(STEP_TYPE_META) as StepType[]).map((type) => {
          const meta = STEP_TYPE_META[type];
          return (
            <button
              key={type}
              className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded border transition-all duration-150 hover:brightness-110 active:scale-95 ${meta.color}`}
              onClick={() => addStep(type)}
            >
              <Plus size={9} />
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
