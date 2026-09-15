// ═══════════════════════════════════════════════════════════════════════════
// MODULE:  external/httpBodyCompiler
// LAYER:   utils
// PURPOSE: Compiles a JSON body string (with optional {{varName}} template
//          placeholders) into a TypeScript `JSON.stringify({...})` expression.
//          Used by external API function generation.
// ═══════════════════════════════════════════════════════════════════════════

import { JSONValue, JSONObject } from "@workspace/canvas/types";
import { parseRelaxedJson } from "../generators/routeGenerator/jsonInterpolation";

/**
 * Strict JSON scalar — all leaf types that can appear in a parsed JSON tree.
 * Defined explicitly so we never fall back to `unknown` when walking the tree.
 */
type JsonScalar = string | number | boolean | null;

/** Recursive JSON node — the full value space returned by JSON.parse. */
type JsonNode = JsonScalar | JsonNode[] | { [key: string]: JsonNode };

/**
 * Type guard — narrows a JSONValue to a plain object with optional name/type/required
 * fields (common shape for external API field schemas).
 */
export function isExternalField(
  val: JSONValue,
): val is JSONObject & { name?: string; type?: string; required?: boolean } {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

/**
 * Maps a canvas field `type` string to its TypeScript type string.
 * Used specifically for external API schemas.
 * Note: these strings are emitted verbatim into generated TypeScript source —
 * they are NOT TypeScript types used in this file's own compilation.
 */
export function mapExternalTypeToTs(type: string): string {
  const t = (type || "string").toLowerCase();
  if (["number", "int", "integer", "float", "double"].includes(t)) return "number";
  if (["boolean", "bool"].includes(t)) return "boolean";
  if (["string[]", "array"].includes(t)) return "string[]";
  if (["object", "record"].includes(t)) return "Record<string, string | number | boolean | null>";
  if (["any"].includes(t)) return "string | number | boolean | null | Record<string, string | number | boolean | null>";
  return "string";
}

/**
 * Serializes a `JsonNode` into a TypeScript object-literal expression string,
 * replacing sentinel tokens with `input["varName"]` accessor expressions.
 *
 * @param val            - A node in the parsed JSON tree.
 * @param depth          - Current indent depth (for multi-line output).
 * @param sentinelRegex  - Pre-compiled regex that matches sentinel strings.
 * @returns              - A TypeScript expression fragment (string).
 */
function formatJsonNode(val: JsonNode, depth: number, sentinelRegex: RegExp): string {
  const pad = "  ".repeat(depth);
  const innerPad = "  ".repeat(depth + 1);

  if (val === null) return "null";
  if (typeof val === "number" || typeof val === "boolean") return String(val);

  if (typeof val === "string") {
    const match = sentinelRegex.exec(val);
    if (match) {
      // Sentinel token → runtime input accessor
      return `input["${match[1]}"]`;
    }
    if (/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/.test(val)) {
      // Remaining {{var}} in values → template literal
      const interpolated = val.replace(
        /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
        (_, vk: string) => `\${input["${vk}"] ?? ""}`,
      );
      return `\`${interpolated}\``;
    }
    return JSON.stringify(val);
  }

  if (Array.isArray(val)) {
    if (val.length === 0) return "[]";
    const items = val
      .map((item) => `${innerPad}${formatJsonNode(item as JsonNode, depth + 1, sentinelRegex)}`)
      .join(",\n");
    return `[\n${items},\n${pad}]`;
  }

  // Plain object (not null, not array)
  const rec = val as Record<string, JsonNode>;
  const entries = Object.entries(rec);
  if (entries.length === 0) return "{}";
  const lines = entries.map(([k, v]) => {
    const keyExpr = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
    return `${innerPad}${keyExpr}: ${formatJsonNode(v, depth + 1, sentinelRegex)}`;
  });
  return `{\n${lines.join(",\n")},\n${pad}}`;
}

/**
 * Compiles a raw JSON body string (potentially containing `{{varName}}` placeholders)
 * into a TypeScript expression that produces the correct body string at runtime.
 *
 * Strategy:
 *  1. Replace `{{varName}}` sentinels in the JSON string so they survive JSON.parse.
 *  2. Parse the result with a relaxed JSON parser.
 *  3. Walk the parsed value tree and re-serialize to a TypeScript object literal,
 *     replacing sentinels back with `input["varName"]` accessor expressions.
 *  4. On parse failure, fall back to a template-literal interpolation.
 *
 * @param bodyContent - Raw JSON body string from the canvas node configuration.
 * @param baseIndent  - Number of 2-space indent levels for the output expression.
 * @returns           - A TypeScript expression string (e.g. `JSON.stringify({...})`)
 *
 * @debugTag http-body-compiler
 */
export function compileJsonBodyExpression(bodyContent: string, baseIndent = 1): string {
  if (!bodyContent || !bodyContent.trim()) {
    return "JSON.stringify(input)";
  }

  const SENTINEL_PREFIX = "__TMP_VAR_TOKEN_";
  const SENTINEL_SUFFIX = "_END__";
  const sentinelRegex = new RegExp(`^${SENTINEL_PREFIX}([a-zA-Z0-9_]+)${SENTINEL_SUFFIX}$`);

  // Replace {{var}} occurrences in values and array elements with unique sentinels
  const normalized = bodyContent
    .replace(/:\s*\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, `: "${SENTINEL_PREFIX}$1${SENTINEL_SUFFIX}"`)
    .replace(/:\s*"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}"/g, `: "${SENTINEL_PREFIX}$1${SENTINEL_SUFFIX}"`)
    .replace(/([,\[]\s*)\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, `$1"${SENTINEL_PREFIX}$2${SENTINEL_SUFFIX}"`)
    .replace(/([,\[]\s*)"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}"/g, `$1"${SENTINEL_PREFIX}$2${SENTINEL_SUFFIX}"`);

  const { parsed, error } = parseRelaxedJson(normalized);

  if (error || parsed === null) {
    // Fallback — template literal with inline {{var}} interpolation
    const interpolatedBody = bodyContent.replace(
      /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
      (_, k: string) =>
        `\${typeof input["${k}"] === "object" ? JSON.stringify(input["${k}"]) : input["${k}"] ?? ""}`,
    );
    return `\`${interpolatedBody}\``;
  }

  const objStr = formatJsonNode(parsed as JsonNode, baseIndent, sentinelRegex);
  return `JSON.stringify(${objStr})`;
}
