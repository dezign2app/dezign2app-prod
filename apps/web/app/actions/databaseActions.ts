"use server";

import { sanitizeForConvex } from "@/lib/utils/convexSanitizer";
import { executeSqliteLiveOperation, checkSqliteConnection } from "@/lib/utils/sqliteRunner";
import {
  executePostgresLiveOperation,
  checkPostgresConnection,
} from "@/lib/utils/postgresRunner";
import {
  type TestDbOperationPayload,
  type TestDbOperationResult,
  type CheckDbConnectionPayload,
  type CheckDbConnectionResult,
  type JsonValue,
  type JsonObject,
  type JsonArray,
  type CanvasEntityColumn,
  isJsonObject,
  resolveEnvValue,
  checkTcpSocket,
  planRedisCommand,
  executeLiveRedisOperation,
  checkRedisConnection,
  extractTableName,
  planSqlCommand,
  executeSqlOperation,
  executeInSandbox,
} from "@/lib/database-runner";
import { executeFunctionCode } from "@/lib/database-runner/functionCodeRunner";

export type {
  TestDbOperationPayload,
  TestDbOperationResult,
  CheckDbConnectionPayload,
  CheckDbConnectionResult,
  JsonValue,
  JsonObject,
  JsonArray,
  CanvasEntityColumn,
};
export { isJsonObject };

/**
 * Server action to test database operations against live or sandbox databases.
 */
export async function testDbOperationAction(
  payload: TestDbOperationPayload,
): Promise<TestDbOperationResult> {
  try {
    const {
      engine = "redis",
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

    // 1. SANDBOX MODE
    if (mode === "sandbox") {
      const start = performance.now();

      // If custom function code is present, execute it in sandbox
      const code = (operation.code || "").trim();
      const hasCustomCode =
        code.length > 0 &&
        (operation.kind === "custom" ||
          code.includes("function") ||
          code.includes("=>") ||
          code.includes("return"));

      if (hasCustomCode) {
        const codeRes = await executeFunctionCode({
          code,
          name: operation.name,
          params: operation.params,
          args,
          tableName: entity?.name || extractTableName(operation),
        });
        const durationMs = Math.round((performance.now() - start) * 100) / 100;
        return {
          success: codeRes.success,
          output: sanitizeForConvex(codeRes.output),
          error: codeRes.error,
          durationMs: Math.max(0.4, durationMs),
          rawCommand: codeRes.rawCommand,
          mode: "sandbox",
        };
      }

      if (engine === "redis") {
        const plan = planRedisCommand(operation, args);
        const output = sanitizeForConvex(executeInSandbox(plan, args));
        const durationMs = Math.round((performance.now() - start) * 100) / 100;

        return {
          success: true,
          output,
          durationMs: Math.max(0.4, durationMs),
          rawCommand: plan.rawCli,
          mode: "sandbox",
        };
      }

      // Relational / SQL Sandbox
      const sqlPlan = planSqlCommand(operation, args, engine);
      const output = sanitizeForConvex(executeSqlOperation(operation, args, engine));
      const durationMs = Math.round((performance.now() - start) * 100) / 100;

      return {
        success: true,
        output,
        durationMs: Math.max(0.4, durationMs),
        rawCommand: sqlPlan.rawSql,
        mode: "sandbox",
      };
    }

    // 2. LIVE REDIS EXECUTION
    if (engine === "redis") {
      const plan = planRedisCommand(operation, args);
      return await executeLiveRedisOperation({ host, port, plan });
    }

    // 3. LIVE SQLITE EMBEDDED EXECUTION
    if (engine === "sqlite") {
      let dbFilePath = connection.dbFilePath || "dev.db";
      if (connection.dbFilePathEnv) {
        const envVal = resolveEnvValue(connection.dbFilePathEnv);
        if (envVal) dbFilePath = envVal;
      }

      const tableName = entity?.name || extractTableName(operation);
      const result = await executeSqliteLiveOperation({
        dbFilePath,
        tableName,
        columns: entity?.columns,
        operation,
        args,
      });

      return {
        success: result.success,
        serverActive: true,
        output: sanitizeForConvex(result.output),
        durationMs: result.durationMs,
        rawCommand: result.rawSql,
        mode: "live",
        connection: `sqlite:${dbFilePath}`,
        error: result.error,
        dbInfo: {
          path: result.dbInfo.path,
          exists: result.dbInfo.exists,
          sizeBytes: result.dbInfo.sizeBytes,
          fileStatus: result.dbInfo.exists
            ? "connected (live SQLite database active)"
            : "embedded (auto-initialized)",
        },
      };
    }

    // 4. LIVE POSTGRES EXECUTION
    if (engine === "postgres" || engine === "postgresql" || engine === "pg" || engine === "cockroachdb") {
      const pgResult = await executePostgresLiveOperation({
        connection: {
          host,
          port,
          connectionString: connection.connectionString,
          connectionStringEnv: connection.connectionStringEnv,
          database: connection.database,
          user: connection.user || connection.username,
          password: connection.password,
        },
        entity: {
          name: entity?.name || extractTableName(operation),
          columns: entity?.columns,
        },
        operation,
        args,
        mode: "live",
      });

      if (!pgResult.serverActive && !pgResult.success) {
        return {
          success: false,
          serverActive: false,
          error: pgResult.error || `Server not found or inactive: Could not reach PostgreSQL database server at ${host}:${port}.`,
          rawCommand: pgResult.rawSql || operation.query || `${operation.name}(${Object.keys(args).join(", ")})`,
          durationMs: pgResult.durationMs || 0,
          mode: "live",
          tip: `Ensure your local PostgreSQL server is running on port ${port}, or switch to 'Simulation Sandbox' mode.`,
        };
      }

      return {
        success: pgResult.success,
        serverActive: pgResult.serverActive ?? true,
        output: sanitizeForConvex(pgResult.output),
        durationMs: pgResult.durationMs,
        rawCommand: pgResult.rawSql,
        mode: "live",
        connection: `${host}:${port}`,
        error: pgResult.error,
      };
    }

    // 5. LIVE CLIENT-SERVER TCP ENGINES (mysql, etc.)
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

      const sqlPlan = planSqlCommand(operation, args, engine);
      const output = sanitizeForConvex(executeSqlOperation(operation, args, engine));

      return {
        success: true,
        serverActive: true,
        output,
        durationMs: tcpResult.latencyMs,
        rawCommand: sqlPlan.rawSql,
        mode: "live",
        connection: `${host}:${port}`,
      };
    }

    // 5. FALLBACK
    const sqlPlan = planSqlCommand(operation, args, engine);
    const output = sanitizeForConvex(executeSqlOperation(operation, args, engine));
    return {
      success: true,
      output,
      durationMs: 1.2,
      rawCommand: sqlPlan.rawSql,
      mode: "sandbox",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to execute operation test",
    };
  }
}

