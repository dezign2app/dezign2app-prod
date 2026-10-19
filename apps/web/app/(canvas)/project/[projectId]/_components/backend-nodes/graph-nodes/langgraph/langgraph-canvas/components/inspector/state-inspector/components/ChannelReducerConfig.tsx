import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Code2,
  Play,
  RotateCcw,
  Check,
  Info,
  Wand2,
  Sparkles,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Label } from "@workspace/ui/components/label";
import { LocalInput, LocalTextarea } from "../../../../../../common";
import {
  BUILT_IN_REDUCERS,
  REDUCER_CODE_PRESETS,
  getSuggestedReducerCodeForChannelType,
  extractActionsFromReducerCode,
  getActionMetadata,
} from "../constants";
import type { LangGraphStateChannel, LangGraphCustomReducer } from "@/types/canvas";

export interface ChannelReducerConfigProps {
  channel: LangGraphStateChannel;
  index: number;
  customReducers: LangGraphCustomReducer[];
  onUpdateField: (
    index: number,
    changes: Partial<LangGraphStateChannel>,
  ) => void;
  onTestChannel?: (channelKey: string, reducerName: string) => void;
  onAddCustomReducer?: (reducer: LangGraphCustomReducer) => void;
  onUpdateCustomReducer?: (
    idOrName: string,
    changes: Partial<LangGraphCustomReducer>,
  ) => void;
  onDeleteCustomReducer?: (idOrName: string) => void;
}

export function getBuiltInReducerCode(name: string): string {
  switch (name) {
    case "add_messages":
    case "add_message":
      return "(prev, next) => Array.isArray(prev) ? [...prev, ...(Array.isArray(next) ? next : [next])] : next";
    case "append":
    case "concat_array":
      return "(prev, next) => [...(Array.isArray(prev) ? prev : []), ...(Array.isArray(next) ? next : [next])]";
    case "merge_object":
      return "(prev, next) => ({ ...(prev || {}), ...(next || {}) })";
    case "replace":
    default:
      return "(prev, next) => next";
  }
}

