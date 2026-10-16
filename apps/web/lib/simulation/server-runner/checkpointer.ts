import { MemorySaver, BaseCheckpointSaver } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { RedisSaver } from "@langchain/langgraph-checkpoint-redis";
import { Pool } from "pg";
import type { LangGraphMemoryConfig } from "@workspace/canvas";
import type { CheckpointerConnectionConfig } from "./types";

// Server-side thread checkpointer caches so multi-turn conversations persist across turns
export const serverMemorySaverCache = new Map<string, MemorySaver>();
export const serverPostgresPoolCache = new Map<string, { pool: Pool; saver: PostgresSaver }>();
export const serverRedisSaverCache = new Map<string, RedisSaver>();

export function resolvePgConnectionString(
  config?: CheckpointerConnectionConfig,
  envVarName?: string,
): string {
  if (config?.connectionString) return config.connectionString;
  if (envVarName && process.env[envVarName]) return process.env[envVarName]!;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const host = config?.host || "localhost";
  const port = Number(config?.port) || 5432;
  const db = config?.database || "postgres";
  const user = config?.user || config?.username || "postgres";
  const pass = config?.password !== undefined ? config?.password : "postgres";

  const authPart = pass
    ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}`
    : encodeURIComponent(user);

  return `postgresql://${authPart}@${host}:${port}/${encodeURIComponent(db)}`;
}

export function resolveRedisUrl(
  config?: CheckpointerConnectionConfig,
  envVarName?: string,
): string {
  if (config?.connectionString) return config.connectionString;
  if (envVarName && process.env[envVarName]) return process.env[envVarName]!;
  if (process.env.REDIS_URL) return process.env.REDIS_URL;

  const host = config?.host || "localhost";
  const port = Number(config?.port) || 6379;
  const pass = config?.password ? `:${encodeURIComponent(config.password)}@` : "";

  return `redis://${pass}${host}:${port}`;
}

export async function getOrCreateCheckpointer(
  memoryConfig: LangGraphMemoryConfig | undefined,
  threadId: string,
  connectionConfig?: CheckpointerConnectionConfig,
): Promise<BaseCheckpointSaver | undefined> {
  if (!memoryConfig || memoryConfig.enabled === false) {
    return undefined;
  }

  const engine = memoryConfig.checkpointer || "memory";

  // 1. PostgreSQL Checkpointer (PostgresSaver)
  if (engine === "postgres") {
    const connStr = resolvePgConnectionString(
      connectionConfig,
      memoryConfig.checkpointerEnvVar,
    );
    const maskedConn = connStr.replace(/:([^:@]+)@/, ":***@");

    let cached = serverPostgresPoolCache.get(connStr);
    if (!cached) {
      const pool = new Pool({
        connectionString: connStr,
        max: 5,
        connectionTimeoutMillis: 3000, // 3-second fail fast timeout
      });
      const saver = new PostgresSaver(pool);
      cached = { pool, saver };
      serverPostgresPoolCache.set(connStr, cached);
    }

    try {
      // setup() verifies connection and ensures checkpointer tables exist in PostgreSQL
      await cached.saver.setup();
    } catch (err: unknown) {
      // Clear cache on failure so next attempt retries fresh
      serverPostgresPoolCache.delete(connStr);
      await cached.pool.end().catch(() => {});
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `PostgreSQL Checkpointer Error: Failed to connect to PostgreSQL at ${maskedConn}.\n` +
        `Details: ${errMsg}\n` +
        `Verify your PostgreSQL server/container is running on the configured host and port.`,
      );
    }

    return cached.saver;
  }

  // 2. Redis Checkpointer (RedisSaver)
  if (engine === "redis") {
    const redisUrl = resolveRedisUrl(
      connectionConfig,
      memoryConfig.checkpointerEnvVar,
    );
    const maskedUrl = redisUrl.replace(/:([^:@]+)@/, ":***@");

    let saver = serverRedisSaverCache.get(redisUrl);
    if (!saver) {
      try {
        // RedisSaver.fromUrl connects to Redis with client.connect() and creates search indexes
        saver = await Promise.race([
          RedisSaver.fromUrl(redisUrl),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Connection timed out (3000ms)")), 3000),
          ),
        ]);
        serverRedisSaverCache.set(redisUrl, saver);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Redis Checkpointer Error: Failed to connect to Redis instance at ${maskedUrl}.\n` +
          `Details: ${errMsg}\n` +
          `Verify your Redis server/container is running on the configured host and port.`,
        );
      }
    }

    return saver;
  }

  // 3. Ephemeral In-Memory Checkpointer (MemorySaver)
  let memSaver = serverMemorySaverCache.get(threadId);
  if (!memSaver) {
    memSaver = new MemorySaver();
    serverMemorySaverCache.set(threadId, memSaver);
  }
  return memSaver;
}

export async function clearServerThread(
  threadId: string,
  memoryConfig?: LangGraphMemoryConfig,
  connectionConfig?: CheckpointerConnectionConfig,
): Promise<void> {
  serverMemorySaverCache.delete(threadId);

  if (memoryConfig?.checkpointer === "postgres") {
    const connStr = resolvePgConnectionString(
      connectionConfig,
      memoryConfig.checkpointerEnvVar,
    );
    const cached = serverPostgresPoolCache.get(connStr);
    if (cached) {
      try {
        await cached.saver.deleteThread(threadId);
      } catch {
        // ignore
      }
    }
  } else if (memoryConfig?.checkpointer === "redis") {
    const redisUrl = resolveRedisUrl(
      connectionConfig,
      memoryConfig.checkpointerEnvVar,
    );
    const cached = serverRedisSaverCache.get(redisUrl);
    if (cached) {
      try {
        await cached.deleteThread(threadId);
      } catch {
        // ignore
      }
    }
  }
}
