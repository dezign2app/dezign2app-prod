// ═══════════════════════════════════════════════════════════════════════════
// MODULE:  transformers/typeMapper
// LAYER:   utils
// PURPOSE: Primitive TypeScript type utilities shared by transformer emitters.
//          Maps schema field descriptors to TypeScript type strings.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Maps a schema `type` string (from the canvas field descriptor) to its
 * TypeScript equivalent.
 *
 * NOTE: The strings returned here are emitted verbatim into generated TypeScript
 * source files — they are not TypeScript types used in this compiler's own
 * compilation.
 *
 * Supported inputs (case-insensitive):
 *   number | int | integer | float | double → "number"
 *   boolean | bool                          → "boolean"
 *   string[] | array                        → "string[]"
 *   object | record                         → "Record<string, string | number | boolean | null>"
 *   any                                     → "string | number | boolean | null"
 *   (anything else)                         → "string"
 */
export function mapTypeToTs(type: string): string {
  const t = (type || "string").toLowerCase();
  if (["number", "int", "integer", "float", "double"].includes(t)) return "number";
  if (["boolean", "bool"].includes(t)) return "boolean";
  if (["string[]", "array"].includes(t)) return "string[]";
  if (["object", "record"].includes(t)) return "Record<string, string | number | boolean | null>";
  if (["any"].includes(t)) return "string | number | boolean | null";
  return "string";
}

/** Minimal field shape expected by {@link renderFieldType}. */
export interface SchemaFieldLike {
  name: string;
  type?: string;
  isArray?: boolean;
  required?: boolean;
  description?: string;
  nestedFields?: SchemaFieldLike[];
}

/**
 * Renders the TypeScript type string for a single schema field, handling:
 * - Nested object types (recursively)
 * - Array wrapping (`isArray: true`)
 * - Primitive type mapping via {@link mapTypeToTs}
 */
export function renderFieldType(f: {
  name?: string;
  type?: string;
  isArray?: boolean;
  required?: boolean;
  nestedFields?: SchemaFieldLike[];
}): string {
  if (f.nestedFields && f.nestedFields.length > 0) {
    // Nested object — render as an inline object type
    const innerProps = f.nestedFields
      .filter((nf) => nf && nf.name)
      .map(
        (nf) =>
          `${nf.name}${nf.required === false ? "?" : ""}: ${renderFieldType(nf)}`,
      )
      .join("; ");
    const objType = `{ ${innerProps} }`;
    return f.isArray ? `${objType}[]` : objType;
  }

  const base = mapTypeToTs(f.type || "string");
  if (f.isArray && !base.endsWith("[]")) {
    return `${base}[]`;
  }
  return base;
}
