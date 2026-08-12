import { BackendNode, BackendEdge } from "@/types/canvas";
import { CompiledDatabaseResult } from "@workspace/canvas/types";
import {
  BETTER_AUTH_TABLE_DEFINITIONS,
  isBetterAuthTableRequired,
} from "@workspace/canvas";
import { compileRawSqliteDatabase } from "./databases/sqlite/raw";

/**
 * Compiles database nodes into packages/db using raw SQL prepared statements.
 * ORM-free by design — see databases/sqlite/raw/index.ts.
 *
 * When no entity nodes are present on the canvas, this function checks for an
 * auth node and synthesizes entity nodes from the BetterAuth table definitions
 * matching the auth node's configured plugins and settings. This ensures the
 * db package always reflects the auth configuration even when the user hasn't
 * manually added entity nodes to the schema canvas.
 */
export function compileDatabaseNodes(
  allNodes: BackendNode[],
  allEdges: BackendEdge[],
): CompiledDatabaseResult {
  const entityNodes = allNodes.filter(
    (n) => n.type === "entity" || n.type === "db_ref",
  );

  let effectiveNodes = allNodes;

  const authNode = allNodes.find((n) => n.type === "auth");
  if (authNode) {
    const enabledPlugins: string[] =
      authNode.data?.plugins || ["bearer", "admin", "organization", "jwt"];
    const isOrgEnabled: boolean =
      authNode.data?.organization?.enabled ?? true;

    const existingEntityNames = new Set(
      entityNodes
        .map((n) => (n.data?.label || n.data?.tableRef || "").toLowerCase())
        .filter(Boolean),
    );

    const syntheticEntities: BackendNode[] = BETTER_AUTH_TABLE_DEFINITIONS.filter(
      (def) =>
        isBetterAuthTableRequired(def, {
          isOrgEnabled,
          enabledPlugins,
          providers: authNode.data?.providers,
        }) && !existingEntityNames.has(def.name.toLowerCase()),
    ).map((def) => ({
      id: `synthetic-auth-${def.key}`,
      type: "entity",
      fractionalIndex: "a0",
      position: { x: 0, y: 0 },
      data: {
        label: def.name,
        description: def.description,
        columns: def.defaultColumns,
      },
    }));

    if (syntheticEntities.length > 0) {
      // Merge synthetic entity nodes into allNodes so the raw compiler can
      // pick them up via its own internal entity filter
      effectiveNodes = [...allNodes, ...syntheticEntities];
    }
  }

  return compileRawSqliteDatabase(effectiveNodes, allEdges);
}
