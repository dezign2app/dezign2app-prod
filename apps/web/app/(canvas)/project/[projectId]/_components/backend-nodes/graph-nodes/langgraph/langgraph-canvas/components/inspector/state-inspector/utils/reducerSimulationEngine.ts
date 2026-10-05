import type {
  LangGraphStateChannel,
  LangGraphCustomReducer,
} from "@/types/canvas";

export interface ReducerExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
}

export interface ChannelSimulationResult {
  channelKey: string;
  reducerName: string;
  prevValue: unknown;
  updateValue: unknown;
  nextValue: unknown;
  changed: boolean;
  status: "updated" | "unchanged" | "error";
  error?: string;
  durationMs: number;
}

export interface StateSimulationStep {
  id: string;
  timestamp: number;
  label: string;
  state: Record<string, unknown>;
  updatePayload: Record<string, unknown>;
  channelResults: ChannelSimulationResult[];
}

/**
 * Normalizes message format for LangGraph add_messages reducer.
 */
function normalizeMessage(msg: unknown): Record<string, unknown> {
  if (typeof msg === "string") {
    return { role: "user", content: msg };
  }
  if (typeof msg === "object" && msg !== null) {
    return { ...(msg as Record<string, unknown>) };
  }
  return { content: String(msg) };
}

/**
 * LangGraph standard add_messages reducer.
 * Appends messages or replaces existing messages matching the same `id`.
 */
export function executeAddMessagesReducer(
  prev: unknown,
  next: unknown,
): unknown[] {
  let prevList: unknown[] = [];
  if (Array.isArray(prev)) {
    prevList = [...prev];
  } else if (prev !== undefined && prev !== null) {
    prevList = [prev];
  }

  let nextList: unknown[] = [];
  if (Array.isArray(next)) {
    nextList = [...next];
  } else if (next !== undefined && next !== null) {
    nextList = [next];
  }

  const result = [...prevList];

  for (const item of nextList) {
    const norm = normalizeMessage(item);
    const msgId = norm.id;

    if (msgId !== undefined && msgId !== null && String(msgId).trim() !== "") {
      const existingIdx = result.findIndex((existing) => {
        if (typeof existing === "object" && existing !== null) {
          return String((existing as Record<string, unknown>).id) === String(msgId);
        }
        return false;
      });

      if (existingIdx !== -1) {
        // Replace existing message matching same ID
        result[existingIdx] = norm;
        continue;
      }
    }

    // Otherwise append
    result.push(norm);
  }

  return result;
}

/**
 * Standard array append reducer.
 */
export function executeAppendReducer(prev: unknown, next: unknown): unknown[] {
  const prevArr = Array.isArray(prev)
    ? [...prev]
    : prev !== undefined && prev !== null
      ? [prev]
      : [];

  if (next === undefined || next === null) {
    return prevArr;
  }

  if (Array.isArray(next)) {
    return [...prevArr, ...next];
  }

  return [...prevArr, next];
}

/**
 * Dictionary / object merge reducer.
 */
export function executeMergeObjectReducer(
  prev: unknown,
  next: unknown,
): Record<string, unknown> {
  const prevObj =
    typeof prev === "object" && prev !== null && !Array.isArray(prev)
      ? (prev as Record<string, unknown>)
      : {};
  const nextObj =
    typeof next === "object" && next !== null && !Array.isArray(next)
      ? (next as Record<string, unknown>)
      : {};

  return { ...prevObj, ...nextObj };
}

/**
 * Safe reducer execution handler for built-in or custom reducer functions.
 */
