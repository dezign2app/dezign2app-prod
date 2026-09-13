import { CompiledFile } from "@workspace/canvas/types";
import { BackendNode } from "@/types/canvas";
import { toVarName, toPascalCase } from "../../../utils";
import { extractTemplateParams } from "../../utils";
import { CompiledSchemaResult } from "../../types";
import { compileRedis74HashSchema } from "./hashSchema";
import { compileRedis74JsonSchema } from "./jsonSchema";
import { compileRedis74StreamSchema } from "./streamSchema";

export * from "./hashSchema";
export * from "./jsonSchema";
export * from "./streamSchema";

export function compileRedis74SchemaModule(
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

  let interfacesBlock = "";
  let isJsonArray = false;
  let itemTypeName: string | undefined = undefined;
  let extraDeclarations = "";
  const exportedSymbols: string[] = [];

  if (dataStructure === "json") {
    const jsonRes = compileRedis74JsonSchema(typeName, schemaNode);
    interfacesBlock = jsonRes.interfacesBlock;
    isJsonArray = jsonRes.isJsonArray;
    itemTypeName = jsonRes.itemTypeName;
    exportedSymbols.push(...jsonRes.exportedSymbols);
  } else if (dataStructure === "stream") {
    const streamRes = compileRedis74StreamSchema(typeName, schemaNode);
    interfacesBlock = streamRes.interfacesBlock;
    extraDeclarations = streamRes.streamMetadataBlock;
    exportedSymbols.push(...streamRes.exportedSymbols);
  } else if (dataStructure === "set" || dataStructure === "list") {
    const elementType =
      dataStructure === "list"
        ? schemaNode.data?.listConfig?.elementType || "string"
        : schemaNode.data?.setConfig?.memberType || "string";
    interfacesBlock = `export type ${typeName} = ${elementType}[];`;
    exportedSymbols.push(typeName);
  } else if (dataStructure === "zset") {
    interfacesBlock = `export interface ${typeName}Member {\n  member: string;\n  score: number;\n}\n\nexport type ${typeName} = ${typeName}Member[];`;
    exportedSymbols.push(`${typeName}Member`, typeName);
  } else if (dataStructure === "geo") {
    interfacesBlock = `export interface ${typeName}Location {\n  member: string;\n  longitude: number;\n  latitude: number;\n}\n\nexport type ${typeName} = ${typeName}Location[];`;
    exportedSymbols.push(`${typeName}Location`, typeName);
  } else {
    // Default Hash / String
    const hashRes = compileRedis74HashSchema(typeName, schemaNode);
    interfacesBlock = hashRes.interfacesBlock;
    extraDeclarations = hashRes.fieldTtlDeclarations;
    exportedSymbols.push(...hashRes.exportedSymbols);
  }

  const keyPatternSymbol = `${typeName.toUpperCase()}_KEY_PATTERN`;
  const ttlSecondsSymbol = `${typeName.toUpperCase()}_TTL_SECONDS`;
  const getKeyFnSymbol = `get${typeName}Key`;

  exportedSymbols.push(keyPatternSymbol, ttlSecondsSymbol, getKeyFnSymbol);

  const schemaModuleContent = `/**
 * Redis 7.4+ Data Schema & Key Pattern Definitions for ${typeName}
 */
${interfacesBlock}${extraDeclarations}

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
    itemTypeName,
    isJsonArray,
    technology: "redis",
    version: "7.4",
    dataStructure,
    keyTemplate,
    templateParams,
    keyArgsSig,
    ttlSeconds,
    exportedSymbols,
  };
}

export function generateRedis74SchemasIndex(
  schemaBarrelExports: string[],
  instLabel: string,
): CompiledFile {
  const schemasIndexContent = `/**
 * Generated Typed Redis 7.4 Schemas for ${instLabel}
 */
${schemaBarrelExports.join("\n")}
`;

  return {
    filename: "src/schemas/index.ts",
    language: "typescript",
    content: schemasIndexContent,
  };
}
