export type ConvexPrimitive = string | number | boolean | null | undefined;

export type ConvexRecord = { [key: string]: ConvexValue };

export type ConvexValue =
  | ConvexPrimitive
  | Date
  | RegExp
  | Uint8Array
  | ArrayBuffer
  | ConvexValue[]
  | ConvexRecord;

function isPlainObject(val: object): val is Record<string, ConvexValue> {
  return (
    !(val instanceof Date) &&
    !(val instanceof RegExp) &&
    !(val instanceof Uint8Array) &&
    !(val instanceof ArrayBuffer) &&
    !Array.isArray(val)
  );
}

/**
 * Recursively sanitizes any value, object, or array before sending to Convex mutations.
 *
 * Convex Document & Field Name Rules:
 * 1. Field names cannot start with '$' or '_' (reserved for query operators and system fields).
 * 2. Field names cannot be empty or contain null characters.
 * 3. Field values cannot contain explicit `undefined` inside objects.
 *
 * This utility:
 * - Unwraps RedisJSON-style envelopes where a single root key is a JSONPath starting with '$' (e.g. { "$[-20:]": [...] } -> [...]).
 * - Renames any remaining field name starting with '$' or '_' to 'val_$1' (e.g. "$[-20:]" -> "val_$[-20:]", "_custom" -> "val__custom").
 * - Replaces empty keys with 'empty_key'.
 * - Omits fields with `undefined` values.
 * - Recursively processes arrays and nested objects while preserving Dates, RegExps, TypedArrays.
 */
export function sanitizeForConvex<T>(value: T): T;
export function sanitizeForConvex(value: ConvexValue): ConvexValue {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    const list: ConvexValue[] = [];
    for (const item of value) {
      list.push(sanitizeForConvex(item));
    }
    return list;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const keys = Object.keys(value);
  const firstKey = keys[0];
  if (keys.length === 1 && firstKey && firstKey.startsWith("$")) {
    const inner = value[firstKey];
    if (inner !== undefined) {
      return sanitizeForConvex(inner);
    }
  }

  const cleanObj: Record<string, ConvexValue> = {};
  for (const key of keys) {
    const val = value[key];
    if (val === undefined) {
      continue;
    }

    let safeKey = key;
    if (!safeKey || safeKey.trim() === "") {
      safeKey = "empty_key";
    } else if (safeKey.startsWith("$") || safeKey.startsWith("_")) {
      safeKey = safeKey.replace(/^([$_]+)/, "val_$1");
    }

    cleanObj[safeKey] = sanitizeForConvex(val);
  }

  return cleanObj;
}
