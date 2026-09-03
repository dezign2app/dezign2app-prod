/**
 * Utility functions for parsing, validating, and extracting deeply nested
 * dot-notation paths from complex/arbitrary JSON payloads and schemas.
 */

export interface ExtractedPathItem {
  path: string;
  type: string;
  sample?: string;
  isLeaf: boolean;
}

/**
 * Recursively extracts all dot-notation paths from any JavaScript value / parsed JSON object.
 * Handles deeply nested objects, arrays of objects, primitive arrays, and nullables.
 */
function extractNestedPathsRecursive(
  data: unknown,
  prefix = "",
): ExtractedPathItem[] {
  if (data === null || data === undefined) {
    if (!prefix) return [];
    return [{ path: prefix, type: "null", sample: "null", isLeaf: true }];
  }

  if (Array.isArray(data)) {
    const arrayPath = prefix ? `${prefix}[]` : "[]";
    const result: ExtractedPathItem[] = [];

    if (prefix) {
      result.push({ path: prefix, type: "array", isLeaf: false });
    }
    result.push({ path: arrayPath, type: "array", isLeaf: false });

    if (data.length === 0) {
      return result;
    }

    // Inspect first element to infer item structure
    const firstItem = data[0];
    if (firstItem !== null && typeof firstItem === "object") {
      if (Array.isArray(firstItem)) {
        result.push(...extractNestedPathsRecursive(firstItem, arrayPath));
      } else {
        const itemKeys = Object.keys(firstItem);
        if (itemKeys.length === 0) {
          result.push({ path: arrayPath, type: "object", sample: "{}", isLeaf: true });
        } else {
          for (const key of itemKeys) {
            const val = (firstItem as Record<string, unknown>)[key];
            const childPath = `${arrayPath}.${key}`;
            result.push(...extractNestedPathsRecursive(val, childPath));
          }
        }
      }
    } else {
      // Primitive array elements: update the array leaf description
      const existingArrayItem = result.find((r) => r.path === arrayPath);
      if (existingArrayItem) {
        existingArrayItem.type = `${typeof firstItem}[]`;
        existingArrayItem.sample = String(firstItem).slice(0, 30);
        existingArrayItem.isLeaf = true;
      }
    }

    return result;
  }

  if (typeof data === "object") {
    const result: ExtractedPathItem[] = [];
    if (prefix) {
      result.push({ path: prefix, type: "object", isLeaf: false });
    }

    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) {
      if (prefix) {
        return [{ path: prefix, type: "object", sample: "{}", isLeaf: true }];
      }
      return [];
    }

    for (const [key, val] of entries) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      result.push(...extractNestedPathsRecursive(val, fieldPath));
    }

    return result;
  }

  const sample =
    typeof data === "string"
      ? `"${data.length > 25 ? `${data.slice(0, 25)}...` : data}"`
      : String(data);

  return [
    {
      path: prefix,
      type: typeof data,
      sample,
      isLeaf: true,
    },
  ];
}

/**
 * Recursively extracts all dot-notation paths from any JavaScript value / parsed JSON object.
 * Returns deduplicated paths.
 */
export function extractNestedPaths(
  data: unknown,
  prefix = "",
): ExtractedPathItem[] {
  const rawList = extractNestedPathsRecursive(data, prefix);
  const seen = new Set<string>();
  const unique: ExtractedPathItem[] = [];
  for (const item of rawList) {
    if (!seen.has(item.path)) {
      seen.add(item.path);
      unique.push(item);
    }
  }
  return unique;
}

/**
 * Safely parses raw JSON string.
 */
export function parseRawJsonSafe(rawJson?: string): {
  parsed: unknown;
  error: string | null;
} {
  if (!rawJson || !rawJson.trim()) {
    return { parsed: null, error: null };
  }
  try {
    const parsed = JSON.parse(rawJson);
    return { parsed, error: null };
  } catch (err) {
    return {
      parsed: null,
      error: err instanceof Error ? err.message : "Invalid JSON",
    };
  }
}

/**
 * Formats a raw JSON string with 2 spaces indentation.
 */
export function formatJsonPretty(rawJson: string): string {
  try {
    const parsed = JSON.parse(rawJson);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return rawJson;
  }
}

/**
 * Checks if an endpoint's output structure is undefined or empty.
 */
export function isOutputSchemaMissing(endpoint?: {
  responseBody?: { fields?: Array<{ name?: string }>; rawJson?: string };
  responseMode?: string;
}): boolean {
  if (!endpoint) return true;
  const fields = endpoint.responseBody?.fields;
  const hasNamedFields =
    Array.isArray(fields) && fields.some((f) => Boolean(f?.name && f.name.trim().length > 0));
  if (hasNamedFields) return false;

  const rawJson = endpoint.responseBody?.rawJson;
  if (rawJson && rawJson.trim().length > 0) {
    const { parsed, error } = parseRawJsonSafe(rawJson);
    if (!error && parsed !== null && parsed !== undefined) {
      if (typeof parsed === "object") {
        if (Array.isArray(parsed)) return parsed.length === 0;
        return Object.keys(parsed).length === 0;
      }
      return false;
    }
  }

  return true;
}
