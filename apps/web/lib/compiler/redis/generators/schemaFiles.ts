import { CompiledFile } from "@workspace/canvas/types";
import { BackendNode } from "@/types/canvas";
import { toVarName, toPascalCase } from "../../utils";
import { extractTemplateParams, mapColumnTypeToTs } from "../utils";

export interface GeneratedSchemaResult {
  file: CompiledFile;
  varName: string;
  typeName: string;
  dataStructure: string;
  keyTemplate: string;
  templateParams: string[];
  keyArgsSig: string;
  ttlSeconds: number;
}

export function generateSchemaModule(
  schemaNode: BackendNode,
): GeneratedSchemaResult {
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

  // Build TypeScript Interface
  const columns = schemaNode.data?.columns || [];
  const fields =
    schemaNode.data?.hashConfig?.fields ||
    columns.map((c) => ({
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

  const schemaModuleContent = `/**
 * TypeScript Data Structure Interface & Key Patterns for ${typeName}
 */
export interface ${typeName} {
${interfaceFields}
}

/**
 * Canonical Key Pattern and TTL for ${typeName}
 */
export const ${typeName.toUpperCase()}_KEY_PATTERN = "${pattern}";
export const ${typeName.toUpperCase()}_TTL_SECONDS = ${ttlSeconds};

/**
 * Generate Redis Key for ${typeName}
 */
export function get${typeName}Key(${keyArgsSig}): string {
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
    dataStructure,
    keyTemplate,
    templateParams,
    keyArgsSig,
    ttlSeconds,
  };
}

export function generateSchemasIndex(
  schemaBarrelExports: string[],
  instLabel: string,
): CompiledFile {
  const schemasIndexContent = `/**
 * Generated Typed Redis Schemas for ${instLabel}
 */
${schemaBarrelExports.join("\n")}
`;

  return {
    filename: "src/schemas/index.ts",
    language: "typescript",
    content: schemasIndexContent,
  };
}
