import { Pool, PoolClient } from "pg";
import fs from "fs";
import path from "path";
import {
  CanvasEntityColumn,
  TestDbOperationPayload,
  TestDbOperationResult,
  CheckDbConnectionResult,
  JsonValue,
} from "./dbRunner";

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
  entity?: {
    name?: string;
    columns?: CanvasEntityColumn[];
  };
  operation: TestDbOperationPayload["operation"];
  args: Record<string, JsonValue>;
  mode?: "live" | "sandbox";
}

function resolveEnvValue(envKey: string, projectDir?: string): string | undefined {
  if (process.env[envKey]) return process.env[envKey];
  const targetDir = projectDir || process.cwd();
  const envPath = path.join(targetDir, ".env");
  if (!fs.existsSync(envPath)) return undefined;

  try {
    const content = fs.readFileSync(envPath, "utf-8");
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const key = trimmed.substring(0, trimmed.indexOf("=")).trim();
      if (key === envKey) {
        let val = trimmed.substring(trimmed.indexOf("=") + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        return val;
      }
    }
  } catch {}
  return undefined;
}

export function resolveConnectionString(config: PostgresConnectionConfig): string {
  // 1. Explicit connection string takes highest precedence
  if (config.connectionString) return config.connectionString;

  // 2. From environment variable if specified
  if (config.connectionStringEnv) {
    const envVal = resolveEnvValue(config.connectionStringEnv);
    if (envVal) return envVal;
  }

  // 3. Fallback to DATABASE_URL if no explicit host/database
  const hasExplicit = Boolean(config.database || config.user || config.username || config.password);
  if (!hasExplicit) {
    const dbUrl = resolveEnvValue("DATABASE_URL");
    if (dbUrl) return dbUrl;
  }

  // 4. Build from constituent parts
  const host = config.host || "127.0.0.1";
  const port = Number(config.port) || 5432;
  const db = config.database || "postgres";
  const user = config.user || config.username || "postgres";
  const pass = config.password !== undefined && config.password !== null ? String(config.password) : "postgres";

  const authPart = pass
    ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}`
    : encodeURIComponent(user);

  return `postgresql://${authPart}@${host}:${port}/${encodeURIComponent(db)}`;
}

