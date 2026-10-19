import { Annotation, addMessages } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import type {
  LangGraphCanvasNode,
  LangGraphStateChannel,
  AgentNodeData,
} from "@workspace/canvas";

export function buildGraphAnnotationSchema(
  nodes: LangGraphCanvasNode[],
  stateChannels: LangGraphStateChannel[],
) {
  const schemaSpec: Record<string, unknown> = {};

  const effectiveChannels = [...stateChannels];
  if (!effectiveChannels.some((c) => c.key === "messages")) {
    effectiveChannels.unshift({
      key: "messages",
      type: "messages",
      reducer: "add_messages",
      defaultValue: [],
    });
  }

  for (const ch of effectiveChannels) {
    if (
      ch.customReducerCode &&
      (ch.reducer === "custom" ||
        !["replace", "add_messages", "append", "concat_array", "merge_object"].includes(ch.reducer))
    ) {
      try {
        const fn = new Function(
          "prev",
          "next",
          `return (${ch.customReducerCode})(prev, next);`,
        );
        schemaSpec[ch.key] = Annotation<unknown>({
          reducer: (x, y) => fn(x, y),
          default: () => ch.defaultValue,
        });
        continue;
      } catch (err) {
        console.warn(`[simulation] Failed to evaluate custom reducer for ${ch.key}:`, err);
      }
    }

    if (ch.key === "messages" || ch.type === "messages") {
      schemaSpec[ch.key] = Annotation<BaseMessage[]>({
        reducer: addMessages,
        default: () => [],
      });
    } else if (ch.reducer === "append" || ch.type === "array") {
      schemaSpec[ch.key] = Annotation<unknown[]>({
        reducer: (x, y) => [...(x || []), ...(Array.isArray(y) ? y : [y])],
        default: () => (Array.isArray(ch.defaultValue) ? ch.defaultValue : []),
      });
    } else if (ch.type === "number") {
      schemaSpec[ch.key] = Annotation<number>({
        reducer: (x, y) => (y !== undefined ? Number(y) : (x !== undefined ? Number(x) : 0)),
        default: () => Number(ch.defaultValue) || 0,
      });
    } else if (ch.type === "boolean") {
      schemaSpec[ch.key] = Annotation<boolean>({
        reducer: (x, y) => (y !== undefined ? Boolean(y) : (x !== undefined ? Boolean(x) : false)),
        default: () => Boolean(ch.defaultValue),
      });
    } else if (ch.type === "object") {
      schemaSpec[ch.key] = Annotation<Record<string, unknown>>({
        reducer: (x, y) => ({ ...(x || {}), ...((y as Record<string, unknown>) || {}) }),
        default: () => ((ch.defaultValue as Record<string, unknown>) || {}),
      });
    } else {
      schemaSpec[ch.key] = Annotation<string>({
        reducer: (x, y) => (y !== undefined ? String(y) : String(x ?? "")),
        default: () => String(ch.defaultValue ?? ""),
      });
    }
  }

  // Auto-register structuredResponse channel if any agent node has structured output enabled
  const hasStructuredOutput = nodes.some(
    (n) => (n.data as AgentNodeData)?.responseFormat?.enabled,
  );
  if (hasStructuredOutput && !schemaSpec["structuredResponse"]) {
    schemaSpec["structuredResponse"] = Annotation<Record<string, unknown> | null>({
      reducer: (_, y) => y,
      default: () => null,
    });
  }

  return Annotation.Root(
    schemaSpec as Parameters<typeof Annotation.Root>[0],
  );
}
