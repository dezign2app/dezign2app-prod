import { DbOperationFunction } from "@workspace/canvas/types";

/**
 * Generate sensible default parameter values for test case based on operation params
 */
export function generateDefaultParams(
  op: DbOperationFunction,
  label: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const cleanLabel = (label || "item").toLowerCase().replace(/[^a-z0-9_]/g, "_");

  (op.params || []).forEach((p) => {
    const name = p.name.toLowerCase();
    const type = (p.type || "string").toLowerCase();

    if (p.defaultValue) {
      try {
        result[p.name] = JSON.parse(p.defaultValue);
        return;
      } catch {
        result[p.name] = p.defaultValue;
        return;
      }
    }

    if (name === "key" || name === "id") {
      result[p.name] = `${cleanLabel}:1001`;
    } else if (name === "item" || name === "data" || name === "record") {
      result[p.name] = {
        sender: "alice",
        message: "Hello world from test studio!",
        timestamp: new Date().toISOString(),
      };
    } else if (name === "field") {
      result[p.name] = "status";
    } else if (name === "fields") {
      result[p.name] = {
        name: "Alice",
        role: "admin",
        active: true,
      };
    } else if (name === "count" || name === "limit") {
      result[p.name] = 10;
    } else if (name === "offset") {
      result[p.name] = 0;
    } else if (name === "score") {
      result[p.name] = 100;
    } else if (name === "member") {
      result[p.name] = "user_1001";
    } else if (name === "ttlseconds" || name === "ttl") {
      result[p.name] = 3600;
    } else if (type.includes("number")) {
      result[p.name] = 1;
    } else if (type.includes("bool")) {
      result[p.name] = true;
    } else if (type.includes("record") || type.includes("object") || type.includes("{")) {
      result[p.name] = { sampleKey: "sampleValue" };
    } else {
      result[p.name] = "sample_value";
    }
  });

  // Ensure key exists if no params defined
  if (Object.keys(result).length === 0) {
    result.key = `${cleanLabel}:1001`;
  }

  return result;
}
