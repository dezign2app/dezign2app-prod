// ═══════════════════════════════════════════════════════════════
// MODULE: RedisHelpersOrchestrator
// LAYER:  redis / generators / helpers
// EMITS:  Typed helper files and barrels for Redis instance packages
// ═══════════════════════════════════════════════════════════════

import { CompiledFile } from "@workspace/canvas/types";
import { BackendNode } from "@/types/canvas";
import { GeneratedSchemaResult } from "../schemaFiles";
import { HelperContext, HelperFilesResult } from "./types";
import { compileHashHelpers } from "./compileHashHelpers";
import { compileListHelpers } from "./compileListHelpers";
import { compileSetHelpers } from "./compileSetHelpers";
import { compileZsetHelpers } from "./compileZsetHelpers";
import { compileJsonStringHelpers } from "./compileJsonStringHelpers";
import { compileInvalidationHelpers } from "./compileInvalidationHelpers";
import { compileCustomOperationHelpers } from "./compileCustomOperationHelpers";
import { compileReusableFunctionRegistry } from "./compileReusableFunctionRegistry";

export * from "./types";
export * from "./compileHashHelpers";
export * from "./compileListHelpers";
export * from "./compileSetHelpers";
export * from "./compileZsetHelpers";
export * from "./compileJsonStringHelpers";
export * from "./compileInvalidationHelpers";
export * from "./compileCustomOperationHelpers";
export * from "./compileReusableFunctionRegistry";

/**
 * Generates all typed helper files, barrels, and reusable function metadata
 * for a Redis schema attached to a Redis instance package.
 */
export function generateHelperFilesForSchema(
  schema: GeneratedSchemaResult,
  schemaNode: BackendNode,
  allNodes: BackendNode[],
  packageName: string,
): HelperFilesResult {
  const ctx: HelperContext = {
    schema,
    schemaNode,
    allNodes,
    packageName,
  };

  const { varName, typeName, dataStructure } = schema;
  const files: CompiledFile[] = [];
  const cacheHelperBarrelExports: string[] = [];

  // 1. Structure-specific helpers
  let structureResult;
  if (dataStructure === "hash") {
    structureResult = compileHashHelpers(ctx);
  } else if (dataStructure === "list") {
    structureResult = compileListHelpers(ctx);
  } else if (dataStructure === "set") {
    structureResult = compileSetHelpers(ctx);
  } else if (dataStructure === "zset" || dataStructure === "sorted_set") {
    structureResult = compileZsetHelpers(ctx);
  } else {
    // String, JSON object, or JSON array
    structureResult = compileJsonStringHelpers(ctx);
  }

  files.push(...structureResult.files);
  cacheHelperBarrelExports.push(...structureResult.barrelExports);

  // 2. Universal invalidation helpers (by key, delete alias, pattern scan stream)
  const invalidationResult = compileInvalidationHelpers(ctx);
  files.push(...invalidationResult.files);
  cacheHelperBarrelExports.push(...invalidationResult.barrelExports);

  // 3. Custom operations defined on entity nodes
  const customOpsResult = compileCustomOperationHelpers(ctx);
  files.push(...customOpsResult.files);
  cacheHelperBarrelExports.push(...customOpsResult.barrelExports);

  // 4. Barrel for this specific cache helper folder: src/helpers/<varName>/index.ts
  const cacheBarrelContent = `/**
 * Helper Functions for ${typeName}
 */
${cacheHelperBarrelExports.join("\n")}
`;
  files.push({
    filename: `src/helpers/${varName}/index.ts`,
    language: "typescript",
    content: cacheBarrelContent,
  });

  // 5. Canvas reusable functions metadata
  const reusableFunctions = compileReusableFunctionRegistry(ctx);

  return {
    files,
    reusableFunctions,
    helperBarrelExport: `export * from "./${varName}";`,
  };
}

/**
 * Generates the top-level helpers barrel file (`src/helpers/index.ts`) for a Redis package.
 */
export function generateHelpersIndex(
  helperBarrelExports: string[],
  instLabel: string,
): CompiledFile {
  const helpersIndexContent = `/**
 * Generated Typed Redis Helper Functions for ${instLabel}
 */
${helperBarrelExports.join("\n")}
`;

  return {
    filename: "src/helpers/index.ts",
    language: "typescript",
    content: helpersIndexContent,
  };
}
