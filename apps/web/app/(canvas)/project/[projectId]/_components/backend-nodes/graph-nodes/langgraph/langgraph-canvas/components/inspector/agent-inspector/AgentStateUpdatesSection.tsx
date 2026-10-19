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
import { LocalInput, LocalTextarea } from "../../../../../common";
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
  AgentNodeData,
  LangGraphStateUpdateItem,
  StateUpdateSource,
  LangGraphCanvasNode,
  CustomTypeItem,
} from "@workspace/canvas";
import { LANGGRAPH_CANVAS_NODE_TYPES } from "@workspace/canvas";
import type { Parameter } from "@/types/canvas";
import { parseSchemaJsonToFields } from "./AgentStructuredOutputSection";

interface AgentStateUpdatesSectionProps {
  selectedAgentData: AgentNodeData;
  onUpdateAgent: (changes: Partial<AgentNodeData>) => void;
  stateChannels?: LangGraphStateChannel[];
  customReducers?: LangGraphCustomReducer[];
  embedded?: boolean;
  nodes?: LangGraphCanvasNode[];
}

import {
  extractActionsFromReducerCode,
  isValuelessAction,
  getActionsForReducer,
  getActionMetadata,
  getSuggestedReducerCodeForChannelType,
  type ReducerActionMeta,
} from "../state-inspector/constants";

export {
  extractActionsFromReducerCode,
  isValuelessAction,
  getActionsForReducer,
  getActionMetadata,
  getSuggestedReducerCodeForChannelType,
};
export type { ReducerActionMeta };

