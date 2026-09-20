import type { BackendNode } from "@/types/canvas";
import type {
  ReusableFunction,
  DbOperationFunction,
} from "@workspace/canvas/types";
import { toTableName, toVarName, toSingular, toPlural } from "../../utils";
import {
  generateDefaultDbOperationsForEngine,
  getEntityDbOperations,
} from "@/lib/utils/entityOperationsHelper";
import { toPascal, getColumns, toTsType } from "./utils";
import type { InlinePgOpContext, TableHelperResult } from "./types";

/**
 * Inline fallback code generator for standard Postgres operation kinds.
 */
export function generateInlinePostgresOp(
  kind: string,
  ctx: InlinePgOpContext,
): string {
  const {
    tableName,
    pascal,
    pascalSingular,
    pkColName,
    pkVarName,
    pkTsType,
    isStringPk,
    writableCols,
    colVarNames,
    effectiveName,
  } = ctx;

  const msgCreated = colVarNames.has("message")
    ? ""
    : `, message: "${pascalSingular} created successfully"`;
  const msgUpdated = colVarNames.has("message")
    ? ""
    : `, message: "${pascalSingular} updated successfully"`;

  switch (kind) {
    case "findAll":
      return (
        `export async function ${effectiveName}(limit = 20, offset = 0): Promise<${pascal}Row[]> {\n` +
        `  const res = await query<${pascal}Row>(\n` +
        `    'SELECT * FROM "${tableName}" ORDER BY "${pkColName}" LIMIT $1 OFFSET $2',\n` +
        `    [limit, offset]\n` +
        `  );\n` +
        `  return res.rows;\n` +
        `}`
      );
    case "findById":
      return (
        `export async function ${effectiveName}(${pkVarName}: ${pkTsType}): Promise<${pascal}Row | null> {\n` +
        `  const res = await query<${pascal}Row>(\n` +
        `    'SELECT * FROM "${tableName}" WHERE "${pkColName}" = $1 LIMIT 1',\n` +
        `    [${pkVarName}]\n` +
        `  );\n` +
        `  return res.rows[0] || null;\n` +
        `}`
      );
    case "create": {
      const insertCols = writableCols.map((c) => `"${c.name}"`).join(", ");
      const insertParams = writableCols
        .map((_, i) => `$${isStringPk ? i + 2 : i + 1}`)
        .join(", ");
      const destructuredFields = [
        ...(isStringPk ? [pkVarName] : []),
        ...writableCols.map((c) => toVarName(c.name)),
      ].join(", ") || "id";
      const insertArgVals = writableCols
        .map((c) => `${toVarName(c.name)} ?? null`)
        .join(", ");
      if (isStringPk) {
        return (
          `export async function ${effectiveName}({ ${destructuredFields} }: Create${pascal}Data): Promise<${pascal}Row> {\n` +
          `  const _id = ${pkVarName} || randomUUID();\n` +
          `  const res = await query<${pascal}Row>(\n` +
          `    'INSERT INTO "${tableName}" ("${pkColName}"${insertCols ? `, ${insertCols}` : ""}) VALUES ($1${insertParams ? `, ${insertParams}` : ""}) RETURNING *',\n` +
          `    [_id${insertArgVals ? `, ${insertArgVals}` : ""}]\n` +
          `  );\n` +
          `  return res.rows[0];\n` +
          `}`
        );
      }
      return (
        `export async function ${effectiveName}({ ${destructuredFields} }: Create${pascal}Data): Promise<${pascal}Row> {\n` +
        `  const res = await query<${pascal}Row>(\n` +
        `    'INSERT INTO "${tableName}" (${insertCols}) VALUES (${insertParams}) RETURNING *',\n` +
        `    [${insertArgVals}]\n` +
        `  );\n` +
        `  return res.rows[0];\n` +
        `}`
      );
    }
    case "update": {
      if (writableCols.length > 0) {
        const updateDestructured = writableCols.map((c) => toVarName(c.name)).join(", ");
        const setClauses = writableCols
          .map((c, i) => `"${c.name}" = $${i + 2}`)
          .join(", ");
        const setArgs = writableCols
          .map((c) => `${toVarName(c.name)} ?? null`)
          .join(", ");
        return (
          `export async function ${effectiveName}(${pkVarName}: ${pkTsType}, { ${updateDestructured} }: Update${pascal}Data): Promise<${pascal}Row | null> {\n` +
          `  const res = await query<${pascal}Row>(\n` +
          `    'UPDATE "${tableName}" SET ${setClauses} WHERE "${pkColName}" = $1 RETURNING *',\n` +
          `    [${pkVarName}, ${setArgs}]\n` +
          `  );\n` +
          `  return res.rows[0] || null;\n` +
          `}`
        );
      }
      return (
        `export async function ${effectiveName}(${pkVarName}: ${pkTsType}): Promise<${pascal}Row | null> {\n` +
        `  const res = await query<${pascal}Row>(\n` +
        `    'SELECT * FROM "${tableName}" WHERE "${pkColName}" = $1 LIMIT 1',\n` +
        `    [${pkVarName}]\n` +
        `  );\n` +
        `  return res.rows[0] || null;\n` +
        `}`
      );
    }
    case "delete":
      return (
        `export async function ${effectiveName}(${pkVarName}: ${pkTsType}): Promise<{ success: boolean; message: string }> {\n` +
        `  await query(\n` +
        `    'DELETE FROM "${tableName}" WHERE "${pkColName}" = $1',\n` +
        `    [${pkVarName}]\n` +
        `  );\n` +
        `  return { success: true, message: "${pascalSingular} deleted successfully" };\n` +
        `}`
      );
    default:
      return (
        `export async function ${effectiveName}(): Promise<void> {\n` +
        `  // Custom operation\n` +
        `}`
      );
  }
}

