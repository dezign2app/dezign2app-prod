import { BackendNode } from "@/types/canvas";
import { jsonToTypeScriptInterfaces, mapColumnTypeToTs } from "../../utils";
import { parseRawJsonSafe } from "@/lib/utils/nestedJsonSchema";

export interface CompiledJsonSchemaResult {
  interfacesBlock: string;
  isJsonArray: boolean;
  itemTypeName?: string;
  exportedSymbols: string[];
}

export function compileRedis74JsonSchema(
  typeName: string,
  schemaNode: BackendNode,
): CompiledJsonSchemaResult {
  let interfacesBlock = "";
  let isJsonArray = false;
  let itemTypeName: string | undefined = undefined;
  const exportedSymbols: string[] = [typeName];

  if (
    schemaNode.data?.isNestedJsonSchema &&
    schemaNode.data?.rawJsonSchema
  ) {
    const { parsed, error } = parseRawJsonSafe(schemaNode.data.rawJsonSchema);
    if (!error && parsed !== null && typeof parsed === "object") {
      const typeInfo = jsonToTypeScriptInterfaces(typeName, parsed);
      interfacesBlock = typeInfo.interfacesCode;
      isJsonArray = typeInfo.isArray;
      itemTypeName = typeInfo.itemTypeName;
      if (itemTypeName) {
        exportedSymbols.push(itemTypeName);
      }
    }
  }

  if (!interfacesBlock) {
    const columns = schemaNode.data?.columns || [];
    const hashFields = schemaNode.data?.hashConfig?.fields;
    const fields =
      columns.length > 0
        ? columns.map((c) => ({
            name: c.name,
            type: mapColumnTypeToTs(c.type),
            required: Boolean(c.isPrimaryKey || c.isNotNull),
          }))
        : hashFields && hashFields.length > 0
          ? hashFields.map((f) => ({
              name: f.name,
              type:
                f.type === "number"
                  ? "number"
                  : f.type === "boolean"
                    ? "boolean"
                    : f.type === "json"
                      ? "Record<string, string | number | boolean | null>"
                      : "string",
              required: Boolean(f.required),
            }))
          : [];

    const interfaceFields =
      fields.length > 0
        ? fields
            .map(
              (f) =>
                `  ${f.name}${f.required ? "" : "?"}: ${f.type || "string"};`,
            )
            .join("\n") + "\n  [key: string]: string | number | boolean | null | undefined;"
        : "  id: string;\n  [key: string]: string | number | boolean | null | undefined;";

    if (schemaNode.data?.jsonRootType === "array") {
      isJsonArray = true;
      itemTypeName = `${typeName}Item`;
      exportedSymbols.push(itemTypeName);
      interfacesBlock = `export interface ${itemTypeName} {\n${interfaceFields}\n}\n\nexport type ${typeName} = ${itemTypeName}[];`;
    } else {
      interfacesBlock = `export interface ${typeName} {\n${interfaceFields}\n}`;
    }
  }

  // --- Per-Operation Schema Types (Option B: Named Interfaces) ---
  const operationTypes: string[] = [];
  if (isJsonArray && itemTypeName) {
    const opPrefixes = [
      { name: `GetRecent${typeName}Items`, dataType: `${itemTypeName}[]` },
      { name: `Append${typeName}Item`, dataType: "number" },
      { name: `Pop${typeName}Item`, dataType: `${itemTypeName} | null` },
      { name: `Get${typeName}Length`, dataType: "number" },
      { name: `Get${typeName}`, dataType: `${typeName} | null` },
      { name: `Set${typeName}`, dataType: "void" },
    ];
    opPrefixes.forEach(({ name, dataType }) => {
      exportedSymbols.push(`${name}Success`, `${name}Failure`, `${name}Result`);
      operationTypes.push(
        `export interface ${name}Success {\n  success: true;\n  data: ${dataType};\n}\n\n` +
          `export interface ${name}Failure {\n  success: false;\n  error: {\n    message: string;\n    code?: string;\n    details?: string;\n  };\n}\n\n` +
          `export type ${name}Result =\n  | ${name}Success\n  | ${name}Failure;`,
      );
    });
  } else {
    const opPrefixes = [
      { name: `Get${typeName}`, dataType: `${typeName} | null` },
      { name: `Set${typeName}`, dataType: "void" },
    ];
    opPrefixes.forEach(({ name, dataType }) => {
      exportedSymbols.push(`${name}Success`, `${name}Failure`, `${name}Result`);
      operationTypes.push(
        `export interface ${name}Success {\n  success: true;\n  data: ${dataType};\n}\n\n` +
          `export interface ${name}Failure {\n  success: false;\n  error: {\n    message: string;\n    code?: string;\n    details?: string;\n  };\n}\n\n` +
          `export type ${name}Result =\n  | ${name}Success\n  | ${name}Failure;`,
      );
    });
  }

  if (operationTypes.length > 0) {
    interfacesBlock +=
      `\n\n// ─── Per-Operation Result Schemas (Success | Failure) ─────────\n` +
      operationTypes.join("\n\n");
  }

  return {
    interfacesBlock,
    isJsonArray,
    itemTypeName,
    exportedSymbols,
  };
}