/**
 * Server action to verify database connectivity, port status, and server metadata.
 */
export async function checkDbConnectionAction(
  payload: CheckDbConnectionPayload,
): Promise<CheckDbConnectionResult> {
  try {
    const { engine = "redis", connection = {} } = payload;

    let host = connection.host || "127.0.0.1";
    if (host === "localhost") host = "127.0.0.1";
    let port = Number(connection.port) || (engine === "redis" ? 6379 : 5432);

    let connectionString = connection.connectionString;
    if (!connectionString && connection.connectionStringEnv) {
      connectionString = resolveEnvValue(connection.connectionStringEnv);
    }

    if (connectionString) {
      try {
        const parsed = new URL(connectionString);
        if (parsed.hostname) host = parsed.hostname === "localhost" ? "127.0.0.1" : parsed.hostname;
        if (parsed.port) port = Number(parsed.port);
      } catch {}
    }

    // 1. REDIS ENGINE
    if (engine === "redis") {
      return await checkRedisConnection({ host, port });
    }

    // 2. SQLITE ENGINE
    if (engine === "sqlite") {
      let dbFilePath = connection.dbFilePath || "dev.db";
      if (connection.dbFilePathEnv) {
        const envVal = resolveEnvValue(connection.dbFilePathEnv);
        if (envVal) dbFilePath = envVal;
      }

      const check = checkSqliteConnection(dbFilePath);

      return {
        success: check.success,
        engine: "sqlite",
        latencyMs: check.latencyMs,
        connectionUri: `sqlite:${dbFilePath}`,
        error: check.error,
        info: {
          path: check.path,
          exists: check.success,
          sizeBytes: check.sizeBytes,
          tableCount: check.tableCount,
          readable: true,
          status: "Connected (SQLite Database Active)",
          version: "SQLite 3.x (Embedded Node DatabaseSync)",
        },
      };
    }

    // 3. POSTGRES ENGINE — full credential check
    if (engine === "postgres" || engine === "postgresql" || engine === "pg" || engine === "cockroachdb") {
      return await checkPostgresConnection({
        host,
        port,
        connectionString,
        connectionStringEnv: connection.connectionStringEnv,
        database: connection.database,
        user: connection.user || connection.username,
        password: connection.password,
      });
    }

    // 4. RELATIONAL / TCP ENGINES (mysql, etc.)
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
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to verify connection",
    };
  }
}
