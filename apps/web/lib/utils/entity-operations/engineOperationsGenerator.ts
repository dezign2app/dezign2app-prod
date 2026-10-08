import { DbOperationFunction } from "@workspace/canvas/types";
import type { BackendNode } from "@/types/canvas";
import { RawTableColumn } from "./naming";
import { generateDefaultDbOperations } from "./sqliteGenerator";
import { generatePostgresDbOperations } from "./postgresGenerator";

/**
 * Generates default DB operation functions for a specific database engine.
 *
 * For "postgres": delegates to generatePostgresDbOperations (async parameterized queries).
 * For all other engines (default): delegates to generateDefaultDbOperations (SQLite prepared statements).
 */
export function generateDefaultDbOperationsForEngine(
  label: string,
  rawColumns: RawTableColumn[] = [],
  indexes: { name: string; columns: string; isUnique?: boolean }[] = [],
  allNodes: BackendNode[] = [],
  engine = "sqlite",
): DbOperationFunction[] {
  if (engine === "postgres") {
    return generatePostgresDbOperations(label, rawColumns, indexes, allNodes);
  }
  return generateDefaultDbOperations(label, rawColumns, indexes, allNodes);
}
