import { BackendNode, BackendEdge } from "@/types/canvas";
import {
  Endpoint,
  CompiledFile,
  CompiledRedisResult,
  CompiledRedisPackage,
  ReusableFunction,
} from "@workspace/canvas/types";
import { toVarName, toPascalCase, toFolderName } from "./utils";
import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";

function extractTemplateParams(template: string): string[] {
  const matches = template.match(/\{([a-zA-Z0-9_]+)\}/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map((m) => m.slice(1, -1))));
}

function mapColumnTypeToTs(colType: string): string {
  const t = (colType || "").toUpperCase();
  if (
    t === "INTEGER" ||
    t === "INT" ||
    t === "REAL" ||
    t === "FLOAT" ||
    t === "NUMERIC" ||
    t === "NUMBER"
  ) {
    return "number";
  }
  if (t === "BOOLEAN" || t === "BOOL") {
    return "boolean";
  }
  if (t === "JSON" || t === "OBJECT") {
    return "Record<string, string | number | boolean | null>";
  }
  if (t === "ARRAY") {
    return "string[]";
  }
  return "string";
}

/**
 * Compiles Redis nodes into modular shared microservices packages:
 * Generates one dedicated package per Redis instance (e.g. packages/primary-redis-cache),
 * with schemas in src/schemas/ and per-function helper files in src/helpers/<cacheName>/<functionName>.ts.
 */
