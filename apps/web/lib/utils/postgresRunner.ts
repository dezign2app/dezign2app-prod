import { sanitizeForConvex } from "@/lib/utils/convexSanitizer";
import {
  TestDbOperationPayload,
  TestDbOperationResult,
  CheckDbConnectionResult,
  SqlCommandPlan,
  JsonValue,
  isJsonObject,
} from "@/lib/database-runner";
import { planSqlCommand, extractTableName } from "@/lib/database-runner";
import { normalizeToPostgresType } from "@/lib/schema/columnTypes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PostgresConnectionConfig {
  host?: string;
  port?: number | string;
  connectionString?: string;
  connectionStringEnv?: string;
  connectionStringPooled?: string;
  connectionStringPooledEnv?: string;
  sslMode?: string;
  provider?: string;
  database?: string;
  user?: string;
  username?: string;
  password?: string;
}

export interface ExecutePostgresOptions {
  connection: PostgresConnectionConfig;
  entity?: { name?: string; schema?: string; columns?: Array<{ name?: string; type?: string; isPrimaryKey?: boolean; isPrimary?: boolean; primaryKey?: boolean }> };
  operation: TestDbOperationPayload["operation"];
  args: Record<string, unknown>;
  mode?: "live" | "sandbox";
}

export interface PostgresOperationResult {
  success: boolean;
  output?: JsonValue;
  rawSql?: string;
  durationMs?: number;
  error?: string;
  serverActive?: boolean;
}

// ---------------------------------------------------------------------------
// Connection string resolver
// ---------------------------------------------------------------------------

function resolveConnectionString(config: PostgresConnectionConfig): string {
  // 1. Explicit connection string takes highest precedence
  if (config.connectionString) return config.connectionString;
  if (config.connectionStringPooled) return config.connectionStringPooled;

  // 2. From node's explicit env var if set
  if (config.connectionStringEnv) {
    const envVal = process.env[config.connectionStringEnv];
    if (envVal) return envVal;
  }
  if (config.connectionStringPooledEnv) {
    const envVal = process.env[config.connectionStringPooledEnv];
    if (envVal) return envVal;
  }

  // 3. Fallback to DATABASE_URL if no explicit credentials were given
  const hasExplicitCredentials = Boolean(
    config.database || config.user || config.username || config.password
  );
  if (!hasExplicitCredentials && process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // 4. Build from parts
  const host = config.host || "localhost";
  const port = Number(config.port) || 5432;
  const db = config.database || "postgres";
  const user = config.user || config.username || "postgres";
  const pass = config.password !== undefined ? config.password : "postgres";

  const authPart = pass
    ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}`
    : encodeURIComponent(user);

  let url = `postgresql://${authPart}@${host}:${port}/${encodeURIComponent(db)}`;
  if (
    config.sslMode === "require" ||
    config.provider === "supabase" ||
    config.provider === "neon"
  ) {
    url += "?sslmode=require";
  }
  return url;
}

function isSslRequiredForConfig(config: PostgresConnectionConfig, connStr: string): boolean {
  return (
    config.sslMode === "require" ||
    config.provider === "supabase" ||
    config.provider === "neon" ||
    config.provider === "aws_rds" ||
    connStr.includes("sslmode=require") ||
    connStr.includes("neon.tech") ||
    connStr.includes("supabase.co") ||
    process.env.NODE_ENV === "production"
  );
}

// ---------------------------------------------------------------------------
// Ensure table exists (auto-create for live testing)
// ---------------------------------------------------------------------------
// Schema and Identifier Helper
// ---------------------------------------------------------------------------

/**
 * Resolves schema and table name.
 * If tableName includes a dot (e.g. "billing.users"), schema and table are parsed from it.
 * If schema isn't configured, defaults to "public" for backward compatibility.
 */
export function resolveTableAndSchema(
  rawTableName: string,
  explicitSchema?: string,
): { safeTable: string; targetSchema: string } {
  let table = (rawTableName || "").trim();
  let schema = (explicitSchema || "").trim();

  if (table.includes(".")) {
    const parts = table.split(".");
    if (!schema) {
      schema = parts[0] || "";
    }
    table = parts.slice(1).join(".");
  }

  const safeSchema =
    (schema || "public").replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() || "public";
  const safeTable = table.replace(/[^a-zA-Z0-9_]/g, "");

  return { safeTable, targetSchema: safeSchema };
}

