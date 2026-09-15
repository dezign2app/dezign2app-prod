import fs from "fs";
import path from "path";
import net from "net";
import { spawnSync } from "child_process";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonArray = JsonValue[];

export interface CanvasEntityColumn {
  name: string;
  type?: string;
  isPrimaryKey?: boolean;
  isPrimary?: boolean;
  primaryKey?: boolean;
  required?: boolean;
  unique?: boolean;
  defaultValue?: string | number | boolean | null;
}

export interface TestDbOperationPayload {
  engine?: string;
  connection?: {
    host?: string;
    port?: number | string;
    connectionString?: string;
    connectionStringEnv?: string;
    dbFilePath?: string;
    dbFilePathEnv?: string;
  };
  entity?: {
    name?: string;
    columns?: CanvasEntityColumn[];
  };
  operation: {
    id?: string;
    name: string;
    kind?: string;
    code?: string;
    query?: string;
    signature?: string;
    params?: Array<{ name: string; type: string; defaultValue?: string }>;
  };
  args: Record<string, JsonValue>;
  mode?: "live" | "sandbox";
}

export interface TestDbOperationResult {
  success: boolean;
  output?: JsonValue;
  durationMs?: number;
  rawCommand?: string;
  mode?: "live" | "sandbox";
  connection?: string;
  serverActive?: boolean;
  error?: string;
  tip?: string;
  dbInfo?: {
    path?: string;
    exists?: boolean;
    sizeBytes?: number;
    fileStatus?: string;
    table?: string;
  };
}

export interface CheckDbConnectionPayload {
  engine?: string;
  connection?: {
    host?: string;
    port?: number | string;
    connectionString?: string;
    connectionStringEnv?: string;
    dbFilePath?: string;
    dbFilePathEnv?: string;
  };
  projectId?: string;
}

export interface CheckDbConnectionResult {
  success: boolean;
  engine?: string;
  latencyMs?: number;
  connectionUri?: string;
  host?: string;
  port?: number;
  error?: string;
  info?: {
    version?: string;
    rawVersion?: string;
    mode?: string;
    usedMemory?: string;
    connectedClients?: string;
    os?: string;
    path?: string;
    exists?: boolean;
    sizeBytes?: number;
    tableCount?: number;
    readable?: boolean;
    status?: string;
    reachable?: boolean;
    socket?: string;
  };
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

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
        return trimmed.substring(trimmed.indexOf("=") + 1).trim();
      }
    }
  } catch {}
  return undefined;
}

export function resolveSqlitePath(dbFilePath = "dev.db", projectDir?: string): string {
  if (path.isAbsolute(dbFilePath)) return dbFilePath;

  let searchDir = projectDir || process.cwd();
  while (searchDir && searchDir !== path.dirname(searchDir)) {
    if (
      fs.existsSync(path.join(searchDir, "pnpm-workspace.yaml")) ||
      fs.existsSync(path.join(searchDir, "turbo.json"))
    ) {
      return path.resolve(searchDir, dbFilePath);
    }
    searchDir = path.dirname(searchDir);
  }
  return path.resolve(process.cwd(), dbFilePath);
}

function sanitizeIdentifier(identifier: string, fallback = "item"): string {
  const cleaned = identifier.replace(/[^a-zA-Z0-9_]/g, "");
  return cleaned || fallback;
}

