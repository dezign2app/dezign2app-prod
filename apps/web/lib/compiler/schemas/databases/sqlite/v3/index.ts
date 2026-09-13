import { BackendNode } from "@/types/canvas";
import { CompiledFile } from "@workspace/canvas/types";
import { toTableName, toVarName, toPascalCase } from "../../../../utils";

function mapToDrizzleSqliteType(type?: string): { drizzleType: string; mode?: string } {
  if (!type) return { drizzleType: "text" };
  const t = type.toLowerCase();
  if (t === "number" || t === "int" || t === "integer") return { drizzleType: "integer" };
  if (t === "float" || t === "double" || t === "decimal" || t === "real") return { drizzleType: "real" };
  if (t === "boolean" || t === "bool") return { drizzleType: "integer", mode: '{ mode: "boolean" }' };
  return { drizzleType: "text" };
}

export interface SqliteSchemaResult {
  file: CompiledFile;
  tableName: string;
  tableVarName: string;
  typeName: string;
}

export function compileSqlite3TableSchema(
  tableNode: BackendNode,
): SqliteSchemaResult {
  const rawLabel = tableNode.data?.label || tableNode.id || "table";
  const tableName = toTableName(rawLabel);
  const tableVarName = toVarName(tableName);
  const typeName = toPascalCase(rawLabel);
  const columns = tableNode.data?.columns || [];

  const drizzleTypes = new Set<string>(["sqliteTable"]);
  const colDefinitions: string[] = [];

  if (columns.length === 0) {
    drizzleTypes.add("text");
    colDefinitions.push(`  id: text("id").primaryKey(),`);
    colDefinitions.push(`  createdAt: text("created_at")`);
  } else {
    columns.forEach((col) => {
      const dbColName = col.name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      const varName = toVarName(dbColName);
      const { drizzleType, mode } = mapToDrizzleSqliteType(col.type);

      drizzleTypes.add(drizzleType);
      let colDef = `  ${varName}: ${drizzleType}("${dbColName}"${mode ? `, ${mode}` : ""})`;

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

  const content = `import { ${Array.from(drizzleTypes).sort().join(", ")} } from "drizzle-orm/sqlite-core";

export const ${tableVarName} = sqliteTable("${tableName}", {
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
