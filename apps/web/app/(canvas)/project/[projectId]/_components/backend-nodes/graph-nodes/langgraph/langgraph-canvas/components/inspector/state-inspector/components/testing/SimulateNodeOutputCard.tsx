import React, { useMemo } from "react";
import {
  Sparkles,
  Layers,
  Code2,
  AlertCircle,
  Trash2,
  Plus,
  Play,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
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

export interface SimulateNodeOutputCardProps {
  stateChannels: LangGraphStateChannel[];
  customReducers: LangGraphCustomReducer[];
  simulatedState: Record<string, unknown>;
  payloadMode: "single" | "json" | "form";
  setPayloadMode: (mode: "single" | "json" | "form") => void;
  singleChannelKey: string;
  setSingleChannelKey: (key: string) => void;
  singleUpdateVal: string;
  setSingleUpdateVal: (val: string) => void;
  rawPayloadInput: string;
  setRawPayloadInput: (val: string) => void;
  payloadError: string | null;
  setPayloadError: (err: string | null) => void;
  onFormatPayloadJson: () => void;
  formRows: Array<{ key: string; valueStr: string }>;
  onAddFormRow: () => void;
  onUpdateFormRow: (idx: number, patch: { key?: string; valueStr?: string }) => void;
  onRemoveFormRow: (idx: number) => void;
  onApplyUpdate: () => void;
  onLoadStateUpdatePreset: (payload: Record<string, unknown>) => void;
  onSelectChannelToSimulate: (channelKey: string) => void;
  onSelectReducerForTesting: (reducerName: string, code?: string) => void;
}

const STATE_UPDATE_PRESETS = [
  {
    label: "Assistant Response",
    description: "Appends assistant message into messages channel",
    payload: {
      messages: [
        {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: "I have processed your query and updated graph state.",
        },
      ],
    },
  },
  {
    label: "Update Message (Dedup)",
    description: "Edits existing message matching same ID",
    payload: {
      messages: [
        {
          id: "msg-sim-1",
          role: "assistant",
          content: "Stream finished: Final synthesized result.",
        },
      ],
    },
  },
  {
    label: "Increment Counter",
    description: "Increments integer channel",
    payload: {
      step_count: 1,
      count: 1,
      iterations: 1,
    },
  },
  {
    label: "Merge Metadata",
    description: "Updates or adds metadata keys",
    payload: {
      metadata: {
        last_node: "agent_executor",
        timestamp: new Date().toISOString(),
        status: "success",
      },
    },
  },
];

export function SimulateNodeOutputCard({
  stateChannels,
  customReducers,
  simulatedState,
  payloadMode,
  setPayloadMode,
  singleChannelKey,
  setSingleChannelKey,
  singleUpdateVal,
  setSingleUpdateVal,
  rawPayloadInput,
  setRawPayloadInput,
  payloadError,
  setPayloadError,
  onFormatPayloadJson,
  formRows,
  onAddFormRow,
  onUpdateFormRow,
  onRemoveFormRow,
  onApplyUpdate,
  onLoadStateUpdatePreset,
  onSelectChannelToSimulate,
  onSelectReducerForTesting,
}: SimulateNodeOutputCardProps) {
  const activeSingleChannel = useMemo(
    () =>
      stateChannels.find((c) => c.key === singleChannelKey) || stateChannels[0],
    [stateChannels, singleChannelKey],
  );

  const activeSingleReducerCode = useMemo(() => {
    if (!activeSingleChannel) return null;
    const custom = customReducers.find(
      (r) =>
        r.name === activeSingleChannel.reducer ||
        r.id === activeSingleChannel.reducer ||
        r.targetField === activeSingleChannel.key,
    );
    return custom?.code || activeSingleChannel.customReducerCode || null;
  }, [activeSingleChannel, customReducers]);

  return (
    <div className="flex flex-col gap-2.5 p-3 rounded-lg bg-card border border-border/70 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-bold text-foreground text-xs">
            Simulate Node Output (State Update Payload)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={payloadMode === "single" ? "secondary" : "ghost"}
            className="h-6 px-2 text-[10px] font-semibold"
            onClick={() => setPayloadMode("single")}
          >
            Single Reducer
          </Button>
          <Button
            size="sm"
            variant={payloadMode === "json" ? "secondary" : "ghost"}
            className="h-6 px-2 text-[10px]"
            onClick={() => setPayloadMode("json")}
          >
            Raw JSON
          </Button>
          <Button
            size="sm"
            variant={payloadMode === "form" ? "secondary" : "ghost"}
            className="h-6 px-2 text-[10px]"
            onClick={() => setPayloadMode("form")}
          >
            Field Form
          </Button>
        </div>
      </div>

      {/* Quick Channel Selectors (only for JSON / Form mode) */}
      {payloadMode !== "single" && stateChannels.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap p-1.5 rounded-md bg-muted/30 border border-border/40">
          <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
            <Layers className="w-3 h-3 text-emerald-400" />
            Target Channel:
          </span>
          {stateChannels.map((ch) => (
            <button
              key={ch.key}
              type="button"
              onClick={() => onSelectChannelToSimulate(ch.key)}
              className="px-2 py-0.5 rounded text-[10px] font-mono border border-border/60 bg-background hover:border-emerald-500 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all flex items-center gap-1 cursor-pointer"
              title={`Click to fill payload for ${ch.key} (reducer: ${ch.reducer || "replace"})`}
            >
              <span className="font-semibold text-foreground">{ch.key}</span>
              <span className="text-[9px] text-muted-foreground">({ch.reducer || "replace"})</span>
            </button>
          ))}
        </div>
      )}

      {/* Quick Preset Buttons (for JSON / Form mode) */}
      {payloadMode !== "single" && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground font-semibold">
            Quick Presets:
          </span>
          {STATE_UPDATE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onLoadStateUpdatePreset(preset.payload)}
              className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/50 hover:bg-secondary text-secondary-foreground border border-border/50 hover:border-emerald-500/40 transition-colors"
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {/* Payload Input */}
      {payloadMode === "single" ? (
        <div className="flex flex-col gap-2.5 p-3 rounded-lg bg-background/80 border border-emerald-500/30 shadow-sm">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                <Code2 className="w-3.5 h-3.5 text-purple-400" />
                Select Channel Reducer to Test:
              </Label>
              {activeSingleChannel && (
                <span className="text-[9px] font-mono text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                  Reducer: {activeSingleChannel.reducer || "replace"} ({activeSingleChannel.type})
                </span>
              )}
            </div>
            <Select
              value={activeSingleChannel?.key || singleChannelKey}
              onValueChange={(val) => {
                setSingleChannelKey(val);
                onSelectChannelToSimulate(val);
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-background font-mono">
                <SelectValue placeholder="Choose channel to simulate..." />
              </SelectTrigger>
              <SelectContent className="font-mono text-xs">
                {stateChannels.map((ch) => (
                  <SelectItem key={ch.key} value={ch.key}>
                    {ch.key} — {ch.reducer || "replace"} ({ch.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {activeSingleReducerCode && (
            <div className="flex flex-col gap-1 bg-purple-500/5 p-2 rounded border border-purple-500/20">
              <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                <span className="font-semibold text-purple-300">Reducer Function Code:</span>
                <button
                  type="button"
                  onClick={() =>
                    onSelectReducerForTesting(
                      activeSingleChannel?.reducer || "replace",
                      activeSingleReducerCode || undefined,
                    )
                  }
                  className="text-[9px] text-purple-400 hover:text-purple-200 hover:underline flex items-center gap-0.5 cursor-pointer font-sans"
                >
                  Open in Unit Playground ↗
                </button>
              </div>
              <code className="text-[10px] font-mono text-purple-200 whitespace-pre-wrap max-h-16 overflow-y-auto">
                {activeSingleReducerCode}
              </code>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-muted-foreground">
                  1. Current Channel State (prev):
                </span>
                <span className="text-[9px] text-muted-foreground font-mono">
                  {typeof (simulatedState[activeSingleChannel?.key || ""] ?? 0)}
                </span>
              </div>
              <pre className="text-[11px] font-mono bg-muted/40 p-2 rounded border border-border/50 text-foreground overflow-auto h-20 whitespace-pre-wrap">
                {JSON.stringify(
                  simulatedState[activeSingleChannel?.key || ""] ?? 0,
                  null,
                  2,
                )}
              </pre>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-emerald-400">
                  2. Incoming Channel Update (next):
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 px-1.5 text-[9px] text-muted-foreground hover:text-foreground bg-muted/50"
                  onClick={() => {
                    try {
                      const parsed = JSON.parse(singleUpdateVal);
                      setSingleUpdateVal(JSON.stringify(parsed, null, 2));
                    } catch {
                      // ignore if not valid JSON
                    }
                  }}
                  title="Format JSON"
                >
                  Format
                </Button>
              </div>
              <textarea
                value={singleUpdateVal}
                onChange={(e) => {
                  setSingleUpdateVal(e.target.value);
                  setPayloadError(null);
                }}
                rows={3}
                placeholder='e.g. 1, "add", or {"message": "add"}'
                className="h-20 w-full text-xs font-mono bg-background p-2 rounded border border-border focus:border-emerald-500 focus:outline-none resize-y text-foreground"
              />
            </div>
          </div>

          {payloadError && (
            <div className="text-[10px] text-destructive flex items-center gap-1 font-mono">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{payloadError}</span>
            </div>
          )}
        </div>
      ) : payloadMode === "json" ? (
        <div className="flex flex-col gap-1.5">
          <div className="relative">
            <textarea
              value={rawPayloadInput}
              onChange={(e) => {
                setRawPayloadInput(e.target.value);
                setPayloadError(null);
              }}
              rows={5}
              className="w-full text-xs font-mono bg-background p-2.5 rounded border border-border focus:border-emerald-500 focus:outline-none resize-y text-foreground"
              placeholder='{"messages": [{ "role": "assistant", "content": "..." }]}'
            />
            <Button
              size="sm"
              variant="ghost"
              className="absolute top-1.5 right-1.5 h-5 px-1.5 text-[9px] text-muted-foreground hover:text-foreground bg-muted/60"
              onClick={onFormatPayloadJson}
              title="Format and validate JSON"
            >
              Format JSON
            </Button>
          </div>
          {payloadError && (
            <div className="text-[10px] text-destructive flex items-center gap-1 font-mono">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{payloadError}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {formRows.map((row, idx) => (
            <div key={idx} className="flex items-start gap-1.5">
              <Select
                value={row.key}
                onValueChange={(val) =>
                  onUpdateFormRow(idx, { key: val })
                }
              >
                <SelectTrigger className="h-8 w-36 text-xs bg-background font-mono shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="font-mono text-xs">
                  {stateChannels.map((ch) => (
                    <SelectItem key={ch.key} value={ch.key}>
                      {ch.key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <textarea
                value={row.valueStr}
                onChange={(e) =>
                  onUpdateFormRow(idx, { valueStr: e.target.value })
                }
                rows={1}
                placeholder='Value (e.g. "text", [1,2], or {"a": 1})'
                className="flex-1 min-h-[32px] text-xs font-mono bg-background p-1.5 rounded border border-border focus:border-emerald-500 focus:outline-none resize-y text-foreground"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => onRemoveFormRow(idx)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            className="h-6 self-start text-[10px] gap-1 font-mono"
            onClick={onAddFormRow}
          >
            <Plus className="w-3 h-3" /> Add Field Update
          </Button>
        </div>
      )}

      {/* Execute Button */}
      <Button
        className="w-full h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm transition-all"
        onClick={onApplyUpdate}
      >
        <Play className="w-3.5 h-3.5 fill-current" />
        <span>Apply State Update & Run Reducers</span>
      </Button>
    </div>
  );
}
