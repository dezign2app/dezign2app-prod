import React, { useMemo } from "react";
import {
  Sparkles,
  Trash2,
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
  Braces,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { LocalInput, LocalTextarea } from "../../../../../../common";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@workspace/ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import type {
  LangGraphStateChannel,
  LangGraphCustomReducer,
  LangGraphStateUpdateItem,
  StateUpdateSource,
  CustomTypeItem,
} from "@workspace/canvas";
import type { Parameter } from "@/types/canvas";
import type {
  ReferenceStep,
  TransformerStepLike,
} from "./types";
import {
  getChannelMeta,
  getActionsForReducer,
  isValuelessAction,
  extractFieldsFromCustomType,
  generateDispatchBodyForChannel,
} from "./utils";

export interface AgentStateUpdateRowProps {
  su: LangGraphStateUpdateItem;
  sIdx: number;
  stateChannels: LangGraphStateChannel[];
  availableCustomTypes: CustomTypeItem[];
  customReducers: LangGraphCustomReducer[];
  schemaFields: Parameter[];
  transformerSteps: TransformerStepLike[];
  availableReferenceSteps: ReferenceStep[];
  isStructured: boolean;
  isCustomAction: boolean;
  onToggleCustomAction: () => void;
  activeRefStep: string;
  onChangeRefStep: (stepId: string) => void;
  activeRefField: string;
  onChangeRefField: (fieldPath: string) => void;
  isJsonOverride?: boolean;
  onToggleJsonOverride: () => void;
  onUpdateRow: (updater: (prev: LangGraphStateUpdateItem) => LangGraphStateUpdateItem) => void;
  onRemoveRow: () => void;
  textareaRef: (el: HTMLTextAreaElement | null) => void;
  inputRef: (el: HTMLInputElement | null) => void;
  onInsertRefAtCursor: (refString: string) => void;
}

export function AgentStateUpdateRow({
  su,
  sIdx,
  stateChannels,
  availableCustomTypes,
  customReducers,
  schemaFields,
  transformerSteps,
  availableReferenceSteps,
  isStructured,
  isCustomAction,
  onToggleCustomAction,
  activeRefStep,
  onChangeRefStep,
  activeRefField,
  onChangeRefField,
  isJsonOverride,
  onToggleJsonOverride,
  onUpdateRow,
  onRemoveRow,
  textareaRef,
  inputRef,
  onInsertRefAtCursor,
}: AgentStateUpdateRowProps) {
  const channelMeta = getChannelMeta(
    su.channelKey,
    stateChannels,
    customReducers,
    availableCustomTypes,
  );
  const channelDisplayType = channelMeta.displayType;
  const isCustomChannel = Boolean(channelMeta.customTypeName || channelMeta.customTypeSchema);
  const customFields = extractFieldsFromCustomType(channelMeta.customTypeSchema);

  const expectsJson =
    channelMeta.type === "object" ||
    channelMeta.reducer === "merge_object" ||
    isCustomChannel;

  const currentSource: StateUpdateSource =
    su.source ||
    (isStructured && su.schemaField
      ? "structured_field"
      : su.mode === "expression"
        ? "expression"
        : expectsJson
          ? "expression"
          : "message_content");

  const matchedSchemaField = schemaFields.find(
    (f) => f.name === (su.schemaField || su.value),
  );

  // Type mismatch check
  const hasTypeMismatch = Boolean(
    currentSource === "structured_field" &&
      matchedSchemaField &&
      (isCustomChannel
        ? matchedSchemaField.type !== channelMeta.customTypeName &&
          matchedSchemaField.type !== "object"
        : channelMeta.type !== "object" &&
          matchedSchemaField.type &&
          !matchedSchemaField.type.startsWith(channelMeta.type) &&
          !(
            channelMeta.type === "array" &&
            matchedSchemaField.type.endsWith("[]")
          )),
  );

  // Available actions for this channel and reducer (auto-detected only!)
  const availableActions = getActionsForReducer(
    channelMeta.type,
    channelMeta.reducer,
    channelMeta.customCode,
  );

  const currentAction = su.action || "default";
  const isValueless = isValuelessAction(currentAction);

  // Row mode: JSON textarea mode vs single line
  const isRowJsonMode =
    isJsonOverride !== undefined
      ? isJsonOverride
      : expectsJson ||
        (su.value && (su.value.includes("\n") || su.value.trim().startsWith("{")));

  // Active cascading reference step & field
  const activeStepObj =
    availableReferenceSteps.find((st) => st.id === activeRefStep) ||
    availableReferenceSteps[0];
  const activeFieldPath =
    activeRefField || activeStepObj?.fields[0]?.path || "response.content";
  const activeFieldObj =
    activeStepObj?.fields.find((f) => f.path === activeFieldPath) ||
    activeStepObj?.fields[0];

  // Format value description for preview
  const displayVal =
    su.value !== undefined && su.value !== "" && (expectsJson ? su.value !== "response.content" : true)
      ? su.value
      : expectsJson
        ? generateDispatchBodyForChannel(
            channelMeta.channel,
            availableCustomTypes,
            schemaFields,
            transformerSteps,
          )
        : currentSource === "structured_field"
          ? (su.schemaField ? `response.${su.schemaField}` : (su.value || ""))
          : currentSource === "structured_full"
            ? "response"
            : currentSource === "message_content"
              ? "response.content"
              : currentSource === "message_object"
                ? "response"
                : "";

  const valueDisplay = displayVal || (isValueless ? "" : '""');

  const handleRawValueChange = (raw: string) => {
    let nextSource: StateUpdateSource = "literal";
    let nextSchemaField: string | undefined = undefined;

    const cleanMatch = raw.replace(/^response\??\./, "").trim();
    const matchedField = schemaFields.find(
      (f) => f.name === cleanMatch || f.name === raw,
    );

    if (matchedField) {
      nextSource = "structured_field";
      nextSchemaField = matchedField.name;
    } else if (raw === "response.content") {
      nextSource = "message_content";
    } else if (raw === "response") {
      nextSource = "message_object";
    } else if (
      raw.startsWith("state.") ||
      raw.includes("${") ||
      transformerSteps.some(
        (ts) =>
          ts.outputVariable &&
          (raw === ts.outputVariable || raw.startsWith(`${ts.outputVariable}.`)),
      )
    ) {
      nextSource = "expression";
    } else {
      nextSource = "literal";
    }

    onUpdateRow((cur) => ({
      ...cur,
      value: raw,
      source: nextSource,
      schemaField: nextSchemaField,
      mode: nextSource === "expression" ? "expression" : "set",
    }));
  };

  const handleChannelSelect = (v: string) => {
    const chMeta = getChannelMeta(v, stateChannels, customReducers, availableCustomTypes);
    const isCustom = Boolean(chMeta.customTypeName || chMeta.customTypeSchema);
    const channelExpectsJson = chMeta.type === "object" || chMeta.reducer === "merge_object" || isCustom;

    let nextValue = su.value;
    let nextSource = su.source;
    let nextMode = su.mode;

    if (
      channelExpectsJson &&
      (!nextValue ||
        nextValue === "response.content" ||
        nextValue === "${response.content}" ||
        nextSource === "message_content" ||
        nextValue.includes('"${'))
    ) {
      nextValue = generateDispatchBodyForChannel(
        chMeta.channel,
        availableCustomTypes,
        schemaFields,
        transformerSteps,
        "response.content",
      );
      nextSource = "expression";
      nextMode = "expression";
    }

    onUpdateRow((current) => ({
      ...current,
      channelKey: v,
      reducer: chMeta.reducer,
      action: chMeta.isCustom ? "custom" : "replace",
      value: nextValue,
      source: nextSource,
      mode: nextMode,
    }));
  };

  const handleActionSelect = (val: string) => {
    if (val === "custom") {
      onToggleCustomAction();
      return;
    }

    const valueless = isValuelessAction(val);

    onUpdateRow((current) => {
      if (valueless) {
        return {
          ...current,
          action: val,
          source: "none",
          value: undefined,
          schemaField: undefined,
        };
      }

      let nextValue = current.value;
      let nextSource = current.source === "none" ? undefined : current.source;
      let nextField = current.schemaField;

      if (!nextSource) {
        if (isStructured && schemaFields.length > 0) {
          nextSource = "structured_field";
          nextField = schemaFields[0]?.name;
          nextValue = nextField ? `response.${nextField}` : undefined;
        } else if (expectsJson) {
          nextSource = "expression";
          nextValue = generateDispatchBodyForChannel(
            channelMeta.channel,
            availableCustomTypes,
            schemaFields,
            transformerSteps,
          );
        } else {
          nextSource = "message_content";
          nextValue = "response.content";
        }
      }

      return {
        ...current,
        action: val,
        source: nextSource,
        value: nextValue,
        schemaField: nextField,
      };
    });
  };

  return (
    <div className="flex flex-col gap-2.5 p-3 rounded-xl border bg-background/60 text-xs shadow-xs transition-all hover:border-border/80">
      {/* ─── Top Row: 1. State Channel | 2. Reducer Action | Valueless Pill | Delete ─── */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap sm:flex-nowrap">
          {/* 1. Target Channel */}
          <div className="w-[180px] shrink-0">
            <Select value={su.channelKey} onValueChange={handleChannelSelect}>
              <SelectTrigger className="h-8 text-xs bg-background font-mono truncate">
                <SelectValue placeholder="Select channel..." />
              </SelectTrigger>
              <SelectContent>
                {stateChannels.map((c) => {
                  const typeLabel = getChannelMeta(
                    c.key,
                    stateChannels,
                    customReducers,
                    availableCustomTypes,
                  ).displayType;
                  return (
                    <SelectItem key={c.key} value={c.key} className="text-xs font-mono">
                      <span>{c.key}</span>
                      <span className="text-[10px] text-muted-foreground ml-1 font-sans">
                        [{typeLabel}]
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* 2. Reducer Action Dropdown / Custom Action Input */}
          <div className="w-[170px] shrink-0">
            {isCustomAction ? (
              <div className="flex items-center gap-1">
                <LocalInput
                  value={su.action === "custom" || !su.action ? "" : su.action}
                  placeholder="Action name..."
                  className="h-8 text-xs font-mono bg-background"
                  onChange={(e) => {
                    const rawVal = e.target.value;
                    onUpdateRow((current) => ({ ...current, action: rawVal }));
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                  onClick={onToggleCustomAction}
                  title="Switch to dropdown list"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <Select value={su.action || "default"} onValueChange={handleActionSelect}>
                <SelectTrigger className="h-8 text-xs bg-background font-mono truncate border-border/80">
                  <SelectValue placeholder="Action..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel className="text-[10px] font-sans text-muted-foreground">
                      Detected Actions ({channelMeta.reducer})
                    </SelectLabel>
                    {availableActions.map((act) => (
                      <SelectItem key={act.action} value={act.action} className="text-xs font-mono">
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="flex items-center gap-1 font-semibold text-foreground">
                            {act.action !== "default" && <span className="text-amber-500">⚡</span>}
                            <span>{act.label}</span>
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                    <SelectSeparator key="custom-separator" />
                    <SelectItem
                      key="custom"
                      value="custom"
                      className="text-xs font-mono text-purple-400 font-semibold"
                    >
                      <span>✏️ Custom Action...</span>
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Valueless indicator badge */}
          {isValueless && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-secondary/50 border border-border text-muted-foreground text-[11px] font-mono">
              <Info className="w-3 h-3 text-muted-foreground/70" />
              <span>No value required ({su.action || "action"})</span>
            </div>
          )}
        </div>

        {/* Delete button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer"
          onClick={onRemoveRow}
          title="Remove state update"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* ─── Bottom Section: 3. New Value / Mapping (ONLY when !isValueless) ─── */}
      {!isValueless && (
        <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
          {/* Section Sub-header */}
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-purple-400" /> 3. New Value / Mapping
            </span>
            <div className="flex items-center gap-1">
              {/* Mode Toggle: Single-line vs JSON Textarea */}
              <Button
                type="button"
                size="sm"
                variant={isRowJsonMode ? "secondary" : "ghost"}
                className={`h-5 px-1.5 text-[9px] font-mono cursor-pointer ${
                  isRowJsonMode
                    ? "bg-purple-500/20 text-purple-200 border border-purple-500/40"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={onToggleJsonOverride}
                title="Toggle between single line and multiline expression editor"
              >
                <Code2 className="w-2.5 h-2.5 mr-1" />
                {isRowJsonMode ? "JSON Active" : "Single Line"}
              </Button>
            </div>
          </div>

          {/* Cascading Reference Insertion Toolbar */}
          <div className="flex items-center gap-1.5 flex-wrap p-1.5 rounded-lg bg-secondary/30 border border-border/60 text-xs">
            <span className="text-[9px] font-bold font-mono text-muted-foreground uppercase tracking-wider px-1">
              Insert Reference:
            </span>

            {/* Cascading 1: Step Selector */}
            <Select
              value={activeStepObj?.id || "response"}
              onValueChange={(val: string) => {
                onChangeRefStep(val);
                const step = availableReferenceSteps.find((s) => s.id === val);
                if (step && step.fields.length > 0) {
                  onChangeRefField(step.fields[0]?.path || "");
                }
              }}
            >
              <SelectTrigger className="h-6 text-[11px] font-mono bg-background border-border max-w-[170px] truncate">
                <SelectValue placeholder="Step..." />
              </SelectTrigger>
              <SelectContent>
                {availableReferenceSteps.map((st) => (
                  <SelectItem key={st.id} value={st.id} className="text-xs font-mono">
                    {st.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-muted-foreground/50 text-[10px]">➔</span>

            {/* Cascading 2: Field Selector */}
            <Select
              value={activeFieldPath}
              onValueChange={(val: string) => onChangeRefField(val)}
            >
              <SelectTrigger className="h-6 text-[11px] font-mono bg-background border-border max-w-[200px] truncate">
                <SelectValue placeholder="Field..." />
              </SelectTrigger>
              <SelectContent>
                {activeStepObj?.fields.map((f) => (
                  <SelectItem key={f.path} value={f.path} className="text-xs font-mono">
                    <span className="font-semibold text-foreground">{f.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-muted-foreground/50 text-[10px]">➔</span>

            {/* Insert Button */}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-6 px-2 text-[10px] font-mono gap-1 bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 border border-purple-500/30 cursor-pointer"
              onClick={() => onInsertRefAtCursor(`\${${activeFieldPath}}`)}
              title={`Insert \${${activeFieldPath}} at cursor position`}
            >
              + Insert {'${'}{activeFieldObj?.short || activeFieldPath}{'}'}
            </Button>

            {/* Set Value Directly */}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => {
                if (isRowJsonMode) {
                  if (customFields.length > 1) {
                    const body = generateDispatchBodyForChannel(
                      channelMeta.channel,
                      availableCustomTypes,
                      schemaFields,
                      transformerSteps,
                      activeFieldPath,
                    );
                    handleRawValueChange(body);
                  } else {
                    const fieldKey = activeFieldObj?.short?.split(".").pop() || "field";
                    handleRawValueChange(`{\n  "${fieldKey}": \`\${${activeFieldPath}}\`\n}`);
                  }
                } else {
                  handleRawValueChange(activeFieldPath);
                }
              }}
              title={`Set whole value directly to ${activeFieldPath}`}
            >
              Set Value
            </Button>

            {/* Auto-Generate Body */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px] font-mono gap-1 border-purple-500/40 bg-purple-500/10 text-purple-300 hover:text-purple-100 hover:bg-purple-500/20 cursor-pointer"
              onClick={() => {
                const body = generateDispatchBodyForChannel(
                  channelMeta.channel,
                  availableCustomTypes,
                  schemaFields,
                  transformerSteps,
                  activeFieldPath,
                );
                handleRawValueChange(body);
              }}
              title={`Auto-generate dispatch JSON body matching ${channelDisplayType} schema`}
            >
              <Sparkles className="w-2.5 h-2.5 text-purple-400" />
              <span>Auto-Generate Body</span>
            </Button>

            {/* Map picker dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground font-mono gap-1 cursor-pointer"
                  title="Browse all available variables"
                >
                  <Shuffle className="w-2.5 h-2.5" />
                  <span>Map</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 max-h-72 overflow-y-auto text-xs font-mono">
                {availableReferenceSteps.map((st) => (
                  <DropdownMenuGroup key={st.id}>
                    <DropdownMenuLabel className="text-[10px] font-sans text-muted-foreground px-2 py-1 flex items-center gap-1 font-semibold bg-muted/30">
                      {st.id === "response" ? (
                        <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                      ) : st.id === "state" ? (
                        <Layers className="w-2.5 h-2.5 text-sky-400" />
                      ) : (
                        <Code2 className="w-2.5 h-2.5 text-amber-400" />
                      )}
                      <span>{st.label}</span>
                    </DropdownMenuLabel>
                    {st.fields.map((f) => (
                      <DropdownMenuItem
                        key={f.path}
                        className="text-[11px] font-mono flex items-center justify-between cursor-pointer py-1 px-2"
                        onClick={() => onInsertRefAtCursor(`\${${f.path}}`)}
                      >
                        <span className="font-semibold text-foreground truncate">{f.label}</span>
                        <span className="text-[9px] text-purple-400/80 shrink-0 ml-1">+ insert</span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </DropdownMenuGroup>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Quick Click Reference Chips */}
          <div className="flex items-center gap-1 flex-wrap px-0.5">
            <span className="text-[9px] text-muted-foreground/70 font-mono">Quick:</span>
            {(isRowJsonMode || isCustomChannel) && (
              <button
                type="button"
                onClick={() => {
                  const body = generateDispatchBodyForChannel(
                    channelMeta.channel,
                    availableCustomTypes,
                    schemaFields,
                    transformerSteps,
                    activeFieldPath,
                  );
                  handleRawValueChange(body);
                }}
                className="text-[9px] font-mono px-2 py-0.5 rounded border border-purple-500/40 bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 transition-colors cursor-pointer flex items-center gap-1 font-semibold"
                title={`Auto-generate dispatch body for ${channelDisplayType}`}
              >
                <Sparkles className="w-2.5 h-2.5 text-purple-300" />
                <span>+ Generate {channelDisplayType} Body</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onInsertRefAtCursor("${response.content}")}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-border/60 bg-secondary/30 hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              + ${`{response.content}`}
            </button>
            <button
              type="button"
              onClick={() => onInsertRefAtCursor("${state.messages}")}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-border/60 bg-secondary/30 hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              + ${`{state.messages}`}
            </button>
            {stateChannels
              .filter((c) => c.key !== "messages" && c.key !== su.channelKey)
              .slice(0, 3)
              .map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => onInsertRefAtCursor(`\${state.${c.key}}`)}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-border/60 bg-secondary/30 hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  + ${`{state.${c.key}}`}
                </button>
              ))}
          </div>

          {/* Empty Textarea Helper Banner */}
          {isRowJsonMode && (!su.value || !su.value.trim()) && (
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-purple-950/30 border border-purple-500/30 text-[11px] text-purple-200">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>
                  Dispatch body is empty. Generate template for <strong className="font-mono text-purple-300">{channelDisplayType}</strong>?
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-5 px-2 text-[10px] font-mono bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border-purple-500/40 gap-1 cursor-pointer"
                onClick={() => {
                  const body = generateDispatchBodyForChannel(
                    channelMeta.channel,
                    availableCustomTypes,
                    schemaFields,
                    transformerSteps,
                    activeFieldPath,
                  );
                  handleRawValueChange(body);
                }}
              >
                <Sparkles className="w-2.5 h-2.5 text-purple-300" />
                Generate Body
              </Button>
            </div>
          )}

          {/* Value Editor: Textarea (JSON / multiline) or LocalInput (single line) */}
          {isRowJsonMode ? (
            <LocalTextarea
              ref={textareaRef}
              className="min-h-[90px] text-xs bg-background font-mono leading-relaxed p-2.5 border-border focus-visible:ring-purple-500/40 resize-y"
              placeholder={
                generateDispatchBodyForChannel(
                  channelMeta.channel,
                  availableCustomTypes,
                  schemaFields,
                  transformerSteps,
                ) ||
                (customFields.length > 0
                  ? `{\n${customFields.map((f) => `  "${f.name}": \`\${response.${f.name}}\``).join(",\n")}\n}`
                  : `{\n  "field": \`\${response.content}\`\n}`)
              }
              value={su.value ?? ""}
              onChange={(e) => handleRawValueChange(e.target.value)}
            />
          ) : (
            <LocalInput
              ref={inputRef}
              className="h-8 text-xs bg-background font-mono border-border"
              placeholder={
                isStructured && schemaFields.length > 0
                  ? `response.${schemaFields[0]?.name || "field"}`
                  : "response.content or ${response.content}"
              }
              value={
                su.value !== undefined
                  ? su.value
                  : expectsJson
                    ? ""
                    : su.source === "message_content"
                      ? "response.content"
                      : su.source === "message_object"
                        ? "response"
                        : ""
              }
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                handleRawValueChange(e.target.value);
              }}
            />
          )}

          {/* Type Mismatch Warning */}
          {hasTypeMismatch && (
            <div className="flex items-center gap-1.5 text-xs text-amber-300 font-mono bg-amber-500/10 border border-amber-500/30 p-1.5 rounded-md">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                Type mismatch: Channel is {channelDisplayType}, but mapped field &apos;{matchedSchemaField?.name}&apos; is {matchedSchemaField?.type}.
              </span>
            </div>
          )}
        </div>
      )}

      {/* ─── Footer: Preview Contract & Channel Type ─── */}
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
              <span className="text-purple-300 font-bold">{valueDisplay}</span> ➔{" "}
              <span className="text-sky-300 font-bold">
                {channelMeta.reducer}
              </span>
            </>
          )}
        </span>
        <span className="text-[9px] text-muted-foreground/60 shrink-0 ml-2 flex items-center gap-1 font-mono">
          <span>channel:</span>
          {channelMeta.customTypeName ? (
            <span className="text-cyan-400 font-semibold flex items-center gap-0.5">
              <Braces className="w-2.5 h-2.5" />
              {channelMeta.customTypeName}
            </span>
          ) : (
            <span>{channelMeta.type}</span>
          )}
        </span>
      </div>
    </div>
  );
}
