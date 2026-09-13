import { CompiledFile } from "@workspace/canvas/types";
import { BackendNode } from "@/types/canvas";
import { toVarName, toPascalCase } from "../../../utils";
import { extractTemplateParams, mapColumnTypeToTs } from "../../utils";
import { CompiledSchemaResult } from "../../types";

export function compileRedis7SchemaModule(
  schemaNode: BackendNode,
): CompiledSchemaResult {
  const rawSchemaLabel = schemaNode.data?.label || schemaNode.id || "Cache";
  const varName = toVarName(rawSchemaLabel) || "cache";
  const typeName = toPascalCase(rawSchemaLabel) || "Cache";

  const dataStructure = (
    schemaNode.data?.redisDataStructure || "hash"
  ).toLowerCase();
  const keyTemplate =
    schemaNode.data?.keyTemplate || `${varName.toLowerCase()}:{id}`;
  const pattern = keyTemplate.replace(/\{[a-zA-Z0-9_]+\}/g, "*");
  const templateParams = extractTemplateParams(keyTemplate);
  const keyArgsSig =
    templateParams.length > 0
      ? templateParams.map((p) => `${p}: string | number`).join(", ")
      : "id: string | number";

  let keyTemplateLiteral = keyTemplate;
  if (templateParams.length > 0) {
    templateParams.forEach((p) => {
      keyTemplateLiteral = keyTemplateLiteral.replace(`{${p}}`, `\${${p}}`);
    });
  } else {
    keyTemplateLiteral = `${keyTemplate}:\${id}`;
  }

  const ttlSeconds =
    typeof schemaNode.data?.ttl === "object"
      ? schemaNode.data?.ttl?.value || 3600
      : 3600;

  const columns = schemaNode.data?.columns || [];
  const fields = columns.map((c) => ({
    name: c.name,
    type: mapColumnTypeToTs(c.type),
    required: Boolean(c.isPrimaryKey || c.isNotNull),
  }));

  const interfaceFields =
    fields.length > 0
      ? fields
          .map(
            (f) =>
              `  ${f.name}${f.required ? "" : "?"}: ${f.type || "string"};`,
          )
          .join("\n")
      : "  id: string;\n  [key: string]: string | number | boolean | null | undefined;";

  const interfacesBlock = `export interface ${typeName} {\n${interfaceFields}\n}`;

  const keyPatternSymbol = `${typeName.toUpperCase()}_KEY_PATTERN`;
  const ttlSecondsSymbol = `${typeName.toUpperCase()}_TTL_SECONDS`;
  const getKeyFnSymbol = `get${typeName}Key`;

  const schemaModuleContent = `/**
 * Redis 7.0 / 6.x Data Schema & Key Pattern Definitions for ${typeName}
 */
${interfacesBlock}

/**
 * Canonical Key Pattern and Default TTL for ${typeName}
 */
export const ${keyPatternSymbol} = "${pattern}";
export const ${ttlSecondsSymbol} = ${ttlSeconds};

/**
 * Generate Redis Key for ${typeName}
 */
export function ${getKeyFnSymbol}(${keyArgsSig}): string {
  return \`${keyTemplateLiteral}\`;
}
`;

  return {
    file: {
      filename: `src/schemas/${varName}.ts`,
      language: "typescript",
      content: schemaModuleContent,
    },
    varName,
    typeName,
    technology: "redis",
    version: "7.0",
    dataStructure,
    keyTemplate,
    templateParams,
    keyArgsSig,
    ttlSeconds,
    exportedSymbols: [typeName, keyPatternSymbol, ttlSecondsSymbol, getKeyFnSymbol],
  };
}

export function generateRedis7SchemasIndex(
  schemaBarrelExports: string[],
  instLabel: string,
): CompiledFile {
  const schemasIndexContent = `/**
 * Generated Typed Redis 7.0 Schemas for ${instLabel}
 */
${schemaBarrelExports.join("\n")}
`;

  return {
    filename: "src/schemas/index.ts",
    language: "typescript",
    content: schemasIndexContent,
  };
}