export function compileRedisNodes(
  allNodes: BackendNode[],
  allEdges: BackendEdge[] = [],
): CompiledRedisResult {
  const redisInstances = allNodes.filter(
    (n) =>
      n.type === "redis_instance" ||
      (n.type === "database" &&
        (n.data?.dbEngine === "redis" || n.data?.dbType === "redis")),
  );

  const redisSchemas = allNodes.filter(
    (n) =>
      n.type === "redis_schema" ||
      (n.type === "entity" && n.data?.dbType === "redis"),
  );

  const redisMessaging = allNodes.filter(
    (n) =>
      n.type === "redis-streams" ||
      n.type === "redis-pubsub" ||
      n.type === "redis-cache",
  );

  const totalRedisNodes =
    redisInstances.length + redisSchemas.length + redisMessaging.length;
  if (totalRedisNodes === 0) {
    return { files: [], packages: [], reusableFunctions: [] };
  }

  // 1. Resolve Effective Redis Instances
  const effectiveInstances: BackendNode[] =
    redisInstances.length > 0
      ? [...redisInstances]
      : [
          {
            id: "synthetic-redis",
            type: "redis_instance",
            position: { x: 0, y: 0 },
            fractionalIndex: "a0",
            data: {
              label: "redis",
              host: "localhost",
              port: 6379,
            },
          },
        ];

  // 2. Map schemas to instances
  const schemasByInstanceId = new Map<string, BackendNode[]>();
  effectiveInstances.forEach((inst) => {
    schemasByInstanceId.set(inst.id, []);
    const altId = inst.nodeId;
    if (altId && altId !== inst.id) {
      schemasByInstanceId.set(altId, schemasByInstanceId.get(inst.id)!);
    }
  });

  const primaryInstanceNode =
    effectiveInstances.find((d) => d.data?.isDefault) || effectiveInstances[0]!;

  redisSchemas.forEach((schemaNode) => {
    const schemaId = schemaNode.id || schemaNode.nodeId;
    let targetInstId = schemaNode.data?.databaseId;

    if (!targetInstId) {
      const connEdge = allEdges.find(
        (e) =>
          ((e.source === schemaId || e.source === schemaNode.id) &&
            effectiveInstances.some(
              (inst) => inst.id === e.target || inst.nodeId === e.target,
            )) ||
          ((e.target === schemaId || e.target === schemaNode.id) &&
            effectiveInstances.some(
              (inst) => inst.id === e.source || inst.nodeId === e.source,
            )),
      );
      if (connEdge) {
        targetInstId =
          connEdge.source === schemaId || connEdge.source === schemaNode.id
            ? connEdge.target
            : connEdge.source;
      }
    }

    if (!targetInstId || !schemasByInstanceId.has(targetInstId)) {
      targetInstId = primaryInstanceNode.id;
    }

    const bucket = schemasByInstanceId.get(targetInstId);
    if (bucket && !bucket.includes(schemaNode)) {
      bucket.push(schemaNode);
    }
  });

  // 3. Compile each Redis instance into its dedicated package
  const existingFolders = new Set<string>();
  const packages: CompiledRedisPackage[] = [];
  const mergedFiles: CompiledFile[] = [];
  const allReusableFunctions: ReusableFunction[] = [];

  effectiveInstances.forEach((inst) => {
    const rawLabel = inst.data?.label || "redis";
    const baseFolder = toFolderName(rawLabel) || "redis";
    let packageFolder = baseFolder;
    let counter = 1;
    while (existingFolders.has(packageFolder)) {
      counter++;
      packageFolder = `${baseFolder}-${counter}`;
    }
    existingFolders.add(packageFolder);

    const packageName = `@workspace/${packageFolder}`;
    const instanceSchemas = schemasByInstanceId.get(inst.id) || [];

    const instLabel = inst.data?.label || packageFolder;
    const instHost = inst.data?.host || "localhost";
    const instPort = inst.data?.port ? Number(inst.data.port) : 6379;
    const instEnvKey =
      inst.data?.connectionStringEnv ||
      (packageFolder === "redis"
        ? "REDIS_URL"
        : `${packageFolder.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}_URL`);
    const maxmemoryPolicy = inst.data?.maxmemoryPolicy || "volatile-lru";
    const maxmemory = inst.data?.maxmemory || "2gb";
    const persistenceMode = inst.data?.persistenceMode || "RDB+AOF";

    const instanceFiles: CompiledFile[] = [];
    const instanceReusableFunctions: ReusableFunction[] = [];

    // 3.1. package.json
    const packageJson = JSON.stringify(
      {
        name: packageName,
        version: "0.0.0",
        private: true,
        description: `Redis client, caching schemas, pub/sub, streams, and data structure helpers for ${instLabel}`,
        main: "src/index.ts",
        types: "src/index.ts",
        exports: {
          ".": "./src/index.ts",
          "./client": "./src/client.ts",
          "./config": "./src/config.ts",
          "./cache": "./src/cache.ts",
          "./pubsub": "./src/pubsub.ts",
          "./streams": "./src/streams.ts",
          "./schemas": "./src/schemas/index.ts",
          "./schemas/*": "./src/schemas/*.ts",
          "./helpers": "./src/helpers/index.ts",
          "./helpers/*": "./src/helpers/*",
        },
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
          "@types/node": "^20.11.0",
          "@workspace/typescript-config": "workspace:*",
          typescript: "^5.3.3",
        },
      },
      null,
      2,
    );
    instanceFiles.push({
      filename: "package.json",
      language: "json",
      content: packageJson,
    });

    // 3.2. tsconfig.json
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
    instanceFiles.push({
      filename: "tsconfig.json",
      language: "json",
      content: tsConfig,
    });

    // 3.3. src/config.ts
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
    instanceFiles.push({
      filename: "src/config.ts",
      language: "typescript",
      content: configContent,
    });

    // 3.4. src/client.ts
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
    instanceFiles.push({
      filename: "src/client.ts",
      language: "typescript",
      content: clientContent,
    });

    // 3.5. src/cache.ts
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
    instanceFiles.push({
      filename: "src/cache.ts",
      language: "typescript",
      content: cacheContent,
    });

    // 3.6. src/pubsub.ts
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
    instanceFiles.push({
      filename: "src/pubsub.ts",
      language: "typescript",
      content: pubsubContent,
    });

    // 3.7. src/streams.ts
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
    instanceFiles.push({
      filename: "src/streams.ts",
      language: "typescript",
      content: streamsContent,
    });

    // 3.8. Generate Schema Modules (src/schemas/) & Granular Helper Modules (src/helpers/<cacheName>/<fnName>.ts)
    const schemaBarrelExports: string[] = [];
    const helperBarrelExports: string[] = [];

    instanceSchemas.forEach((schemaNode) => {
      const rawSchemaLabel = schemaNode.data?.label || schemaNode.id || "Cache";
      const varName = toVarName(rawSchemaLabel) || "cache";
      const typeName = toPascalCase(rawSchemaLabel) || "Cache";

      const dataStructure = (
        schemaNode.data?.redisDataStructure || "hash"
      ).toLowerCase();
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
        typeof schemaNode.data?.ttl === "object"
          ? schemaNode.data?.ttl?.value || 3600
          : 3600;

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
              .map(
                (f) =>
                  `  ${f.name}${f.required ? "" : "?"}: ${f.type || "string"};`,
              )
              .join("\n")
          : "  id: string;\n  [key: string]: string | number | boolean | null | undefined;";

      // ── A. Schema Module (src/schemas/<varName>.ts) ──────────────────────────
      const schemaModuleContent = `/**
 * TypeScript Data Structure Interface & Key Patterns for ${typeName}
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
`;

      instanceFiles.push({
        filename: `src/schemas/${varName}.ts`,
        language: "typescript",
        content: schemaModuleContent,
      });

      schemaBarrelExports.push(`export * from "./${varName}";`);

      // ── B. Granular Helper Files (src/helpers/<varName>/<fnName>.ts) ────────
      const cacheHelperBarrelExports: string[] = [];

      if (dataStructure === "hash") {
        // 1. get<Name>.ts
        const getFnContent = `import { getRedisClient } from "../../client";
import { ${typeName}, get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("get${typeName}");

/**
 * Retrieve entire Hash object for ${typeName}
 */
export async function get${typeName}(${keyArgsSig}): Promise<${typeName} | null> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient();
    const raw = await redis.hgetall(key);
    if (!raw || Object.keys(raw).length === 0) return null;
    return raw as unknown as ${typeName};
  } catch (error) {
    logger.error(\`Failed to get \${key} from Redis Hash\`, error);
    return null;
  }
}

export const getAll${typeName}Fields = get${typeName};
`;
        instanceFiles.push({
          filename: `src/helpers/${varName}/get${typeName}.ts`,
          language: "typescript",
          content: getFnContent,
        });
        cacheHelperBarrelExports.push(`export * from "./get${typeName}";`);

        // 2. set<Name>.ts
        const setFnContent = `import { getRedisClient } from "../../client";
import {
  ${typeName},
  get${typeName}Key,
  ${typeName.toUpperCase()}_TTL_SECONDS,
} from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("set${typeName}");

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
    const redis = await getRedisClient();
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

export const set${typeName}Fields = set${typeName};
`;
        instanceFiles.push({
          filename: `src/helpers/${varName}/set${typeName}.ts`,
          language: "typescript",
          content: setFnContent,
        });
        cacheHelperBarrelExports.push(`export * from "./set${typeName}";`);

        // 3. get<Name>Field.ts
        const getFieldFnContent = `import { getRedisClient } from "../../client";
import { ${typeName}, get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("get${typeName}Field");

/**
 * Get a specific field from ${typeName}
 */
export async function get${typeName}Field<K extends keyof ${typeName}>(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  field: K,
): Promise<${typeName}[K] | null> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient();
    const val = await redis.hget(key, String(field));
    return (val as unknown as ${typeName}[K]) ?? null;
  } catch (error) {
    logger.error(\`Failed to get field \${String(field)} from \${key}\`, error);
    return null;
  }
}
`;
        instanceFiles.push({
          filename: `src/helpers/${varName}/get${typeName}Field.ts`,
          language: "typescript",
          content: getFieldFnContent,
        });
        cacheHelperBarrelExports.push(`export * from "./get${typeName}Field";`);

        // 4. set<Name>Field.ts
        const setFieldFnContent = `import { getRedisClient } from "../../client";
import { ${typeName}, get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("set${typeName}Field");

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
    const redis = await getRedisClient();
    const valStr = typeof value === "object" ? JSON.stringify(value) : String(value);
    await redis.hset(key, String(field), valStr);
  } catch (error) {
    logger.error(\`Failed to set field \${String(field)} on \${key}\`, error);
    throw error;
  }
}
`;
        instanceFiles.push({
          filename: `src/helpers/${varName}/set${typeName}Field.ts`,
          language: "typescript",
          content: setFieldFnContent,
        });
        cacheHelperBarrelExports.push(`export * from "./set${typeName}Field";`);
      } else if (dataStructure === "list") {
        // List structure functions
        const pushFnContent = `import { getRedisClient } from "../../client";
import { get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("push${typeName}");

/**
 * Push items to ${typeName} List
 */
export async function push${typeName}(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  ...items: string[]
): Promise<number> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient();
    return await redis.rpush(key, ...items);
  } catch (error) {
    logger.error(\`Failed to push items to List \${key}\`, error);
    throw error;
  }
}
`;
        instanceFiles.push({
          filename: `src/helpers/${varName}/push${typeName}.ts`,
          language: "typescript",
          content: pushFnContent,
        });
        cacheHelperBarrelExports.push(`export * from "./push${typeName}";`);

        const popFnContent = `import { getRedisClient } from "../../client";
import { get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("pop${typeName}");

/**
 * Pop item from ${typeName} List
 */
export async function pop${typeName}(${keyArgsSig}): Promise<string | null> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient();
    return await redis.lpop(key);
  } catch (error) {
    logger.error(\`Failed to pop from List \${key}\`, error);
    return null;
  }
}
`;
        instanceFiles.push({
          filename: `src/helpers/${varName}/pop${typeName}.ts`,
          language: "typescript",
          content: popFnContent,
        });
        cacheHelperBarrelExports.push(`export * from "./pop${typeName}";`);

        const getListFnContent = `import { getRedisClient } from "../../client";
import { get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("get${typeName}List");

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
    const redis = await getRedisClient();
    return await redis.lrange(key, start, stop);
  } catch (error) {
    logger.error(\`Failed to read List \${key}\`, error);
    return [];
  }
}
`;
        instanceFiles.push({
          filename: `src/helpers/${varName}/get${typeName}List.ts`,
          language: "typescript",
          content: getListFnContent,
        });
        cacheHelperBarrelExports.push(`export * from "./get${typeName}List";`);
      } else if (dataStructure === "set") {
        // Set structure functions
        const addMembersFnContent = `import { getRedisClient } from "../../client";
import { get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("add${typeName}Members");

/**
 * Add members to ${typeName} Set
 */
export async function add${typeName}Members(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  ...members: string[]
): Promise<number> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient();
    return await redis.sadd(key, ...members);
  } catch (error) {
    logger.error(\`Failed to add members to Set \${key}\`, error);
    throw error;
  }
}
`;
        instanceFiles.push({
          filename: `src/helpers/${varName}/add${typeName}Members.ts`,
          language: "typescript",
          content: addMembersFnContent,
        });
        cacheHelperBarrelExports.push(`export * from "./add${typeName}Members";`);

        const isMemberFnContent = `import { getRedisClient } from "../../client";
import { get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("is${typeName}Member");

/**
 * Check if member exists in ${typeName} Set
 */
export async function is${typeName}Member(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  member: string,
): Promise<boolean> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient();
    const result = await redis.sismember(key, member);
    return result === 1;
  } catch (error) {
    logger.error(\`Failed to check membership in Set \${key}\`, error);
    return false;
  }
}
`;
        instanceFiles.push({
          filename: `src/helpers/${varName}/is${typeName}Member.ts`,
          language: "typescript",
          content: isMemberFnContent,
        });
        cacheHelperBarrelExports.push(`export * from "./is${typeName}Member";`);

        const getMembersFnContent = `import { getRedisClient } from "../../client";
import { get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("get${typeName}Members");

/**
 * Get all members of ${typeName} Set
 */
export async function get${typeName}Members(${keyArgsSig}): Promise<string[]> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient();
    return await redis.smembers(key);
  } catch (error) {
    logger.error(\`Failed to get members of Set \${key}\`, error);
    return [];
  }
}
`;
        instanceFiles.push({
          filename: `src/helpers/${varName}/get${typeName}Members.ts`,
          language: "typescript",
          content: getMembersFnContent,
        });
        cacheHelperBarrelExports.push(`export * from "./get${typeName}Members";`);
      } else if (dataStructure === "zset" || dataStructure === "sorted_set") {
        // Sorted Set structure functions
        const addScoreFnContent = `import { getRedisClient } from "../../client";
import { get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("add${typeName}Score");

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
    const redis = await getRedisClient();
    return await redis.zadd(key, score, member);
  } catch (error) {
    logger.error(\`Failed to add score to ZSet \${key}\`, error);
    throw error;
  }
}
`;
        instanceFiles.push({
          filename: `src/helpers/${varName}/add${typeName}Score.ts`,
          language: "typescript",
          content: addScoreFnContent,
        });
        cacheHelperBarrelExports.push(`export * from "./add${typeName}Score";`);

        const getRankFnContent = `import { getRedisClient } from "../../client";
import { get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("get${typeName}Rank");

/**
 * Get member rank in ${typeName} Sorted Set
 */
export async function get${typeName}Rank(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  member: string,
): Promise<number | null> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient();
    return await redis.zrevrank(key, member);
  } catch (error) {
    logger.error(\`Failed to get rank in ZSet \${key}\`, error);
    return null;
  }
}
`;
        instanceFiles.push({
          filename: `src/helpers/${varName}/get${typeName}Rank.ts`,
          language: "typescript",
          content: getRankFnContent,
        });
        cacheHelperBarrelExports.push(`export * from "./get${typeName}Rank";`);

        const getTopFnContent = `import { getRedisClient } from "../../client";
import { get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("get${typeName}Top");

/**
 * Get top ranked members in ${typeName} Sorted Set
 */
export async function get${typeName}Top(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  limit: number = 10,
): Promise<string[]> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient();
    return await redis.zrevrange(key, 0, limit - 1);
  } catch (error) {
    logger.error(\`Failed to get top members from ZSet \${key}\`, error);
    return [];
  }
}
`;
        instanceFiles.push({
          filename: `src/helpers/${varName}/get${typeName}Top.ts`,
          language: "typescript",
          content: getTopFnContent,
        });
        cacheHelperBarrelExports.push(`export * from "./get${typeName}Top";`);
      } else {
        // String / JSON / Default functions
        const getFnContent = `import { getCache as rawGetCache } from "../../cache";
import { ${typeName}, get${typeName}Key } from "../../schemas/${varName}";

/**
 * Retrieve cached value for ${typeName}
 */
export async function get${typeName}(${keyArgsSig}): Promise<${typeName} | null> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  return rawGetCache<${typeName}>(key);
}
`;
        instanceFiles.push({
          filename: `src/helpers/${varName}/get${typeName}.ts`,
          language: "typescript",
          content: getFnContent,
        });
        cacheHelperBarrelExports.push(`export * from "./get${typeName}";`);

        const setFnContent = `import { setCache as rawSetCache } from "../../cache";
import {
  ${typeName},
  get${typeName}Key,
  ${typeName.toUpperCase()}_TTL_SECONDS,
} from "../../schemas/${varName}";

/**
 * Store cached value for ${typeName}
 */
export async function set${typeName}(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  value: ${typeName},
  ttlSeconds: number = ${typeName.toUpperCase()}_TTL_SECONDS,
): Promise<void> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  return rawSetCache<${typeName}>(key, value, ttlSeconds);
}
`;
        instanceFiles.push({
          filename: `src/helpers/${varName}/set${typeName}.ts`,
          language: "typescript",
          content: setFnContent,
        });
        cacheHelperBarrelExports.push(`export * from "./set${typeName}";`);
      }

      // Universal Invalidation File: invalidate<Name>.ts
      const invalidateFnContent = `import { getRedisClient } from "../../client";
import { deleteCache as rawDeleteCache } from "../../cache";
import {
  get${typeName}Key,
  ${typeName.toUpperCase()}_KEY_PATTERN,
} from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("invalidate${typeName}");

/**
 * Invalidate a specific ${typeName} key
 */
export async function invalidate${typeName}(${keyArgsSig}): Promise<boolean> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  return rawDeleteCache(key);
}

export const delete${typeName} = invalidate${typeName};

/**
 * Invalidate all keys matching ${typeName} pattern
 */
export async function invalidateAll${typeName}(): Promise<number> {
  try {
    const redis = await getRedisClient();
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
      instanceFiles.push({
        filename: `src/helpers/${varName}/invalidate${typeName}.ts`,
        language: "typescript",
        content: invalidateFnContent,
      });
      cacheHelperBarrelExports.push(`export * from "./invalidate${typeName}";`);

      // Any truly custom operations defined on the entity node (not default auto-generated ones)
      const standardNames = new Set([
        `get${typeName}`,
        `getAll${typeName}Fields`,
        `set${typeName}`,
        `set${typeName}Fields`,
        `get${typeName}Field`,
        `set${typeName}Field`,
        `invalidate${typeName}`,
        `delete${typeName}`,
        `invalidateAll${typeName}`,
        `push${typeName}`,
        `pop${typeName}`,
        `get${typeName}List`,
        `add${typeName}Members`,
        `is${typeName}Member`,
        `get${typeName}Members`,
        `add${typeName}Score`,
        `get${typeName}Rank`,
        `get${typeName}Top`,
      ]);

      const customOps = getEntityDbOperations(schemaNode, allNodes).filter(
        (op) => !op.isAutoGenerated && !standardNames.has(op.name),
      );

      customOps.forEach((op) => {
        if (op.enabled !== false && op.code && op.code.trim()) {
          const customFnName = op.name || `custom${typeName}Op`;
          const customFnFile = `import { getRedisClient } from "../../client";
import { getCache as rawGetCache, setCache as rawSetCache, deleteCache as rawDeleteCache } from "../../cache";
import {
  ${typeName},
  get${typeName}Key,
  ${typeName.toUpperCase()}_KEY_PATTERN,
  ${typeName.toUpperCase()}_TTL_SECONDS,
} from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("${customFnName}");

${op.code.trim()}
`;
          instanceFiles.push({
            filename: `src/helpers/${varName}/${customFnName}.ts`,
            language: "typescript",
            content: customFnFile,
          });
          cacheHelperBarrelExports.push(`export * from "./${customFnName}";`);
        }
      });

      // Barrel for this specific cache helpers: src/helpers/<varName>/index.ts
      const cacheBarrelContent = `/**
 * Helper Functions for ${typeName}
 */
${cacheHelperBarrelExports.join("\n")}
`;
      instanceFiles.push({
        filename: `src/helpers/${varName}/index.ts`,
        language: "typescript",
        content: cacheBarrelContent,
      });

      helperBarrelExports.push(`export * from "./${varName}";`);

      // Register reusable function metadata for this schema/helper
      instanceReusableFunctions.push({
        name: `get${typeName}`,
        importPath: packageName,
        signature: `get${typeName}(${keyArgsSig}): Promise<${typeName} | null>`,
        targetName: varName,
        kind: "findById",
      });

      instanceReusableFunctions.push({
        name: `getAll${typeName}Fields`,
        importPath: packageName,
        signature: `getAll${typeName}Fields(${keyArgsSig}): Promise<${typeName} | null>`,
        targetName: varName,
        kind: "findAll",
      });

      instanceReusableFunctions.push({
        name: `set${typeName}`,
        importPath: packageName,
        signature: `set${typeName}(${keyArgsSig ? `${keyArgsSig}, ` : ""}data: Partial<${typeName}>): Promise<void>`,
        targetName: varName,
        kind: "create",
      });

      instanceReusableFunctions.push({
        name: `set${typeName}Fields`,
        importPath: packageName,
        signature: `set${typeName}Fields(${keyArgsSig ? `${keyArgsSig}, ` : ""}data: Partial<${typeName}>): Promise<void>`,
        targetName: varName,
        kind: "create",
      });

      instanceReusableFunctions.push({
        name: `get${typeName}Field`,
        importPath: packageName,
        signature: `get${typeName}Field(${keyArgsSig ? `${keyArgsSig}, ` : ""}field: string): Promise<string | number | boolean | null>`,
        targetName: varName,
        kind: "findById",
      });

      instanceReusableFunctions.push({
        name: `set${typeName}Field`,
        importPath: packageName,
        signature: `set${typeName}Field(${keyArgsSig ? `${keyArgsSig}, ` : ""}field: string, value: string | number | boolean): Promise<void>`,
        targetName: varName,
        kind: "update",
      });

      instanceReusableFunctions.push({
        name: `invalidate${typeName}`,
        importPath: packageName,
        signature: `invalidate${typeName}(${keyArgsSig}): Promise<boolean>`,
        targetName: varName,
        kind: "delete",
      });

      instanceReusableFunctions.push({
        name: `delete${typeName}`,
        importPath: packageName,
        signature: `delete${typeName}(${keyArgsSig}): Promise<boolean>`,
        targetName: varName,
        kind: "delete",
      });
    });

    // 3.9. src/schemas/index.ts
    const schemasIndexContent = `/**
 * Generated Typed Redis Schemas for ${instLabel}
 */
${schemaBarrelExports.join("\n")}
`;
    instanceFiles.push({
      filename: "src/schemas/index.ts",
      language: "typescript",
      content: schemasIndexContent,
    });

    // 3.10. src/helpers/index.ts
    const helpersIndexContent = `/**
 * Generated Typed Redis Helper Functions for ${instLabel}
 */
${helperBarrelExports.join("\n")}
`;
    instanceFiles.push({
      filename: "src/helpers/index.ts",
      language: "typescript",
      content: helpersIndexContent,
    });

    // 3.11. src/index.ts
    const indexContent = `/**
 * Redis Package for ${instLabel} (${packageName})
 */
export * from "./config";
export * from "./client";
export * from "./cache";
export * from "./pubsub";
export * from "./streams";
${instanceSchemas.length > 0 ? `export * from "./schemas";\nexport * from "./helpers";\n` : ""}`;
    instanceFiles.push({
      filename: "src/index.ts",
      language: "typescript",
      content: indexContent,
    });

    // 3.12. docker-compose.yml
    const pFlag =
      persistenceMode === "None"
        ? '--save "" --appendonly no'
        : persistenceMode === "RDB"
          ? "--save 60 1 --appendonly no"
          : persistenceMode === "AOF"
            ? '--save "" --appendonly yes'
            : "--save 60 1 --appendonly yes";

    const dockerComposeContent = `version: "3.8"

services:
  ${packageFolder}:
    image: redis:7-alpine
    container_name: ${packageFolder}
    ports:
      - "${instPort}:6379"
    volumes:
      - ${packageFolder.replace(/-/g, "_")}_data:/data
    command: redis-server --maxmemory ${maxmemory} --maxmemory-policy ${maxmemoryPolicy} ${pFlag}

volumes:
  ${packageFolder.replace(/-/g, "_")}_data:
`;
    instanceFiles.push({
      filename: "docker-compose.yml",
      language: "yaml",
      content: dockerComposeContent,
    });

    // Merge into top-level files
    instanceFiles.forEach((f) => {
      mergedFiles.push({
        filename: `packages/${packageFolder}/${f.filename}`,
        language: f.language,
        content: f.content,
      });
    });

    allReusableFunctions.push(...instanceReusableFunctions);

    packages.push({
      packageName,
      packageFolder,
      redisNodeId: inst.id,
      redisLabel: instLabel,
      files: instanceFiles,
      reusableFunctions: instanceReusableFunctions,
    });
  });

  return {
    packages,
    files: mergedFiles,
    reusableFunctions: allReusableFunctions,
    packageFolder: packages[0]?.packageFolder || "redis",
    packageName: packages[0]?.packageName || "@workspace/redis",
  };
}

/**
 * Determines whether a specific service node is actively connected to any Redis node,
 * cache reference, or Redis schema.
 */
export function isServiceConnectedToRedis(
  serviceNode: BackendNode,
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = [],
  endpoints: (Endpoint & { nodeId?: string })[] = [],
): boolean {
  const redisNodes = allNodes.filter(
    (n) =>
      n.type === "redis_instance" ||
      n.type === "redis_schema" ||
      n.type === "redis-cache" ||
      n.type === "redis-streams" ||
      n.type === "redis-pubsub" ||
      n.data?.dbType === "redis",
  );
  if (redisNodes.length === 0) return false;

  const redisNodeIds = new Set(redisNodes.map((r) => r.id));

  // 1. Direct or handle-based edges between service and Redis nodes
  const serviceEndpoints = [
    ...(serviceNode.data?.endpoints || []),
    ...(serviceNode.data?.routeGroups?.flatMap((rg) => rg.endpoints || []) || []),
    ...endpoints.filter((ep) => ep.nodeId === serviceNode.id),
  ];
  const serviceEndpointIds = new Set(serviceEndpoints.map((ep) => ep.id));

  const hasConnectedEdge = allEdges.some((edge) => {
    if (!edge) return false;
    const isSourceService = edge.source === serviceNode.id;
    const isTargetService = edge.target === serviceNode.id;

    if (isSourceService && redisNodeIds.has(edge.target)) return true;
    if (isTargetService && redisNodeIds.has(edge.source)) return true;

    if (edge.sourceHandle && serviceEndpointIds.size > 0) {
      for (const epId of serviceEndpointIds) {
        if (
          edge.sourceHandle.includes(epId) &&
          (redisNodeIds.has(edge.target) || redisNodeIds.has(edge.source))
        ) {
          return true;
        }
      }
    }
    return false;
  });

  if (hasConnectedEdge) return true;

  // 2. Explicit crudOperations referencing a Redis node
  const hasCrudConnection = serviceEndpoints.some((ep) => {
    if (!ep.crudOperations) return false;
    const targetIds = Object.keys(ep.crudOperations);
    return targetIds.some((id) => redisNodeIds.has(id));
  });

  if (hasCrudConnection) return true;

  // 3. databaseNodeIds or databaseNodeId referencing a Redis node
  const hasDatabaseNodeId = serviceEndpoints.some((ep) => {
    if (ep.databaseNodeId && redisNodeIds.has(ep.databaseNodeId)) return true;
    if (
      ep.databaseNodeIds &&
      ep.databaseNodeIds.some((id) => redisNodeIds.has(id))
    )
      return true;
    return false;
  });

  return hasDatabaseNodeId;
}