export async function ensurePostgresTable(
  client: PoolClient,
  tableName: string,
  columns?: CanvasEntityColumn[],
): Promise<void> {
  const safeTable = (tableName || "records").replace(/[^a-zA-Z0-9_]/g, "") || "records";

  const checkRes = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1) AS exists`,
    [safeTable],
  );
  const exists = checkRes.rows[0]?.exists;

  if (!exists) {
    const colDefs: string[] = [];
    if (columns && columns.length > 0) {
      for (const col of columns) {
        const colName = (col.name || "col").replace(/[^a-zA-Z0-9_]/g, "");
        const isPk = col.isPrimaryKey || col.isPrimary || col.primaryKey || colName.toLowerCase() === "id";
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
    if (!colDefs.some((d) => d.startsWith('"updated_at"'))) {
      colDefs.push(`"updated_at" TIMESTAMPTZ DEFAULT NOW()`);
    }
    await client.query(`CREATE TABLE IF NOT EXISTS "${safeTable}" (${colDefs.join(", ")});`);
  } else if (columns && columns.length > 0) {
    // Auto-add any missing columns
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
      } catch {}
    }
  }
}

function planPostgresQuery(
  operation: TestDbOperationPayload["operation"],
  args: Record<string, JsonValue>,
  tableName: string,
): { rawSql: string; params: unknown[] } {
  const name = operation.name || "";
  const kind = operation.kind || "";
  const code = (operation.code || "").trim();
  const query = (operation.query || "").trim();

  // 1. Check if op.query has direct SQL
  if (
    query &&
    !query.startsWith("Query function for") &&
    !query.startsWith("Auto-generated")
  ) {
    return { rawSql: query, params: [] };
  }

  // 2. Check if op.code is direct SQL
  if (
    code &&
    /^\s*(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|ALTER|DROP)\b/i.test(code)
  ) {
    return { rawSql: code, params: [] };
  }

  // 3. Check if op.code has an embedded query('SQL...', [...]) call
  const queryMatch = code.match(
    /query(?:<[^>]+>)?\s*\(\s*(['"`])([\s\S]*?)\1\s*(?:,\s*\[([\s\S]*?)\])?\s*\)/m,
  );

  if (queryMatch && queryMatch[2] && /^\s*(SELECT|INSERT|UPDATE|DELETE)\b/i.test(queryMatch[2].trim())) {
    const sql = queryMatch[2].trim();
    const explicitArgs = queryMatch[3]
      ? queryMatch[3]
          .split(",")
          .map((s) => s.trim().replace(/^data\./, ""))
          .filter(Boolean)
      : [];

    let payloadObj: Record<string, unknown> = {};
    Object.keys(args).forEach((k) => {
      const val = args[k];
      if (typeof val === "object" && val !== null && !Array.isArray(val)) {
        payloadObj = { ...payloadObj, ...(val as Record<string, unknown>) };
      } else {
        payloadObj[k] = val;
      }
    });

    const colMatch = sql.match(/\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    const params: unknown[] = [];

    if (colMatch && colMatch[1]) {
      const cols = colMatch[1]
        .split(",")
        .map((c) => c.replace(/["`\s]/g, ""));
      for (const colName of cols) {
        if (colName.toLowerCase() === "id") {
          const idVal =
            payloadObj["id"] ??
            args["id"] ??
            payloadObj["_id"] ??
            args["_id"] ??
            (typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `${tableName}_${Date.now().toString(36)}`);
          params.push(idVal);
        } else {
          params.push(payloadObj[colName] ?? args[colName] ?? null);
        }
      }
    } else if (explicitArgs.length > 0) {
      for (const rawArg of explicitArgs) {
        const cleanArg = rawArg
          .trim()
          .replace(/^data\./, "")
          .replace(/\s*\?\?.*$/, "")
          .replace(/\s*\|\|.*$/, "")
          .trim();

        if (cleanArg === "_id" || cleanArg === "_rowId" || cleanArg === "id") {
          const idVal =
            payloadObj["id"] ??
            args["id"] ??
            payloadObj["_id"] ??
            args["_id"] ??
            (typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `${tableName}_${Date.now().toString(36)}`);
          params.push(idVal);
        } else if (cleanArg === "limit") {
          params.push(args.limit !== undefined ? Number(args.limit) : 20);
        } else if (cleanArg === "offset") {
          params.push(args.offset !== undefined ? Number(args.offset) : 0);
        } else if (args[cleanArg] !== undefined) {
          params.push(args[cleanArg]);
        } else if (payloadObj[cleanArg] !== undefined) {
          params.push(payloadObj[cleanArg]);
        } else {
          params.push(null);
        }
      }
    } else {
      const opParams = operation.params || [];
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

    // Ensure parameters match placeholder count ($1, $2, etc.)
    const placeholderMatches = sql.match(/\$\d+/g) || [];
    const maxPlaceholderIndex = placeholderMatches.reduce((max, ph) => {
      const idx = parseInt(ph.slice(1), 10);
      return Math.max(max, isNaN(idx) ? 0 : idx);
    }, 0);

    while (params.length < maxPlaceholderIndex) {
      const missingIndex = params.length + 1;
      if (sql.includes(`LIMIT $${missingIndex}`)) {
        params.push(args.limit !== undefined ? Number(args.limit) : 20);
      } else if (sql.includes(`OFFSET $${missingIndex}`)) {
        params.push(args.offset !== undefined ? Number(args.offset) : 0);
      } else {
        params.push(null);
      }
    }

    return { rawSql: sql, params };
  }

  // 4. Standard CRUD query planning
  const isFindAll =
    kind === "findAll" ||
    name.toLowerCase().startsWith("findall") ||
    name.toLowerCase().startsWith("getall") ||
    name.toLowerCase().startsWith("list");
  const isFindById =
    kind === "findById" ||
    name.toLowerCase().startsWith("findbyid") ||
    name.toLowerCase().startsWith("getbyid") ||
    (name.toLowerCase().startsWith("find") && args.id !== undefined);
  const isCreate =
    kind === "create" ||
    name.toLowerCase().startsWith("create") ||
    name.toLowerCase().startsWith("insert");
  const isUpsert =
    kind === "upsert" ||
    name.toLowerCase().startsWith("upsert");
  const isUpdate =
    kind === "update" || name.toLowerCase().startsWith("update");
  const isDelete =
    kind === "delete" ||
    name.toLowerCase().startsWith("delete") ||
    name.toLowerCase().startsWith("remove");

  if (isFindAll) {
    const limit = Math.max(1, Number(args.limit) || 20);
    const offset = Math.max(0, Number(args.offset) || 0);
    return {
      rawSql: `SELECT * FROM "${tableName}" ORDER BY "id" LIMIT $1 OFFSET $2;`,
      params: [limit, offset],
    };
  }

  if (isFindById) {
    const idVal = String(args.id ?? "1");
    return {
      rawSql: `SELECT * FROM "${tableName}" WHERE "id" = $1 LIMIT 1;`,
      params: [idVal],
    };
  }

  if (isUpsert) {
    let rawPayload = args.data;
    if (!rawPayload) {
      const destructuredKey = Object.keys(args).find((k) => k.startsWith("{"));
      if (destructuredKey) rawPayload = args[destructuredKey];
    }
    if (!rawPayload) {
      rawPayload = args.record || args.item || args;
    }
    const dataObj =
      typeof rawPayload === "object" && rawPayload !== null && !Array.isArray(rawPayload)
        ? (rawPayload as Record<string, unknown>)
        : {};

    const keys = Object.keys(dataObj).filter(
      (k) => !k.startsWith("{") && k !== "data" && k !== "record" && dataObj[k] !== undefined,
    );

    if (!keys.some((k) => k.toLowerCase() === "id")) {
      keys.unshift("id");
      dataObj["id"] = dataObj["id"] || `${tableName}_${Date.now().toString(36)}`;
    }

    const nonIdKeys = keys.filter((k) => k.toLowerCase() !== "id");
    const cols = keys.map((k) => `"${k}"`).join(", ");
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const vals = keys.map((k) => dataObj[k]);

    const conflictClause = nonIdKeys.length > 0
      ? `DO UPDATE SET ` + nonIdKeys.map((k) => `"${k}" = EXCLUDED."${k}"`).join(", ")
      : `DO NOTHING`;

    return {
      rawSql: `INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders}) ON CONFLICT ("id") ${conflictClause} RETURNING *;`,
      params: vals,
    };
  }

  if (isCreate) {
    const rawPayload = args.data || args.record || args.item || args;
    const dataObj =
      typeof rawPayload === "object" && rawPayload !== null && !Array.isArray(rawPayload)
        ? (rawPayload as Record<string, unknown>)
        : {};

    const keys = Object.keys(dataObj).filter(
      (k) => !k.startsWith("{") && k !== "data" && k !== "record" && dataObj[k] !== undefined,
    );

    if (keys.length > 0) {
      const cols = keys.map((k) => `"${k}"`).join(", ");
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
      const vals = keys.map((k) => dataObj[k]);
      return {
        rawSql: `INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders}) RETURNING *;`,
        params: vals,
      };
    }

    const fallbackId = `${tableName}_${Date.now().toString(36)}`;
    return {
      rawSql: `INSERT INTO "${tableName}" ("id") VALUES ($1) RETURNING *;`,
      params: [fallbackId],
    };
  }

  if (isUpdate) {
    const idVal = String(args.id ?? "1");
    const rawPayload = args.data || args.record || args.item || args;
    const dataObj =
      typeof rawPayload === "object" && rawPayload !== null && !Array.isArray(rawPayload)
        ? (rawPayload as Record<string, unknown>)
        : {};

    const keys = Object.keys(dataObj).filter(
      (k) => k !== "id" && !k.startsWith("{") && k !== "data" && k !== "record" && dataObj[k] !== undefined,
    );

    if (keys.length > 0) {
      const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`).join(", ");
      const vals = keys.map((k) => dataObj[k]);
      return {
        rawSql: `UPDATE "${tableName}" SET ${setClauses} WHERE "id" = $1 RETURNING *;`,
        params: [idVal, ...vals],
      };
    }

    return {
      rawSql: `UPDATE "${tableName}" SET "updated_at" = NOW() WHERE "id" = $1 RETURNING *;`,
      params: [idVal],
    };
  }

  if (isDelete) {
    const idVal = String(args.id ?? "1");
    return {
      rawSql: `DELETE FROM "${tableName}" WHERE "id" = $1;`,
      params: [idVal],
    };
  }

  // Fallback: SELECT all from table
  return {
    rawSql: `SELECT * FROM "${tableName}" LIMIT 20;`,
    params: [],
  };
}

export async function executePostgresLiveOperation(
  opts: ExecutePostgresOptions,
): Promise<TestDbOperationResult> {
  const connectionString = resolveConnectionString(opts.connection);
  const tableName = (opts.entity?.name || "records").replace(/[^a-zA-Z0-9_]/g, "") || "records";
  const start = performance.now();

  const pool = new Pool({
    connectionString,
    max: 2,
    connectionTimeoutMillis: 4000,
  });

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();

    // 1. Auto-ensure table structure exists
    await ensurePostgresTable(client, tableName, opts.entity?.columns);

    // 2. Plan and execute query
    const { rawSql, params } = planPostgresQuery(opts.operation, opts.args, tableName);

    const queryRes = await client.query(rawSql, params as any[]);
    const durationMs = Math.round((performance.now() - start) * 10) / 10;

    const kind = opts.operation.kind || "";
    const name = opts.operation.name || "";
    const isFindAllLike =
      kind === "findAll" ||
      kind === "fetchByIndex" ||
      name.toLowerCase().startsWith("findall") ||
      name.toLowerCase().startsWith("getall") ||
      name.toLowerCase().startsWith("list");

    let output: JsonValue;
    if (kind === "delete") {
      output = {
        success: true,
        message: "Record deleted successfully",
        deletedCount: queryRes.rowCount ?? 0,
      };
    } else if (
      queryRes.rows.length === 1 &&
      (kind === "findById" || kind === "create" || kind === "update" || kind === "upsert") &&
      !isFindAllLike
    ) {
      output = queryRes.rows[0] as JsonValue;
    } else if (isFindAllLike) {
      output = queryRes.rows as JsonValue[];
    } else {
      output = queryRes.rows.length > 0 ? (queryRes.rows as JsonValue[]) : (queryRes.rows as JsonValue[]);
    }

    return {
      success: true,
      serverActive: true,
      output,
      durationMs: Math.max(0.5, durationMs),
      rawCommand: rawSql,
      mode: "live",
      connection: connectionString.replace(/:([^:@]+)@/, ":***@"),
    };
  } catch (err) {
    const durationMs = Math.round((performance.now() - start) * 10) / 10;
    const errMsg = err instanceof Error ? err.message : String(err);
    const isConnErr =
      errMsg.includes("ECONNREFUSED") ||
      errMsg.includes("connect ETIMEDOUT") ||
      errMsg.includes("Connection refused") ||
      errMsg.includes("connection timeout") ||
      errMsg.includes("getaddrinfo ENOTFOUND") ||
      errMsg.includes("password authentication failed");

    return {
      success: false,
      serverActive: !isConnErr,
      error: `PostgreSQL error: ${errMsg}`,
      durationMs: Math.max(0.5, durationMs),
      rawCommand: opts.operation.query || `${opts.operation.name}(${Object.keys(opts.args).join(", ")})`,
      mode: "live",
      connection: connectionString.replace(/:([^:@]+)@/, ":***@"),
      tip: isConnErr
        ? "Ensure your PostgreSQL server is running and credentials match, or switch to Sandbox mode."
        : undefined,
    };
  } finally {
    if (client) client.release();
    await pool.end().catch(() => {});
  }
}

export async function checkPostgresConnection(
  connection: PostgresConnectionConfig,
): Promise<CheckDbConnectionResult> {
  const connectionString = resolveConnectionString(connection);
  const start = performance.now();

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 3500,
  });

  let client: PoolClient | undefined;
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
        status: "Connected (PostgreSQL Active)",
        reachable: true,
      },
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      engine: "postgres",
      latencyMs,
      error: errMsg,
      connectionUri: connectionString.replace(/:([^:@]+)@/, ":***@"),
      info: { reachable: false, status: "unreachable" },
    };
  } finally {
    if (client) client.release();
    await pool.end().catch(() => {});
  }
}
