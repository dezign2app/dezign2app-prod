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

  // Find auth nodes that are connected to at least one webApp, webClient, service, or database
  const connectedAuthNodes = allNodes.filter((n) => {
    if (n.type !== "auth") return false;
    const hasEdge = allEdges.some((e) => {
      if (e.source !== n.id && e.target !== n.id) return false;
      const otherId = e.source === n.id ? e.target : e.source;
      const other = allNodes.find((o) => o.id === otherId);
      return (
        other &&
        (other.type === "webApp" ||
          other.type === "webClient" ||
          other.type === "service" ||
          other.type === "database" ||
          other.type === "entity" ||
          other.type === "db_ref" ||
          other.data?.isWebClient)
      );
    });
    const hasRef = allNodes.some((other) => other.data?.authNodeId === n.id);
    return hasEdge || hasRef;
  });

  if (connectedAuthNodes.length > 0) {
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

    const syntheticEntities: BackendNode[] = [];

    connectedAuthNodes.forEach((authNode) => {
      const enabledPlugins: string[] =
        authNode.data?.plugins || ["bearer", "admin", "organization", "jwt"];
      const isOrgEnabled: boolean =
        authNode.data?.organization?.enabled ?? true;

      const neededDefs = BETTER_AUTH_TABLE_DEFINITIONS.filter(
        (def) =>
          isBetterAuthTableRequired(def, {
            isOrgEnabled,
            enabledPlugins,
            providers: authNode.data?.providers,
          }) &&
          !existingEntityNames.has(def.name.toLowerCase()) &&
          !existingEntityNames.has(toSingular(def.name).toLowerCase()) &&
          !existingEntityNames.has(toPlural(def.name).toLowerCase()) &&
          !syntheticEntities.some((s) => s.data?.label?.toLowerCase() === def.name.toLowerCase()),
      );

      neededDefs.forEach((def) => {
        syntheticEntities.push({
          id: `synthetic-auth-${def.key}`,
          type: "entity",
          fractionalIndex: "a0",
          position: { x: 0, y: 0 },
          data: {
            label: def.name,
            description: def.description,
            columns: def.defaultColumns,
          },
        });
      });
    });

    if (syntheticEntities.length > 0) {
      effectiveNodes = [...allNodes, ...syntheticEntities];
    }
  }

  const dbNode = allNodes.find((n) => n.type === "database" || (n.data as any)?.isDatabase);
  const orm = (dbNode?.data as any)?.orm || (dbNode?.data as any)?.dbAdapter || (dbNode?.data as any)?.adapter;

  const dbEngine = (
    dbNode?.data?.dbEngine ||
    (dbNode?.data as any)?.engine ||
    (dbNode?.data as any)?.provider ||
    (dbNode?.data as any)?.dbType ||
    ""
  ).toLowerCase();

  const isExplicitNonSqlite =
    dbEngine.includes("postgres") ||
    dbEngine.includes("mysql") ||
    dbEngine.includes("mongo") ||
    dbEngine.includes("redis");

  const hasSqliteDbNode = Boolean(dbNode && !isExplicitNonSqlite);
  const hasEntityNodes = entityNodes.length > 0;
  const hasConnectedAuth = connectedAuthNodes.length > 0;

  // Only compile SQLite package and helpers if SQLite database, entities, or connected auth are configured
  if (!hasSqliteDbNode && !hasEntityNodes && !hasConnectedAuth) {
    return {
      files: [],
      reusableFunctions: [],
    };
  }

  if (orm === "drizzle") {
    return compileSqliteDrizzleDatabase(effectiveNodes, allEdges);
  }

  return compileRawSqliteDatabase(effectiveNodes, allEdges);
}
