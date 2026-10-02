export interface BuiltInReducer {
  name: string;
  label: string;
  desc: string;
  typeHint: string;
}

export const BUILT_IN_REDUCERS: BuiltInReducer[] = [
  {
    name: "replace",
    label: "replace (last-value-wins)",
    desc: "Direct assignment, overwriting previous value",
    typeHint: "primitive",
  },
  {
    name: "add_messages",
    label: "add_messages (chat history dedup/append)",
    desc: "LangGraph ID-based dedup and message history append",
    typeHint: "messages",
  },
  {
    name: "append",
    label: "append (array concat)",
    desc: "Appends incoming updates to the existing array",
    typeHint: "array",
  },
  {
    name: "concat_array",
    label: "concat_array (merge lists)",
    desc: "Concatenates array updates",
    typeHint: "array",
  },
  {
    name: "merge_object",
    label: "merge_object (dict merge)",
    desc: "Shallow dictionary merge: { ...prev, ...next }",
    typeHint: "object",
  },
];

export const DEFAULT_REDUCER_CODE =
  "(prev, next) => Array.isArray(prev) ? [...prev, ...next] : next";

export const REDUCER_CODE_PRESETS = {
  chat: "(prev, next) => [...(Array.isArray(prev) ? prev : []), ...(Array.isArray(next) ? next : [next])]",
  array: "(prev, next) => [...(Array.isArray(prev) ? prev : []), ...(Array.isArray(next) ? next : [next])]",
  object: "(prev, next) => ({ ...(prev || {}), ...(next || {}) })",
  number: "(prev, next) => (prev || 0) + (next || 0)",
  string: "(prev, next) => (prev ? `${prev}\\n${next}` : next)",
};

export function getSuggestedReducerCodeForChannelType(type?: string): string {
  if (type === "array" || type === "messages") {
    return REDUCER_CODE_PRESETS.chat;
  }
  if (type === "number") {
    return REDUCER_CODE_PRESETS.number;
  }
  if (type === "object" || type === "json") {
    return REDUCER_CODE_PRESETS.object;
  }
  if (type === "string") {
    return REDUCER_CODE_PRESETS.string;
  }
  return DEFAULT_REDUCER_CODE;
}