export function ChannelReducerConfig({
  channel: ch,
  index: idx,
  customReducers,
  onUpdateField,
  onTestChannel,
  onAddCustomReducer,
  onUpdateCustomReducer,
}: ChannelReducerConfigProps) {
  const matchedCustom = useMemo(() => {
    return customReducers.find(
      (r) => r.name === ch.reducer || r.id === ch.reducer || r.targetField === ch.key,
    );
  }, [customReducers, ch.reducer, ch.key]);

  // Initial code computation: prefer existing code with action support, else suggest for type
  const resolveInitialCode = useCallback(() => {
    const raw = matchedCustom?.code || ch.customReducerCode;
    if (raw && raw.trim().length > 0 && raw.includes("action")) {
      return raw;
    }
    return getSuggestedReducerCodeForChannelType(ch.type);
  }, [matchedCustom?.code, ch.customReducerCode, ch.type]);

  const [customName, setCustomName] = useState<string>(
    matchedCustom?.name ||
      (ch.reducer && !BUILT_IN_REDUCERS.some((r) => r.name === ch.reducer)
        ? ch.reducer
        : `${ch.key || "var"}_reducer`),
  );
  const [customCode, setCustomCode] = useState<string>(resolveInitialCode());
  const [customDesc, setCustomDesc] = useState<string>(
    matchedCustom?.description || "",
  );
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Live auto-detected actions extracted from the current reducer code
  const detectedActions = useMemo(() => {
    const actions = extractActionsFromReducerCode(customCode);
    return actions.map((act) => getActionMetadata(act, ch.type));
  }, [customCode, ch.type]);

  // Auto-migrate legacy or empty reducer code to the action-aware template
  useEffect(() => {
    const raw = matchedCustom?.code || ch.customReducerCode;
    if (!raw || !raw.includes("action")) {
      const suggested = getSuggestedReducerCodeForChannelType(ch.type);
      setCustomCode(suggested);
      const newName =
        matchedCustom?.name ||
        (ch.reducer && !BUILT_IN_REDUCERS.some((r) => r.name === ch.reducer)
          ? ch.reducer
          : `${ch.key || "var"}_reducer`);
      setCustomName(newName);
      onUpdateField(idx, {
        reducer: newName,
        customReducerCode: suggested,
      });
      if (matchedCustom && onUpdateCustomReducer) {
        onUpdateCustomReducer(matchedCustom.id, {
          code: suggested,
          targetField: ch.key,
        });
      }
    } else {
      setCustomCode(raw);
      if (matchedCustom?.name) {
        setCustomName(matchedCustom.name);
      }
      if (matchedCustom?.description) {
        setCustomDesc(matchedCustom.description);
      }
    }
  }, [
    ch.customReducerCode,
    ch.key,
    ch.reducer,
    ch.type,
    idx,
    matchedCustom,
    onUpdateCustomReducer,
    onUpdateField,
  ]);

  // Apply a preset template
  const handleApplyPreset = useCallback(
    (presetCode: string) => {
      setCustomCode(presetCode);
      const targetName = customName || `${ch.key || "var"}_reducer`;
      onUpdateField(idx, {
        reducer: targetName,
        customReducerCode: presetCode,
      });

      if (matchedCustom && onUpdateCustomReducer) {
        onUpdateCustomReducer(matchedCustom.id, {
          name: targetName,
          code: presetCode,
          targetField: ch.key,
        });
      } else if (onAddCustomReducer) {
        onAddCustomReducer({
          id: `custom_${Date.now().toString(36)}`,
          name: targetName,
          code: presetCode,
          description: `Reducer for ${ch.key || "state variable"}`,
          targetField: ch.key,
        });
      }

      setSaveSuccess(true);
      const timer = setTimeout(() => setSaveSuccess(false), 1500);
      return () => clearTimeout(timer);
    },
    [
      customName,
      ch.key,
      idx,
      onUpdateField,
      matchedCustom,
      onUpdateCustomReducer,
      onAddCustomReducer,
    ],
  );

  // Handle textarea change
  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCustomCode(newCode);
      const targetName = customName || `${ch.key || "var"}_reducer`;
      onUpdateField(idx, {
        reducer: targetName,
        customReducerCode: newCode,
      });
      if (matchedCustom && onUpdateCustomReducer) {
        onUpdateCustomReducer(matchedCustom.id, {
          code: newCode,
          targetField: ch.key,
        });
      }
    },
    [customName, ch.key, idx, onUpdateField, matchedCustom, onUpdateCustomReducer],
  );

  return (
    <div className="flex flex-col gap-2.5 pt-1">
      {saveSuccess && (
        <div className="flex items-center justify-end">
          <span className="text-emerald-400 flex items-center gap-0.5 text-[9px] font-medium animate-in fade-in">
            <Check className="w-3 h-3" /> Template Applied!
          </span>
        </div>
      )}

      {/* ── Reducer Function Name ── */}
      <div className="flex flex-col gap-1">
        <Label className="text-[9px] text-muted-foreground font-mono">
          Reducer Name
        </Label>
        <LocalInput
          className="h-7 text-xs font-mono font-medium bg-background border-purple-500/30 focus-visible:ring-purple-500/40"
          placeholder={`${ch.key || "var"}_reducer`}
          value={customName}
          onChange={(e) => {
            const val = e.target.value;
            setCustomName(val);
            onUpdateField(idx, { reducer: val });
            if (matchedCustom && onUpdateCustomReducer) {
              onUpdateCustomReducer(matchedCustom.id, {
                name: val,
                targetField: ch.key,
              });
            }
          }}
        />
      </div>

      {/* ── Action Presets / Quick Templates ── */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <Label className="text-[9px] text-muted-foreground font-mono flex items-center gap-1">
            <Wand2 className="w-2.5 h-2.5 text-purple-400" />
            Action Templates for {ch.type || "variable"}
          </Label>
          <div className="flex items-center gap-1 flex-wrap">
            {ch.type === "number" && (
              <>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(REDUCER_CODE_PRESETS.number)}
                  className="text-[8px] px-1.5 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 font-mono transition-colors cursor-pointer border border-purple-500/40 font-semibold"
                  title="Supports next.action: replace, increment, decrement, reset, default"
                >
                  ⚡ Actions (inc/dec/reset/replace)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyPreset(`(prev, next) => {
  const current = typeof prev === "number" ? prev : 0;
  const action = next?.action;

  // 1. Default update: sum incoming delta
  if (!action || action === "" || action === "default") {
    const val = typeof next === "number" ? next : (next?.value ?? 0);
    return current + val;
  }

  // 2. Action: replace
  if (action === "replace") {
    return typeof next?.value === "number" ? next.value : (typeof next === "number" ? next : current);
  }

  return current;
}`)
                  }
                  className="text-[8px] px-1.5 py-0.5 rounded bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 font-mono transition-colors cursor-pointer border border-purple-500/30"
                  title="Sum incoming numbers with action === replace support"
                >
                  ⚡ Sum (prev + next)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyPreset(`(prev, next) => {
  const action = next?.action;
  // Overwrites current value with incoming
  if (action === "replace" || !action || action === "" || action === "default") {
    return typeof next?.value === "number" ? next.value : (typeof next === "number" ? next : prev);
  }
  return prev;
}`)
                  }
                  className="text-[8px] px-1.5 py-0.5 rounded bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 font-mono transition-colors cursor-pointer border border-purple-500/30"
                  title="Last value overwrites previous"
                >
                  ⚡ Replace Only
                </button>
              </>
            )}

            {(ch.type === "messages" || ch.type === "array") && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyPreset(
                      ch.type === "messages"
                        ? REDUCER_CODE_PRESETS.chat
                        : REDUCER_CODE_PRESETS.array,
                    )
                  }
                  className="text-[8px] px-1.5 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 font-mono transition-colors cursor-pointer border border-purple-500/40 font-semibold"
                  title="Supports next.action: replace, clear/reset, default append"
                >
                  ⚡ Actions (append/replace/clear)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyPreset(`(prev, next) => {
  const action = next?.action;
  const prevArr = Array.isArray(prev) ? prev : [];

  // 1. Default update: append items
  if (!action || action === "" || action === "default") {
    const incoming = next?.value !== undefined ? next.value : next;
    return [...prevArr, ...(Array.isArray(incoming) ? incoming : (incoming != null ? [incoming] : []))];
  }

  // 2. Action: replace
  if (action === "replace") {
    const incoming = next?.value !== undefined ? next.value : next;
    return Array.isArray(incoming) ? incoming : (incoming != null ? [incoming] : []);
  }

  return prevArr;
}`)
                  }
                  className="text-[8px] px-1.5 py-0.5 rounded bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 font-mono transition-colors cursor-pointer border border-purple-500/30"
                  title="Append items with action === replace support"
                >
                  ⚡ Append Only
                </button>
              </>
            )}

            {ch.type === "object" && (
              <>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(REDUCER_CODE_PRESETS.object)}
                  className="text-[8px] px-1.5 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 font-mono transition-colors cursor-pointer border border-purple-500/40 font-semibold"
                  title="Supports next.action: replace, reset/clear, default merge"
                >
                  ⚡ Actions (merge/replace/reset)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyPreset(`(prev, next) => {
  const current = (prev && typeof prev === "object" && !Array.isArray(prev)) ? prev : {};
  const action = next?.action;

  if (!action || action === "" || action === "default") {
    const incoming = (next?.value && typeof next.value === "object") ? next.value : (next && typeof next === "object" ? next : {});
    return { ...current, ...incoming };
  }

  if (action === "replace") {
    return (next?.value && typeof next.value === "object") ? next.value : (next && typeof next === "object" ? next : {});
  }

  return current;
}`)
                  }
                  className="text-[8px] px-1.5 py-0.5 rounded bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 font-mono transition-colors cursor-pointer border border-purple-500/30"
                  title="Shallow merge dictionary keys"
                >
                  ⚡ Shallow Merge
                </button>
              </>
            )}

            {ch.type === "string" && (
              <button
                type="button"
                onClick={() => handleApplyPreset(REDUCER_CODE_PRESETS.string)}
                className="text-[8px] px-1.5 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 font-mono transition-colors cursor-pointer border border-purple-500/40 font-semibold"
                title="Supports next.action: replace, clear/reset, default concat"
              >
                ⚡ Actions (concat/replace/clear)
              </button>
            )}

            {ch.type === "boolean" && (
              <button
                type="button"
                onClick={() => handleApplyPreset(REDUCER_CODE_PRESETS.boolean)}
                className="text-[8px] px-1.5 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 font-mono transition-colors cursor-pointer border border-purple-500/40 font-semibold"
                title="Supports next.action: replace, toggle, reset, default"
              >
                ⚡ Actions (toggle/replace/reset)
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                handleApplyPreset(getSuggestedReducerCodeForChannelType(ch.type))
              }
              className="text-[8px] px-1.5 py-0.5 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground font-mono transition-colors cursor-pointer flex items-center gap-0.5"
              title="Reset code to suggested default action template for this type"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* ── Code Editor Textarea ── */}
        <LocalTextarea
          className="min-h-[220px] text-xs font-mono bg-background leading-relaxed p-2.5 border-purple-500/30 focus-visible:ring-purple-500/40 resize-y"
          placeholder="(prev, next) => next"
          value={customCode}
          onChange={(e) => handleCodeChange(e.target.value)}
          debounceMs={150}
        />

        {/* ── Auto-Detected Actions Live Validation Box ── */}
        <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-purple-500/[0.07] border border-purple-500/25 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-purple-300 font-mono text-[10px] font-semibold">
              <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
              <span>Auto-Detected Actions ({detectedActions.length})</span>
            </div>
            <span className="text-[9px] text-muted-foreground font-mono">
              Live extracted from reducer code
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {/* Always display default / direct update badge first */}
            <Badge
              variant="outline"
              className="text-[9px] font-mono px-2 py-0.5 border border-purple-500/40 bg-purple-500/10 text-purple-200"
              title="Default update: passes value directly when action is empty or default"
            >
              <span className="font-semibold">default</span>
              <span className="ml-1 text-[8px] opacity-70">(direct)</span>
            </Badge>

            {detectedActions.map((act) => (
              <Badge
                key={act.action}
                variant="outline"
                className={`text-[9px] font-mono px-2 py-0.5 border transition-colors ${
                  act.requiresValue
                    ? "border-blue-500/40 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                }`}
                title={act.description}
              >
                <span className="font-semibold">⚡ {act.action}</span>
                <span className="ml-1 text-[8px] opacity-75">
                  {act.requiresValue ? "(value)" : "(no value)"}
                </span>
              </Badge>
            ))}
          </div>

          {detectedActions.length === 0 && (
            <p className="text-[9px] text-muted-foreground font-mono italic">
              No custom action branches detected. Standard updates will pass directly to the reducer.
            </p>
          )}
        </div>
      </div>

      {/* ── Explanation Banner: How Nodes Dispatch ── */}
      <div className="flex flex-col gap-1 p-2 rounded-lg bg-purple-500/[0.05] border border-purple-500/20 text-xs">
        <div className="flex items-center gap-1.5 text-purple-300 font-mono text-[10px] font-semibold">
          <Info className="w-3 h-3 text-purple-400 shrink-0" />
          <span>How graph nodes update this state variable:</span>
        </div>
        <div className="grid grid-cols-1 gap-1 text-[9px] font-mono text-muted-foreground pt-0.5">
          <div className="flex items-start gap-1">
            <span className="text-purple-400 shrink-0">•</span>
            <span>
              <strong className="text-foreground">Default update:</strong> Node returns{" "}
              <code className="text-purple-300 bg-background/60 px-1 py-0.5 rounded">
                {"{"} {ch.key || "var"}: {ch.type === "number" ? 1 : ch.type === "messages" ? "[newMsg]" : "value"} {"}"}
              </code>{" "}
              (executes <code className="text-purple-300">!action || action === &quot;default&quot;</code>)
            </span>
          </div>
          <div className="flex items-start gap-1">
            <span className="text-purple-400 shrink-0">•</span>
            <span>
              <strong className="text-foreground">Action dispatch:</strong> Node returns{" "}
              <code className="text-purple-300 bg-background/60 px-1 py-0.5 rounded">
                {"{"} {ch.key || "var"}: {"{"} action: &quot;replace&quot;, value: ... {"}"} {"}"}
              </code>{" "}
              or{" "}
              <code className="text-purple-300 bg-background/60 px-1 py-0.5 rounded">
                {"{"} {ch.key || "var"}: {"{"} action: &quot;{ch.type === "number" ? "increment" : ch.type === "messages" ? "clear" : "reset"}&quot;{"}"} {"}"}
              </code>
            </span>
          </div>
        </div>
      </div>

      {/* ── Description (Optional) ── */}
      <div className="flex flex-col gap-1">
        <Label className="text-[9px] text-muted-foreground font-mono">
          Description (optional)
        </Label>
        <LocalInput
          className="h-7 text-xs bg-background"
          placeholder={`e.g. Handles actions and updates for ${ch.key || "state"}`}
          value={customDesc}
          onChange={(e) => {
            const val = e.target.value;
            setCustomDesc(val);
            if (matchedCustom && onUpdateCustomReducer) {
              onUpdateCustomReducer(matchedCustom.id, {
                description: val,
              });
            }
          }}
        />
      </div>
    </div>
  );
}
