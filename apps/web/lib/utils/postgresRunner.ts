"use server";

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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PostgresConnectionConfig {
  host?: string;
  port?: number | string;
  connectionString?: string;
  connectionStringEnv?: string;
  database?: string;
  user?: string;
  username?: string;
  password?: string;
}

export interface ExecutePostgresOptions {
  connection: PostgresConnectionConfig;
  entity?: { name?: string; columns?: Array<{ name?: string; type?: string; isPrimaryKey?: boolean; isPrimary?: boolean; primaryKey?: boolean }> };
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

  // 2. From node's explicit env var if set
  if (config.connectionStringEnv) {
    const envVal = process.env[config.connectionStringEnv];
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

  return `postgresql://${authPart}@${host}:${port}/${encodeURIComponent(db)}`;
}

// ---------------------------------------------------------------------------
// Ensure table exists (auto-create for live testing)
// ---------------------------------------------------------------------------

async function ensurePostgresTable(
  client: import("pg").PoolClient,
  tableName: string,
  columns?: Array<{ name?: string; type?: string; isPrimaryKey?: boolean; isPrimary?: boolean; primaryKey?: boolean }>,
): Promise<void> {
  const safeTable = tableName.replace(/[^a-zA-Z0-9_]/g, "");
  if (!safeTable) return;

  const checkRes = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1) AS exists`,
    [safeTable],
  );
  const exists = checkRes.rows[0]?.exists;

  if (!exists) {
    const colDefs: string[] = [];
    if (columns && columns.length > 0) {
      for (const col of columns) {
        const colName = (col.name || "col").replace(/[^a-zA-Z0-9_]/g, "");
        const isPk = col.isPrimaryKey || col.isPrimary || col.primaryKey || colName === "id";
        const t = (col.type || "string").toLowerCase();
        let pgType = "TEXT";
        if (t === "number" || t === "int" || t === "integer") pgType = "INTEGER";
        else if (t === "bigint") pgType = "BIGINT";
        else if (t === "float" || t === "double" || t === "decimal") pgType = "DOUBLE PRECISION";
        else if (t === "boolean" || t === "bool") pgType = "BOOLEAN";
        else if (t === "timestamp" || t === "datetime") pgType = "TIMESTAMPTZ";
        else if (t === "json" || t === "object" || t === "jsonb") pgType = "JSONB";
        colDefs.push(isPk ? `"${colName}" ${pgType} PRIMARY KEY` : `"${colName}" ${pgType}`);
      }
    }
    if (!colDefs.some((d) => d.includes("PRIMARY KEY"))) {
      colDefs.unshift(`"id" TEXT PRIMARY KEY`);
    }
    if (!colDefs.some((d) => d.startsWith('"created_at"'))) {
      colDefs.push(`"created_at" TIMESTAMPTZ DEFAULT NOW()`);
    }
    await client.query(
      `CREATE TABLE IF NOT EXISTS "${safeTable}" (${colDefs.join(", ")})`,
    );
  } else if (columns && columns.length > 0) {
    // Auto-add missing columns
    const infoRes = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [safeTable],
    );
    const existingCols = new Set(infoRes.rows.map((r) => r.column_name.toLowerCase()));
    for (const col of columns) {
      const colName = (col.name || "").replace(/[^a-zA-Z0-9_]/g, "");
      if (!colName || existingCols.has(colName.toLowerCase())) continue;
      const t = (col.type || "string").toLowerCase();
      let pgType = "TEXT";
      if (t === "number" || t === "int" || t === "integer") pgType = "INTEGER";
      else if (t === "bigint") pgType = "BIGINT";
      else if (t === "boolean" || t === "bool") pgType = "BOOLEAN";
      else if (t === "timestamp" || t === "datetime") pgType = "TIMESTAMPTZ";
      else if (t === "json" || t === "object" || t === "jsonb") pgType = "JSONB";
      try {
        await client.query(
          `ALTER TABLE "${safeTable}" ADD COLUMN IF NOT EXISTS "${colName}" ${pgType}`,
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
  const tableName = opts.entity?.name || extractTableName(opts.operation);
  const start = performance.now();

  const pool = new Pool({
    connectionString,
    max: 3,
    connectionTimeoutMillis: 5000,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });

  let client: import("pg").PoolClient | undefined;
  try {
    client = await pool.connect();

    // 1. Ensure table exists so test always has a target to operate on
    await ensurePostgresTable(client, tableName, opts.entity?.columns);

    // 2. Determine the SQL to run
    const op = opts.operation;
    const args = opts.args || {};

    let rawSql = "";
    let params: unknown[] = [];
    let output: unknown;

    // If the operation has explicit SQL code or query, extract & execute it
    const opCode = (op.code || "").trim();
    const opQuery = (op.query || "").trim();

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
    } else {
      // Check if opCode has an embedded query('SQL...') call
      const queryMatch = opCode.match(
        /query(?:<[^>]+>)?\s*\(\s*(['"`])([\s\S]*?)\1\s*(?:,\s*\[([\s\S]*?)\])?\s*\)/m,
      );
      if (
        queryMatch &&
        queryMatch[2] &&
        /^\s*(SELECT|INSERT|UPDATE|DELETE)\b/i.test(queryMatch[2].trim())
      ) {
        rawSql = queryMatch[2].trim();
      } else {
        // Generate SQL from operation kind + args
        const plan = planSqlCommand(op, args, "postgres");
        rawSql = plan.rawSql;
      }
    }

    // Build parameterized query: replace literal values with $N params when we can
    // For sandbox-generated SQL (has quoted literals), run as-is
    // For parameterized queries already using $1, pass args as params array
    if (rawSql.includes("$1")) {
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
        params = colsInSql.map((c) => payloadObj[c] ?? payloadObj.id ?? null);
      } else {
        const opParams = op.params || [];
        params = opParams.map((p) => {
          if (p.name.startsWith("{") && p.name.endsWith("}")) {
            const inner = p.name
              .slice(1, -1)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            const firstKey = inner[0];
            if (firstKey) return payloadObj[firstKey] ?? null;
          }
          return args[p.name] ?? payloadObj[p.name] ?? null;
        });
      }
    } else {
      // Execute the raw SQL directly (from sandbox planner)
      params = [];
    }

    const result = await executeRawSql(client, rawSql, params);
    const durationMs = Math.round((performance.now() - start) * 100) / 100;

    const kind = op.kind || "";
    if (kind === "delete") {
      output = { success: true, message: "Record deleted successfully", deletedCount: result.rowCount };
    } else if (result.rows.length === 1 && (kind === "findById" || kind === "create" || kind === "update")) {
      output = result.rows[0];
    } else {
      output = result.rows.length > 0 ? result.rows : { success: true, rowCount: result.rowCount };
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
    connectionTimeoutMillis: 5000,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
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