export function executeReducer(
  reducerName: string,
  customCode: string | undefined,
  prev: unknown,
  next: unknown,
  state?: Record<string, unknown>,
): ReducerExecutionResult {
  const startTime = performance.now();

  try {
    // 1. Check for custom code execution
    if (reducerName === "custom" || customCode) {
      const code = (customCode || "").trim();
      if (!code) {
        return {
          success: true,
          result: next !== undefined ? next : prev,
          durationMs: performance.now() - startTime,
        };
      }

      // Execute safely in sandbox (passes prev, next, and full graph state as 3rd arg)
      const fn = new Function(
        "prev",
        "next",
        "state",
        `"use strict";
        const customFn = (${code});
        if (typeof customFn === "function") {
          return customFn(prev, next, state);
        }
        return customFn;`,
      );

      const res = fn(prev, next, state);
      const durationMs = performance.now() - startTime;

      if (typeof res === "number" && isNaN(res)) {
        return {
          success: false,
          error:
            "Reducer returned NaN. Check arithmetic on undefined properties (e.g. prev.count or prev.message).",
          durationMs,
        };
      }

      return { success: true, result: res, durationMs };
    }

    // 2. Built-in reducers
    switch (reducerName) {
      case "add_messages":
      case "add_message": {
        const res = executeAddMessagesReducer(prev, next);
        return {
          success: true,
          result: res,
          durationMs: performance.now() - startTime,
        };
      }

      case "append":
      case "concat_array": {
        const res = executeAppendReducer(prev, next);
        return {
          success: true,
          result: res,
          durationMs: performance.now() - startTime,
        };
      }

      case "merge_object": {
        const res = executeMergeObjectReducer(prev, next);
        return {
          success: true,
          result: res,
          durationMs: performance.now() - startTime,
        };
      }

      case "replace":
      default: {
        const res = next !== undefined ? next : prev;
        return {
          success: true,
          result: res,
          durationMs: performance.now() - startTime,
        };
      }
    }
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : String(err || "Unknown error");
    return {
      success: false,
      error: errorMsg,
      durationMs: performance.now() - startTime,
    };
  }
}

/**
 * Get the default value for a given channel based on type and configured defaultValue.
 */
export function getChannelDefaultValue(
  channel: LangGraphStateChannel,
): unknown {
  if (channel.defaultValue !== undefined && channel.defaultValue !== "") {
    if (typeof channel.defaultValue === "string") {
      try {
        return JSON.parse(channel.defaultValue);
      } catch {
        return channel.defaultValue;
      }
    }
    return channel.defaultValue;
  }

  switch (channel.type) {
    case "messages":
      return [];
    case "array":
      return [];
    case "number":
      return 0;
    case "boolean":
      return false;
    case "object":
    case "json":
      return {};
    case "string":
    default:
      return "";
  }
}

/**
 * Generates an initial state map from state channels.
 */
export function buildInitialState(
  stateChannels: LangGraphStateChannel[],
): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  for (const ch of stateChannels) {
    state[ch.key] = getChannelDefaultValue(ch);
  }
  return state;
}

/**
 * Applies a partial state update payload to a graph's state channels.
 */
export function simulateStateTransition({
  stateChannels,
  customReducers = [],
  currentState,
  updatePayload,
}: {
  stateChannels: LangGraphStateChannel[];
  customReducers?: LangGraphCustomReducer[];
  currentState: Record<string, unknown>;
  updatePayload: Record<string, unknown>;
}): {
  nextState: Record<string, unknown>;
  channelResults: ChannelSimulationResult[];
  unmatchedPayloadKeys: string[];
} {
  const nextState: Record<string, unknown> = { ...currentState };
  const channelResults: ChannelSimulationResult[] = [];
  const processedKeys = new Set<string>();

  for (const ch of stateChannels) {
    const key = ch.key;
    processedKeys.add(key);

    const prevValue = currentState[key];
    const hasIncoming = Object.prototype.hasOwnProperty.call(
      updatePayload,
      key,
    );
    const updateValue = hasIncoming ? updatePayload[key] : undefined;

    // Find custom reducer if tied to this channel or referenced by name
    const matchedCustom = customReducers.find(
      (r) =>
        r.name === ch.reducer ||
        r.id === ch.reducer ||
        r.targetField === ch.key,
    );

    const effectiveReducerName = matchedCustom
      ? "custom"
      : ch.reducer || "replace";
    const effectiveCode = matchedCustom?.code || ch.customReducerCode;

    if (!hasIncoming) {
      channelResults.push({
        channelKey: key,
        reducerName: matchedCustom ? `${matchedCustom.name} (custom)` : effectiveReducerName,
        prevValue,
        updateValue: undefined,
        nextValue: prevValue,
        changed: false,
        status: "unchanged",
        durationMs: 0,
      });
      continue;
    }

    const exec = executeReducer(
      effectiveReducerName,
      effectiveCode,
      prevValue,
      updateValue,
      currentState,
    );

    if (exec.success) {
      nextState[key] = exec.result;
      const isChanged =
        JSON.stringify(prevValue) !== JSON.stringify(exec.result);

      channelResults.push({
        channelKey: key,
        reducerName: matchedCustom ? `${matchedCustom.name} (custom)` : effectiveReducerName,
        prevValue,
        updateValue,
        nextValue: exec.result,
        changed: isChanged,
        status: isChanged ? "updated" : "unchanged",
        durationMs: exec.durationMs,
      });
    } else {
      channelResults.push({
        channelKey: key,
        reducerName: matchedCustom ? `${matchedCustom.name} (custom)` : effectiveReducerName,
        prevValue,
        updateValue,
        nextValue: prevValue,
        changed: false,
        status: "error",
        error: exec.error,
        durationMs: exec.durationMs,
      });
    }
  }

  // Check for keys in update payload that were not in stateChannels
  const unmatchedPayloadKeys = Object.keys(updatePayload).filter(
    (k) => !processedKeys.has(k),
  );

  return {
    nextState,
    channelResults,
    unmatchedPayloadKeys,
  };
}

