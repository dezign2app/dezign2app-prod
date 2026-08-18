/**
 * Supported column types for SQLite database entities.
 * SQLite natively uses TEXT, INTEGER, REAL, BLOB, and BOOLEAN.
 */
export const SQLITE_COLUMN_TYPES = [
  "TEXT",
  "INTEGER",
  "REAL",
  "BOOLEAN",
  "BLOB",
] as const;

export const COLUMN_TYPES = SQLITE_COLUMN_TYPES;

export type ColumnType = (typeof COLUMN_TYPES)[number];
