import React, { useMemo } from "react";
import {
  Zap,
  Plus,
  Trash2,
  RefreshCw,
  Sparkles,
  FileJson,
  Layers,
  Code2,
  Info,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Shuffle,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { LocalInput } from "../../../../../common";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from "@workspace/ui/components/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import type {
  LangGraphStateChannel,
  LangGraphCustomReducer,
  AgentNodeData,
  LangGraphStateUpdateItem,
  StateUpdateSource,
} from "@workspace/canvas";
import type { Parameter } from "@/types/canvas";
import { parseSchemaJsonToFields } from "./AgentStructuredOutputSection";

interface AgentStateUpdatesSectionProps {
  selectedAgentData: AgentNodeData;
  onUpdateAgent: (changes: Partial<AgentNodeData>) => void;
  stateChannels?: LangGraphStateChannel[];
  customReducers?: LangGraphCustomReducer[];
  embedded?: boolean;
}

import {
  extractActionsFromReducerCode,
  isValuelessAction,
  getActionsForReducer,
  getActionMetadata,
  type ReducerActionMeta,
} from "../state-inspector/constants";

export {
  extractActionsFromReducerCode,
  isValuelessAction,
  getActionsForReducer,
  getActionMetadata,
};
export type { ReducerActionMeta };

export function AgentStateUpdatesSection({
  selectedAgentData,
  onUpdateAgent,
  stateChannels = [],
  customReducers = [],
  embedded = false,
}: AgentStateUpdatesSectionProps) {
  const stateUpdates: LangGraphStateUpdateItem[] =
    selectedAgentData.stateUpdates || [];

  const [customActionIdxs, setCustomActionIdxs] = React.useState<
    Record<number, boolean>
  >({});

  const isStructured = Boolean(selectedAgentData.responseFormat?.enabled);
  const schemaJson = selectedAgentData.responseFormat?.schemaJson || "";

  // Parse structured output fields if enabled
  const schemaFields: Parameter[] = useMemo(() => {
    if (!isStructured || !schemaJson.trim()) return [];
    return parseSchemaJsonToFields(schemaJson).fields;
  }, [isStructured, schemaJson]);

  // Extract pipeline transformer steps
  const transformerSteps = useMemo(() => {
    const pSteps = selectedAgentData.pipelineSteps || [];
    return pSteps.filter(
      (s) => s.type === "transformer" || s.type === "transform",
    );
  }, [selectedAgentData.pipelineSteps]);

  // Helper to get channel details and its active reducer
  const getChannelMeta = (channelKey: string) => {
    const channel = stateChannels.find((c) => c.key === channelKey);
    const channelType = channel?.type || "string";
    const reducerName =
      channel?.reducer ||
      (channelType === "messages" ? "add_messages" : "replace");

    const matchedCustom = customReducers.find(
      (r) => r.name === reducerName || r.id === reducerName || r.targetField === channelKey,
    );

    return {
      channel,
      type: channelType,
      reducer: reducerName,
      isCustom: Boolean(matchedCustom),
      customCode: matchedCustom?.code || channel?.customReducerCode,
      description: matchedCustom?.description,
    };
  };

  // Find unmapped schema fields
  const unmappedSchemaFields = useMemo(() => {
    if (!isStructured || schemaFields.length === 0) return [];
    return schemaFields.filter(
      (f) =>
        !stateUpdates.some(
          (su) =>
            su.source === "structured_field" &&
            (su.schemaField === f.name || su.value === f.name),
        ),
    );
  }, [isStructured, schemaFields, stateUpdates]);

  // Auto-map matching schema fields to channels with identical or similar names
  const handleAutoMap = () => {
    const nextUpdates: LangGraphStateUpdateItem[] = [...stateUpdates];
    let addedCount = 0;

    for (const f of schemaFields) {
      if (!f.name?.trim()) continue;
      const cleanFieldName = f.name.trim();

      const alreadyMapped = nextUpdates.some(
        (su) =>
          su.source === "structured_field" &&
          (su.schemaField === cleanFieldName || su.value === cleanFieldName),
      );
      if (alreadyMapped) continue;

      const matchedChannel = stateChannels.find(
        (c) =>
          c.key.toLowerCase() === cleanFieldName.toLowerCase() ||
          c.key.toLowerCase().replace(/_/g, "") ===
            cleanFieldName.toLowerCase().replace(/_/g, ""),
      );

      if (matchedChannel) {
        const existingIdx = nextUpdates.findIndex(
          (u) => u.channelKey === matchedChannel.key,
        );
        const newItem: LangGraphStateUpdateItem = {
          channelKey: matchedChannel.key,
          reducer: matchedChannel.reducer || "replace",
          action: "replace",
          source: "structured_field",
          schemaField: cleanFieldName,
          mode: "set",
          value: cleanFieldName,
        };

        if (existingIdx >= 0) {
          nextUpdates[existingIdx] = newItem;
        } else {
          nextUpdates.push(newItem);
        }
        addedCount++;
      }
    }

    if (addedCount > 0) {
      onUpdateAgent({ stateUpdates: nextUpdates });
    }
  };

  // Map all remaining schema fields into available channels
  const handleMapAll = () => {
    const nextUpdates: LangGraphStateUpdateItem[] = [...stateUpdates];

    for (const f of schemaFields) {
      if (!f.name?.trim()) continue;
      const cleanFieldName = f.name.trim();

      const alreadyMapped = nextUpdates.some(
        (su) =>
          su.source === "structured_field" &&
          (su.schemaField === cleanFieldName || su.value === cleanFieldName),
      );
      if (alreadyMapped) continue;

      const targetChannel =
        stateChannels.find((c) => c.key === cleanFieldName) ||
        stateChannels.find(
          (c) => !nextUpdates.some((u) => u.channelKey === c.key),
        ) ||
        stateChannels[0];

      if (targetChannel) {
        nextUpdates.push({
          channelKey: targetChannel.key,
          reducer: targetChannel.reducer || "replace",
          action: "replace",
          source: "structured_field",
          schemaField: cleanFieldName,
          mode: "set",
          value: cleanFieldName,
        });
      }
    }

    onUpdateAgent({ stateUpdates: nextUpdates });
  };

  // Quick add a mapping row for a specific schema field
  const handleAddSchemaFieldUpdate = (fieldName: string) => {
    const matchedChannel =
      stateChannels.find(
        (c) => c.key.toLowerCase() === fieldName.toLowerCase(),
      ) ||
      stateChannels.find(
        (c) => !stateUpdates.some((u) => u.channelKey === c.key),
      ) ||
      stateChannels[0];

    const defaultKey = matchedChannel?.key || fieldName;
    const defaultReducer = matchedChannel?.reducer || "replace";

    onUpdateAgent({
      stateUpdates: [
        ...stateUpdates,
        {
          channelKey: defaultKey,
          reducer: defaultReducer,
          action: "replace",
          source: "structured_field",
          schemaField: fieldName,
          mode: "set",
          value: fieldName,
        },
      ],
    });
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className={
          embedded
            ? "flex flex-col gap-3"
            : "flex flex-col gap-3 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm"
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Graph State Updates
            </span>
            <span className="text-[10px] text-muted-foreground">
              Mutate channels returned by this node via their configured reducers
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-border gap-1 cursor-pointer"
            onClick={() => {
              const defaultChannel =
                stateChannels.find((c) => c.key !== "messages") ||
                stateChannels[0];
              const defaultKey = defaultChannel?.key || "status";
              const defaultReducer = defaultChannel?.reducer || "replace";
              const defaultSource: StateUpdateSource =
                isStructured && schemaFields.length > 0
                  ? "structured_field"
                  : "message_content";
              const defaultField = schemaFields[0]?.name || "";

              onUpdateAgent({
                stateUpdates: [
                  ...stateUpdates,
                  {
                    channelKey: defaultKey,
                    reducer: defaultReducer,
                    action: "default",
                    source: defaultSource,
                    schemaField: defaultField,
                    mode: "set",
                    value: defaultField,
                  },
                ],
              });
            }}
          >
            <Plus className="w-3.5 h-3.5" /> Add Update
          </Button>
        </div>

        {/* Structured Output Schema Preview Banner */}
        {isStructured && (
          <div className="flex flex-col gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 p-2.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-purple-300 font-semibold text-[11px]">
                <FileJson className="w-3.5 h-3.5 text-purple-400" />
                <span>Structured Output Schema Active</span>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 h-4 border-purple-500/40 text-purple-300 font-mono"
                >
                  {schemaFields.length} fields
                </Badge>
              </div>

              {schemaFields.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] text-purple-300 hover:text-purple-100 hover:bg-purple-500/20 gap-1 cursor-pointer"
                    onClick={handleAutoMap}
                    title="Auto-match schema fields to state channels by name"
                  >
                    <RefreshCw className="w-3 h-3 text-purple-400" />
                    Auto-Map
                  </Button>
                  <span className="text-purple-400/40 text-[10px]">•</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] text-purple-300 hover:text-purple-100 hover:bg-purple-500/20 gap-1 cursor-pointer"
                    onClick={handleMapAll}
                    title="Map all schema fields into channels"
                  >
                    Map All
                  </Button>
                </div>
              )}
            </div>

            {schemaFields.length > 0 ? (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {schemaFields.map((f) => (
                  <span
                    key={f.name}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-background/80 border border-purple-500/30 text-purple-200"
                  >
                    <span className="font-semibold text-purple-300">
                      {f.name}
                    </span>
                    <span className="text-[8px] text-muted-foreground">
                      :{f.type || "string"}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-purple-300/80 italic">
                No schema properties defined yet. Configure fields in Structured Output below.
              </span>
            )}
          </div>
        )}

        {/* Mapping Rows Header: 1. State Channel | 2. Action | 3. New Value / Mapping */}
        {stateUpdates.length > 0 && (
          <div className="flex items-center justify-between px-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
            <span className="flex-1 min-w-[130px]">1. State Channel</span>
            <span className="w-[135px] px-1">2. Reducer Action</span>
            <span className="flex-1 min-w-[140px] pl-3">3. New Value / Mapping</span>
            <span className="w-7 text-right"></span>
          </div>
        )}

        {/* State Updates List */}
        {stateUpdates.map((su: LangGraphStateUpdateItem, sIdx: number) => {
          const channelMeta = getChannelMeta(su.channelKey);
          const currentSource: StateUpdateSource =
            su.source ||
            (isStructured && su.schemaField
              ? "structured_field"
              : su.mode === "expression"
                ? "expression"
                : "message_content");

          const matchedSchemaField = schemaFields.find(
            (f) => f.name === (su.schemaField || su.value),
          );

          // Type mismatch check
          const hasTypeMismatch = Boolean(
            currentSource === "structured_field" &&
              matchedSchemaField &&
              channelMeta.type !== "json" &&
              channelMeta.type !== "object" &&
              matchedSchemaField.type &&
              !matchedSchemaField.type.startsWith(channelMeta.type) &&
              !(
                channelMeta.type === "array" &&
                matchedSchemaField.type.endsWith("[]")
              ),
          );

          // Available actions for this channel and reducer
          const availableActions = getActionsForReducer(
            channelMeta.type,
            channelMeta.reducer,
            channelMeta.customCode,
          );

          const isCustomActionActive =
            Boolean(customActionIdxs[sIdx]) ||
            (Boolean(su.action) &&
              su.action !== "default" &&
              !availableActions.some((a) => a.action === su.action));

          const currentActionMeta = availableActions.find(
            (a) => a.action === (su.action || "default"),
          );

          const isValueless =
            su.source === "none" ||
            isValuelessAction(su.action) ||
            currentActionMeta?.requiresValue === false;

          // Format value description for preview
          const valueDisplay =
            currentSource === "structured_field"
              ? `structuredResponse.${su.schemaField || su.value}`
              : currentSource === "structured_full"
                ? `full structuredResponse`
                : currentSource === "message_content"
                  ? `response.content`
                  : currentSource === "message_object"
                    ? `AIMessage`
                    : currentSource === "expression"
                      ? (su.value || "(empty expr)")
                      : currentSource === "literal"
                        ? JSON.stringify(su.value || "")
                        : (su.value || "value");

          return (
            <div
              key={sIdx}
              className="flex flex-col gap-2 p-2.5 rounded-lg border bg-background/50 text-xs shadow-xs transition-colors hover:border-border/80"
            >
              {/* Top Controls: Channel & Reducer | Action | Arrow | Source | Delete */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 min-w-0">
                {/* 1. Target Channel & Reducer */}
                <div className="flex-1 min-w-[130px] flex items-center gap-1 min-w-0">
                  <Select
                    value={su.channelKey}
                    onValueChange={(v: string) => {
                      const updated = [...stateUpdates];
                      const current = updated[sIdx];
                      if (current) {
                        const chMeta = getChannelMeta(v);
                        updated[sIdx] = {
                          ...current,
                          channelKey: v,
                          reducer: chMeta.reducer,
                          action: "default",
                        };
                        onUpdateAgent({ stateUpdates: updated });
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs bg-background font-mono flex-1 min-w-0 px-2" title="Select State Channel & Reducer">
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground">
                          State Channels &amp; Reducers
                        </SelectLabel>
                        {stateChannels
                          .filter((ch: LangGraphStateChannel) =>
                            Boolean(ch.key?.trim()),
                          )
                          .map((ch: LangGraphStateChannel) => (
                            <SelectItem key={ch.key} value={ch.key}>
                              <div className="flex items-center gap-1.5 font-mono">
                                <span className="font-semibold text-foreground">
                                  {ch.key}
                                </span>
                                <span className="text-[10px] text-sky-400">
                                  ({ch.reducer || "replace"})
                                </span>
                                <span className="text-[9px] text-muted-foreground font-sans">
                                  [{ch.type}]
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        {!stateChannels.some(
                          (c: LangGraphStateChannel) => c.key === su.channelKey,
                        ) &&
                          su.channelKey && (
                            <SelectItem value={su.channelKey}>
                              <span className="font-mono font-semibold">
                                {su.channelKey}
                              </span>
                            </SelectItem>
                          )}
                      </SelectGroup>

                      {customReducers.length > 0 && (
                        <>
                          <SelectSeparator />
                          <SelectGroup>
                            <SelectLabel className="text-[10px] uppercase font-bold text-purple-400">
                              Custom Reducers (@langgraphstateconfig)
                            </SelectLabel>
                            {customReducers.map((cr) => (
                              <SelectItem
                                key={cr.id}
                                value={cr.targetField || cr.name}
                              >
                                <div className="flex items-center gap-1.5 font-mono text-purple-300">
                                  <Code2 className="w-3 h-3 text-purple-400" />
                                  <span className="font-semibold">{cr.name}</span>
                                  {cr.targetField && (
                                    <span className="text-[9px] text-muted-foreground font-sans">
                                      ➔ {cr.targetField}
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </>
                      )}
                    </SelectContent>
                  </Select>

                  {/* Reducer Indicator Badge */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="shrink-0 cursor-help">
                        {channelMeta.isCustom ? (
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1.5 py-0 h-5 bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono font-medium flex items-center gap-1"
                          >
                            <Code2 className="w-2.5 h-2.5 text-purple-400" />
                            {channelMeta.reducer}
                          </Badge>
                        ) : channelMeta.reducer === "add_messages" ? (
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1.5 py-0 h-5 bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono"
                          >
                            add_messages
                          </Badge>
                        ) : channelMeta.reducer === "append" ||
                          channelMeta.reducer === "concat_array" ? (
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1.5 py-0 h-5 bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono"
                          >
                            append
                          </Badge>
                        ) : channelMeta.reducer === "merge_object" ? (
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1.5 py-0 h-5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono"
                          >
                            merge_obj
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 h-5 text-sky-400 border-sky-500/30 font-mono"
                          >
                            replace
                          </Badge>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-[280px] p-2 text-xs font-mono"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-foreground">
                          Reducer: {channelMeta.reducer}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-sans">
                          {channelMeta.description ||
                            (channelMeta.isCustom
                              ? "Custom reducer function defined in @langgraphstateconfig"
                              : channelMeta.reducer === "add_messages"
                                ? "Deduplicates by ID and appends messages"
                                : channelMeta.reducer === "append" ||
                                    channelMeta.reducer === "concat_array"
                                  ? "Concatenates array payload to existing channel"
                                  : channelMeta.reducer === "merge_object"
                                    ? "Merges object properties into existing state"
                                    : "Replaces channel value with node output")}
                        </span>
                        {channelMeta.customCode && (
                          <code className="text-[9px] bg-background/80 p-1 rounded border border-border/50 text-purple-200 whitespace-pre-wrap max-h-24 overflow-y-auto">
                            {channelMeta.customCode}
                          </code>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* 2. Reducer Action Selector */}
                <div className="w-[135px] shrink-0">
                  <Select
                    value={
                      isCustomActionActive
                        ? "__custom__"
                        : (su.action || "default")
                    }
                    onValueChange={(val: string) => {
                      const updated = [...stateUpdates];
                      const current = updated[sIdx];
                      if (!current) return;

                      if (val === "__custom__") {
                        setCustomActionIdxs((prev) => ({
                          ...prev,
                          [sIdx]: true,
                        }));
                      } else {
                        setCustomActionIdxs((prev) => {
                          const next = { ...prev };
                          delete next[sIdx];
                          return next;
                        });

                        const actMeta = availableActions.find((a) => a.action === val);
                        const isActionValueless =
                          isValuelessAction(val) || actMeta?.requiresValue === false;

                        if (isActionValueless) {
                          updated[sIdx] = {
                            ...current,
                            action: val,
                            source: "none",
                            value: undefined,
                            schemaField: undefined,
                          };
                        } else {
                          let nextValue = current.value;
                          let nextSource = current.source === "none" ? undefined : current.source;
                          let nextField = current.schemaField;
                          if (!nextSource) {
                            if (isStructured && schemaFields.length > 0) {
                              nextSource = "structured_field";
                              nextField = schemaFields[0]?.name;
                              nextValue = nextField;
                            } else {
                              nextSource =
                                channelMeta.type === "messages"
                                  ? "message_object"
                                  : "message_content";
                              nextValue =
                                channelMeta.type === "messages"
                                  ? "response"
                                  : "response.content";
                            }
                          }
                          if (val === "increment" || val === "decrement") {
                            if (!nextValue || nextValue === "response.content") {
                              nextValue = "1";
                              nextSource = "expression";
                            }
                          }

                          updated[sIdx] = {
                            ...current,
                            action: val,
                            value: nextValue,
                            source: nextSource,
                            schemaField: nextField,
                          };
                        }
                        onUpdateAgent({ stateUpdates: updated });
                      }
                    }}
                  >
                    <SelectTrigger
                      className="h-7 text-xs bg-background font-mono px-2"
                      title="Select Action for this Reducer"
                    >
                      <SelectValue placeholder="Action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel className="text-[10px] uppercase font-bold text-amber-400">
                          Reducer Actions
                        </SelectLabel>
                        {availableActions.map((act) => (
                          <SelectItem
                            key={act.action}
                            value={act.action}
                            className="font-mono text-xs"
                          >
                            <span className="font-semibold text-amber-300">
                              {act.label}
                            </span>
                          </SelectItem>
                        ))}
                        <SelectSeparator />
                        <SelectItem
                          value="__custom__"
                          className="text-xs italic text-primary font-mono"
                        >
                          + Custom action...
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                {/* Arrow Connector */}
                <div className="flex items-center justify-center text-muted-foreground/60 select-none px-0.5">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>

                {/* 3. Source & Field Selector (New Value) */}
                {isValueless ? (
                  <div className="flex-1 min-w-[130px] flex items-center justify-between gap-1.5 px-2.5 h-7 rounded-md bg-emerald-500/[0.08] border border-emerald-500/25 text-[10px] font-mono text-emerald-300">
                    <div className="flex items-center gap-1.5 truncate">
                      <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="font-medium">No value required</span>
                    </div>
                    <span className="text-[8px] text-emerald-400/80 font-sans uppercase tracking-wider">
                      {su.action || "action"}
                    </span>
                  </div>
                ) : (
                  <div className="flex-1 min-w-[130px] flex items-center gap-1.5 min-w-0">
                    <Select
                      value={
                        currentSource === "structured_field"
                          ? `field:${su.schemaField || su.value || ""}`
                          : currentSource === "expression" &&
                              su.value &&
                              transformerSteps.some(
                                (ts) =>
                                  ts.outputVariable &&
                                  (su.value === ts.outputVariable ||
                                    su.value?.startsWith(`${ts.outputVariable}.`)),
                              )
                            ? `step_var:${su.value}`
                            : currentSource
                      }
                    onValueChange={(val: string) => {
                      const updated = [...stateUpdates];
                      const current = updated[sIdx];
                      if (!current) return;

                      if (val.startsWith("field:")) {
                        const fieldName = val.replace("field:", "");
                        updated[sIdx] = {
                          ...current,
                          source: "structured_field",
                          schemaField: fieldName,
                          value: fieldName,
                          mode: "set",
                        };
                      } else if (val.startsWith("step_var:")) {
                        const varPath = val.replace("step_var:", "");
                        updated[sIdx] = {
                          ...current,
                          source: "expression",
                          schemaField: undefined,
                          value: varPath,
                          mode: "set",
                        };
                      } else if (val === "structured_full") {
                        updated[sIdx] = {
                          ...current,
                          source: "structured_full",
                          schemaField: undefined,
                          value: "structuredResponse",
                          mode: "set",
                        };
                      } else if (val === "message_content") {
                        updated[sIdx] = {
                          ...current,
                          source: "message_content",
                          schemaField: undefined,
                          value: "response.content",
                          mode: "set",
                        };
                      } else if (val === "message_object") {
                        updated[sIdx] = {
                          ...current,
                          source: "message_object",
                          schemaField: undefined,
                          value: "response",
                          mode: "append",
                        };
                      } else if (val === "expression") {
                        updated[sIdx] = {
                          ...current,
                          source: "expression",
                          schemaField: undefined,
                          mode: "expression",
                          value:
                            current.action === "increment" ||
                            current.action === "decrement"
                              ? "1"
                              : current.value || "state.count + 1",
                        };
                      } else if (val === "literal") {
                        updated[sIdx] = {
                          ...current,
                          source: "literal",
                          schemaField: undefined,
                          mode: "set",
                          value: current.value || "success",
                        };
                      }
                      onUpdateAgent({ stateUpdates: updated });
                    }}
                  >
                    <SelectTrigger
                      className="h-7 text-xs bg-background flex-1 min-w-0 px-2 font-mono"
                      title="Select source for new value"
                    >
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Structured Output Options */}
                      {isStructured && schemaFields.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase font-bold text-purple-400">
                            Structured Output Fields
                          </SelectLabel>
                          {schemaFields.map((f) => (
                            <SelectItem
                              key={f.name}
                              value={`field:${f.name}`}
                              className="font-mono text-xs"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-purple-300">
                                  {f.name}
                                </span>
                                <span className="text-[9px] text-muted-foreground font-sans">
                                  ({f.type || "string"})
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                          <SelectItem
                            value="structured_full"
                            className="font-mono text-xs"
                          >
                            <span className="font-semibold text-purple-400">
                              Full Structured JSON Object
                            </span>
                          </SelectItem>
                        </SelectGroup>
                      )}

                      {isStructured && <SelectSeparator />}

                      {/* General LLM Outputs */}
                      <SelectGroup>
                        <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground">
                          LLM Output
                        </SelectLabel>
                        <SelectItem value="message_content">
                          <div className="flex items-center gap-1.5">
                            <span>Text Content</span>
                            <span className="text-[9px] text-muted-foreground">
                              (string)
                            </span>
                          </div>
                        </SelectItem>
                        <SelectItem value="message_object">
                          <div className="flex items-center gap-1.5">
                            <span>AIMessage Object</span>
                            <span className="text-[9px] text-muted-foreground">
                              (BaseMessage)
                            </span>
                          </div>
                        </SelectItem>
                      </SelectGroup>

                      {/* Transformer Step Outputs */}
                      {transformerSteps.length > 0 && (
                        <>
                          <SelectSeparator />
                          <SelectGroup>
                            <SelectLabel className="text-[10px] uppercase font-bold text-purple-400">
                              Pipeline Transformer Outputs
                            </SelectLabel>
                            {transformerSteps.map((ts) => {
                              const varName = ts.outputVariable || ts.id;
                              const returnFields =
                                ts.outputSchema ||
                                ts.functionRef?.returnSchema ||
                                [];
                              return (
                                <React.Fragment key={ts.id}>
                                  <SelectItem value={`step_var:${varName}`}>
                                    <div className="flex items-center gap-1.5 font-mono text-purple-300">
                                      <Shuffle className="w-3 h-3 text-purple-400" />
                                      <span>{varName}</span>
                                      <span className="text-[9px] text-muted-foreground">
                                        (whole)
                                      </span>
                                    </div>
                                  </SelectItem>
                                  {returnFields.map((f) => (
                                    <SelectItem
                                      key={`${varName}.${f.name}`}
                                      value={`step_var:${varName}.${f.name}`}
                                    >
                                      <div className="flex items-center gap-1.5 font-mono text-purple-300 pl-2">
                                        <span>
                                          {varName}.{f.name}
                                        </span>
                                        <span className="text-[9px] text-muted-foreground">
                                          ({f.type})
                                        </span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </React.Fragment>
                              );
                            })}
                          </SelectGroup>
                        </>
                      )}

                      <SelectSeparator />

                      {/* Expressions & Constants */}
                      <SelectGroup>
                        <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground">
                          Custom
                        </SelectLabel>
                        <SelectItem
                          value="expression"
                          className="text-amber-400 font-mono"
                        >
                          Custom Expression (state.*)
                        </SelectItem>
                        <SelectItem value="literal">
                          Literal Constant
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  {/* Type Mismatch Warning */}
                  {hasTypeMismatch && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="text-xs text-amber-200 max-w-[220px]"
                      >
                        Type mismatch: Channel is {channelMeta.type}, but field
                        '{matchedSchemaField?.name}' is{" "}
                        {matchedSchemaField?.type}.
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}

                {/* 4. Delete Row Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer"
                  onClick={() => {
                    const updated = stateUpdates.filter(
                      (_: LangGraphStateUpdateItem, i: number) => i !== sIdx,
                    );
                    onUpdateAgent({ stateUpdates: updated });
                  }}
                  title="Remove state update"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Custom Action Name Input (when user selects custom action) */}
              {isCustomActionActive && (
                <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                  <span className="text-[10px] text-amber-400 font-mono shrink-0 font-semibold">
                    Action Name:
                  </span>
                  <LocalInput
                    className="h-6 text-[11px] bg-background font-mono flex-1 border-amber-500/30"
                    placeholder="e.g. increment_by_5 or clear_cart"
                    value={su.action === "default" ? "" : su.action || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const updated = [...stateUpdates];
                      const current = updated[sIdx];
                      if (current) {
                        updated[sIdx] = { ...current, action: e.target.value };
                        onUpdateAgent({ stateUpdates: updated });
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCustomActionIdxs((prev) => {
                        const next = { ...prev };
                        delete next[sIdx];
                        return next;
                      });
                      const updated = [...stateUpdates];
                      if (updated[sIdx]) {
                        updated[sIdx] = { ...updated[sIdx]!, action: "default" };
                        onUpdateAgent({ stateUpdates: updated });
                      }
                    }}
                    className="text-[10px] text-muted-foreground hover:text-foreground px-1"
                    title="Reset to default action"
                  >
                    &times;
                  </button>
                </div>
              )}

              {/* Expression or Custom Value Input */}
              {!isValueless &&
                (currentSource === "expression" ||
                  currentSource === "literal" ||
                  su.action === "increment" ||
                  su.action === "decrement") && (
                <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                    {su.action === "increment" || su.action === "decrement"
                      ? "Amount:"
                      : currentSource === "expression"
                        ? "Expr:"
                        : "Value:"}
                  </span>
                  <LocalInput
                    className="h-6 text-[11px] bg-background font-mono flex-1"
                    placeholder={
                      su.action === "increment" || su.action === "decrement"
                        ? "1 or state.delta"
                        : currentSource === "expression"
                          ? "state.count + 1 or state.user_query"
                          : "Static literal value"
                    }
                    value={su.value || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const updated = [...stateUpdates];
                      const current = updated[sIdx];
                      if (current) {
                        updated[sIdx] = { ...current, value: e.target.value };
                        onUpdateAgent({ stateUpdates: updated });
                      }
                    }}
                  />
                </div>
              )}

              {/* Feeds / Reducer Contract Hint */}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 px-1 font-mono pt-0.5">
                <span className="truncate">
                  {su.action && su.action !== "default" ? (
                    isValueless ? (
                      <>
                        Dispatches:{" "}
                        <span className="text-amber-300 font-bold">
                          &#123; action: &quot;{su.action}&quot; &#125;
                        </span>{" "}
                        ➔{" "}
                        <span className="text-sky-300 font-bold">
                          {channelMeta.reducer}
                        </span>
                      </>
                    ) : (
                      <>
                        Dispatches:{" "}
                        <span className="text-amber-300 font-bold">
                          &#123; action: &quot;{su.action}&quot;, value:{" "}
                          <span className="text-purple-300">{valueDisplay}</span>{" "}
                          &#125;
                        </span>{" "}
                        ➔{" "}
                        <span className="text-sky-300 font-bold">
                          {channelMeta.reducer}
                        </span>
                      </>
                    )
                  ) : (
                    <>
                      Dispatches:{" "}
                      <span className="text-purple-300">{valueDisplay}</span> ➔{" "}
                      <span className="text-sky-300 font-bold">
                        {channelMeta.reducer}
                      </span>
                    </>
                  )}
                </span>
                <span className="text-[9px] text-muted-foreground/60 shrink-0 ml-2">
                  channel: {channelMeta.type}
                </span>
              </div>
            </div>
          );
        })}

        {/* Unmapped Schema Fields Quick-Add Pills */}
        {isStructured && unmappedSchemaFields.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/30">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              Unmapped Schema Fields:
            </span>
            {unmappedSchemaFields.map((f) => (
              <button
                key={f.name}
                type="button"
                onClick={() => handleAddSchemaFieldUpdate(f.name)}
                className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/25 text-purple-300 hover:bg-purple-500/25 hover:border-purple-500/40 transition-colors cursor-pointer"
                title={`Map schema field '${f.name}' to a channel`}
              >
                <Plus className="w-3 h-3 text-purple-400" />
                <span>{f.name}</span>
                <span className="text-[9px] text-muted-foreground font-sans">
                  ({f.type || "string"})
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Empty State */}
        {stateUpdates.length === 0 && (
          <div className="p-3 rounded-lg border border-dashed border-border/70 bg-secondary/10 flex flex-col gap-1 text-center">
            <span className="text-xs font-semibold text-foreground/80">
              Default message flow
            </span>
            <span className="text-[11px] text-muted-foreground">
              This node outputs standard{" "}
              <code className="text-amber-500 font-mono">messages</code> to the
              graph. Click &quot;+ Add Update&quot;
              {isStructured && schemaFields.length > 0
                ? " or an unmapped field pill above "
                : " "}
              to select a reducer and map actions with new values.
            </span>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