/**
 * Built-in reducer presets for instant one-click testing in playground.
 */
export const REDUCER_PRESETS: Record<
  string,
  Array<{
    label: string;
    description: string;
    prev: unknown;
    next: unknown;
  }>
> = {
  add_messages: [
    {
      label: "Append New Message",
      description: "Appends a new user message to existing chat history",
      prev: [
        {
          id: "msg-1",
          role: "system",
          content: "You are a helpful LangGraph agent.",
        },
      ],
      next: [
        {
          id: "msg-2",
          role: "user",
          content: "Hello! What can you help me with?",
        },
      ],
    },
    {
      label: "Update Message by ID (Dedup)",
      description:
        "Replaces an existing message in-place matching the same ID",
      prev: [
        {
          id: "msg-1",
          role: "user",
          content: "Hi",
        },
        {
          id: "msg-2",
          role: "assistant",
          content: "Thinking...",
        },
      ],
      next: [
        {
          id: "msg-2",
          role: "assistant",
          content: "Here is your completed response!",
        },
      ],
    },
    {
      label: "Append Multiple Messages Array",
      description: "Merges a batch of assistant and tool messages",
      prev: [
        {
          id: "msg-1",
          role: "user",
          content: "Calculate 25 * 4",
        },
      ],
      next: [
        {
          id: "msg-2",
          role: "assistant",
          content: "",
          tool_calls: [{ name: "calculator", args: { expr: "25 * 4" } }],
        },
        {
          id: "msg-3",
          role: "tool",
          name: "calculator",
          content: "100",
        },
      ],
    },
    {
      label: "Start from Empty History",
      description: "First message initialization into an empty array",
      prev: [],
      next: {
        id: "msg-init",
        role: "user",
        content: "Starting session",
      },
    },
  ],

  append: [
    {
      label: "Append Single Item",
      description: "Appends a single item into the existing array",
      prev: ["alpha", "beta"],
      next: "gamma",
    },
    {
      label: "Merge Two Arrays",
      description: "Concatenates another array of items",
      prev: [1, 2, 3],
      next: [4, 5, 6],
    },
    {
      label: "Append Object to List",
      description: "Adds a structured log or record object to array",
      prev: [{ id: 1, step: "init" }],
      next: { id: 2, step: "process" },
    },
    {
      label: "Start from Empty / Null",
      description: "Appends to undefined or null initial state",
      prev: null,
      next: ["first_item"],
    },
  ],

  concat_array: [
    {
      label: "Concatenate String Lists",
      description: "Merges lists of strings together",
      prev: ["itemA", "itemB"],
      next: ["itemC", "itemD"],
    },
    {
      label: "Append Single Item",
      description: "Appends a single value to existing list",
      prev: ["user_1"],
      next: "user_2",
    },
  ],

  merge_object: [
    {
      label: "Merge New Keys",
      description: "Adds new keys without touching existing keys",
      prev: { user: "alice", role: "member" },
      next: { theme: "dark", notifications: true },
    },
    {
      label: "Override Specific Key",
      description: "Updates an existing key and keeps untouched keys",
      prev: { status: "pending", retries: 0, priority: "high" },
      next: { status: "completed", retries: 1 },
    },
    {
      label: "Deep / Nested Config Merge",
      description: "Shallow merges object properties",
      prev: { config: { timeout: 5000 }, active: true },
      next: { config: { timeout: 10000, retry: true } },
    },
  ],

  replace: [
    {
      label: "Overwrite String Value",
      description: "Replaces current string with incoming string",
      prev: "draft",
      next: "published",
    },
    {
      label: "Overwrite Number Value",
      description: "Replaces current counter or integer",
      prev: 42,
      next: 100,
    },
    {
      label: "Overwrite Object Value",
      description: "Replaces entire object state",
      prev: { step: 1, finished: false },
      next: { step: 2, finished: true },
    },
  ],
};