/**
 * Generates per-table typed CRUD helpers and interfaces for a single entity node.
 */
export function generatePostgresTableHelpers(
  tableNode: BackendNode,
  allNodes: BackendNode[] = [],
  packageName: string = "@workspace/db",
): TableHelperResult {
  const rawName = tableNode.data?.label || tableNode.data?.tableRef || "table";
  const tableName = toTableName(rawName);
  const singularName = toSingular(tableName);
  const pluralName = toPlural(tableName);
  const pascal = toPascal(tableName);
  const pascalSingular = toPascal(singularName);
  const pascalPlural = toPascal(pluralName);
  const varName = toVarName(singularName);
  const cols = getColumns(tableNode);
  const pkCol =
    cols.find((c) => c.isPrimaryKey) || cols[0] || { name: "id", type: "string" };
  const pkColName = pkCol.name || "id";
  const pkVarName = toVarName(pkColName);
  const pkTsType = toTsType(pkCol.type);
  const isStringPk = pkTsType === "string";
  const writableCols = cols.filter((c) => !c.isPrimaryKey);
  const colVarNames = new Set(cols.map((c) => toVarName(c.name)));

  const fns: ReusableFunction[] = [];
  const importPath = `${packageName}/helpers/${varName}`;

  // ── Types ─────────────────────────────────────────────────────────────────
  let code = `/**\n * Auto-generated async PostgreSQL helpers for table: "${tableName}"\n *\n * ALL queries use parameterized $1, $2, ... placeholders — safe from SQL injection.\n * Never concatenate user-supplied values into query strings.\n */\n`;
  code += `import { query, withTransaction } from "../connection";\n`;
  if (isStringPk) {
    code += `import { randomUUID } from "node:crypto";\n`;
  }
  code += `\n`;

  // Type declarations
  code += `// ── Types ────────────────────────────────────────────────────────────────────\n\n`;
  code += `export interface ${pascal}Row {\n`;
  cols.forEach((c) => {
    const tsType = toTsType(c.type);
    const opt = c.isPrimaryKey || c.isNotNull ? "" : "?";
    code += `  ${toVarName(c.name)}${opt}: ${tsType};\n`;
  });
  if (!colVarNames.has("message")) {
    code += `  message?: string;\n`;
  }
  if (!colVarNames.has("success")) {
    code += `  success?: boolean;\n`;
  }
  code += `}\n\n`;

  // Create data type
  const createFields = writableCols
    .map((c) => {
      const opt = c.isNotNull ? "" : "?";
      return `  ${toVarName(c.name)}${opt}: ${toTsType(c.type)};`;
    })
    .join("\n");
  if (isStringPk) {
    code += `export interface Create${pascal}Data {\n  ${pkVarName}?: ${pkTsType};\n${createFields}\n}\n\n`;
  } else {
    code += `export interface Create${pascal}Data {\n${createFields || `  ${pkVarName}?: ${pkTsType};`}\n}\n\n`;
  }

  code += `export type Update${pascal}Data = Partial<Create${pascal}Data>;\n\n`;
  code += `export type ${pascal} = ${pascal}Row;\n`;

  const declaredTypes = new Set<string>([
    `${pascal}Row`,
    `Create${pascal}Data`,
    `Update${pascal}Data`,
    pascal,
  ]);

  if (pascalSingular !== pascal) {
    code += `export type ${pascalSingular}Row = ${pascal}Row;\n`;
    code += `export type ${pascalSingular} = ${pascal}Row;\n`;
    code += `export type Create${pascalSingular}Data = Create${pascal}Data;\n`;
    code += `export type Update${pascalSingular}Data = Update${pascal}Data;\n`;
    declaredTypes.add(`${pascalSingular}Row`);
    declaredTypes.add(pascalSingular);
    declaredTypes.add(`Create${pascalSingular}Data`);
    declaredTypes.add(`Update${pascalSingular}Data`);
  }
  if (pascalPlural !== pascal && pascalPlural !== pascalSingular) {
    code += `export type ${pascalPlural}Row = ${pascal}Row;\n`;
    code += `export type ${pascalPlural} = ${pascal}Row;\n`;
    declaredTypes.add(`${pascalPlural}Row`);
    declaredTypes.add(pascalPlural);
  }
  code += `\n`;

  // ── Canvas DB Operations ──────────────────────────────────────────────────
  const dbOps: DbOperationFunction[] = getEntityDbOperations(
    tableNode,
    allNodes,
    "postgres",
  );
  const defaultOps = generateDefaultDbOperationsForEngine(
    tableNode.data?.label || "table",
    cols,
    tableNode.data?.indexes || [],
    allNodes,
    "postgres",
  );

  const exportedValueSymbols: string[] = [];
  const seenFunctionNames = new Set<string>();

  dbOps.forEach((op) => {
    if (op.enabled === false) return;

    const matchingDefault = defaultOps.find(
      (d) => d.id === op.id || d.name === op.name || d.kind === op.kind,
    );
    const effectiveName =
      op.isAutoGenerated && matchingDefault ? matchingDefault.name : op.name;
    if (!effectiveName) return;
    if (seenFunctionNames.has(effectiveName)) return;

    const effectiveSignature =
      (op.isAutoGenerated && matchingDefault
        ? matchingDefault.signature
        : op.signature) || `${effectiveName}(): Promise<void>`;

    let effectiveCode =
      (op.isAutoGenerated ||
        op.kind !== "custom" ||
        !op.code ||
        !op.code.trim()) &&
      matchingDefault
        ? matchingDefault.code
        : op.code || "";

    if (!effectiveCode || !effectiveCode.trim()) {
      effectiveCode = generateInlinePostgresOp(op.kind || "custom", {
        tableName,
        pascal,
        pascalSingular,
        pkColName,
        pkVarName,
        pkTsType,
        isStringPk,
        writableCols,
        colVarNames,
        effectiveName,
      });
    }

    if (effectiveCode && effectiveCode.trim()) {
      effectiveCode = effectiveCode
        .replace(/\s+as\s+unknown\s+as\s+[A-Za-z0-9_]+Row/g, "")
        .replace(/\s+as\s+[A-Za-z0-9_]+Row/g, "")
        .replace(/\s+as\s+unknown\s+as\s+[A-Za-z0-9_]+/g, "")
        .replace(/\s+as\s+any/g, "");

      seenFunctionNames.add(effectiveName);
      if (!exportedValueSymbols.includes(effectiveName)) {
        exportedValueSymbols.push(effectiveName);
      }
      fns.push({
        name: effectiveName,
        importPath,
        signature: effectiveSignature,
        targetName: tableName,
        kind:
          op.kind === "fetchByIndex" || op.kind === "join"
            ? "custom"
            : op.kind,
      });

      code += `/** ${op.description || effectiveName} */\n`;
      code += `${effectiveCode.trim()}\n\n`;
    }
  });

  return {
    code,
    fns,
    typeExports: Array.from(declaredTypes),
    valueExports: exportedValueSymbols,
  };
}
