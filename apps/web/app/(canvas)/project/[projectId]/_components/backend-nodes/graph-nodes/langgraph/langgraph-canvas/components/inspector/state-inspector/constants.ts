export interface BuiltInReducer {
  name: string;
  label: string;
  desc: string;
  typeHint: string;
}

export const DEFAULT_BUILT_IN_REDUCER: BuiltInReducer = {
  name: "replace",
  label: "replace (last-value-wins)",
  desc: "Direct assignment, overwriting previous value",
  typeHint: "primitive",
};

export const BUILT_IN_REDUCERS: BuiltInReducer[] = [
  DEFAULT_BUILT_IN_REDUCER,
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

export const DEFAULT_REDUCER_CODE = `(prev, next) => {
  // Check action sent by node (e.g. { action: "replace", value: ... })
  const action = next?.action;

  // 1. Default update: when action is undefined, "", or "default"
  if (!action || action === "" || action === "default") {
    return next?.value !== undefined ? next.value : (next !== undefined ? next : prev);
  }

  // 2. Action: replace - explicitly replaces current value with incoming value
  // e.g. dispatch { my_var: { action: "replace", value: "new_value" } }
  if (action === "replace") {
    return next?.value !== undefined ? next.value : next;
  }

  // 3. Action: reset - resets to undefined or initial state
  // e.g. dispatch { my_var: { action: "reset" } }
  if (action === "reset") {
    return undefined;
  }

  return prev;
}`;

export const REDUCER_CODE_PRESETS = {
  chat: `(prev, next) => {
  const action = next?.action;
  const prevArr = Array.isArray(prev) ? prev : [];

  // 1. Default update: when action is undefined, "", or "default" (appends incoming messages)
  // e.g. dispatch { messages: [newMsg] } or { messages: newMsg }
  if (!action || action === "" || action === "default") {
    const incoming = next?.value !== undefined ? next.value : next;
    const nextArr = Array.isArray(incoming) ? incoming : (incoming != null ? [incoming] : []);
    return [...prevArr, ...nextArr];
  }

  // 2. Action: replace - overwrites entire message history
  // e.g. dispatch { messages: { action: "replace", value: [systemMsg, userMsg] } }
  if (action === "replace") {
    const incoming = next?.value !== undefined ? next.value : next;
    return Array.isArray(incoming) ? incoming : (incoming != null ? [incoming] : []);
  }

  // 3. Action: reset / clear - clears conversation history
  // e.g. dispatch { messages: { action: "reset" } }
  if (action === "reset" || action === "clear") {
    return [];
  }

  return prevArr;
}`,
  array: `(prev, next) => {
  const action = next?.action;
  const prevArr = Array.isArray(prev) ? prev : [];

  // 1. Default update: when action is undefined, "", or "default" (appends items)
  // e.g. dispatch { items: [newItem] } or { items: newItem }
  if (!action || action === "" || action === "default") {
    const incoming = next?.value !== undefined ? next.value : next;
    const nextArr = Array.isArray(incoming) ? incoming : (incoming != null ? [incoming] : []);
    return [...prevArr, ...nextArr];
  }

  // 2. Action: replace - overwrites entire array
  // e.g. dispatch { items: { action: "replace", value: [1, 2, 3] } }
  if (action === "replace") {
    const incoming = next?.value !== undefined ? next.value : next;
    return Array.isArray(incoming) ? incoming : (incoming != null ? [incoming] : []);
  }

  // 3. Action: reset / clear - empties array
  // e.g. dispatch { items: { action: "reset" } }
  if (action === "reset" || action === "clear") {
    return [];
  }

  return prevArr;
}`,
  object: `(prev, next) => {
  const current = (prev && typeof prev === "object" && !Array.isArray(prev)) ? prev : {};
  const action = next?.action;

  // 1. Default update: when action is undefined, "", or "default" (shallow merges keys)
  // e.g. dispatch { profile: { status: "active" } }
  if (!action || action === "" || action === "default") {
    const incoming = (next?.value && typeof next.value === "object" && !Array.isArray(next.value))
      ? next.value
      : (next && typeof next === "object" && !Array.isArray(next) ? next : {});
    return { ...current, ...incoming };
  }

  // 2. Action: replace - overwrites entire object
  // e.g. dispatch { profile: { action: "replace", value: { status: "fresh" } } }
  if (action === "replace") {
    const incoming = (next?.value && typeof next.value === "object" && !Array.isArray(next.value))
      ? next.value
      : (next && typeof next === "object" && !Array.isArray(next) ? next : {});
    return { ...incoming };
  }

  // 3. Action: reset / clear - empties object
  // e.g. dispatch { profile: { action: "reset" } }
  if (action === "reset" || action === "clear") {
    return {};
  }

  return current;
}`,
  number: `(prev, next) => {
  const current = typeof prev === "number" ? prev : 0;
  const action = next?.action;

  // 1. Default update: when action is undefined, "", or "default" (adds delta or sets value)
  // e.g. dispatch { count: 1 } or { count: { value: 1 } }
  if (!action || action === "" || action === "default") {
    const val = typeof next === "number" ? next : (next?.value ?? 0);
    return current + val;
  }

  // 2. Action: replace - explicitly replaces current number with new value
  // e.g. dispatch { count: { action: "replace", value: 42 } }
  if (action === "replace") {
    return typeof next?.value === "number"
      ? next.value
      : (typeof next === "number" ? next : current);
  }

  // 3. Action: increment - adds amount (default 1)
  // e.g. dispatch { count: { action: "increment", amount: 1 } }
  if (action === "increment") {
    return current + (next?.amount ?? next?.value ?? 1);
  }

  // 4. Action: decrement - subtracts amount (default 1)
  // e.g. dispatch { count: { action: "decrement", amount: 1 } }
  if (action === "decrement") {
    return current - (next?.amount ?? next?.value ?? 1);
  }

  // 5. Action: reset - resets counter to 0 or target value
  // e.g. dispatch { count: { action: "reset" } }
  if (action === "reset") {
    return next?.value ?? 0;
  }

  return current;
}`,
  counterActions: `(prev, next) => {
  const current = typeof prev === "number" ? prev : 0;
  const action = next?.action;

  // 1. Default update: when action is undefined, "", or "default"
  if (!action || action === "" || action === "default") {
    const val = typeof next === "number" ? next : (next?.value ?? 0);
    return current + val;
  }

  // 2. Action: replace - explicitly replaces current number
  if (action === "replace") {
    return typeof next?.value === "number"
      ? next.value
      : (typeof next === "number" ? next : current);
  }

  // 3. Action: increment
  if (action === "increment") {
    return current + (next?.amount ?? next?.value ?? 1);
  }

  // 4. Action: decrement
  if (action === "decrement") {
    return current - (next?.amount ?? next?.value ?? 1);
  }

  // 5. Action: reset
  if (action === "reset") {
    return next?.value ?? 0;
  }

  return current;
}`,
  string: `(prev, next) => {
  const current = typeof prev === "string" ? prev : "";
  const action = next?.action;

  // 1. Default update: when action is undefined, "", or "default"
  // e.g. dispatch { notes: "first line" }
  if (!action || action === "" || action === "default") {
    const incoming = next?.value !== undefined ? String(next.value) : (next != null ? String(next) : "");
    return current ? \`\${current}\\n\${incoming}\` : incoming;
  }

  // 2. Action: replace - explicitly replaces string
  // e.g. dispatch { notes: { action: "replace", value: "fresh note" } }
  if (action === "replace") {
    return next?.value !== undefined ? String(next.value) : (next != null ? String(next) : "");
  }

  // 3. Action: reset / clear - clears string
  // e.g. dispatch { notes: { action: "reset" } }
  if (action === "reset" || action === "clear") {
    return "";
  }

  return current;
}`,
  boolean: `(prev, next) => {
  const current = Boolean(prev);
  const action = next?.action;

  // 1. Default update: when action is undefined, "", or "default"
  // e.g. dispatch { is_active: true }
  if (!action || action === "" || action === "default") {
    return next?.value !== undefined ? Boolean(next.value) : Boolean(next);
  }

  // 2. Action: replace - explicitly sets boolean value
  // e.g. dispatch { is_active: { action: "replace", value: false } }
  if (action === "replace") {
    return next?.value !== undefined ? Boolean(next.value) : Boolean(next);
  }

  // 3. Action: toggle - inverts boolean
  // e.g. dispatch { is_active: { action: "toggle" } }
  if (action === "toggle") {
    return !current;
  }

  // 4. Action: reset - resets to false
  // e.g. dispatch { is_active: { action: "reset" } }
  if (action === "reset") {
    return false;
  }

  return current;
}`,
};

export function getSuggestedReducerCodeForChannelType(type?: string): string {
  if (type === "messages") {
    return REDUCER_CODE_PRESETS.chat;
  }
  if (type === "array") {
    return REDUCER_CODE_PRESETS.array;
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
  if (type === "boolean") {
    return REDUCER_CODE_PRESETS.boolean;
  }
  return DEFAULT_REDUCER_CODE;
}
