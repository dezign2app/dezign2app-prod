// ═══════════════════════════════════════════════════════════════════════════
// MODULE:  compileTransformerHelpers  (thin orchestrator)
// LAYER:   compilers
// PURPOSE: Compiles transformer definitions from all service nodes and
//          standalone transformer canvas nodes.
//
// DELEGATES TO:
//   transformers/typeMapper.ts       — type utilities
//   transformers/schemaReconciler.ts — return-schema merging
//   transformers/transformerEmitter.ts — per-transformer file generation
//
// EMITS:
//   packages/transformers/src/<name>.ts   (global scope helpers)
//   packages/transformers/src/index.ts    (barrel)
//   packages/transformers/package.json
//   packages/transformers/tsconfig.json
//   apps/<service>/src/transformers/<name>.ts  (local scope helpers)
//   apps/<service>/src/transformers/index.ts
// ═══════════════════════════════════════════════════════════════════════════

import { BackendNode, BackendEdge } from "@/types/canvas";
import { TransformerHelperNodeData, CompiledFile, ReusableFunction } from "@workspace/canvas/types";
import { toPascalCase, toVarName } from "./utils";
import { SchemaFieldLike, renderFieldType } from "./transformers/typeMapper";
import { reconcileReturnSchema } from "./transformers/schemaReconciler";
import { generateTransformerFile } from "./transformers/transformerEmitter";

export interface CompiledTransformerResult {
  /** Files to write into packages/transformers/ (global) or service src/transformers/ (local) */
  files: CompiledFile[];
  /** ReusableFunction metadata for each compiled helper — used by route generators for imports */
  reusableFunctions: ReusableFunction[];
  /** The global package name if any global helpers were compiled, e.g. "@workspace/transformers" */
  globalPackageName?: string;
}

// Re-export sub-module utilities so existing imports from this file continue to work
export { reconcileReturnSchema } from "./transformers/schemaReconciler";
export { renderFieldType } from "./transformers/typeMapper";
export type { SchemaFieldLike } from "./transformers/typeMapper";

/** Global transformer package name */
const GLOBAL_PKG = "@workspace/transformers";

/**
 * Compiles transformer definitions from all service nodes and transformer canvas nodes.
 *
 * - Global transformers (scope = "global") → packages/transformers/
 * - Local transformers  (scope = "local")  → apps/<service>/src/transformers/
 *
 * Returns:
 *   - files: all compiled TypeScript files
 *   - reusableFunctions: metadata for the route generator to import/use
 *
 * @debugTag compile-transformers
 */
