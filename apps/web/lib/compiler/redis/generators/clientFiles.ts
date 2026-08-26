import { CompiledFile } from "@workspace/canvas/types";
import { BackendNode } from "@/types/canvas";

export function generateConfig(
  inst: BackendNode,
  instLabel: string,
  instEnvKey: string,
  instHost: string,
  instPort: number,
  maxmemoryPolicy: string,
  maxmemory: string,
  persistenceMode: string,
  instanceSchemas: BackendNode[],
): CompiledFile {
  const configContent = `/**
 * Redis Configuration & Schema Catalog for ${instLabel}
 */
export const REDIS_CONFIG = {
  instanceId: "${inst.id}",
  label: "${instLabel}",
  connectionEnv: "${instEnvKey}",
  defaultHost: "${instHost}",
  defaultPort: ${instPort},
  maxmemoryPolicy: "${maxmemoryPolicy}",
  maxmemory: "${maxmemory}",
  persistenceMode: "${persistenceMode}",
  schemas: [
${instanceSchemas
  .map((s) => {
    const keyTmpl =
      s.data?.keyTemplate || `${(s.data?.label || "cache").toLowerCase()}:{id}`;
    const struct = s.data?.redisDataStructure || "hash";
    const ttlVal =
      typeof s.data?.ttl === "object" ? s.data?.ttl?.value || 3600 : 3600;
    return `    {
      id: "${s.id}",
      label: "${s.data?.label || "Cache"}",
      dataStructure: "${struct}",
      keyTemplate: "${keyTmpl}",
      ttlSeconds: ${ttlVal},
      cacheStrategy: "${s.data?.cacheStrategy || "Cache Aside"}",
    },`;
  })
  .join("\n")}
  ],
} as const;
`;

  return {
    filename: "src/config.ts",
    language: "typescript",
    content: configContent,
  };
}

export function generateClient(instLabel: string): CompiledFile {
  const clientContent = `import Redis from "ioredis";
import { createLogger } from "@workspace/logger";
import { REDIS_CONFIG } from "./config";

const logger = createLogger("Redis [${instLabel}]");

let clientInstance: Redis | null = null;

export function createRedisClient(): Redis {
  const envKey = REDIS_CONFIG.connectionEnv;
  const redisUrl =
    process.env[envKey] ||
    process.env.REDIS_URL ||
    \`redis://\${REDIS_CONFIG.defaultHost}:\${REDIS_CONFIG.defaultPort}\`;

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      const delay = Math.min(times * 50, 2000);
      logger.warn(
        \`Redis [\${REDIS_CONFIG.label}] connection lost. Retrying in \${delay}ms...\`,
      );
      return delay;
    },
    reconnectOnError(err: Error) {
      const targetError = "READONLY";
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    },
  });

  client.on("connect", () => {
    logger.info(
      \`Connected to Redis [\${REDIS_CONFIG.label}] successfully (\${redisUrl})\`,
    );
  });

  client.on("error", (err: Error) => {
    logger.error(\`Redis [\${REDIS_CONFIG.label}] connection error:\`, err);
  });

  return client;
}

export async function getRedisClient(): Promise<Redis> {
  if (!clientInstance) {
    clientInstance = createRedisClient();
  }
  return clientInstance;
}

export async function closeRedisConnection(): Promise<void> {
  if (clientInstance) {
    await clientInstance.quit();
    clientInstance = null;
    logger.info(\`Closed Redis connection for [\${REDIS_CONFIG.label}]\`);
  }
}
`;

  return {
    filename: "src/client.ts",
    language: "typescript",
    content: clientContent,
  };
}

export function generateCache(instLabel: string): CompiledFile {
  const cacheContent = `import { getRedisClient } from "./client";
import { createLogger } from "@workspace/logger";

const logger = createLogger("RedisCache [${instLabel}]");

export async function getCache<T = Record<string, string | number | boolean | null>>(key: string): Promise<T | null> {
  try {
    const redis = await getRedisClient();
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    logger.error(\`Error reading key [\${key}] from Redis cache\`, error);
    return null;
  }
}

export async function setCache<T = Record<string, string | number | boolean | null>>(
  key: string,
  value: T,
  ttlSeconds?: number,
): Promise<void> {
  try {
    const redis = await getRedisClient();
    const serialized = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await redis.setex(key, ttlSeconds, serialized);
    } else {
      await redis.set(key, serialized);
    }
    logger.info(\`Cached key [\${key}]\${ttlSeconds ? \` with TTL \${ttlSeconds}s\` : ""}\`);
  } catch (error) {
    logger.error(\`Error setting key [\${key}] in Redis cache\`, error);
    throw error;
  }
}

export async function deleteCache(key: string): Promise<boolean> {
  try {
    const redis = await getRedisClient();
    const result = await redis.del(key);
    return result > 0;
  } catch (error) {
    logger.error(\`Error deleting key [\${key}] from Redis cache\`, error);
    return false;
  }
}

export async function hasCache(key: string): Promise<boolean> {
  try {
    const redis = await getRedisClient();
    const result = await redis.exists(key);
    return result > 0;
  } catch (error) {
    logger.error(\`Error checking existence of key [\${key}] in Redis cache\`, error);
    return false;
  }
}

export async function getOrSetCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds?: number,
): Promise<T> {
  const cached = await getCache<T>(key);
  if (cached !== null && cached !== undefined) {
    return cached;
  }
  const fresh = await fetcher();
  await setCache(key, fresh, ttlSeconds);
  return fresh;
}

export async function flushCache(): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.flushdb();
    logger.info("Flushed current Redis database");
  } catch (error) {
    logger.error("Error flushing Redis database", error);
    throw error;
  }
}
`;

  return {
    filename: "src/cache.ts",
    language: "typescript",
    content: cacheContent,
  };
}

