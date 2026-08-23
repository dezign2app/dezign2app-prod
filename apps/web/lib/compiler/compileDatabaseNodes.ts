import { BackendNode, BackendEdge } from "@/types/canvas";
import {
  CompiledDatabaseResult,
  CompiledDatabasePackage,
  CompiledFile,
  ReusableFunction,
  CanvasDatabaseNodeData,
} from "@workspace/canvas/types";
import {
  BETTER_AUTH_TABLE_DEFINITIONS,
  isBetterAuthTableRequired,
} from "@workspace/canvas";
import { toTableName, toVarName, toSingular, toPlural } from "./utils";
import { compileRawSqliteDatabase } from "./databases/sqlite/raw";
import { compilePostgresDatabase } from "./databases/postgres";
import { compileMysqlDatabase } from "./databases/mysql";
import { compileConvexDatabase } from "./databases/convex";

/**
 * Normalizes a database engine string.
 */
function normalizeEngine(engine?: string): string {
  const e = (engine || "").toLowerCase().trim();
  if (e.includes("postgres") || e.includes("pg") || e.includes("cockroach")) {
    return "postgres";
  }
  if (e.includes("mysql") || e.includes("mariadb")) {
    return "mysql";
  }
  if (e.includes("convex")) {
    return "convex";
  }
  if (e.includes("mongo")) {
    return "mongodb";
  }
  if (e.includes("redis")) {
    return "redis";
  }
  return "sqlite";
}

/**
 * Resolves a unique, clean folder name for a database package under packages/db/.
 */
function resolveDbFolderName(dbNode: BackendNode, existingFolders: Set<string>): string {
  const label = dbNode.data?.label || dbNode.data?.dbEngine || dbNode.id || "db";
  let base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "db";
  let folder = base || "db";
  let counter = 1;
  while (existingFolders.has(folder)) {
    counter++;
    folder = `${base}-${counter}`;
  }
  existingFolders.add(folder);
  return folder;
}

/**
 * Compiles database nodes into modular packages under packages/db/ (or packages/db for single database).
 * Supports database isolation (shared DB, DB-per-service, polyglot persistence with Postgres, MySQL, Convex, SQLite).
 */
