import { BackendNode } from "@/types/canvas";
import { CompiledFile } from "@workspace/canvas/types";
import { toTableName, toVarName } from "../../../../utils";

function mapToConvexValidator(type?: string): string {
  if (!type) return "v.string()";
  const t = type.toLowerCase();
  if (t === "number" || t === "int" || t === "float" || t === "integer" || t === "real") return "v.number()";
  if (t === "boolean" || t === "bool") return "v.boolean()";
  if (t === "string" || t === "text" || t === "uuid") return "v.string()";
  if (t === "json" || t === "object") return "v.any()";
  if (t === "array") return "v.array(v.string())";
  return "v.string()";
}

export function compileConvex1Schema(
  tables: BackendNode[],
): CompiledFile {
  const tableDefinitions: string[] = [];

  tables.forEach((t) => {
    const rawLabel = t.data?.label || t.id || "table";
    const tableName = toTableName(rawLabel);
    const tableVarName = toVarName(tableName);
    const columns = t.data?.columns || [];

    const fieldDefs: string[] = [];
    columns.forEach((c) => {
      if (c.isPrimaryKey || c.name === "id") return; // Convex auto-manages _id
      const fName = toVarName(c.name);
      const validator = mapToConvexValidator(c.type);
      fieldDefs.push(`    ${fName}: ${validator},`);
    });

    tableDefinitions.push(
      `  ${tableVarName}: defineTable({\n${fieldDefs.join("\n")}\n  }),`,
    );
  });

  const content = `import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
${tableDefinitions.join("\n\n")}
});
`;

  return {
    filename: "convex/schema.ts",
    language: "typescript",
    content,
  };
}
