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
  Braces,
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
import {
  LANGGRAPH_CANVAS_NODE_TYPES,
  LANGGRAPH_CANVAS_NODE_TYPES_REF,
  isTypesNode,
  isTypesRefNode,
  type LangGraphTypesNode,
} from "@workspace/canvas";
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
  extractFieldsFromCustomType,
  type ReducerActionMeta,
} from "../state-inspector/constants";

export {
  extractActionsFromReducerCode,
  isValuelessAction,
  getActionsForReducer,
  getActionMetadata,
  getSuggestedReducerCodeForChannelType,
  extractFieldsFromCustomType,
};
export type { ReducerActionMeta };

/**
 * Extracts all available custom types across canvas nodes and embedded state channel schemas.
 */
export function extractAvailableCustomTypes(
  nodes: LangGraphCanvasNode[] = [],
  stateChannels: LangGraphStateChannel[] = [],
): CustomTypeItem[] {
  const types: CustomTypeItem[] = [];

  const addType = (t?: CustomTypeItem | null) => {
    if (
      t &&
      t.name &&
      !types.some((existing) => existing.id === t.id || existing.name === t.name)
    ) {
      types.push(t);
    }
  };

  if (Array.isArray(nodes)) {
    nodes.forEach((n) => {
      if (!n) return;
      if (isTypesNode(n) && n.data?.types) {
        n.data.types.forEach(addType);
      } else if (isTypesRefNode(n) && n.data?.typesRef) {
        const master = nodes.find(
          (m): m is LangGraphTypesNode => isTypesNode(m) && m.id === n.data.typesRef,
        );
        if (master?.data?.types) {
          master.data.types.forEach(addType);
        }
      } else if (
        typeof n === "object" &&
        "data" in n &&
        n.data &&
        typeof n.data === "object" &&
        "types" in n.data &&
        Array.isArray((n.data as { types?: CustomTypeItem[] }).types)
      ) {
        (n.data as { types?: CustomTypeItem[] }).types?.forEach(addType);
      }
    });
  }

  if (Array.isArray(stateChannels)) {
    stateChannels.forEach((ch) => {
      if (ch.customTypeSchema) {
        addType(ch.customTypeSchema);
      }
    });
  }

  return types;
}

/**
 * Resolves the CustomTypeItem matching a given state channel if configured with a custom type.
 */
export function resolveCustomTypeForChannel(
  channel: LangGraphStateChannel | undefined,
  availableCustomTypes: CustomTypeItem[] = [],
): CustomTypeItem | undefined {
  if (!channel) return undefined;
  if (channel.customTypeSchema) return channel.customTypeSchema;
  if (channel.customTypeId) {
    const byId = availableCustomTypes.find((t) => t.id === channel.customTypeId);
    if (byId) return byId;
  }
  if (channel.customTypeName) {
    const byName = availableCustomTypes.find((t) => t.name === channel.customTypeName);
    if (byName) return byName;
  }
  return undefined;
}

/**
 * Returns user-facing type label for a channel (e.g. "MyType" instead of generic "object").
 */
export function getChannelDisplayType(
  channel: LangGraphStateChannel | undefined,
  availableCustomTypes: CustomTypeItem[] = [],
): string {
  if (!channel) return "string";
  if (channel.customTypeName) return channel.customTypeName;
  const resolved = resolveCustomTypeForChannel(channel, availableCustomTypes);
  if (resolved?.name) return resolved.name;
  return channel.type || "string";
}

export interface TransformerStepFieldLike {
  name: string;
  type?: string;
  required?: boolean;
  description?: string;
}

export interface TransformerStepLike {
  id: string;
  outputVariable?: string;
  outputSchema?: TransformerStepFieldLike[];
  functionRef?: { returnSchema?: TransformerStepFieldLike[] };
}

/**
 * Auto-generates a formatted dispatch JSON body (or scalar value) matching the channel's type/schema.
 * Intelligently binds fields to structured output fields (`response.<field>`), transformer outputs,
 * or active references (`${response.content}`).
 */
type DispatchFieldValue =
  | string
  | number
  | boolean
  | Array<string | number | boolean>;

export interface SchemaFieldLike {
  name: string;
  type?: string;
  required?: boolean;
  description?: string;
}

