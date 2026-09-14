import type { Parameter, SchemaFieldInput, InferredFieldDraft, AggregatedField } from "./types";
import { stripComments } from "./sanitizer";
import { extractTopLevelReturns, resolveReturnExpression } from "./returnExtractor";

/**
 * Aggregates drafts across N return statement branches into a final list of canvas `Parameter` records.
 * Ensures fields present in all branches are required, while fields only in some branches or explicitly
 * optional in their source are marked optional.
 */
export function aggregateReturnBranches(returnBranches: InferredFieldDraft[][]): Parameter[] {
  if (returnBranches.length === 0) {
    return [];
  }

  const totalBranches = returnBranches.length;
  const fieldMap = new Map<string, AggregatedField>();

  for (const branch of returnBranches) {
    // Collect unique keys within this branch
    const seenInBranch = new Set<string>();

    for (const field of branch) {
      if (!field.name) continue;
      const key = field.name;

      if (!fieldMap.has(key)) {
        fieldMap.set(key, {
          name: key,
          branchCount: 0,
          types: new Set(),
          isArray: Boolean(field.isArray),
        });
      }

      const agg = fieldMap.get(key)!;
      if (!seenInBranch.has(key)) {
        agg.branchCount++;
        seenInBranch.add(key);
      }
      if (field.required === false) {
        agg.hasExplicitOptional = true;
      }
      if (field.type) {
        agg.types.add(field.type);
      }
      if (field.isArray) {
        agg.isArray = true;
      }
      if (field.nestedFields && field.nestedFields.length > 0) {
        if (!agg.nestedBranches) agg.nestedBranches = [];
        agg.nestedBranches.push(field.nestedFields);
      }
    }
  }

  // Construct final Parameter list
  const result: Parameter[] = [];
  let idx = 0;

  for (const [name, agg] of fieldMap.entries()) {
    // If field is present in all branches and wasn't explicitly marked optional, required is true
    const required = !agg.hasExplicitOptional && agg.branchCount === totalBranches;

    // Pick best type
    let chosenType = "string";
    if (agg.types.has("object")) {
      chosenType = "object";
    } else if (agg.types.has("boolean") && !agg.types.has("string") && !agg.types.has("number")) {
      chosenType = "boolean";
    } else if (agg.types.has("number") && !agg.types.has("string")) {
      chosenType = "number";
    } else if (agg.types.has("Date")) {
      chosenType = "Date";
    } else if (agg.types.size === 1) {
      chosenType = Array.from(agg.types)[0] ?? "string";
    } else if (agg.types.size > 1) {
      // If conflicting concrete types
      const filtered = Array.from(agg.types).filter((t) => t !== "any" && t !== "unknown");
      chosenType = filtered[0] ?? "any";
    }

    let nestedParams: Parameter[] | undefined;
    if (agg.nestedBranches && agg.nestedBranches.length > 0) {
      nestedParams = aggregateReturnBranches(agg.nestedBranches);
    }

    result.push({
      id: `param-out-${name}-${idx++}`,
      name,
      type: agg.isArray && !chosenType.endsWith("[]") ? `${chosenType}[]` : chosenType,
      isArray: agg.isArray,
      required,
      ...(nestedParams && nestedParams.length > 0 ? { nestedFields: nestedParams } : {}),
    });
  }

  return result;
}

/**
 * Infers the output return schema (`Parameter[]`) from the returns defined in the function.
 * Supports N number of return statements, correctly setting `required: true` if a field
 * is present in all return branches, and `required: false` (optional) if only in some branches.
 */
export function inferReturnSchemaFromCode(
  code: string,
  inputSchema?: SchemaFieldInput[],
): Parameter[] {
  if (!code || !code.trim()) {
    return [];
  }

  const cleanCode = stripComments(code);
  const returnExprs = extractTopLevelReturns(cleanCode);

  if (returnExprs.length === 0) {
    return [];
  }

  // Parse each return statement into its field set
  const returnBranches: InferredFieldDraft[][] = [];
  for (const expr of returnExprs) {
    const fields = resolveReturnExpression(expr, cleanCode, inputSchema);
    if (fields.length > 0) {
      returnBranches.push(fields);
    }
  }

  return aggregateReturnBranches(returnBranches);
}
