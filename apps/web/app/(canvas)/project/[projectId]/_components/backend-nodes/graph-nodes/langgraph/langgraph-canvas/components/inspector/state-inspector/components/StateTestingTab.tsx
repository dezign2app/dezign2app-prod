import React, { useState } from "react";
import {
  Play,
  RotateCcw,
  Sparkles,
  Check,
  Copy,
  ChevronDown,
  ChevronRight,
  Code2,
  Database,
  History,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  Plus,
  Trash2,
  FileCode,
  Undo2,
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
import { BUILT_IN_REDUCERS } from "../constants";
import {
  REDUCER_PRESETS,
  type ChannelSimulationResult,
} from "../utils/reducerSimulationEngine";
import { useStateSimulationManager } from "../hooks/useStateSimulationManager";

interface StateTestingTabProps {
  stateChannels: LangGraphStateChannel[];
  customReducers?: LangGraphCustomReducer[];
  initialSelectedReducer?: string;
  onNavigateToChannels?: () => void;
}

export function StateTestingTab({
  stateChannels,
  customReducers = [],
  initialSelectedReducer,
  onNavigateToChannels,
}: StateTestingTabProps) {
  const {
    testingSubMode,
    setTestingSubMode,

    // State Transition
    simulatedState,
    isEditingState,
    setIsEditingState,
    rawStateInput,
    setRawStateInput,
    rawStateError,
    handleSaveRawState,
    handleResetToInitial,
    payloadMode,
    setPayloadMode,
    rawPayloadInput,
    setRawPayloadInput,
    payloadError,
    setPayloadError,
    handleFormatPayloadJson,
    formRows,
    handleAddFormRow,
    handleUpdateFormRow,
    handleRemoveFormRow,
    stepHistory,
    activeStepId,
    handleRevertToStep,
    lastSimulationResult,
    handleApplyUpdate,
    handleLoadStateUpdatePreset,

    // Reducer Playground
    selectedReducer,
    setSelectedReducer,
    matchedCustomReducer,
    customPlaygroundCode,
    setCustomPlaygroundCode,
    prevInput,
    setPrevInput,
    nextInput,
    setNextInput,
    playgroundResult,
    handleRunPlayground,
    handleApplyPlaygroundPreset,
  } = useStateSimulationManager({
    stateChannels,
    customReducers,
    initialSelectedReducer,
  });

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showCurrentStateRaw, setShowCurrentStateRaw] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  // State Transition Quick Presets
  const stateUpdatePresets = [
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

  return (
    <div className="flex flex-col gap-4 text-xs font-sans pb-6">
      {/* ── Top Header & Sub-Mode Switcher ── */}
      <div className="flex flex-col gap-2.5 bg-muted/30 p-3 rounded-lg border border-border/60">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Play className="w-3.5 h-3.5 fill-current" />
            </div>
            <div>
              <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                <span>State & Reducer Simulation Sandbox</span>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1 py-0 h-4 border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-mono"
                >
                  LIVE
                </Badge>
              </div>
              <div className="text-[10px] text-muted-foreground">
                Test state transitions, LangGraph reducers, and message deduplication
              </div>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleResetToInitial}
            className="h-7 px-2 text-[11px] gap-1 font-mono hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            title="Reset state to channel default values"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset State</span>
          </Button>
        </div>

        {/* Sub-mode pill buttons */}
        <div className="flex items-center gap-1 bg-background/60 p-0.5 rounded-md border border-border/40">
          <button
            type="button"
            onClick={() => setTestingSubMode("transition")}
            className={`flex-1 py-1 px-2.5 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              testingSubMode === "transition"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Simulate State Updates</span>
            <span className="text-[10px] opacity-80 font-mono">
              ({stateChannels.length} channels)
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTestingSubMode("playground")}
            className={`flex-1 py-1 px-2.5 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              testingSubMode === "playground"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Reducer Playground</span>
            <Badge
              variant="secondary"
              className="text-[9px] px-1 py-0 h-3.5 bg-purple-500/20 text-purple-200 border-0"
            >
              Unit Test
            </Badge>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MODE 1: STATE TRANSITION SIMULATOR
         ══════════════════════════════════════════════════════════════ */}
      {testingSubMode === "transition" && (
        <div className="flex flex-col gap-4">
          {/* Current State Card */}
          <div className="flex flex-col gap-2 p-3 rounded-lg bg-card border border-border/70 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-bold text-foreground text-xs">
                  Current Graph State
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  ({Object.keys(simulatedState).length} keys)
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => setShowCurrentStateRaw((prev) => !prev)}
                >
                  {showCurrentStateRaw ? "Channel View" : "Raw JSON"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => setIsEditingState((prev) => !prev)}
                >
                  {isEditingState ? "Cancel Edit" : "Edit State"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    handleCopy(
                      JSON.stringify(simulatedState, null, 2),
                      "current_state",
                    )
                  }
                  title="Copy current state JSON"
                >
                  {copiedKey === "current_state" ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
              </div>
            </div>

            {/* If in edit raw state mode */}
            {isEditingState ? (
              <div className="flex flex-col gap-2 mt-1">
                <textarea
                  value={rawStateInput}
                  onChange={(e) => setRawStateInput(e.target.value)}
                  rows={6}
                  className="w-full text-xs font-mono bg-background p-2 rounded border border-border focus:border-blue-500 focus:outline-none resize-y"
                  placeholder='{"messages": [], "count": 0}'
                />
                {rawStateError && (
                  <div className="text-[10px] text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{rawStateError}</span>
                  </div>
                )}
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[11px]"
                    onClick={() => setIsEditingState(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 text-[11px] bg-blue-600 text-white hover:bg-blue-700"
                    onClick={handleSaveRawState}
                  >
                    Apply New State
                  </Button>
                </div>
              </div>
            ) : showCurrentStateRaw ? (
              <pre className="text-[10px] font-mono bg-background/80 p-2.5 rounded border border-border/50 max-h-48 overflow-y-auto overflow-x-auto text-muted-foreground">
                {JSON.stringify(simulatedState, null, 2)}
              </pre>
            ) : (
              <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
                {stateChannels.length === 0 ? (
                  <div className="p-3 text-center text-muted-foreground text-xs border border-dashed rounded">
                    No state channels configured.
                    {onNavigateToChannels && (
                      <Button
                        variant="link"
                        size="sm"
                        className="text-xs text-blue-400 p-0 ml-1 h-auto"
                        onClick={onNavigateToChannels}
                      >
                        Add channels now
                      </Button>
                    )}
                  </div>
                ) : (
                  stateChannels.map((ch) => {
                    const val = simulatedState[ch.key];
                    const matchedCustom = customReducers.find(
                      (r) =>
                        r.name === ch.reducer ||
                        r.id === ch.reducer ||
                        r.targetField === ch.key,
                    );
                    const valStr =
                      typeof val === "object" && val !== null
                        ? JSON.stringify(val)
                        : String(val ?? "");

                    return (
                      <div
                        key={ch.key}
                        className="flex items-center justify-between p-1.5 rounded bg-muted/20 border border-border/40 font-mono text-[11px]"
                      >
                        <div className="flex items-center gap-1.5 truncate pr-2">
                          <span className="font-semibold text-foreground">
                            {ch.key}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[9px] h-3.5 px-1 py-0 border-border text-muted-foreground font-sans"
                          >
                            {ch.type}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="text-[9px] h-3.5 px-1 py-0 bg-blue-500/10 text-blue-300 border-0"
                          >
                            {matchedCustom ? matchedCustom.name : ch.reducer || "replace"}
                          </Badge>
                        </div>
                        <div
                          className="text-muted-foreground truncate max-w-[200px] text-[10px]"
                          title={valStr}
                        >
                          {valStr || <span className="italic opacity-50">empty</span>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Node Output / Incoming Update Payload Section */}
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

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-muted-foreground font-semibold">
                Quick Presets:
              </span>
              {stateUpdatePresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleLoadStateUpdatePreset(preset.payload)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/50 hover:bg-secondary text-secondary-foreground border border-border/50 hover:border-emerald-500/40 transition-colors"
                  title={preset.description}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Payload Input */}
            {payloadMode === "json" ? (
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
                    onClick={handleFormatPayloadJson}
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
                  <div key={idx} className="flex items-center gap-1.5">
                    <Select
                      value={row.key}
                      onValueChange={(val) =>
                        handleUpdateFormRow(idx, { key: val })
                      }
                    >
                      <SelectTrigger className="h-7 w-36 text-xs bg-background font-mono">
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
                    <input
                      type="text"
                      value={row.valueStr}
                      onChange={(e) =>
                        handleUpdateFormRow(idx, { valueStr: e.target.value })
                      }
                      placeholder='Value (e.g. "text" or [1,2] or 5)'
                      className="flex-1 h-7 text-xs font-mono bg-background px-2 rounded border border-border focus:border-emerald-500 focus:outline-none"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => handleRemoveFormRow(idx)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 self-start text-[10px] gap-1 font-mono"
                  onClick={handleAddFormRow}
                >
                  <Plus className="w-3 h-3" /> Add Field Update
                </Button>
              </div>
            )}

            {/* Execute Button */}
            <Button
              className="w-full h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm transition-all"
              onClick={handleApplyUpdate}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Apply State Update & Run Reducers</span>
            </Button>
          </div>

          {/* Simulation Result & Reducer Trace Breakdown */}
          {lastSimulationResult && (
            <div className="flex flex-col gap-2.5 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/25">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-foreground text-xs">
                    Reducer Execution Trace & State Transition
                  </span>
                </div>
                <Badge
                  variant="secondary"
                  className="text-[9px] bg-emerald-500/20 text-emerald-300 font-mono"
                >
                  {lastSimulationResult.channelResults.filter((r) => r.status === "updated").length} updated
                </Badge>
              </div>

              {/* Unmatched Payload Warning */}
              {lastSimulationResult.unmatchedPayloadKeys.length > 0 && (
                <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Warning: Incoming update returned keys not defined in State Channels:{" "}
                    <strong>
                      {lastSimulationResult.unmatchedPayloadKeys.join(", ")}
                    </strong>
                  </span>
                </div>
              )}

              {/* Channel-by-channel diff cards */}
              <div className="flex flex-col gap-2">
                {lastSimulationResult.channelResults.map((r) => (
                  <div
                    key={r.channelKey}
                    className={`flex flex-col gap-1.5 p-2 rounded border text-xs font-mono ${
                      r.status === "updated"
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : r.status === "error"
                          ? "bg-destructive/10 border-destructive/30"
                          : "bg-muted/15 border-border/40 opacity-70"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-foreground">
                          {r.channelKey}
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-[9px] h-3.5 px-1 py-0 bg-blue-500/20 text-blue-300 border-0"
                        >
                          {r.reducerName}
                        </Badge>
                        {r.status === "updated" && (
                          <Badge
                            variant="secondary"
                            className="text-[8px] h-3.5 px-1 py-0 bg-emerald-500/20 text-emerald-300 border-0"
                          >
                            UPDATED
                          </Badge>
                        )}
                        {r.status === "unchanged" && (
                          <span className="text-[9px] text-muted-foreground font-sans">
                            (No incoming update)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-mono">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{r.durationMs.toFixed(2)}ms</span>
                      </div>
                    </div>

                    {r.status === "error" && r.error && (
                      <div className="text-[10px] text-destructive flex items-center gap-1 font-mono">
                        <AlertCircle className="w-3 h-3" />
                        <span>Reducer Error: {r.error}</span>
                      </div>
                    )}

                    {r.status === "updated" && (
                      <div className="grid grid-cols-2 gap-2 text-[10px] mt-1 pt-1 border-t border-border/30">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] text-muted-foreground font-sans font-semibold">
                            Incoming Payload:
                          </span>
                          <pre className="p-1 rounded bg-background/50 border border-border/30 overflow-x-auto text-blue-300">
                            {JSON.stringify(r.updateValue, null, 2)}
                          </pre>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] text-muted-foreground font-sans font-semibold">
                            Merged Result:
                          </span>
                          <pre className="p-1 rounded bg-background/50 border border-border/30 overflow-x-auto text-emerald-300">
                            {JSON.stringify(r.nextValue, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* State Timeline / History (Time Travel) */}
          <div className="flex flex-col gap-2 p-3 rounded-lg bg-card border border-border/70 shadow-sm">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setShowHistory((prev) => !prev)}
            >
              <div className="flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-purple-400" />
                <span className="font-bold text-foreground text-xs">
                  State Change History (Time Travel)
                </span>
                <Badge
                  variant="outline"
                  className="text-[9px] h-4 font-mono text-purple-300 border-purple-500/30"
                >
                  {stepHistory.length} steps
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                {showHistory ? (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
            </div>

            {showHistory && (
              <div className="flex flex-col gap-1.5 mt-1">
                {stepHistory.map((step, idx) => {
                  const isActive = step.id === activeStepId;
                  return (
                    <div
                      key={step.id}
                      className={`flex items-center justify-between p-2 rounded text-xs font-mono transition-colors ${
                        isActive
                          ? "bg-purple-500/15 border border-purple-500/40 text-purple-200"
                          : "bg-muted/20 border border-border/40 text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-bold text-foreground">
                          #{idx}
                        </span>
                        <span className="truncate">{step.label}</span>
                        {isActive && (
                          <Badge
                            variant="secondary"
                            className="text-[8px] h-3 px-1 bg-purple-500/30 text-purple-200 border-0"
                          >
                            Active
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!isActive && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[10px] gap-1 text-purple-300 hover:text-purple-100"
                            onClick={() => handleRevertToStep(step.id)}
                            title="Revert state to this step"
                          >
                            <Undo2 className="w-3 h-3" />
                            <span>Revert</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODE 2: REDUCER PLAYGROUND (UNIT TESTING)
         ══════════════════════════════════════════════════════════════ */}
      {testingSubMode === "playground" && (
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
                setSelectedReducer(val);
                const matched = customReducers.find(
                  (r) => r.name === val || r.id === val,
                );
                if (matched) {
                  setCustomPlaygroundCode(matched.code);
                }
                const preset = REDUCER_PRESETS[val];
                if (preset && preset[0]) {
                  setPrevInput(JSON.stringify(preset[0].prev, null, 2));
                  setNextInput(JSON.stringify(preset[0].next, null, 2));
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
            {REDUCER_PRESETS[selectedReducer] && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] text-muted-foreground font-semibold">
                  Test Scenarios:
                </span>
                {REDUCER_PRESETS[selectedReducer].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPlaygroundPreset(preset)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/50 hover:bg-secondary text-secondary-foreground border border-border/50 hover:border-purple-500/40 transition-colors"
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
              <textarea
                value={prevInput}
                onChange={(e) => setPrevInput(e.target.value)}
                rows={5}
                className="w-full text-xs font-mono bg-background p-2 rounded border border-border focus:border-blue-500 focus:outline-none resize-y text-foreground"
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
                className="w-full text-xs font-mono bg-background p-2 rounded border border-border focus:border-emerald-500 focus:outline-none resize-y text-foreground"
                placeholder='[{"role": "assistant", "content": "hello"}]'
              />
            </div>
          </div>

          {/* Run Reducer Action */}
          <Button
            className="w-full h-8 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white gap-2 shadow-sm"
            onClick={handleRunPlayground}
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
                        handleCopy(
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
      )}
    </div>
  );
}
