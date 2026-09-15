// ═══════════════════════════════════════════════════════════════════════════
// MODULE:  transformers/transformerEmitter
// LAYER:   generators
// PURPOSE: Generates a single TypeScript transformer function file from
//          a TransformerHelperNodeData definition.
//
// EMITS:
//   packages/transformers/src/<fnName>.ts  (global scope)
//   apps/<service>/src/transformers/<fnName>.ts  (local scope)
// ═══════════════════════════════════════════════════════════════════════════

import { TransformerHelperNodeData, CompiledFile } from "@workspace/canvas/types";
import { toPascalCase, toVarName } from "../utils";
import { renderFieldType, SchemaFieldLike } from "./typeMapper";
import { reconcileReturnSchema } from "./schemaReconciler";

/**
 * Generates a single transformer helper TypeScript file from a definition.
 *
 * Generated signature (one of two forms):
 * ```ts
 * // Form 1 — user provided a full function declaration
 * export async function slugifyProductInput(input: SlugifyProductInputInput): Promise<SlugifyProductInputOutput> { ... }
 *
 * // Form 2 — user provided only the function body / steps
 * export function slugifyProductInput({ fieldA, fieldB }: SlugifyProductInputInput): SlugifyProductInputOutput { ... }
 * ```
 *
 * @param helper     - The transformer definition from the canvas node.
 * @param importPath - The import path string used in ReusableFunction metadata
 *                     (e.g. "@workspace/transformers" or "./transformers/fnName").
 * @returns          - A {@link CompiledFile} with `filename` relative to the
 *                     destination package root (caller adds the prefix).
 *
 * @debugTag transformer-emitter
 */
export function generateTransformerFile(
  helper: TransformerHelperNodeData,
  importPath: string,
): CompiledFile {
  const fnName = toVarName(helper.name || "transform");
  const Pascal = toPascalCase(fnName);

  const inputTypeName = `${Pascal}Input`;
  const outputTypeName = `${Pascal}Output`;

  // ── Build input interface ────────────────────────────────────────────────
  const inputFields =
    helper.inputSchema && helper.inputSchema.length > 0
      ? helper.inputSchema
          .map(
            (f) =>
              `  ${f.name}${f.required === false ? "?" : ""}: ${renderFieldType(f)};`,
          )
          .join("\n")
      : "  [key: string]: string | number | boolean | null;";

  // ── Build output interface ───────────────────────────────────────────────
  const returnSchema = reconcileReturnSchema(
    (helper.returnSchema || []) as SchemaFieldLike[],
    helper.code,
    helper.inputSchema as SchemaFieldLike[],
  );

  const outputFields =
    returnSchema.length > 0
      ? returnSchema
          .map(
            (f) =>
              `  ${f.name}${f.required === false ? "?" : ""}: ${renderFieldType(f)};`,
          )
          .join("\n")
      : "  [key: string]: string | number | boolean | null;";

  const rawCode = (helper.code || "").trim();

  // Detect whether the user supplied a complete function declaration
  const hasFunctionDecl = /^(export\s+)?(async\s+)?function\s+/m.test(rawCode);

  let processedCode = rawCode;
  if (hasFunctionDecl) {
    // Normalise the function name inside the user's declaration to match fnName
    processedCode = rawCode.replace(
      /^(export\s+)?(async\s+)?function\s+([a-zA-Z0-9_\s]+?)\s*\(/m,
      (_, exp = "", asy = "", _oldName) => `${exp}${asy}function ${fnName}(`,
    );
  }

  // ── Build function body ──────────────────────────────────────────────────
  let body: string;
  if (rawCode) {
    // User provided the body — indent it
    body = rawCode
      .split("\n")
      .map((l) => `  ${l}`)
      .join("\n");
  } else if (helper.prompt && helper.prompt.trim()) {
    body = [
      `  // TODO: Implement transformation`,
      `  // Description: ${helper.prompt.trim()}`,
      `  throw new Error("${fnName}: transformation not yet implemented");`,
    ].join("\n");
  } else {
    body = `  throw new Error("${fnName}: no implementation provided");`;
  }

  const asyncKw = helper.isAsync ? "async " : "";
  const returnTypeAnnotation = helper.isAsync
    ? `Promise<${outputTypeName}>`
    : outputTypeName;

  const fnDescription = helper.description
    ? `/**\n * ${helper.description}\n */\n`
    : `/**\n * Pure data-transformation function: ${fnName}\n * Auto-generated — edit the transformer definition to regenerate.\n */\n`;

  // Build destructured parameter signature if input schema fields are named
  const inputParamNames = (helper.inputSchema || [])
    .map((f) => f.name?.trim())
    .filter(Boolean);
  const paramSignature =
    inputParamNames.length > 0
      ? `{ ${inputParamNames.join(", ")} }: ${inputTypeName}`
      : `input: ${inputTypeName}`;

  const content = hasFunctionDecl
    ? // Full declaration — use as-is after renaming
      `${fnDescription}export interface ${inputTypeName} {\n${inputFields}\n}\n\nexport interface ${outputTypeName} {\n${outputFields}\n}\n\n${processedCode}\n`
    : // Body-only — wrap in a generated declaration
      `${fnDescription}export interface ${inputTypeName} {\n${inputFields}\n}\n\nexport interface ${outputTypeName} {\n${outputFields}\n}\n\nexport ${asyncKw}function ${fnName}(${paramSignature}): ${returnTypeAnnotation} {\n${body}\n}\n`;

  return {
    filename: `src/${fnName}.ts`,
    language: "typescript",
    content,
  };
}
