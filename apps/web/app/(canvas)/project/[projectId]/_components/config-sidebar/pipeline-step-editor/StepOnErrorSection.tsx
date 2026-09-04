"use client";

import React, { useState } from "react";
import { ShieldAlert, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
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
    onError && (onError.action !== "throw" || (onError.retries && onError.retries > 0)),
  );
  const [expanded, setExpanded] = useState(isCustomConfigured);

  const action = onError?.action || "throw";
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
    setExpanded(false);
  };

  const getBadgeText = () => {
    if (!isCustomConfigured) return "Default (Throw)";
    if (action === "early_return") return `Early Return (${statusCode})`;
    if (action === "fallback") return `Fallback: ${fallbackValue || "null"}`;
    if (action === "ignore") return "Ignore & Continue";
    if (retries > 0) return `Retry (${retries}x)`;
    return "Custom";
  };

  return (
    <div className="pt-2 border-t border-border/30 flex flex-col gap-2">
      {/* Header / Summary row */}
      <div className="flex items-center justify-between">
        <div
          className="flex items-center gap-1.5 cursor-pointer select-none group"
          onClick={() => setExpanded((v) => !v)}
        >
          <ShieldAlert
            size={12}
            className={cn(
              "transition-colors",
              isCustomConfigured ? "text-amber-500 dark:text-amber-400" : "text-muted-foreground/70",
            )}
          />
          <span className="text-[10px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
            On Error Policy
          </span>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded text-[9px] font-mono",
              isCustomConfigured
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30"
                : "bg-muted/40 text-muted-foreground/60 border border-border/40",
            )}
          >
            {getBadgeText()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isCustomConfigured && (
            <button
              type="button"
              className="text-[9px] text-muted-foreground hover:text-destructive transition-colors"
              onClick={handleResetToDefault}
              title="Reset to default (Fail & Throw)"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            className="text-[10px] text-primary/80 hover:text-primary font-medium transition-colors flex items-center gap-0.5"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
            <span>{expanded ? "Collapse" : "Configure"}</span>
          </button>
        </div>
      </div>

      {/* Expanded configuration card */}
      {expanded && (
        <div className="p-2.5 rounded-lg bg-secondary/15 border border-border/60 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[10px] text-muted-foreground shrink-0">Failure Action</Label>
            <Select
              value={action}
              onValueChange={(val) =>
                updateOnError({ action: val as "throw" | "fallback" | "early_return" | "ignore" })
              }
            >
              <SelectTrigger className="h-7 text-xs bg-background flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="throw" className="text-xs">
                  <div className="flex flex-col">
                    <span className="font-medium">Fail & Throw (Default)</span>
                    <span className="text-[10px] text-muted-foreground">
                      Propagate exception to global catch block
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="early_return" className="text-xs">
                  <div className="flex flex-col">
                    <span className="font-medium">Return Error Response</span>
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
                <SelectItem value="ignore" className="text-xs">
                  <div className="flex flex-col">
                    <span className="font-medium">Ignore & Continue</span>
                    <span className="text-[10px] text-muted-foreground">
                      Log warning, set output to null and proceed
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