/**
 * Type definition for state channel test presets.
 */
export interface ChannelTestPreset {
  label: string;
  description: string;
  value: unknown;
}

/**
 * Channel type-specific presets for incoming state update payloads.
 */
export const CHANNEL_TYPE_PRESETS: Record<
  "string" | "number" | "boolean" | "messages" | "array" | "object" | "json",
  ChannelTestPreset[]
> = {
  string: [
    {
      label: "Updated Text",
      description: "Standard string response or message",
      value: "Hello! State transition test.",
    },
    {
      label: "Append Chunk",
      description: "Additional follow-up response chunk",
      value: "Stream finished: Final synthesized result.",
    },
    {
      label: "Multiline Log",
      description: "Multi-line string payload",
      value: "Step 1: Analyzed input\nStep 2: Executed tool\nStep 3: State updated",
    },
    {
      label: "Empty String",
      description: "Reset or clear string channel",
      value: "",
    },
  ],
  number: [
    {
      label: "+1 (Increment)",
      description: "Increment integer by 1",
      value: 1,
    },
    {
      label: "+5 (Step)",
      description: "Increase count by 5",
      value: 5,
    },
    {
      label: "-1 (Decrement)",
      description: "Decrease count by 1",
      value: -1,
    },
    {
      label: "0 (Reset)",
      description: "Reset number to 0",
      value: 0,
    },
    {
      label: "100",
      description: "Set number to 100",
      value: 100,
    },
  ],
  boolean: [
    {
      label: "true",
      description: "Set boolean flag to true",
      value: true,
    },
    {
      label: "false",
      description: "Set boolean flag to false",
      value: false,
    },
  ],
  messages: [
    {
      label: "Assistant Message",
      description: "Appends assistant message to chat history",
      value: [
        {
          id: "msg-assistant-1",
          role: "assistant",
          content: "I have processed your query and updated graph state.",
        },
      ],
    },
    {
      label: "User Query",
      description: "Appends user message to chat history",
      value: [
        {
          id: "msg-user-1",
          role: "user",
          content: "Could you summarize the results?",
        },
      ],
    },
    {
      label: "Update Message (Dedup)",
      description: "Replaces existing message matching same ID",
      value: [
        {
          id: "msg-sim-1",
          role: "assistant",
          content: "Stream finished: Final synthesized result.",
        },
      ],
    },
    {
      label: "Tool Result",
      description: "Appends tool call output message",
      value: [
        {
          id: "msg-tool-1",
          role: "tool",
          name: "search",
          content: "Found 3 matching documents.",
        },
      ],
    },
  ],
  array: [
    {
      label: "Append Item",
      description: "Appends single element to array",
      value: ["new_item"],
    },
    {
      label: "Multiple Items",
      description: "Appends multiple elements to array",
      value: ["item_alpha", "item_beta"],
    },
    {
      label: "Object Record",
      description: "Appends structured object to array",
      value: [{ id: 1, status: "completed" }],
    },
    {
      label: "Empty Array",
      description: "Resets array to empty",
      value: [],
    },
  ],
  object: [
    {
      label: "Status & Timestamp",
      description: "Standard metadata with status and timestamp",
      value: {
        status: "success",
        lastNode: "agent_executor",
        timestamp: new Date().toISOString(),
      },
    },
    {
      label: "Nested Config",
      description: "Nested configuration dictionary",
      value: {
        config: { timeout: 5000, retry: true },
        active: true,
      },
    },
    {
      label: "Empty Object",
      description: "Resets object to empty",
      value: {},
    },
  ],
  json: [
    {
      label: "Status & Timestamp",
      description: "Standard metadata with status and timestamp",
      value: {
        status: "success",
        lastNode: "agent_executor",
        timestamp: new Date().toISOString(),
      },
    },
    {
      label: "Nested Config",
      description: "Nested configuration dictionary",
      value: {
        config: { timeout: 5000, retry: true },
        active: true,
      },
    },
    {
      label: "Empty Object",
      description: "Resets object to empty",
      value: {},
    },
  ],
};

