import {
  LANGGRAPH_CANVAS_NODE_LLM,
  type LangGraphCanvasNode,
  type LangGraphLLMNode,
  type LangGraphStateChannel,
} from "@workspace/canvas";
import { resolveStructuredFieldValue } from "../langgraph";
import type {
  GraphChatMessage,
  LangGraphSimulationProvider,
  AppliedStateUpdateRecord,
  BrowserAddLogFn,
} from "./types";

export function isLangGraphLLMNode(
  node: LangGraphCanvasNode | null | undefined,
): node is LangGraphLLMNode {
  return node?.type === LANGGRAPH_CANVAS_NODE_LLM;
}

export function getEnvKeyForProvider(providerName: LangGraphSimulationProvider): string {
  switch (providerName) {
    case "groq":
      return "GROQ_API_KEY";
    case "openai":
      return "OPENAI_API_KEY";
    case "anthropic":
      return "ANTHROPIC_API_KEY";
    case "google":
      return "GEMINI_API_KEY";
    default:
      return "CUSTOM_API_KEY";
  }
}

export function clone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}

export function generateId(): string {
  return "cp_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

export function extractMessages(raw: unknown): GraphChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const result: GraphChatMessage[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      result.push({ role: "user", content: item.trim() });
    } else if (item && typeof item === "object") {
      const msg = item as Record<string, unknown>;
      if (typeof msg.content === "string") {
        result.push({
          role: typeof msg.role === "string" ? msg.role : "user",
          content: msg.content,
          name: typeof msg.name === "string" ? msg.name : undefined,
          tool_calls: Array.isArray(msg.tool_calls) ? msg.tool_calls : undefined,
        });
      }
    }
  }
  return result;
}

export function interpolateBrowserPrompt(prompt: string, state: Record<string, unknown>): string {
  if (!prompt || !/\$\{([^}]+)\}/.test(prompt)) return prompt;
  return prompt.replace(/\$\{([^}]+)\}/g, (match, expr: string) => {
    const trimmed = expr.trim();
    const fieldPath = trimmed.startsWith("state.") ? trimmed.replace(/^state\./, "") : trimmed;
    const parts = fieldPath.split(".");
    let curr: unknown = state;
    for (const p of parts) {
      if (curr && typeof curr === "object" && p in (curr as Record<string, unknown>)) {
        curr = (curr as Record<string, unknown>)[p];
      } else {
        return match;
      }
    }
    if (curr !== undefined && curr !== null) {
      return typeof curr === "object" ? JSON.stringify(curr) : String(curr);
    }
    return match;
  });
}

export function executeBrowserBuiltInAction(
  action: string | undefined,
  reducer: string,
  type: string | undefined,
  prevVal: unknown,
  val: unknown,
  actionPayload: unknown,
): unknown {
  if (action && action !== "default") {
    switch (action) {
      case "increment": {
        const current = typeof prevVal === "number" ? prevVal : Number(prevVal) || 0;
        const amount = typeof val === "number" ? val : Number(val) || 1;
        return current + amount;
      }
      case "decrement": {
        const current = typeof prevVal === "number" ? prevVal : Number(prevVal) || 0;
        const amount = typeof val === "number" ? val : Number(val) || 1;
        return current - amount;
      }
      case "toggle": {
        return !Boolean(prevVal);
      }
      case "reset":
      case "clear": {
        if (type === "number") return 0;
        if (type === "boolean") return false;
        if (type === "array" || type === "messages") return [];
        if (type === "object" || type === "json") return {};
        if (type === "string") return "";
        return undefined;
      }
      case "replace": {
        return val !== undefined ? val : actionPayload;
      }
      case "append": {
        const arr = Array.isArray(prevVal) ? prevVal : prevVal != null ? [prevVal] : [];
        return [...arr, ...(Array.isArray(val) ? val : val != null ? [val] : [])];
      }
      case "merge": {
        const obj =
          prevVal && typeof prevVal === "object" && !Array.isArray(prevVal)
            ? prevVal
            : {};
        const incoming =
          val && typeof val === "object" && !Array.isArray(val) ? val : {};
        return { ...obj, ...incoming };
      }
      case "concat": {
        const str = typeof prevVal === "string" ? prevVal : "";
        const incoming = val != null ? String(val) : "";
        return str ? `${str}\n${incoming}` : incoming;
      }
      default: {
        return val !== undefined ? val : actionPayload;
      }
    }
  }

  // Standard reducer logic without explicit action
  if ((reducer === "append" || reducer === "concat_array") && Array.isArray(prevVal)) {
    return [...prevVal, ...(Array.isArray(val) ? val : val != null ? [val] : [])];
  }
  if (
    (reducer === "merge_object" || type === "object") &&
    typeof prevVal === "object" &&
    typeof val === "object" &&
    prevVal !== null &&
    val !== null
  ) {
    return { ...(prevVal as Record<string, unknown>), ...(val as Record<string, unknown>) };
  }
  return val;
}

