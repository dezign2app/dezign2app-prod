"use client";

import React, { useState, useMemo } from "react";
import { Endpoint, BackendNode } from "@workspace/canvas/types";

import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { ChevronDown, ChevronRight, Plus, Trash2, Send } from "lucide-react";
import { BindingSourceEditor } from "./BindingSourceEditor";
import { PipelineStepDraft, StepBinding } from "./types";
import { getAvailableSources, HTTP_STATUS_OPTIONS } from "./utils";

export interface ReturnResponseStepRowProps {
  step: PipelineStepDraft;
  priorSteps: PipelineStepDraft[];
  endpoint?: Endpoint;
  allNodes: BackendNode[];
  onChange: (updated: PipelineStepDraft) => void;
}

export const ReturnResponseStepRow = ({
  step,
  priorSteps,
  endpoint,
  allNodes,
  onChange,
}: ReturnResponseStepRowProps) => {
  const [expanded, setExpanded] = useState(true);

  // Available sources (request body, params, query, headers, prior steps)
  const availableSources = useMemo(
    () => getAvailableSources(endpoint, priorSteps, allNodes),
    [endpoint, priorSteps, allNodes],
  );

  const statusCode = step.statusCode || (endpoint?.type === "POST" ? 201 : 200);

  const updateBinding = (bi: number, updated: StepBinding) => {
    const bindings = [...step.inputBindings];
    bindings[bi] = updated;
    onChange({ ...step, inputBindings: bindings });
  };

  const addBinding = () => {
    const newBinding: StepBinding = {
      argName: `field_${step.inputBindings.length + 1}`,
      source: { kind: "req_body", field: "" },
    };
    onChange({
      ...step,
      inputBindings: [...step.inputBindings, newBinding],
    });
  };

  const removeBinding = (bi: number) => {
    onChange({
      ...step,
      inputBindings: step.inputBindings.filter((_, i) => i !== bi),
    });
  };

  // Build preview code
  const previewCode = useMemo(() => {
    const bindings = step.inputBindings;
    if (bindings.length === 0) {
      return `res.status(${statusCode}).json({ status: ${statusCode}, message: "Success" });`;
    }

    const getExprForBinding = (b: StepBinding): string => {
      const source = b.source;

      switch (source.kind) {
        case "literal": {
          const v = source.value;
          return typeof v === "string" ? `"${v}"` : String(v);
        }
        case "step_output": {
          const found = availableSources.find(
            (s) => s.id === `step:${source.stepId}`,
          );
          const base = found?.variableName || "stepResult";
          const field = source.field ? source.field.trim() : "";
          return field ? `${base}.${field}` : base;
        }
        case "req_body": {
          const field = source.field ? source.field.trim() : "";
          return field ? `body.${field}` : "body";
        }
        case "req_params": {
          const field = source.field ? source.field.trim() : "";
          return field ? `req.params.${field}` : "req.params";
        }
        case "req_query": {
          const field = source.field ? source.field.trim() : "";
          return field ? `req.query.${field}` : "req.query";
        }
        case "req_headers": {
          const field = source.field ? source.field.trim() : "";
          return field ? `String(req.headers["${field}"])` : "req.headers";
        }
      }
    };

    const b = bindings[0];
    if (
      bindings.length === 1 &&
      b &&
      (b.argName === "data" || b.argName === "_spread" || !b.argName)
    ) {
      return `res.status(${statusCode}).json(${getExprForBinding(b)});`;
    }

    const fields = bindings
      .map((b) => `${b.argName}: ${getExprForBinding(b)}`)
      .join(", ");
    return `res.status(${statusCode}).json({ ${fields} });`;
  }, [step.inputBindings, statusCode, availableSources]);

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/10 shadow-sm transition-all duration-150">
      {/* Header */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-2 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-[11px] text-emerald-400 font-mono w-3.5 shrink-0">
          ↩
        </span>
        <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 text-emerald-400 bg-emerald-500/10 border-emerald-500/25">
          <Send size={11} />
          Return Response
        </span>
        <span className="text-xs font-medium text-foreground/90 flex-1 truncate">
          HTTP {statusCode}
        </span>
        <span className="text-[10px] font-mono text-emerald-400/60 truncate max-w-[130px]">
          {previewCode}
        </span>
        {expanded ? (
          <ChevronDown size={12} className="text-muted-foreground/50 shrink-0 ml-1" />
        ) : (
          <ChevronRight size={12} className="text-muted-foreground/50 shrink-0 ml-1" />
        )}
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-emerald-500/20 px-3 pt-3 pb-3 flex flex-col gap-3">
          {/* Status code row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground font-medium">
                HTTP Status Code
              </Label>
              <Select
                value={String(statusCode)}
                onValueChange={(v) => onChange({ ...step, statusCode: Number(v) })}
              >
                <SelectTrigger className="h-7 text-xs bg-background/70 border-border/60 font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HTTP_STATUS_OPTIONS.map((opt) => (
                    <SelectItem
                      key={opt.code}
                      value={String(opt.code)}
                      className="text-xs font-mono"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground font-medium">
                Response Action / Note
              </Label>
              <Input
                className="h-7 text-xs bg-background/60 border-border/60"
                value={step.name || "Return Response"}
                onChange={(e) => onChange({ ...step, name: e.target.value })}
                placeholder="e.g. Return Created Product"
              />
            </div>
          </div>

          {/* Response payload bindings */}
          <div className="flex flex-col gap-2 pt-1 border-t border-border/30">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                Response Payload Source
              </Label>
              <button
                type="button"
                className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
                onClick={addBinding}
              >
                <Plus size={10} />
                Add field
              </button>
            </div>

            {step.inputBindings.length === 0 ? (
              <div className="rounded border border-dashed border-border/40 p-2.5 text-center bg-muted/10">
                <p className="text-[10px] text-muted-foreground/60">
                  Default response envelope will be returned.
                </p>
                <p
                  className="text-[9px] text-emerald-400/80 mt-0.5 cursor-pointer hover:underline"
                  onClick={() => {
                    const lastPrior = priorSteps[priorSteps.length - 1];
                    const defaultBinding: StepBinding = lastPrior
                      ? {
                          argName: "data",
                          source: {
                            kind: "step_output",
                            stepId: lastPrior.id,
                            field: "",
                          },
                        }
                      : {
                          argName: "data",
                          source: { kind: "req_body", field: "" },
                        };
                    onChange({
                      ...step,
                      inputBindings: [defaultBinding],
                    });
                  }}
                >
                  Click here to return the result of the previous step.
                </p>
              </div>
            ) : (
              step.inputBindings.map((binding, bi) => (
                <div
                  key={bi}
                  className="grid grid-cols-[1fr_auto_2.2fr_auto] gap-1.5 items-center bg-muted/15 p-1.5 rounded border border-border/40"
                >
                  {/* Key name */}
                  <Input
                    className="h-7 text-xs font-mono bg-background/70 border-border/60"
                    value={binding.argName}
                    onChange={(e) =>
                      updateBinding(bi, { ...binding, argName: e.target.value })
                    }
                    placeholder="data / fieldName"
                  />
                  {/* Arrow */}
                  <span className="text-[10px] text-muted-foreground/50 px-0.5">←</span>
                  {/* Source & Smart Path */}
                  <BindingSourceEditor
                    binding={binding}
                    availableSources={availableSources}
                    onChange={(updated) => updateBinding(bi, updated)}
                  />
                  {/* Delete button (only if more than 1 binding) */}
                  {step.inputBindings.length > 1 ? (
                    <button
                      type="button"
                      className="text-muted-foreground/40 hover:text-destructive transition-colors p-1 rounded hover:bg-destructive/10"
                      onClick={() => removeBinding(bi)}
                      title="Remove field"
                    >
                      <Trash2 size={11} />
                    </button>
                  ) : (
                    <div className="w-5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
