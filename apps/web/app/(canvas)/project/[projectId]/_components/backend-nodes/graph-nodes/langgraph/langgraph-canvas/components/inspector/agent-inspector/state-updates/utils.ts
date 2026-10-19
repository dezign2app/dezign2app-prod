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