async function ensurePostgresTable(
  client: import("pg").PoolClient,
  tableName: string,
  columns?: Array<{ name?: string; type?: string; isPrimaryKey?: boolean; isPrimary?: boolean; primaryKey?: boolean }>,
  schema?: string,
): Promise<void> {
  const { safeTable, targetSchema } = resolveTableAndSchema(tableName, schema);
  if (!safeTable) return;

  const checkRes = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE LOWER(table_name) = LOWER($1)
        AND table_schema = $2
    ) AS exists`,
    [safeTable, targetSchema],
  );
  const exists = checkRes.rows[0]?.exists;

  if (!exists) {
    const colDefs: string[] = [];
    if (columns && columns.length > 0) {
      for (const col of columns) {
        const colName = (col.name || "col").replace(/[^a-zA-Z0-9_]/g, "");
        const isPk = col.isPrimaryKey || col.isPrimary || col.primaryKey || colName === "id";
        const pgType = normalizeToPostgresType(col.type, isPk);
        colDefs.push(isPk ? `"${colName}" ${pgType} PRIMARY KEY` : `"${colName}" ${pgType}`);
      }
    }
    if (!colDefs.some((d) => d.includes("PRIMARY KEY"))) {
      colDefs.unshift(`"id" TEXT PRIMARY KEY`);
    }
    if (!colDefs.some((d) => d.startsWith('"created_at"'))) {
      colDefs.push(`"created_at" TIMESTAMPTZ DEFAULT NOW()`);
    }
    if (!colDefs.some((d) => d.startsWith('"updated_at"'))) {
      colDefs.push(`"updated_at" TIMESTAMPTZ DEFAULT NOW()`);
    }

    if (targetSchema && targetSchema !== "public") {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${targetSchema}"`);
    }

    await client.query(
      `CREATE TABLE IF NOT EXISTS "${targetSchema}"."${safeTable}" (${colDefs.join(", ")})`,
    );
  } else if (columns && columns.length > 0) {
    // Auto-add missing columns
    const infoRes = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns 
       WHERE LOWER(table_name) = LOWER($1)
         AND table_schema = $2`,
      [safeTable, targetSchema],
    );
    const existingCols = new Set(infoRes.rows.map((r) => r.column_name.toLowerCase()));
    for (const col of columns) {
      const colName = (col.name || "").replace(/[^a-zA-Z0-9_]/g, "");
      if (!colName || existingCols.has(colName.toLowerCase())) continue;
      const pgType = normalizeToPostgresType(col.type);
      try {
        await client.query(
          `ALTER TABLE "${targetSchema}"."${safeTable}" ADD COLUMN IF NOT EXISTS "${colName}" ${pgType}`,
        );
      } catch {
        // Column may already exist in a race condition
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Execute a formatted SQL string (for live test runner)
// ---------------------------------------------------------------------------

async function executeRawSql(
  client: import("pg").PoolClient,
  sql: string,
  params: unknown[],
): Promise<{ rows: Record<string, unknown>[]; rowCount: number }> {
  const res = await client.query(sql, params as import("pg").QueryConfigValues<unknown[]>);
  return {
    rows: (res.rows as Record<string, unknown>[]),
    rowCount: res.rowCount ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Main live execution entry point
// ---------------------------------------------------------------------------

export async function executePostgresLiveOperation(
  opts: ExecutePostgresOptions,
): Promise<PostgresOperationResult> {
  // Dynamically import `pg` to avoid bundling issues in non-server contexts
  const { Pool } = await import("pg");
  const connectionString = resolveConnectionString(opts.connection);
  const rawTableName = opts.entity?.name || extractTableName(opts.operation);
  const { safeTable, targetSchema: hintedSchema } = resolveTableAndSchema(rawTableName, opts.entity?.schema);
  const tableName = safeTable || "record";
  const start = performance.now();

  const pool = new Pool({
    connectionString,
    max: 3,
    ssl: isSslRequiredForConfig(opts.connection, connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
  });

  let client: import("pg").PoolClient | undefined;
  try {
    client = await pool.connect();

    // 1. Discover the real schema and exact table name casing.
    //    Query information_schema.tables, skipping Supabase/system schemas.
    let resolvedSchema = hintedSchema;
    let actualTableName = safeTable;

    const discoverRes = await client.query<{ table_schema: string; table_name: string }>(
      `SELECT table_schema, table_name FROM information_schema.tables
       WHERE LOWER(table_name) = LOWER($1)
         AND table_schema NOT IN (
           'information_schema','pg_catalog','pg_toast',
           'auth','storage','realtime','supabase_functions','vault','extensions'
         )
       ORDER BY (table_schema = 'public') DESC, table_schema`,
      [safeTable],
    );
    if (discoverRes.rows.length > 0) {
      const publicRow = discoverRes.rows.find((r) => r.table_schema === "public");
      const matched = publicRow ?? discoverRes.rows[0];
      if (matched) {
        resolvedSchema = matched.table_schema || hintedSchema;
        actualTableName = matched.table_name || safeTable;
      }
    }

    const qualifiedTable = `"${resolvedSchema}"."${actualTableName}"`;

    // 2. Ensure table exists so test always has a target to operate on
    await ensurePostgresTable(client, actualTableName, opts.entity?.columns, resolvedSchema);

    // 3. Determine the SQL to run
    const op = opts.operation;
    const args = opts.args || {};

    let rawSql = "";
    let params: unknown[] = [];
    let output: unknown;

    // If the operation has explicit SQL code or query, extract & execute it
    const opCode = (op.code || "").trim();
    const opQuery = (op.query || "").trim();
    const queryMatch = opCode.match(
      /query(?:<[^>]+>)?\s*\(\s*(['"`])([\s\S]*?)\1\s*(?:,\s*\[([\s\S]*?)\])?\s*\)/m,
    );

    if (
      opQuery &&
      !opQuery.startsWith("Query function for") &&
      !opQuery.startsWith("Auto-generated")
    ) {
      rawSql = opQuery;
    } else if (
      opCode &&
      /^\s*(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|ALTER|DROP)\b/i.test(opCode)
    ) {
      rawSql = opCode;
    } else if (
      queryMatch &&
      queryMatch[2] &&
      /^\s*(SELECT|INSERT|UPDATE|DELETE)\b/i.test(queryMatch[2].trim())
    ) {
      rawSql = queryMatch[2].trim();
    } else {
      // Generate SQL from operation kind + args, then qualify the table name.
      // planSqlCommand uses the unqualified table name internally — replace it
      // with the schema-qualified form so Supabase / custom-schema DBs resolve correctly.
      const plan = planSqlCommand(op, args, "postgres");
      rawSql = plan.rawSql.replaceAll(`"${safeTable}"`, qualifiedTable);
    }

    // Align table name in rawSql with the actual discovered table in the database.
    // Replace any quoted case variations (e.g. "user", "User", "public"."user")
    // with the real database schema and table name (e.g. "public"."User").
    const escapedSchema = (resolvedSchema || "public").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedTable = safeTable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedActual = actualTableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    rawSql = rawSql.replace(
      new RegExp(`"(${escapedSchema}|public)"\\."(${escapedTable}|${escapedActual})"`, "gi"),
      qualifiedTable,
    );
    rawSql = rawSql.replace(
      new RegExp(`"(${escapedTable}|${escapedActual})"`, "gi"),
      qualifiedTable,
    );

    // Build parameterized query: replace literal values with $N params when we can
    // For sandbox-generated SQL (has quoted literals), run as-is
    // For parameterized queries already using $1, pass args as params array
    if (rawSql.includes("$1")) {
      // Check if opCode had an explicit query('...', [...]) call with argument variable names
      const explicitArgs = queryMatch && queryMatch[3]
        ? queryMatch[3]
            .split(",")
            .map((s) => s.trim().replace(/^data\./, ""))
            .filter(Boolean)
        : [];

      // Extract payload object from args
      let payloadObj: Record<string, unknown> = {};
      Object.keys(args).forEach((k) => {
        const val = args[k];
        if (typeof val === "object" && val !== null && !Array.isArray(val)) {
          payloadObj = { ...payloadObj, ...(val as Record<string, unknown>) };
        } else {
          payloadObj[k] = val;
        }
      });

      // If rawSql had a query like INSERT INTO ... ("id") VALUES ($1), and payload has id:
      // Match columns in the SQL or fall back to positional params
      const colMatch = rawSql.match(/\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (colMatch && colMatch[1]) {
        const colsInSql = colMatch[1]
          .split(",")
          .map((c) => c.replace(/["`\s]/g, ""));
        params = colsInSql.map((colName) => {
          if (colName.toLowerCase() === "id") {
            return (
              payloadObj["id"] ??
              args["id"] ??
              payloadObj["_id"] ??
              args["_id"] ??
              (typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `${tableName}_${Date.now().toString(36)}`)
            );
          }
          return payloadObj[colName] ?? args[colName] ?? null;
        });
      } else if (explicitArgs.length > 0) {
        params = explicitArgs.map((rawArg) => {
          const cleanArg = rawArg
            .trim()
            .replace(/^data\./, "")
            .replace(/\s*\?\?.*$/, "")
            .replace(/\s*\|\|.*$/, "")
            .trim();

          if (cleanArg === "_id" || cleanArg === "_rowId" || cleanArg === "id") {
            return (
              payloadObj["id"] ??
              args["id"] ??
              payloadObj["_id"] ??
              args["_id"] ??
              (typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `${tableName}_${Date.now().toString(36)}`)
            );
          }
          if (cleanArg === "limit") return args.limit !== undefined ? Number(args.limit) : 20;
          if (cleanArg === "offset") return args.offset !== undefined ? Number(args.offset) : 0;
          if (args[cleanArg] !== undefined) return args[cleanArg];
          if (payloadObj[cleanArg] !== undefined) return payloadObj[cleanArg];
          return null;
        });
      } else {
        const opParams = op.params || [];
        params = [];
        for (const p of opParams) {
          if (p.name.startsWith("{") && p.name.endsWith("}")) {
            const inner = p.name
              .slice(1, -1)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            for (const k of inner) {
              params.push(payloadObj[k] ?? args[k] ?? null);
            }
          } else {
            params.push(args[p.name] ?? payloadObj[p.name] ?? null);
          }
        }
      }

      // Fill in any trailing parameters (such as LIMIT $2 OFFSET $3)
      const placeholderMatches = rawSql.match(/\$\d+/g) || [];
      const maxPlaceholderIndex = placeholderMatches.reduce((max, ph) => {
        const idx = parseInt(ph.slice(1), 10);
        return Math.max(max, isNaN(idx) ? 0 : idx);
      }, 0);

      while (params.length < maxPlaceholderIndex) {
        const missingIndex = params.length + 1;
        if (rawSql.includes(`LIMIT $${missingIndex}`)) {
          params.push(args.limit !== undefined ? Number(args.limit) : 20);
        } else if (rawSql.includes(`OFFSET $${missingIndex}`)) {
          params.push(args.offset !== undefined ? Number(args.offset) : 0);
        } else {
          params.push(null);
        }
      }
    } else {
      // Execute the raw SQL directly (from sandbox planner)
      params = [];
    }

    const result = await executeRawSql(client, rawSql, params);
    const durationMs = Math.round((performance.now() - start) * 100) / 100;

    const kind = op.kind || "";
    const name = op.name || "";
    const isFindAllLike =
      kind === "findAll" ||
      kind === "fetchByIndex" ||
      name.toLowerCase().startsWith("findall") ||
      name.toLowerCase().startsWith("getall") ||
      name.toLowerCase().startsWith("list");

    if (kind === "delete") {
      output = { success: true, message: "Record deleted successfully", deletedCount: result.rowCount };
    } else if (result.rows.length === 1 && (kind === "findById" || kind === "create" || kind === "update" || kind === "upsert") && !isFindAllLike) {
      output = result.rows[0];
    } else if (isFindAllLike) {
      output = result.rows;
    } else {
      output = result.rows.length > 0 ? result.rows : result.rows;
    }

    return {
      success: true,
      serverActive: true,
      output: sanitizeForConvex(output) as JsonValue,
      rawSql,
      durationMs: Math.max(0.5, durationMs),
    };
  } catch (error) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    const errMsg = error instanceof Error ? error.message : String(error);

    const isConnectionError =
      errMsg.includes("ECONNREFUSED") ||
      errMsg.includes("connect ETIMEDOUT") ||
      errMsg.includes("Connection refused") ||
      errMsg.includes("could not connect") ||
      errMsg.includes("connection timeout") ||
      errMsg.includes("getaddrinfo ENOTFOUND");

    return {
      success: false,
      serverActive: !isConnectionError,
      error: errMsg,
      durationMs: Math.max(0.5, durationMs),
    };
  } finally {
    if (client) client.release();
    await pool.end().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Connection check
// ---------------------------------------------------------------------------

export async function checkPostgresConnection(
  connection: PostgresConnectionConfig,
): Promise<CheckDbConnectionResult> {
  const { Pool } = await import("pg");
  const connectionString = resolveConnectionString(connection);
  const start = performance.now();

  const pool = new Pool({
    connectionString,
    max: 1,
    ssl: isSslRequiredForConfig(connection, connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
  });

  let client: import("pg").PoolClient | undefined;
  try {
    client = await pool.connect();
    const res = await client.query<{
      version: string;
      current_database: string;
      pg_database_size: string;
    }>(
      `SELECT version(), current_database(), pg_database_size(current_database())`,
    );
    const row = res.rows[0];
    const latencyMs = Math.round(performance.now() - start);

    // Extract short version string: "PostgreSQL 16.2 on ..."
    const versionMatch = (row?.version || "").match(/PostgreSQL\s+([\d.]+)/i);
    const shortVersion = versionMatch ? `PostgreSQL ${versionMatch[1]}` : row?.version || "PostgreSQL";

    return {
      success: true,
      engine: "postgres",
      latencyMs,
      connectionUri: connectionString.replace(/:([^:@]+)@/, ":***@"),
      info: {
        version: shortVersion,
        rawVersion: row?.version,
        status: "connected",
        reachable: true,
      },
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);
    const errMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      engine: "postgres",
      latencyMs,
      error: errMsg,
      info: { reachable: false, status: "unreachable" },
    };
  } finally {
    if (client) client.release();
    await pool.end().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Table Schema Sync & Drift Detection
// ---------------------------------------------------------------------------

export interface PostgresTableSyncResult {
  success: boolean;
  serverReachable: boolean;
  tableExists: boolean;
  inSync: boolean;
  missingColumns: Array<{ name: string; type: string }>;
  extraColumns: Array<{ name: string; type: string }>;
  existingColumns: Array<{ name: string; type: string }>;
  missingIndexes?: Array<{ name: string; columns: string; isUnique?: boolean }>;
  extraIndexes?: Array<{ name: string; columns: string; isUnique?: boolean }>;
  existingIndexes?: Array<{ name: string; columns: string; isUnique?: boolean }>;
  error?: string;
}

export interface PostgresApplySyncResult {
  success: boolean;
  createdTable: boolean;
  appliedColumns: string[];
  droppedColumns?: string[];
  appliedIndexes?: string[];
  droppedIndexes?: string[];
  error?: string;
}

/**
 * Checks whether a canvas table entity exists in the live PostgreSQL database
 * and identifies missing or extra columns/indexes (schema drift).
 */
export async function checkPostgresTableSync(
  connection: PostgresConnectionConfig,
  tableName: string,
  columns?: Array<{ name?: string; type?: string; isPrimaryKey?: boolean; isNotNull?: boolean; isUnique?: boolean }>,
  schema?: string,
  indexes?: Array<{ name: string; columns: string; isUnique?: boolean }>,
): Promise<PostgresTableSyncResult> {
  const { Pool } = await import("pg");
  const connectionString = resolveConnectionString(connection);
  const { safeTable, targetSchema } = resolveTableAndSchema(tableName, schema);

  const validCanvasIndexes = (indexes || [])
    .filter((i) => (i.name || "").trim().length > 0 && (i.columns || "").trim().length > 0)
    .map((i) => ({
      name: i.name.trim(),
      columns: i.columns.trim(),
      isUnique: Boolean(i.isUnique),
    }));

  if (!safeTable) {
    return {
      success: false,
      serverReachable: false,
      tableExists: false,
      inSync: false,
      missingColumns: [],
      extraColumns: [],
      existingColumns: [],
      missingIndexes: validCanvasIndexes,
      extraIndexes: [],
      existingIndexes: [],
      error: "Invalid table name",
    };
  }

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5000,
    ssl:
      connectionString.includes("sslmode=require") ||
      connectionString.includes("neon.tech") ||
      connectionString.includes("supabase.co") ||
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined,
  });

  let client: import("pg").PoolClient | undefined;
  try {
    client = await pool.connect();

    // Check if table exists in the configured schema
    const checkRes = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE LOWER(table_name) = LOWER($1)
          AND table_schema = $2
      ) AS exists`,
      [safeTable, targetSchema],
    );
    const tableExists = Boolean(checkRes.rows[0]?.exists);

    const canvasCols = (columns || []).map((c) => ({
      name: c.name || "col",
      type: c.type || "string",
    }));

    if (!tableExists) {
      return {
        success: true,
        serverReachable: true,
        tableExists: false,
        inSync: false,
        missingColumns: canvasCols,
        extraColumns: [],
        existingColumns: [],
        missingIndexes: validCanvasIndexes,
        extraIndexes: [],
        existingIndexes: [],
      };
    }

    // Table exists, query existing columns from the configured schema
    const colsRes = await client.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE LOWER(table_name) = LOWER($1)
         AND table_schema = $2`,
      [safeTable, targetSchema],
    );

    const existingColumns = colsRes.rows.map((r) => ({
      name: r.column_name,
      type: r.data_type,
    }));
    const existingColMap = new Map(
      colsRes.rows.map((r) => [r.column_name.toLowerCase(), r.data_type]),
    );

    const missingColumns = canvasCols.filter(
      (c) => !existingColMap.has(c.name.toLowerCase()),
    );

    const canvasColNames = new Set(canvasCols.map((c) => c.name.toLowerCase()));
    const extraColumns = existingColumns.filter(
      (c) =>
        !canvasColNames.has(c.name.toLowerCase()) &&
        c.name.toLowerCase() !== "created_at" &&
        c.name.toLowerCase() !== "updated_at",
    );

    // Query existing non-primary standalone indexes
    let existingIndexes: Array<{ name: string; columns: string; isUnique?: boolean }> = [];
    try {
      const idxRes = await client.query<{
        index_name: string;
        is_unique: boolean;
        column_names: string;
      }>(
        `SELECT
           i.relname AS index_name,
           ix.indisunique AS is_unique,
           ARRAY_TO_STRING(
             ARRAY(
               SELECT pg_get_indexdef(ix.indexrelid, k + 1, true)
               FROM generate_series(0, ix.indnatts - 1) as k
             ),
             ', '
           ) AS column_names
         FROM pg_class t
         JOIN pg_namespace n ON n.oid = t.relnamespace
         JOIN pg_index ix ON ix.indrelid = t.oid
         JOIN pg_class i ON i.oid = ix.indexrelid
         WHERE LOWER(t.relname) = LOWER($1)
           AND n.nspname = $2
           AND NOT ix.indisprimary
           AND i.oid NOT IN (
             SELECT conindid 
             FROM pg_constraint 
             WHERE conrelid = t.oid AND conindid > 0
           )`,
        [safeTable, targetSchema],
      );

      existingIndexes = (idxRes.rows || []).map((r) => ({
        name: r.index_name,
        columns: r.column_names,
        isUnique: Boolean(r.is_unique),
      }));
    } catch {
      existingIndexes = [];
    }

    const missingIndexes = validCanvasIndexes.filter((cIdx) => {
      const cName = cIdx.name.toLowerCase();
      const cCols = (cIdx.columns || "")
        .split(",")
        .map((c) => c.trim().replace(/^["'`]|["'`]$/g, "").toLowerCase())
        .filter(Boolean)
        .join(",");
      return !existingIndexes.some((dbIdx) => {
        const dbName = dbIdx.name.toLowerCase();
        const dbCols = (dbIdx.columns || "")
          .split(",")
          .map((c) => c.trim().replace(/^["'`]|["'`]$/g, "").toLowerCase())
          .filter(Boolean)
          .join(",");
        return (
          (dbName === cName && dbCols === cCols && Boolean(dbIdx.isUnique) === Boolean(cIdx.isUnique)) ||
          (dbCols === cCols && Boolean(dbIdx.isUnique) === Boolean(cIdx.isUnique))
        );
      });
    });

    const extraIndexes = existingIndexes.filter((dbIdx) => {
      const dbName = dbIdx.name.toLowerCase();
      const dbCols = (dbIdx.columns || "")
        .split(",")
        .map((c) => c.trim().replace(/^["'`]|["'`]$/g, "").toLowerCase())
        .filter(Boolean)
        .join(",");
      return !validCanvasIndexes.some((cIdx) => {
        const cName = cIdx.name.toLowerCase();
        const cCols = (cIdx.columns || "")
          .split(",")
          .map((c) => c.trim().replace(/^["'`]|["'`]$/g, "").toLowerCase())
          .filter(Boolean)
          .join(",");
        return (
          (dbName === cName && dbCols === cCols && Boolean(dbIdx.isUnique) === Boolean(cIdx.isUnique)) ||
          (dbCols === cCols && Boolean(dbIdx.isUnique) === Boolean(cIdx.isUnique))
        );
      });
    });

    const inSync =
      missingColumns.length === 0 &&
      extraColumns.length === 0 &&
      missingIndexes.length === 0 &&
      extraIndexes.length === 0;

    return {
      success: true,
      serverReachable: true,
      tableExists: true,
      inSync,
      missingColumns,
      extraColumns,
      existingColumns,
      missingIndexes,
      extraIndexes,
      existingIndexes,
    };
  } catch (error) {
    return {
      success: false,
      serverReachable: false,
      tableExists: false,
      inSync: false,
      missingColumns: [],
      extraColumns: [],
      existingColumns: [],
      missingIndexes: [],
      extraIndexes: [],
      existingIndexes: [],
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (client) client.release();
    await pool.end().catch(() => {});
  }
}

/**
 * Applies missing table or missing columns/indexes to the live PostgreSQL database,
 * and drops columns/indexes deleted from the canvas.
 */
export async function applyPostgresTableSync(
  connection: PostgresConnectionConfig,
  tableName: string,
  columns?: Array<{ name?: string; type?: string; isPrimaryKey?: boolean; isNotNull?: boolean; isUnique?: boolean }>,
  schema?: string,
  indexes?: Array<{ name: string; columns: string; isUnique?: boolean }>,
): Promise<PostgresApplySyncResult> {
  const { Pool } = await import("pg");
  const connectionString = resolveConnectionString(connection);
  const { safeTable, targetSchema } = resolveTableAndSchema(tableName, schema);

  const validCanvasIndexes = (indexes || [])
    .filter((i) => (i.name || "").trim().length > 0 && (i.columns || "").trim().length > 0)
    .map((i) => ({
      name: i.name.trim(),
      columns: i.columns.trim(),
      isUnique: Boolean(i.isUnique),
    }));

  if (!safeTable) {
    return {
      success: false,
      createdTable: false,
      appliedColumns: [],
      error: "Invalid table name",
    };
  }

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 6000,
    ssl: isSslRequiredForConfig(connection, connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
  });

  let client: import("pg").PoolClient | undefined;
  try {
    client = await pool.connect();

    // Check if table exists in the configured schema
    const checkRes = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE LOWER(table_name) = LOWER($1)
          AND table_schema = $2
      ) AS exists`,
      [safeTable, targetSchema],
    );
    const tableExists = Boolean(checkRes.rows[0]?.exists);

    if (!tableExists) {
      await ensurePostgresTable(client, safeTable, columns, targetSchema);
      const appliedIndexes: string[] = [];
      for (const idx of validCanvasIndexes) {
        const safeIdxName = idx.name.replace(/[^a-zA-Z0-9_]/g, "");
        const colList = idx.columns
          .split(",")
          .map((c) => `"${c.trim().replace(/[^a-zA-Z0-9_]/g, "")}"`)
          .join(", ");
        if (safeIdxName && colList) {
          const uniqueStr = idx.isUnique ? "UNIQUE " : "";
          try {
            await client.query(
              `CREATE ${uniqueStr}INDEX IF NOT EXISTS "${safeIdxName}" ON "${targetSchema}"."${safeTable}" (${colList})`
            );
            appliedIndexes.push(safeIdxName);
          } catch {}
        }
      }

      return {
        success: true,
        createdTable: true,
        appliedColumns: (columns || []).map((c) => c.name || "col"),
        appliedIndexes,
      };
    }

    // Inspect existing indexes
    let existingIndexes: Array<{ name: string; columns: string; isUnique?: boolean }> = [];
    try {
      const idxRes = await client.query<{
        index_name: string;
        is_unique: boolean;
        column_names: string;
      }>(
        `SELECT
           i.relname AS index_name,
           ix.indisunique AS is_unique,
           ARRAY_TO_STRING(
             ARRAY(
               SELECT pg_get_indexdef(ix.indexrelid, k + 1, true)
               FROM generate_series(0, ix.indnatts - 1) as k
             ),
             ', '
           ) AS column_names
         FROM pg_class t
         JOIN pg_namespace n ON n.oid = t.relnamespace
         JOIN pg_index ix ON ix.indrelid = t.oid
         JOIN pg_class i ON i.oid = ix.indexrelid
         WHERE LOWER(t.relname) = LOWER($1)
           AND n.nspname = $2
           AND NOT ix.indisprimary
           AND i.oid NOT IN (
             SELECT conindid 
             FROM pg_constraint 
             WHERE conrelid = t.oid AND conindid > 0
           )`,
        [safeTable, targetSchema],
      );

      existingIndexes = (idxRes.rows || []).map((r) => ({
        name: r.index_name,
        columns: r.column_names,
        isUnique: Boolean(r.is_unique),
      }));
    } catch {
      existingIndexes = [];
    }

    const missingIndexes = validCanvasIndexes.filter((cIdx) => {
      const cName = cIdx.name.toLowerCase();
      const cCols = (cIdx.columns || "")
        .split(",")
        .map((c) => c.trim().replace(/^["'`]|["'`]$/g, "").toLowerCase())
        .filter(Boolean)
        .join(",");
      return !existingIndexes.some((dbIdx) => {
        const dbName = dbIdx.name.toLowerCase();
        const dbCols = (dbIdx.columns || "")
          .split(",")
          .map((c) => c.trim().replace(/^["'`]|["'`]$/g, "").toLowerCase())
          .filter(Boolean)
          .join(",");
        return (
          (dbName === cName && dbCols === cCols && Boolean(dbIdx.isUnique) === Boolean(cIdx.isUnique)) ||
          (dbCols === cCols && Boolean(dbIdx.isUnique) === Boolean(cIdx.isUnique))
        );
      });
    });

    const extraIndexes = existingIndexes.filter((dbIdx) => {
      const dbName = dbIdx.name.toLowerCase();
      const dbCols = (dbIdx.columns || "")
        .split(",")
        .map((c) => c.trim().replace(/^["'`]|["'`]$/g, "").toLowerCase())
        .filter(Boolean)
        .join(",");
      return !validCanvasIndexes.some((cIdx) => {
        const cName = cIdx.name.toLowerCase();
        const cCols = (cIdx.columns || "")
          .split(",")
          .map((c) => c.trim().replace(/^["'`]|["'`]$/g, "").toLowerCase())
          .filter(Boolean)
          .join(",");
        return (
          (dbName === cName && dbCols === cCols && Boolean(dbIdx.isUnique) === Boolean(cIdx.isUnique)) ||
          (dbCols === cCols && Boolean(dbIdx.isUnique) === Boolean(cIdx.isUnique))
        );
      });
    });

    const droppedIndexes: string[] = [];
    for (const extraIdx of extraIndexes) {
      const safeIdxName = extraIdx.name.replace(/[^a-zA-Z0-9_]/g, "");
      if (safeIdxName) {
        try {
          await client.query(`DROP INDEX IF EXISTS "${targetSchema}"."${safeIdxName}" CASCADE`);
          droppedIndexes.push(safeIdxName);
        } catch {}
      }
    }

    // Table exists, query existing columns from the configured schema
    const infoRes = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns 
       WHERE LOWER(table_name) = LOWER($1)
         AND table_schema = $2`,
      [safeTable, targetSchema],
    );
    const existingCols = new Set(infoRes.rows.map((r) => r.column_name.toLowerCase()));
    const canvasColNames = new Set((columns || []).map((c) => (c.name || "").toLowerCase()));
    const appliedColumns: string[] = [];
    const droppedColumns: string[] = [];

    // 1. Add missing columns
    for (const col of columns || []) {
      const colName = (col.name || "").replace(/[^a-zA-Z0-9_]/g, "");
      if (!colName || existingCols.has(colName.toLowerCase())) continue;
      const pgType = normalizeToPostgresType(col.type);

      await client.query(
        `ALTER TABLE "${targetSchema}"."${safeTable}" ADD COLUMN IF NOT EXISTS "${colName}" ${pgType}`,
      );
      appliedColumns.push(colName);
    }

    // 2. Drop columns that were removed from the canvas
    for (const row of infoRes.rows) {
      const dbColLower = row.column_name.toLowerCase();
      if (
        !canvasColNames.has(dbColLower) &&
        dbColLower !== "created_at" &&
        dbColLower !== "updated_at"
      ) {
        await client.query(
          `ALTER TABLE "${targetSchema}"."${safeTable}" DROP COLUMN IF EXISTS "${row.column_name}" CASCADE`,
        );
        droppedColumns.push(row.column_name);
      }
    }

    // 3. Create missing indexes
    const appliedIndexes: string[] = [];
    for (const missingIdx of missingIndexes) {
      const safeIdxName = missingIdx.name.replace(/[^a-zA-Z0-9_]/g, "");
      const colList = missingIdx.columns
        .split(",")
        .map((c) => `"${c.trim().replace(/[^a-zA-Z0-9_]/g, "")}"`)
        .join(", ");
      if (safeIdxName && colList) {
        const uniqueStr = missingIdx.isUnique ? "UNIQUE " : "";
        try {
          await client.query(
            `CREATE ${uniqueStr}INDEX IF NOT EXISTS "${safeIdxName}" ON "${targetSchema}"."${safeTable}" (${colList})`
          );
          appliedIndexes.push(safeIdxName);
        } catch {}
      }
    }

    return {
      success: true,
      createdTable: false,
      appliedColumns,
      droppedColumns,
      appliedIndexes,
      droppedIndexes,
    };
  } catch (error) {
    return {
      success: false,
      createdTable: false,
      appliedColumns: [],
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (client) client.release();
    await pool.end().catch(() => {});
  }
}

export interface PostgresDropTableResult {
  success: boolean;
  droppedTable: string;
  error?: string;
}

/**
 * Drops a physical table and dependent foreign keys from the live PostgreSQL database.
 */
export async function dropPostgresTable(
  connection: PostgresConnectionConfig,
  tableName: string,
  schema?: string,
): Promise<PostgresDropTableResult> {
  const { Pool } = await import("pg");
  const connectionString = resolveConnectionString(connection);
  const { safeTable, targetSchema } = resolveTableAndSchema(tableName, schema);

  if (!safeTable) {
    return {
      success: false,
      droppedTable: tableName,
      error: "Invalid table name",
    };
  }

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 6000,
    ssl:
      connectionString.includes("sslmode=require") ||
      connectionString.includes("neon.tech") ||
      connectionString.includes("supabase.co") ||
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined,
  });

  let client: import("pg").PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query(`DROP TABLE IF EXISTS "${targetSchema}"."${safeTable}" CASCADE`);
    return {
      success: true,
      droppedTable: safeTable,
    };
  } catch (error) {
    return {
      success: false,
      droppedTable: safeTable,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (client) client.release();
    await pool.end().catch(() => {});
  }
}

export interface PostgresRenameTableResult {
  success: boolean;
  oldTableName: string;
  newTableName: string;
  error?: string;
}

/**
 * Renames a physical table in the live PostgreSQL database.
 */
export async function renamePostgresTable(
  connection: PostgresConnectionConfig,
  oldTableName: string,
  newTableName: string,
  schema?: string,
): Promise<PostgresRenameTableResult> {
  const { Pool } = await import("pg");
  const connectionString = resolveConnectionString(connection);
  const { safeTable: safeOld, targetSchema } = resolveTableAndSchema(oldTableName, schema);
  const { safeTable: safeNew } = resolveTableAndSchema(newTableName, targetSchema);

  if (!safeOld || !safeNew) {
    return {
      success: false,
      oldTableName,
      newTableName,
      error: "Invalid table name",
    };
  }

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 6000,
    ssl:
      connectionString.includes("sslmode=require") ||
      connectionString.includes("neon.tech") ||
      connectionString.includes("supabase.co") ||
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined,
  });

  let client: import("pg").PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query(`ALTER TABLE "${targetSchema}"."${safeOld}" RENAME TO "${safeNew}"`);
    return {
      success: true,
      oldTableName: safeOld,
      newTableName: safeNew,
    };
  } catch (error) {
    return {
      success: false,
      oldTableName: safeOld,
      newTableName: safeNew,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (client) client.release();
    await pool.end().catch(() => {});
  }
}

export interface PostgresRenameColumnResult {
  success: boolean;
  tableName: string;
  oldColumnName: string;
  newColumnName: string;
  error?: string;
}

/**
 * Renames a physical column in the live PostgreSQL database.
 */
export async function renamePostgresColumn(
  connection: PostgresConnectionConfig,
  tableName: string,
  oldColumnName: string,
  newColumnName: string,
  schema?: string,
): Promise<PostgresRenameColumnResult> {
  const { Pool } = await import("pg");
  const connectionString = resolveConnectionString(connection);
  const { safeTable, targetSchema } = resolveTableAndSchema(tableName, schema);
  const safeOldCol = oldColumnName.replace(/[^a-zA-Z0-9_]/g, "");
  const safeNewCol = newColumnName.replace(/[^a-zA-Z0-9_]/g, "");

  if (!safeTable || !safeOldCol || !safeNewCol) {
    return {
      success: false,
      tableName,
      oldColumnName,
      newColumnName,
      error: "Invalid identifier for table or column",
    };
  }

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 6000,
    ssl:
      connectionString.includes("sslmode=require") ||
      connectionString.includes("neon.tech") ||
      connectionString.includes("supabase.co") ||
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined,
  });

  let client: import("pg").PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query(
      `ALTER TABLE "${targetSchema}"."${safeTable}" RENAME COLUMN "${safeOldCol}" TO "${safeNewCol}"`,
    );
    return {
      success: true,
      tableName: safeTable,
      oldColumnName: safeOldCol,
      newColumnName: safeNewCol,
    };
  } catch (error) {
    return {
      success: false,
      tableName: safeTable,
      oldColumnName: safeOldCol,
      newColumnName: safeNewCol,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (client) client.release();
    await pool.end().catch(() => {});
  }
}