/**
 * Gets the test presets appropriate for a channel's type and reducer.
 */
export function getPresetsForChannel(
  channel?: LangGraphStateChannel,
): ChannelTestPreset[] {
  if (!channel) return CHANNEL_TYPE_PRESETS.string;
  const channelType = channel.type as keyof typeof CHANNEL_TYPE_PRESETS;
  const byType = CHANNEL_TYPE_PRESETS[channelType];
  if (byType && byType.length > 0) {
    return byType;
  }
  return CHANNEL_TYPE_PRESETS.string;
}

/**
 * Returns default incoming test value matching a channel's type.
 */
export function getDefaultPresetValueForChannel(
  channel?: LangGraphStateChannel,
): unknown {
  const presets = getPresetsForChannel(channel);
  return presets[0]?.value ?? "";
}

/**
 * Formats a preset value for editing in textareas (valid JSON / string format).
 */
export function formatPresetValue(val: unknown): string {
  if (typeof val === "string") {
    return JSON.stringify(val);
  }
  if (typeof val === "number" || typeof val === "boolean") {
    return String(val);
  }
  return JSON.stringify(val, null, 2);
}

/**
 * Retrieves unit-test scenario presets for a reducer, dynamically fallback to
 * channel type if it's a custom developer reducer.
 */
export function getPlaygroundPresetsForReducer(
  reducerName: string,
  stateChannels: LangGraphStateChannel[] = [],
  customReducers: LangGraphCustomReducer[] = [],
): Array<{ label: string; description: string; prev: unknown; next: unknown }> {
  if (REDUCER_PRESETS[reducerName]) {
    return REDUCER_PRESETS[reducerName];
  }

  // Find channel associated with this reducer
  const channel = stateChannels.find(
    (c) =>
      c.reducer === reducerName ||
      c.key ===
        customReducers.find(
          (r) => r.name === reducerName || r.id === reducerName,
        )?.targetField,
  );

  const channelType = (channel?.type || "string") as keyof typeof CHANNEL_TYPE_PRESETS;
  const channelKey = channel?.key || "field";
  const typePresets =
    CHANNEL_TYPE_PRESETS[channelType] ?? CHANNEL_TYPE_PRESETS.string;

  if (channelType === "string") {
    return [
      {
        label: "Append Text",
        description: "Appends follow-up text to existing string",
        prev: "Initial response",
        next: "Follow-up chunk",
      },
      {
        label: "From Empty State",
        description: "Updates empty initial string",
        prev: "",
        next: "Hello! State transition test.",
      },
      {
        label: "Multiline Update",
        description: "Adds a new line to existing string",
        prev: "Line 1: Completed",
        next: "Line 2: New output",
      },
    ];
  }

  if (channelType === "number") {
    return [
      {
        label: "Increment (+1)",
        description: "Increments previous counter by 1",
        prev: 0,
        next: 1,
      },
      {
        label: "Step (+5)",
        description: "Increments existing counter by 5",
        prev: 10,
        next: 5,
      },
      {
        label: "Reset to Zero",
        description: "Resets counter",
        prev: 42,
        next: 0,
      },
    ];
  }

  return typePresets.map((tp, idx) => ({
    label: tp.label,
    description: tp.description,
    prev:
      idx === 0
        ? getChannelDefaultValue(
            channel || { key: channelKey, type: channelType, reducer: "replace" },
          )
        : tp.value,
    next: tp.value,
  }));
}

