import { CompiledFile, ReusableFunction } from "@workspace/canvas/types";
import { BackendNode } from "@/types/canvas";
import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";
import { GeneratedSchemaResult } from "./schemaFiles";

export interface HelperFilesResult {
  files: CompiledFile[];
  reusableFunctions: ReusableFunction[];
  helperBarrelExport: string;
}

export function generateHelperFilesForSchema(
  schema: GeneratedSchemaResult,
  schemaNode: BackendNode,
  allNodes: BackendNode[],
  packageName: string,
): HelperFilesResult {
  const { varName, typeName, dataStructure, templateParams, keyArgsSig } =
    schema;
  const files: CompiledFile[] = [];
  const cacheHelperBarrelExports: string[] = [];
  const reusableFunctions: ReusableFunction[] = [];

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
    files.push({
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
    files.push({
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
    files.push({
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
    files.push({
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
    files.push({
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
    files.push({
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
    files.push({
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
    files.push({
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
    files.push({
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
    files.push({
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
    files.push({
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
    files.push({
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
    files.push({
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
    files.push({
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
    files.push({
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
  files.push({
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
      files.push({
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
  files.push({
    filename: `src/helpers/${varName}/index.ts`,
    language: "typescript",
    content: cacheBarrelContent,
  });

  // Register reusable function metadata for this schema/helper
  reusableFunctions.push({
    name: `get${typeName}`,
    importPath: packageName,
    signature: `get${typeName}(${keyArgsSig}): Promise<${typeName} | null>`,
    targetName: varName,
    kind: "findById",
  });

  reusableFunctions.push({
    name: `getAll${typeName}Fields`,
    importPath: packageName,
    signature: `getAll${typeName}Fields(${keyArgsSig}): Promise<${typeName} | null>`,
    targetName: varName,
    kind: "findAll",
  });

  reusableFunctions.push({
    name: `set${typeName}`,
    importPath: packageName,
    signature: `set${typeName}(${keyArgsSig ? `${keyArgsSig}, ` : ""}data: Partial<${typeName}>): Promise<void>`,
    targetName: varName,
    kind: "create",
  });

  reusableFunctions.push({
    name: `set${typeName}Fields`,
    importPath: packageName,
    signature: `set${typeName}Fields(${keyArgsSig ? `${keyArgsSig}, ` : ""}data: Partial<${typeName}>): Promise<void>`,
    targetName: varName,
    kind: "create",
  });

  reusableFunctions.push({
    name: `get${typeName}Field`,
    importPath: packageName,
    signature: `get${typeName}Field(${keyArgsSig ? `${keyArgsSig}, ` : ""}field: string): Promise<string | number | boolean | null>`,
    targetName: varName,
    kind: "findById",
  });

  reusableFunctions.push({
    name: `set${typeName}Field`,
    importPath: packageName,
    signature: `set${typeName}Field(${keyArgsSig ? `${keyArgsSig}, ` : ""}field: string, value: string | number | boolean): Promise<void>`,
    targetName: varName,
    kind: "update",
  });

  reusableFunctions.push({
    name: `invalidate${typeName}`,
    importPath: packageName,
    signature: `invalidate${typeName}(${keyArgsSig}): Promise<boolean>`,
    targetName: varName,
    kind: "delete",
  });

  reusableFunctions.push({
    name: `delete${typeName}`,
    importPath: packageName,
    signature: `delete${typeName}(${keyArgsSig}): Promise<boolean>`,
    targetName: varName,
    kind: "delete",
  });

  return {
    files,
    reusableFunctions,
    helperBarrelExport: `export * from "./${varName}";`,
  };
}

export function generateHelpersIndex(
  helperBarrelExports: string[],
  instLabel: string,
): CompiledFile {
  const helpersIndexContent = `/**
 * Generated Typed Redis Helper Functions for ${instLabel}
 */
${helperBarrelExports.join("\n")}
`;

  return {
    filename: "src/helpers/index.ts",
    language: "typescript",
    content: helpersIndexContent,
  };
}
