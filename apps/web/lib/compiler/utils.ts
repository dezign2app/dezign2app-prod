import { Endpoint } from "@workspace/canvas/types";
import { JSONValue } from "@workspace/canvas/types";

/**
 * Derives a stable, human-readable camelCase file name for a route/type file.
 *
 * Rules:
 * 1. Checks `ep.name` (the HTTP route path).
 *    - Converts path params like `/:id` or `/{id}` to `_by_$1` (e.g. `/users/:id` -> `getUsersById`).
 *    - If the resulting name is meaningful and NOT a random ID (e.g. `zaz4xx1`, `tohz6eq`, hex hashes, nanoid, or matches `ep.id`), use it!
 * 2. If `ep.name` is missing, empty, generic (`endpoint_1`), or a random ID:
 *    - Check `ep.summary`: if human-readable text exists (e.g. "Create a product"), clean and use it.
 *    - Check `ep.businessLogic`: if a short descriptive title exists, use it.
 * 3. Fallback:
 *    - If `serviceName` is provided (e.g. "Products", "NotificationService"):
 *      Use method + serviceName (e.g. `getProducts`, `createProducts`, `getNotificationService`).
 *      For multiple fallback endpoints in the same service: `getProducts`, `getProducts_2`, etc.
 *    - If no `serviceName`:
 *      Use method + "endpoint" (e.g. `get_endpoint_1`).
 *
 * Guaranteed: NO random database IDs or nanoids in route names or type definitions.
 */
export function deriveRouteFileName(
  ep: Pick<Endpoint, "name" | "summary" | "type"> & { id?: string; businessLogic?: string },
  index: number,
  serviceName?: string,
): string {
  const method = (ep.type || "GET").toLowerCase();

  function isRandomId(raw: string): boolean {
    if (!raw) return true;
    const clean = raw.trim();
    if (!clean) return true;

    // Direct check against ep.id if available
    if (ep.id && (clean === ep.id || clean === `/${ep.id}` || clean.toLowerCase() === ep.id.toLowerCase())) {
      return true;
    }

    // Generic placeholders
    if (/^(endpoint|route)(_\d+)?$/i.test(clean)) return true;

    // Strip leading and trailing slashes and take non-empty segments
    const segments = clean.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
    if (segments.length === 0) return true;

    return segments.every((seg) => {
      // Direct match with ep.id
      if (ep.id && (seg === ep.id || seg.toLowerCase() === ep.id.toLowerCase())) return true;

      // Pure hex string: e.g. "a1b2c3d4", "deadbeef", "7f8a9b"
      if (/^[0-9a-f]{5,32}$/i.test(seg)) return true;

      // Base36 / nanoid random pattern: 5-14 chars with mixed letters and numbers
      // e.g. "zaz4xx1", "tohz6eq", "k3m8n1p", "9a8b7c"
      if (/^[a-z0-9]{5,14}$/i.test(seg) && /[0-9]/.test(seg) && /[a-z]/i.test(seg)) {
        // Exception: standard common tech abbreviations with numbers
        if (/^(oauth2|v\d+|mp\d+|h\d+|b2b|b2c|p2p|ipv\d+)$/i.test(seg)) return false;
        return true;
      }

      // Pure numbers
      if (/^\d+$/.test(seg)) return true;

      // Random consonant clusters (no vowels in words >= 5 chars, e.g. "zxcvbn")
      if (seg.length >= 5 && !/[aeiouy]/i.test(seg)) return true;

      return false;
    });
  }

  // Helper to convert path with params into readable string
  function cleanPathString(pathStr: string): string {
    return pathStr
      .replace(/:([a-zA-Z0-9_]+)/g, "by_$1")
      .replace(/\{([a-zA-Z0-9_]+)\}/g, "by_$1")
      .replace(/^\/+|\/+$/g, "");
  }

  // 1. Try path name
  if (ep.name && ep.name.trim()) {
    const rawPath = ep.name.trim();
    if (!isRandomId(rawPath)) {
      const cleaned = cleanPathString(rawPath);
      const stripped = cleaned.replace(/^(GET|POST|PUT|PATCH|DELETE)\s+/i, "").trim();
      const derived = toVarName(`${method}_${stripped}`);
      if (derived && derived !== method && !isRandomId(derived)) {
        return derived;
      }
    }
  }

  // 2. Try summary
  if (ep.summary && ep.summary.trim()) {
    const rawSummary = ep.summary.trim();
    if (!isRandomId(rawSummary)) {
      const stripped = rawSummary
        .replace(/^(GET|POST|PUT|PATCH|DELETE)\s+/i, "")
        .replace(new RegExp(`^(${method})\\s+`, "i"), "")
        .trim();
      const derived = toVarName(`${method}_${stripped}`);
      if (derived && derived !== method) {
        return derived;
      }
    }
  }

  // 3. Try businessLogic if it has a short descriptive title
  if (ep.businessLogic && ep.businessLogic.trim()) {
    const firstLine = ep.businessLogic.trim().split("\n")[0]?.trim() || "";
    if (
      firstLine &&
      firstLine.length <= 40 &&
      !isRandomId(firstLine) &&
      !firstLine.startsWith("import") &&
      !firstLine.startsWith("const") &&
      !firstLine.startsWith("//")
    ) {
      const stripped = firstLine
        .replace(/^(GET|POST|PUT|PATCH|DELETE)\s+/i, "")
        .replace(new RegExp(`^(${method})\\s+`, "i"), "")
        .trim();
      const derived = toVarName(`${method}_${stripped}`);
      if (derived && derived !== method) {
        return derived;
      }
    }
  }

  // 4. Meaningful Fallback using Service Name & HTTP Method
  if (serviceName && serviceName.trim()) {
    const cleanServiceName = serviceName.trim();
    const suffix = index > 0 ? `_${index + 1}` : "";
    const methodVerb =
      method === "post"
        ? "create"
        : method === "put" || method === "patch"
          ? "update"
          : method === "delete"
            ? "delete"
            : "get";

    return toVarName(`${methodVerb}_${cleanServiceName}${suffix}`);
  }

  return `${method}_endpoint_${index + 1}`;
}


