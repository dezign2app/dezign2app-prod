import { BackendNode, BackendEdge } from "@/types/canvas";
import { TransformerHelperNodeData, CompiledFile, ReusableFunction } from "@workspace/canvas/types";
import { toPascalCase, toVarName } from "./utils";
import { inferReturnSchemaFromCode } from "@/lib/utils/inferReturnSchema";

export interface CompiledTransformerResult {
  /** Files to write into packages/transformers/ (global) or service src/transformers/ (local) */
  files: CompiledFile[];
  /** ReusableFunction metadata for each compiled helper — used by route generators for imports */
  reusableFunctions: ReusableFunction[];
  /** The global package name if any global helpers were compiled, e.g. "@workspace/transformers" */
  globalPackageName?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function mapTypeToTs(type: string): string {
  const t = (type || "string").toLowerCase();
  if (["number", "int", "integer", "float", "double"].includes(t)) return "number";
  if (["boolean", "bool"].includes(t)) return "boolean";
  if (["string[]", "array"].includes(t)) return "string[]";
  if (["object", "record"].includes(t)) return "Record<string, unknown>";
  if (["any"].includes(t)) return "unknown";
  return "string";
}

interface SchemaFieldLike {
  name: string;
  type: string;
  isArray?: boolean;
  required?: boolean;
  description?: string;
  nestedFields?: SchemaFieldLike[];
}

function renderFieldType(f: { name?: string; type?: string; isArray?: boolean; required?: boolean; nestedFields?: any[] }): string {
  if (f.nestedFields && f.nestedFields.length > 0) {
    const innerProps = f.nestedFields
      .filter((nf) => nf && nf.name)
      .map((nf) => `${nf.name}${nf.required === false ? "?" : ""}: ${renderFieldType(nf)}`)
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

export function reconcileReturnSchema(
  existingSchema: Array<{ name: string; type?: string; isArray?: boolean; required?: boolean; description?: string; nestedFields?: any[] }> = [],
  code?: string,
  inputSchema?: any[],
): SchemaFieldLike[] {
  const normalizedExisting: SchemaFieldLike[] = existingSchema.map((f) => ({
    name: f.name,
    type: f.type || "string",
    isArray: f.isArray,
    required: f.required,
    description: f.description,
    nestedFields: f.nestedFields,
  }));

  if (!code || !code.trim()) {
    return normalizedExisting;
  }

  const isDefaultDummy =
    normalizedExisting.length === 1 && normalizedExisting[0]?.name === "result";

  const inferred = inferReturnSchemaFromCode(code, inputSchema);
  if (!inferred || inferred.length === 0) {
    return normalizedExisting;
  }

  if (normalizedExisting.length === 0 || isDefaultDummy) {
    return inferred.map((inf) => ({
      name: inf.name,
      type: inf.type || "string",
      isArray: inf.isArray,
      required: inf.required,
      nestedFields: inf.nestedFields as SchemaFieldLike[] | undefined,
    }));
  }

  const inferredMap = new Map(inferred.map((inf) => [inf.name, inf]));
  const reconciled: SchemaFieldLike[] = normalizedExisting.map((field) => {
    const inf = inferredMap.get(field.name);
    if (!inf) return field;

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
      type: (hasRicherNested || hadDefaultStringType) ? (inf.type || "string") : (field.type || inf.type || "string"),
      nestedFields: (inf.nestedFields && inf.nestedFields.length > 0)
        ? (inf.nestedFields as SchemaFieldLike[])
        : field.nestedFields,
      isArray: field.isArray ?? inf.isArray,
      required: field.required ?? inf.required,
    };
  });

  for (const inf of inferred) {
    if (!reconciled.some((f) => f.name === inf.name)) {
      reconciled.push({
        name: inf.name,
        type: inf.type || "string",
        isArray: inf.isArray,
        required: inf.required,
        nestedFields: inf.nestedFields as SchemaFieldLike[] | undefined,
      });
    }
  }

  return reconciled;
}

/**
 * Generates a single transformer helper TypeScript file from a definition.
 *
 * Generated signature:
 *   export function slugifyProductInput(input: SlugifyProductInputInput): SlugifyProductInputOutput { ... }
 *   OR
 *   export async function ... : Promise<SlugifyProductInputOutput> { ... }
 */
function generateTransformerFile(
  helper: TransformerHelperNodeData,
  importPath: string,
): CompiledFile {
  const fnName = toVarName(helper.name || "transform");
  const Pascal = toPascalCase(fnName);

  const inputTypeName = `${Pascal}Input`;
  const outputTypeName = `${Pascal}Output`;

  // Build input interface
  const inputFields =
    helper.inputSchema && helper.inputSchema.length > 0
      ? helper.inputSchema
          .map(
            (f) =>
              `  ${f.name}${f.required === false ? "?" : ""}: ${renderFieldType(f)};`,
          )
          .join("\n")
      : "  [key: string]: unknown;";

  // Build output interface
  const returnSchema = reconcileReturnSchema(
    (helper.returnSchema || []) as SchemaFieldLike[],
    helper.code,
    helper.inputSchema,
  );

  const outputFields =
    returnSchema.length > 0
      ? returnSchema
          .map(
            (f) =>
              `  ${f.name}${f.required === false ? "?" : ""}: ${renderFieldType(f)};`,
          )
          .join("\n")
      : "  [key: string]: unknown;";

  const rawCode = (helper.code || "").trim();
  const hasFunctionDecl = /^(export\s+)?(async\s+)?function\s+/m.test(rawCode);

  let processedCode = rawCode;
  if (hasFunctionDecl) {
    // Ensure function identifier in rawCode is a valid JavaScript identifier matching fnName
    processedCode = rawCode.replace(
      /^(export\s+)?(async\s+)?function\s+([a-zA-Z0-9_\s]+?)\s*\(/m,
      (_, exp = "", asy = "", oldName) => {
        return `${exp}${asy}function ${toVarName(oldName)}(`;
      },
    );
  }

  // Function body — prefer explicit code, fall back to a TODO placeholder
  let body: string;
  if (rawCode) {
    // The user provides just the body (return statement or statements)
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

  const inputParamNames = (helper.inputSchema || [])
    .map((f) => f.name?.trim())
    .filter(Boolean);
  const paramSignature =
    inputParamNames.length > 0
      ? `{ ${inputParamNames.join(", ")} }: ${inputTypeName}`
      : `input: ${inputTypeName}`;

  const content = hasFunctionDecl
    ? `${fnDescription}export interface ${inputTypeName} {\n${inputFields}\n}\n\nexport interface ${outputTypeName} {\n${outputFields}\n}\n\n${processedCode}\n`
    : `${fnDescription}export interface ${inputTypeName} {\n${inputFields}\n}\n\nexport interface ${outputTypeName} {\n${outputFields}\n}\n\nexport ${asyncKw}function ${fnName}(${paramSignature}): ${returnTypeAnnotation} {\n${body}\n}\n`;

  const filename = `src/${fnName}.ts`;

  return {
    filename,
    language: "typescript",
    content,
  };
}

// ---------------------------------------------------------------------------
// Main compilation entry
// ---------------------------------------------------------------------------

/**
 * Compiles transformer definitions from all service nodes and transformer canvas nodes.
 *
 * - Global transformers (scope = "global") → packages/transformers/
 * - Local transformers  (scope = "local")  → apps/<service>/src/transformers/
 *
 * Returns:
 *   - files: all compiled TypeScript files
 *   - reusableFunctions: metadata for the route generator to import/use
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

  // Collect all helpers from all service nodes
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

  // Collect standalone transformer nodes placed on the canvas
  const transformerNodes = allNodes.filter((n) => n.type === "transformer");
  transformerNodes.forEach((tNode) => {
    const d = tNode.data;
    const fnName = toVarName(d.functionName || d.label || "transformData");
    const scope = d.scope || "global";

    // Find connected service if scope is local
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
      returnSchema,
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

  // ------------------------------------------------------------------
  // Compile global helpers → packages/transformers/
  // ------------------------------------------------------------------
  const GLOBAL_PKG = "@workspace/transformers";

  if (globalHelpers.length > 0) {
    const globalBarrelExports: string[] = [];

    globalHelpers.forEach((helper) => {
      const cleanName = toVarName(helper.name || "transform");
      const file = generateTransformerFile(helper, GLOBAL_PKG);

      // Prefix the file path so it lives inside packages/transformers/
      allFiles.push({
        filename: `packages/transformers/${file.filename}`,
        language: file.language,
        content: file.content,
      });

      globalBarrelExports.push(`export * from "./${cleanName}";`);

      // Register as a reusable function
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

    // Barrel index.ts for the global package
    allFiles.push({
      filename: "packages/transformers/src/index.ts",
      language: "typescript",
      content: `/**\n * Global Data Transformation Functions\n * Auto-generated — edit transformer definitions to regenerate.\n */\n${globalBarrelExports.join("\n")}\n`,
    });

    // package.json for packages/transformers
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

    // tsconfig.json for packages/transformers
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

  // ------------------------------------------------------------------
  // Compile local transformers → inside the service package src/transformers/
  // (the route generator will embed these inline when building the service)
  // ------------------------------------------------------------------
  localHelpersByService.forEach((helpers, serviceNodeId) => {
    const svcNode = serviceNodes.find((n) => n.id === serviceNodeId);
    if (!svcNode) return;

    const svcLabel = (svcNode.data?.label || serviceNodeId)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");

    const localBarrelExports: string[] = [];

    helpers.forEach((helper) => {
      const cleanName = toVarName(helper.name || "transform");
      // Local import path — resolved at service compile time as a relative import
      const localImportPath = `./transformers/${cleanName}`;

      const file = generateTransformerFile(helper, localImportPath);

      // File path: inside the service package (apps/<service>/src/transformers/<name>.ts)
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

    // Local barrel
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
