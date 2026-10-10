"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sparkles, MousePointerClick, AlertTriangle, Timer, X, Check } from "lucide-react";
import {
  StateRenderComponent,
  StateRenderConfig,
  ComponentPropMappings,
  JSONValue,
} from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Switch } from "@workspace/ui/components/switch";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Progress } from "@workspace/ui/components/progress";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { toast } from "sonner";

export interface StateComponentPreviewProps {
  currentComponent: StateRenderComponent;
  currentVariant: NonNullable<StateRenderConfig["variant"]>;
  currentClickAction: NonNullable<StateRenderConfig["clickAction"]>;
  displayLabel: string;
  customLabel?: string;
  formattedPreviewValue: string;
  sampleValue: JSONValue | undefined;
  propMappings: ComponentPropMappings;
  stateName: string;
  copyToastMessage?: string;
  targetActionId?: string;
}

export const StateComponentPreview: React.FC<StateComponentPreviewProps> = ({
  currentComponent,
  currentVariant,
  currentClickAction,
  displayLabel,
  customLabel,
  formattedPreviewValue,
  sampleValue,
  propMappings,
  stateName,
  copyToastMessage,
  targetActionId,
}) => {
  const labelToRender = customLabel?.trim() || "";

  // Live interactive state for Input component preview
  const [liveInputValue, setLiveInputValue] = useState<string>(String(formattedPreviewValue ?? ""));
  const [debouncedLiveValue, setDebouncedLiveValue] = useState<string>(String(formattedPreviewValue ?? ""));
  const [isDebouncing, setIsDebouncing] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLiveInputValue(String(formattedPreviewValue ?? ""));
    setDebouncedLiveValue(String(formattedPreviewValue ?? ""));
    setIsDebouncing(false);
  }, [formattedPreviewValue]);

  const handlePreviewInputChange = (val: string) => {
    setLiveInputValue(val);
    if (propMappings.debounceUpdate) {
      setIsDebouncing(true);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      const delay = propMappings.debounceMs ?? 300;
      debounceTimerRef.current = setTimeout(() => {
        setDebouncedLiveValue(val);
        setIsDebouncing(false);
      }, delay);
    } else {
      setDebouncedLiveValue(val);
    }
  };

  const handlePreviewInputCommit = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setDebouncedLiveValue(liveInputValue);
    setIsDebouncing(false);
  };

  return (
    <Card className="border-cyan-500/30 bg-cyan-500/[0.02] shadow-xs overflow-hidden">
      <CardHeader className="p-3.5 pb-2 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
            <Sparkles size={13} className="text-cyan-500" />
            <span>Live Component Preview</span>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono capitalize">
            {currentComponent}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-5 flex flex-col items-center justify-center min-h-[100px] bg-background/50">
        {/* Dynamic Component Preview Rendering */}
        {currentComponent === "badge" && (
          <Badge
            variant={currentVariant}
            className={cn(
              "px-3 py-1 text-xs transition-all",
              currentClickAction !== "none" && "cursor-pointer hover:scale-105 active:scale-95 shadow-sm",
            )}
            onClick={() => {
              if (currentClickAction === "copy_to_clipboard") {
                navigator.clipboard?.writeText(String(sampleValue));
                toast.success(copyToastMessage || `Copied ${stateName} to clipboard!`);
              } else if (currentClickAction === "trigger_event") {
                toast.info(`Simulated: Trigger action "${targetActionId || "action"}"`);
              }
            }}
          >
            {labelToRender && <span className="font-semibold mr-1">{labelToRender}:</span>}
            <span>{formattedPreviewValue}</span>
          </Badge>
        )}

        {currentComponent === "card" && (
          <div
            className={cn(
              "p-3 rounded-lg bg-card border border-border/70 shadow-xs min-w-[180px] max-w-xs transition-all",
              currentClickAction !== "none" && "cursor-pointer hover:border-cyan-500/60 shadow-sm",
            )}
          >
            {(propMappings.titleBinding || labelToRender) && (
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {propMappings.titleBinding || labelToRender}
              </div>
            )}
            {propMappings.descriptionBinding && (
              <div className="text-[10px] text-muted-foreground/80 mt-0.5">
                {propMappings.descriptionBinding}
              </div>
            )}
            <div className="text-base font-bold text-foreground mt-0.5 font-mono">
              {formattedPreviewValue}
            </div>
          </div>
        )}

        {currentComponent === "button" && (
          <Button
            variant={currentVariant}
            size={propMappings.buttonSize || "sm"}
            disabled={Boolean(propMappings.disabled)}
            className="gap-1.5 shadow-xs"
            onClick={() => {
              if (currentClickAction === "copy_to_clipboard") {
                navigator.clipboard?.writeText(String(sampleValue));
                toast.success(copyToastMessage || `Copied ${stateName} to clipboard!`);
              } else if (currentClickAction === "trigger_event") {
                toast.info(`Simulated: Trigger action "${targetActionId || "action"}"`);
              }
            }}
          >
            {labelToRender && <span>{labelToRender}:</span>}
            <span className="font-mono">{formattedPreviewValue}</span>
          </Button>
        )}

        {currentComponent === "switch" && (
          <div className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/20 border border-border/40">
            <Switch checked={Boolean(sampleValue)} disabled={Boolean(propMappings.disabled)} />
            <Label className="text-xs font-medium cursor-pointer">{displayLabel}</Label>
          </div>
        )}

        {currentComponent === "checkbox" && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 border border-border/40">
            <Checkbox checked={Boolean(sampleValue)} disabled={Boolean(propMappings.disabled)} />
            <Label className="text-xs font-medium cursor-pointer">{displayLabel}</Label>
          </div>
        )}

        {currentComponent === "progress" && (
          <div className="w-full max-w-xs flex flex-col gap-1.5 p-2">
            <div className="flex justify-between text-xs font-medium">
              <span>{displayLabel}</span>
              {propMappings.showPercent !== false && (
                <span className="font-mono text-muted-foreground">{formattedPreviewValue}%</span>
              )}
            </div>
            <Progress
              value={Math.min(propMappings.max || 100, Math.max(0, Number(sampleValue) || 45))}
              max={propMappings.max || 100}
            />
            {propMappings.max && propMappings.max !== 100 && (
              <span className="text-[9px] text-muted-foreground font-mono">Max: {propMappings.max}</span>
            )}
          </div>
        )}

        {currentComponent === "input" && (
          <div className="w-full max-w-xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground">{displayLabel}</Label>
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-mono text-cyan-500 bg-cyan-500/10 px-1 py-0.2 rounded border border-cyan-500/20">
                  type="{propMappings.inputType || "text"}"
                </span>
                {propMappings.debounceUpdate && (
                  <span className="text-[9px] font-mono text-indigo-400 bg-indigo-500/10 px-1 py-0.2 rounded border border-indigo-500/20 flex items-center gap-0.5">
                    <Timer size={9} />
                    {propMappings.debounceMs ?? 300}ms
                  </span>
                )}
              </div>
            </div>

            {/* Input Element */}
            {(() => {
              const isReadOnlyPreview = Boolean(
                propMappings.readOnly ||
                (propMappings.readOnlyMode === "state_binding" && propMappings.readOnlyBinding)
              );
              const isDisabledPreview = Boolean(
                propMappings.disabled ||
                (propMappings.disabledMode === "state_binding" && propMappings.disabledBinding)
              );

              return (
                <div className="relative flex items-center">
                  <Input
                    type={propMappings.inputType || "text"}
                    value={isReadOnlyPreview ? String(formattedPreviewValue) : liveInputValue}
                    onChange={(e) => handlePreviewInputChange(e.target.value)}
                    placeholder={propMappings.placeholder || `Enter ${displayLabel}...`}
                    readOnly={isReadOnlyPreview}
                    disabled={isDisabledPreview}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && propMappings.commitOnEnter !== false) {
                        handlePreviewInputCommit();
                        toast.info(`Committed input: "${liveInputValue}"`);
                      }
                    }}
                    onBlur={() => {
                      if (propMappings.commitOnBlur !== false && isDebouncing) {
                        handlePreviewInputCommit();
                      }
                    }}
                    className={cn(
                      "h-8 text-xs font-mono shadow-2xs transition-colors",
                      propMappings.clearable && "pr-7",
                      isReadOnlyPreview ? "bg-muted/30 cursor-default" : "bg-background focus:ring-1 focus:ring-primary/40",
                    )}
                  />
                  {propMappings.clearable && !isReadOnlyPreview && !isDisabledPreview && liveInputValue && (
                    <button
                      type="button"
                      onClick={() => {
                        handlePreviewInputChange("");
                        handlePreviewInputCommit();
                      }}
                      className="absolute right-2 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      title="Clear input"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Reactive Feedback & Debounce Indicator */}
            {!propMappings.readOnly && !propMappings.disabled && (
              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                {propMappings.debounceUpdate ? (
                  isDebouncing ? (
                    <span className="text-amber-500 flex items-center gap-1 font-mono text-[9px] animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                      Debouncing ({propMappings.debounceMs ?? 300}ms)...
                    </span>
                  ) : (
                    <span className="text-emerald-500 flex items-center gap-1 font-mono text-[9px]">
                      <Check size={10} />
                      Committed: &quot;{debouncedLiveValue}&quot;
                    </span>
                  )
                ) : (
                  <span className="text-muted-foreground/80 font-mono text-[9px]">
                    Direct sync: &quot;{liveInputValue}&quot;
                  </span>
                )}
                {propMappings.commitOnEnter !== false && (
                  <span className="text-[9px] text-muted-foreground/60 font-mono">
                    ↵ Enter to commit
                  </span>
                )}
              </div>
            )}

            {/* ReadOnly & Disabled Status Indicators (Dynamic & Static) */}
            {(propMappings.readOnly ||
              propMappings.disabled ||
              propMappings.readOnlyMode === "state_binding" ||
              propMappings.readOnlyMode === "expression" ||
              propMappings.disabledMode === "state_binding" ||
              propMappings.disabledMode === "expression") && (
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground/80 pt-0.5">
                {/* ReadOnly indicator */}
                {propMappings.readOnlyMode === "state_binding" && propMappings.readOnlyBinding && (
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-[9px] font-mono text-indigo-400 border border-indigo-500/20">
                    readOnly={`{${propMappings.readOnlyInverted ? "!" : ""}${propMappings.readOnlyBinding}}`}
                  </span>
                )}
                {propMappings.readOnlyMode === "expression" && propMappings.readOnlyExpression && (
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-[9px] font-mono text-indigo-400 border border-indigo-500/20">
                    readOnly={`{${propMappings.readOnlyExpression}}`}
                  </span>
                )}
                {(!propMappings.readOnlyMode || propMappings.readOnlyMode === "static") && propMappings.readOnly && (
                  <span className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-mono text-muted-foreground border border-border/40">
                    readOnly
                  </span>
                )}

                {/* Disabled indicator */}
                {propMappings.disabledMode === "state_binding" && propMappings.disabledBinding && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-[9px] font-mono text-amber-500 border border-amber-500/20">
                    disabled={`{${propMappings.disabledInverted ? "!" : ""}${propMappings.disabledBinding}}`}
                  </span>
                )}
                {propMappings.disabledMode === "expression" && propMappings.disabledExpression && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-[9px] font-mono text-amber-500 border border-amber-500/20">
                    disabled={`{${propMappings.disabledExpression}}`}
                  </span>
                )}
                {(!propMappings.disabledMode || propMappings.disabledMode === "static") && propMappings.disabled && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-[9px] font-mono text-amber-500 border border-amber-500/20">
                    disabled
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {currentComponent === "alert" && (
          <Alert className="max-w-sm py-2 px-3 border-cyan-500/30 bg-cyan-500/5">
            <AlertTriangle className="h-4 w-4 text-cyan-500 shrink-0 mt-0.5" />
            <AlertDescription className="text-xs">
              {propMappings.alertTitle && (
                <div className="font-semibold text-foreground mb-0.5">{propMappings.alertTitle}</div>
              )}
              {labelToRender && <strong className="mr-1">{labelToRender}:</strong>}
              <span>{formattedPreviewValue}</span>
            </AlertDescription>
          </Alert>
        )}

        {currentComponent === "avatar" && (
          <div className="flex items-center gap-2">
            <Avatar className="h-9 w-9 border border-border">
              {propMappings.avatarSrc ? (
                <img
                  src={propMappings.avatarSrc}
                  alt={labelToRender || displayLabel}
                  className="h-full w-full object-cover rounded-full"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : null}
              <AvatarFallback className="bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold text-xs">
                {propMappings.avatarFallback || (labelToRender ? labelToRender.slice(0, 2).toUpperCase() : (displayLabel ? displayLabel.slice(0, 2).toUpperCase() : "AV"))}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              {labelToRender && <span className="text-xs font-semibold">{labelToRender}</span>}
              <span className="text-[10px] text-muted-foreground font-mono">{formattedPreviewValue}</span>
            </div>
          </div>
        )}

        {currentComponent === "skeleton" && (
          <div className="flex items-center gap-3">
            <Skeleton className={cn(propMappings.skeletonHeight || "h-7", propMappings.skeletonWidth || "w-28", "rounded-md")} />
            <span className="text-xs text-muted-foreground font-mono">({labelToRender || "State"} loading...)</span>
          </div>
        )}

        {currentComponent === "code" && (
          <pre className="text-[11px] font-mono p-3 rounded-lg bg-muted/50 border border-border/60 max-w-sm w-full overflow-x-auto text-foreground">
            {typeof sampleValue === "object"
              ? JSON.stringify(sampleValue, null, 2)
              : labelToRender
              ? `${labelToRender}: ${formattedPreviewValue}`
              : formattedPreviewValue}
          </pre>
        )}

        {currentComponent === "text" && (
          <div className="text-xs px-2.5 py-1.5 rounded-md bg-secondary/50 border border-border text-foreground font-mono">
            {labelToRender && <span className="text-muted-foreground">{labelToRender}: </span>}
            <span>{formattedPreviewValue}</span>
          </div>
        )}

        {currentClickAction !== "none" && (
          <div className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground/80">
            <MousePointerClick size={10} className="text-cyan-500" />
            <span>Click to test interactive action ({currentClickAction})</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
