import type { LangGraphLLMNodeData, CanvasNodeData, StepNodeData } from "@/app/(canvas)/project/[projectId]/_components/backend-nodes/graph-nodes/langgraph/langgraph-canvas/types";
import {
  NODE_ID_START,
  NODE_ID_END,
  LANGGRAPH_CANVAS_NODE_NODE,
  LANGGRAPH_CANVAS_NODE_AGENT,
  LANGGRAPH_CANVAS_NODE_AGENT_REF,
  LANGGRAPH_CANVAS_NODE_NODE_REF,
  LANGGRAPH_CANVAS_NODE_STEP,
  LANGGRAPH_CANVAS_NODE_END,
  LANGGRAPH_CANVAS_NODE_START,
} from "@/app/(canvas)/project/[projectId]/_components/backend-nodes/graph-nodes/langgraph/langgraph-canvas/constants";
import type { CompileContext, NodeMeta } from "./types";

export function getProviderPackage(provider?: string): string {
  switch (provider) {
    case "openai":
      return "@langchain/openai";
    case "anthropic":
      return "@langchain/anthropic";
    case "google":
      return "@langchain/google-genai";
    case "groq":
      return "@langchain/groq";
    case "ollama":
      return "@langchain/ollama";
    default:
      return "@langchain/openai";
  }
}

export function getProviderClass(provider?: string): string {
  switch (provider) {
    case "openai":
      return "ChatOpenAI";
    case "anthropic":
      return "ChatAnthropic";
    case "google":
      return "ChatGoogleGenerativeAI";
    case "groq":
      return "ChatGroq";
    case "ollama":
      return "ChatOllama";
    default:
      return "ChatOpenAI";
  }
}

export function getEnvKey(data: LangGraphLLMNodeData): string | null {
  if (data.apiKeyHeader) return data.apiKeyHeader;
  switch (data.provider) {
    case "openai":
      return "OPENAI_API_KEY";
    case "anthropic":
      return "ANTHROPIC_API_KEY";
    case "google":
      return "GEMINI_API_KEY";
    case "groq":
      return "GROQ_API_KEY";
    default:
      return null;
  }
}

export function getZodType(
  type: string,
  defaultValue?: string | number | boolean | string[] | Record<string, string>,
): string {
  switch (type) {
    case "string":
      return `z.string().default(${JSON.stringify(defaultValue ?? "")})`;
    case "number":
      return `z.number().default(${Number(defaultValue ?? 0)})`;
    case "boolean":
      return `z.boolean().default(${Boolean(defaultValue ?? false)})`;
    case "array":
      return `z.array(z.string()).default(${JSON.stringify(defaultValue ?? [])})`;
    case "object":
      return `z.record(z.string()).default({})`;
    case "messages":
      return "MessagesValue";
    default:
      return `z.string().default(${JSON.stringify(defaultValue ?? "")})`;
  }
}

export function getReducerFn(reducer: string, type: string): string {
  switch (reducer) {
    case "append":
    case "concat_array":
      return type === "array" ? "(x, y) => x.concat(y)" : "(x, y) => x + y";
    case "merge_object":
      return "(x, y) => ({ ...x, ...y })";
    case "add_messages":
      return "(x, y) => x.concat(y)";
    case "replace":
    default:
      return "(_, y) => y";
  }
}

export interface JsonSchemaProperty {
  type?: string;
  description?: string;
  enum?: string[];
}

