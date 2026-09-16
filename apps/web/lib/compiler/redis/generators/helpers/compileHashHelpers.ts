// ═══════════════════════════════════════════════════════════════
// MODULE: CompileHashHelpers
// LAYER:  redis / generators / helpers
// EMITS:  Hash-specific Redis helpers (get, set, getField, setField)
// ═══════════════════════════════════════════════════════════════

import { HelperContext, HelperEmitResult } from "./types";

export function compileHashHelpers(ctx: HelperContext): HelperEmitResult {
  const { varName, typeName, templateParams, keyArgsSig } = ctx.schema;
  const files: HelperEmitResult["files"] = [];
  const barrelExports: string[] = [];

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
  barrelExports.push(`export * from "./get${typeName}";`);

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
export async function set${typeName}<T = Partial<${typeName}>>(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  data: T,
  ttlSeconds?: number | { ttl?: number },
): Promise<void> {
  const resolvedTtl =
    typeof ttlSeconds === "number"
      ? ttlSeconds
      : typeof ttlSeconds === "object" && ttlSeconds !== null && typeof ttlSeconds.ttl === "number"
        ? ttlSeconds.ttl
        : ${typeName.toUpperCase()}_TTL_SECONDS;
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient();
    const entries: Record<string, string> = {};
    Object.entries(data as Record<string, unknown>).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        entries[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
      }
    });
    if (Object.keys(entries).length > 0) {
      await redis.hset(key, entries);
      if (resolvedTtl > 0) {
        await redis.expire(key, resolvedTtl);
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
  barrelExports.push(`export * from "./set${typeName}";`);

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
  barrelExports.push(`export * from "./get${typeName}Field";`);

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
  barrelExports.push(`export * from "./set${typeName}Field";`);

  return { files, barrelExports };
}
