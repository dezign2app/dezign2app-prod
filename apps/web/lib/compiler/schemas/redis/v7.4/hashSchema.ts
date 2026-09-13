import { BackendNode } from "@/types/canvas";
import { mapColumnTypeToTs } from "../../utils";
import { RedisDuration } from "@workspace/canvas/types";

function durationToSeconds(d?: RedisDuration): number {
  if (!d || !d.value) return 0;
  switch (d.unit) {
    case "s":
      return d.value;
    case "m":
      return d.value * 60;
    case "h":
      return d.value * 3600;
    case "d":
      return d.value * 86400;
    default:
      return 0;
  }
}

export interface CompiledHashSchemaResult {
  interfacesBlock: string;
  fieldTtlDeclarations: string;
  exportedSymbols: string[];
}

export function compileRedis74HashSchema(
  typeName: string,
  schemaNode: BackendNode,
): CompiledHashSchemaResult {
  const columns = schemaNode.data?.columns || [];
  const hashFields = schemaNode.data?.hashConfig?.fields;

  const exportedSymbols: string[] = [typeName];

  // Derive fields
  const fields =
    hashFields ||
    columns.map((c) => ({
      name: c.name,
      type: mapColumnTypeToTs(c.type),
      required: Boolean(c.isPrimaryKey || c.isNotNull),
      ttl: undefined,
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

  // Redis 7.4+ Field-level TTL (HEXPIRE) constants
  const fieldTtls: string[] = [];
  if (hashFields && Array.isArray(hashFields)) {
    hashFields.forEach((hf) => {
      if (hf.ttl && hf.ttl.value > 0) {
        const sec = durationToSeconds(hf.ttl);
        const constName = `${typeName.toUpperCase()}_FIELD_${hf.name.toUpperCase()}_TTL_SECONDS`;
        fieldTtls.push(
          `/** Redis 7.4+ HEXPIRE Field-Level TTL for ${hf.name} */\nexport const ${constName} = ${sec};`,
        );
        exportedSymbols.push(constName);
      }
    });
  }

  const fieldTtlDeclarations =
    fieldTtls.length > 0 ? `\n\n${fieldTtls.join("\n")}` : "";

  return {
    interfacesBlock,
    fieldTtlDeclarations,
    exportedSymbols,
  };
}
