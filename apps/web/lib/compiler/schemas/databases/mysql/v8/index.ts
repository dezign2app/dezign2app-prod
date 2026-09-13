import { BackendNode } from "@/types/canvas";
import { CompiledFile } from "@workspace/canvas/types";
import { toTableName, toVarName, toPascalCase } from "../../../../utils";

function mapToDrizzleMySqlType(type?: string): { drizzleType: string; args?: string } {
  if (!type) return { drizzleType: "text" };
  const t = type.toLowerCase();
  if (t === "number" || t === "int" || t === "integer") return { drizzleType: "int" };
  if (t === "bigint") return { drizzleType: "bigint", args: '{ mode: "number" }' };
  if (t === "float" || t === "double" || t === "real") return { drizzleType: "double" };
  if (t === "boolean" || t === "bool") return { drizzleType: "boolean" };
  if (t === "datetime" || t === "timestamp" || t === "date") return { drizzleType: "datetime" };
  if (t === "json") return { drizzleType: "json" };
  if (t === "varchar" || t === "string") return { drizzleType: "varchar", args: "{ length: 255 }" };
  return { drizzleType: "text" };
}

export interface MySqlSchemaResult {
  file: CompiledFile;
  tableName: string;
  tableVarName: string;
  typeName: string;
}

export function compileMySql8TableSchema(
  tableNode: BackendNode,
): MySqlSchemaResult {
  const rawLabel = tableNode.data?.label || tableNode.id || "table";
  const tableName = toTableName(rawLabel);
  const tableVarName = toVarName(tableName);
  const typeName = toPascalCase(rawLabel);
  const columns = tableNode.data?.columns || [];

  const drizzleTypes = new Set<string>(["mysqlTable"]);
  const colDefinitions: string[] = [];

  if (columns.length === 0) {
    drizzleTypes.add("varchar");
    drizzleTypes.add("datetime");
    colDefinitions.push(`  id: varchar("id", { length: 255 }).primaryKey(),`);
    colDefinitions.push(`  createdAt: datetime("created_at").default(new Date())`);
  } else {
    columns.forEach((col) => {
      const dbColName = col.name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      const varName = toVarName(dbColName);
      const { drizzleType, args } = mapToDrizzleMySqlType(col.type);

      drizzleTypes.add(drizzleType);
      let colDef = `  ${varName}: ${drizzleType}("${dbColName}"${args ? `, ${args}` : ""})`;

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

  const content = `import { ${Array.from(drizzleTypes).sort().join(", ")} } from "drizzle-orm/mysql-core";

export const ${tableVarName} = mysqlTable("${tableName}", {
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
