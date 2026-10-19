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
  if (type === "object") {
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

export interface ReducerActionMeta {
  action: string;
  label: string;
  description: string;
  requiresValue: boolean;
}

/**
 * Checks if an action is typically valueless (e.g. reset, clear, toggle).
 */
export function isValuelessAction(action?: string): boolean {
  if (!action) return false;
  const lower = action.toLowerCase().trim();
  return (
    lower === "reset" ||
    lower === "clear" ||
    lower === "toggle" ||
    lower === "empty" ||
    lower.startsWith("clear_") ||
    lower.startsWith("reset_")
  );
}

/**
 * Extracts action names from custom reducer JavaScript code.
 * Detects patterns like:
 * - action === "name" or action == "name"
 * - "name" === action
 * - case "name":
 * - ["reset", "clear"].includes(action)
 */
export function extractActionsFromReducerCode(code?: string): string[] {
  if (!code || typeof code !== "string") return [];
  const actions = new Set<string>();

  // Pattern 1: action === "name" or .action === "name"
  const eqRegex = /(?:action|\.action)\s*===?\s*["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = eqRegex.exec(code)) !== null) {
    const act = match[1]?.trim();
    if (act && act !== "default" && act !== "") {
      actions.add(act);
    }
  }

  // Pattern 2: "name" === action or "name" === next?.action
  const revEqRegex = /["']([^"']+)["']\s*===?\s*(?:action|\.action)/g;
  while ((match = revEqRegex.exec(code)) !== null) {
    const act = match[1]?.trim();
    if (act && act !== "default" && act !== "") {
      actions.add(act);
    }
  }

  // Pattern 3: case "name":
  const caseRegex = /case\s*["']([^"']+)["']\s*:/g;
  while ((match = caseRegex.exec(code)) !== null) {
    const act = match[1]?.trim();
    if (act && act !== "default" && act !== "") {
      actions.add(act);
    }
  }

  // Pattern 4: ["reset", "clear"].includes(action)
  const includesRegex = /\[([^\]]+)\]\.includes\(\s*(?:action|\.action)\s*\)/g;
  while ((match = includesRegex.exec(code)) !== null) {
    const inner = match[1];
    if (!inner) continue;
    const strRegex = /["']([^"']+)["']/g;
    let sm: RegExpExecArray | null;
    while ((sm = strRegex.exec(inner)) !== null) {
      const act = sm[1]?.trim();
      if (act && act !== "default" && act !== "") {
        actions.add(act);
      }
    }
  }

  return Array.from(actions);
}

/**
 * Returns formatted action metadata for an action name.
 */
export function getActionMetadata(
  action: string,
  _channelType?: string,
): ReducerActionMeta {
  const isValueless = isValuelessAction(action);
  const hint = isValueless ? "(no value)" : "(value)";
  let label = `${action} ${hint}`;
  let desc = `Dispatches { action: "${action}" }`;

  if (action === "default") {
    label = "default (direct)";
    desc = "Standard reducer update passing value directly";
  }

  return {
    action,
    label,
    description: desc,
    requiresValue: !isValueless,
  };
}

/**
 * Returns the list of available actions for a channel.
 * If custom reducer code is present, it returns ONLY the auto-detected actions (plus default).
 */
export function getActionsForReducer(
  channelType?: string,
  reducerName?: string,
  customCode?: string,
): ReducerActionMeta[] {
  const actions: ReducerActionMeta[] = [];
  const seen = new Set<string>();

  const add = (meta: ReducerActionMeta) => {
    if (!seen.has(meta.action)) {
      seen.add(meta.action);
      actions.push(meta);
    }
  };

  // 1. Default update action (always first)
  add({
    action: "default",
    label: "default (direct)",
    description: "Standard reducer update passing value directly",
    requiresValue: true,
  });

  // 2. Extract actions from custom reducer code or preset code for channel type
  // Extracts THOSE ACTIONS ALONE matching ChannelReducerConfig!
  const effectiveCode =
    customCode && typeof customCode === "string" && customCode.trim()
      ? customCode
      : getSuggestedReducerCodeForChannelType(channelType);

  if (effectiveCode) {
    const detected = extractActionsFromReducerCode(effectiveCode);
    if (detected.length > 0) {
      for (const act of detected) {
        add(getActionMetadata(act, channelType));
      }
      return actions;
    }
  }

  // 3. Built-in reducers
  if (reducerName === "replace") {
    add(getActionMetadata("replace", channelType));
    return actions;
  }
  if (reducerName === "add_messages") {
    add(getActionMetadata("append", channelType));
    add(getActionMetadata("replace", channelType));
    add(getActionMetadata("reset", channelType));
    return actions;
  }
  if (reducerName === "append" || reducerName === "concat_array") {
    add(getActionMetadata("append", channelType));
    add(getActionMetadata("replace", channelType));
    add(getActionMetadata("reset", channelType));
    add(getActionMetadata("clear", channelType));
    return actions;
  }
  if (reducerName === "merge_object") {
    add(getActionMetadata("merge", channelType));
    add(getActionMetadata("replace", channelType));
    add(getActionMetadata("reset", channelType));
    add(getActionMetadata("clear", channelType));
    return actions;
  }

  // 4. Fallback type-specific actions ONLY if no specific reducer code was found
  if (channelType === "number") {
    add(getActionMetadata("increment", channelType));
    add(getActionMetadata("decrement", channelType));
    add(getActionMetadata("replace", channelType));
    add(getActionMetadata("reset", channelType));
  } else if (channelType === "boolean") {
    add(getActionMetadata("toggle", channelType));
    add(getActionMetadata("replace", channelType));
    add(getActionMetadata("reset", channelType));
  } else if (channelType === "array" || channelType === "messages") {
    add(getActionMetadata("append", channelType));
    add(getActionMetadata("replace", channelType));
    add(getActionMetadata("reset", channelType));
    add(getActionMetadata("clear", channelType));
  } else if (channelType === "object") {
    add(getActionMetadata("merge", channelType));
    add(getActionMetadata("replace", channelType));
    add(getActionMetadata("reset", channelType));
  } else if (channelType === "string") {
    add(getActionMetadata("replace", channelType));
    add(getActionMetadata("reset", channelType));
    add(getActionMetadata("clear", channelType));
  } else {
    add(getActionMetadata("replace", channelType));
    add(getActionMetadata("reset", channelType));
  }

  return actions;
}
