"use client";

import React, { useState, useMemo } from "react";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Textarea } from "@workspace/ui/components/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  Sliders,
  Activity,
  Play,
  Code2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Zap,
  CornerDownRight,
} from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { StateManipulator, StoreState } from "./types";

export interface ExecutionResult {
  manipulatorName: string;
  category: string;
  success: boolean;
  error?: string;
  changedKeys: string[];
  beforeState: StoreState;
  afterState: StoreState;
  timestamp: string;
}

export interface ManipulatorRunnerSectionProps {
  manipulators: StateManipulator[];
  selectedManipulator: StateManipulator | undefined;
  selectedManipulatorId: string;
  onSelectManipulator: (id: string) => void;
  payloadText: string;
  onChangePayloadText: (text: string) => void;
  manipulatorArgInfo: { label: string; placeholder: string };
  isExecuting: boolean;
  onRunManipulator: () => void;
  onQuickRunManipulator?: (manipulatorId: string) => void;
  lastExecutionResult?: ExecutionResult | null;
}

export const ManipulatorRunnerSection: React.FC<ManipulatorRunnerSectionProps> = ({
  manipulators,
  selectedManipulator,
  selectedManipulatorId,
  onSelectManipulator,
  payloadText,
  onChangePayloadText,
  manipulatorArgInfo,
  isExecuting,
  onRunManipulator,
  onQuickRunManipulator,
  lastExecutionResult,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | "custom_action" | "auto_setter" | "builtin"
  >("all");
  const [showCodePreview, setShowCodePreview] = useState(false);

  const customActions = useMemo(
    () =>
      manipulators.filter(
        (m) => m.category === "custom_action" || m.category === "standard_action",
      ),
    [manipulators],
  );

  const setterActions = useMemo(
    () => manipulators.filter((m) => m.category === "auto_setter"),
    [manipulators],
  );

  const builtinActions = useMemo(
    () => manipulators.filter((m) => m.category === "builtin"),
    [manipulators],
  );

  const filteredManipulators = useMemo(() => {
    if (categoryFilter === "custom_action") return customActions;
    if (categoryFilter === "auto_setter") return setterActions;
    if (categoryFilter === "builtin") return builtinActions;
    return manipulators;
  }, [categoryFilter, customActions, setterActions, builtinActions, manipulators]);

  const handleApplyPreset = (preset: "default" | "emptyArray" | "sampleObject" | "empty") => {
    if (!selectedManipulator) return;
    if (preset === "default") {
      const def = selectedManipulator.defaultPayload;
      onChangePayloadText(
        def !== undefined && def !== null
          ? typeof def === "object"
            ? JSON.stringify(def, null, 2)
            : String(def)
          : "",
      );
    } else if (preset === "emptyArray") {
      onChangePayloadText("[]");
    } else if (preset === "sampleObject") {
      onChangePayloadText(JSON.stringify({ id: "sample_1", title: "New Item", active: true }, null, 2));
    } else if (preset === "empty") {
      onChangePayloadText("");
    }
  };

  const hasCustomCode = Boolean(selectedManipulator?.code && selectedManipulator.code.trim());

  return (
    <div className="p-3 rounded-lg bg-card border border-border space-y-3">
      {/* Header & Category Filters */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Zap size={13} className="text-foreground" />
            <span>Execute Store Action ({manipulators.length})</span>
          </Label>

          {selectedManipulator && (
            <Badge
              variant="outline"
              className="text-[9px] uppercase px-1.5 py-0 font-mono text-muted-foreground border-border bg-muted"
            >
              {selectedManipulator.category.replace("_", " ")}
            </Badge>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer whitespace-nowrap",
              categoryFilter === "all"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "bg-muted text-muted-foreground hover:text-foreground border border-border",
            )}
          >
            All ({manipulators.length})
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter("custom_action")}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer whitespace-nowrap",
              categoryFilter === "custom_action"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "bg-muted text-muted-foreground hover:text-foreground border border-border",
            )}
          >
            Custom Actions ({customActions.length})
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter("auto_setter")}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer whitespace-nowrap",
              categoryFilter === "auto_setter"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "bg-muted text-muted-foreground hover:text-foreground border border-border",
            )}
          >
            Setters ({setterActions.length})
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter("builtin")}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer whitespace-nowrap",
              categoryFilter === "builtin"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "bg-muted text-muted-foreground hover:text-foreground border border-border",
            )}
          >
            Built-ins ({builtinActions.length})
          </button>
        </div>
      </div>

      {/* Quick Action Selector / Action List */}
      <div className="space-y-1.5">
        <Select value={selectedManipulatorId} onValueChange={onSelectManipulator}>
          <SelectTrigger className="h-8 text-xs bg-background font-mono border-border">
            <SelectValue placeholder="Select state action..." />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {filteredManipulators.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-xs font-mono">
                <span className="font-semibold text-foreground">{m.name}()</span>
                <span className="text-[10px] text-muted-foreground ml-1.5">
                  [{m.actionType || m.category.replace("_", " ")}]
                </span>
                {m.targetFieldName && (
                  <span className="text-[9px] text-muted-foreground ml-1">
                    → {m.targetFieldName}
                  </span>
                )}
                {m.code && m.code.trim() && (
                  <span className="text-[9px] text-foreground font-semibold ml-1">
                    *custom
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Action Quick Chips */}
        <div className="flex flex-wrap gap-1 pt-1 max-h-24 overflow-y-auto">
          {filteredManipulators.map((m) => {
            const isSelected = m.id === selectedManipulatorId;
            return (
              <div
                key={m.id}
                onClick={() => onSelectManipulator(m.id)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono cursor-pointer transition-all border",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                    : "bg-muted text-muted-foreground border-border hover:text-foreground hover:bg-accent",
                )}
              >
                <span>{m.name}()</span>
                {onQuickRunManipulator && (
                  <button
                    type="button"
                    title={`Quick run ${m.name}()`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickRunManipulator(m.id);
                    }}
                    className={cn(
                      "p-0.5 cursor-pointer",
                      isSelected ? "text-primary-foreground hover:opacity-80" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Play size={10} className="fill-current" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Action Details & Logic Preview */}
      {selectedManipulator && (
        <div className="rounded-lg bg-card border border-border p-3 space-y-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-mono font-bold text-foreground">
                {selectedManipulator.name}()
              </span>
              {selectedManipulator.actionType && (
                <Badge variant="outline" className="text-[8px] px-1 py-0 uppercase bg-muted text-muted-foreground border-border">
                  {selectedManipulator.actionType}
                </Badge>
              )}
              {selectedManipulator.targetFieldName && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  target: <code className="text-foreground font-semibold">{selectedManipulator.targetFieldName}</code>
                </span>
              )}
            </div>

            {hasCustomCode && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCodePreview(!showCodePreview)}
                className="h-5 text-[10px] px-1.5 text-muted-foreground hover:text-foreground gap-0.5 cursor-pointer"
              >
                <Code2 size={11} />
                <span>{showCodePreview ? "Hide Logic" : "View Logic"}</span>
                {showCodePreview ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </Button>
            )}
          </div>

          {/* Collapsible Custom Code Preview */}
          {hasCustomCode && showCodePreview && (
            <div className="p-2.5 rounded-md bg-muted border border-border font-mono text-[10px] text-foreground overflow-x-auto space-y-1">
              <div className="text-[9px] text-muted-foreground flex items-center justify-between">
                <span>Custom TypeScript / JS Body:</span>
                <span>Scope: payload, set(patch), get(), state, initialState</span>
              </div>
              <pre className="whitespace-pre-wrap leading-relaxed">{selectedManipulator.code}</pre>
            </div>
          )}

          {/* Action Arguments / Payload Editor */}
          {selectedManipulator.actionType !== "reset" && (
            <div className="space-y-1.5 pt-1 border-t border-border">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                  <span>
                    {manipulatorArgInfo.label}
                  </span>
                </Label>

                {/* Quick Presets */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset("default")}
                    className="text-[9px] px-2 py-0.5 rounded bg-muted hover:bg-accent text-muted-foreground hover:text-foreground border border-border cursor-pointer"
                  >
                    Default
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset("sampleObject")}
                    className="text-[9px] px-2 py-0.5 rounded bg-muted hover:bg-accent text-muted-foreground hover:text-foreground border border-border cursor-pointer"
                  >
                    Sample Obj
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset("empty")}
                    className="text-[9px] px-2 py-0.5 rounded bg-muted hover:bg-accent text-muted-foreground hover:text-foreground border border-border cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <Textarea
                value={payloadText}
                onChange={(e) => onChangePayloadText(e.target.value)}
                placeholder={manipulatorArgInfo.placeholder}
                className="min-h-[64px] text-[11px] font-mono bg-background resize-y p-2 border border-border leading-relaxed text-foreground"
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    onRunManipulator();
                  }
                }}
              />
              <span className="text-[9px] text-muted-foreground block">
                Tip: Press <kbd className="px-1 py-0.2 rounded bg-muted text-[8px] font-mono border border-border">Ctrl+Enter</kbd> to execute
              </span>
            </div>
          )}

          {/* Run Button */}
          <Button
            type="button"
            onClick={onRunManipulator}
            disabled={isExecuting || !selectedManipulator}
            className="w-full h-8 text-xs font-semibold shadow-xs gap-1.5 cursor-pointer mt-1"
          >
            {isExecuting ? (
              <Activity size={13} className="animate-spin" />
            ) : (
              <Play size={13} className="fill-current" />
            )}
            <span>Execute {selectedManipulator.name}()</span>
          </Button>

          {/* Execution Result Banner */}
          {lastExecutionResult && lastExecutionResult.manipulatorName === selectedManipulator.name && (
            <div
              className={cn(
                "p-2.5 rounded-md border text-[11px] font-mono mt-2 space-y-1 transition-all",
                lastExecutionResult.success
                  ? "bg-card border-border text-foreground"
                  : "bg-destructive/10 border-destructive text-destructive",
              )}
            >
              <div className="flex items-center justify-between font-semibold">
                <span className="flex items-center gap-1.5">
                  {lastExecutionResult.success ? (
                    <CheckCircle2 size={13} className="text-foreground shrink-0" />
                  ) : (
                    <AlertCircle size={13} className="text-destructive shrink-0" />
                  )}
                  <span>
                    {lastExecutionResult.success ? "Execution Succeeded" : "Execution Failed"}
                  </span>
                </span>
                <span className="text-[9px] text-muted-foreground font-normal">
                  {lastExecutionResult.timestamp}
                </span>
              </div>

              {lastExecutionResult.error ? (
                <p className="text-[10px] text-destructive break-words font-mono">
                  {lastExecutionResult.error}
                </p>
              ) : (
                <div className="text-[10px] space-y-0.5">
                  <span className="text-muted-foreground block">
                    Mutated fields:{" "}
                    {lastExecutionResult.changedKeys.length === 0 ? (
                      <span className="italic text-muted-foreground">No fields modified</span>
                    ) : (
                      lastExecutionResult.changedKeys.map((key) => (
                        <span key={key} className="text-foreground font-bold mr-1">
                          {key}
                        </span>
                      ))
                    )}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
