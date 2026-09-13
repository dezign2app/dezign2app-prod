import { BackendNode } from "@/types/canvas";
import { CompiledFile } from "@workspace/canvas/types";
import { toTableName, toVarName, toPascalCase } from "../../../../utils";

function mapToDrizzlePgType(type?: string): { drizzleType: string; extraArgs?: string } {
  if (!type) return { drizzleType: "text" };
  const t = type.toLowerCase();
  if (t === "number" || t === "int" || t === "integer") return { drizzleType: "integer" };
  if (t === "serial") return { drizzleType: "serial" };
  if (t === "bigint") return { drizzleType: "bigint", extraArgs: '{ mode: "number" }' };
  if (t === "float" || t === "double" || t === "real") return { drizzleType: "real" };
  if (t === "decimal" || t === "numeric") return { drizzleType: "numeric" };
  if (t === "boolean" || t === "bool") return { drizzleType: "boolean" };
  if (t === "timestamp" || t === "date" || t === "datetime") return { drizzleType: "timestamp", extraArgs: '{ withTimezone: true }' };
  if (t === "json" || t === "jsonb") return { drizzleType: "jsonb" };
  if (t === "uuid") return { drizzleType: "uuid" };
  return { drizzleType: "text" };
}

export interface PostgresSchemaResult {
  file: CompiledFile;
  tableName: string;
  tableVarName: string;
  typeName: string;
}

export function compilePostgres16TableSchema(
  tableNode: BackendNode,
): PostgresSchemaResult {
  const rawLabel = tableNode.data?.label || tableNode.id || "table";
  const tableName = toTableName(rawLabel);
  const tableVarName = toVarName(tableName);
  const typeName = toPascalCase(rawLabel);
  const columns = tableNode.data?.columns || [];

  const drizzleTypes = new Set<string>(["pgTable"]);
  const colDefinitions: string[] = [];

  if (columns.length === 0) {
    drizzleTypes.add("text");
    drizzleTypes.add("timestamp");
    colDefinitions.push(`  id: text("id").primaryKey(),`);
    colDefinitions.push(`  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()`);
  } else {
    columns.forEach((col) => {
      const dbColName = col.name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      const varName = toVarName(dbColName);
      const { drizzleType, extraArgs } = mapToDrizzlePgType(col.type);

      drizzleTypes.add(drizzleType);
      let colDef = `  ${varName}: ${drizzleType}("${dbColName}"${extraArgs ? `, ${extraArgs}` : ""})`;

      if (col.isPrimaryKey) {
        colDef += `.primaryKey()`;
      }
      if (col.isNotNull && !col.isPrimaryKey) {
        colDef += `.notNull()`;
      }
      if (col.isUnique && !col.isPrimaryKey) {
        colDef += `.unique()`;
      }
      colDefinitions.push(colDef + ",");
    });
  }

  const content = `import { ${Array.from(drizzleTypes).sort().join(", ")} } from "drizzle-orm/pg-core";

export const ${tableVarName} = pgTable("${tableName}", {
${colDefinitions.join("\n")}
});

export type ${typeName} = typeof ${tableVarName}.$inferSelect;
export type Insert${typeName} = typeof ${tableVarName}.$inferInsert;
`;

  return {
    file: {
      filename: `src/schemas/${tableVarName}.ts`,
      language: "typescript",
      content,
    },
    tableName,
    tableVarName,
    typeName,
  };
}
