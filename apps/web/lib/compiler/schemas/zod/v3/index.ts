import { BackendNode } from "@/types/canvas";
import { CompiledFile } from "@workspace/canvas/types";
import { toTableName, toVarName, toPascalCase } from "../../../utils";

function mapColumnToZod(type?: string): string {
  if (!type) return "z.string()";
  const t = type.toLowerCase();
  if (t === "number" || t === "int" || t === "integer" || t === "float" || t === "double") {
    return "z.number()";
  }
  if (t === "boolean" || t === "bool") {
    return "z.boolean()";
  }
  if (t === "date" || t === "datetime" || t === "timestamp") {
    return "z.string().datetime().or(z.date())";
  }
  if (t === "json" || t === "object") {
    return "z.record(z.unknown())";
  }
  if (t === "array") {
    return "z.array(z.string())";
  }
  return "z.string()";
}

export interface ZodSchemaResult {
  file: CompiledFile;
  typeName: string;
  schemaName: string;
}

export function compileZod3Schema(
  node: BackendNode,
): ZodSchemaResult {
  const rawLabel = node.data?.label || node.id || "entity";
  const tableName = toTableName(rawLabel);
  const varName = toVarName(tableName);
  const typeName = toPascalCase(rawLabel);
  const schemaName = `${varName}Schema`;
  const columns = node.data?.columns || [];

  const fieldDefs: string[] = [];
  if (columns.length === 0) {
    fieldDefs.push(`  id: z.string(),`);
  } else {
    columns.forEach((col) => {
      const fName = toVarName(col.name);
      let zodType = mapColumnToZod(col.type);
      if (!col.isNotNull && !col.isPrimaryKey) {
        zodType += ".optional()";
      }
      fieldDefs.push(`  ${fName}: ${zodType},`);
    });
  }

  const content = `import { z } from "zod";

export const ${schemaName} = z.object({
${fieldDefs.join("\n")}
});

export type ${typeName} = z.infer<typeof ${schemaName}>;
export type Create${typeName}Input = z.infer<typeof ${schemaName}>;
export type Update${typeName}Input = Partial<Create${typeName}Input>;
`;

  return {
    file: {
      filename: `src/schemas/${varName}.zod.ts`,
      language: "typescript",
      content,
    },
    typeName,
    schemaName,
  };
}
