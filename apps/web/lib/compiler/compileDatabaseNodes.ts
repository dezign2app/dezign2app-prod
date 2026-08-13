import { BackendNode, BackendEdge } from "@/types/canvas";
import { CompiledDatabaseResult } from "@workspace/canvas/types";
import {
  BETTER_AUTH_TABLE_DEFINITIONS,
  isBetterAuthTableRequired,
} from "@workspace/canvas";
import { toTableName, toSingular, toPlural } from "./utils";
import { compileRawSqliteDatabase } from "./databases/sqlite/raw";
import { compileSqliteDrizzleDatabase } from "./databases/sqlite/drizzle";

/**
 * Compiles database nodes into packages/db using raw SQL prepared statements (or Drizzle if configured).
 *
 * When an auth node is present, this function checks for BetterAuth table definitions
 * matching the auth node's configured plugins and settings, synthesizing any missing
 * entity nodes so that the db package always reflects the auth configuration.
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

    const existingEntityNames = new Set<string>();
    entityNodes.forEach((n) => {
      const raw = n.data?.label || n.data?.tableRef || "";
      if (!raw) return;
      const clean = toTableName(raw);
      existingEntityNames.add(clean.toLowerCase());
      existingEntityNames.add(toSingular(clean).toLowerCase());
      existingEntityNames.add(toPlural(clean).toLowerCase());
      existingEntityNames.add(raw.toLowerCase());
    });

    const syntheticEntities: BackendNode[] = BETTER_AUTH_TABLE_DEFINITIONS.filter(
      (def) =>
        isBetterAuthTableRequired(def, {
          isOrgEnabled,
          enabledPlugins,
          providers: authNode.data?.providers,
        }) &&
        !existingEntityNames.has(def.name.toLowerCase()) &&
        !existingEntityNames.has(toSingular(def.name).toLowerCase()) &&
        !existingEntityNames.has(toPlural(def.name).toLowerCase()),
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
      effectiveNodes = [...allNodes, ...syntheticEntities];
    }
  }

  const dbNode = allNodes.find((n) => n.type === "database" || (n.data as any)?.isDatabase);
  const orm = (dbNode?.data as any)?.orm || (dbNode?.data as any)?.dbAdapter || (dbNode?.data as any)?.adapter;

  if (orm === "drizzle") {
    return compileSqliteDrizzleDatabase(effectiveNodes, allEdges);
  }

  return compileRawSqliteDatabase(effectiveNodes, allEdges);
}
