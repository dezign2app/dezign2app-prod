import type {
  LangGraphStateChannel,
  LangGraphCustomReducer,
  LangGraphCanvasNode,
  CustomTypeItem,
  LangGraphTypesNode,
} from "@workspace/canvas";
import {
  isTypesNode,
  isTypesRefNode,
} from "@workspace/canvas";
import {
  extractActionsFromReducerCode,
  isValuelessAction,
  getActionsForReducer,
  getActionMetadata,
  getSuggestedReducerCodeForChannelType,
  extractFieldsFromCustomType,
  type ReducerActionMeta,
} from "../../state-inspector/constants";
import type {
  TransformerStepLike,
  SchemaFieldLike,
  DispatchFieldValue,
  ChannelMeta,
} from "./types";

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
        n !== null &&
        "data" in n &&
        typeof n.data === "object" &&
        n.data !== null &&
        "types" in n.data &&
        Array.isArray(n.data.types)
      ) {
        n.data.types.forEach(addType);
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

/**
 * Auto-generates a formatted dispatch JSON body (or scalar value) matching the channel's type/schema.
 * Intelligently binds fields to structured output fields (`response.<field>`), transformer outputs,
 * or active references (`${response.content}`).
 */
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

  // Messages channel
  if (channel.type === "messages" || channel.key === "messages") {
    const clean = fallbackRef.replace(/^\$\{/, "").replace(/\}$/, "").trim();
    return clean && clean !== "response.content" ? clean : "response";
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

  // Default scalar / string channel
  return fallbackRef.replace(/^\$\{/, "").replace(/\}$/, "").trim() || "response.content";
}

/**
 * Resolves channel metadata, custom type, and active reducer code.
 */
export function getChannelMeta(
  channelKey: string,
  stateChannels: LangGraphStateChannel[] = [],
  customReducers: LangGraphCustomReducer[] = [],
  availableCustomTypes: CustomTypeItem[] = [],
): ChannelMeta {
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
}

import type { StepBinding, AvailableSource } from "@/app/(canvas)/project/[projectId]/_components/config-sidebar/pipeline-step-editor/types";
import type { LangGraphStateUpdateItem, StateUpdateSource } from "@workspace/canvas";
import type { Parameter } from "@/types/canvas";
import { toCamelCase } from "../AgentPromptVariablePicker";

/**
 * Converts a LangGraphStateUpdateItem to a StepBinding for use with BindingSourceEditor.
 */
export function stateUpdateToBinding(
  su: LangGraphStateUpdateItem,
  schemaFields: Parameter[] = [],
  availableSources: AvailableSource[] = [],
): StepBinding {
  const channelKey = su.channelKey || "";
  const sourceKind = su.source;
  const rawVal = su.value !== undefined ? String(su.value).trim() : "";

  // 1. Valueless action / none source
  if (sourceKind === "none") {
    return {
      argName: channelKey,
      source: { kind: "inline", value: "" },
    };
  }

  // 2. Explicit state.* path without spaces/newlines
  if (
    rawVal.startsWith("state.") &&
    !rawVal.includes("\n") &&
    !rawVal.includes("${") &&
    !rawVal.includes(" ")
  ) {
    return {
      argName: channelKey,
      source: { kind: "state", field: rawVal.slice(6) },
    };
  }

  // 3. Check if matches any available step output
  for (const src of availableSources) {
    if (src.kind === "step_output" && src.stepId) {
      const varName = src.variableName || src.stepId;
      const stepId = src.stepId;

      if (rawVal === varName || rawVal === stepId) {
        return {
          argName: channelKey,
          source: { kind: "step_output", stepId, field: "" },
        };
      }
      if (rawVal.startsWith(`${varName}.`) && !rawVal.includes("\n") && !rawVal.includes(" ")) {
        const subField = rawVal.slice(varName.length + 1);
        const isSelfRef = subField === varName || (src.label && subField === toCamelCase(src.label));
        return {
          argName: channelKey,
          source: { kind: "step_output", stepId, field: isSelfRef ? "" : subField },
        };
      }
      if (rawVal.startsWith(`${stepId}.`) && !rawVal.includes("\n") && !rawVal.includes(" ")) {
        const subField = rawVal.slice(stepId.length + 1);
        const isSelfRef = subField === varName || (src.label && subField === toCamelCase(src.label));
        return {
          argName: channelKey,
          source: { kind: "step_output", stepId, field: isSelfRef ? "" : subField },
        };
      }
    }
  }

  // 4. Fallback for legacy configs that used response.* or structured_field:
  // Map them to the agent's LLM step or first available step
  const firstLlmStep =
    availableSources.find(
      (s) => s.kind === "step_output" && s.paths.some((p) => p.path === "content"),
    ) || availableSources.find((s) => s.kind === "step_output");

  if (firstLlmStep && firstLlmStep.stepId) {
    const stepId = firstLlmStep.stepId;
    if (sourceKind === "structured_field" || su.schemaField) {
      const fieldName = su.schemaField || rawVal.replace(/^response\??\./, "");
      return {
        argName: channelKey,
        source: { kind: "step_output", stepId, field: fieldName },
      };
    }
    if (
      sourceKind === "structured_full" ||
      sourceKind === "message_object" ||
      rawVal === "response" ||
      rawVal === "${response}"
    ) {
      return {
        argName: channelKey,
        source: { kind: "step_output", stepId, field: "" },
      };
    }
    if (
      sourceKind === "message_content" ||
      rawVal === "response.content" ||
      rawVal === "${response.content}"
    ) {
      return {
        argName: channelKey,
        source: { kind: "step_output", stepId, field: "content" },
      };
    }
    if (rawVal.startsWith("response.") && !rawVal.includes("\n") && !rawVal.includes(" ")) {
      return {
        argName: channelKey,
        source: { kind: "step_output", stepId, field: rawVal.slice(9) },
      };
    }
  }

  // 5. Otherwise, inline value (expression, JSON, or literal)
  return {
    argName: channelKey,
    source: {
      kind: "inline",
      value: su.value !== undefined ? String(su.value) : "",
    },
  };
}

/**
 * Converts a StepBinding back into a LangGraphStateUpdateItem.
 */
export function bindingToStateUpdate(
  binding: StepBinding,
  prevSu: LangGraphStateUpdateItem,
  schemaFields: Parameter[] = [],
  availableSources: AvailableSource[] = [],
): LangGraphStateUpdateItem {
  const { source, argName } = binding;
  const channelKey = argName || prevSu.channelKey;

  if (source.kind === "step_output") {
    const src = availableSources.find(
      (s) => s.kind === "step_output" && (s.stepId === source.stepId || s.id === `step:${source.stepId}`),
    );
    let varName = src?.variableName || (src?.label ? toCamelCase(src.label) : "");
    if (!varName || varName.startsWith("llm_") || varName.startsWith("step_")) {
      varName = src?.label ? toCamelCase(src.label) : "response";
    }
    const rawField = (source.field || "").trim();
    const isWhole =
      !rawField ||
      rawField === `(whole ${varName})` ||
      rawField === `(whole ${source.stepId})` ||
      rawField === varName ||
      (src?.label && rawField === toCamelCase(src.label)) ||
      rawField === src?.label;

    if (isWhole) {
      return {
        ...prevSu,
        channelKey,
        source: "expression",
        mode: "expression",
        value: varName,
        schemaField: undefined,
      };
    }

    const matchedSf = schemaFields.find(
      (sf) => sf.name.toLowerCase() === rawField.toLowerCase(),
    );
    if (matchedSf) {
      return {
        ...prevSu,
        channelKey,
        source: "structured_field",
        mode: "set",
        schemaField: matchedSf.name,
        value: `${varName}.${matchedSf.name}`,
      };
    }

    return {
      ...prevSu,
      channelKey,
      source: "expression",
      mode: "expression",
      value: `${varName}.${rawField}`,
      schemaField: undefined,
    };
  }

  if (source.kind === "state") {
    const field = (source.field || "").trim();
    const val = field && field !== "(whole state)" ? `state.${field}` : "state";
    return {
      ...prevSu,
      channelKey,
      source: "expression",
      mode: "expression",
      value: val,
      schemaField: undefined,
    };
  }

  if (source.kind === "env") {
    const field = (source.field || "").trim();
    const val = field ? `process.env.${field}` : "process.env";
    return {
      ...prevSu,
      channelKey,
      source: "expression",
      mode: "expression",
      value: val,
      schemaField: undefined,
    };
  }

  if (source.kind === "inline") {
    const rawVal = source.value !== undefined ? String(source.value) : "";
    let cleanVal = rawVal;
    const trimmed = cleanVal.trim();
    if (
      trimmed.startsWith("${") &&
      trimmed.endsWith("}") &&
      !trimmed.slice(2, -1).includes("${")
    ) {
      cleanVal = trimmed.slice(2, -1).trim();
    }

    let nextSource: StateUpdateSource = "literal";
    let nextSchemaField: string | undefined = undefined;

    const cleanMatch = cleanVal.replace(/^response\??\./, "").trim();
    const matchedField = schemaFields.find(
      (f) => f.name === cleanMatch || f.name === cleanVal,
    );

    if (matchedField) {
      nextSource = "structured_field";
      nextSchemaField = matchedField.name;
    } else if (cleanVal === "response.content") {
      nextSource = "message_content";
    } else if (cleanVal === "response") {
      nextSource = "message_object";
    } else if (
      cleanVal.startsWith("state.") ||
      cleanVal.includes("${") ||
      cleanVal.includes("\n") ||
      cleanVal.startsWith("{")
    ) {
      nextSource = "expression";
    } else {
      nextSource = "literal";
    }

    return {
      ...prevSu,
      channelKey,
      value: cleanVal,
      source: nextSource,
      schemaField: nextSchemaField,
      mode: nextSource === "expression" ? "expression" : "set",
    };
  }

  return {
    ...prevSu,
    channelKey,
  };
}
