import {
  JSONValue,
  JSONObject,
} from "@workspace/canvas/types";
import { AvailablePath } from "../types";

/**
 * Checks if a candidate source path matches an expected argument name.
 * Supports exact match, dot-separated subpath match (e.g. "body.user.email" vs "email"),
 * and case/format-insensitive match (e.g. "first_name" vs "firstName").
 */
export function isPathMatch(path: string, argName: string): boolean {
  if (!path || !argName) return false;
  const normArg = argName.trim().toLowerCase();
  const normPath = path.trim().toLowerCase();

  // 1. Exact match
  if (normPath === normArg) return true;

  // 2. Dot-suffix match (e.g., 'user.email' or 'data.items' ending with '.email' / '.items')
  if (normPath.endsWith(`.${normArg}`)) return true;

  // 3. Normalized alphanumeric match (handling snake_case vs camelCase, e.g., 'user_id' and 'userId')
  const normalize = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanArg = normalize(argName);
  const lastSegment = path.split(".").pop() || path;
  const cleanPath = normalize(lastSegment);

  return cleanPath.length > 0 && cleanPath === cleanArg;
}

export function isSchemaField(
  val: JSONValue,
): val is JSONObject & { name: string; type?: string } {
  return (
    typeof val === "object" &&
    val !== null &&
    !Array.isArray(val) &&
    typeof val.name === "string" &&
    val.name.trim().length > 0
  );
}

export function extractPathsFromObject(
  obj: JSONValue | JSONObject | undefined | null,
  prefix = "",
  depth = 0,
): AvailablePath[] {
  if (depth > 6 || obj === null || obj === undefined) return [];
  const results: AvailablePath[] = [];

  if (Array.isArray(obj)) {
    if (prefix) {
      results.push({ path: prefix, type: "array" });
    }
    if (obj.length > 0 && typeof obj[0] === "object" && obj[0] !== null) {
      results.push(
        ...extractPathsFromObject(
          obj[0],
          prefix ? `${prefix}[0]` : "[0]",
          depth + 1,
        ),
      );
    }
    return results;
  }

  if (typeof obj === "object") {
    if (prefix) {
      results.push({ path: prefix, type: "object" });
    }
    const entries = Object.entries(obj);
    for (const [key, val] of entries) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      const valType = Array.isArray(val) ? "array" : typeof val;
      if (val !== null && typeof val === "object") {
        results.push(
          ...extractPathsFromObject(val, fullPath, depth + 1),
        );
      } else {
        results.push({ path: fullPath, type: valType });
      }
    }
  }
  return results;
}
