import { NextRequest, NextResponse } from "next/server";
import net from "net";
import fs from "fs";
import path from "path";
import { checkSqliteConnection } from "@/lib/utils/sqliteRunner";

// Helper to resolve env variable from local .env
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

// Check TCP socket connectivity with timeout
function checkTcpSocket(host: string, port: number, timeoutMs = 2500): Promise<{ reachable: boolean; latencyMs: number; error?: string }> {
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
      resolve({ reachable: false, latencyMs: timeoutMs, error: `Connection timed out after ${timeoutMs}ms` });
    });

    socket.on("error", (err) => {
      socket.destroy();
      resolve({ reachable: false, latencyMs: 0, error: err.message });
    });

    try {
      socket.connect(port, host);
    } catch (err) {
      resolve({ reachable: false, latencyMs: 0, error: err instanceof Error ? err.message : String(err) });
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { engine = "redis", connection = {}, projectId } = body;

    let host = connection.host || "127.0.0.1";
    if (host === "localhost") host = "127.0.0.1";
    let port = Number(connection.port) || (engine === "redis" ? 6379 : 5432);

    // Resolve connection string from env if configured
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
      const socketErrorRef = { message: "" };
      try {
        // Dynamically import ioredis
        const { default: Redis } = await import("ioredis");

        const client = new Redis({
          host,
          port,
          connectTimeout: 2500,
          lazyConnect: true,
          maxRetriesPerRequest: 0,
          retryStrategy: () => null,
          enableOfflineQueue: false,
        });

        // Capture specific socket / auth error emitted by ioredis so it's forwarded to UI
        client.on("error", (err: Error) => {
          socketErrorRef.message = err?.message || String(err);
        });

        const start = performance.now();

        // Connect with timeout guard
        await Promise.race([
          client.connect(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Connection timed out (2500ms)")), 2500),
          ),
        ]);

        await client.ping();
        const latencyMs = Math.round((performance.now() - start) * 10) / 10;

        // Fetch server info
        let infoObj: Record<string, string> = {};
        try {
          const rawInfo = await client.info();
          rawInfo.split(/\r?\n/).forEach((line) => {
            const idx = line.indexOf(":");
            if (idx > 0) {
              const k = line.substring(0, idx).trim();
              const v = line.substring(idx + 1).trim();
              infoObj[k] = v;
            }
          });
        } catch {}

        client.disconnect();

        return NextResponse.json({
          success: true,
          engine: "redis",
          latencyMs,
          host,
          port,
          connectionUri: `redis://${host}:${port}`,
          info: {
            version: infoObj.redis_version ? `Redis ${infoObj.redis_version}` : "Redis 7.x",
            rawVersion: infoObj.redis_version || "7.x",
            mode: infoObj.redis_mode || "standalone",
            usedMemory: infoObj.used_memory_human || "N/A",
            connectedClients: infoObj.connected_clients || "1",
            os: infoObj.os || "Linux/Windows",
          },
        });
      } catch (err) {
        const errorMsg = socketErrorRef.message || (err instanceof Error ? err.message : String(err));
        return NextResponse.json({
          success: false,
          engine: "redis",
          latencyMs: 0,
          host,
          port,
          connectionUri: `redis://${host}:${port}`,
          error: `Could not connect to Redis at ${host}:${port}: ${errorMsg}. Verify Redis server is running locally (e.g. 'redis-server' or Docker) and port ${port} is open.`,
        });
      }
    }

    // 2. SQLITE ENGINE
    if (engine === "sqlite") {
      let dbFilePath = connection.dbFilePath || "dev.db";
      if (connection.dbFilePathEnv) {
        const envVal = resolveEnvValue(connection.dbFilePathEnv);
        if (envVal) dbFilePath = envVal;
      }

      const check = checkSqliteConnection(dbFilePath);

      return NextResponse.json({
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
      });
    }

    // 3. RELATIONAL / TCP ENGINES (postgres, mysql, etc.)
    const tcpResult = await checkTcpSocket(host, port);
    if (tcpResult.reachable) {
      return NextResponse.json({
        success: true,
        engine,
        latencyMs: tcpResult.latencyMs,
        host,
        port,
        info: {
          reachable: true,
          socket: `${host}:${port}`,
        },
      });
    } else {
      return NextResponse.json({
        success: false,
        engine,
        latencyMs: 0,
        host,
        port,
        error: `Could not reach ${engine} database at ${host}:${port}: ${tcpResult.error || "Connection refused"}`,
      });
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to verify connection",
      },
      { status: 500 },
    );
  }
}
