// ═══════════════════════════════════════════════════════════════════════════
// MODULE:  transformers/schemaReconciler
// LAYER:   resolvers
// PURPOSE: Merges user-configured return schemas with schemas inferred from
//          the transformer function body using static code analysis.
//
// Reconciliation rules:
//   1. If existing schema is empty or is the default dummy ["result"],
//      replace entirely with inferred schema.
//   2. If inferred schema provides richer nested types or more specific types,
//      upgrade the existing field definitions.
//   3. Fields present in inferred but missing from existing are appended.
// ═══════════════════════════════════════════════════════════════════════════

import { SchemaFieldLike } from "./typeMapper";
import { inferReturnSchemaFromCode } from "@/lib/utils/inferReturnSchema";

/**
 * Type guard — confirms that a value is an array of SchemaFieldLike objects.
 * Used to safely narrow `inf.nestedFields` without an `as` cast.
 */
function isSchemaFieldArray(val: SchemaFieldLike[] | undefined): val is SchemaFieldLike[] {
  return Array.isArray(val) && val.length > 0;
}

/**
 * Reconciles a user-configured `returnSchema` with the schema inferred from
 * the transformer's function body code.
 *
 * @param existingSchema - Schema fields configured by the user in the canvas.
 * @param code           - The transformer function body (TypeScript source).
 * @param inputSchema    - The function's input schema (used by the inferrer).
 * @returns              - The reconciled schema, preferring explicit config
 *                         but upgrading with richer inferred types where safe.
 *
 * @debugTag schema-reconciler
 */
export function reconcileReturnSchema(
  existingSchema: Array<{
    name: string;
    type?: string;
    isArray?: boolean;
    required?: boolean;
    description?: string;
    nestedFields?: SchemaFieldLike[];
  }> = [],
  code?: string,
  inputSchema?: SchemaFieldLike[],
): SchemaFieldLike[] {
  const normalizedExisting: SchemaFieldLike[] = existingSchema.map((f) => ({
    name: f.name,
    type: f.type || "string",
    isArray: f.isArray,
    required: f.required,
    description: f.description,
    nestedFields: f.nestedFields,
  }));

  // No code provided — return the existing schema as-is
  if (!code || !code.trim()) {
    return normalizedExisting;
  }

  // A single-field schema named "result" is the canvas default placeholder
  const isDefaultDummy =
    normalizedExisting.length === 1 && normalizedExisting[0]?.name === "result";

  // Run static inference on the function body
  const inferred = inferReturnSchemaFromCode(code, inputSchema);
  if (!inferred || inferred.length === 0) {
    return normalizedExisting;
  }

  // If existing is empty or the default placeholder, take the inferred schema
  if (normalizedExisting.length === 0 || isDefaultDummy) {
    return inferred.map((inf) => ({
      name: inf.name,
      type: inf.type ?? "string",
      isArray: inf.isArray,
      required: inf.required,
      nestedFields: isSchemaFieldArray(inf.nestedFields as SchemaFieldLike[] | undefined)
        ? (inf.nestedFields as SchemaFieldLike[])
        : undefined,
    }));
  }

  // Merge: upgrade existing fields with richer inferred data
  const inferredMap = new Map(inferred.map((inf) => [inf.name, inf]));

  const reconciled: SchemaFieldLike[] = normalizedExisting.map((field) => {
    const inf = inferredMap.get(field.name);
    if (!inf) return field;

    // Use inferred type when the existing field has a richer nested structure
    // from inference, or was using the default "string" while inference found better
    const hasRicherNested = Boolean(
      inf.nestedFields &&
        inf.nestedFields.length > 0 &&
        (!field.nestedFields || field.nestedFields.length === 0),
    );

    const hadDefaultStringType =
      (!field.type || field.type.toLowerCase() === "string") &&
      inf.type !== "string";

    return {
      ...field,
      type:
        hasRicherNested || hadDefaultStringType
          ? inf.type ?? "string"
          : field.type ?? inf.type ?? "string",
      nestedFields: isSchemaFieldArray(inf.nestedFields as SchemaFieldLike[] | undefined)
        ? (inf.nestedFields as SchemaFieldLike[])
        : field.nestedFields,
      isArray: field.isArray ?? inf.isArray,
      required: field.required ?? inf.required,
    };
  });

  // Append inferred fields that were not in the existing schema at all
  for (const inf of inferred) {
    if (!reconciled.some((f) => f.name === inf.name)) {
      reconciled.push({
        name: inf.name,
        type: inf.type ?? "string",
        isArray: inf.isArray,
        required: inf.required,
        nestedFields: isSchemaFieldArray(inf.nestedFields as SchemaFieldLike[] | undefined)
          ? (inf.nestedFields as SchemaFieldLike[])
          : undefined,
      });
    }
  }

  return reconciled;
}
