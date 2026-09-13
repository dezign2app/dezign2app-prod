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

    if (schemaNode.data?.jsonRootType === "array") {
      isJsonArray = true;
      itemTypeName = `${typeName}Item`;
      exportedSymbols.push(itemTypeName);
      interfacesBlock = `export interface ${itemTypeName} {\n${interfaceFields}\n}\n\nexport type ${typeName} = ${itemTypeName}[];`;
    } else {
      interfacesBlock = `export interface ${typeName} {\n${interfaceFields}\n}`;
    }
  }

  return {
    interfacesBlock,
    isJsonArray,
    itemTypeName,
    exportedSymbols,
  };
}
