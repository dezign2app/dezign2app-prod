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
          .join("\n") + "\n  [key: string]: string | number | boolean | null | undefined;"
      : "  id: string;\n  [key: string]: string | number | boolean | null | undefined;";

  let interfacesBlock = `export interface ${typeName} {\n${interfaceFields}\n}`;

  // Per-Operation Schema Types (Option B: Named Interfaces)
  const opPrefixes = [
    { name: `Get${typeName}`, dataType: `${typeName} | null` },
    { name: `GetAll${typeName}Fields`, dataType: `${typeName} | null` },
    { name: `Set${typeName}`, dataType: "void" },
    { name: `Set${typeName}Fields`, dataType: "void" },
    { name: `Get${typeName}Field`, dataType: "string | null" },
    { name: `Set${typeName}Field`, dataType: "void" },
    { name: `Delete${typeName}`, dataType: "boolean" },
    { name: `Delete${typeName}Field`, dataType: "boolean" },
  ];

  const operationTypes: string[] = [];
  opPrefixes.forEach(({ name, dataType }) => {
    exportedSymbols.push(`${name}Success`, `${name}Failure`, `${name}Result`);
    operationTypes.push(
      `export interface ${name}Success {\n  success: true;\n  data: ${dataType};\n}\n\n` +
        `export interface ${name}Failure {\n  success: false;\n  error: {\n    message: string;\n    code?: string;\n    details?: string;\n  };\n}\n\n` +
        `export type ${name}Result =\n  | ${name}Success\n  | ${name}Failure;`,
    );
  });

  if (operationTypes.length > 0) {
    interfacesBlock +=
      `\n\n// ─── Per-Operation Result Schemas (Success | Failure) ─────────\n` +
      operationTypes.join("\n\n");
  }

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