export function generatePubSub(instLabel: string): CompiledFile {
  const pubsubContent = `import Redis from "ioredis";
import { createRedisClient } from "./client";
import { createLogger } from "@workspace/logger";

const logger = createLogger("RedisPubSub [${instLabel}]");

let pubClient: Redis | null = null;
let subClient: Redis | null = null;

export async function publishRedisMessage<T = Record<string, string | number | boolean | null>>(
  channel: string,
  message: T,
): Promise<number> {
  try {
    if (!pubClient) {
      pubClient = createRedisClient();
    }
    const payload = JSON.stringify(message);
    const count = await pubClient.publish(channel, payload);
    logger.info(
      \`Published message to Redis channel [\${channel}], received by \${count} subscriber(s)\`,
    );
    return count;
  } catch (error) {
    logger.error(\`Failed to publish message to Redis channel [\${channel}]\`, error);
    throw error;
  }
}

export async function subscribeRedisChannel<T = Record<string, string | number | boolean | null>>(
  channel: string,
  handler: (message: T, channelName: string) => void | Promise<void>,
): Promise<Redis> {
  if (!subClient) {
    subClient = createRedisClient();
  }

  await subClient.subscribe(channel);
  logger.info(\`Subscribed to Redis channel [\${channel}]\`);

  subClient.on("message", async (chan: string, rawMsg: string) => {
    if (chan === channel) {
      try {
        const parsed = JSON.parse(rawMsg) as T;
        await handler(parsed, chan);
      } catch (err) {
        logger.error(\`Failed to process message on channel [\${chan}]\`, err);
      }
    }
  });

  return subClient;
}
`;

  return {
    filename: "src/pubsub.ts",
    language: "typescript",
    content: pubsubContent,
  };
}

export function generateStreams(instLabel: string): CompiledFile {
  const streamsContent = `import { getRedisClient } from "./client";
import { createLogger } from "@workspace/logger";

const logger = createLogger("RedisStreams [${instLabel}]");

export async function addStreamEntry(
  streamKey: string,
  values: Record<string, string>,
): Promise<string> {
  try {
    const redis = await getRedisClient();
    const args: string[] = [];
    Object.entries(values).forEach(([k, v]) => {
      args.push(k, v);
    });
    const entryId = await redis.xadd(streamKey, "*", ...args);
    logger.info(\`Added entry [\${entryId}] to Redis Stream [\${streamKey}]\`);
    return String(entryId);
  } catch (error) {
    logger.error(\`Failed to add entry to Redis Stream [\${streamKey}]\`, error);
    throw error;
  }
}

export async function createConsumerGroup(
  streamKey: string,
  groupName: string,
  startId: string = "$",
): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.xgroup("CREATE", streamKey, groupName, startId, "MKSTREAM");
    logger.info(
      \`Created Redis Stream consumer group [\${groupName}] on stream [\${streamKey}]\`,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("BUSYGROUP")) {
      logger.info(
        \`Consumer group [\${groupName}] already exists on stream [\${streamKey}]\`,
      );
    } else {
      logger.error(\`Error creating consumer group [\${groupName}]\`, error);
      throw error;
    }
  }
}

type StreamGroupResponse = Array<[string, Array<[string, string[]]>]>;

export async function readStreamGroup(
  streamKey: string,
  groupName: string,
  consumerName: string,
  count: number = 10,
): Promise<Array<{ id: string; message: Record<string, string> }>> {
  try {
    const redis = await getRedisClient();
    const raw = await redis.xreadgroup(
      "GROUP",
      groupName,
      consumerName,
      "COUNT",
      count,
      "STREAMS",
      streamKey,
      ">",
    );
    const response = (raw || []) as StreamGroupResponse;

    if (response.length === 0) {
      return [];
    }

    const results: Array<{ id: string; message: Record<string, string> }> = [];
    const firstStream = response[0];
    if (!firstStream) return [];
    const [, entries] = firstStream;

    for (const [id, rawFields] of entries) {
      const messageObj: Record<string, string> = {};
      for (let i = 0; i < rawFields.length; i += 2) {
        const k = rawFields[i];
        const v = rawFields[i + 1];
        if (k && v !== undefined) {
          messageObj[k] = v;
        }
      }
      results.push({ id, message: messageObj });
    }

    return results;
  } catch (error) {
    logger.error(
      \`Error reading from stream group [\${groupName}] on stream [\${streamKey}]\`,
      error,
    );
    throw error;
  }
}
`;

  return {
    filename: "src/streams.ts",
    language: "typescript",
    content: streamsContent,
  };
}

export function generateIndex(
  instLabel: string,
  packageName: string,
  hasSchemas: boolean,
): CompiledFile {
  const indexContent = `/**
 * Redis Package for ${instLabel} (${packageName})
 */
export * from "./config";
export * from "./client";
export * from "./cache";
export * from "./pubsub";
export * from "./streams";
${hasSchemas ? `export * from "./schemas";\nexport * from "./helpers";\n` : ""}`;

  return {
    filename: "src/index.ts",
    language: "typescript",
    content: indexContent,
  };
}
