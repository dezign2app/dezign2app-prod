import type { BackendNode } from "@/types/canvas";
import { sqlColumnToTsType } from "@workspace/canvas/constants";
import { normalizeToPostgresType } from "@/lib/schema/columnTypes";
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
export function getColumns(tableNode: BackendNode, allNodes: BackendNode[] = []): PgColumnMeta[] {
  let targetNode = tableNode;
  if (tableNode.type === "db_ref" && tableNode.data?.tableRef) {
    const master = allNodes.find((n) => n.id === tableNode.data.tableRef);
    if (master) targetNode = master;
  }
  const cols = targetNode.data?.columns || targetNode.data?.fields;
  if (cols && Array.isArray(cols) && cols.length > 0) {
    return cols.map((c) => ({
      ...c,
      name: toSqlIdentifier(c.name || "col", "col"),
      isPrimaryKey: Boolean(
        ("isPrimaryKey" in c && c.isPrimaryKey) ||
        ("isPrimary" in c && c.isPrimary) ||
        ("primaryKey" in c && c.primaryKey),
      ),
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
export const toPostgresType = normalizeToPostgresType;

export const toTsType = sqlColumnToTsType;
