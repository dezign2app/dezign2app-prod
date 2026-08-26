/**
 * Extracts template parameter names like `{id}` from a Redis key template
 */
export function extractTemplateParams(template: string): string[] {
  const matches = template.match(/\{([a-zA-Z0-9_]+)\}/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map((m) => m.slice(1, -1))));
}

/**
 * Maps column types to corresponding TypeScript types
 */
export function mapColumnTypeToTs(colType: string): string {
  const t = (colType || "").toUpperCase();
  if (
    t === "INTEGER" ||
    t === "INT" ||
    t === "REAL" ||
    t === "FLOAT" ||
    t === "NUMERIC" ||
    t === "NUMBER"
  ) {
    return "number";
  }
  if (t === "BOOLEAN" || t === "BOOL") {
    return "boolean";
  }
  if (t === "JSON" || t === "OBJECT") {
    return "Record<string, string | number | boolean | null>";
  }
  if (t === "ARRAY") {
    return "string[]";
  }
  return "string";
}
