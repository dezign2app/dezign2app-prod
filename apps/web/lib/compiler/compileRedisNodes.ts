import { BackendNode, BackendEdge } from "@/types/canvas";
import { CompiledFile, CompiledRedisResult, ReusableFunction } from "@workspace/canvas/types";
import { toVarName, toPascalCase } from "./utils";

function extractTemplateParams(template: string): string[] {
  const matches = template.match(/\{([a-zA-Z0-9_]+)\}/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map((m) => m.slice(1, -1))));
}

function mapColumnTypeToTs(colType: string): string {
  const t = (colType || "").toUpperCase();
  if (t === "INTEGER" || t === "INT" || t === "REAL" || t === "FLOAT" || t === "NUMERIC" || t === "NUMBER") {
    return "number";
  }
  if (t === "BOOLEAN" || t === "BOOL") {
    return "boolean";
  }
  if (t === "JSON" || t === "OBJECT") {
    return "Record<string, unknown>";
  }
  if (t === "ARRAY") {
    return "unknown[]";
  }
  return "string";
}

/**
 * Compiles Redis nodes into a shared microservices package: packages/redis (@workspace/redis)
 */
export function compileRedisNodes(
  allNodes: BackendNode[],
  allEdges: BackendEdge[] = [],
): CompiledRedisResult {
  const files: CompiledFile[] = [];
  const reusableFunctions: ReusableFunction[] = [];

  const redisInstances = allNodes.filter(
    (n) => n.type === "redis_instance" || (n.type === "database" && n.data?.dbEngine === "redis"),
  );

  const redisSchemas = allNodes.filter(
    (n) => n.type === "redis_schema" || (n.type === "entity" && n.data?.dbType === "redis"),
  );

  const redisMessaging = allNodes.filter(
    (n) => n.type === "redis-streams" || n.type === "redis-pubsub" || n.type === "redis-cache",
  );

  const totalRedisNodes = redisInstances.length + redisSchemas.length + redisMessaging.length;
  if (totalRedisNodes === 0) {
    return { files: [], reusableFunctions: [] };
  }

  // 0. Resolve Package Folder and Npm Package Name from Redis Instance Label
  const primaryInstance = redisInstances[0];
  const rawInstanceLabel = primaryInstance?.data?.label || "";
  const packageFolder =
    rawInstanceLabel && rawInstanceLabel.trim().toLowerCase() !== "redis"
      ? rawInstanceLabel
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, "-")
          .replace(/^-+|-+$/g, "") || "redis"
      : "redis";
  const packageName = `@workspace/${packageFolder}`;

  // 1. package.json
  const packageJson = JSON.stringify(
    {
      name: packageName,
      version: "0.0.0",
      private: true,
      description:
        "Shared Redis client, caching schemas, pub/sub, streams, and data structure helpers",
      main: "src/index.ts",
      types: "src/index.ts",
      scripts: {
        build: "tsc",
        "check-types": "tsc --noEmit",
      },
      dependencies: {
        ioredis: "^5.4.1",
        "@workspace/logger": "workspace:*",
        "@workspace/types": "workspace:*",
      },
      devDependencies: {
        "@workspace/typescript-config": "workspace:*",
        typescript: "^5.3.3",
      },
    },
    null,
    2,
  );
  files.push({
    filename: "package.json",
    language: "json",
    content: packageJson,
  });

  // 2. tsconfig.json
  const tsConfig = JSON.stringify(
    {
      extends: "@workspace/typescript-config/base.json",
      compilerOptions: {
        outDir: "./dist",
        rootDir: "./src",
      },
      include: ["src/**/*"],
    },
    null,
    2,
  );
  files.push({
    filename: "tsconfig.json",
    language: "json",
    content: tsConfig,
  });

  // 3. Resolve primary Redis instance settings
  const redisEnvKey = primaryInstance?.data?.connectionStringEnv || "REDIS_URL";
  const maxmemoryPolicy = primaryInstance?.data?.maxmemoryPolicy || "volatile-lru";
  const maxmemory = primaryInstance?.data?.maxmemory || "2gb";
  const persistenceMode = primaryInstance?.data?.persistenceMode || "RDB+AOF";

  // 4. src/config.ts
  const configContent = `/**
 * Redis Configuration & Node Catalog
 */
export const REDIS_CONFIG = {
  connectionEnv: "${redisEnvKey}",
  defaultHost: "localhost",
  defaultPort: 6379,
  maxmemoryPolicy: "${maxmemoryPolicy}",
  maxmemory: "${maxmemory}",
  persistenceMode: "${persistenceMode}",
  instances: [
${redisInstances
  .map(
    (inst, idx) => `    {
      id: "${inst.id}",
      label: "${inst.data?.label || `Redis_Instance_${idx + 1}`}",
      connectionEnv: "${inst.data?.connectionStringEnv || (idx === 0 ? "REDIS_URL" : `${(inst.data?.label || `REDIS_${idx + 1}`).toUpperCase().replace(/[^A-Z0-9_]/g, "_")}_URL`)}",
      defaultPort: ${6379 + idx},
      maxmemoryPolicy: "${inst.data?.maxmemoryPolicy || "volatile-lru"}",
      maxmemory: "${inst.data?.maxmemory || "2gb"}",
      persistenceMode: "${inst.data?.persistenceMode || "RDB+AOF"}",
    },`,
  )
  .join("\n")}
  ],
  schemas: [
${redisSchemas
  .map((s) => {
    const keyTmpl = s.data?.keyTemplate || `${(s.data?.label || "cache").toLowerCase()}:{id}`;
    const struct = s.data?.redisDataStructure || "hash";
    const ttlVal = typeof s.data?.ttl === "object" ? s.data?.ttl?.value || 3600 : 3600;
    const parentInst = redisInstances.find((i) => i.id === s.data?.databaseId);
    return `    {
      id: "${s.id}",
      label: "${s.data?.label || "Cache"}",
      databaseId: "${s.data?.databaseId || ""}",
      databaseLabel: "${parentInst?.data?.label || "Primary_Redis_Cache"}",
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
  files.push({
    filename: "src/config.ts",
    language: "typescript",
    content: configContent,
  });

  // 5. src/client.ts
  const clientContent = `import Redis from "ioredis";
import { createLogger } from "@workspace/logger";
import { REDIS_CONFIG } from "./config";

const logger = createLogger("Redis");

const clientPool = new Map<string, Redis>();

export function createRedisClient(instanceIdentifier?: string): Redis {
  const instance =
    REDIS_CONFIG.instances.find(
      (i) =>
        i.label === instanceIdentifier ||
        i.id === instanceIdentifier ||
        i.connectionEnv === instanceIdentifier,
    ) || REDIS_CONFIG.instances[0];

  const envKey = instance?.connectionEnv || REDIS_CONFIG.connectionEnv;
  const defaultPort = (instance as { defaultPort?: number })?.defaultPort || REDIS_CONFIG.defaultPort;
  const redisUrl =
    process.env[envKey] ||
    (instanceIdentifier === undefined ? process.env.REDIS_URL : undefined) ||
    \`redis://\${REDIS_CONFIG.defaultHost}:\${defaultPort}\`;

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      logger.warn(
        \`Redis [\${instance?.label || "default"}] connection lost. Retrying in \${delay}ms...\`,
      );
      return delay;
    },
    reconnectOnError(err) {
      const targetError = "READONLY";
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    },
  });

  client.on("connect", () => {
    logger.info(
      \`Connected to Redis [\${instance?.label || "default"}] successfully (\${redisUrl})\`,
    );
  });

  client.on("error", (err) => {
    logger.error(\`Redis [\${instance?.label || "default"}] connection error:\`, err);
  });

  return client;
}

export async function getRedisClient(instanceIdentifier?: string): Promise<Redis> {
  const key = instanceIdentifier || "default";
  if (!clientPool.has(key)) {
    clientPool.set(key, createRedisClient(instanceIdentifier));
  }
  return clientPool.get(key)!;
}

export async function closeRedisConnection(instanceIdentifier?: string): Promise<void> {
  const key = instanceIdentifier || "default";
  const client = clientPool.get(key);
  if (client) {
    await client.quit();
    clientPool.delete(key);
    logger.info(\`Closed Redis connection for [\${key}]\`);
  }
}

export async function closeAllRedisConnections(): Promise<void> {
  for (const [key, client] of clientPool.entries()) {
    await client.quit();
    logger.info(\`Closed Redis connection for [\${key}]\`);
  }
  clientPool.clear();
}
`;
  files.push({
    filename: "src/client.ts",
    language: "typescript",
    content: clientContent,
  });

  // 6. src/cache.ts
  const cacheContent = `import { getRedisClient } from "./client";
import { createLogger } from "@workspace/logger";

const logger = createLogger("RedisCache");

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
  files.push({
    filename: "src/cache.ts",
    language: "typescript",
    content: cacheContent,
  });

  // 7. src/pubsub.ts
  const pubsubContent = `import Redis from "ioredis";
import { createRedisClient } from "./client";
import { createLogger } from "@workspace/logger";

const logger = createLogger("RedisPubSub");

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

  subClient.on("message", async (chan, rawMsg) => {
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
  files.push({
    filename: "src/pubsub.ts",
    language: "typescript",
    content: pubsubContent,
  });

  // 8. src/streams.ts
  const streamsContent = `import { getRedisClient } from "./client";
import { createLogger } from "@workspace/logger";

const logger = createLogger("RedisStreams");

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
  files.push({
    filename: "src/streams.ts",
    language: "typescript",
    content: streamsContent,
  });

  // 9. Generate Schema-Specific Modules in src/schemas/
  const schemaExports: string[] = [];

  redisSchemas.forEach((schemaNode) => {
    const rawLabel = schemaNode.data?.label || schemaNode.id || "Cache";
    const varName = toVarName(rawLabel) || "cache";
    const typeName = toPascalCase(rawLabel) || "Cache";
    const fileName = `${varName}.ts`;

    const dataStructure = (schemaNode.data?.redisDataStructure || "hash").toLowerCase();
    const keyTemplate =
      schemaNode.data?.keyTemplate || `${varName.toLowerCase()}:{id}`;
    const pattern = keyTemplate.replace(/\{[a-zA-Z0-9_]+\}/g, "*");
    const templateParams = extractTemplateParams(keyTemplate);
    const keyArgsSig =
      templateParams.length > 0
        ? templateParams.map((p) => `${p}: string | number`).join(", ")
        : "id: string | number";

    let keyTemplateLiteral = keyTemplate;
    if (templateParams.length > 0) {
      templateParams.forEach((p) => {
        keyTemplateLiteral = keyTemplateLiteral.replace(`{${p}}`, `\${${p}}`);
      });
    } else {
      keyTemplateLiteral = `${keyTemplate}:\${id}`;
    }

    const ttlSeconds =
      typeof schemaNode.data?.ttl === "object" ? schemaNode.data?.ttl?.value || 3600 : 3600;

    // Build TypeScript Interface
    const columns = schemaNode.data?.columns || [];
    const fields =
      schemaNode.data?.hashConfig?.fields ||
      columns.map((c) => ({
        name: c.name,
        type: mapColumnTypeToTs(c.type),
        required: Boolean(c.isPrimaryKey || c.isNotNull),
      }));

    const interfaceFields =
      fields.length > 0
        ? fields
            .map((f) => `  ${f.name}${f.required ? "" : "?"}: ${f.type || "string"};`)
            .join("\n")
        : "  id: string;\n  [key: string]: string | number | boolean | null | undefined;";

    const attachedInstance = redisInstances.find(
      (i) => i.id === schemaNode.data?.databaseId,
    );
    const instanceClientArg = attachedInstance?.data?.label
      ? `"${attachedInstance.data.label}"`
      : "";

    let structureSpecificCode = "";

    if (dataStructure === "hash") {
      structureSpecificCode = `
/**
 * Retrieve entire Hash object for ${typeName}
 */
export async function get${typeName}(${keyArgsSig}): Promise<${typeName} | null> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient(${instanceClientArg});
    const raw = await redis.hgetall(key);
    if (!raw || Object.keys(raw).length === 0) return null;
    return raw as unknown as ${typeName};
  } catch (error) {
    logger.error(\`Failed to get \${key} from Redis Hash\`, error);
    return null;
  }
}

/**
 * Set Hash fields for ${typeName}
 */
export async function set${typeName}(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  data: Partial<${typeName}>,
  ttlSeconds: number = ${typeName.toUpperCase()}_TTL_SECONDS,
): Promise<void> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient(${instanceClientArg});
    const entries: Record<string, string> = {};
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        entries[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
      }
    });
    if (Object.keys(entries).length > 0) {
      await redis.hset(key, entries);
      if (ttlSeconds > 0) {
        await redis.expire(key, ttlSeconds);
      }
    }
  } catch (error) {
    logger.error(\`Failed to set \${key} in Redis Hash\`, error);
    throw error;
  }
}

/**
 * Get a specific field from ${typeName}
 */
export async function get${typeName}Field<K extends keyof ${typeName}>(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  field: K,
): Promise<${typeName}[K] | null> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient(${instanceClientArg});
    const val = await redis.hget(key, String(field));
    return (val as unknown as ${typeName}[K]) ?? null;
  } catch (error) {
    logger.error(\`Failed to get field \${String(field)} from \${key}\`, error);
    return null;
  }
}

/**
 * Set a single field in ${typeName}
 */
export async function set${typeName}Field<K extends keyof ${typeName}>(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  field: K,
  value: ${typeName}[K],
): Promise<void> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient(${instanceClientArg});
    const valStr = typeof value === "object" ? JSON.stringify(value) : String(value);
    await redis.hset(key, String(field), valStr);
  } catch (error) {
    logger.error(\`Failed to set field \${String(field)} on \${key}\`, error);
    throw error;
  }
}
`;
    } else if (dataStructure === "list") {
      structureSpecificCode = `
/**
 * Push items to ${typeName} List
 */
export async function push${typeName}(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  ...items: string[]
): Promise<number> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient(${instanceClientArg});
    return await redis.rpush(key, ...items);
  } catch (error) {
    logger.error(\`Failed to push items to List \${key}\`, error);
    throw error;
  }
}

/**
 * Pop item from ${typeName} List
 */
export async function pop${typeName}(${keyArgsSig}): Promise<string | null> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient(${instanceClientArg});
    return await redis.lpop(key);
  } catch (error) {
    logger.error(\`Failed to pop from List \${key}\`, error);
    return null;
  }
}

/**
 * Get range of items from ${typeName} List
 */
export async function get${typeName}List(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  start: number = 0,
  stop: number = -1,
): Promise<string[]> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient(${instanceClientArg});
    return await redis.lrange(key, start, stop);
  } catch (error) {
    logger.error(\`Failed to read List \${key}\`, error);
    return [];
  }
}
`;
    } else if (dataStructure === "set") {
      structureSpecificCode = `
/**
 * Add members to ${typeName} Set
 */
export async function add${typeName}Members(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  ...members: string[]
): Promise<number> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient(${instanceClientArg});
    return await redis.sadd(key, ...members);
  } catch (error) {
    logger.error(\`Failed to add members to Set \${key}\`, error);
    throw error;
  }
}

/**
 * Check if member exists in ${typeName} Set
 */
export async function is${typeName}Member(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  member: string,
): Promise<boolean> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient(${instanceClientArg});
    const result = await redis.sismember(key, member);
    return result === 1;
  } catch (error) {
    logger.error(\`Failed to check membership in Set \${key}\`, error);
    return false;
  }
}

/**
 * Get all members of ${typeName} Set
 */
export async function get${typeName}Members(${keyArgsSig}): Promise<string[]> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient(${instanceClientArg});
    return await redis.smembers(key);
  } catch (error) {
    logger.error(\`Failed to get members of Set \${key}\`, error);
    return [];
  }
}
`;
    } else if (dataStructure === "zset" || dataStructure === "sorted_set") {
      structureSpecificCode = `
/**
 * Add or update member score in ${typeName} Sorted Set
 */
export async function add${typeName}Score(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  score: number,
  member: string,
): Promise<number> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient(${instanceClientArg});
    return await redis.zadd(key, score, member);
  } catch (error) {
    logger.error(\`Failed to add score to ZSet \${key}\`, error);
    throw error;
  }
}

/**
 * Get member rank in ${typeName} Sorted Set
 */
export async function get${typeName}Rank(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  member: string,
): Promise<number | null> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient(${instanceClientArg});
    return await redis.zrevrank(key, member);
  } catch (error) {
    logger.error(\`Failed to get rank in ZSet \${key}\`, error);
    return null;
  }
}

/**
 * Get top ranked members in ${typeName} Sorted Set
 */
export async function get${typeName}Top(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  limit: number = 10,
): Promise<string[]> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient(${instanceClientArg});
    return await redis.zrevrange(key, 0, limit - 1);
  } catch (error) {
    logger.error(\`Failed to get top members from ZSet \${key}\`, error);
    return [];
  }
}
`;
    } else {
      // Default / String / JSON structure
      structureSpecificCode = `
/**
 * Retrieve cached value for ${typeName}
 */
export async function get${typeName}(${keyArgsSig}): Promise<${typeName} | null> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  return getCache<${typeName}>(key);
}

/**
 * Store cached value for ${typeName}
 */
export async function set${typeName}(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  value: ${typeName},
  ttlSeconds: number = ${typeName.toUpperCase()}_TTL_SECONDS,
): Promise<void> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  return setCache<${typeName}>(key, value, ttlSeconds);
}
`;
    }

    const schemaModuleContent = `import { getRedisClient } from "../client";
import { getCache, setCache, deleteCache } from "../cache";
import { createLogger } from "@workspace/logger";

const logger = createLogger("${typeName}");

/**
 * TypeScript Data Structure Interface for ${typeName}
 */
export interface ${typeName} {
${interfaceFields}
}

/**
 * Canonical Key Pattern and TTL for ${typeName}
 */
export const ${typeName.toUpperCase()}_KEY_PATTERN = "${pattern}";
export const ${typeName.toUpperCase()}_TTL_SECONDS = ${ttlSeconds};

/**
 * Generate Redis Key for ${typeName}
 */
export function get${typeName}Key(${keyArgsSig}): string {
  return \`${keyTemplateLiteral}\`;
}
${structureSpecificCode}
/**
 * Invalidate a specific ${typeName} key
 */
export async function invalidate${typeName}(${keyArgsSig}): Promise<boolean> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  return deleteCache(key);
}

/**
 * Invalidate all keys matching ${typeName} pattern
 */
export async function invalidateAll${typeName}(): Promise<number> {
  try {
    const redis = await getRedisClient(${instanceClientArg});
    const stream = redis.scanStream({ match: ${typeName.toUpperCase()}_KEY_PATTERN, count: 100 });
    let deletedCount = 0;
    for await (const resultKeys of stream) {
      const keys = resultKeys as string[];
      if (keys.length > 0) {
        await redis.del(...keys);
        deletedCount += keys.length;
      }
    }
    logger.info(\`Invalidated \${deletedCount} keys matching [\${${typeName.toUpperCase()}_KEY_PATTERN}]\`);
    return deletedCount;
  } catch (error) {
    logger.error(\`Failed to invalidate all keys for \${${typeName.toUpperCase()}_KEY_PATTERN}\`, error);
    return 0;
  }
}
`;

    files.push({
      filename: `src/schemas/${fileName}`,
      language: "typescript",
      content: schemaModuleContent,
    });

    schemaExports.push(`export * from "./${varName}";`);

    // Register reusable function metadata
    reusableFunctions.push({
      name: `get${typeName}`,
      importPath: packageName,
      signature: `get${typeName}(${keyArgsSig}): Promise<${typeName} | null>`,
      targetName: varName,
      kind: "findById",
    });

    reusableFunctions.push({
      name: `set${typeName}`,
      importPath: packageName,
      signature: `set${typeName}(${keyArgsSig ? `${keyArgsSig}, ` : ""}data: Partial<${typeName}>): Promise<void>`,
      targetName: varName,
      kind: "create",
    });

    reusableFunctions.push({
      name: `invalidate${typeName}`,
      importPath: packageName,
      signature: `invalidate${typeName}(${keyArgsSig}): Promise<boolean>`,
      targetName: varName,
      kind: "delete",
    });
  });

  // 10. src/schemas/index.ts
  const schemasIndexContent = `/**
 * Generated Typed Redis Schemas
 */
${schemaExports.join("\n")}
`;
  files.push({
    filename: "src/schemas/index.ts",
    language: "typescript",
    content: schemasIndexContent,
  });

  // 11. src/index.ts
  const indexContent = `/**
 * Shared Redis Package (${packageName})
 */
export * from "./config";
export * from "./client";
export * from "./cache";
export * from "./pubsub";
export * from "./streams";
export * from "./schemas";
`;
  files.push({
    filename: "src/index.ts",
    language: "typescript",
    content: indexContent,
  });

  // 12. docker-compose.yml (Multi-Instance aware)
  const dockerServices = redisInstances
    .map((inst, idx) => {
      const port = 6379 + idx;
      const svcName =
        inst.data?.label
          ?.toLowerCase()
          .replace(/[^a-z0-9_-]/g, "-") || `redis-${idx + 1}`;
      const instPersistence = inst.data?.persistenceMode || persistenceMode;
      const instMaxmemory = inst.data?.maxmemory || maxmemory;
      const instPolicy = inst.data?.maxmemoryPolicy || maxmemoryPolicy;
      const pFlag =
        instPersistence === "None"
          ? '--save "" --appendonly no'
          : instPersistence === "RDB"
            ? "--save 60 1 --appendonly no"
            : instPersistence === "AOF"
              ? '--save "" --appendonly yes'
              : "--save 60 1 --appendonly yes";

      return `  ${svcName}:
    image: redis:7-alpine
    container_name: ${svcName}
    ports:
      - "${port}:6379"
    volumes:
      - ${svcName.replace(/-/g, "_")}_data:/data
    command: redis-server --maxmemory ${instMaxmemory} --maxmemory-policy ${instPolicy} ${pFlag}`;
    })
    .join("\n\n");

  const dockerVolumes = redisInstances
    .map((inst, idx) => {
      const svcName =
        inst.data?.label
          ?.toLowerCase()
          .replace(/[^a-z0-9_-]/g, "-") || `redis-${idx + 1}`;
      return `  ${svcName.replace(/-/g, "_")}_data:`;
    })
    .join("\n");

  const dockerComposeContent = `version: "3.8"

services:
${dockerServices}

volumes:
${dockerVolumes}
`;
  files.push({
    filename: "docker-compose.yml",
    language: "yaml",
    content: dockerComposeContent,
  });

  return { files, reusableFunctions, packageFolder, packageName };
}
