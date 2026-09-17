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
import {
  ${typeName},
  get${typeName}Key,
  Get${typeName}Result,
  GetAll${typeName}FieldsResult,
} from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("get${typeName}");

/**
 * Retrieve entire Hash object for ${typeName}
 */
export async function get${typeName}(${keyArgsSig}): Promise<Get${typeName}Result> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient();
    const raw = await redis.hgetall(key);
    if (!raw || Object.keys(raw).length === 0) return { success: true, data: null };
    const data: ${typeName} = Object.assign({ id: key }, raw);
    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(\`Failed to get \${key} from Redis Hash\`, error);
    return {
      success: false,
      error: {
        message,
        code: "REDIS_HASH_GET_ERROR",
      },
    };
  }
}

export const getAll${typeName}Fields: (${keyArgsSig}) => Promise<GetAll${typeName}FieldsResult> = get${typeName};
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
  Set${typeName}Result,
  Set${typeName}FieldsResult,
} from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("set${typeName}");

/**
 * Set Hash fields for ${typeName}
 */
export async function set${typeName}(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  data: Partial<${typeName}>,
  ttlSeconds?: number | { ttl?: number },
): Promise<Set${typeName}Result> {
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
    Object.entries(data).forEach(([k, v]) => {
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
    return { success: true, data: undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(\`Failed to set \${key} in Redis Hash\`, error);
    return {
      success: false,
      error: {
        message,
        code: "REDIS_HASH_SET_ERROR",
      },
    };
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
import { ${typeName}, get${typeName}Key, Get${typeName}FieldResult } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("get${typeName}Field");

/**
 * Get a specific field from ${typeName}
 */
export async function get${typeName}Field<K extends keyof ${typeName}>(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  field: K,
): Promise<Get${typeName}FieldResult> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient();
    const val = await redis.hget(key, String(field));
    return { success: true, data: val };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(\`Failed to get field \${String(field)} from \${key}\`, error);
    return {
      success: false,
      error: {
        message,
        code: "REDIS_HASH_GETFIELD_ERROR",
      },
    };
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
import { ${typeName}, get${typeName}Key, Set${typeName}FieldResult } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("set${typeName}Field");

/**
 * Set a single field in ${typeName}
 */
export async function set${typeName}Field<K extends keyof ${typeName}>(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  field: K,
  value: ${typeName}[K],
): Promise<Set${typeName}FieldResult> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient();
    const valStr = typeof value === "object" ? JSON.stringify(value) : String(value);
    await redis.hset(key, String(field), valStr);
    return { success: true, data: undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(\`Failed to set field \${String(field)} on \${key}\`, error);
    return {
      success: false,
      error: {
        message,
        code: "REDIS_HASH_SETFIELD_ERROR",
      },
    };
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
