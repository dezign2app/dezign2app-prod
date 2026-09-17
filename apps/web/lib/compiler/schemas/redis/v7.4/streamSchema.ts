import { BackendNode } from "@/types/canvas";
import { mapColumnTypeToTs } from "../../utils";

export interface CompiledStreamSchemaResult {
  interfacesBlock: string;
  streamMetadataBlock: string;
  exportedSymbols: string[];
}

export function compileRedis74StreamSchema(
  typeName: string,
  schemaNode: BackendNode,
): CompiledStreamSchemaResult {
  const streamConfig = schemaNode.data?.streamConfig;
  const columns = schemaNode.data?.columns || [];
  const exportedSymbols: string[] = [typeName];

  const fields =
    streamConfig?.fields ||
    columns.map((c) => ({
      name: c.name,
      type: mapColumnTypeToTs(c.type),
    }));

  const interfaceFields =
    fields.length > 0
      ? fields.map((f) => `  ${f.name}: ${f.type || "string"};`).join("\n")
      : "  payload: string;\n  [key: string]: string;";

  const interfacesBlock = `export interface ${typeName} {\n  id?: string;\n${interfaceFields}\n}`;

  const metaLines: string[] = [];
  if (streamConfig?.maxLen) {
    const maxLenConst = `${typeName.toUpperCase()}_STREAM_MAX_LEN`;
    metaLines.push(`export const ${maxLenConst} = ${streamConfig.maxLen};`);
    exportedSymbols.push(maxLenConst);
  }

  if (streamConfig?.consumerGroups && streamConfig.consumerGroups.length > 0) {
    const groupsConst = `${typeName.toUpperCase()}_CONSUMER_GROUPS`;
    metaLines.push(
      `export const ${groupsConst}: readonly string[] = ${JSON.stringify(streamConfig.consumerGroups.map((g) => g.name))};`,
    );
    exportedSymbols.push(groupsConst);
  }

  const streamMetadataBlock =
    metaLines.length > 0 ? `\n\n${metaLines.join("\n")}` : "";

  return {
    interfacesBlock,
    streamMetadataBlock,
    exportedSymbols,
  };
}