export function compileTransformerHelpers(
  allNodes: BackendNode[],
  allEdges: BackendEdge[] = [],
): CompiledTransformerResult {
  const serviceNodes = allNodes.filter((n) => n.type === "service");

  const allFiles: CompiledFile[] = [];
  const allReusable: ReusableFunction[] = [];

  const globalHelpers: TransformerHelperNodeData[] = [];
  const localHelpersByService = new Map<string, TransformerHelperNodeData[]>();

  // ── Collect helpers from service nodes ───────────────────────────────────
  serviceNodes.forEach((svc) => {
    const helpers = svc.data?.transformerHelpers;
    if (!helpers || helpers.length === 0) return;

    helpers.forEach((h) => {
      if (h.scope === "global") {
        globalHelpers.push(h);
      } else {
        const bucket = localHelpersByService.get(svc.id) ?? [];
        bucket.push(h);
        localHelpersByService.set(svc.id, bucket);
      }
    });
  });

  // ── Collect standalone transformer nodes from the canvas ─────────────────
  const transformerNodes = allNodes.filter((n) => n.type === "transformer");
  transformerNodes.forEach((tNode) => {
    const d = tNode.data;
    const fnName = toVarName(d.functionName || d.label || "transformData");
    const scope = d.scope || "global";

    // Find connected service for local-scope transformers
    let targetServiceId = d.targetServiceId;
    if (!targetServiceId) {
      const edge = allEdges.find((e) => e.source === tNode.id || e.target === tNode.id);
      if (edge) {
        const otherId = edge.source === tNode.id ? edge.target : edge.source;
        const other = allNodes.find((n) => n.id === otherId && n.type === "service");
        if (other) targetServiceId = other.id;
      }
    }

    const returnSchema = reconcileReturnSchema(
      (d.returnSchema || []) as SchemaFieldLike[],
      d.code,
      d.inputSchema,
    );

    const helperData: TransformerHelperNodeData = {
      id: tNode.id,
      name: fnName,
      description: d.description,
      scope: scope === "local" && targetServiceId ? "local" : "global",
      targetServiceId,
      inputSchema: d.inputSchema || [],
      logicMode: d.logicMode || "code",
      prompt: d.prompt,
      code: d.code,
      // Normalize: TransformerHelperNodeData.returnSchema requires type: string (not optional),
      // but SchemaFieldLike.type is optional during inference. Guarantee the field here.
      returnSchema: returnSchema.map((f) => ({
        name: f.name,
        type: f.type ?? "string",
        required: f.required,
        description: f.description,
      })),
      isAsync: d.isAsync,
    };

    if (helperData.scope === "global") {
      globalHelpers.push(helperData);
    } else if (targetServiceId) {
      const bucket = localHelpersByService.get(targetServiceId) ?? [];
      bucket.push(helperData);
      localHelpersByService.set(targetServiceId, bucket);
    } else {
      globalHelpers.push(helperData);
    }
  });

  // ── Compile global helpers → packages/transformers/ ──────────────────────
  if (globalHelpers.length > 0) {
    const globalBarrelExports: string[] = [];

    globalHelpers.forEach((helper) => {
      const cleanName = toVarName(helper.name || "transform");
      const file = generateTransformerFile(helper, GLOBAL_PKG);

      // ✦ emits: packages/transformers/src/<name>.ts
      allFiles.push({
        filename: `packages/transformers/${file.filename}`,
        language: file.language,
        content: file.content,
      });

      globalBarrelExports.push(`export * from "./${cleanName}";`);

      // Register as reusable function for route generators
      const inputTypeName = `${toPascalCase(cleanName)}Input`;
      const outputTypeName = `${toPascalCase(cleanName)}Output`;
      const inputParamNames = (helper.inputSchema || [])
        .map((f) => f.name?.trim())
        .filter(Boolean);
      const paramSignature =
        inputParamNames.length > 0
          ? `{ ${inputParamNames.join(", ")} }: ${inputTypeName}`
          : `input: ${inputTypeName}`;

      allReusable.push({
        name: cleanName,
        importPath: GLOBAL_PKG,
        signature: `${cleanName}(${paramSignature}): ${outputTypeName}`,
        targetName: cleanName,
        kind: "custom",
      });
    });

    // ✦ emits: packages/transformers/src/index.ts
    allFiles.push({
      filename: "packages/transformers/src/index.ts",
      language: "typescript",
      content: `/**\n * Global Data Transformation Functions\n * Auto-generated — edit transformer definitions to regenerate.\n */\n${globalBarrelExports.join("\n")}\n`,
    });

    // ✦ emits: packages/transformers/package.json
    allFiles.push({
      filename: "packages/transformers/package.json",
      language: "json",
      content: JSON.stringify(
        {
          name: GLOBAL_PKG,
          version: "0.0.0",
          private: true,
          description: "Shared pure data-transformation functions",
          main: "src/index.ts",
          types: "src/index.ts",
          exports: {
            ".": "./src/index.ts",
            "./*": "./src/*.ts",
          },
          scripts: { build: "tsc", "check-types": "tsc --noEmit" },
          devDependencies: {
            "@workspace/typescript-config": "workspace:*",
            typescript: "^5.3.3",
          },
        },
        null,
        2,
      ),
    });

    // ✦ emits: packages/transformers/tsconfig.json
    allFiles.push({
      filename: "packages/transformers/tsconfig.json",
      language: "json",
      content: JSON.stringify(
        {
          extends: "@workspace/typescript-config/base.json",
          compilerOptions: { outDir: "./dist", rootDir: "./src" },
          include: ["src/**/*"],
        },
        null,
        2,
      ),
    });
  }

  // ── Compile local transformers → apps/<service>/src/transformers/ ─────────
  localHelpersByService.forEach((helpers, serviceNodeId) => {
    const svcNode = serviceNodes.find((n) => n.id === serviceNodeId);
    if (!svcNode) return;

    const svcLabel = (svcNode.data?.label || serviceNodeId)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");

    const localBarrelExports: string[] = [];

    helpers.forEach((helper) => {
      const cleanName = toVarName(helper.name || "transform");
      const localImportPath = `./transformers/${cleanName}`;

      const file = generateTransformerFile(helper, localImportPath);

      // ✦ emits: apps/<service>/src/transformers/<name>.ts
      allFiles.push({
        filename: `apps/${svcLabel}/src/transformers/${cleanName}.ts`,
        language: file.language,
        content: file.content,
      });

      localBarrelExports.push(`export * from "./${cleanName}";`);

      const inputTypeName = `${toPascalCase(cleanName)}Input`;
      const outputTypeName = `${toPascalCase(cleanName)}Output`;
      const inputParamNames = (helper.inputSchema || [])
        .map((f) => f.name?.trim())
        .filter(Boolean);
      const paramSignature =
        inputParamNames.length > 0
          ? `{ ${inputParamNames.join(", ")} }: ${inputTypeName}`
          : `input: ${inputTypeName}`;

      allReusable.push({
        name: cleanName,
        importPath: localImportPath,
        signature: `${cleanName}(${paramSignature}): ${outputTypeName}`,
        targetName: cleanName,
        kind: "custom",
      });
    });

    // ✦ emits: apps/<service>/src/transformers/index.ts
    allFiles.push({
      filename: `apps/${svcLabel}/src/transformers/index.ts`,
      language: "typescript",
      content: `/**\n * Local Transformation Functions for ${svcLabel}\n */\n${localBarrelExports.join("\n")}\n`,
    });
  });

  return {
    files: allFiles,
    reusableFunctions: allReusable,
    globalPackageName: globalHelpers.length > 0 ? GLOBAL_PKG : undefined,
  };
}