export interface JsonSchemaInput {
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export function jsonSchemaToZod(schema: JsonSchemaInput): string {
  if (schema.type !== "object" || !schema.properties) return "z.object({})";
  const props = schema.properties;
  const required = schema.required || [];

  const fields = Object.entries(props).map(([key, prop]) => {
    let zodType: string;
    if (prop.enum) {
      zodType = `z.enum([${prop.enum.map((e) => `"${e}"`).join(", ")}])`;
    } else {
      switch (prop.type) {
        case "string":
          zodType = "z.string()";
          break;
        case "number":
          zodType = "z.number()";
          break;
        case "boolean":
          zodType = "z.boolean()";
          break;
        case "array":
          zodType = "z.array(z.string())";
          break;
        default:
          zodType = "z.string()";
      }
    }
    if (!required.includes(key)) zodType += ".optional()";
    if (prop.description)
      zodType += `.describe("${escapeStr(prop.description)}")`;
    return `  ${key}: ${zodType},`;
  });

  return `z.object({\n${fields.join("\n")}\n})`;
}

export function resolveNodeName(
  nodeId: string,
  ctx: CompileContext,
  nodeMetaMap?: Map<string, NodeMeta>,
): string | null {
  if (
    nodeId === NODE_ID_START ||
    nodeId === "START" ||
    nodeId === "__start__" ||
    nodeId.toLowerCase() === "start" ||
    nodeId.startsWith("start_")
  ) {
    return "START";
  }
  if (
    nodeId === NODE_ID_END ||
    nodeId === "END" ||
    nodeId === "__end__" ||
    nodeId.toLowerCase() === "end" ||
    nodeId.startsWith("end_")
  ) {
    return "END";
  }

  if (nodeMetaMap) {
    const meta = nodeMetaMap.get(nodeId);
    if (meta) return meta.exportName;
  }

  const node = ctx.input.nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  if (
    node.type === LANGGRAPH_CANVAS_NODE_AGENT_REF ||
    node.type === LANGGRAPH_CANVAS_NODE_NODE_REF
  ) {
    const targetRefId = node.data.agentRef || node.data.nodeRef;
    if (targetRefId && targetRefId !== nodeId) {
      return resolveNodeName(targetRefId, ctx, nodeMetaMap);
    }
  }

  if (
    node.type === LANGGRAPH_CANVAS_NODE_NODE ||
    node.type === LANGGRAPH_CANVAS_NODE_AGENT
  ) {
    return toIdentifier(node.data.name || node.data.label || nodeId);
  }
  if (node.type === LANGGRAPH_CANVAS_NODE_STEP) {
    const d = node.data;
    if (d.stepType === "router") {
      const meta = nodeMetaMap?.get(nodeId);
      return meta ? meta.exportName : `${toIdentifier(d.label || nodeId)}Router`;
    }
    return toIdentifier(d.label || nodeId);
  }
  if (node.type === LANGGRAPH_CANVAS_NODE_END) return "END";
  if (node.type === LANGGRAPH_CANVAS_NODE_START) return "START";
  return null;
}

export function getNodeLabel(nodeId: string, ctx: CompileContext): string | null {
  const node = ctx.input.nodes.find((n) => n.id === nodeId);
  if (!node || !node.data) return null;
  if ("label" in node.data && typeof node.data.label === "string" && node.data.label.trim()) {
    return node.data.label.trim();
  }
  return null;
}

export function buildCondition(
  field: string,
  operator: string,
  value: string,
): string {
  const isNumericValue = !isNaN(Number(value)) && String(value).trim() !== "";
  const numVal = isNumericValue ? Number(value) : 0;
  const formattedVal =
    value === "true"
      ? "true"
      : value === "false"
        ? "false"
        : JSON.stringify(value);

  switch (operator) {
    case "eq":
    case "==":
    case "equals":
      return isNumericValue
        ? `(${field} === ${numVal} || ${field} === ${formattedVal})`
        : `${field} === ${formattedVal}`;
    case "neq":
    case "!=":
    case "not_equals":
      return isNumericValue
        ? `(${field} !== ${numVal} && ${field} !== ${formattedVal})`
        : `${field} !== ${formattedVal}`;
    case "gt":
    case ">":
      return `Number(${field} ?? 0) > ${numVal}`;
    case "gte":
    case ">=":
      return `Number(${field} ?? 0) >= ${numVal}`;
    case "lt":
    case "<":
      return `Number(${field} ?? 0) < ${numVal}`;
    case "lte":
    case "<=":
      return `Number(${field} ?? 0) <= ${numVal}`;
    case "contains":
      return `String(${field} ?? "").includes(${JSON.stringify(value)})`;
    case "starts_with":
      return `String(${field} ?? "").startsWith(${JSON.stringify(value)})`;
    case "ends_with":
      return `String(${field} ?? "").endsWith(${JSON.stringify(value)})`;
    case "is_not_null":
      return `${field} != null && ${field} !== ""`;
    case "has_tool_calls":
      return `Boolean(state.messages && state.messages.length > 0 && "tool_calls" in (state.messages[state.messages.length - 1] || {}) && Array.isArray((state.messages[state.messages.length - 1] || {}).tool_calls) && ((state.messages[state.messages.length - 1] || {}).tool_calls?.length ?? 0) > 0)`;
    case "is_true":
      return `Boolean(${field})`;
    case "is_false":
      return `!${field}`;
    default:
      return `${field} === ${formattedVal}`;
  }
}

export function toCamelCase(str: string): string {
  if (!str) return "node";
  const formatted = str
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim();
  if (!formatted) return "node";
  const words = formatted.split(/\s+/);
  return words
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("")
    .replace(/^([0-9])/, "node$1");
}

export function toPascalCase(str: string): string {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

export function toIdentifier(str: string): string {
  return toCamelCase(str);
}

export function getChannelReducerName(key?: string): string {
  const clean = (key || "var").replace(/[^a-zA-Z0-9_$]/g, "");
  if (!clean) return "stateReducer";
  const camel = toCamelCase(clean);
  return `${camel}Reducer`;
}

export function capitalize(str: string): string {
  return toPascalCase(str);
}

export function escapeStr(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

export function escapeTemplateLiteral(str: string): string {
  // Escape backticks and backslashes while preserving ${...} template variables for runtime interpolation
  return str.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
}

export function indent(code: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return code
    .split("\n")
    .map((line) => (line.trim() ? pad + line : line))
    .join("\n");
}
