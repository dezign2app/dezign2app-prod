import React, { useMemo } from "react";
import {
  Code2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Check,
  Copy,
  Play,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import type {
  LangGraphStateChannel,
  LangGraphCustomReducer,
} from "@/types/canvas";
import { BUILT_IN_REDUCERS } from "../../constants";
import {
  REDUCER_PRESETS,
  getPlaygroundPresetsForReducer,
  formatPresetValue,
  type ReducerExecutionResult,
} from "../../utils/reducerSimulationEngine";

export interface ReducerPlaygroundSectionProps {
  stateChannels: LangGraphStateChannel[];
  customReducers: LangGraphCustomReducer[];
  selectedReducer: string;
  onSelectReducer: (val: string) => void;
  matchedCustomReducer?: LangGraphCustomReducer;
  customPlaygroundCode: string;
  setCustomPlaygroundCode: (val: string) => void;
  prevInput: string;
  setPrevInput: (val: string) => void;
  nextInput: string;
  setNextInput: (val: string) => void;
  playgroundResult: ReducerExecutionResult | null;
  onRunPlayground: () => void;
  onApplyPlaygroundPreset: (preset: {
    prev: unknown;
    next: unknown;
    label?: string;
    description?: string;
  }) => void;
  onLoadStateIntoPlaygroundPrev: () => void;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
}

export function ReducerPlaygroundSection({
  stateChannels,
  customReducers,
  selectedReducer,
  onSelectReducer,
  matchedCustomReducer,
  customPlaygroundCode,
  setCustomPlaygroundCode,
  prevInput,
  setPrevInput,
  nextInput,
  setNextInput,
  playgroundResult,
  onRunPlayground,
  onApplyPlaygroundPreset,
  onLoadStateIntoPlaygroundPrev,
  copiedKey,
  onCopy,
}: ReducerPlaygroundSectionProps) {
  const playgroundPresets = useMemo(() => {
    return getPlaygroundPresetsForReducer(
      selectedReducer,
      stateChannels,
      customReducers,
    );
  }, [selectedReducer, stateChannels, customReducers]);

  return (
    <div className="flex flex-col gap-3.5">
      {/* Reducer Selector Box */}
      <div className="flex flex-col gap-2 p-3 rounded-lg bg-card border border-border/70 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
            <Code2 className="w-3.5 h-3.5 text-purple-400" />
            Select Reducer to Test
          </span>
          {matchedCustomReducer && (
            <Badge
              variant="secondary"
              className="text-[9px] bg-purple-500/20 text-purple-300 border-0"
            >
              Custom Developer Function
            </Badge>
          )}
        </div>

        <Select
          value={selectedReducer}
          onValueChange={(val) => {
            onSelectReducer(val);
            const matched = customReducers.find(
              (r) => r.name === val || r.id === val,
            );
            if (matched) {
              setCustomPlaygroundCode(matched.code);
            }
            const presets = getPlaygroundPresetsForReducer(
              val,
              stateChannels,
              customReducers,
            );
            if (presets && presets[0]) {
              setPrevInput(formatPresetValue(presets[0].prev));
              setNextInput(formatPresetValue(presets[0].next));
            }
          }}
        >
          <SelectTrigger className="h-8 text-xs bg-background font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="font-mono text-xs">
            <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase">
              Built-in LangGraph Reducers
            </div>
            {BUILT_IN_REDUCERS.map((r) => (
              <SelectItem key={r.name} value={r.name}>
                {r.label}
              </SelectItem>
            ))}

            <div className="px-2 py-1 text-[10px] font-bold text-purple-400 uppercase border-t border-border/40 mt-1">
              Developer Defined Custom Reducers
            </div>
            <SelectItem value="custom" className="text-purple-300">
              custom (inline code sandbox)
            </SelectItem>
            {customReducers.map((r) => (
              <SelectItem key={r.id} value={r.name} className="text-purple-300">
                {r.name} {r.targetField ? `(tied to ${r.targetField})` : ""}
              </SelectItem>
            ))}

            {/* Active Channel Reducers (e.g. count_reducer assigned on field) */}
            {stateChannels.some(
              (c) =>
                c.reducer &&
                !BUILT_IN_REDUCERS.some((b) => b.name === c.reducer) &&
                !customReducers.some((cr) => cr.name === c.reducer),
            ) && (
              <>
                <div className="px-2 py-1 text-[10px] font-bold text-emerald-400 uppercase border-t border-border/40 mt-1">
                  Active Channel Reducers
                </div>
                {stateChannels
                  .filter(
                    (c) =>
                      c.reducer &&
                      !BUILT_IN_REDUCERS.some((b) => b.name === c.reducer) &&
                      !customReducers.some((cr) => cr.name === c.reducer),
                  )
                  .map((c) => (
                    <SelectItem
                      key={`ch-${c.key}-${c.reducer}`}
                      value={c.reducer}
                      className="text-emerald-300 font-semibold"
                    >
                      {c.reducer} (tied to {c.key})
                    </SelectItem>
                  ))}
              </>
            )}
          </SelectContent>
        </Select>

        {/* If custom reducer: show editable function code */}
        {(selectedReducer === "custom" || matchedCustomReducer) && (
          <div className="flex flex-col gap-1 mt-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Reducer Javascript Implementation:</span>
              <span className="font-mono text-purple-300">
                (prev, next) =&gt; ...
              </span>
            </div>
            <textarea
              value={customPlaygroundCode}
              onChange={(e) => setCustomPlaygroundCode(e.target.value)}
              rows={3}
              className="w-full text-xs font-mono bg-background/80 p-2 rounded border border-purple-500/30 text-purple-200 focus:outline-none focus:border-purple-500"
              placeholder="(prev, next) => Array.isArray(prev) ? [...prev, ...next] : next"
            />
          </div>
        )}

        {/* Quick Presets for this reducer */}
        {playgroundPresets.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[10px] text-muted-foreground font-semibold">
              Test Scenarios:
            </span>
            {playgroundPresets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onApplyPlaygroundPreset(preset)}
                className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/50 hover:bg-secondary text-secondary-foreground border border-border/50 hover:border-purple-500/40 transition-colors cursor-pointer"
                title={preset.description}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Inputs: prev and next */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Previous State (prev) */}
        <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-card border border-border/70 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground text-xs flex items-center gap-1">
              <span>1. Previous Value</span>
              <span className="font-mono text-blue-400 font-semibold">
                (prev)
              </span>
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-5 px-1.5 text-[9px] font-mono text-purple-300 border-purple-500/30 hover:bg-purple-500/10 cursor-pointer"
                onClick={onLoadStateIntoPlaygroundPrev}
                title="Load current graph state as 'prev' object"
              >
                Load Graph State
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 px-1 text-[9px] text-muted-foreground"
                onClick={() => {
                  try {
                    setPrevInput(JSON.stringify(JSON.parse(prevInput), null, 2));
                  } catch {
                    // ignore
                  }
                }}
              >
                Format
              </Button>
            </div>
          </div>
          <textarea
            value={prevInput}
            onChange={(e) => setPrevInput(e.target.value)}
            rows={5}
            className="w-full text-xs font-mono bg-background p-2 rounded border border-blue-500/30 focus:border-blue-500 focus:outline-none resize-y text-foreground"
            placeholder='[{"role": "user", "content": "hi"}]'
          />
        </div>

        {/* Incoming Update (next) */}
        <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-card border border-border/70 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground text-xs flex items-center gap-1">
              <span>2. Incoming Update</span>
              <span className="font-mono text-emerald-400 font-semibold">
                (next)
              </span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-1 text-[9px] text-muted-foreground"
              onClick={() => {
                try {
                  setNextInput(JSON.stringify(JSON.parse(nextInput), null, 2));
                } catch {
                  // ignore
                }
              }}
            >
              Format
            </Button>
          </div>
          <textarea
            value={nextInput}
            onChange={(e) => setNextInput(e.target.value)}
            rows={5}
            className="w-full text-xs font-mono bg-background p-2 rounded border border-emerald-500/30 focus:border-emerald-500 focus:outline-none resize-y text-foreground"
            placeholder='[{"role": "assistant", "content": "hello"}]'
          />
        </div>
      </div>

      {/* Run Reducer Action */}
      <Button
        className="w-full h-8 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white gap-2 shadow-sm"
        onClick={onRunPlayground}
      >
        <Play className="w-3.5 h-3.5 fill-current" />
        <span>Execute Reducer Function</span>
      </Button>

      {/* Playground Result Card */}
      {playgroundResult && (
        <div
          className={`flex flex-col gap-2 p-3 rounded-lg border shadow-sm ${
            playgroundResult.success
              ? "bg-purple-500/5 border-purple-500/30"
              : "bg-destructive/10 border-destructive/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {playgroundResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-destructive" />
              )}
              <span className="font-bold text-foreground text-xs">
                Result: {selectedReducer}(prev, next)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-mono">
                <Clock className="w-3 h-3" />
                <span>{playgroundResult.durationMs.toFixed(2)}ms</span>
              </div>
              {playgroundResult.success && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    onCopy(
                      JSON.stringify(playgroundResult.result, null, 2),
                      "playground_res",
                    )
                  }
                  title="Copy result JSON"
                >
                  {copiedKey === "playground_res" ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
              )}
            </div>
          </div>

          {playgroundResult.error ? (
            <div className="p-2.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-xs font-mono">
              {playgroundResult.error}
            </div>
          ) : (
            <pre className="text-xs font-mono bg-background/90 p-3 rounded border border-border/60 max-h-60 overflow-y-auto overflow-x-auto text-emerald-300">
              {JSON.stringify(playgroundResult.result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
