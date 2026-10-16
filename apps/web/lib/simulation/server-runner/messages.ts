import {
  BaseMessage,
  HumanMessage,
  AIMessage,
  SystemMessage,
  isBaseMessage,
} from "@langchain/core/messages";

export function clone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}

export function generateId(): string {
  return "cp_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

export function serializeMessages(raw: unknown): Array<{ role: string; content: string; name?: string }> {
  if (!Array.isArray(raw)) return [];
  const result: Array<{ role: string; content: string; name?: string }> = [];
  for (const item of raw) {
    if (isBaseMessage(item)) {
      const role =
        item._getType() === "human"
          ? "user"
          : item._getType() === "ai"
            ? "assistant"
            : item._getType() === "system"
              ? "system"
              : "user";
      result.push({
        role,
        content: typeof item.content === "string" ? item.content : JSON.stringify(item.content),
        name: item.name,
      });
    } else if (item && typeof item === "object") {
      const msg = item as Record<string, unknown>;
      result.push({
        role: typeof msg.role === "string" ? msg.role : "user",
        content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content ?? ""),
        name: typeof msg.name === "string" ? msg.name : undefined,
      });
    } else if (typeof item === "string") {
      result.push({ role: "user", content: item });
    }
  }
  return result;
}

export function coerceToLangChainMessages(raw: unknown): BaseMessage[] {
  if (!Array.isArray(raw)) return [];
  const list: BaseMessage[] = [];
  for (const item of raw) {
    if (isBaseMessage(item)) {
      list.push(item);
    } else if (typeof item === "string") {
      list.push(new HumanMessage(item));
    } else if (item && typeof item === "object") {
      const m = item as { role?: string; content?: string; text?: string };
      const content = m.content || m.text || "";
      if (m.role === "assistant" || m.role === "ai") {
        list.push(new AIMessage(content));
      } else if (m.role === "system") {
        list.push(new SystemMessage(content));
      } else {
        list.push(new HumanMessage(content));
      }
    }
  }
  return list;
}

export function serializeStateValues(values: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (k === "messages" && Array.isArray(v)) {
      result.messages = serializeMessages(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}
