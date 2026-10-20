import React, { useMemo, useState, useRef, useEffect } from "react";
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
import { parseSchemaJsonToFields } from "./AgentStructuredOutputSection";

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

  // Reference insertion step & field per row
  const [rowRefStep, setRowRefStep] = useState<Record<number, string>>({});
  const [rowRefField, setRowRefField] = useState<Record<number, string>>({});
  const [rowJsonOverrides, setRowJsonOverrides] = useState<Record<number, boolean>>({});

  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const textareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});

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

  // Available reference steps and fields for insertion
  const availableReferenceSteps = useAvailableReferenceSteps({
    isStructured,
    schemaFields,
    pipelineSteps: selectedAgentData.pipelineSteps,
    stateChannels,
    availableCustomTypes,
  });

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

  const handleInsertRefAtCursor = (sIdx: number, refString: string) => {
    const su = stateUpdates[sIdx];
    if (!su) return;
    const channelMeta = getChannelMeta(
      su.channelKey,
      stateChannels,
      customReducers,
      availableCustomTypes,
    );
    const isCustomChannel = Boolean(
      channelMeta.customTypeName || channelMeta.customTypeSchema,
    );
    const expectsJson =
      channelMeta.type === "object" ||
      channelMeta.reducer === "merge_object" ||
      isCustomChannel;
    const isRowJsonMode =
      rowJsonOverrides[sIdx] !== undefined
        ? rowJsonOverrides[sIdx]
        : expectsJson ||
          Boolean(su.value && (su.value.includes("\n") || su.value.trim().startsWith("{")));

    const el = isRowJsonMode ? textareaRefs.current[sIdx] : inputRefs.current[sIdx];
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

    let nextSource: StateUpdateSource = "literal";
    let nextSchemaField: string | undefined = undefined;

    const cleanMatch = nextVal.replace(/^response\??\./, "").trim();
    const matchedField = schemaFields.find(
      (f) => f.name === cleanMatch || f.name === nextVal,
    );

    if (matchedField) {
      nextSource = "structured_field";
      nextSchemaField = matchedField.name;
    } else if (nextVal === "response.content") {
      nextSource = "message_content";
    } else if (nextVal === "response") {
      nextSource = "message_object";
    } else if (
      nextVal.startsWith("state.") ||
      nextVal.includes("${") ||
      transformerSteps.some(
        (ts) =>
          ts.outputVariable &&
          (nextVal === ts.outputVariable || nextVal.startsWith(`${ts.outputVariable}.`)),
      )
    ) {
      nextSource = "expression";
    } else {
      nextSource = "literal";
    }

    const nextMode: StateUpdateMode =
      nextSource === "expression" ? "expression" : "set";

    const updated = stateUpdates.map((item, i) =>
      i === sIdx
        ? {
            ...item,
            value: nextVal,
            source: nextSource,
            schemaField: nextSchemaField,
            mode: nextMode,
          }
        : item,
    );
    onUpdateAgent({ stateUpdates: updated });

    setTimeout(() => {
      const activeEl = isRowJsonMode ? textareaRefs.current[sIdx] : inputRefs.current[sIdx];
      if (activeEl) {
        activeEl.focus();
        activeEl.setSelectionRange(nextCursor, nextCursor);
      }
    }, 50);
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

        {/* State Updates List */}
        {stateUpdates.map((su: LangGraphStateUpdateItem, sIdx: number) => {
          const activeStepId =
            rowRefStep[sIdx] || availableReferenceSteps[0]?.id || "response";
          const activeStepObj =
            availableReferenceSteps.find((st) => st.id === activeStepId) ||
            availableReferenceSteps[0];
          const activeFieldPath =
            rowRefField[sIdx] ||
            activeStepObj?.fields[0]?.path ||
            "response.content";

          return (
            <AgentStateUpdateRow
              key={sIdx}
              su={su}
              sIdx={sIdx}
              stateChannels={stateChannels}
              availableCustomTypes={availableCustomTypes}
              customReducers={customReducers}
              schemaFields={schemaFields}
              transformerSteps={transformerSteps}
              availableReferenceSteps={availableReferenceSteps}
              isStructured={isStructured}
              activeRefStep={activeStepId}
              onChangeRefStep={(sid) => {
                setRowRefStep((prev) => ({ ...prev, [sIdx]: sid }));
                const targetStep = availableReferenceSteps.find(
                  (st) => st.id === sid,
                );
                if (targetStep && targetStep.fields.length > 0) {
                  setRowRefField((prev) => ({
                    ...prev,
                    [sIdx]: targetStep.fields[0]?.path || "",
                  }));
                }
              }}
              activeRefField={activeFieldPath}
              onChangeRefField={(fpath) => {
                setRowRefField((prev) => ({ ...prev, [sIdx]: fpath }));
              }}
              isJsonOverride={rowJsonOverrides[sIdx]}
              onToggleJsonOverride={() => {
                setRowJsonOverrides((prev) => ({
                  ...prev,
                  [sIdx]: !(prev[sIdx] ?? false),
                }));
              }}
              onUpdateRow={(updater) => handleUpdateRow(sIdx, updater)}
              onRemoveRow={() => handleRemoveRow(sIdx)}
              textareaRef={(el) => {
                textareaRefs.current[sIdx] = el;
              }}
              inputRef={(el) => {
                inputRefs.current[sIdx] = el;
              }}
              onInsertRefAtCursor={(refString) =>
                handleInsertRefAtCursor(sIdx, refString)
              }
            />
          );
        })}

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