export function AgentStateUpdatesSection({
  selectedAgentData,
  onUpdateAgent,
  stateChannels = [],
  customReducers = [],
  embedded = false,
  nodes = [],
}: AgentStateUpdatesSectionProps) {
  const stateUpdates: LangGraphStateUpdateItem[] =
    selectedAgentData.stateUpdates || [];

  const [customActionIdxs, setCustomActionIdxs] = React.useState<
    Record<number, boolean>
  >({});

  // Reference insertion step & field per row
  const [rowRefStep, setRowRefStep] = React.useState<Record<number, string>>({});
  const [rowRefField, setRowRefField] = React.useState<Record<number, string>>({});
  const [rowJsonOverrides, setRowJsonOverrides] = React.useState<Record<number, boolean>>({});

  const inputRefs = React.useRef<Record<number, HTMLInputElement | null>>({});
  const textareaRefs = React.useRef<Record<number, HTMLTextAreaElement | null>>({});

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

  // Available reference steps and fields for insertion
  const availableReferenceSteps = useMemo(() => {
    const steps: Array<{
      id: string;
      label: string;
      fields: Array<{
        path: string;
        label: string;
        short: string;
        type?: string;
      }>;
    }> = [];

    // 1. LLM Agent Step
    const llmFields: Array<{ path: string; label: string; short: string; type?: string }> = [
      { path: "response.content", label: "content (AI Text)", short: "response.content", type: "string" },
      { path: "response", label: "response (Whole Message)", short: "response", type: "object" },
    ];

    if (isStructured && schemaFields.length > 0) {
      for (const sf of schemaFields) {
        if (!sf.name?.trim()) continue;
        llmFields.push({
          path: `response.${sf.name.trim()}`,
          label: `${sf.name} (${sf.type || "string"})`,
          short: `response.${sf.name.trim()}`,
          type: sf.type || "string",
        });
      }
    }

    llmFields.push(
      { path: "response.role", label: "role (string)", short: "response.role", type: "string" },
      { path: "response.tool_calls", label: "tool_calls (array)", short: "response.tool_calls", type: "array" },
    );

    steps.push({
      id: "response",
      label: "LLM Agent (response)",
      fields: llmFields,
    });

    // 2. All Pipeline Steps (LLM steps, transformers, custom code, tools, etc.)
    const pSteps = selectedAgentData.pipelineSteps || [];
    pSteps.forEach((ps, idx) => {
      const stepNum = idx + 1;
      const stepVar = ps.outputVariable || ps.id || `step${stepNum}`;
      const stepLabel = ps.label
        ? `${ps.label} (${stepVar})`
        : `Step ${stepNum}: ${ps.type} (${stepVar})`;

      const pFields: Array<{ path: string; label: string; short: string; type?: string }> = [
        { path: stepVar, label: `${stepVar} (Whole Output)`, short: stepVar, type: "object" },
      ];

      const returnSchema = ps.outputSchema || ps.functionRef?.returnSchema || [];
      returnSchema.forEach((rf) => {
        if (rf.name?.trim()) {
          pFields.push({
            path: `${stepVar}.${rf.name.trim()}`,
            label: `${rf.name} (${rf.type || "string"})`,
            short: `${stepVar}.${rf.name.trim()}`,
            type: rf.type || "string",
          });
        }
      });

      if (ps.type === "custom_code") {
        pFields.push({
          path: `${stepVar}.result`,
          label: "result (output)",
          short: `${stepVar}.result`,
          type: "string",
        });
      } else if (ps.type === "tools") {
        pFields.push(
          {
            path: `${stepVar}.output`,
            label: "output (object)",
            short: `${stepVar}.output`,
            type: "object",
          },
          {
            path: `${stepVar}.content`,
            label: "content (string)",
            short: `${stepVar}.content`,
            type: "string",
          },
        );
      } else if (ps.type === "llm_call") {
        pFields.push(
          {
            path: `${stepVar}.content`,
            label: "content (string)",
            short: `${stepVar}.content`,
            type: "string",
          },
          {
            path: `${stepVar}.response`,
            label: "response (object)",
            short: `${stepVar}.response`,
            type: "object",
          },
        );
      } else if (returnSchema.length === 0) {
        pFields.push(
          {
            path: `${stepVar}.output`,
            label: "output (data)",
            short: `${stepVar}.output`,
            type: "object",
          },
          {
            path: `${stepVar}.content`,
            label: "content (string)",
            short: `${stepVar}.content`,
            type: "string",
          },
        );
      }

      steps.push({
        id: stepVar,
        label: stepLabel,
        fields: pFields,
      });
    });

    // 3. Upstream Canvas Nodes
    if (nodes && nodes.length > 0) {
      nodes.forEach((n) => {
        if (!n || n.id === selectedAgentData.id) return;
        const nodeData = n.data;
        let nodeName: string = n.id;
        let nodeVar: string = n.id;

        if (typeof nodeData === "object" && nodeData !== null) {
          if ("label" in nodeData && typeof nodeData.label === "string" && nodeData.label.trim()) {
            nodeName = nodeData.label.trim();
          } else if ("name" in nodeData && typeof nodeData.name === "string" && nodeData.name.trim()) {
            nodeName = nodeData.name.trim();
          }

          if ("outputVariable" in nodeData && typeof nodeData.outputVariable === "string" && nodeData.outputVariable.trim()) {
            nodeVar = nodeData.outputVariable.trim();
          }
        }

        steps.push({
          id: `node_${n.id}`,
          label: `Node: ${nodeName}`,
          fields: [
            {
              path: `${nodeVar}.content`,
              label: "content (text)",
              short: `${nodeVar}.content`,
              type: "string",
            },
            {
              path: `${nodeVar}.output`,
              label: "output (data)",
              short: `${nodeVar}.output`,
              type: "object",
            },
            {
              path: nodeVar,
              label: `${nodeVar} (whole)`,
              short: nodeVar,
              type: "object",
            },
          ],
        });
      });
    }

    // 4. Graph State Variables
    if (stateChannels.length > 0) {
      const stateFields: Array<{ path: string; label: string; short: string; type?: string }> = [];

      stateChannels
        .filter((c) => Boolean(c.key?.trim()))
        .forEach((c) => {
          const typeLabel = c.customTypeName ? c.customTypeName : c.type;
          stateFields.push({
            path: `state.${c.key}`,
            label: `state.${c.key} (${typeLabel})`,
            short: `state.${c.key}`,
            type: c.type,
          });

          // Check if custom type schema has fields
          let schema: CustomTypeItem | undefined = c.customTypeSchema;
          if (!schema && c.customTypeId && nodes && nodes.length > 0) {
            for (const n of nodes) {
              if (
                n &&
                n.type === LANGGRAPH_CANVAS_NODE_TYPES &&
                n.data &&
                typeof n.data === "object" &&
                "types" in n.data &&
                Array.isArray(n.data.types)
              ) {
                const found = n.data.types.find(
                  (t) =>
                    t &&
                    typeof t === "object" &&
                    "id" in t &&
                    t.id === c.customTypeId,
                );
                if (found) {
                  schema = found;
                  break;
                }
              }
            }
          }

          if (schema && schema.fields && Array.isArray(schema.fields)) {
            schema.fields.forEach((f) => {
              if (f && f.name && !f.isOmitted) {
                const fieldTypeStr = f.isArray ? `${f.type}[]` : f.type;
                stateFields.push({
                  path: `state.${c.key}.${f.name}`,
                  label: `state.${c.key}.${f.name} (${fieldTypeStr})`,
                  short: `state.${c.key}.${f.name}`,
                  type: f.type,
                });
              }
            });
          }
        });

      steps.push({
        id: "state",
        label: "Graph State (state.*)",
        fields: stateFields,
      });
    }

    return steps;
  }, [isStructured, schemaFields, selectedAgentData.pipelineSteps, selectedAgentData.id, stateChannels, nodes]);

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

    const effectiveCode =
      matchedCustom?.code ||
      channel?.customReducerCode ||
      getSuggestedReducerCodeForChannelType(channelType);

    return {
      channel,
      type: channelType,
      reducer: reducerName,
      isCustom: Boolean(matchedCustom || channel?.customReducerCode),
      customCode: effectiveCode,
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
        {/* Mapping Rows Header: 1. State Channel | 2. Reducer Action */}
        {stateUpdates.length > 0 && (
          <div className="flex items-center justify-between px-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <span className="w-[180px]">1. State Channel</span>
              <span className="w-[170px]">2. Reducer Action</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">
              {stateUpdates.length} update{stateUpdates.length > 1 ? "s" : ""}
            </span>
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
              channelMeta.type !== "object" &&
              matchedSchemaField.type &&
              !matchedSchemaField.type.startsWith(channelMeta.type) &&
              !(
                channelMeta.type === "array" &&
                matchedSchemaField.type.endsWith("[]")
              ),
          );

          // Available actions for this channel and reducer (auto-detected only!)
          const availableActions = getActionsForReducer(
            channelMeta.type,
            channelMeta.reducer,
            channelMeta.customCode,
          );

          const currentActionMeta = availableActions.find(
            (a) => a.action === (su.action || "default"),
          );

          const isValueless =
            su.source === "none" ||
            isValuelessAction(su.action) ||
            currentActionMeta?.requiresValue === false;

          // Check if channel expects object/JSON or user toggled JSON mode
          const expectsJson =
            channelMeta.type === "object" ||
            channelMeta.reducer === "merge_object";

          const isRowJsonMode =
            rowJsonOverrides[sIdx] !== undefined
              ? rowJsonOverrides[sIdx]
              : (expectsJson || (typeof su.value === "string" && (su.value.includes("\n") || su.value.trim().startsWith("{"))));

          // Determine active step and field in the helper for this row
          const activeStepId = rowRefStep[sIdx] || availableReferenceSteps[0]?.id || "response";
          const activeStepObj = availableReferenceSteps.find((st) => st.id === activeStepId) || availableReferenceSteps[0];
          const activeFieldPath = rowRefField[sIdx] || activeStepObj?.fields[0]?.path || "response.content";
          const activeFieldObj = activeStepObj?.fields.find((f) => f.path === activeFieldPath) || activeStepObj?.fields[0];

          // Format value description for preview
          const displayVal =
            su.value !== undefined && su.value !== ""
              ? su.value
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
            const updated = [...stateUpdates];
            const cur = updated[sIdx];
            if (!cur) return;

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

            updated[sIdx] = {
              ...cur,
              value: raw,
              source: nextSource,
              schemaField: nextSchemaField,
              mode: nextSource === "expression" ? "expression" : "set",
            };
            onUpdateAgent({ stateUpdates: updated });
          };

          const handleInsertRefAtCursor = (refString: string) => {
            const isJson = Boolean(isRowJsonMode);
            const el = isJson ? textareaRefs.current[sIdx] : inputRefs.current[sIdx];
            const currentVal = su.value !== undefined ? String(su.value) : "";

            let nextVal: string;
            let nextCursor = 0;

            if (el) {
              const start = el.selectionStart ?? el.value.length;
              const end = el.selectionEnd ?? el.value.length;
              nextVal = currentVal.substring(0, start) + refString + currentVal.substring(end);
              nextCursor = start + refString.length;
            } else {
              nextVal = currentVal ? `${currentVal} ${refString}` : refString;
              nextCursor = nextVal.length;
            }

            handleRawValueChange(nextVal);

            setTimeout(() => {
              const activeEl = isJson ? textareaRefs.current[sIdx] : inputRefs.current[sIdx];
              if (activeEl) {
                activeEl.focus();
                activeEl.setSelectionRange(nextCursor, nextCursor);
              }
            }, 50);
          };

          return (
            <div
              key={sIdx}
              className="flex flex-col gap-2.5 p-3 rounded-xl border bg-background/60 text-xs shadow-xs transition-all hover:border-border/80"
            >
              {/* ─── Top Row: 1. State Channel | 2. Reducer Action | Valueless Pill | Delete ─── */}
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap sm:flex-nowrap">
                  {/* 1. Target Channel */}
                  <div className="w-[180px] shrink-0">
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
                      <SelectTrigger className="h-7 text-xs bg-background font-mono px-2" title="Select State Channel">
                        <SelectValue placeholder="Select channel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground">
                            State Channels
                          </SelectLabel>
                          {stateChannels
                            .filter((ch: LangGraphStateChannel) => Boolean(ch.key?.trim()))
                            .map((ch: LangGraphStateChannel) => (
                              <SelectItem key={ch.key} value={ch.key}>
                                <div className="flex items-center gap-1.5 font-mono">
                                  <span className="font-semibold text-foreground">{ch.key}</span>
                                  <span className="text-[9px] text-muted-foreground font-sans">[{ch.type}]</span>
                                </div>
                              </SelectItem>
                            ))}
                          {!stateChannels.some((c: LangGraphStateChannel) => c.key === su.channelKey) && su.channelKey && (
                            <SelectItem value={su.channelKey}>
                              <span className="font-mono font-semibold">{su.channelKey}</span>
                            </SelectItem>
                          )}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 2. Reducer Action Combobox (auto-detected actions only) */}
                  <div className="w-[170px] shrink-0">
                    <Select
                      value={su.action || "default"}
                      onValueChange={(val: string) => {
                        const updated = [...stateUpdates];
                        const current = updated[sIdx];
                        if (!current) return;

                        const actMeta = availableActions.find((a) => a.action === val);
                        const isActValueless = isValuelessAction(val) || actMeta?.requiresValue === false;

                        if (isActValueless) {
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
                              nextValue = nextField ? `response.${nextField}` : undefined;
                            } else {
                              nextSource = channelMeta.type === "messages" ? "message_object" : "message_content";
                              nextValue = channelMeta.type === "messages" ? "response" : "response.content";
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
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs bg-background font-mono px-2" title="Select Action for this Reducer">
                        <SelectValue placeholder="Action" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase font-bold text-amber-400">
                            Reducer Actions ({channelMeta.channel?.key || su.channelKey})
                          </SelectLabel>
                          {availableActions.map((act) => (
                            <SelectItem key={act.action} value={act.action} className="font-mono text-xs">
                              <div className="flex items-center gap-1 font-semibold text-amber-300">
                                {act.action !== "default" && <span className="text-amber-400 text-[10px]">⚡</span>}
                                <span>{act.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Valueless pill (e.g. reset / clear) */}
                  {isValueless && (
                    <div className="flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-emerald-500/[0.08] border border-emerald-500/25 text-[10px] font-mono text-emerald-300">
                      <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>No value required ({su.action || "action"})</span>
                    </div>
                  )}
                </div>

                {/* Delete button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer"
                  onClick={() => {
                    const updated = stateUpdates.filter((_, i) => i !== sIdx);
                    onUpdateAgent({ stateUpdates: updated });
                  }}
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
                        onClick={() => {
                          setRowJsonOverrides((prev) => ({ ...prev, [sIdx]: !isRowJsonMode }));
                        }}
                        title={isRowJsonMode ? "Switch to single-line input" : "Switch to JSON / Multi-line Textarea"}
                      >
                        <Code2 className="w-2.5 h-2.5 mr-0.5" />
                        {isRowJsonMode ? "JSON Active" : "{ } JSON"}
                      </Button>
                    </div>
                  </div>

                  {/* Reference Insertion Helper Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 bg-secondary/20 p-2 rounded-lg border border-border/30 text-[10px] font-mono">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                        Insert Reference:
                      </span>

                      {/* Step Selector */}
                      <Select
                        value={activeStepId}
                        onValueChange={(sid) => {
                          setRowRefStep((prev) => ({ ...prev, [sIdx]: sid }));
                          const targetStep = availableReferenceSteps.find((st) => st.id === sid);
                          if (targetStep && targetStep.fields.length > 0) {
                            setRowRefField((prev) => ({ ...prev, [sIdx]: targetStep.fields[0]!.path }));
                          }
                        }}
                      >
                        <SelectTrigger className="h-6 text-[10px] font-mono bg-background min-w-[130px] max-w-[170px] px-2">
                          <SelectValue placeholder="Select Step" />
                        </SelectTrigger>
                        <SelectContent className="font-mono text-xs max-h-60">
                          {availableReferenceSteps.map((st) => (
                            <SelectItem key={st.id} value={st.id}>
                              {st.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <ArrowRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />

                      {/* Field Selector */}
                      <Select
                        value={activeFieldPath}
                        onValueChange={(fpath) => {
                          setRowRefField((prev) => ({ ...prev, [sIdx]: fpath }));
                        }}
                      >
                        <SelectTrigger className="h-6 text-[10px] font-mono bg-background min-w-[140px] max-w-[190px] px-2">
                          <SelectValue placeholder="Select Field" />
                        </SelectTrigger>
                        <SelectContent className="font-mono text-xs max-h-60">
                          {activeStepObj?.fields.map((f) => (
                            <SelectItem key={f.path} value={f.path}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <ArrowRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />

                      {/* Insert ${step.field} */}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px] font-mono bg-purple-500/10 text-purple-300 border-purple-500/30 hover:bg-purple-500/20 cursor-pointer"
                        onClick={() => handleInsertRefAtCursor(`\${${activeFieldPath}}`)}
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
                        onClick={() =>
                          handleRawValueChange(
                            isRowJsonMode
                              ? `{\n  "${activeFieldObj?.short?.split(".").pop() || "field"}": "\${${activeFieldPath}}"\n}`
                              : activeFieldPath,
                          )
                        }
                        title={`Set whole value directly to ${activeFieldPath}`}
                      >
                        Set Value
                      </Button>

                      {/* Map picker dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[10px] font-mono gap-1 border-border hover:bg-secondary/50 cursor-pointer text-muted-foreground hover:text-foreground"
                            title="Directly map from LLM output, structured fields, transformer steps, or state"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                            <span>Map</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto font-mono text-xs">
                          {/* 1. Structured Output Fields */}
                          {isStructured && schemaFields.length > 0 && (
                            <DropdownMenuGroup>
                              <DropdownMenuLabel className="text-[10px] uppercase font-bold text-purple-400 flex items-center gap-1">
                                <FileJson className="w-3 h-3" /> Structured Output Fields
                              </DropdownMenuLabel>
                              {schemaFields.map((f) => (
                                <DropdownMenuItem
                                  key={f.name}
                                  className="cursor-pointer flex items-center justify-between text-xs"
                                  onClick={() => handleRawValueChange(`response.${f.name}`)}
                                >
                                  <span className="font-semibold text-purple-300 truncate">
                                    response.{f.name}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground font-sans">
                                    {f.type || "string"}
                                  </span>
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuItem
                                className="cursor-pointer text-xs text-purple-400 font-semibold"
                                onClick={() => handleRawValueChange("response")}
                              >
                                response (Full Object)
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </DropdownMenuGroup>
                          )}

                          {/* 2. LLM Output */}
                          <DropdownMenuGroup>
                            <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                              <Zap className="w-3 h-3 text-amber-400" /> LLM Response
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                              className="cursor-pointer flex items-center justify-between text-xs"
                              onClick={() => handleRawValueChange("response.content")}
                            >
                              <span>response.content</span>
                              <span className="text-[9px] text-muted-foreground font-sans">(text)</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer flex items-center justify-between text-xs"
                              onClick={() => handleRawValueChange("response")}
                            >
                              <span>response</span>
                              <span className="text-[9px] text-muted-foreground font-sans">(AIMessage)</span>
                            </DropdownMenuItem>
                          </DropdownMenuGroup>

                          {/* 3. Pipeline Transformer Step Outputs */}
                          {transformerSteps.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuGroup>
                                <DropdownMenuLabel className="text-[10px] uppercase font-bold text-purple-400 flex items-center gap-1">
                                  <Shuffle className="w-3 h-3" /> Transformer Step Outputs
                                </DropdownMenuLabel>
                                {transformerSteps.map((ts) => {
                                  const varName = ts.outputVariable || ts.id;
                                  const returnFields =
                                    ts.outputSchema ||
                                    ts.functionRef?.returnSchema ||
                                    [];
                                  return (
                                    <React.Fragment key={ts.id}>
                                      <DropdownMenuItem
                                        className="cursor-pointer flex items-center justify-between text-xs text-purple-300"
                                        onClick={() => handleRawValueChange(varName)}
                                      >
                                        <span>{varName}</span>
                                        <span className="text-[9px] text-muted-foreground font-sans">(whole)</span>
                                      </DropdownMenuItem>
                                      {returnFields.map((rf) => (
                                        <DropdownMenuItem
                                          key={`${varName}.${rf.name}`}
                                          className="cursor-pointer flex items-center justify-between text-xs text-purple-300 pl-4"
                                          onClick={() => handleRawValueChange(`${varName}.${rf.name}`)}
                                        >
                                          <span>{varName}.{rf.name}</span>
                                          <span className="text-[9px] text-muted-foreground font-sans">({rf.type || "string"})</span>
                                        </DropdownMenuItem>
                                      ))}
                                    </React.Fragment>
                                  );
                                })}
                              </DropdownMenuGroup>
                            </>
                          )}

                          {/* 4. Graph State Channels */}
                          {stateChannels.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuGroup>
                                <DropdownMenuLabel className="text-[10px] uppercase font-bold text-sky-400 flex items-center gap-1">
                                  <Code2 className="w-3 h-3" /> State Variables
                                </DropdownMenuLabel>
                                {stateChannels
                                  .filter((ch) => ch.key?.trim())
                                  .map((ch) => (
                                    <DropdownMenuItem
                                      key={ch.key}
                                      className="cursor-pointer flex items-center justify-between text-xs text-sky-300"
                                      onClick={() => handleRawValueChange(`state.${ch.key}`)}
                                    >
                                      <span>state.{ch.key}</span>
                                      <span className="text-[9px] text-muted-foreground font-sans">({ch.type || "string"})</span>
                                    </DropdownMenuItem>
                                  ))}
                              </DropdownMenuGroup>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Quick Click Reference Chips */}
                  <div className="flex items-center gap-1 flex-wrap px-0.5">
                    <span className="text-[9px] text-muted-foreground/70 font-mono">Quick:</span>
                    <button
                      type="button"
                      onClick={() => handleInsertRefAtCursor("${response.content}")}
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-border/50 bg-secondary/30 hover:bg-purple-500/15 hover:border-purple-500/40 text-muted-foreground hover:text-purple-300 transition-colors cursor-pointer"
                    >
                      + {'${response.content}'}
                    </button>
                    {isStructured &&
                      schemaFields.slice(0, 3).map((f) => (
                        <button
                          key={f.name}
                          type="button"
                          onClick={() => handleInsertRefAtCursor(`\${response.${f.name}}`)}
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 transition-colors cursor-pointer"
                        >
                          + {'${response.'}{f.name}{'}'}
                        </button>
                      ))}
                    {stateChannels.slice(0, 2).map((sc) => (
                      <button
                        key={sc.key}
                        type="button"
                        onClick={() => handleInsertRefAtCursor(`\${state.${sc.key}}`)}
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 transition-colors cursor-pointer"
                      >
                        + {'${state.'}{sc.key}{'}'}
                      </button>
                    ))}
                  </div>

                  {/* Value Editor: Textarea (JSON / multiline) or LocalInput (single line) */}
                  {isRowJsonMode ? (
                    <LocalTextarea
                      ref={(el) => {
                        textareaRefs.current[sIdx] = el;
                      }}
                      className="min-h-[90px] text-xs bg-background font-mono leading-relaxed p-2.5 border-border focus-visible:ring-purple-500/40 resize-y"
                      placeholder={`{\n  "field": "\${response.content}"\n}`}
                      value={su.value ?? ""}
                      onChange={(e) => handleRawValueChange(e.target.value)}
                    />
                  ) : (
                    <LocalInput
                      ref={(el) => {
                        inputRefs.current[sIdx] = el;
                      }}
                      className="h-8 text-xs bg-background font-mono px-2.5 w-full"
                      placeholder={
                        su.action === "increment" || su.action === "decrement"
                          ? "1 or state.delta"
                          : channelMeta.type === "number"
                            ? "42 or state.count + 1"
                            : channelMeta.type === "boolean"
                              ? "true or false"
                              : isStructured && schemaFields.length > 0
                                ? "response.field or literal"
                                : 'response.content or "literal"'
                      }
                      value={
                        su.value !== undefined
                          ? su.value
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
                        Type mismatch: Channel is {channelMeta.type}, but mapped field &apos;{matchedSchemaField?.name}&apos; is {matchedSchemaField?.type}.
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