export function generateDispatchBodyForChannel(
  channel: LangGraphStateChannel | undefined,
  availableCustomTypes: CustomTypeItem[] = [],
  schemaFields: SchemaFieldLike[] = [],
  transformerSteps: TransformerStepLike[] = [],
  fallbackRef: string = "response.content",
): string {
  if (!channel) return "";

  const customSchema = resolveCustomTypeForChannel(channel, availableCustomTypes);
  const fields = extractFieldsFromCustomType(customSchema);

  if (fields.length > 0) {
    const obj: Record<string, DispatchFieldValue> = {};
    fields.forEach((f) => {
      const cleanFieldName = f.name.toLowerCase();

      // 1. Check if structured output has a matching field
      const matchedSchema = schemaFields.find(
        (sf) => sf.name.toLowerCase() === cleanFieldName,
      );
      if (matchedSchema) {
        obj[f.name] = `\${response.${matchedSchema.name}}`;
        return;
      }

      // 2. Check if any transformer step has a matching return field
      for (const ts of transformerSteps) {
        const outVar = ts.outputVariable || ts.id;
        const returnSchema = ts.outputSchema || ts.functionRef?.returnSchema || [];
        const rf = returnSchema.find((r) => r.name.toLowerCase() === cleanFieldName);
        if (rf) {
          obj[f.name] = `\${${outVar}.${rf.name}}`;
          return;
        }
      }

      // 3. Fallback based on field type
      const fType = (f.type || "").toLowerCase();
      if (fType === "number" || fType === "int" || fType === "float") {
        obj[f.name] = 0;
      } else if (fType === "boolean" || fType === "bool") {
        obj[f.name] = false;
      } else if (fType === "array" || fType.endsWith("[]")) {
        obj[f.name] = [];
      } else {
        // Map to ${response.<fieldName>} matching this property's name, not generic response.content!
        const isCustomFallback = Boolean(
          fallbackRef &&
            fallbackRef !== "response.content" &&
            fallbackRef !== "${response.content}",
        );
        obj[f.name] = isCustomFallback
          ? (fallbackRef.startsWith("${") && fallbackRef.endsWith("}")
              ? fallbackRef
              : `\${${fallbackRef}}`)
          : `\${response.${f.name}}`;
      }
    });

    const jsonStr = JSON.stringify(obj, null, 2);
    return jsonStr.replace(/"(\$\{[^"]+\})"/g, "`$1`");
  }

  // Generic object channel without custom type schema
  if (channel.type === "object" || channel.reducer === "merge_object") {
    if (schemaFields.length > 0) {
      const obj: Record<string, string> = {};
      schemaFields.forEach((sf) => {
        obj[sf.name] = `\${response.${sf.name}}`;
      });
      return JSON.stringify(obj, null, 2).replace(/"(\$\{[^"]+\})"/g, "`$1`");
    }
    const cleanRef =
      fallbackRef.startsWith("${") && fallbackRef.endsWith("}")
        ? fallbackRef
        : `\${${fallbackRef || "response.content"}}`;
    return `{\n  "field": \`${cleanRef}\`\n}`;
  }

  // Array channel
  if (channel.type === "array") {
    const cleanRef =
      fallbackRef.startsWith("${") && fallbackRef.endsWith("}")
        ? fallbackRef
        : `\${${fallbackRef || "response.content"}}`;
    return `[\n  \`${cleanRef}\`\n]`;
  }

  // Primitives
  if (channel.type === "number") return "0";
  if (channel.type === "boolean") return "true";

  return fallbackRef.startsWith("${") && fallbackRef.endsWith("}")
    ? fallbackRef
    : `\${${fallbackRef || "response.content"}}`;
}

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

  const availableCustomTypes = useMemo(
    () => extractAvailableCustomTypes(nodes, stateChannels),
    [nodes, stateChannels],
  );

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

  // Auto-heal uninitialized or legacy scalar state updates that target object / custom type channels
  React.useEffect(() => {
    let hasChanges = false;
    const updated: LangGraphStateUpdateItem[] = stateUpdates.map(
      (su): LangGraphStateUpdateItem => {
        const channel = stateChannels.find((c) => c.key === su.channelKey);
        const isCustom = Boolean(
          channel?.customTypeName ||
            resolveCustomTypeForChannel(channel, availableCustomTypes),
        );
        const expectsJson =
          channel?.type === "object" ||
          channel?.reducer === "merge_object" ||
          isCustom;

        const hasDoubleQuotedTemplates = Boolean(
          su.value && su.value.includes('"${'),
        );

        if (
          expectsJson &&
          (su.value === "response.content" ||
            !su.value?.trim() ||
            su.source === "message_content" ||
            hasDoubleQuotedTemplates)
        ) {
          hasChanges = true;
          const generatedBody =
            hasDoubleQuotedTemplates && su.value
              ? su.value.replace(/"(\$\{[^"]+\})"/g, "`$1`")
              : generateDispatchBodyForChannel(
                  channel,
                  availableCustomTypes,
                  schemaFields,
                  transformerSteps,
                );
          return {
            ...su,
            value: generatedBody,
            source: "expression",
            mode: "expression",
          };
        }
        return su;
      },
    );

    if (hasChanges) {
      onUpdateAgent({ stateUpdates: updated });
    }
  }, [stateUpdates, stateChannels, availableCustomTypes, schemaFields, transformerSteps, onUpdateAgent]);

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



    // 4. Graph State Variables
    if (stateChannels.length > 0) {
      const stateFields: Array<{ path: string; label: string; short: string; type?: string }> = [];

      stateChannels
        .filter((c) => Boolean(c.key?.trim()))
        .forEach((c) => {
          const typeLabel = getChannelDisplayType(c, availableCustomTypes);
          stateFields.push({
            path: `state.${c.key}`,
            label: `state.${c.key} (${typeLabel})`,
            short: `state.${c.key}`,
            type: c.type,
          });

          // Check if custom type schema has fields
          const schema = resolveCustomTypeForChannel(c, availableCustomTypes);
          const fields = extractFieldsFromCustomType(schema);

          if (fields.length > 0) {
            fields.forEach((f) => {
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
  }, [isStructured, schemaFields, selectedAgentData.pipelineSteps, selectedAgentData.id, stateChannels, availableCustomTypes]);

  // Helper to get channel details and its active reducer
  const getChannelMeta = (channelKey: string) => {
    const channel = stateChannels.find((c) => c.key === channelKey);
    const channelType = channel?.type || "string";
    const customType = resolveCustomTypeForChannel(channel, availableCustomTypes);
    const customTypeName = channel?.customTypeName || customType?.name;
    const customTypeSchema = channel?.customTypeSchema || customType;
    const displayType = customTypeName || channelType;

    const reducerName =
      channel?.reducer ||
      (channelType === "messages" ? "add_messages" : "replace");

    const matchedCustom = customReducers.find(
      (r) => r.name === reducerName || r.id === reducerName || r.targetField === channelKey,
    );

    const effectiveCode =
      matchedCustom?.code ||
      channel?.customReducerCode ||
      getSuggestedReducerCodeForChannelType(channelType, customTypeSchema);

    return {
      channel,
      type: channelType,
      customTypeName,
      customTypeSchema,
      customTypeId: channel?.customTypeId || customType?.id,
      displayType,
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
              const defMeta = getChannelMeta(defaultKey);
              const isDefCustom = Boolean(defMeta.customTypeName || defMeta.customTypeSchema);
              const defExpectsJson = defMeta.type === "object" || defMeta.reducer === "merge_object" || isDefCustom;

              let defaultSource: StateUpdateSource = "literal";
              let defaultField = "";
              let defaultValue: string | undefined = undefined;

              if (defExpectsJson) {
                defaultValue = generateDispatchBodyForChannel(
                  defaultChannel,
                  availableCustomTypes,
                  schemaFields,
                  transformerSteps,
                  "response.content",
                );
                defaultSource = "expression";
              } else if (isStructured && schemaFields.length > 0) {
                defaultSource = "structured_field";
                defaultField = schemaFields[0]?.name || "";
                defaultValue = defaultField;
              } else {
                defaultSource = "message_content";
                defaultValue = "response.content";
              }

              onUpdateAgent({
                stateUpdates: [
                  ...stateUpdates,
                  {
                    channelKey: defaultKey,
                    reducer: defaultReducer,
                    action: "default",
                    source: defaultSource,
                    schemaField: defaultSource === "structured_field" ? defaultField : undefined,
                    mode: defaultSource === "expression" ? "expression" : "set",
                    value: defaultValue,
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

          const currentActionMeta = availableActions.find(
            (a) => a.action === (su.action || "default"),
          );

          const isValueless =
            su.source === "none" ||
            isValuelessAction(su.action) ||
            currentActionMeta?.requiresValue === false;

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
                          const isCustom = Boolean(chMeta.customTypeName || chMeta.customTypeSchema);
                          const expectsJson = chMeta.type === "object" || chMeta.reducer === "merge_object" || isCustom;

                          let nextValue = current.value;
                          let nextSource = current.source;
                          let nextMode = current.mode;

                          // Auto-generate dispatch body when selecting an object / custom type channel if value is empty or simple scalar default
                          if (
                            expectsJson &&
                            (!nextValue ||
                              nextValue === "response.content" ||
                              nextValue === "response" ||
                              nextValue === current.schemaField ||
                              !nextValue.trim().startsWith("{"))
                          ) {
                            nextValue = generateDispatchBodyForChannel(
                              chMeta.channel,
                              availableCustomTypes,
                              schemaFields,
                              transformerSteps,
                              activeFieldPath,
                            );
                            nextSource = "expression";
                            nextMode = "expression";
                          }

                          updated[sIdx] = {
                            ...current,
                            channelKey: v,
                            reducer: chMeta.reducer,
                            action: "default",
                            value: nextValue,
                            source: nextSource,
                            mode: nextMode,
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
                            .map((ch: LangGraphStateChannel) => {
                              const dispType = getChannelDisplayType(ch, availableCustomTypes);
                              const isCustom = Boolean(
                                ch.customTypeName ||
                                  resolveCustomTypeForChannel(ch, availableCustomTypes),
                              );
                              return (
                                <SelectItem key={ch.key} value={ch.key}>
                                  <div className="flex items-center gap-1.5 font-mono">
                                    <span className="font-semibold text-foreground">{ch.key}</span>
                                    <span
                                      className={`text-[9px] ${
                                        isCustom
                                          ? "text-cyan-400 font-semibold"
                                          : "text-muted-foreground font-sans"
                                      }`}
                                    >
                                      [{dispType}]
                                    </span>
                                  </div>
                                </SelectItem>
                              );
                            })}
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
                            } else if (expectsJson) {
                              nextSource = "expression";
                              nextValue = generateDispatchBodyForChannel(
                                channelMeta.channel,
                                availableCustomTypes,
                                schemaFields,
                                transformerSteps,
                              );
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
                                  .map((ch) => {
                                    const dispType = getChannelDisplayType(ch, availableCustomTypes);
                                    const schema = resolveCustomTypeForChannel(ch, availableCustomTypes);
                                    const fields = extractFieldsFromCustomType(schema);

                                    return (
                                      <React.Fragment key={ch.key}>
                                        <DropdownMenuItem
                                          className="cursor-pointer flex items-center justify-between text-xs text-sky-300"
                                          onClick={() => handleRawValueChange(`state.${ch.key}`)}
                                        >
                                          <span>state.{ch.key}</span>
                                          <span className="text-[9px] text-muted-foreground font-sans">
                                            ({dispType})
                                          </span>
                                        </DropdownMenuItem>
                                        {fields.map((f) => (
                                          <DropdownMenuItem
                                            key={`${ch.key}.${f.name}`}
                                            className="cursor-pointer flex items-center justify-between text-xs text-sky-300 pl-4"
                                            onClick={() => handleRawValueChange(`state.${ch.key}.${f.name}`)}
                                          >
                                            <span>state.{ch.key}.{f.name}</span>
                                            <span className="text-[9px] text-muted-foreground font-sans">
                                              ({f.type || "string"})
                                            </span>
                                          </DropdownMenuItem>
                                        ))}
                                      </React.Fragment>
                                    );
                                  })}
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
                      ref={(el) => {
                        textareaRefs.current[sIdx] = el;
                      }}
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
                              : isCustomChannel
                                ? `e.g. response or { ... } for ${channelDisplayType}`
                                : isStructured && schemaFields.length > 0
                                  ? "response.field or literal"
                                  : 'response.content or "literal"'
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