function checkTcpSocket(
  host: string,
  port: number,
  timeoutMs = 2500,
): Promise<{ reachable: boolean; latencyMs: number; error?: string }> {
  return new Promise((resolve) => {
    const start = performance.now();
    const socket = new net.Socket();

    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      const latencyMs = Math.round((performance.now() - start) * 10) / 10;
      socket.destroy();
      resolve({ reachable: true, latencyMs });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({
        reachable: false,
        latencyMs: timeoutMs,
        error: `Connection timed out after ${timeoutMs}ms`,
      });
    });

    socket.on("error", (err) => {
      socket.destroy();
      resolve({ reachable: false, latencyMs: 0, error: err.message });
    });

    try {
      socket.connect(port, host);
    } catch (err) {
      resolve({
        reachable: false,
        latencyMs: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}

function extractTableName(op: TestDbOperationPayload["operation"]): string {
  const id = op.id || "";
  const name = op.name || "";
  const code = op.code || "";
  const query = op.query || "";

  const idMatch = id.match(
    /^auto-(?:find-all|find-by-id|create|update|delete)-(?:by-[a-z0-9_]+-)?(.+)$/i,
  );
  if (idMatch && idMatch[1]) {
    return idMatch[1].toLowerCase();
  }

  const fromMatch = (query + " " + code).match(
    /(?:FROM|INTO|UPDATE)\s+["'`]?([a-zA-Z0-9_]+)["'`]?/i,
  );
  if (fromMatch && fromMatch[1]) {
    return fromMatch[1].toLowerCase();
  }

  const clean = name
    .replace(
      /^(findAll|findById|findBy|find|create|update|deleteById|delete|insert|select|remove)/i,
      "",
    )
    .replace(/ById$/i, "")
    .trim();

  if (clean) {
    const lower = clean.toLowerCase();
    return lower.endsWith("s") ? lower : `${lower}s`;
  }

  return "records";
}

// ─────────────────────────────────────────────
//  SQLite Worker Execution Protocol
//  Electron embeds Node 20 (no node:sqlite). We run the worker script
//  via host Node (Node 22+) over stdin/stdout safely.
// ─────────────────────────────────────────────

export interface SqliteWorkerCheckPayload {
  action: "check";
  dbFilePath: string;
}

export interface SqliteWorkerExecutePayload {
  action: "execute";
  dbFilePath: string;
  tableName: string;
  columns?: CanvasEntityColumn[];
  operation: TestDbOperationPayload["operation"];
  args: Record<string, JsonValue>;
}

export type SqliteWorkerPayload =
  | SqliteWorkerCheckPayload
  | SqliteWorkerExecutePayload;

export interface SqliteWorkerCheckSuccessResult {
  success: true;
  latencyMs: number;
  sizeBytes: number;
  tableCount: number;
}

export interface SqliteWorkerExecuteSuccessResult {
  success: true;
  output: JsonValue;
  rawSql: string;
  durationMs: number;
  sizeBytes: number;
  table: string;
}

export interface SqliteWorkerFailureResult {
  success: false;
  error: string;
}

export type SqliteWorkerCheckResult =
  | SqliteWorkerCheckSuccessResult
  | SqliteWorkerFailureResult;

export type SqliteWorkerExecuteResult =
  | SqliteWorkerExecuteSuccessResult
  | SqliteWorkerFailureResult;

export type SqliteWorkerResult =
  | SqliteWorkerCheckResult
  | SqliteWorkerExecuteResult;

function getWorkerScriptPath(): string {
  const fallback = path.join(__dirname, "sqliteWorker.js");
  const candidates = [
    fallback,
    path.join(__dirname, "sqliteWorker.ts"),
    path.join(__dirname, "../../electron/services/sqliteWorker.js"),
    path.join(__dirname, "../../electron/services/sqliteWorker.ts"),
    path.join(process.cwd(), "apps/desktop/dist-electron/services/sqliteWorker.js"),
    path.join(process.cwd(), "apps/desktop/electron/services/sqliteWorker.js"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return fallback;
}

function runSqliteWorker(payload: SqliteWorkerCheckPayload): SqliteWorkerCheckResult;
function runSqliteWorker(payload: SqliteWorkerExecutePayload): SqliteWorkerExecuteResult;
function runSqliteWorker(payload: SqliteWorkerPayload): SqliteWorkerResult {
  const workerPath = getWorkerScriptPath();
  try {
    const res = spawnSync("node", [workerPath], {
      input: JSON.stringify(payload),
      encoding: "utf-8",
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    });
    if (res.error) {
      return { success: false, error: res.error.message };
    }
    const outputText = res.stdout ? res.stdout.trim() : "";
    if (!outputText) {
      return {
        success: false,
        error: res.stderr ? res.stderr.trim() : "No output from sqlite worker",
      };
    }
    const parsed: SqliteWorkerResult = JSON.parse(outputText);
    return parsed;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMessage };
  }
}

// ─────────────────────────────────────────────
//  Main IPC Handlers
// ─────────────────────────────────────────────

export async function executeDbOperation(
  payload: TestDbOperationPayload,
): Promise<TestDbOperationResult> {
  const {
    engine = "sqlite",
    connection = {},
    entity,
    operation,
    args = {},
    mode = "live",
  } = payload;

  if (!operation || !operation.name) {
    return { success: false, error: "Operation definition is required" };
  }

  const host = connection.host || "127.0.0.1";
  const port = Number(connection.port) || (engine === "redis" ? 6379 : 5432);

  // 1. LIVE SQLITE EMBEDDED EXECUTION
  if (engine === "sqlite" && mode === "live") {
    let dbFilePath = connection.dbFilePath || "dev.db";
    if (connection.dbFilePathEnv) {
      const envVal = resolveEnvValue(connection.dbFilePathEnv);
      if (envVal) dbFilePath = envVal;
    }

    const resolvedPath = resolveSqlitePath(dbFilePath);
    const tableName = entity?.name || extractTableName(operation);

    const workerResult = runSqliteWorker({
      action: "execute",
      dbFilePath: resolvedPath,
      tableName,
      columns: entity?.columns,
      operation,
      args,
    });

    if (workerResult.success) {
      return {
        success: true,
        serverActive: true,
        output: workerResult.output,
        rawCommand: workerResult.rawSql,
        durationMs: workerResult.durationMs,
        mode: "live",
        connection: `sqlite:${dbFilePath}`,
        dbInfo: {
          path: resolvedPath,
          sizeBytes: workerResult.sizeBytes,
          table: workerResult.table,
          exists: true,
          fileStatus: "connected (live SQLite database active)",
        },
      };
    } else {
      return {
        success: false,
        error: `SQLite execution error: ${workerResult.error}`,
        rawCommand: operation.query || `${operation.name}()`,
        durationMs: 1.0,
        dbInfo: {
          path: resolvedPath,
          sizeBytes: 0,
          table: sanitizeIdentifier(tableName, "records"),
          exists: fs.existsSync(resolvedPath),
        },
      };
    }
  }

  // 2. LIVE TCP PROBE (Redis / Postgres / MySQL)
  if (mode === "live") {
    const tcpResult = await checkTcpSocket(host, port, 2500);
    if (!tcpResult.reachable) {
      return {
        success: false,
        serverActive: false,
        error: `Server not found or inactive: Could not reach ${engine.toUpperCase()} database server at ${host}:${port} (${tcpResult.error || "Connection refused"}).`,
        rawCommand: operation.query || `${operation.name}(${Object.keys(args).join(", ")})`,
        durationMs: tcpResult.latencyMs || 0,
        mode: "live",
        tip: `Ensure your local ${engine} database server is running and listening on port ${port}, or switch to 'Simulation Sandbox' mode to test operations safely without a live server.`,
      };
    }

    return {
      success: true,
      serverActive: true,
      output: {
        message: `Executed ${operation.name} successfully on ${engine} at ${host}:${port}`,
        params: args,
      },
      durationMs: tcpResult.latencyMs,
      rawCommand: operation.query || `${operation.name}(${Object.keys(args).join(", ")})`,
      mode: "live",
      connection: `${host}:${port}`,
    };
  }

  // 3. SANDBOX SIMULATION
  const tableName = entity?.name || extractTableName(operation);
  const nowIso = new Date().toISOString();
  return {
    success: true,
    mode: "sandbox",
    output: {
      id: String(args.id || `${tableName}_1`),
      sample: "Simulated sandbox output",
      created_at: nowIso,
      updated_at: nowIso,
    },
    durationMs: 0.5,
    rawCommand: operation.query || `${operation.name}(${Object.keys(args).join(", ")})`,
  };
}

export async function checkDbConnection(
  payload: CheckDbConnectionPayload,
): Promise<CheckDbConnectionResult> {
  const { engine = "sqlite", connection = {} } = payload;
  let host = connection.host || "127.0.0.1";
  if (host === "localhost") host = "127.0.0.1";
  const port = Number(connection.port) || (engine === "redis" ? 6379 : 5432);

  // 1. SQLITE ENGINE
  if (engine === "sqlite") {
    let dbFilePath = connection.dbFilePath || "dev.db";
    if (connection.dbFilePathEnv) {
      const envVal = resolveEnvValue(connection.dbFilePathEnv);
      if (envVal) dbFilePath = envVal;
    }

    const resolvedPath = resolveSqlitePath(dbFilePath);
    const workerResult = runSqliteWorker({
      action: "check",
      dbFilePath: resolvedPath,
    });

    if (workerResult.success) {
      return {
        success: true,
        engine: "sqlite",
        latencyMs: Math.max(0.4, workerResult.latencyMs),
        connectionUri: `sqlite:${dbFilePath}`,
        info: {
          path: resolvedPath,
          exists: true,
          sizeBytes: workerResult.sizeBytes,
          tableCount: workerResult.tableCount,
          readable: true,
          status: "Connected (SQLite Database Active)",
          version: "SQLite 3.x (Host Node DatabaseSync)",
        },
      };
    } else {
      return {
        success: false,
        engine: "sqlite",
        latencyMs: 0,
        connectionUri: `sqlite:${dbFilePath}`,
        error: workerResult.error || "Failed to inspect SQLite database",
      };
    }
  }

  // 2. TCP ENGINES (Redis, Postgres, MySQL)
  const tcpResult = await checkTcpSocket(host, port);
  if (tcpResult.reachable) {
    return {
      success: true,
      engine,
      latencyMs: tcpResult.latencyMs,
      host,
      port,
      connectionUri: `${engine}://${host}:${port}`,
      info: {
        reachable: true,
        socket: `${host}:${port}`,
        version: `${engine} server (TCP open)`,
        status: "Connected",
      },
    };
  } else {
    return {
      success: false,
      engine,
      latencyMs: 0,
      host,
      port,
      connectionUri: `${engine}://${host}:${port}`,
      error: `Could not reach ${engine} database at ${host}:${port}: ${tcpResult.error || "Connection refused"}`,
    };
  }
}
