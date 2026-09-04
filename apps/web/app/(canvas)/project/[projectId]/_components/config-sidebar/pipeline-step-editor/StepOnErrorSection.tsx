"use client";

import React from "react";
import { ShieldAlert, RotateCcw } from "lucide-react";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { PipelineStepDraft } from "./types";
import { cn } from "@workspace/ui/lib/utils";

export interface StepOnErrorSectionProps {
  step: PipelineStepDraft;
  onChange: (updated: PipelineStepDraft) => void;
}

const STATUS_CODE_PRESETS = [400, 404, 500, 502, 503, 504];

export const StepOnErrorSection: React.FC<StepOnErrorSectionProps> = ({
  step,
  onChange,
}) => {
  const onError = step.onError;
  const isCustomConfigured = Boolean(
    onError && (onError.action !== "ignore" || (onError.retries && onError.retries > 0)),
  );

  const action = onError?.action || "early_return";
  const statusCode = onError?.statusCode ?? 502;
  const errorMessage = onError?.errorMessage ?? "";
  const fallbackValue = onError?.fallbackValue ?? "";
  const retries = onError?.retries ?? 0;

  const updateOnError = (patch: Partial<NonNullable<PipelineStepDraft["onError"]>>) => {
    const next = {
      action,
      statusCode,
      errorMessage,
      fallbackValue,
      retries,
      ...patch,
    };
    onChange({
      ...step,
      onError: next,
    });
  };

  const handleResetToDefault = () => {
    onChange({
      ...step,
      onError: undefined,
    });
  };

  const getBadgeText = () => {
    if (!isCustomConfigured) return "Default (Log & Proceed)";
    let text = "";
    if (action === "early_return") text = `Return ${statusCode}`;
    else if (action === "fallback") text = `Fallback: ${fallbackValue || "null"}`;
    else if (action === "throw") text = "Fail & Stop (Throw)";
    else text = "Custom";

    if (retries > 0) {
      text += ` (${retries}x retry)`;
    }
    return text;
  };

  return (
    <div className="pt-2 border-t border-border/30 flex flex-col gap-1.5">
      {/* Header / Checkbox row */}
      <div className="flex items-center justify-between">
        <label
          htmlFor={`on-error-chk-${step.id}`}
          className="flex items-center gap-2 cursor-pointer select-none group"
        >
          <Checkbox
            id={`on-error-chk-${step.id}`}
            checked={isCustomConfigured}
            onCheckedChange={(checked) => {
              if (checked) {
                updateOnError({
                  action: "early_return",
                  statusCode: 502,
                  errorMessage: `${step.name || "Step"} execution failed`,
                });
              } else {
                handleResetToDefault();
              }
            }}
          />
          <div className="flex items-center gap-1.5">
            <ShieldAlert
              size={12}
              className={cn(
                "transition-colors",
                isCustomConfigured ? "text-amber-500 dark:text-amber-400" : "text-muted-foreground/70",
              )}
            />
            <span className="text-[10px] font-semibold text-foreground/90 group-hover:text-foreground transition-colors">
              Configure On Error Handling
            </span>
          </div>
        </label>

        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-[9px] font-mono",
            isCustomConfigured
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30"
              : "bg-muted/40 text-muted-foreground/70 border border-border/40",
          )}
        >
          {getBadgeText()}
        </span>
      </div>

      {/* Unchecked explanation note */}
      {!isCustomConfigured && (
        <p className="text-[10px] text-muted-foreground/60 pl-6 leading-normal">
          By default, any errors thrown by this step will be logged and execution will proceed to the next step. Check the box above to configure custom error handling (e.g. return an error response, provide a fallback, or retry).
        </p>
      )}

      {/* Expanded configuration card when checked */}
      {isCustomConfigured && (
        <div className="p-2.5 rounded-lg bg-secondary/15 border border-border/60 flex flex-col gap-3 mt-1">
          <div className="flex items-start justify-between gap-2">
            <Label className="text-[10px] text-muted-foreground shrink-0">Failure Action</Label>
            <Select
              value={action}
              onValueChange={(val) =>
                updateOnError({ action: val as "throw" | "fallback" | "early_return" | "ignore" })
              }
            >
              <SelectTrigger className="h-7 text-xs bg-background flex-1 text-start">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="early_return" className="text-xs">
                  <div className="flex flex-col">
                    <span className="font-small">Return Error Response</span>
                    <span className="text-[10px] text-muted-foreground">
                      Short-circuit and return HTTP error payload
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="fallback" className="text-xs">
                  <div className="flex flex-col">
                    <span className="font-medium">Fallback Default Value</span>
                    <span className="text-[10px] text-muted-foreground">
                      Assign fallback value and continue pipeline
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="throw" className="text-xs">
                  <div className="flex flex-col">
                    <span className="font-medium">Fail & Stop (Throw)</span>
                    <span className="text-[10px] text-muted-foreground">
                      Halt pipeline execution and propagate error (500)
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action-specific fields */}
          {action === "early_return" && (
            <div className="flex flex-col gap-2 p-2 rounded bg-background/50 border border-border/50">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-[10px] text-muted-foreground shrink-0">HTTP Status</Label>
                <div className="flex items-center gap-1.5 flex-1 justify-end">
                  <Input
                    type="number"
                    value={statusCode}
                    onChange={(e) =>
                      updateOnError({ statusCode: parseInt(e.target.value, 10) || 502 })
                    }
                    className="h-6 w-16 text-xs font-mono text-center bg-background"
                  />
                  <div className="flex items-center gap-1">
                    {STATUS_CODE_PRESETS.map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => updateOnError({ statusCode: code })}
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-mono border transition-colors",
                          statusCode === code
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/40 text-muted-foreground hover:text-foreground border-border/40",
                        )}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-[10px] text-muted-foreground">Error Message / Reason</Label>
                <Input
                  value={errorMessage}
                  onChange={(e) => updateOnError({ errorMessage: e.target.value })}
                  placeholder="e.g. Failed to fetch external resource"
                  className="h-6 text-xs bg-background"
                />
              </div>
            </div>
          )}

          {action === "fallback" && (
            <div className="flex flex-col gap-1.5 p-2 rounded bg-background/50 border border-border/50">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Fallback Output Value</Label>
                <span className="text-[9px] font-mono text-muted-foreground/60">
                  Assigned to: {step.outputVariable || "output"}
                </span>
              </div>
              <Input
                value={fallbackValue}
                onChange={(e) => updateOnError({ fallbackValue: e.target.value })}
                placeholder='e.g. null, [], or {"status": "unavailable"}'
                className="h-6 text-xs font-mono bg-background"
              />
              <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/70">
                <span>Presets:</span>
                <button
                  type="button"
                  onClick={() => updateOnError({ fallbackValue: "null" })}
                  className="hover:text-foreground underline"
                >
                  null
                </button>
                <button
                  type="button"
                  onClick={() => updateOnError({ fallbackValue: "[]" })}
                  className="hover:text-foreground underline"
                >
                  []
                </button>
                <button
                  type="button"
                  onClick={() => updateOnError({ fallbackValue: "{}" })}
                  className="hover:text-foreground underline"
                >
                  {}
                </button>
              </div>
            </div>
          )}

          {/* Automatic Retries */}
          <div className="flex items-center justify-between pt-1 border-t border-border/40">
            <div className="flex items-center gap-1.5">
              <RotateCcw size={11} className="text-muted-foreground" />
              <Label className="text-[10px] text-muted-foreground">Automatic Retries</Label>
            </div>
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => updateOnError({ retries: r })}
                  className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-mono border transition-colors",
                    retries === r
                      ? "bg-secondary text-foreground font-semibold border-border/80"
                      : "bg-muted/30 text-muted-foreground/60 hover:text-foreground border-border/30",
                  )}
                >
                  {r === 0 ? "Off" : `${r}x`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
