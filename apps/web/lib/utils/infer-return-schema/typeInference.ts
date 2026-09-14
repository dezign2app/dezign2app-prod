import type { SchemaFieldInput } from "./types";

/**
 * Given a value expression, infers its TypeScript type string and isArray flag.
 */
export function inferTypeFromExpression(
  expr: string,
  fieldName: string,
  inputSchema?: SchemaFieldInput[],
): { type: string; isArray?: boolean } {
  const trimmed = expr.trim();

  // 1. Literal strings
  if (/^["'`].*["'`]$/s.test(trimmed)) {
    return { type: "string" };
  }

  // 2. Literal numbers
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return { type: "number" };
  }

  // 3. Literal booleans
  if (/^(true|false)$/.test(trimmed)) {
    return { type: "boolean" };
  }

  // 4. Literal array: [...]
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) {
      return { type: "any", isArray: true };
    }
    const firstItem = (inner.split(",")[0] ?? "").trim();
    if (/^["'`]/.test(firstItem)) return { type: "string", isArray: true };
    if (/^-?\d+/.test(firstItem)) return { type: "number", isArray: true };
    if (/^(true|false)/.test(firstItem)) return { type: "boolean", isArray: true };
    if (firstItem.startsWith("{")) return { type: "object", isArray: true };
    return { type: "any", isArray: true };
  }

  // 5. Literal object: {...}
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return { type: "object" };
  }

  // 6. Match against inputSchema
  // Checks e.g. input.conversation_id or conversation_id matching inputSchema field
  if (inputSchema && inputSchema.length > 0) {
    const inputFieldMatch = trimmed.match(/^(?:input\.)?([a-zA-Z0-9_$]+)$/);
    if (inputFieldMatch) {
      const paramName = inputFieldMatch[1];
      const match = inputSchema.find((p) => p.name === paramName || (p.id && p.id === paramName));
      if (match) {
        return {
          type: match.type || "string",
          isArray: match.isArray || match.type?.endsWith("[]"),
        };
      }
    }
  }

  // 7. Expressions resulting in boolean
  if (
    trimmed.startsWith("!") ||
    trimmed.includes("===") ||
    trimmed.includes("!==") ||
    trimmed.includes("==") ||
    trimmed.includes("!=") ||
    trimmed.includes("<") ||
    trimmed.includes(">") ||
    trimmed.startsWith("Boolean(")
  ) {
    return { type: "boolean" };
  }

  // 8. Expressions resulting in string
  if (
    trimmed.includes(".toString()") ||
    trimmed.includes(".toLowerCase()") ||
    trimmed.includes(".toUpperCase()") ||
    trimmed.includes(".trim()") ||
    trimmed.includes(".replace(") ||
    trimmed.includes(".substring(") ||
    trimmed.includes(".slice(") ||
    trimmed.includes(".concat(") ||
    trimmed.startsWith("String(") ||
    trimmed.startsWith("`")
  ) {
    return { type: "string" };
  }

  // 9. Expressions resulting in number
  if (
    trimmed.includes(".length") ||
    trimmed.startsWith("parseInt(") ||
    trimmed.startsWith("parseFloat(") ||
    trimmed.startsWith("Number(") ||
    trimmed.startsWith("Math.") ||
    trimmed.includes(" + ") ||
    trimmed.includes(" - ") ||
    trimmed.includes(" * ") ||
    trimmed.includes(" / ") ||
    trimmed.includes(" % ")
  ) {
    return { type: "number" };
  }

  // 10. Expressions resulting in Date
  if (trimmed.startsWith("new Date(") || trimmed.startsWith("Date.now(")) {
    return { type: "Date" };
  }

  // 11. Name-based heuristics on the field name or identifier
  const lowerName = fieldName.toLowerCase();

  if (
    /^is[A-Z]/.test(fieldName) ||
    /^has[A-Z]/.test(fieldName) ||
    /^should[A-Z]/.test(fieldName) ||
    /^can[A-Z]/.test(fieldName) ||
    ["success", "ok", "valid", "active", "enabled", "found", "done"].includes(lowerName)
  ) {
    return { type: "boolean" };
  }

  if (
    [
      "count",
      "total",
      "amount",
      "price",
      "cost",
      "age",
      "index",
      "size",
      "length",
      "qty",
      "quantity",
      "rate",
      "score",
      "percent",
      "offset",
      "limit",
      "statuscode",
      "port",
      "timestamp",
    ].includes(lowerName) ||
    lowerName.endsWith("_count") ||
    lowerName.endsWith("_total") ||
    lowerName.endsWith("_amount") ||
    lowerName.endsWith("_price")
  ) {
    return { type: "number" };
  }

  if (
    lowerName.endsWith("id") ||
    lowerName.endsWith("_id") ||
    lowerName.endsWith("key") ||
    lowerName.endsWith("_key") ||
    lowerName.endsWith("slug") ||
    lowerName.endsWith("url") ||
    lowerName.endsWith("email") ||
    lowerName.endsWith("name") ||
    lowerName.endsWith("message") ||
    lowerName.endsWith("text") ||
    lowerName.endsWith("token")
  ) {
    return { type: "string" };
  }

  if (["items", "list", "records", "tags", "categories", "rows", "elements"].includes(lowerName)) {
    return { type: "any", isArray: true };
  }

  // Default fallback
  return { type: "string" };
}
