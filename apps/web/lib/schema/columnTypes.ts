/**
 * Supported column types for database entities.
 * Includes full PostgreSQL types with fallback support for SQLite.
 */
export const POSTGRES_COLUMN_TYPES = [
  "TEXT",
  "VARCHAR",
  "UUID",
  "TIMESTAMPTZ",
  "TIMESTAMP",
  "INTEGER",
  "BIGINT",
  "SMALLINT",
  "SERIAL",
  "BIGSERIAL",
  "BOOLEAN",
  "DATE",
  "TIME",
  "JSONB",
  "JSON",
  "NUMERIC",
  "DECIMAL",
  "REAL",
  "DOUBLE PRECISION",
  "BYTEA",
] as const;

export const SQLITE_COLUMN_TYPES = [
  "TEXT",
  "INTEGER",
  "REAL",
  "BOOLEAN",
  "BLOB",
] as const;

export const ALL_COLUMN_TYPES = [
  "TEXT",
  "VARCHAR",
  "UUID",
  "TIMESTAMPTZ",
  "TIMESTAMP",
  "INTEGER",
  "BIGINT",
  "SERIAL",
  "BIGSERIAL",
  "BOOLEAN",
  "DATE",
  "TIME",
  "JSONB",
  "JSON",
  "NUMERIC",
  "DECIMAL",
  "REAL",
  "DOUBLE PRECISION",
  "BYTEA",
  "BLOB",
] as const;

export const COLUMN_TYPES = ALL_COLUMN_TYPES;

export type ColumnType = (typeof COLUMN_TYPES)[number];

export function getColumnTypesForEngine(engine?: string): readonly string[] {
  const e = (engine || "postgres").toLowerCase();
  if (e === "sqlite") {
    return SQLITE_COLUMN_TYPES;
  }
  return POSTGRES_COLUMN_TYPES;
}

/**
 * Normalizes an arbitrary column type string to a valid PostgreSQL type.
 */
export function normalizeToPostgresType(type?: string, isPrimaryKey?: boolean): string {
  if (!type) return "TEXT";
  const t = type.toLowerCase().trim();

  if (isPrimaryKey) {
    if (t === "number" || t === "int" || t === "integer" || t === "bigint" || t === "serial" || t === "bigserial") {
      return "BIGSERIAL";
    }
    if (t === "uuid") return "UUID";
    return "TEXT";
  }

  if (t === "number" || t === "int" || t === "integer") return "INTEGER";
  if (t === "smallint") return "SMALLINT";
  if (t === "bigint") return "BIGINT";
  if (t === "serial") return "SERIAL";
  if (t === "bigserial") return "BIGSERIAL";
  if (t === "float" || t === "double" || t === "double precision") return "DOUBLE PRECISION";
  if (t === "real") return "REAL";
  if (t === "numeric" || t === "decimal") return "NUMERIC";
  if (t === "boolean" || t === "bool") return "BOOLEAN";
  if (t === "timestamptz" || t === "timestamp with time zone") return "TIMESTAMPTZ";
  if (t === "timestamp" || t === "datetime" || t === "timestamp without time zone") return "TIMESTAMP";
  if (t === "date") return "DATE";
  if (t === "time") return "TIME";
  if (t === "jsonb") return "JSONB";
  if (t === "json" || t === "object") return "JSONB";
  if (t === "array") return "JSONB";
  if (t === "uuid") return "UUID";
  if (t === "varchar") return "VARCHAR";
  if (t === "bytea") return "BYTEA";
  if (t === "text" || t === "string") return "TEXT";

  const upper = type.toUpperCase().trim();
  if ((POSTGRES_COLUMN_TYPES as readonly string[]).includes(upper)) {
    return upper;
  }
  return "TEXT";
}