export function parseSchemaJson(rawJson?: string): JSONValue {
  if (!rawJson || !rawJson.trim()) return null;
  try {
    return JSON.parse(rawJson);
  } catch {
    return null;
  }
}

export function toSqlIdentifier(str: string, fallback = "item"): string {
  if (!str) return fallback;
  const clean = str
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[^a-zA-Z_]+/, "");
  return clean || fallback;
}

export function toVarName(str: string): string {
  const safe = toSqlIdentifier(str, "item");
  const hasLeadingUnderscore = safe.startsWith("_");
  const core = hasLeadingUnderscore ? safe.slice(1) : safe;
  const camel = core.replace(/_([a-z0-9])/gi, (_, char) => char.toUpperCase());
  if (!camel) return hasLeadingUnderscore ? "_item" : "item";
  const result = camel.charAt(0).toLowerCase() + camel.slice(1);
  return hasLeadingUnderscore ? `_${result}` : result;
}

export function toPascalCase(str: string): string {
  if (!str) return "Item";
  const snake = str.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
  const safe = toSqlIdentifier(snake, "Item");
  const hasLeadingUnderscore = safe.startsWith("_");
  const core = hasLeadingUnderscore ? safe.slice(1) : safe;
  const camel = core.replace(/_([a-z0-9])/gi, (_, char) => char.toUpperCase());
  if (!camel) return hasLeadingUnderscore ? "_Item" : "Item";
  const result = camel.charAt(0).toUpperCase() + camel.slice(1);
  return hasLeadingUnderscore ? `_${result}` : result;
}

export function toTableName(str: string): string {
  if (!str) return "table";
  const snake = str.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
  return toSqlIdentifier(snake.toLowerCase(), "table");
}

export function toEnvVarName(str: string): string {
  if (!str) return "SERVICE";
  const clean = str.replace(/[^a-zA-Z0-9]/g, "_").replace(/([a-z])([A-Z])/g, "$1_$2");
  const env = clean.replace(/_+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
  return env || "SERVICE";
}

export function toSingular(str: string): string {
  if (!str) return str;
  const lower = str.toLowerCase();

  const irregulars: Record<string, string> = {
    people: "person",
    children: "child",
    men: "man",
    women: "woman",
    data: "data",
    media: "media",
    species: "species",
    series: "series",
  };

  if (irregulars[lower]) {
    const s = irregulars[lower];
    return str.charAt(0) === str.charAt(0).toUpperCase()
      ? s.charAt(0).toUpperCase() + s.slice(1)
      : s;
  }

  if (lower.endsWith("ies") && lower.length > 3) {
    return str.slice(0, -3) + (str.charAt(str.length - 3) === "I" ? "Y" : "y");
  }
  if (
    lower.endsWith("sses") ||
    lower.endsWith("shes") ||
    lower.endsWith("ches") ||
    lower.endsWith("xes") ||
    lower.endsWith("zes")
  ) {
    return str.slice(0, -2);
  }
  if (lower.endsWith("ses") && lower.length > 4) {
    if (
      lower.endsWith("status") ||
      lower.endsWith("statuses") ||
      lower.endsWith("process") ||
      lower.endsWith("processes")
    ) {
      return str.slice(0, -2);
    }
    return str.slice(0, -1);
  }
  if (
    lower.endsWith("s") &&
    !lower.endsWith("ss") &&
    !lower.endsWith("us") &&
    !lower.endsWith("is") &&
    lower.length > 2
  ) {
    return str.slice(0, -1);
  }

  return str;
}

export function toPlural(str: string): string {
  if (!str) return str;
  const lower = str.toLowerCase();

  if (
    lower.endsWith("ies") ||
    lower.endsWith("ses") ||
    (lower.endsWith("s") &&
      !lower.endsWith("ss") &&
      !lower.endsWith("us") &&
      !lower.endsWith("is"))
  ) {
    return str;
  }

  const irregulars: Record<string, string> = {
    person: "people",
    child: "children",
    man: "men",
    woman: "women",
    data: "data",
    media: "media",
    species: "species",
    series: "series",
  };

  if (irregulars[lower]) {
    const p = irregulars[lower];
    return str.charAt(0) === str.charAt(0).toUpperCase()
      ? p.charAt(0).toUpperCase() + p.slice(1)
      : p;
  }

  if (lower.endsWith("y") && !/[aeiou]y$/i.test(str)) {
    return str.slice(0, -1) + (str.charAt(str.length - 1) === "Y" ? "IES" : "ies");
  }
  if (
    lower.endsWith("s") ||
    lower.endsWith("sh") ||
    lower.endsWith("ch") ||
    lower.endsWith("x") ||
    lower.endsWith("z")
  ) {
    return str + (str.charAt(str.length - 1) === str.charAt(str.length - 1).toUpperCase() ? "ES" : "es");
  }

  return str + (str.charAt(str.length - 1) === str.charAt(str.length - 1).toUpperCase() ? "S" : "s");
}


