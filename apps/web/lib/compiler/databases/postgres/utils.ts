import type { BackendNode } from "@/types/canvas";
import { sqlColumnToTsType } from "@workspace/canvas/constants";
import { toSqlIdentifier } from "../../utils";
import type { PgColumnMeta } from "./types";

/**
 * Converts a snake_case or kebab-case name to PascalCase.
 */
export function toPascal(str: string): string {
  if (!str) return "Item";
  const snake = str.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
  const clean = toSqlIdentifier(snake, "table");
  return clean
    .split(/[_\-\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

/**
 * Extracts and normalizes column metadata from an entity node.
 */
export function getColumns(tableNode: BackendNode): PgColumnMeta[] {
  const cols = tableNode.data?.columns;
  if (cols && Array.isArray(cols) && cols.length > 0) {
    return cols.map((c) => ({
      ...c,
      name: toSqlIdentifier(c.name || "col", "col"),
      isPrimaryKey: Boolean(c.isPrimaryKey || c.isPrimary || c.primaryKey),
    }));
  }
  return [
    { name: "id", type: "string", isPrimaryKey: true, isNotNull: true },
    { name: "created_at", type: "timestamp" },
  ];
}

/**
 * Maps canvas column data types to PostgreSQL column types.
 */
export function toPostgresType(type: string | undefined, isPrimaryKey?: boolean): string {
  if (!type) return "TEXT";
  const t = type.toLowerCase();

  if (isPrimaryKey) {
    if (t === "number" || t === "int" || t === "integer" || t === "bigint") {
      return "BIGSERIAL";
    }
    // UUID or text primary key → TEXT with default gen_random_uuid()
    return "TEXT";
  }

  if (t === "number" || t === "int" || t === "integer") return "INTEGER";
  if (t === "bigint") return "BIGINT";
  if (t === "float" || t === "double" || t === "decimal") return "DOUBLE PRECISION";
  if (t === "numeric") return "NUMERIC";
  if (t === "boolean" || t === "bool") return "BOOLEAN";
  if (t === "timestamp" || t === "datetime") return "TIMESTAMPTZ";
  if (t === "date") return "DATE";
  if (t === "time") return "TIME";
  if (t === "json" || t === "object" || t === "jsonb") return "JSONB";
  if (t === "array") return "JSONB";
  if (t === "uuid") return "UUID";
  return "TEXT";
}

export const toTsType = sqlColumnToTsType;