export function applyAgentStateUpdates(params: {
  stateUpdates?: Array<{
    channelKey: string;
    schemaField?: string;
    value?: string;
    source?: string;
    mode?: string;
    reducer?: string;
    action?: string;
  }>;
  state: Record<string, unknown>;
  stateChannels: LangGraphStateChannel[];
  outputDelta: Record<string, unknown>;
  latestAssistantResponse?: string;
  latestStructuredResponse?: Record<string, unknown>;
  addLog: BrowserAddLogFn;
}): AppliedStateUpdateRecord[] {
  const {
    stateUpdates,
    state,
    stateChannels,
    outputDelta,
    latestAssistantResponse,
    latestStructuredResponse,
    addLog,
  } = params;

  const appliedStateUpdates: AppliedStateUpdateRecord[] = [];

  for (const update of stateUpdates || []) {
    const rawFieldKey = update.schemaField || update.value || update.channelKey || "";
    const cleanFieldKey = rawFieldKey.replace(/^structuredResponse\./, "").trim();

    const parsedObj = latestStructuredResponse;

    let val: unknown;

    let resolvedValue = update.value;
    if (typeof resolvedValue === "string" && resolvedValue.includes("${")) {
      resolvedValue = resolvedValue.replace(/\$\{([^}]+)\}/g, (_: string, expr: string): string => {
        const clean = expr.trim();
        if (clean === "response.content") return latestAssistantResponse ?? "";
        if (clean === "response") return JSON.stringify(parsedObj ?? latestAssistantResponse ?? "");
        if (clean.startsWith("response.")) {
          const field = clean.replace(/^response\./, "");
          const resVal = parsedObj ? parsedObj[field] : undefined;
          return resVal !== undefined && resVal !== null ? String(resVal) : "";
        }
        if (clean.startsWith("state.")) {
          const field = clean.replace(/^state\./, "");
          const stVal = state[field];
          return stVal !== undefined && stVal !== null ? String(stVal) : "";
        }
        return "";
      });
    }

    if (update.source === "structured_field" || update.schemaField) {
      val = resolveStructuredFieldValue(rawFieldKey, parsedObj, latestAssistantResponse);
    } else if (update.source === "structured_full") {
      val = outputDelta.structuredResponse;
    } else if (update.source === "message_content") {
      val = latestAssistantResponse;
    } else if (update.source === "message_object") {
      const msgs = outputDelta.messages;
      val = Array.isArray(msgs) && msgs.length > 0 ? msgs[msgs.length - 1] : undefined;
    } else if (update.source === "expression" || update.mode === "expression") {
      try {
        const structuredScope =
          typeof outputDelta.structuredResponse === "object" &&
          outputDelta.structuredResponse !== null
            ? outputDelta.structuredResponse
            : {};
        const responseScope = {
          content: latestAssistantResponse,
          ...structuredScope,
          ...outputDelta,
        };
        const exprFn = new Function("state", "clone", "response", `return (${resolvedValue});`);
        val = exprFn(state, clone, responseScope);
      } catch {
        val = resolvedValue;
      }
    } else {
      val = resolvedValue;
      if (typeof val === "string") {
        if (/\bstate\b/.test(val)) {
          try {
            const exprFn = new Function("state", "clone", `return (${val});`);
            val = exprFn(state, clone);
          } catch {
            // fallback to JSON parse
          }
        }
      }
    }

    if (typeof val === "string") {
      try {
        const jsonCompatible = val.replace(/`(\$\{[^`]+\})`/g, '"$1"');
        val = JSON.parse(jsonCompatible);
      } catch {
        // Keep plain string
      }
    }

    const isActionWithoutValue =
      update.action === "reset" ||
      update.action === "toggle" ||
      update.action === "clear";

    if (val === undefined && !isActionWithoutValue) {
      addLog(
        "warn",
        `State update for channel "${update.channelKey}" skipped: field "${cleanFieldKey}" not found in model output`,
        {
          update,
          structuredResponse: outputDelta.structuredResponse,
          response: latestAssistantResponse,
        },
      );
      continue;
    }

    const targetChannel = stateChannels.find(
      (c) => c.key === update.channelKey,
    );
    const channelReducer =
      targetChannel?.reducer ||
      update.reducer ||
      (update.mode === "append" ? "append" : "replace");

    const prevVal = state[update.channelKey];

    // Form the action payload if action is specified
    const actionPayload =
      update.action && update.action !== "default"
        ? val !== undefined
          ? { action: update.action, value: val }
          : { action: update.action }
        : val;

    // Execute reducer:
    if (targetChannel?.customReducerCode) {
      try {
        const fn = new Function(
          "prev",
          "next",
          "state",
          `"use strict";
          const customFn = (${targetChannel.customReducerCode});
          if (typeof customFn === "function") {
            return customFn(prev, next, state);
          }
          return customFn;`,
        );
        state[update.channelKey] = fn(prevVal, actionPayload, state);
      } catch {
        state[update.channelKey] = executeBrowserBuiltInAction(
          update.action,
          channelReducer,
          targetChannel?.type,
          prevVal,
          val,
          actionPayload,
        );
      }
    } else {
      state[update.channelKey] = executeBrowserBuiltInAction(
        update.action,
        channelReducer,
        targetChannel?.type,
        prevVal,
        val,
        actionPayload,
      );
    }

    const newVal = state[update.channelKey];
    outputDelta[update.channelKey] = newVal;

    const record: AppliedStateUpdateRecord = {
      channelKey: update.channelKey,
      previousValue: prevVal,
      newValue: newVal,
      reducer: channelReducer,
      action: update.action,
      source: update.source || "structured_field",
      sourceField: cleanFieldKey,
    };
    appliedStateUpdates.push(record);

    addLog(
      "state",
      `State Channel Mutated: "${update.channelKey}" = ${JSON.stringify(newVal)} (Reducer: ${channelReducer}${update.action ? `, Action: ${update.action}` : ""}, was: ${JSON.stringify(prevVal)})`,
      record,
    );
  }

  return appliedStateUpdates;
}

export function applyStepStateUpdates(params: {
  stateUpdates?: unknown[];
  state: Record<string, unknown>;
  stateChannels: LangGraphStateChannel[];
  outputDelta: Record<string, unknown>;
  latestAssistantResponse?: string;
  addLog: BrowserAddLogFn;
}): AppliedStateUpdateRecord[] {
  const {
    stateUpdates,
    state,
    stateChannels,
    outputDelta,
    latestAssistantResponse,
    addLog,
  } = params;

  const appliedStepStateUpdates: AppliedStateUpdateRecord[] = [];

  for (const updateItem of stateUpdates || []) {
    const update = updateItem as {
      channelKey: string;
      value?: string;
      mode?: "set" | "append" | "expression" | string;
      source?: string;
      schemaField?: string;
    };
    const rawFieldKey = update.schemaField || update.value || update.channelKey || "";
    const cleanFieldKey = rawFieldKey.replace(/^structuredResponse\./, "").trim();

    const parsedObj = outputDelta.structuredResponse as
      | Record<string, unknown>
      | undefined;

    let val: unknown;

    if (update.source === "structured_field" || update.schemaField) {
      val = resolveStructuredFieldValue(rawFieldKey, parsedObj, latestAssistantResponse);
    } else if (update.source === "structured_full") {
      val = outputDelta.structuredResponse;
    } else if (update.source === "message_content") {
      val = latestAssistantResponse;
    } else {
      val = update.value;
      if (typeof val === "string") {
        try {
          val = JSON.parse(val);
        } catch {
          // plain text
        }
      }
    }

    if (val === undefined) continue;

    const targetChannel = stateChannels.find(
      (c) => c.key === update.channelKey,
    );
    const channelReducer =
      targetChannel?.reducer ||
      (update.mode === "append" ? "append" : "replace");

    const prevVal = state[update.channelKey];

    if (
      (update.mode === "append" ||
        channelReducer === "append" ||
        channelReducer === "concat_array") &&
      Array.isArray(state[update.channelKey])
    ) {
      state[update.channelKey] = [
        ...(state[update.channelKey] as unknown[]),
        ...(Array.isArray(val) ? val : [val]),
      ];
    } else if (
      (channelReducer === "merge_object" ||
        targetChannel?.type === "object") &&
      typeof state[update.channelKey] === "object" &&
      typeof val === "object" &&
      state[update.channelKey] !== null &&
      val !== null
    ) {
      state[update.channelKey] = {
        ...(state[update.channelKey] as Record<string, unknown>),
        ...(val as Record<string, unknown>),
      };
    } else {
      state[update.channelKey] = val;
    }

    const newVal = state[update.channelKey];
    outputDelta[update.channelKey] = newVal;

    const record: AppliedStateUpdateRecord = {
      channelKey: update.channelKey,
      previousValue: prevVal,
      newValue: newVal,
      reducer: channelReducer,
      source: update.source || "custom",
      sourceField: cleanFieldKey,
    };
    appliedStepStateUpdates.push(record);

    addLog(
      "state",
      `State Channel Mutated: "${update.channelKey}" = ${JSON.stringify(newVal)} (Reducer: ${channelReducer}, was: ${JSON.stringify(prevVal)})`,
      record,
    );
  }

  return appliedStepStateUpdates;
}

