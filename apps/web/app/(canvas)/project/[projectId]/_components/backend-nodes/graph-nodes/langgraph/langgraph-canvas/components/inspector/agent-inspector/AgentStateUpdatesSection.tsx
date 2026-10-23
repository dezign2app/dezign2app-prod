import React, { useMemo, useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import type {
  LangGraphStateChannel,
  LangGraphCustomReducer,
  AgentNodeData,
  LangGraphStateUpdateItem,
  StateUpdateSource,
  StateUpdateMode,
  LangGraphCanvasNode,
  CustomTypeItem,
} from "@workspace/canvas";
import type { Parameter } from "@/types/canvas";
import type {
  AvailableSource,
  AvailablePath,
} from "@/app/(canvas)/project/[projectId]/_components/config-sidebar/pipeline-step-editor/types";
import { parseSchemaJsonToFields } from "./AgentStructuredOutputSection";
import { toCamelCase } from "./AgentPromptVariablePicker";

import type {
  AgentStateUpdatesSectionProps,
  TransformerStepLike,
  TransformerStepFieldLike,
  SchemaFieldLike,
  ReferenceStep,
  ReferenceStepField,
  ChannelMeta,
  DispatchFieldValue,
} from "./state-updates/types";
import {
  extractActionsFromReducerCode,
  isValuelessAction,
  getActionsForReducer,
  getActionMetadata,
  getSuggestedReducerCodeForChannelType,
  extractFieldsFromCustomType,
  extractAvailableCustomTypes,
  resolveCustomTypeForChannel,
  getChannelDisplayType,
  generateDispatchBodyForChannel,
  getChannelMeta,
  stateUpdateToBinding,
  bindingToStateUpdate,
  type ReducerActionMeta,
} from "./state-updates/utils";
import { useAvailableReferenceSteps } from "./state-updates/useAvailableReferenceSteps";
import { AgentStateUpdatesHeader } from "./state-updates/AgentStateUpdatesHeader";
import { AgentStateUpdateRow } from "./state-updates/AgentStateUpdateRow";

export {
  extractActionsFromReducerCode,
  isValuelessAction,
  getActionsForReducer,
  getActionMetadata,
  getSuggestedReducerCodeForChannelType,
  extractFieldsFromCustomType,
  extractAvailableCustomTypes,
  resolveCustomTypeForChannel,
  getChannelDisplayType,
  generateDispatchBodyForChannel,
  getChannelMeta,
  stateUpdateToBinding,
  bindingToStateUpdate,
};
export type {
  ReducerActionMeta,
  AgentStateUpdatesSectionProps,
  TransformerStepLike,
  TransformerStepFieldLike,
  SchemaFieldLike,
  ReferenceStep,
  ReferenceStepField,
  ChannelMeta,
  DispatchFieldValue,
};

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

  const [rowJsonOverrides, setRowJsonOverrides] = useState<Record<number, boolean>>({});

  const isStructured = Boolean(selectedAgentData.responseFormat?.enabled);
  const schemaJson = selectedAgentData.responseFormat?.schemaJson || "";

  // Parse structured output fields if enabled
  const schemaFields: Parameter[] = useMemo(() => {
    if (!isStructured || !schemaJson.trim()) return [];
    return parseSchemaJsonToFields(schemaJson).fields;
  }, [isStructured, schemaJson]);

  // Extract pipeline transformer steps
  const transformerSteps: TransformerStepLike[] = useMemo(() => {
    const pSteps = selectedAgentData.pipelineSteps || [];
    return pSteps.filter(
      (s) => s.type === "transformer" || s.type === "transform",
    );
  }, [selectedAgentData.pipelineSteps]);

  // Build introspectable AvailableSource list for PipelineStepEditor-style BindingSourceEditor
  const availableSources: AvailableSource[] = useMemo(() => {
    const list: AvailableSource[] = [];

    // 1. Pipeline Steps (e.g. llmAg, tools, custom code)
    const pSteps = selectedAgentData.pipelineSteps || [];
    pSteps.forEach((ps, idx) => {
      const stepNum = idx + 1;
      const stepVar = ps.outputVariable || ps.id || `step${stepNum}`;
      const rawStepName = ps.label || ps.name || ps.type;
      const stepName = toCamelCase(rawStepName) || rawStepName;
      const stepLabel = `${stepName} (${stepVar})`;

      const stepPaths: AvailablePath[] = [
        { path: "", type: "object", description: `Whole step output (${stepVar})` },
      ];

      const returnSchema = ps.outputSchema || ps.functionRef?.returnSchema || [];
      returnSchema.forEach((rf) => {
        if (rf.name?.trim()) {
          stepPaths.push({
            path: rf.name.trim(),
            type: rf.type || "string",
            description: rf.description || `${stepVar}.${rf.name.trim()}`,
          });
        }
      });

      if (ps.type === "custom_code") {
        stepPaths.push({ path: "result", type: "string", description: "Execution result" });
      } else if (ps.type === "tools") {
        stepPaths.push(
          { path: "output", type: "object", description: "Tool output" },
          { path: "content", type: "string", description: "Tool text content" },
        );
      } else if (ps.type === "llm_call") {
        stepPaths.push(
          { path: "content", type: "string", description: "LLM text content" },
          { path: "response", type: "object", description: "LLM response object" },
        );
        if (isStructured && schemaFields.length > 0) {
          for (const sf of schemaFields) {
            if (!sf.name?.trim()) continue;
            stepPaths.push({
              path: sf.name.trim(),
              type: sf.type || "string",
              description: sf.description || `Structured field: ${sf.name.trim()}`,
            });
          }
        }
        stepPaths.push(
          { path: "role", type: "string", description: "Message role (assistant)" },
          { path: "tool_calls", type: "array", description: "Tool calls array" },
        );
      }

      list.push({
        id: `step:${ps.id || stepVar}`,
        label: stepLabel,
        kind: "step_output",
        stepId: ps.id || stepVar,
        variableName: stepVar,
        rootVariableName: stepVar,
        paths: stepPaths,
      });
    });

    // 3. Graph State
    if (stateChannels.length > 0) {
      const statePaths: AvailablePath[] = [];
      stateChannels.forEach((c) => {
        if (!c.key?.trim()) return;
        const typeLabel = getChannelDisplayType(c, availableCustomTypes);
        statePaths.push({
          path: c.key,
          type: typeLabel,
          description: `Channel: ${c.key} (${typeLabel})`,
        });

        const schema = resolveCustomTypeForChannel(c, availableCustomTypes);
        const fields = extractFieldsFromCustomType(schema);
        if (fields.length > 0) {
          fields.forEach((f) => {
            if (f && f.name && !f.isOmitted) {
              const fieldTypeStr = f.isArray ? `${f.type}[]` : f.type;
              statePaths.push({
                path: `${c.key}.${f.name}`,
                type: fieldTypeStr,
                description: `${c.key}.${f.name} (${fieldTypeStr})`,
              });
            }
          });
        }
      });

      list.push({
        id: "state",
        label: "Graph State (state)",
        kind: "state",
        variableName: "state",
        rootVariableName: "state",
        paths: statePaths,
      });
    }

    // 4. Inline
    list.push({
      id: "inline",
      label: "Inline (Custom / Text / JSON)",
      kind: "inline",
      paths: [],
    });

    return list;
  }, [
    selectedAgentData.pipelineSteps,
    isStructured,
    schemaFields,
    stateChannels,
    availableCustomTypes,
  ]);

  // Legacy available reference steps for backwards compatibility
  const availableReferenceSteps = useAvailableReferenceSteps({
    isStructured,
    schemaFields,
    pipelineSteps: selectedAgentData.pipelineSteps,
    stateChannels,
    availableCustomTypes,
  });

  // Auto-heal uninitialized or legacy scalar state updates that target object / custom type channels
  useEffect(() => {
    let hasChanges = false;
    const updated: LangGraphStateUpdateItem[] = stateUpdates.map(
      (su): LangGraphStateUpdateItem => {
        let currentItem = su;
        if (currentItem.action === "custom") {
          hasChanges = true;
          currentItem = { ...currentItem, action: "default" };
        }

        const channel = stateChannels.find((c) => c.key === currentItem.channelKey);
        const isCustom = Boolean(
          channel?.customTypeName ||
            resolveCustomTypeForChannel(channel, availableCustomTypes),
        );
        const expectsJson =
          channel?.type === "object" ||
          channel?.reducer === "merge_object" ||
          isCustom;

        const hasDoubleQuotedTemplates = Boolean(
          currentItem.value && currentItem.value.includes('"${'),
        );

        if (
          expectsJson &&
          (currentItem.value === "response.content" ||
            !currentItem.value?.trim() ||
            currentItem.source === "message_content" ||
            hasDoubleQuotedTemplates)
        ) {
          hasChanges = true;
          const generatedBody =
            hasDoubleQuotedTemplates && currentItem.value
              ? currentItem.value.replace(/"(\$\{[^"]+\})"/g, "`$1`")
              : generateDispatchBodyForChannel(
                  channel,
                  availableCustomTypes,
                  schemaFields,
                  transformerSteps,
                );
          return {
            ...currentItem,
            value: generatedBody,
            source: "expression",
            mode: "expression",
          };
        }

        // Auto-heal standalone ${...} in non-JSON channels (e.g. "${response.content}" -> "response" or "response.content")
        if (!expectsJson && currentItem.value) {
          const trimmed = currentItem.value.trim();
          if (
            trimmed.startsWith("${") &&
            trimmed.endsWith("}") &&
            !trimmed.slice(2, -1).includes("${")
          ) {
            hasChanges = true;
            const unwrapped = trimmed.slice(2, -1).trim();
            const isMessages =
              currentItem.channelKey === "messages" || channel?.type === "messages";
            const finalVal =
              isMessages && (unwrapped === "response.content" || unwrapped === "response")
                ? "response"
                : unwrapped;
            const finalSource =
              finalVal === "response"
                ? "message_object"
                : finalVal === "response.content"
                  ? "message_content"
                  : "expression";
            return {
              ...currentItem,
              value: finalVal,
              source: finalSource,
              mode: finalSource === "expression" ? "expression" : "set",
            };
          }
        }
        return currentItem;
      },
    );

    if (hasChanges) {
      onUpdateAgent({ stateUpdates: updated });
    }
  }, [
    stateUpdates,
    stateChannels,
    availableCustomTypes,
    schemaFields,
    transformerSteps,
    onUpdateAgent,
  ]);

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

  const handleAddUpdate = () => {
    const defaultChannel =
      stateChannels.find((c) => c.key !== "messages") ||
      stateChannels[0];
    const defaultKey = defaultChannel?.key || "status";
    const defaultReducer = defaultChannel?.reducer || "replace";
    const defMeta = getChannelMeta(
      defaultKey,
      stateChannels,
      customReducers,
      availableCustomTypes,
    );
    const isDefCustom = Boolean(
      defMeta.customTypeName || defMeta.customTypeSchema,
    );
    const defExpectsJson =
      defMeta.type === "object" ||
      defMeta.reducer === "merge_object" ||
      isDefCustom;

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

    const defaultMode: StateUpdateMode =
      defaultSource === "expression" ? "expression" : "set";

    onUpdateAgent({
      stateUpdates: [
        ...stateUpdates,
        {
          channelKey: defaultKey,
          reducer: defaultReducer,
          action: "default",
          source: defaultSource,
          schemaField: defaultSource === "structured_field" ? defaultField : undefined,
          mode: defaultMode,
          value: defaultValue,
        },
      ],
    });
  };

  const handleUpdateRow = (
    sIdx: number,
    updater: (prev: LangGraphStateUpdateItem) => LangGraphStateUpdateItem,
  ) => {
    const nextUpdates = stateUpdates.map((item, i) =>
      i === sIdx ? updater(item) : item,
    );
    onUpdateAgent({ stateUpdates: nextUpdates });
  };

  const handleRemoveRow = (sIdx: number) => {
    const nextUpdates = stateUpdates.filter((_, i) => i !== sIdx);
    onUpdateAgent({ stateUpdates: nextUpdates });
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
        <AgentStateUpdatesHeader
          isStructured={isStructured}
          schemaFields={schemaFields}
          stateUpdatesCount={stateUpdates.length}
          onAddUpdate={handleAddUpdate}
          onAutoMap={handleAutoMap}
          onMapAll={handleMapAll}
        />

        {/* State Updates List (PipelineStepEditor style) */}
        {stateUpdates.map((su: LangGraphStateUpdateItem, sIdx: number) => (
          <AgentStateUpdateRow
            key={sIdx}
            su={su}
            sIdx={sIdx}
            stateChannels={stateChannels}
            availableCustomTypes={availableCustomTypes}
            customReducers={customReducers}
            schemaFields={schemaFields}
            transformerSteps={transformerSteps}
            availableSources={availableSources}
            availableReferenceSteps={availableReferenceSteps}
            isStructured={isStructured}
            isJsonOverride={rowJsonOverrides[sIdx]}
            onToggleJsonOverride={() => {
              setRowJsonOverrides((prev) => ({
                ...prev,
                [sIdx]: !(prev[sIdx] ?? false),
              }));
            }}
            onUpdateRow={(updater) => handleUpdateRow(sIdx, updater)}
            onRemoveRow={() => handleRemoveRow(sIdx)}
          />
        ))}

        {/* Unmapped Schema Fields Banner */}
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