export function compileDatabaseNodes(
  allNodes: BackendNode[],
  allEdges: BackendEdge[],
): CompiledDatabaseResult {
  const entityNodes = allNodes.filter(
    (n) => n.type === "entity" || n.type === "db_ref",
  );

  let effectiveNodes = [...allNodes];

  // 1. Find connected Auth nodes
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

  const dbNodes = allNodes.filter(
    (n) => n.type === "database" && n.data?.dbEngine !== "redis",
  );

  // 2. Synthesize BetterAuth tables if connected auth nodes exist
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

      const authNodeId = authNode.id || authNode.nodeId;
      // Find if authNode is connected to a specific DB node
      const authDbEdge = allEdges.find(
        (e) =>
          ((e.source === authNode.id || e.source === authNodeId) &&
            dbNodes.some((d) => d.id === e.target || d.nodeId === e.target)) ||
          ((e.target === authNode.id || e.target === authNodeId) &&
            dbNodes.some((d) => d.id === e.source || d.nodeId === e.source)),
      );
      const targetDbId = authDbEdge
        ? authDbEdge.source === authNode.id || authDbEdge.source === authNodeId
          ? authDbEdge.target
          : authDbEdge.source
        : (authNode.data?.databaseId || dbNodes[0]?.id || dbNodes[0]?.nodeId);

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
          !syntheticEntities.some(
            (s) => s.data?.label?.toLowerCase() === def.name.toLowerCase(),
          ),
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
            databaseId: targetDbId,
          },
        });
      });
    });

    if (syntheticEntities.length > 0) {
      effectiveNodes = [...effectiveNodes, ...syntheticEntities];
    }
  }

  const allEntityNodes = effectiveNodes.filter(
    (n) =>
      (n.type === "entity" || n.type === "db_ref") &&
      n.data?.dbType !== "redis",
  );

  // Check if anything DB-related exists
  if (dbNodes.length === 0 && allEntityNodes.length === 0 && connectedAuthNodes.length === 0) {
    return {
      files: [],
      packages: [],
      reusableFunctions: [],
    };
  }

  // -------------------------------------------------------------------------
  // Case A: No explicit database nodes on canvas (Default single SQLite DB)
  // -------------------------------------------------------------------------
  if (dbNodes.length === 0) {
    const singleResult = compileRawSqliteDatabase(effectiveNodes, allEdges, {
      packageName: "@workspace/db",
      packageFolder: "",
    });
    const pkg: CompiledDatabasePackage = {
      packageName: "@workspace/db",
      packageFolder: "",
      dbEngine: "sqlite",
      files: singleResult.files,
      reusableFunctions: singleResult.reusableFunctions,
    };
    return {
      files: singleResult.files,
      packages: [pkg],
      reusableFunctions: singleResult.reusableFunctions,
    };
  }

  // -------------------------------------------------------------------------
  // Case B: Explicit Database Nodes (Database Isolation & Polyglot Persistence)
  // -------------------------------------------------------------------------
  const packages: CompiledDatabasePackage[] = [];
  const mergedFiles: CompiledFile[] = [];
  const mergedReusableFunctions: ReusableFunction[] = [];
  const existingFolders = new Set<string>();

  // Map each entity to its parent database node
  const entitiesByDbId = new Map<string, BackendNode[]>();
  dbNodes.forEach((d) => {
    entitiesByDbId.set(d.id, []);
    const altId = d.nodeId;
    if (altId && altId !== d.id) {
      entitiesByDbId.set(altId, entitiesByDbId.get(d.id)!);
    }
  });

  const primaryDbNode = dbNodes.find((d) => d.data?.isDefault) || dbNodes[0]!;

  allEntityNodes.forEach((ent) => {
    const entId = ent.id || ent.nodeId;
    // 1. Check explicit databaseId
    let targetDbId = ent.data?.databaseId;

    // 2. Check edges connecting DB to Entity
    if (!targetDbId) {
      const dbEdge = allEdges.find(
        (e) =>
          ((e.source === entId || e.source === ent.id) &&
            dbNodes.some((d) => d.id === e.target || d.nodeId === e.target)) ||
          ((e.target === entId || e.target === ent.id) &&
            dbNodes.some((d) => d.id === e.source || d.nodeId === e.source)),
      );
      if (dbEdge) {
        targetDbId =
          dbEdge.source === entId || dbEdge.source === ent.id
            ? dbEdge.target
            : dbEdge.source;
      }
    }

    // 3. Fall back to primary DB
    if (!targetDbId || !entitiesByDbId.has(targetDbId)) {
      targetDbId = primaryDbNode.id;
    }

    const bucket = entitiesByDbId.get(targetDbId);
    if (bucket && !bucket.includes(ent)) {
      bucket.push(ent);
    }
  });

  // Compile each database node in isolation
  dbNodes.forEach((dbNode) => {
    const dbEntities = entitiesByDbId.get(dbNode.id) || [];
    const engine = normalizeEngine(
      dbNode.data?.dbEngine ||
      dbNode.data?.provider ||
      dbNode.data?.dbType,
    );
    const isSingleDb = dbNodes.length === 1;
    const folderName = isSingleDb ? "" : resolveDbFolderName(dbNode, existingFolders);
    const packageName = isSingleDb ? "@workspace/db" : `@workspace/db-${folderName}`;

    // Pass only the entities for this DB along with other non-entity nodes (for reference)
    const scopedNodes = [
      ...effectiveNodes.filter((n) => n.type !== "entity" && n.type !== "db_ref"),
      ...dbEntities,
    ];

    let pkgResult: CompiledDatabaseResult;

    switch (engine) {
      case "postgres":
        pkgResult = compilePostgresDatabase(scopedNodes, allEdges, {
          packageName,
          packageFolder: folderName,
          dbNode,
        });
        break;
      case "mysql":
        pkgResult = compileMysqlDatabase(scopedNodes, allEdges, {
          packageName,
          packageFolder: folderName,
          dbNode,
        });
        break;
      case "convex":
        pkgResult = compileConvexDatabase(scopedNodes, allEdges, {
          packageName,
          packageFolder: folderName,
          dbNode,
        });
        break;
      case "sqlite":
      default:
        pkgResult = compileRawSqliteDatabase(scopedNodes, allEdges, {
          packageName,
          packageFolder: folderName,
          dbNode,
        });
        break;
    }

    // Prefix files for top-level files array
    pkgResult.files.forEach((f) => {
      mergedFiles.push({
        filename: folderName ? `packages/db/${folderName}/${f.filename}` : `packages/db/${f.filename}`,
        language: f.language,
        content: f.content,
      });
    });

    packages.push({
      packageName,
      packageFolder: folderName,
      dbEngine: engine,
      databaseNodeId: dbNode.id,
      databaseLabel: dbNode.data?.label || folderName || "db",
      files: pkgResult.files,
      reusableFunctions: pkgResult.reusableFunctions,
    });

    mergedReusableFunctions.push(...pkgResult.reusableFunctions);
  });

  return {
    files: mergedFiles,
    packages,
    reusableFunctions: mergedReusableFunctions,
  };
}
